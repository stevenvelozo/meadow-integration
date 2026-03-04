const libFableServiceProviderBase = require('fable-serviceproviderbase');
const libMeadowOperation = require('./Meadow-Service-Operation.js');

class MeadowSyncEntityInitial extends libFableServiceProviderBase
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this.serviceType = 'MeadowSyncEntityInitial';

		if (!this.options.hasOwnProperty('MeadowEntitySchema'))
		{
			throw new Error('MeadowSyncEntityInitial requires a valid MeadowEntitySchema option.');
		}
		if (typeof(this.options.MeadowEntitySchema) != 'object')
		{
			throw new Error(`MeadowSyncEntityInitial requires MeadowEntitySchema to be an object; got ${typeof(this.options.MeadowEntitySchema)}.`);
		}
		if (!this.options.MeadowEntitySchema.hasOwnProperty('TableName') ||
			typeof(this.options.MeadowEntitySchema.TableName) != 'string' ||
			this.options.MeadowEntitySchema.TableName.length < 1)
		{
			throw new Error('MeadowSyncEntityInitial requires a valid MeadowEntitySchema.TableName.');
		}
		if (!this.options.MeadowEntitySchema.hasOwnProperty('Columns') ||
			!Array.isArray(this.options.MeadowEntitySchema.Columns) ||
			this.options.MeadowEntitySchema.Columns.length < 1)
		{
			throw new Error('MeadowSyncEntityInitial requires a valid MeadowEntitySchema.Columns array.');
		}

		this.EntitySchema = JSON.parse(JSON.stringify(this.options.MeadowEntitySchema));

		if (!this.EntitySchema.hasOwnProperty('MeadowSchema'))
		{
			throw new Error('MeadowSyncEntityInitial requires MeadowEntitySchema.MeadowSchema; please update stricture and recompile the extended JSON.');
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
						if (tmpColumn.DataType == 'DateTime')
						{
							if ((typeof(pSourceRecord[tmpColumn.Column]) == 'string') && (pSourceRecord[tmpColumn.Column].length > 0))
							{
								tmpRecordToCommit[tmpColumn.Column] = this.fable.Dates.dayJS.utc(pSourceRecord[tmpColumn.Column]).format('YYYY-MM-DD HH:mm:ss.SSS');
							}
						}
						else if (pSourceRecord[tmpColumn.Column] !== '')
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

	sync(fCallback)
	{
		this.operation.createTimeStamp('EntityInitialSync');

		const tmpSyncState = (
			{
				Local: { MaxIDEntity: -1, RecordCount: 0 },
				Server: { MaxIDEntity: -1, RecordCount: 0 },
			});

		this.fable.Utility.waterfall(
			[
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
					// Get the Max ID from the server
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
					// Get the count from the server
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
					tmpSyncState.EstimatedRecordCount = tmpSyncState.Server.RecordCount - tmpSyncState.Local.RecordCount;

					this.operation.createProgressTracker(tmpSyncState.EstimatedRecordCount, `FullSync-${this.EntitySchema.TableName}`);
					this.operation.printProgressTrackerStatus(`FullSync-${this.EntitySchema.TableName}`);

					// Generate paginated URL partials
					tmpSyncState.URLPartials = [];
					for (let i = 0; i < tmpSyncState.Server.RecordCount; i += this.PageSize)
					{
						tmpSyncState.URLPartials.push(`${this.EntitySchema.TableName}s/FilteredTo/FBV~${this.DefaultIdentifier}~GT~${tmpSyncState.Local.MaxIDEntity}~FSF~${this.DefaultIdentifier}~ASC~ASC/${i}/${this.PageSize}`);
					}

					this.fable.log.info(`Syncing with ${tmpSyncState.URLPartials.length} requests for ${this.EntitySchema.TableName} with local max ID ${tmpSyncState.Local.MaxIDEntity} and server max ID ${tmpSyncState.Server.MaxIDEntity}; estimated ${tmpSyncState.EstimatedRecordCount} records to sync.`);

					return fStageComplete();
				},
				(fStageComplete) =>
				{
					this.fable.Utility.eachLimit(tmpSyncState.URLPartials, 1,
						(pURLPartial, fDownloadComplete) =>
						{
							this.fable.MeadowCloneRestClient.getJSON(pURLPartial,
								(pDownloadError, pResponse, pBody) =>
								{
									if (pDownloadError)
									{
										this.fable.log.error(`Error getting URL Partial [${pURLPartial}]: ${pDownloadError}`, { Error: pDownloadError });
										return fDownloadComplete();
									}
									if (pBody && pBody.length > 0)
									{
										this.fable.Utility.eachLimit(pBody, 5,
											(pEntityRecord, fEntitySyncComplete) =>
											{
												const tmpRecord = pEntityRecord;
												const tmpQuery = this.Meadow.query;

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
															return fEntitySyncComplete();
														}
														if (!pRecord)
														{
															// Record not found -- create it
															const tmpRecordToCommit = this.marshalRecord(tmpRecord);

															const tmpCreateQuery = this.Meadow.query.addRecord(tmpRecordToCommit);

															tmpCreateQuery.setDisableAutoIdentity(true);
															tmpCreateQuery.setDisableAutoDateStamp(true);
															tmpCreateQuery.setDisableAutoUserStamp(true);
															tmpCreateQuery.setDisableDeleteTracking(true);

															tmpCreateQuery.AllowIdentityInsert = true;

															this.Meadow.doCreate(tmpCreateQuery,
																(pCreateError) =>
																{
																	if (pCreateError)
																	{
																		this.log.error(`Error creating record ${this.EntitySchema.TableName}: ${pCreateError}`, pCreateError);
																		return fEntitySyncComplete();
																	}
																	this.operation.incrementProgressTrackerStatus(`FullSync-${this.EntitySchema.TableName}`, 1);
																	return fEntitySyncComplete();
																});
														}
														else
														{
															return fEntitySyncComplete();
														}
													});
											},
											(pEntitySyncError) =>
											{
												this.operation.printProgressTrackerStatus(`FullSync-${this.EntitySchema.TableName}`);
												if (pEntitySyncError)
												{
													this.log.error(`Problem or early completion syncing entity ${this.EntitySchema.TableName}: ${pEntitySyncError}`, pEntitySyncError);
												}
												return fDownloadComplete();
											});
									}
									else
									{
										if (Array.isArray(pBody) && pBody.length == 0)
										{
											return fDownloadComplete(new Error('Records depleted!'));
										}
										return fDownloadComplete();
									}
								});
						},
						(pDownloadError) =>
						{
							if (pDownloadError)
							{
								this.fable.log.error(`Error returned URL Partial .. this may not be an error: ${pDownloadError}`);
							}
							fStageComplete();
						});
				},
			],
			(pError) =>
			{
				if (pError)
				{
					this.fable.log.error(`Error performing sync ${this.EntitySchema.TableName}: ${pError}`, { Error: pError });
					return fCallback();
				}

				return fCallback();
			});
	}
}

module.exports = MeadowSyncEntityInitial;
