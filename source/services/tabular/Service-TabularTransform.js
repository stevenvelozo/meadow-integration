const libFableService = require('fable-serviceproviderbase');

const libGUIDComposer = require('../guid/Meadow-Integration-GUIDComposer.js');

/*
		// Comprehension Parameters
		// This can be *either* a mapping file, in the following format, or a set of parameters listed below.  The mapping file lets you map columns way easier!
		/* Comprehension Mapping File (for the file `/debug/testdata/airports.csv` in this repository):
		{
			"Entity": "Airport",
			"GUIDTemplate": "Airport-{~D:iata~}",
			"Mappings":
			{
				"Code": "{~D:iata~}",
				"Name": "{~D:name~}",
				"Description": "{~D:name~} airport in {~D:city~} auto-ingested from CSV file.",
				"City": "{~D:city~}",
				"State": "{~D:state~}",
				"Country": "{~D:country~}",
				"Latitude": "{~D:lat~}",
				"Longitude": "{~D:long~}"
			}
		}
*/

class MeadowIntegrationTabularTransform extends libFableService
{
	constructor(pFable, pManifest, pServiceHash)
	{
		super(pFable, pManifest, pServiceHash);
	}

	newMappingOutcomeObject()
	{
		const tmpMappingOutcome = (
			{
				Comprehension: {},            // The comprehension we are generating
				ExistingComprehension: false, // The comprehension we put the generated comprehension into

				// The three part configuration for this command, which is unioned together in this order to get the final executing configuration
				ImplicitConfiguration: false,  // Any configuration implicitly gathered from the first record
				ExplicitConfiguration: false,  // Any configuration that is explicit from a configuration file
				UserConfiguration: {},         // Any user passed-in overrides (e.g. a different entity name)
				// The container for the final merged execution configuration
				Configuration: false,

				ParsedRowCount: 0,
				BadRecords: []
			});

		return tmpMappingOutcome;
	}

	onBeforeInitializeMappingOutcomeObject(pMappingOutcomeObject)
	{

	}
	initializeMappingOutcomeObject(pMappingOutcomeObject)
	{
		const tmpMappingOutcome = (typeof(pMappingOutcomeObject) === 'object') ? pMappingOutcomeObject : this.newMappingOutcomeObject();

		if (tmpMappingOutcome.TimeInitialized)
		{
			return tmpMappingOutcome;
		}
		tmpMappingOutcome.TimeInitialized = +(new Date());

		this.onBeforeInitializeMappingOutcomeObject(tmpMappingOutcome);

		if (!tmpMappingOutcome.ImplicitConfiguration)
		{
			tmpMappingOutcome.ImplicitConfiguration = this.generateMappingConfigurationPrototype(`Unknown-${this.fable.getUUID()}`, tmpIncomingRecord);
		}

		if ((!tmpMappingOutcome.ExplicitConfiguration) || (typeof (tmpMappingOutcome.ExplicitConfiguration) != 'object'))
		{
			// Just use the implicit configuration
			//this.fable.log.info(`Using implicit configuration for ${tmpMappingOutcome.Entity} comprehension; no valid explicit configuration available.`);
			tmpMappingOutcome.Configuration = Object.assign({}, tmpMappingOutcome.ImplicitConfiguration, tmpMappingOutcome.UserConfiguration);
		}
		else
		{
			//this.fable.log.info(`Using explicit configuration for ${tmpMappingOutcome.Entity} comprehension.`);
			tmpMappingOutcome.Configuration = Object.assign({}, tmpMappingOutcome.ImplicitConfiguration, tmpMappingOutcome.ExplicitConfiguration, tmpMappingOutcome.UserConfiguration);
		}

		if (!('GUIDName' in tmpMappingOutcome.Configuration))
		{
			tmpMappingOutcome.Configuration.GUIDName = `GUID${tmpMappingOutcome.Configuration.Entity}`;
		}

		if (!(tmpMappingOutcome.Configuration.Entity in tmpMappingOutcome.Comprehension))
		{
			tmpMappingOutcome.Comprehension[tmpMappingOutcome.Configuration.Entity] = {};
		}

		this.onAfterInitializeMappingOutcomeObject(tmpMappingOutcome);

		return tmpMappingOutcome;
	}
	onAfterInitializeMappingOutcomeObject(pMappingOutcomeObject)
	{

	}

	generateMappingConfigurationPrototype(pRepresentativeString, pRecord)
	{
		let tmpMapping = {};

		// Generate the entity name from the filename
		// For instance "my favorite cats.csv" would become "MyFavoriteCats"
		// TODO: Upstream of this do libPath.basename(pRepresentativeString, libPath.extname( with the filename to generate this if it comes from a file
		tmpMapping.Entity = this.fable.DataFormat.cleanNonAlphaCharacters(this.fable.DataFormat.capitalizeEachWord(pRepresentativeString));

		let tmpKeys = Object.keys(pRecord);
		if (tmpKeys.length < 1)
		{
			tmpMapping.GUIDTemplate = ``;
		}
		else
		{
			tmpMapping.GUIDTemplate = `GUID-${tmpMapping.Entity}-{~Data:Record.${tmpKeys[0]}~}`;
		}

		tmpMapping.Mappings = {};

		for (let i = 0; i < tmpKeys.length; i++)
		{
			tmpMapping.Mappings[tmpKeys[i]] = `{~Data:Record.${tmpKeys[i]}~}`;
		}

		return tmpMapping;
	}

