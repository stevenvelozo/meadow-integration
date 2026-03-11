const libFableServiceProviderBase = require('fable-serviceproviderbase');
const libGUIDMap = require('./Meadow-Service-Integration-GUIDMap.js');

const defaultMeadowIntegrationAdapterOptions = (
	{
		"Entity": "DefaultEntity",

		"AdapterSetGUIDMarshalPrefix": false,

		"EntityGUIDMarshalPrefix": false,

		// Maximum allowed length for generated GUIDs.
		// When 0, the adapter falls back to DefaultGUIDColumnSize.
		// When a positive integer, this explicit value overrides everything.
		"GUIDMaxLength": 0,

		// Schema-driven per-entity GUID column sizes.
		// Keys are entity names, values are max GUID column sizes.
		// Pass the full map in options or let it default to empty.
		"GUIDColumnSizes": {},

		// Default GUID column size when not available in GUIDColumnSizes.
		"DefaultGUIDColumnSize": 36,

		// When false (default), the adapter will throw an error if a generated GUID
		// exceeds the maximum allowed length.
		// When true, the prefix is truncated to fit while preserving the full external GUID.
		"AllowGUIDTruncation": false,

		// When true, only marshal fields that are present in the schema (no passthrough of unknown fields).
		"SimpleMarshal": false,

		// When true, pass through all fields regardless of schema presence.
		"ForceMarshal": false,

		"PerformUpserts": true,
		"PerformDeletes": true,

		"RecordPushRetryThreshold": 5,

		"RecordThresholdForBulkUpsert": 1000,
		"BulkUpsertBatchSize": 100,

		// How often (in records) to log per-entity progress (0 = disabled).
		"ProgressLogInterval": 100,

		"ApiURLPrefix": '/1.0/'
	});

