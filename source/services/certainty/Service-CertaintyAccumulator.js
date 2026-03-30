/**
 * Service-CertaintyAccumulator
 *
 * Evidence accumulation engine for data integration certainty scoring.
 *
 * Tracks two certainty dimensions per field per record (GUID):
 *
 *   1. Cross-dataset presence:  1 - ∏(1 - weight_i)
 *      Strong signal — independent datasets corroborating a value.
 *
 *   2. Within-dataset ratio:  log(count + 1) / log(datasetSize + 1)
 *      Weak signal — repetition within a single dataset has diminishing returns.
 *
 *   3. Composite:  (w_presence × presence) + (w_ratio × ratio)
 *      Configurable weights; default 70% presence, 30% ratio.
 *
 * Evidence is tracked at the FIELD level.  Record-level certainty is
 * derived on the fly as the mean of its field composites.
 *
 * Designed to plug into Facto's MultiSet projection pipeline at the
 * merge decision point, replacing the simple linear confidence tracker.
 *
 * @module Service-CertaintyAccumulator
 */

'use strict';

const libFableServiceProviderBase = require('fable-serviceproviderbase');

class MeadowIntegrationCertaintyAccumulator extends libFableServiceProviderBase
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this.serviceType = 'CertaintyAccumulator';
	}

	// ─────────────────────────────────────────────
	//  Context lifecycle
	// ─────────────────────────────────────────────

	/**
	 * Create a new accumulation context for a merge pipeline.
	 *
	 * @param {object} [pConfig] — optional overrides
	 * @param {number} [pConfig.PresenceWeight=0.7]
	 * @param {number} [pConfig.RatioWeight=0.3]
	 * @returns {object} AccumulationContext
	 */
	newAccumulationContext(pConfig)
	{
		let tmpConfig = (typeof pConfig === 'object' && pConfig !== null) ? pConfig : {};

		let tmpPresenceWeight = (typeof tmpConfig.PresenceWeight === 'number') ? tmpConfig.PresenceWeight : 0.7;
		let tmpRatioWeight    = (typeof tmpConfig.RatioWeight === 'number') ? tmpConfig.RatioWeight : 0.3;

		// Normalize so they sum to 1.0
		let tmpSum = tmpPresenceWeight + tmpRatioWeight;
		if (tmpSum > 0 && tmpSum !== 1.0)
		{
			tmpPresenceWeight = tmpPresenceWeight / tmpSum;
			tmpRatioWeight    = tmpRatioWeight / tmpSum;
		}

		return {
			Weights:
			{
				presence: tmpPresenceWeight,
				ratio:    tmpRatioWeight,
			},

			// Per-GUID, per-field evidence
			// { [GUID]: { [fieldName]: { value, sources: [...] } } }
			FieldEvidence: {},

			// Per-dataset metadata
			// { [stepLabel]: { weight, totalRecords, uniqueGUIDs } }
			DatasetContributions: {},
		};
	}

	// ─────────────────────────────────────────────
	//  Evidence accumulation
	// ─────────────────────────────────────────────

	/**
	 * Record evidence from a single dataset/step for a specific GUID.
	 *
	 * Call this once per GUID per step, after the merge strategy has
	 * decided the action but before updating the accumulated comprehension.
	 *
	 * @param {object} pContext — the AccumulationContext
	 * @param {string} pGUID — record GUID
	 * @param {object} pNewRecord — incoming record from this step
	 * @param {object|null} pExistingRecord — previously merged record (null if first seen)
	 * @param {string} pMergeAction — e.g. 'Created', 'Merged', 'Merged_Reinforced', 'Skipped_*'
	 * @param {object} pStepInfo — source metadata
	 * @param {number} pStepInfo.ReliabilityWeight — DatasetSource weight (0–1)
	 * @param {number} pStepInfo.DatasetSize — total records in this source dataset
	 * @param {number} [pStepInfo.RecordCountInDataset=1] — how many times this GUID appeared in the dataset
	 * @param {string} pStepInfo.StepLabel — human-readable source label
	 * @param {number} pStepInfo.StepOrdinal — sequential step number
	 */
	accumulateEvidence(pContext, pGUID, pNewRecord, pExistingRecord, pMergeAction, pStepInfo)
	{
		if (!pContext || !pGUID || !pNewRecord)
		{
			return;
		}

		let tmpStepInfo = pStepInfo || {};
		let tmpWeight      = (typeof tmpStepInfo.ReliabilityWeight === 'number') ? tmpStepInfo.ReliabilityWeight : 0.5;
		let tmpDatasetSize = tmpStepInfo.DatasetSize || 1;
		let tmpCount       = tmpStepInfo.RecordCountInDataset || 1;
		let tmpStepLabel   = tmpStepInfo.StepLabel || 'unknown';
		let tmpStepOrdinal = tmpStepInfo.StepOrdinal || 0;

		// Track dataset contributions
		if (!pContext.DatasetContributions[tmpStepLabel])
		{
			pContext.DatasetContributions[tmpStepLabel] =
			{
				weight:       tmpWeight,
				totalRecords: tmpDatasetSize,
				uniqueGUIDs:  0,
			};
		}
		pContext.DatasetContributions[tmpStepLabel].uniqueGUIDs++;

		// Initialize GUID evidence if needed
		if (!pContext.FieldEvidence[pGUID])
		{
			pContext.FieldEvidence[pGUID] = {};
		}
		let tmpGUIDEvidence = pContext.FieldEvidence[pGUID];

		// Record evidence for each field in the new record
		let tmpFieldNames = Object.keys(pNewRecord);
		for (let i = 0; i < tmpFieldNames.length; i++)
		{
			let tmpFieldName = tmpFieldNames[i];
			let tmpValue     = pNewRecord[tmpFieldName];

			// Skip GUID fields and internal metadata
			if (tmpFieldName.startsWith('GUID') || tmpFieldName.startsWith('_'))
			{
				continue;
			}

			if (!tmpGUIDEvidence[tmpFieldName])
			{
				tmpGUIDEvidence[tmpFieldName] =
				{
					value:   tmpValue,
					sources: [],
				};
			}

			tmpGUIDEvidence[tmpFieldName].sources.push(
			{
				weight:      tmpWeight,
				count:       tmpCount,
				datasetSize: tmpDatasetSize,
				stepLabel:   tmpStepLabel,
				stepOrdinal: tmpStepOrdinal,
				value:       tmpValue,
			});
		}
	}

	// ─────────────────────────────────────────────
	//  Certainty computation
	// ─────────────────────────────────────────────

	/**
	 * Compute field-level certainty scores for a single GUID.
	 *
	 * @param {object} pContext — the AccumulationContext
	 * @param {string} pGUID — record GUID
	 * @returns {object} — { fields: { fieldName: { presence, ratio, composite, agreeing, conflicting } }, recordComposite }
	 */
	computeCertainty(pContext, pGUID)
	{
		if (!pContext || !pContext.FieldEvidence[pGUID])
		{
			return { fields: {}, recordComposite: 0.5 };
		}

		let tmpGUIDEvidence = pContext.FieldEvidence[pGUID];
		let tmpFieldNames   = Object.keys(tmpGUIDEvidence);
		let tmpFields       = {};
		let tmpCompositeSum = 0;
		let tmpFieldCount   = 0;

		for (let i = 0; i < tmpFieldNames.length; i++)
		{
			let tmpFieldName    = tmpFieldNames[i];
			let tmpFieldData    = tmpGUIDEvidence[tmpFieldName];
			let tmpSources      = tmpFieldData.sources;
			let tmpCurrentValue = tmpFieldData.value;

			// ── Cross-dataset presence ──────────────────────────
			// Only count sources where the value AGREES with the current value.
			// Conflicting sources don't contribute to presence.
			let tmpAgreeingSources    = [];
			let tmpConflictingSources = [];

			for (let j = 0; j < tmpSources.length; j++)
			{
				if (this._valuesMatch(tmpSources[j].value, tmpCurrentValue))
				{
					tmpAgreeingSources.push(tmpSources[j]);
				}
				else
				{
					tmpConflictingSources.push(tmpSources[j]);
				}
			}

			// presence = 1 - ∏(1 - weight_i) for agreeing sources
			let tmpUncertainty = 1.0;
			for (let j = 0; j < tmpAgreeingSources.length; j++)
			{
				tmpUncertainty *= (1.0 - tmpAgreeingSources[j].weight);
			}
			let tmpPresence = 1.0 - tmpUncertainty;

			// Penalize if there are conflicting sources
			if (tmpConflictingSources.length > 0)
			{
				let tmpConflictPenalty = tmpConflictingSources.length / (tmpAgreeingSources.length + tmpConflictingSources.length);
				tmpPresence *= (1.0 - (tmpConflictPenalty * 0.5));
			}

			// ── Within-dataset ratio (best source) ──────────────
			// Use the strongest ratio from any agreeing source
			let tmpBestRatio = 0;
			for (let j = 0; j < tmpAgreeingSources.length; j++)
			{
				let tmpSrc   = tmpAgreeingSources[j];
				let tmpRatio = Math.log(tmpSrc.count + 1) / Math.log(tmpSrc.datasetSize + 1);
				if (tmpRatio > tmpBestRatio)
				{
					tmpBestRatio = tmpRatio;
				}
			}

			// ── Composite ───────────────────────────────────────
			let tmpComposite = (pContext.Weights.presence * tmpPresence) +
				(pContext.Weights.ratio * tmpBestRatio);

			// Clamp to [0, 1]
			tmpComposite = Math.max(0, Math.min(1, tmpComposite));

			tmpFields[tmpFieldName] =
			{
				presence:    Math.round(tmpPresence * 10000) / 10000,
				ratio:       Math.round(tmpBestRatio * 10000) / 10000,
				composite:   Math.round(tmpComposite * 10000) / 10000,
				agreeing:    tmpAgreeingSources.length,
				conflicting: tmpConflictingSources.length,
			};

			tmpCompositeSum += tmpComposite;
			tmpFieldCount++;
		}

		let tmpRecordComposite = tmpFieldCount > 0
			? Math.round((tmpCompositeSum / tmpFieldCount) * 10000) / 10000
			: 0.5;

		return {
			fields:          tmpFields,
			recordComposite: tmpRecordComposite,
		};
	}

	/**
	 * Bulk compute certainty for all GUIDs in the context.
	 *
	 * @param {object} pContext — the AccumulationContext
	 * @returns {object} — { [GUID]: CertaintyResult }
	 */
	computeAllCertainties(pContext)
	{
		if (!pContext || !pContext.FieldEvidence)
		{
			return {};
		}

		let tmpResults = {};
		let tmpGUIDs   = Object.keys(pContext.FieldEvidence);

		for (let i = 0; i < tmpGUIDs.length; i++)
		{
			tmpResults[tmpGUIDs[i]] = this.computeCertainty(pContext, tmpGUIDs[i]);
		}

		return tmpResults;
	}

	// ─────────────────────────────────────────────
	//  CertaintyIndex entry generation
	// ─────────────────────────────────────────────

	/**
	 * Generate CertaintyIndex entries for a single GUID.
	 * Creates one entry per field per dimension (presence, ratio, composite).
	 *
	 * @param {object} pContext — the AccumulationContext
	 * @param {string} pGUID — record GUID
	 * @param {number} pIDRecord — Facto Record ID to link entries to
	 * @returns {Array} — array of { IDRecord, CertaintyValue, Dimension, Justification }
	 */
	generateCertaintyEntries(pContext, pGUID, pIDRecord)
	{
		let tmpCertainty = this.computeCertainty(pContext, pGUID);
		let tmpEntries   = [];

		let tmpFieldNames = Object.keys(tmpCertainty.fields);
		for (let i = 0; i < tmpFieldNames.length; i++)
		{
			let tmpFieldName = tmpFieldNames[i];
			let tmpField     = tmpCertainty.fields[tmpFieldName];

			let tmpJustification = JSON.stringify(
			{
				agreeing:    tmpField.agreeing,
				conflicting: tmpField.conflicting,
				weights:     pContext.Weights,
			});

			tmpEntries.push(
			{
				IDRecord:       pIDRecord,
				CertaintyValue: tmpField.presence,
				Dimension:      `field:${tmpFieldName}:presence`,
				Justification:  tmpJustification,
			});

			tmpEntries.push(
			{
				IDRecord:       pIDRecord,
				CertaintyValue: tmpField.ratio,
				Dimension:      `field:${tmpFieldName}:ratio`,
				Justification:  tmpJustification,
			});

			tmpEntries.push(
			{
				IDRecord:       pIDRecord,
				CertaintyValue: tmpField.composite,
				Dimension:      `field:${tmpFieldName}:composite`,
				Justification:  tmpJustification,
			});
		}

		return tmpEntries;
	}

	// ─────────────────────────────────────────────
	//  Internal helpers
	// ─────────────────────────────────────────────

	/**
	 * Compare two values for equality.
	 * Handles strings, numbers, nulls, and undefined.
	 * String comparisons are case-insensitive and trimmed.
	 */
	_valuesMatch(pValueA, pValueB)
	{
		// Both null/undefined
		if (pValueA == null && pValueB == null)
		{
			return true;
		}

		// One null, other not
		if (pValueA == null || pValueB == null)
		{
			return false;
		}

		// Both strings — case-insensitive, trimmed
		if (typeof pValueA === 'string' && typeof pValueB === 'string')
		{
			return pValueA.trim().toLowerCase() === pValueB.trim().toLowerCase();
		}

		// Numeric comparison with tolerance
		if (typeof pValueA === 'number' && typeof pValueB === 'number')
		{
			return Math.abs(pValueA - pValueB) < 0.0001;
		}

		// Fall back to strict equality
		return pValueA === pValueB;
	}
}

module.exports = MeadowIntegrationCertaintyAccumulator;