	createRecordFromMapping(pRecord, pMapping, pRecordPrototype)
	{
		let tmpRecord = ((typeof(pRecordPrototype) == 'object') && (pRecordPrototype != null)) ? JSON.parse(JSON.stringify(pRecordPrototype)) : {};

		// Opt-in context-aware GUID strategy: compose the entity's own GUID + its foreign-key GUID/ID
		// fields from a structured spec (length-safe + deterministic). Falls back to the flat GUIDTemplate
		// when no strategy is attached, so every existing mapping behaves exactly as before.
		if (pMapping.GUIDStrategy)
		{
			this._applyGUIDStrategy(tmpRecord, pMapping.GUIDStrategy, pRecord);
		}
		else
		{
			tmpRecord[pMapping.GUIDName] = this.fable.parseTemplate(pMapping.GUIDTemplate, pRecord);
		}

		let tmpKeys = Object.keys(pMapping.Mappings);
		for (let i = 0; i < tmpKeys.length; i++)
		{
			let tmpMappingKey = tmpKeys[i];
			if (pMapping.ManyfestAddresses)
			{
				this.fable.manifest.setValueAtAddress(tmpRecord, tmpMappingKey, this.fable.parseTemplate(pMapping.Mappings[tmpMappingKey], pRecord));
			}
			else
			{
				tmpRecord[tmpMappingKey] = this.fable.parseTemplate(pMapping.Mappings[tmpMappingKey], pRecord);
			}
		}

		return tmpRecord;
	}

	/**
	 * Resolve a GUID compose spec's segment value-templates against the row, then run the deterministic
	 * length-safe composer. The compiler (Meadow-Integration-GUIDStrategy) produced the spec.
	 * @param {Record<string, any>} pComposeSpec @param {Record<string, any>} pRecord
	 * @returns {string}
	 */
	composeGUIDFromSpec(pComposeSpec, pRecord)
	{
		let tmpSegments = (Array.isArray(pComposeSpec.segments) ? pComposeSpec.segments : []).map((pSegment) =>
		{
			return {
				abbrev: pSegment.abbrev,
				value: pSegment.valueTemplate ? this.fable.parseTemplate(pSegment.valueTemplate, pRecord) : '',
			};
		});
		return libGUIDComposer.composeGUID(
			{
				prefix: pComposeSpec.prefix,
				separator: pComposeSpec.separator,
				maxLength: pComposeSpec.maxLength,
				hashLength: pComposeSpec.hashLength,
				segments: tmpSegments,
			});
	}

	/**
	 * Stamp an entity's own GUID + its foreign-key fields onto the record from a compiled GUID strategy.
	 * Own / each join is one of: prefixed (Compose spec) or raw/rawid (a resolved source-column template).
	 * @param {Record<string, any>} pTargetRecord @param {Record<string, any>} pStrategy @param {Record<string, any>} pRecord
	 */
	_applyGUIDStrategy(pTargetRecord, pStrategy, pRecord)
	{
		let tmpOwn = pStrategy.Own || {};
		if (tmpOwn.FieldName)
		{
			pTargetRecord[tmpOwn.FieldName] = tmpOwn.Compose
				? this.composeGUIDFromSpec(tmpOwn.Compose, pRecord)
				: (tmpOwn.ValueTemplate ? this.fable.parseTemplate(tmpOwn.ValueTemplate, pRecord) : '');
		}
		let tmpJoins = Array.isArray(pStrategy.Joins) ? pStrategy.Joins : [];
		for (let i = 0; i < tmpJoins.length; i++)
		{
			let tmpJoin = tmpJoins[i];
			if (!tmpJoin || !tmpJoin.FieldName) { continue; }
			pTargetRecord[tmpJoin.FieldName] = tmpJoin.Compose
				? this.composeGUIDFromSpec(tmpJoin.Compose, pRecord)
				: (tmpJoin.ValueTemplate ? this.fable.parseTemplate(tmpJoin.ValueTemplate, pRecord) : '');
		}
	}