class MeadowIntegrationAdapter extends libFableServiceProviderBase
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({}, defaultMeadowIntegrationAdapterOptions, pOptions);
		super(pFable, tmpOptions, pServiceHash);

		this.serviceType = 'IntegrationAdapter';

		// Check if there is a GUIDMap .. if not make one
		if (!this.fable.MeadowGUIDMap)
		{
			this.fable.addAndInstantiateServiceType('MeadowGUIDMap', libGUIDMap);
		}

		// REST client: prefer explicit injection, then MeadowCloneRestClient, then
		// fall back to creating a bare RestClient as the original code did.
		this.client = this.options.Client || null;

		this.fable.instantiateServiceProviderIfNotExists('ProgressTrackerSet');

		this.Entity = this.options.Entity;
		this.EntityGUIDName = `GUID${this.Entity}`;
		this.EntityIDName = `ID${this.Entity}`;

		// Automagic GUID Components
		this.AdapterSetGUIDMarshalPrefix = this.options.AdapterSetGUIDMarshalPrefix;
		if (typeof this.AdapterSetGUIDMarshalPrefix !== 'string')
		{
			if (typeof this.fable.settings.AdapterSetGUIDMarshalPrefix === 'string')
			{
				this.AdapterSetGUIDMarshalPrefix = this.fable.settings.AdapterSetGUIDMarshalPrefix;
			}
			else
			{
				this.AdapterSetGUIDMarshalPrefix = 'INTG-DEF';
			}
		}
		this.EntityGUIDMarshalPrefix = this.options.EntityGUIDMarshalPrefix;
		if (typeof this.EntityGUIDMarshalPrefix !== 'string')
		{
			this.EntityGUIDMarshalPrefix = `E-${this.Entity}`;
		}

		// Resolve GUID max length: explicit option > GUIDColumnSizes > DefaultGUIDColumnSize
		if (this.options.GUIDMaxLength > 0)
		{
			this.GUIDMaxLength = this.options.GUIDMaxLength;
		}
		else if (this.options.GUIDColumnSizes && this.options.GUIDColumnSizes.hasOwnProperty(this.Entity))
		{
			this.GUIDMaxLength = this.options.GUIDColumnSizes[this.Entity];
		}
		else
		{
			this.GUIDMaxLength = this.options.DefaultGUIDColumnSize;
		}
		this.AllowGUIDTruncation = this.options.AllowGUIDTruncation;

		// Integration Adapter Controls
		this._PerformUpserts = this.options.PerformUpserts;
		this._PerformDeletes = this.options.PerformDeletes;

		this._RecordPushRetryThreshold = this.options.RecordPushRetryThreshold;

		// Meta progress tracker — an optional external progress tracker hash that is
		// incremented alongside the per-entity tracker so callers can monitor overall
		// progress across multiple adapters/entities.
		this.MetaProgressTrackerHash = false;
		// How often (in records) to log the meta progress tracker status (0 = never auto-log).
		this.MetaProgressTrackerLogInterval = 0;

		// The source records (coming from the external system)
		this._SourceRecords = {};

		// The marshaled records (meant to be upserted to the storage or Queued for Delete)
		this._MarshaledRecords = {};
		this._DeletedRecords = {};
	}

	/**
	 * Set the REST client for this adapter.
	 * The client should expose: upsertEntity, upsertEntities, getEntityByGUID,
	 * getEntity, deleteEntity, getJSON, and have a serverURL + restClient property.
	 *
	 * @param {object} pClient - The REST client instance (e.g. MeadowCloneRestClient)
	 */
	setRestClient(pClient)
	{
		this.client = pClient;
	}

	/**
	 * Resolve the REST client to use.  Checks (in order):
	 * 1. Explicitly set client via setRestClient / options.Client
	 * 2. MeadowCloneRestClient on fable
	 * 3. EntityProvider on fable (legacy)
	 *
	 * @returns {object} A REST client instance
	 */
	_resolveClient()
	{
		if (this.client)
		{
			return this.client;
		}
		if (this.fable.MeadowCloneRestClient)
		{
			return this.fable.MeadowCloneRestClient;
		}
		if (this.fable.EntityProvider)
		{
			return this.fable.EntityProvider;
		}
		this.log.error(`No REST client available for Integration Adapter [${this.Entity}].  Call setRestClient() or ensure MeadowCloneRestClient is registered.`);
		return null;
	}

	/**
	 * The combined GUID prefix string.
	 *
	 * @returns {string} The GUID prefix
	 */
	get GUIDPrefix()
	{
		let tmpPrefix = '';
		if (this.AdapterSetGUIDMarshalPrefix)
		{
			tmpPrefix += `${this.AdapterSetGUIDMarshalPrefix}-`;
		}
		if (this.EntityGUIDMarshalPrefix)
		{
			tmpPrefix += `${this.EntityGUIDMarshalPrefix}-`;
		}
		return tmpPrefix;
	}

	/**
	 * Generate a Meadow GUID from an external system GUID.
	 *
	 * If the generated GUID would exceed GUIDMaxLength and AllowGUIDTruncation
	 * is false (the default), an error is thrown so the integration stops immediately.
	 *
	 * When AllowGUIDTruncation is true, the prefix is progressively truncated to
	 * fit while preserving the full external GUID.
	 *
	 * @param {string} pExternalGUID - The external system GUID
	 * @returns {string} The generated Meadow GUID
	 */
	generateMeadowGUIDFromExternalGUID(pExternalGUID)
	{
		let tmpFullGUID = `${this.GUIDPrefix}${pExternalGUID}`;

		if (this.GUIDMaxLength > 0 && tmpFullGUID.length > this.GUIDMaxLength)
		{
			if (!this.AllowGUIDTruncation)
			{
				let tmpMessage = `Generated GUID for [${this.Entity}] exceeds the maximum allowed length of ${this.GUIDMaxLength} characters.\n`
					+ `  Comprehension GUID: [${pExternalGUID}] (${pExternalGUID.length} chars)\n`
					+ `  Server GUID:        [${tmpFullGUID}] (${tmpFullGUID.length} chars)\n`
					+ `  Prefix:             [${this.GUIDPrefix}] (${this.GUIDPrefix.length} chars)\n`
					+ `  To allow automatic prefix truncation for one-time imports, set AllowGUIDTruncation to true (CLI: --allowguidtruncation).`;
				this.log.error(tmpMessage);
				throw new Error(tmpMessage);
			}

			// AllowGUIDTruncation is on — the external GUID is sacrosanct, so truncate the prefix instead.
			let tmpAvailablePrefixLength = this.GUIDMaxLength - pExternalGUID.length;

			if (tmpAvailablePrefixLength <= 0)
			{
				// External GUID alone meets or exceeds the limit; drop the prefix entirely.
				this.log.warn(`External GUID [${pExternalGUID}] for [${this.Entity}] is ${pExternalGUID.length} characters which meets or exceeds the GUID max length of ${this.GUIDMaxLength}.  Using external GUID with no prefix.`);
				tmpFullGUID = pExternalGUID.substring(0, this.GUIDMaxLength);
			}
			else
			{
				let tmpTruncatedPrefix = this.GUIDPrefix.substring(0, tmpAvailablePrefixLength);
				tmpFullGUID = `${tmpTruncatedPrefix}${pExternalGUID}`;
				this.log.warn(`Generated GUID for [${this.Entity}] would be ${this.GUIDPrefix.length + pExternalGUID.length} characters (limit ${this.GUIDMaxLength}); prefix truncated from [${this.GUIDPrefix}] to [${tmpTruncatedPrefix}].`);
			}
		}

		return tmpFullGUID;
	}

	/**
	 * Integrate records: fetch schema, marshal, push.
	 *
	 * @param {(error?: Error) => void} fCallback - Callback when done
	 * @param {(source: any, marshalled: any) => void} [fMarshalExtraData] - Optional per-record extra marshal function
	 */
	integrateRecords(fCallback, fMarshalExtraData)
	{
		let tmpMarshalExtraData = fMarshalExtraData;
		let tmpAnticipate = this.fable.newAnticipate();
		let tmpClient = this._resolveClient();

		if (!tmpClient)
		{
			return fCallback(new Error(`No REST client available for [${this.Entity}].`));
		}

		tmpAnticipate.anticipate(
			(fStageComplete) =>
			{
				this.fable.log.info(`Getting schema for ${this.Entity}....`);

				let tmpSchemaURL = `${this.Entity}/Schema`;

				tmpClient.getJSON(tmpSchemaURL,
					(pError, pBody) =>
					{
						// getJSON on MeadowCloneRestClient returns (pError, pResponse, pBody)
						// but some clients return (pError, pBody).  Handle both:
						let tmpBody = pBody;
						if (arguments.length >= 3)
						{
							tmpBody = arguments[2];
						}

						if (tmpBody && (typeof(tmpBody) == 'object'))
						{
							this.meadowSchema = tmpBody;

							// Override the GUID column size from the live server schema when
							// the caller has not explicitly set a positive GUIDMaxLength option.
							if (this.options.GUIDMaxLength <= 0 && Array.isArray(tmpBody.Columns))
							{
								let tmpGuidColumn = tmpBody.Columns.find((c) => c.Column === this.EntityGUIDName);
								if (tmpGuidColumn && Number(tmpGuidColumn.Size) > 0)
								{
									let tmpServerSize = Number(tmpGuidColumn.Size);
									if (tmpServerSize !== this.GUIDMaxLength)
									{
										this.log.info(`Server schema GUID column size for [${this.Entity}] is ${tmpServerSize} (local had ${this.GUIDMaxLength}); using server value.`);
									}
									else
									{
										this.log.trace(`Server schema confirms GUID column size for [${this.Entity}]: ${tmpServerSize}`);
									}
									this.GUIDMaxLength = tmpServerSize;
								}
							}

							return fStageComplete(pError);
						}
						else
						{
							return fStageComplete(pError);
						}
					});
			});
		tmpAnticipate.anticipate(
			(fStageComplete) =>
			{
				this.fable.log.info(`Marshaling ${this.Entity} records....`);
				this.marshalSourceRecords(fStageComplete, tmpMarshalExtraData);
			});
		tmpAnticipate.anticipate(
			(fStageComplete) =>
			{
				this.fable.log.info(`Posting ${this.Entity} records....`);
				this.pushRecordsToServer(fStageComplete);
			});
		tmpAnticipate.wait(fCallback);
	}

	/**
	 * Add a record to the adapter's Source Records buffer to be pushed.
	 *
	 * @param {Object} pRecord - The record to add
	 */
	addSourceRecord(pRecord)
	{
		if (!pRecord || typeof(pRecord) !== 'object' || Array.isArray(pRecord))
		{
			this.log.error(`Passed-in record was null, or not of type "object" (${typeof(pRecord)}), therefore it was not added to the Source Record buffer.`);
			return false;
		}

		let tmpRecordGUID = pRecord[this.EntityGUIDName];
		if (!tmpRecordGUID && (!pRecord.hasOwnProperty(this.EntityIDName) || !(pRecord[this.EntityIDName])))
		{
			tmpRecordGUID = pRecord[`_${this.EntityGUIDName}`];
			if (!tmpRecordGUID)
			{
				this.log.error(`Passed-in record did not contain a source system GUID data element [${this.Entity}].[${this.EntityGUIDName}], therefore it was not added to the Source Record Buffer:`, pRecord);
				return false;
			}
		}

		if (tmpRecordGUID)
		{
			this._SourceRecords[tmpRecordGUID] = pRecord;
		}
		else
		{
			this._SourceRecords[pRecord[this.EntityIDName]] = pRecord;
		}
	}

	/**
	 * Marshal a source record to a Meadow record (async).
	 *
	 * Handles:
	 * - GUID prefix generation and validation/truncation
	 * - External GUID mapping (GUID* fields → ID lookup from session map)
	 * - Server GUID mapping (_GUID* fields → async server lookup)
	 * - _Dest_IDEntity_*_Via_* pattern for explicit FK destination fields
	 * - Schema-based field type/length enforcement
	 * - SimpleMarshal and ForceMarshal options
	 *
	 * @param {Object} pSourceRecord - The source record to marshal
	 * @returns {Promise<Object>} The marshaled record
	 */
	async marshalRecord(pSourceRecord)
	{
		let tmpRecord = {};
		let tmpClient = this._resolveClient();

		// Create the new GUID
		let tmpRecordMeadowGUID;
		let tmpRecordExternalGUID = pSourceRecord[this.EntityGUIDName];
		if (tmpRecordExternalGUID)
		{
			tmpRecordMeadowGUID = this.generateMeadowGUIDFromExternalGUID(tmpRecordExternalGUID);
		}
		else
		{
			tmpRecordExternalGUID = pSourceRecord[`_${this.EntityGUIDName}`];
			tmpRecordMeadowGUID = tmpRecordExternalGUID;
		}

		if (!tmpRecordMeadowGUID && !pSourceRecord.hasOwnProperty(this.EntityIDName))
		{
			throw new Error(`Could not marshal record for [${this.Entity}] because no external system GUID was found in source record.`);
		}

		if (tmpRecordMeadowGUID)
		{
			// Mapping table for going between Meadow system GUIDs and External system GUIDs.
			tmpRecord[this.EntityGUIDName] = tmpRecordMeadowGUID;
			this.fable.MeadowGUIDMap.mapExternalGUIDtoMeadowGUID(this.Entity, tmpRecordExternalGUID, tmpRecordMeadowGUID);
		}

		// Now that we've dealt with basic identifiers, time to see if there are other Mapped GUIDs to look up.
		for (const tmpRecordKey of Object.keys(pSourceRecord))
		{
			if (tmpRecordKey == this.EntityGUIDName || tmpRecordKey == `_${this.EntityGUIDName}`)
			{
				// Don't do anything for the GUID that's already set...
			}
			else if (tmpRecordKey.startsWith('_Dest_IDEntity_') && tmpRecordKey.includes('_Via_'))
			{
				// This is a destination-explicit FK with a GUID to resolve via server lookup.
				let tmpMappedEntityGUIDName = tmpRecordKey.split('_Via_')[1];
				let tmpMappedEntityName = tmpMappedEntityGUIDName.substring(4);
				let tmpMappedEntityGUIDValue = pSourceRecord[tmpRecordKey];
				let tmpMeadowIDValue = await new Promise((resolve) =>
				{
					this.fable.MeadowGUIDMap.getIDFromGUIDAsync(tmpMappedEntityName, tmpMappedEntityGUIDValue,
					(pError, pResponse) =>
					{
						if (pResponse)
						{
							resolve(pResponse);
						}
						else
						{
							if (pError)
							{
								this.fable.log.warn(`Error getting Meadow id for ${tmpMappedEntityName} GUID [${tmpMappedEntityGUIDValue}]: ${pError.message || pError}`, { Stack: pError.stack });
							}
							resolve(0);
						}
					}, tmpClient);
				});
				if (tmpMeadowIDValue)
				{
					const tmpIDDestinationField = tmpRecordKey.split('_Via_')[0].split('_Dest_IDEntity_')[1];
					tmpRecord[tmpIDDestinationField] = tmpMeadowIDValue;
				}
				else
				{
					this.fable.log.warn(`Could not find Meadow ID for [${tmpMappedEntityName}] with GUID [${tmpMappedEntityGUIDValue}] while integrating [${this.Entity}] record [${tmpRecord[this.EntityGUIDName]}].`)
				}
			}
			else if (tmpRecordKey.startsWith('_Dest_'))
			{
				// skip this, it's a destination field override for a GUID
			}
			else if (tmpRecordKey.startsWith('GUID'))
			{
				// This is an external system GUID
				// Because external system GUIDs require adapters to look up, it should be mapped if the tree traversal worked.
				let tmpMappedEntityExternalGUIDName = tmpRecordKey;
				let tmpMappedEntityName = tmpMappedEntityExternalGUIDName.substring(4);
				let tmpMappedEntityExternalGUIDValue = pSourceRecord[tmpMappedEntityExternalGUIDName];

				let tmpMeadowIDValue = this.fable.MeadowGUIDMap.getMeadowIDFromExternalGUID(tmpMappedEntityName, tmpMappedEntityExternalGUIDValue);
				if (tmpMeadowIDValue)
				{
					const tmpIDDestinationField = pSourceRecord[`_Dest_${tmpRecordKey}`] || `ID${tmpMappedEntityName}`;
					tmpRecord[tmpIDDestinationField] = tmpMeadowIDValue;
				}
				else
				{
					this.fable.log.warn(`Could not find Meadow ID for [${tmpMappedEntityName}] with External GUID [${tmpMappedEntityExternalGUIDValue}] while integrating [${this.Entity}] record [${tmpRecord[this.EntityGUIDName]}].`)
				}
			}
			else if (tmpRecordKey.startsWith('_GUID'))
			{
				// This is a Meadow GUID that needs async server lookup.
				let tmpMappedEntityGUIDName = tmpRecordKey;
				let tmpMappedEntityName = tmpMappedEntityGUIDName.substring(5);
				let tmpMappedEntityGUIDValue = pSourceRecord[tmpMappedEntityGUIDName];
				let tmpMeadowIDValue = await new Promise((resolve) =>
				{
					this.fable.MeadowGUIDMap.getIDFromGUIDAsync(tmpMappedEntityName, tmpMappedEntityGUIDValue,
					(pError, pResponse) =>
					{
						if (pResponse)
						{
							resolve(pResponse);
						}
						else
						{
							if (pError)
							{
								this.fable.log.warn(`Error getting Meadow id for ${tmpMappedEntityName} GUID [${tmpMappedEntityGUIDValue}]: ${pError.message || pError}`, { Stack: pError.stack });
							}
							resolve(0);
						}
					}, tmpClient);
				});
				if (tmpMeadowIDValue)
				{
					const tmpIDDestinationField = pSourceRecord[`_Dest_${tmpRecordKey}`] || `ID${tmpMappedEntityName}`;
					tmpRecord[tmpIDDestinationField] = tmpMeadowIDValue;
					tmpRecord[`ID${tmpMappedEntityName}`] = tmpMeadowIDValue;
				}
				else
				{
					this.fable.log.warn(`Could not find Meadow ID for [${tmpMappedEntityName}] with GUID [${tmpMappedEntityGUIDValue}] while integrating [${this.Entity}] record [${tmpRecord[this.EntityGUIDName]}].`)
				}
			}
			else if ((this.meadowSchema && this.meadowSchema.hasOwnProperty('properties')) && (this.meadowSchema.properties.hasOwnProperty(tmpRecordKey)))
			{
				// Check the length if it's a string -- truncate if it isn't there for now.
				if (this.options.SimpleMarshal)
				{
					tmpRecord[tmpRecordKey] = pSourceRecord[tmpRecordKey];
				}
				else if ((this.meadowSchema.properties[tmpRecordKey].type == 'string')
					&& pSourceRecord.hasOwnProperty(tmpRecordKey)
					&& (pSourceRecord[tmpRecordKey] != null)
					&& (pSourceRecord[tmpRecordKey].toString().length > this.meadowSchema.properties[tmpRecordKey].size))
				{
					tmpRecord[tmpRecordKey] = pSourceRecord[tmpRecordKey].substring(0, this.meadowSchema.properties[tmpRecordKey].size);
				}
				else if (this.meadowSchema.properties[tmpRecordKey].type == 'string')
				{
					if ((pSourceRecord[tmpRecordKey] !== null) && (pSourceRecord[tmpRecordKey] !== undefined))
					{
						tmpRecord[tmpRecordKey] = pSourceRecord[tmpRecordKey].toString();
					}
				}
				else
				{
					tmpRecord[tmpRecordKey] = pSourceRecord[tmpRecordKey];
				}
			}
			else if (this.options.ForceMarshal)
			{
				tmpRecord[tmpRecordKey] = pSourceRecord[tmpRecordKey];
			}
		}

		// Clean any elements in the record that are reserved by Meadow
		if (tmpRecord.hasOwnProperty('CreateDate')) delete tmpRecord.CreateDate;
		if (tmpRecord.hasOwnProperty('UpdateDate')) delete tmpRecord.UpdateDate;
		if (tmpRecord.hasOwnProperty('Deleted')) delete tmpRecord.Deleted;
		if (tmpRecord.hasOwnProperty('DeleteDate')) delete tmpRecord.DeleteDate;

		return tmpRecord;
	}

	/**
	 * Marshal a single source record (async).
	 *
	 * @param {string} pSourceRecordGUID - The GUID of the source record
	 * @param {(source: any, marshalled: any) => void} [fMarshalExtraData] - Optional extra marshal function
	 * @returns {Promise<boolean>}
	 */
	async marshalSingleSourceRecord(pSourceRecordGUID, fMarshalExtraData)
	{
		// 0. Get the original GUID
		let tmpSourceRecordGUID = pSourceRecordGUID;

		// 0.3 Get the Source Record
		let tmpSourceRecord = this._SourceRecords[tmpSourceRecordGUID];

		if (!tmpSourceRecord)
		{
			this.log.fatal(`Could not marshal source record for [${this.Entity}] because source record with GUID [${tmpSourceRecordGUID}] was not found in Source Records buffer.`);
			return;
		}

		// 0.5 Check if this is a delete
		let tmpDeleteOperation = (tmpSourceRecord.Deleted === true);

		// 1. Marshal the Source record into a Meadow record
		let tmpMarshaledRecord = await this.marshalRecord(tmpSourceRecord);

		// 2. Get the GUID of the record after Marshaling...
		let tmpMarshaledRecordGUID = tmpMarshaledRecord[this.EntityIDName];
		if (tmpMarshaledRecord.hasOwnProperty(this.EntityGUIDName))
		{
			tmpMarshaledRecordGUID = tmpMarshaledRecord[this.EntityGUIDName];
		}
		else if (tmpMarshaledRecord.hasOwnProperty(`_${this.EntityGUIDName}`))
		{
			tmpMarshaledRecordGUID = tmpMarshaledRecord[`_${this.EntityGUIDName}`];
		}

		// 3. Get a new Object or the existing object as start of the append operation
		let tmpOriginalRecord = (this._MarshaledRecords.hasOwnProperty(tmpMarshaledRecordGUID)) ? this._MarshaledRecords[tmpMarshaledRecordGUID] : {};

		// 4. Now merge the properties of the two records, using the new one as the more important values
		if (tmpDeleteOperation)
		{
			this._DeletedRecords[tmpMarshaledRecordGUID] = tmpMarshaledRecord;
		}
		else
		{
			this._MarshaledRecords[tmpMarshaledRecordGUID] = Object.assign(tmpOriginalRecord, tmpMarshaledRecord);
		}

		// 4.5 Inject a marshal stack
		if (typeof(fMarshalExtraData) == 'function')
		{
			fMarshalExtraData(tmpSourceRecord, tmpMarshaledRecord);
		}

		// 5. Now delete the record from the SourceRecords set so next marshal operation doesn't do it again needlessly
		delete this._SourceRecords[tmpSourceRecordGUID];

		return true;
	}

	/**
	 * Take all Source Records in the buffer and marshal them (async).
	 *
	 * @param {(error?: Error) => void} fCallback - Callback when done
	 * @param {(source: any, marshalled: any) => void} [fMarshalExtraData] - Optional extra marshal function
	 */
	async marshalSourceRecords(fCallback, fMarshalExtraData)
	{
		try
		{
			let tmpRecordKeys = Object.keys(this._SourceRecords);

			for (let i = 0; i < tmpRecordKeys.length; i++)
			{
				await this.marshalSingleSourceRecord(tmpRecordKeys[i], fMarshalExtraData);
			}

			return fCallback();
		}
		catch (error)
		{
			return fCallback(error);
		}
	}

	/**
	 * Take a single record and push it to the server.
	 *
	 * @param {(error?: Error) => void} fCallback - Callback when done
	 * @param {string} pRecordGUID - The GUID of the record to push
	 * @param {number} [pRetryCount] - The number of times this record has been retried
	 */
	upsertSingleRecord(fCallback, pRecordGUID, pRetryCount)
	{
		let tmpRetryCount = (typeof(pRetryCount) === 'undefined') ? 0 : pRetryCount;
		let tmpClient = this._resolveClient();

		if (!tmpClient)
		{
			return fCallback(new Error(`No REST client available for [${this.Entity}].`));
		}

		// Non-configurable cap for a bit here... until better logic is written.
		if ((tmpRetryCount > this._RecordPushRetryThreshold) || (tmpRetryCount > 50))
		{
			this.log.error(`Upsert error sending [${this.Entity}].[${pRecordGUID}] to server... retry threshold of ${this._RecordPushRetryThreshold} reached.`);

			// upsert failed — try to read the record so we can at least have a valid ID / GUID mapping
			if (typeof(tmpClient.getEntityByGUID) === 'function')
			{
				let tmpIdentifierType = 'GUID';
				const tmpFallbackCallback = (pError, pBody) =>
				{
					if (pError)
					{
						this.log.error(`Error reading record ${tmpIdentifierType} [${pRecordGUID}] after upsert failures: ${pError.message || pError}`, { Stack: pError.stack });
					}
					else if (pBody &&
							(pBody.hasOwnProperty(this.EntityIDName)) &&
							(pBody[this.EntityIDName] > 0) &&
							(pBody.hasOwnProperty(this.EntityGUIDName)) &&
							((pBody[this.EntityGUIDName] === pRecordGUID) || (pBody[this.EntityIDName] == pRecordGUID))
						)
					{
						this.log.info(`Fallback: Loaded and mapping record ${tmpIdentifierType} [${pRecordGUID}] after upsert failure.`);
						this.fable.MeadowGUIDMap.mapGUIDToID(this.Entity, pBody[this.EntityGUIDName], pBody[this.EntityIDName]);
					}
					else
					{
						this.log.error(`Could not verify record ${tmpIdentifierType} [${pRecordGUID}] after upsert failures; record not found or invalid response.`, { Record: pBody });
					}
					return fCallback();
				};
				if (this._MarshaledRecords[pRecordGUID] && this._MarshaledRecords[pRecordGUID][this.EntityIDName] == pRecordGUID)
				{
					tmpIdentifierType = 'ID';
					return tmpClient.getEntity(this.Entity, pRecordGUID, tmpFallbackCallback);
				}
				return tmpClient.getEntityByGUID(this.Entity, pRecordGUID, tmpFallbackCallback);
			}

			return fCallback();
		}

		tmpClient.upsertEntity(this.Entity, this._MarshaledRecords[pRecordGUID],
			(pError, pBody) =>
			{
				if (pError)
				{
					this.log.error(`Error sending PUT [${this.Entity}].[${pRecordGUID}] to server:  ${pError}`);
					let tmpErrorMessage = (typeof(pError.message) === 'string') ? pError.message : String(pError);
					if (tmpErrorMessage.indexOf('Error in DAL create: Error: Duplicate entry') > 0)
					{
						this.log.warn(`Duplicate record attempted when sending PUT to server record GUID [${pRecordGUID}]: ${tmpErrorMessage}`, pBody);
						return fCallback();
					}
					if (tmpErrorMessage.indexOf('exceeds the maximum allowed length') > 0)
					{
						this.log.error(`GUID length rejected by server for [${this.Entity}].[${pRecordGUID}] (${pRecordGUID.length} chars): ${tmpErrorMessage}`);
						return fCallback();
					}
					if (tmpErrorMessage.indexOf('Rejected Create') > -1 && tmpErrorMessage.indexOf('GUID') > -1)
					{
						this.log.error(`Server rejected create for [${this.Entity}].[${pRecordGUID}] due to GUID issue: ${tmpErrorMessage}`);
						return fCallback();
					}

					// simple delay for retries to not spam the server
					setTimeout(() =>
					{
						this.upsertSingleRecord(fCallback, pRecordGUID, tmpRetryCount + 1);
					}, 500);
					return;
				}

				if (
						pBody &&
						// Check that the server returned a valid record (look for the Identity column)
						(pBody.hasOwnProperty(this.EntityIDName)) &&
						// Check that the server returned a record that has a numeric ID which is nonzero
						(pBody[this.EntityIDName] > 0) &&
						// Check that the server also returned a GUID
						(pBody.hasOwnProperty(this.EntityGUIDName)) &&
						// Check that the GUID or ID matches what we expect
						((pBody[this.EntityGUIDName] === pRecordGUID) || (pBody[this.EntityIDName] == pRecordGUID))
					)
				{
					// Add the record ID to the lookup table
					this.fable.MeadowGUIDMap.mapGUIDToID(this.Entity, pBody[this.EntityGUIDName], pBody[this.EntityIDName]);
					return fCallback();
				}

				// Try again...
				this.log.error(`Problem sending PUT [${this.Entity}].[${pRecordGUID}] to server.  Incrementing retry count and trying again.`, { Record: pBody, RetryCount: tmpRetryCount });
				this.upsertSingleRecord(fCallback, pRecordGUID, tmpRetryCount + 1);
			});
	}

	/**
	 * Take a set of records and push them to the server in bulk.
	 *
	 * @param {(error?: Error) => void} fCallback - Callback when done
	 * @param {string[]} pRecordGUIDs - The GUIDs of the records to push
	 * @param {number} [pRetryCount] - The number of times this batch has been retried
	 */
	upsertBulkRecords(fCallback, pRecordGUIDs, pRetryCount)
	{
		let tmpRetryCount = (typeof(pRetryCount) === 'undefined') ? 0 : pRetryCount;
		let tmpClient = this._resolveClient();

		if (!tmpClient)
		{
			return fCallback(new Error(`No REST client available for [${this.Entity}].`));
		}

		// Non-configurable cap for a bit here... until better logic is written.
		if ((tmpRetryCount > this._RecordPushRetryThreshold) || (tmpRetryCount > 50))
		{
			this.log.error(`Upsert error sending [${this.Entity}] to server... retry threshold of ${this._RecordPushRetryThreshold} reached.`);
			return fCallback();
		}

		let tmpRecordsToUpsert = [];

		for (let i = 0; i < pRecordGUIDs.length; i++)
		{
			tmpRecordsToUpsert.push(this._MarshaledRecords[pRecordGUIDs[i]]);
		}

		tmpClient.upsertEntities(this.Entity, tmpRecordsToUpsert,
			(pError, pBody) =>
			{
				if (pError)
				{
					this.log.error(`Error sending PUT [${this.Entity}] to server:  ${pError}`);
					return this.upsertBulkRecords(fCallback, pRecordGUIDs, tmpRetryCount + 1);
				}

				if (Array.isArray(pBody))
				{
					// Add the record IDs to the lookup table
					for (let i = 0; i < pBody.length; i++)
					{
						this.fable.MeadowGUIDMap.mapGUIDToID(this.Entity, pBody[i][this.EntityGUIDName], pBody[i][this.EntityIDName]);
					}
					return fCallback();
				}

				// Try again...
				this.log.error(`Problem sending PUT [${this.Entity}] to server.  Incrementing retry count and trying again.`, { Records: pBody, RetryCount: tmpRetryCount });
				this.upsertBulkRecords(fCallback, pRecordGUIDs, tmpRetryCount + 1);
			});
	}

	/**
	 * Increment the meta progress tracker (if configured) and conditionally log its status.
	 *
	 * Uses a threshold-crossing check rather than exact modulo so that bulk increments
	 * (e.g. +100) reliably trigger a log when they cross an interval boundary.
	 *
	 * @param {number} pAmount - The number of operations to increment by
	 */
	_incrementMetaProgressTracker(pAmount)
	{
		if (!this.MetaProgressTrackerHash)
		{
			return;
		}
		let tmpTracker = this.fable.ProgressTrackerSet;
		let tmpStatus = tmpTracker.incrementProgressTracker(this.MetaProgressTrackerHash, pAmount);

		if (this.MetaProgressTrackerLogInterval > 0 && tmpStatus)
		{
			let tmpPreviousCount = tmpStatus.CurrentCount - pAmount;
			let tmpPreviousInterval = Math.floor(tmpPreviousCount / this.MetaProgressTrackerLogInterval);
			let tmpCurrentInterval = Math.floor(tmpStatus.CurrentCount / this.MetaProgressTrackerLogInterval);

			if (tmpCurrentInterval > tmpPreviousInterval
				|| tmpStatus.CurrentCount >= tmpStatus.TotalCount)
			{
				tmpTracker.logProgressTrackerStatus(this.MetaProgressTrackerHash);
			}
		}
	}

	/**
	 * Push any records in the adapter buffer to the server.
	 *
	 * @param {(error?: Error) => void} fCallback - Callback when done
	 */
	pushRecordsToServer(fCallback)
	{
		if (!this._PerformUpserts)
		{
			return fCallback();
		}
		// Run the upserts...
		let tmpRecordKeys = Object.keys(this._MarshaledRecords);
		let tmpAnticipate = this.fable.instantiateServiceProviderWithoutRegistration('Anticipate');
		let tmpProgressTrackerGUID = this.fable.getUUID();
		let tmpProgressTracker = this.fable.ProgressTrackerSet;
		tmpProgressTracker.createProgressTracker(tmpProgressTrackerGUID, tmpRecordKeys.length);
		tmpProgressTracker.startProgressTracker(tmpProgressTrackerGUID);

		// Log meta tracker at the start of each entity
		if (this.MetaProgressTrackerHash)
		{
			this.log.info(`[${this.Entity}] Starting push of ${tmpRecordKeys.length} records...`);
			tmpProgressTracker.logProgressTrackerStatus(this.MetaProgressTrackerHash);
		}

		// Determine if bulk upserts are possible
		if (tmpRecordKeys.length > this.options.RecordThresholdForBulkUpsert)
		{
			let tmpBulkUpsertBatchCount = Math.ceil(tmpRecordKeys.length / this.options.BulkUpsertBatchSize);
			for (let i = 0; i < tmpBulkUpsertBatchCount; i++)
			{
				let tmpBatchRecordKeys = [];
				for (let j = 0; j < this.options.BulkUpsertBatchSize; j++)
				{
					let tmpRecordKey = tmpRecordKeys[(i * this.options.BulkUpsertBatchSize) + j];
					if (tmpRecordKey)
					{
						tmpBatchRecordKeys.push(tmpRecordKey);
					}
				}

				tmpAnticipate.anticipate(
					function(fDone)
					{
						this.log.trace(`[${this.Entity}] Bulk Upserting ${tmpBatchRecordKeys.length} records to server for transaction set [${tmpProgressTrackerGUID}]...`);
						this.upsertBulkRecords(
							(pError, pBody) =>
							{
								if (pError)
								{
									this.log.error(`Error sending Bulk Upserts for [${this.Entity}] to server:  ${pError}`);
								}
								tmpProgressTracker.incrementProgressTracker(tmpProgressTrackerGUID, tmpBatchRecordKeys.length);
								tmpProgressTracker.logProgressTrackerStatus(tmpProgressTrackerGUID);
								this._incrementMetaProgressTracker(tmpBatchRecordKeys.length);
								return fDone();
							}, tmpBatchRecordKeys);
					}.bind(this));
			}
		}
		else
		{
			for (let i = 0; i < tmpRecordKeys.length; i++)
			{
				let tmpRecordKey = tmpRecordKeys[i];
				tmpAnticipate.anticipate(
					function(fDone)
					{
						this.log.trace(`[${this.Entity}] Record [${tmpRecordKey}] pushing to server...`);
						tmpProgressTracker.incrementProgressTracker(tmpProgressTrackerGUID, 1);
						tmpProgressTracker.logProgressTrackerStatus(tmpProgressTrackerGUID);
						this.upsertSingleRecord(
							() =>
							{
								this._incrementMetaProgressTracker(1);
								return fDone();
							}, tmpRecordKey);
					}.bind(this));
			}
		}

		tmpAnticipate.wait(fCallback);
	}

	/**
	 * Delete records from the server.
	 *
	 * @param {(error?: Error) => void} fCallback - Callback when done
	 */
	deleteRecordsFromServer(fCallback)
	{
		if (!this._PerformDeletes)
		{
			return fCallback();
		}

		let tmpClient = this._resolveClient();
		if (!tmpClient)
		{
			return fCallback(new Error(`No REST client available for [${this.Entity}].`));
		}

		let tmpRecordKeys = Object.keys(this._DeletedRecords);
		this.fable.Utility.eachLimit(tmpRecordKeys, 1,
			(pRecordGUID, fDeleteComplete) =>
			{
				this.log.trace(`[${this.Entity}] Record [${pRecordGUID}] deleting from server...`);
				// Now lookup the Meadow ID for it...
				tmpClient.getEntityByGUID(this.Entity, pRecordGUID,
					(pReadError, pReadBody) =>
					{
						if (pReadError)
						{
							this.log.warn(`Could not read [${this.Entity}] GUID [${pRecordGUID}] for DELETE operation:  ${pReadError}`);
							return fDeleteComplete();
						}

						if (pReadBody && pReadBody.hasOwnProperty(this.EntityIDName))
						{
							tmpClient.deleteEntity(this.Entity, pReadBody[this.EntityIDName], fDeleteComplete);
							return;
						}

						this.log.warn(`Could not delete [${this.Entity}] GUID [${pRecordGUID}] because lookup did not return an IDRecord.`);
						return fDeleteComplete();
					});
			},
			(pError) =>
			{
				if (pError)
				{
					this.log.error(`Error sending trying to Delete from [${this.Entity}]:  ${pError}`);
				}
				return fCallback(pError);
			});
	}
}

module.exports = MeadowIntegrationAdapter;

// Macro for backwards compatibility
module.exports.getAdapter = (
	/**
	 * @param {object} pFable - A fable instance
	 * @param {string} pEntity - The entity name
	 * @param {string} [pEntityPrefix] - The entity GUID marshal prefix
	 * @param {object} [pCustomOptions] - Additional options to merge in (e.g. SimpleMarshal, ForceMarshal)
	 */
	function(pFable, pEntity, pEntityPrefix, pCustomOptions)
	{
		if (pFable.servicesMap.IntegrationAdapter && pFable.servicesMap.IntegrationAdapter.hasOwnProperty(pEntity))
		{
			return pFable.servicesMap.IntegrationAdapter[pEntity];
		}
		else
		{
			const tmpOptions = Object.assign({}, pCustomOptions, { Entity: pEntity, EntityGUIDMarshalPrefix: pEntityPrefix });
			return pFable.instantiateServiceProvider('IntegrationAdapter', tmpOptions, pEntity);
		}
	});

module.exports.default_configuration = defaultMeadowIntegrationAdapterOptions;
