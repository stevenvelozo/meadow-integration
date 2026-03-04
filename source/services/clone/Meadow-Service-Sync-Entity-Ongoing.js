const libFableServiceProviderBase = require('fable-serviceproviderbase');
const libMeadowOperation = require('./Meadow-Service-Operation.js');

class MeadowSyncEntityOngoing extends libFableServiceProviderBase
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this.serviceType = 'MeadowSyncEntityOngoing';

		if (!this.options.hasOwnProperty('MeadowEntitySchema'))
		{
			throw new Error('MeadowSyncEntityOngoing requires a valid MeadowEntitySchema option.');
		}
		if (typeof(this.options.MeadowEntitySchema) != 'object')
		{
			throw new Error(`MeadowSyncEntityOngoing requires MeadowEntitySchema to be an object; got ${typeof(this.options.MeadowEntitySchema)}.`);
		}
		if (!this.options.MeadowEntitySchema.hasOwnProperty('TableName') ||
			typeof(this.options.MeadowEntitySchema.TableName) != 'string' ||
			this.options.MeadowEntitySchema.TableName.length < 1)
		{
			throw new Error('MeadowSyncEntityOngoing requires a valid MeadowEntitySchema.TableName.');
		}
		if (!this.options.MeadowEntitySchema.hasOwnProperty('Columns') ||
			!Array.isArray(this.options.MeadowEntitySchema.Columns) ||
			this.options.MeadowEntitySchema.Columns.length < 1)
		{
			throw new Error('MeadowSyncEntityOngoing requires a valid MeadowEntitySchema.Columns array.');
		}

		this.EntitySchema = JSON.parse(JSON.stringify(this.options.MeadowEntitySchema));

		if (!this.EntitySchema.hasOwnProperty('MeadowSchema'))
		{
			throw new Error('MeadowSyncEntityOngoing requires MeadowEntitySchema.MeadowSchema; please update stricture and recompile the extended JSON.');
		}

		this.DefaultIdentifier = this.EntitySchema.MeadowSchema.DefaultIdentifier;
		this.PageSize = this.options.PageSize || 100;

		this.Meadow = false;

		this.operation = new libMeadowOperation(this.fable);
	}

	initialize(fCallback)
	{
		if (this.fable.hasOwnProperty('Meadow'))
		{
			this.Meadow = this.fable.Meadow.loadFromPackageObject(this.EntitySchema.MeadowSchema);
		}

		this.log.info(`Sync for ${this.EntitySchema.TableName} creating table if it doesn't exist...`);

		if (this.Meadow && this.Meadow.provider)
		{
			return this.Meadow.provider.getProvider().createTable(this.EntitySchema, (pCreateError) =>
			{
				const tmpGUIDColumn = this.EntitySchema.Columns.find((c) => c.DataType == 'GUID');
				const tmpDeletedColumn = this.EntitySchema.Columns.find((c) => c.Column == 'Deleted');

				if (!tmpGUIDColumn && !tmpDeletedColumn)
				{
					this.log.info(`No GUID or Deleted columns for ${this.EntitySchema.TableName}; skipping index creation`);
					return fCallback(pCreateError);
				}

				if (!this.fable.MeadowConnectionManager || !this.fable.MeadowConnectionManager.ConnectionPool)
				{
					this.log.info(`No connection manager available; skipping index creation for ${this.EntitySchema.TableName}`);
					return fCallback(pCreateError);
				}

				let tmpAnticipate = this.fable.newAnticipate();
				if (tmpGUIDColumn)
				{
					tmpAnticipate.anticipate(
						(fNext) =>
						{
							return this.fable.MeadowConnectionManager.createIndex(this.EntitySchema, tmpGUIDColumn, true, fNext);
						});
				}
				if (tmpDeletedColumn)
				{
					tmpAnticipate.anticipate(
						(fNext) =>
						{
							return this.fable.MeadowConnectionManager.createIndex(this.EntitySchema, tmpDeletedColumn, false, fNext);
						});
				}
				tmpAnticipate.wait(fCallback);
			});
		}
		return fCallback();
	}

	marshalRecord(pSourceRecord)
	{
		const tmpRecordToCommit = {};

		for (const tmpColumn of this.EntitySchema.Columns)
		{
			if (pSourceRecord.hasOwnProperty(tmpColumn.Column))
			{
				switch (typeof(pSourceRecord[tmpColumn.Column]))
				{
					case 'null':
					case 'undefined':
						break;
					case 'object':
						if (pSourceRecord[tmpColumn.Column])
						{
							tmpRecordToCommit[tmpColumn.Column] = JSON.stringify(pSourceRecord[tmpColumn.Column]);
						}
						break;
					default:
						if (pSourceRecord[tmpColumn.Column] !== '')
						{
							tmpRecordToCommit[tmpColumn.Column] = pSourceRecord[tmpColumn.Column];
						}
						break;
				}
			}
			else if (tmpColumn.Column.endsWith('JSON') && typeof pSourceRecord[tmpColumn.Column.substring(0, tmpColumn.Column.length - 4)] === 'object')
			{
				tmpRecordToCommit[tmpColumn.Column] = JSON.stringify(pSourceRecord[tmpColumn.Column.substring(0, tmpColumn.Column.length - 4)]);
			}
		}

		return tmpRecordToCommit;
	}

	addSyncAnticipateEntry(tmpSyncState, tmpAnticipate)
	{
		tmpAnticipate.anticipate(
			(fNext) =>
			{
				const tmpURLPartial = `${this.EntitySchema.TableName}s/FilteredTo/FBV~${this.DefaultIdentifier}~GT~${tmpSyncState.LastRequestedID}~FSF~${this.DefaultIdentifier}~ASC~ASC/0/${this.PageSize}`;
				this.fable.MeadowCloneRestClient.getJSON(tmpURLPartial,
					(pDownloadError, pResponse, pBody) =>
					{
						if (pDownloadError)
						{
							this.fable.log.error(`Error getting URL Partial [${tmpURLPartial}]: ${pDownloadError}`, { Error: pDownloadError });
							return fNext();
						}
						if (pBody && pBody.length > 0)
						{
							for (let i = 0; i < pBody.length; i++)
							{
								const tmpRecord = pBody[i];

								tmpAnticipate.anticipate(
									(fNextEntityRecordSync) =>
									{
										const tmpQuery = this.Meadow.query;

										if (tmpRecord[this.DefaultIdentifier] > tmpSyncState.LastRequestedID)
										{
											tmpSyncState.LastRequestedID = tmpRecord[this.DefaultIdentifier];
										}

										if ((typeof(tmpRecord[this.DefaultIdentifier]) !== 'undefined') && (tmpRecord[this.DefaultIdentifier] > 0))
										{
											tmpQuery.addFilter(this.DefaultIdentifier, tmpRecord[this.DefaultIdentifier]);
										}

										this.Meadow.doRead(tmpQuery,
											(pReadError, pQuery, pRecord) =>
											{
												if (pReadError)
												{
													this.fable.log.error(`Error reading record ${this.EntitySchema.TableName}: ${pReadError}`, { Error: pReadError, PassedRecord: tmpRecord });
													return fNextEntityRecordSync();
												}

												if (pRecord)
												{
													const tmpAgeDifference = this.fable.Dates.dayJS(tmpRecord.UpdateDate).diff(this.fable.Dates.dayJS(pRecord.UpdateDate));

													if (Math.abs(tmpAgeDifference) < 5)
													{
														return fNextEntityRecordSync();
													}

													this.fable.log.info(`Syncing ${this.EntitySchema.TableName} record ${tmpRecord[this.DefaultIdentifier]} with age difference of ${tmpAgeDifference} ms.`);
												}

												const tmpRecordToCommit = this.marshalRecord(tmpRecord);

												const tmpSyncQuery = this.Meadow.query.addRecord(tmpRecordToCommit);

												tmpSyncQuery.setDisableAutoIdentity(true);
												tmpSyncQuery.setDisableAutoDateStamp(true);
												tmpSyncQuery.setDisableAutoUserStamp(true);
												tmpSyncQuery.setDisableDeleteTracking(true);

												if (!pRecord)
												{
													// Record not found -- create
													tmpSyncQuery.AllowIdentityInsert = true;

													this.Meadow.doCreate(tmpSyncQuery,
														(pCreateError) =>
														{
															if (pCreateError)
															{
																this.log.error(`Error creating record ${this.EntitySchema.TableName}: ${pCreateError}`, pCreateError);
																return fNextEntityRecordSync();
															}
															this.operation.incrementProgressTrackerStatus(`UpdateSync-${this.EntitySchema.TableName}`, 1);
															return fNextEntityRecordSync();
														});
												}
												else
												{
													// Record found -- update
													this.Meadow.doUpdate(tmpSyncQuery,
														(pUpdateError) =>
														{
															if (pUpdateError)
															{
																this.log.error(`Error updating record ${this.EntitySchema.TableName}: ${pUpdateError}`, pUpdateError);
																return fNextEntityRecordSync();
															}
															this.operation.incrementProgressTrackerStatus(`UpdateSync-${this.EntitySchema.TableName}`, 1);
															return fNextEntityRecordSync();
														});
												}
											});
									});
							}
							tmpSyncState.RequestsPerformed++;
							if (tmpSyncState.RequestsPerformed < tmpSyncState.EstimatedRequestCount)
							{
								this.fable.log.info(`Syncing ${this.EntitySchema.TableName} request ${tmpSyncState.RequestsPerformed} of ${tmpSyncState.EstimatedRequestCount}...`);
								this.addSyncAnticipateEntry(tmpSyncState, tmpAnticipate);
							}
							return fNext();
						}
						else
						{
							return fNext();
						}
					});
			});
	}

	sync(fCallback)
	{
		this.operation.createTimeStamp('EntityOngoingSync');

		let tmpAnticipate = this.fable.newAnticipate();

		const tmpSyncState = (
			{
				Local: { MaxIDEntity: -1, RecordCount: 0, HasUpdateDate: false, LatestUpdateDate: false },
				Server: { MaxIDEntity: -1, RecordCount: 0, HasUpdateDate: false, LatestUpdateDate: false },
			});

		this.fable.Utility.waterfall(
			[
				(fStageComplete) =>
				{
					if (!this.EntitySchema || !this.EntitySchema.MeadowSchema || !Array.isArray(this.EntitySchema.MeadowSchema.Schema))
					{
						return fStageComplete('MeadowSyncEntityOngoing requires a valid MeadowEntitySchema.MeadowSchema.Schema.');
					}

					for (let i = 0; i < this.EntitySchema.MeadowSchema.Schema.length; i++)
					{
						const tmpColumn = this.EntitySchema.MeadowSchema.Schema[i];
						if (tmpColumn.Column == 'UpdateDate')
						{
							tmpSyncState.Local.HasUpdateDate = true;
							tmpSyncState.Server.HasUpdateDate = true;
							this.log.info(`Entity ${this.EntitySchema.TableName} has UpdateDate column.`);
							break;
						}
					}

					this.log.info(`Syncing with UPDATE STRATEGY entity ${this.EntitySchema.TableName}...`);
					return fStageComplete();
				},
				(fStageComplete) =>
				{
					// Get the Max ID from local database
					const tmpQuery = this.Meadow.query;
					tmpQuery.setSort({ Column: this.DefaultIdentifier, Direction: 'Descending' });
					tmpQuery.setCap(1);
					this.Meadow.doRead(tmpQuery,
						(pReadError, pQuery, pRecord) =>
						{
							if (pReadError)
							{
								this.fable.log.error(`Error reading local max entity ID ${this.EntitySchema.TableName}: ${pReadError}`, { Error: pReadError });
								return fStageComplete(`Error reading local max entity ID ${this.EntitySchema.TableName}: ${pReadError}`);
							}
							if (!pRecord)
							{
								this.fable.log.warn(`No records found in local ${this.EntitySchema.TableName}.`);
								return fStageComplete();
							}
							this.fable.log.info(`Found local max entity ID ${this.EntitySchema.TableName}: ${pRecord[this.DefaultIdentifier]}`);
							tmpSyncState.Local.MaxIDEntity = pRecord[this.DefaultIdentifier];
							return fStageComplete();
						});
				},
				(fStageComplete) =>
				{
					// Get the Max UpdateDate from local database
					const tmpQuery = this.Meadow.query;
					tmpQuery.setSort({ Column: 'UpdateDate', Direction: 'Descending' });
					tmpQuery.setCap(1);
					this.Meadow.doRead(tmpQuery,
						(pReadError, pQuery, pRecord) =>
						{
							if (pReadError)
							{
								this.fable.log.error(`Error reading local max UpdateDate ${this.EntitySchema.TableName}: ${pReadError}`, { Error: pReadError });
								return fStageComplete(`Error reading local max UpdateDate ${this.EntitySchema.TableName}: ${pReadError}`);
							}
							if (!pRecord)
							{
								this.fable.log.warn(`No records found in local checking UpdateDate ${this.EntitySchema.TableName}.`);
								return fStageComplete();
							}
							this.fable.log.info(`Found local max UpdateDate ${this.EntitySchema.TableName}: ${pRecord.UpdateDate}`);
							tmpSyncState.Local.MaxUpdateDate = pRecord.UpdateDate;
							return fStageComplete();
						});
				},
				(fStageComplete) =>
				{
					// Get the count from local database
					const tmpQuery = this.Meadow.query;
					this.Meadow.doCount(tmpQuery,
						(pCountError, pQuery, pCount) =>
						{
							if (pCountError)
							{
								this.fable.log.error(`Error getting local count of ${this.EntitySchema.TableName}: ${pCountError}`, { Error: pCountError });
								return fStageComplete(`Error getting local count of ${this.EntitySchema.TableName}: ${pCountError}`);
							}
							tmpSyncState.Local.RecordCount = pCount;
							return fStageComplete();
						});
				},
				(fStageComplete) =>
				{
					// Get the Max ID from server
					this.fable.MeadowCloneRestClient.getJSON(`${this.EntitySchema.TableName}/Max/${this.DefaultIdentifier}`,
						(pError, pResponse, pBody) =>
						{
							if (pError)
							{
								this.fable.log.error(`Error getting server max entity ID ${this.EntitySchema.TableName}: ${pError}`, { Error: pError });
								return fStageComplete(`Error getting server max entity ID ${this.EntitySchema.TableName}: ${pError}`);
							}
							if (pBody && pBody.hasOwnProperty(this.DefaultIdentifier))
							{
								this.fable.log.info(`Found server max entity ID ${this.EntitySchema.TableName}: ${pBody[this.DefaultIdentifier]}`);
								tmpSyncState.Server.MaxIDEntity = pBody[this.DefaultIdentifier];
							}
							else
							{
								this.fable.log.warn(`No records found in server for max entity ID of ${this.EntitySchema.TableName}.`);
							}
							return fStageComplete();
						});
				},
				(fStageComplete) =>
				{
					// Get the Max UpdateDate from server
					this.fable.MeadowCloneRestClient.getJSON(`${this.EntitySchema.TableName}/Max/UpdateDate`,
						(pError, pResponse, pBody) =>
						{
							if (pError)
							{
								this.fable.log.error(`Error getting server max UpdateDate ${this.EntitySchema.TableName}: ${pError}`, { Error: pError });
								return fStageComplete(`Error getting server max UpdateDate ${this.EntitySchema.TableName}: ${pError}`);
							}
							if (pBody && pBody.hasOwnProperty(this.DefaultIdentifier))
							{
								this.fable.log.info(`Found server max UpdateDate ${this.EntitySchema.TableName}: ${pBody['UpdateDate']}`);
								tmpSyncState.Server.MaxUpdateDate = pBody.UpdateDate;
							}
							else
							{
								this.fable.log.warn(`No records found in server for max UpdateDate of ${this.EntitySchema.TableName}.`);
							}
							return fStageComplete();
						});
				},
				(fStageComplete) =>
				{
					// Get the count from server
					this.fable.MeadowCloneRestClient.getJSON(`${this.EntitySchema.TableName}s/Count`,
						(pError, pResponse, pBody) =>
						{
							if (pError)
							{
								this.fable.log.error(`Error getting server count for ${this.EntitySchema.TableName}: ${pError}`, { Error: pError });
								return fStageComplete(`Error getting server count for ${this.EntitySchema.TableName}: ${pError}`);
							}
							if (pBody && pBody.hasOwnProperty('Count'))
							{
								this.fable.log.info(`Found server count for ${this.EntitySchema.TableName}: ${pBody.Count}`);
								tmpSyncState.Server.RecordCount = pBody.Count;
							}
							else
							{
								this.fable.log.warn(`No records found in server based on count for ${this.EntitySchema.TableName}.`);
							}
							return fStageComplete();
						});
				},
				(fStageComplete) =>
				{
					tmpSyncState.EstimatedRequestCount = Math.ceil(tmpSyncState.Server.RecordCount / this.PageSize);
					tmpSyncState.RequestsPerformed = 0;
					tmpSyncState.LastRequestedID = 0;

					this.operation.createProgressTracker(tmpSyncState.EstimatedRequestCount, `UpdateSync-${this.EntitySchema.TableName}`);
					this.operation.printProgressTrackerStatus(`UpdateSync-${this.EntitySchema.TableName}`);

					return fStageComplete();
				},
				(fStageComplete) =>
				{
					if (tmpSyncState.EstimatedRequestCount < 1)
					{
						this.fable.log.info(`No records to update sync for ${this.EntitySchema.TableName}.`);
						return fStageComplete();
					}

					this.addSyncAnticipateEntry(tmpSyncState, tmpAnticipate);

					tmpAnticipate.wait(fStageComplete);
				},
			],
			(pError) =>
			{
				if (pError)
				{
					this.fable.log.error(`Error performing Update sync ${this.EntitySchema.TableName}: ${pError}`, { Error: pError });
					return fCallback();
				}

				return fCallback();
			});
	}
}

module.exports = MeadowSyncEntityOngoing;