	addRecordToComprehension(pIncomingRecord, pMappingOutcome, pNewRecordPrototype, pGUIDUniquenessString)
	{
		let tmpNewRecordPrototype = (typeof(pNewRecordPrototype) == 'object') ? pNewRecordPrototype : {};
		let tmpIncomingRecord = JSON.parse(JSON.stringify(pIncomingRecord));

		if (pGUIDUniquenessString && (typeof (pGUIDUniquenessString) == 'string'))
		{
			tmpIncomingRecord['_GUIDUniqueness'] = pGUIDUniquenessString;
		}
		
		let tmpNewRecord = this.createRecordFromMapping(tmpIncomingRecord, pMappingOutcome.Configuration, tmpNewRecordPrototype);

		if (typeof (tmpNewRecord) != 'object')
		{
			this.fable.log.warn(`No valid record generated from incoming transformation operation.  Skipping.`);
			pMappingOutcome.BadRecords.push(tmpIncomingRecord);
		}
		else if (!tmpNewRecord[pMappingOutcome.Configuration.GUIDName] || tmpNewRecord[pMappingOutcome.Configuration.GUIDName] == '')
		{
			this.fable.log.warn(`No valid GUID found for record.  Skipping.`);
			pMappingOutcome.BadRecords.push(tmpIncomingRecord);
		}
		else
		{
			if (tmpNewRecord[pMappingOutcome.Configuration.GUIDName] in pMappingOutcome.Comprehension[pMappingOutcome.Configuration.Entity])
			{
				// Already been ingested once by this parse!
				this.fable.log.warn(`Duplicate record found for ${pMappingOutcome.Configuration.GUIDName}->[${tmpNewRecord[pMappingOutcome.Configuration.GUIDName]}].  Merging with previous record.`);
				pMappingOutcome.Comprehension[pMappingOutcome.Configuration.Entity][tmpNewRecord[pMappingOutcome.Configuration.GUIDName]] = Object.assign({}, pMappingOutcome.Comprehension[pMappingOutcome.Configuration.Entity][tmpNewRecord[pMappingOutcome.Configuration.GUIDName]], tmpNewRecord);
			}
			else if (pMappingOutcome.ExistingComprehension && (pMappingOutcome.Configuration.Entity in pMappingOutcome.ExistingComprehension) && (tmpNewRecord[pMappingOutcome.Configuration.GUIDName] in pMappingOutcome.ExistingComprehension[pMappingOutcome.Configuration.Entity]))
			{
				// Pull it in from the old comprehension
				pMappingOutcome.Comprehension[pMappingOutcome.Configuration.Entity][tmpNewRecord[pMappingOutcome.Configuration.GUIDName]] = Object.assign({}, pMappingOutcome.ExistingComprehension[pMappingOutcome.Configuration.Entity][tmpNewRecord[pMappingOutcome.Configuration.GUIDName]], tmpNewRecord);
			}
			else
			{
				// Net new record
				pMappingOutcome.Comprehension[pMappingOutcome.Configuration.Entity][tmpNewRecord[pMappingOutcome.Configuration.GUIDName]] = tmpNewRecord;
			}
		}
	}

	transformRecord(tmpIncomingRecord, pMappingOutcomeObject)
	{
		const tmpMappingOutcome = this.initializeMappingOutcomeObject(pMappingOutcomeObject);

		tmpMappingOutcome.ParsedRowCount++;

		// Generate a one-time-use solution object, which aids in the solver and templating
		let tmpMappingRecordSolution = (
			{
				IncomingRecord: tmpIncomingRecord,
				MappingConfiguration: tmpMappingOutcome.Configuration,
				MappingOutcome: tmpMappingOutcome,

				RowIndex: tmpMappingOutcome.ParsedRowCount,

				NewRecordsGUIDUniqueness: [],
				NewRecordPrototype: {},

				Fable: this.fable,
				Pict: this.fable,
				AppData: this.fable.AppData
			});

		if (tmpMappingOutcome.Configuration.Solvers && Array.isArray(tmpMappingOutcome.Configuration.Solvers))
		{
			// Solvers have IncomingRecord, RecordGenerationRules, NewRecordPrototype
			let tmpSolverResultsObject = {};
			for (let i = 0; i < tmpMappingOutcome.Configuration.Solvers.length; i++)
			{
				let tmpSolver = tmpMappingOutcome.Configuration.Solvers[i];
				this.fable.ExpressionParser.solve(tmpSolver, tmpMappingRecordSolution, tmpSolverResultsObject, this.fable.manifest, tmpMappingRecordSolution);
			}
		}

		if (tmpMappingOutcome.Configuration.MultipleGUIDUniqueness && tmpMappingRecordSolution.NewRecordsGUIDUniqueness.length > 0)
		{
			// Run create record for each of the uniqueness guid entries
			for (let i = 0; i < tmpMappingRecordSolution.NewRecordsGUIDUniqueness.length; i++)
			{
				this.addRecordToComprehension(tmpIncomingRecord, tmpMappingOutcome, tmpMappingRecordSolution.NewRecordPrototype, tmpMappingRecordSolution.NewRecordsGUIDUniqueness[i]);
			}
		}
		else if (!tmpMappingOutcome.Configuration.MultipleGUIDUniqueness)
		{
			this.addRecordToComprehension(tmpIncomingRecord, tmpMappingOutcome, tmpMappingRecordSolution.NewRecordPrototype);
		}
		else
		{
			this.fable.log.error(`No valid GUID uniqueness entries generated for ${tmpMappingOutcome.Entity} incoming record at row ${tmpMappingOutcome.ParsedRowCount}; skipping record.`);
		}
	}
}

module.exports = MeadowIntegrationTabularTransform;