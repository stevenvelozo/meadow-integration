const libFableServiceProviderBase = require('fable-serviceproviderbase');
const libGUIDMap = require('./Meadow-Service-Integration-GUIDMap.js');

const defaultMeadowIntegrationAdapterOptions = (
	{
		"Entity": "DefaultEntity",

		"AdapterSetGUIDMarshalPrefix": false,

		"EntityGUIDMarshalPrefix": false,

		"PerformUpserts": true,
		"PerformDeletes": true,

		"RecordPushRetryThreshold": 5,

		"RecordThresholdForBulkUpsert": 1000,
		"BulkUpsertBatchSize": 100,

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
		if (!this.fable.hasOwnProperty('MeadowGUIDMap'))
		{
			this.fable.addAndInstantiateServiceType('MeadowGUIDMap', libGUIDMap);
		}

		// Check if there is a REST client ... if not make one
		if (!this.fable.hasOwnProperty('RestClient'))
		{
			this.fable.addServiceType('RestClient', );
			if (!this.options.hasOwnProperty('ApiURLPrefix'))
			{
				this.options.ApiURLPrefix = '/1.0/';
			}
			this.fable.instantiateServiceProvider('RestClient', { ServerURL: this.options.ApiURLPrefix });
		}

		this.Entity = this.options.Entity;
		this.EntityGUIDName = `GUID${this.Entity}`;
		this.EntityIDName = `ID${this.Entity}`;

		// Automagic GUID Components
		this.AdapterSetGUIDMarshalPrefix = this.options.AdapterSetGUIDMarshalPrefix;
		if (!this.AdapterSetGUIDMarshalPrefix && (typeof(this.fable.settings.AdapterSetGUIDMarshalPrefix) == 'string'))
		{
			this.AdapterSetGUIDMarshalPrefix = this.fable.settings.AdapterSetGUIDMarshalPrefix;
		}
		else
		{
			this.AdapterSetGUIDMarshalPrefix = 'INTG-DEF';
		}
		this.EntityGUIDMarshalPrefix = this.options.EntityGUIDMarshalPrefix
		if (!this.EntityGUIDMarshalPrefix)
		{
			this.EntityGUIDMarshalPrefix = `E-${this.Entity}`;
		}

		// Integration Adapter Controls
		this._PerformUpserts = this.options.PerformUpserts;
		this._PerformDeletes = this.options.PerformDeletes;

		this._RecordPushRetryThreshold = this.options.RecordPushRetryThreshold;

		// The source records (coming from the external system)
		this._SourceRecords = {};

		// The marshaled records (meant to be upserted to the storage or Queued for Delete)
		this._MarshaledRecords = {};
		this._DeletedRecords = {};
	}

	// TODO: A More Elegane Streaming Solution (tm)
	integrateRecords(fCallback, fMarshalExtraData)
	{
		let tmpMarshalExtraData = fMarshalExtraData;
		let tmpAnticipate = this.fable.instantiateServiceProviderWithoutRegistration('Anticipate');
		tmpAnticipate.anticipate(
			(fStageComplete)=>
			{
				this.fable.log.info(`Getting schema for ${this.Entity}....`);
				let tmpRequestOptions = (
					{
						url: `${this.fable.MeadowRestClient.serverURL}${this.Entity}/Schema`
					});
				tmpRequestOptions = this.fable.MeadowRestClient._prepareRequestOptions(tmpRequestOptions);
				return this.fable.MeadowRestClient.restClient.getJSON(tmpRequestOptions,
					(pError, pResponse, pBody) =>
					{
						if (pBody && (typeof(pBody) == 'object'))
						{
							this.meadowSchema = pBody;
							return fStageComplete(pError);
						}
						else
						{
							return fStageComplete(pError);
						}
					});
			});
		tmpAnticipate.anticipate(
			(fStageComplete)=>
			{
				this.fable.log.info(`Marshaling ${this.Entity} records....`);
				this.marshalSourceRecords(fStageComplete, tmpMarshalExtraData);
			});
		tmpAnticipate.anticipate(
			(fStageComplete)=>
			{
				this.fable.log.info(`Posting ${this.Entity} records....`);
				this.pushRecordsToServer(fStageComplete);
			});
		tmpAnticipate.wait(fCallback);
	}

	// Add a record to the adapter's Source Records buffer to be pushed
	addSourceRecord(pRecord)
	{
		if (typeof(pRecord) !== 'object')
		{
			this.log.error(`Passed-in record was not of type "object" (${typeof(pRecord)}), therefore it was not added to the Source Record buffer.`);
			return false;
		}
		if (!pRecord.hasOwnProperty(this.EntityGUIDName) || !(pRecord[this.EntityGUIDName]))
		{
			this.log.error(`Passed-in record did not contain a source system GUID data element [${this.Entity}].[${this.EntityGUIDName}], therefore it was not added to the Source Record Buffer:`, pRecord);
			return false;
		}

		this._SourceRecords[pRecord[this.EntityGUIDName]] = pRecord;
	}

	generateMeadowGUIDFromExternalGUID(pExternalGUID)
	{
		return `${this.AdapterSetGUIDMarshalPrefix}-${this.EntityGUIDMarshalPrefix}-${pExternalGUID}`;
	}

	marshalRecord(pSourceRecord)
	{
		let tmpRecord = {};

		// Create the new GUID
		let tmpRecordExternalGUID = pSourceRecord[this.EntityGUIDName];
		let tmpRecordInternalMeadowGUID = this.generateMeadowGUIDFromExternalGUID(tmpRecordExternalGUID);

		// Mapping table for going between internal Meadow system GUIDs and External system GUIDs.
		this.fable.MeadowGUIDMap.mapExternalGUIDtoMeadowGUID(this.Entity, tmpRecordExternalGUID, tmpRecordInternalMeadowGUID);

		tmpRecord[this.EntityGUIDName] = tmpRecordInternalMeadowGUID;

		// Now that we've dealt with basic identifiers, time to see if there are other Mapped GUIDs to look up.
		// TODO: This can be the path through to a recursive integration -- if 
		//       the GUIDs are not found, then the appropriate adapter can launch 
		//       (and integrate just the proper records!)
		let tmpRecordKeys = Object.keys(pSourceRecord);
		for (let i = 0; i < tmpRecordKeys.length; i++)
		{
			if (tmpRecordKeys[i] == this.EntityGUIDName)
			{
				// Don't do anything for the GUID whose already set...
			}
			else if (tmpRecordKeys[i].startsWith('GUID'))
			{
				// This is an external system GUID
				// Because external system GUIDs require adapters to look up, it should be mapped if the tree traversal worked.
				let tmpMappedEntityExternalGUIDName = tmpRecordKeys[i];
				let tmpMappedEntityName = tmpMappedEntityExternalGUIDName.substring(4);
				let tmpMappedEntityExternalGUIDValue = pSourceRecord[tmpMappedEntityExternalGUIDName];

				let tmpMeadowIDValue = this.fable.MeadowGUIDMap.getMeadowIDFromExternalGUID(tmpMappedEntityName, tmpMappedEntityExternalGUIDValue);
				if (tmpMeadowIDValue)
				{
					tmpRecord[`ID${tmpMappedEntityName}`] = tmpMeadowIDValue;
				}
				else
				{
					this.fable.log.warn(`Could not find Meadow ID for [${tmpMappedEntityName}] with External GUID [${tmpMappedEntityExternalGUIDValue}] while integrating [${this.Entity}] record [${tmpRecord[this.EntityGUIDName]}].`)
				}
			}
			else if (tmpRecordKeys[i].startsWith('_GUID'))
			{
				// This is a Meadow GUID.  
				// TODO: Eventualy this whole codepath needs to be async so it can look up records.
				let tmpMappedEntityGUIDName = tmpRecordKeys[i];
				let tmpMappedEntityName = tmpMappedEntityGUIDName.substring(5);
				let tmpMappedEntityGUIDValue = pSourceRecord[tmpMappedEntityGUIDName];

				let tmpMeadowIDValue = this.fable.MeadowGUIDMap.getIDFromGuid(tmpMappedEntityName, tmpMappedEntityGUIDValue);
				if (tmpMeadowIDValue)
				{
					tmpRecord[`ID${tmpMappedEntityName}`] = tmpMeadowIDValue;
				}
				else
				{
					this.fable.log.warn(`Could not find Meadow ID for [${tmpMappedEntityName}] with GUID [${tmpMappedEntityGUIDValue}] while integrating [${this.Entity}] record [${tmpRecord[this.EntityGUIDName]}].`)
				}
			}
			else if ((this.meadowSchema && this.meadowSchema.hasOwnProperty('properties')) && (this.meadowSchema.properties.hasOwnProperty(tmpRecordKeys[i])))
			{
				// Check the length if it's a string -- truncate if it isn't there for now.
				// TODO: MAKE THIS CONFIGURABLE AND OVERRIDABLE
				if ((this.meadowSchema.properties[tmpRecordKeys[i]].type == 'string') 
					&& (pSourceRecord[tmpRecordKeys[i]].toString().length > this.meadowSchema.properties[tmpRecordKeys[i]].size))
				{
					tmpRecord[tmpRecordKeys[i]] = pSourceRecord[tmpRecordKeys[i]].substring(0, this.meadowSchema.properties[tmpRecordKeys[i]].size);
				}
				else if (this.meadowSchema.properties[tmpRecordKeys[i]].type == 'string') 
				{
					tmpRecord[tmpRecordKeys[i]] = pSourceRecord[tmpRecordKeys[i]].toString();
				}
				else
				{
					tmpRecord[tmpRecordKeys[i]] = pSourceRecord[tmpRecordKeys[i]];
				}
			}
		}

		// Clean any elements in the record that are reserved by Meadow
		if (tmpRecord.hasOwnProperty('CreateDate')) delete tmpRecord.CreateDate;
		if (tmpRecord.hasOwnProperty('UpdateDate')) delete tmpRecord.UpdateDate;
		if (tmpRecord.hasOwnProperty('Deleted')) delete tmpRecord.Deleted;
		if (tmpRecord.hasOwnProperty('DeleteDate')) delete tmpRecord.UpdateDate;

		return tmpRecord;
	}

	marshalSingleSourceRecord(pSourceRecordGUID, fMarshalExtraData)
	{
		// 0. Get the original GUID
		let tmpSourceRecordGUID = pSourceRecordGUID;

		// 0.3 Get the Source Record
		let tmpSourceRecord = this._SourceRecords[tmpSourceRecordGUID];

		// 0.5 Check if this is a delete
		let tmpDeleteOperation = (tmpSourceRecord.Deleted === true);

		// 1. Marshal the Source record into a Meadow entity record
		let tmpMarshaledRecord = this.marshalRecord(tmpSourceRecord);

		// 2. Get the GUID of the record after Marshaling...
		let tmpMarshaledRecordGUID = tmpMarshaledRecord[this.EntityGUIDName];

		// 3. Get a new Object or the existing object as start of the append operation
		let tmpOriginalRecord = (this._MarshaledRecords.hasOwnProperty(tmpMarshaledRecordGUID)) ? this._MarshaledRecords[tmpMarshaledRecordGUID] : {};

		// 4. Now merge the properties of the two records, using the new one as the more important values
		//    Yes this will guaranteed overwrite the GUID like a zillion times, but, whatevers
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

	// Take all Source Records in the buffer and marshal them
	marshalSourceRecords(fCallback, fMarshalExtraData)
	{
		let tmpRecordKeys = Object.keys(this._SourceRecords);

		// Later switch to something paralleler?
		for (let i = 0; i < tmpRecordKeys.length; i++)
		{
			this.marshalSingleSourceRecord(tmpRecordKeys[i], fMarshalExtraData);
		}

		return fCallback();
	}

	upsertSingleRecord(fCallback, pRecordGUID, pRetryCount)
	{
		// TODO: The retry count recursion method here is very brute force.  Fix it!
		let tmpRetryCount = (typeof(pRetryCount) === 'undefined') ? 0 : pRetryCount;

		// Non-configurable cap for a bit here... until better logic is written.
		if ((tmpRetryCount > this._RecordPushRetryThreshold) || (tmpRetryCount > 50))
		{
			this.log.error(`Upsert error sending [${this.Entity}].[${pRecordGUID}] to server... retry threshold of ${this._RecordPushRetryThreshold} reached.`);
			return fCallback();
		}

		this.fable.MeadowRestClient.upsertEntity(this.Entity, this._MarshaledRecords[pRecordGUID],
			(pError, pBody)=>
			{
				if (pError)
				{
					this.log.error(`Error sending PUT [${this.Entity}].[${pRecordGUID}] to server:  ${pError}`);
					this.upsertSingleRecord(fCallback, pRecordGUID, tmpRetryCount++);
				}
				else
				{
					// TODO: Deal with the odd old API service errors
					if (pBody.hasOwnProperty('Error') || pBody.hasOwnProperty('code'))
					{
						let tmpProblemMessage = (pBody.hasOwnProperty('Error')) ? pBody.Error : pBody.code;
						this.log.error(`Error sending PUT [${this.Entity}].[${pRecordGUID}] to server:  ${tmpProblemMessage}`, pBody);
						// TODO: Should this blow up or not.......
						return fCallback();
					}
					else if (tmpRetryCount > this._RecordPushRetryThreshold)
					{
						this.log.error(`Retry count exceeded max of ${this._RecordPushRetryThreshold} retries (${tmpRetryCount} retries happened) while sending PUT [${this.Entity}].[${pRecordGUID}] to server:  ${pBody.Error}`, pBody);
						return fCallback();
					}
					else if (
								// Check that the server returned a valid record (look for the Identity column)
								(pBody.hasOwnProperty(this.EntityIDName)) && 
								// Check that the server returned a record that has a numeric ID which is nonzero
								(pBody[this.EntityIDName] > 0) && 
								// Check that the server also returned a GUID
								(pBody.hasOwnProperty(this.EntityGUIDName)) && 
								// Check that the GUID matches what we expect
								pBody[this.EntityGUIDName] === pRecordGUID
							)
					{
						// Add the record ID to the lookup table
						this.fable.MeadowGUIDMap.mapGUIDToID(this.Entity, pRecordGUID, pBody[this.EntityIDName]);
						return fCallback();
					}
					else
					{
						// Try again...
						this.log.error(`Problem sending PUT [${this.Entity}].[${pRecordGUID}] to server.  Incrementing retry count and trying again.`, pBody);
						this.upsertSingleRecord(fCallback, pRecordGUID, tmpRetryCount++);
					}
				}
			});
	}

	upsertBulkRecords(fCallback, pRecordGUIDs, pRetryCount)
	{
		// TODO: The retry count recursion method here is very brute force.  Fix it!
		let tmpRetryCount = (typeof(pRetryCount) === 'undefined') ? 0 : pRetryCount;

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

		this.fable.MeadowRestClient.upsertEntities(this.Entity, tmpRecordsToUpsert,
			(pError, pBody)=>
			{
				if (pError)
				{
					this.log.error(`Error sending PUT [${this.Entity}] to server:  ${pError}`);
					this.upsertBulkRecords(fCallback, pRecordGUIDs, tmpRetryCount++);
				}
				else
				{
					// TODO: Deal with the odd old API service errors
					if (pBody.hasOwnProperty('Error') || pBody.hasOwnProperty('code'))
					{
						let tmpProblemMessage = (pBody.hasOwnProperty('Error')) ? pBody.Error : pBody.code;
						this.log.error(`Error sending PUT [${this.Entity}] to server:  ${tmpProblemMessage}`, pBody);
						// TODO: Should this blow up or not.......
						return fCallback();
					}
					else if (tmpRetryCount > this._RecordPushRetryThreshold)
					{
						this.log.error(`Retry count exceeded max of ${this._RecordPushRetryThreshold} retries (${tmpRetryCount} retries happened) while sending PUT [${this.Entity}] to server:  ${pBody.Error}`, pBody);
						return fCallback();
					}
					else if (Array.isArray(pBody))
								// TODO: This is a bit of a hack... but it's a good start
								// // Check that the server returned a valid record (look for the Identity column)
								// (pBody.hasOwnProperty(this.EntityIDName)) && 
								// // Check that the server returned a record that has a numeric ID which is nonzero
								// (pBody[this.EntityIDName] > 0) && 
								// // Check that the server also returned a GUID
								// (pBody.hasOwnProperty(this.EntityGUIDName)) && 
								// // Check that the GUID matches what we expect
								// pBody[this.EntityGUIDName] === pRecordGUID
					{
						// Add the record IDs to the lookup table
						for (let i = 0; i < pBody.length; i++)
						{
							this.fable.MeadowGUIDMap.mapGUIDToID(this.Entity, pBody[i][this.EntityGUIDName], pBody[i][this.EntityIDName]);
						}
						return fCallback();
					}
					else
					{
						// Try again...
						this.log.error(`Problem sending PUT [${this.Entity}] to server.  Incrementing retry count and trying again.`, pBody);
						this.upsertBulkRecords(fCallback, pRecordGUIDs, tmpRetryCount++);
					}
				}
			});
	}


	// Push any records in the adapter buffer to the server
	pushRecordsToServer(fCallback)
	{
		if (this._PerformUpserts)
		{
			// Run the upserts...
			let tmpRecordKeys = Object.keys(this._MarshaledRecords);
			let tmpAnticipate = this.fable.instantiateServiceProviderWithoutRegistration('Anticipate');

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
							this.log.trace(`[${this.Entity}] Bulk Upserting ${tmpBatchRecordKeys.length} records to server...`);
							this.upsertBulkRecords(fDone, tmpBatchRecordKeys,
								(pError, pBody)=>
								{
									if (pError)
									{
										this.log.error(`Error sending Bulk Upserts for [${this.Entity}] to server:  ${pError}`);
									}
									return fDone();
								});
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
							this.upsertSingleRecord(fDone, tmpRecordKey);
						}.bind(this));
				}
			}

			tmpAnticipate.wait(fCallback);
		}
	}

	deleteRecordsFromServer(fCallback)
	{
		if (this._PerformDeletes)
		{
			// Run the deletes...
			// TODO: THIS IS DANGEROUS
			let tmpRecordKeys = Object.keys(this._DeletedRecords);
			libAsync.eachSeries(tmpRecordKeys,
				(pRecordGUID, fDeleteComplete) =>
				{
					this.log.trace(`[${this.Entity}] Record [${this._MarshaledRecords[this.EntityGUIDName]}] deleting from server...`);
					// Now lookup the entity ID for this GUID...
					// TODO: Should this be overridable by entity?
					this.fable.MeadowRestClient.getEntityByGUID(this.Entity, pRecordGUID,
						(pReadError, pReadBody)=>
						{
							if (pReadError)
							{
								this.log.warning(`Could not read [${this.Entity}] GUID [${pRecordGUID}] for DELETE operation:  ${pReadError}`);
								return fDeleteComplete();
							}

							if (pReadBody && pReadBody.hasOwnProperty(this.EntityIDName))
							{
								this._API.deleteEntity(this.Entity, pReadBody[this.EntityIDName], fDeleteComplete);
							}
							else
							{
								this.log.warning(`Could not delete [${this.Entity}] GUID [${pRecordGUID}] because Meadow Entity lookup did not return an IDRecord.`);
								return fDeleteComplete();
							}
						});
				},
				(pError)=>
				{
					if (pError)
					{
						this.log.error(`Error sending trying to Delete from [${this.Entity}]:  ${pError}`);
					}
					return fCallback(pError);
				});
		}
	}
}

module.exports = MeadowIntegrationAdapter;

// Macro for backwards compatibility
module.exports.getAdapter = (
	function(pFable, pEntity, pEntityPrefix)
	{
		if (pFable.servicesMap.IntegrationAdapter && pFable.servicesMap.IntegrationAdapter.hasOwnProperty(pEntity))
		{
			return pFable.servicesMap.IntegrationAdapter[pEntity];
		}
		else
		{
			return pFable.instantiateServiceProvider('IntegrationAdapter', { Entity: pEntity, EntityGUIDMarshalPrefix: pEntityPrefix }, pEntity);
		}
	});

module.exports.default_configuration = defaultMeadowIntegrationAdapterOptions;