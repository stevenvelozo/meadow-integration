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
		this.SyncDeletedRecords = this.options.SyncDeletedRecords || false;
		this.MaxRecordsPerEntity = this.options.MaxRecordsPerEntity || 0;

		this.Meadow = false;

		this.operation = new libMeadowOperation(this.fable);

		this.skipSync = false;
	}

	initialize(fCallback)
	{
		if (this.fable.hasOwnProperty('Meadow'))
		{
			this.Meadow = this.fable.Meadow.loadFromPackageObject(this.EntitySchema.MeadowSchema);
		}

		if (this.Meadow && this.Meadow.provider)
		{
			let tmpProvider = this.Meadow.provider.getProvider();

			if (!tmpProvider)
			{
				this.log.error(`No provider returned by getProvider() for ${this.EntitySchema.TableName}`);
				return fCallback(new Error(`No provider returned by getProvider() for ${this.EntitySchema.TableName}`));
			}

			if (!tmpProvider.createTable)
			{
				this.log.error(`Provider for ${this.EntitySchema.TableName} has no createTable method.`);
				return fCallback(new Error(`Provider for ${this.EntitySchema.TableName} has no createTable method`));
			}

			return tmpProvider.createTable(this.EntitySchema, (pCreateError) =>
			{
				let fValidateAndCallback = (pPriorError) =>
				{
					// Validate local table schema with a lightweight read
					const tmpValidationQuery = this.Meadow.query;
					tmpValidationQuery.setCap(1);
					tmpValidationQuery.setDisableDeleteTracking(true);
					this.Meadow.doRead(tmpValidationQuery,
						(pReadError) =>
						{
							if (pReadError)
							{
								let tmpErrorStr = (typeof(pReadError) === 'string') ? pReadError : JSON.stringify(pReadError);
								// Only skip sync for schema-specific errors (invalid column/object name)
								// Generic provider errors (e.g. prepared statement failures) should not block sync
								if (tmpErrorStr.indexOf('Invalid column') > -1 || tmpErrorStr.indexOf('Invalid object') > -1 || tmpErrorStr.indexOf('no such column') > -1 || tmpErrorStr.indexOf('no such table') > -1)
								{
									this.log.warn(`${this.EntitySchema.TableName}: local table schema validation failed (${pReadError}); this entity will be skipped during sync.`);
									this.skipSync = true;
								}
								else
								{
									this.log.warn(`${this.EntitySchema.TableName}: validation read returned error (${pReadError}); sync will proceed.`);
								}
							}
							return fCallback(pPriorError);
						});
				};
				if (pCreateError)
				{
					this.log.warn(`${this.EntitySchema.TableName}: createTable returned error: ${pCreateError}`);
				}

				const tmpGUIDColumn = this.EntitySchema.Columns.find((c) => c.DataType == 'GUID');
				const tmpDeletedColumn = this.EntitySchema.Columns.find((c) => c.Column == 'Deleted');

				if (!tmpGUIDColumn && !tmpDeletedColumn)
				{
					this.log.info(`No GUID or Deleted columns for ${this.EntitySchema.TableName}; skipping index creation`);
					return fValidateAndCallback(pCreateError);
				}

				if (!this.fable.MeadowConnectionManager || !this.fable.MeadowConnectionManager.ConnectionPool)
				{
					this.log.info(`No connection manager available; skipping index creation for ${this.EntitySchema.TableName}`);
					return fValidateAndCallback(pCreateError);
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
				tmpAnticipate.wait((pIndexError) =>
				{
					if (pIndexError)
					{
						this.log.warn(`${this.EntitySchema.TableName}: Index creation error: ${pIndexError}`);
					}
					return fValidateAndCallback(pIndexError || pCreateError);
				});
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

	syncDeletedRecords(fCallback)
	{
		const tmpDeletedColumn = this.EntitySchema.Columns.find((c) => c.Column == 'Deleted');
		if (!tmpDeletedColumn)
		{
			this.fable.log.info(`No Deleted column for ${this.EntitySchema.TableName}; skipping delete sync.`);
			return fCallback();
		}

		this.fable.log.info(`Checking for deleted records on server for ${this.EntitySchema.TableName}...`);

		// Get the count of deleted records from the server.
		// The explicit FBV~Deleted~EQ~1 filter overrides foxhound's automatic Deleted=0 filter.
		this.fable.MeadowCloneRestClient.getJSON(`${this.EntitySchema.TableName}s/Count/FilteredTo/FBV~Deleted~EQ~1`,
			(pError, pResponse, pBody) =>
			{
				if (pError || !pBody || !pBody.hasOwnProperty('Count'))
				{
					this.fable.log.warn(`Could not get deleted record count for ${this.EntitySchema.TableName}; skipping delete sync.`);
					return fCallback();
				}

				const tmpDeletedCount = pBody.Count;
				if (tmpDeletedCount < 1)
				{
					this.fable.log.info(`No deleted records on server for ${this.EntitySchema.TableName}.`);
					return fCallback();
				}

				this.fable.log.info(`Found ${tmpDeletedCount} deleted records on server for ${this.EntitySchema.TableName}; syncing deletions...`);

				// Generate paginated URLs for deleted records
				let tmpDeleteCap = (this.MaxRecordsPerEntity > 0)
					? Math.min(tmpDeletedCount, this.MaxRecordsPerEntity)
					: tmpDeletedCount;
				const tmpDeleteURLPartials = [];
				for (let i = 0; i < tmpDeleteCap; i += this.PageSize)
				{
					tmpDeleteURLPartials.push(`${this.EntitySchema.TableName}s/FilteredTo/FBV~Deleted~EQ~1~FSF~${this.DefaultIdentifier}~ASC~ASC/${i}/${this.PageSize}`);
				}

				this.fable.Utility.eachLimit(tmpDeleteURLPartials, 1,
					(pURLPartial, fPageComplete) =>
					{
						this.fable.MeadowCloneRestClient.getJSON(pURLPartial,
							(pDownloadError, pResponse, pBody) =>
							{
								if (pDownloadError || !pBody || !Array.isArray(pBody) || pBody.length < 1)
								{
									return fPageComplete();
								}

								this.fable.Utility.eachLimit(pBody, 5,
									(pEntityRecord, fRecordComplete) =>
									{
										const tmpRecordID = pEntityRecord[this.DefaultIdentifier];
										if (!tmpRecordID || tmpRecordID < 1)
										{
											return fRecordComplete();
										}

										// Read local record with delete tracking disabled so we can see all records
										const tmpQuery = this.Meadow.query;
										tmpQuery.addFilter(this.DefaultIdentifier, tmpRecordID);
										tmpQuery.setDisableDeleteTracking(true);

										this.Meadow.doRead(tmpQuery,
											(pReadError, pQuery, pRecord) =>
											{
												if (pReadError || !pRecord)
												{
													// Record doesn't exist locally -- create it as deleted
													const tmpRecordToCommit = this.marshalRecord(pEntityRecord);

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
																this.log.error(`Error creating deleted record ${this.EntitySchema.TableName} ID ${tmpRecordID}: ${pCreateError}`);
															}
															return fRecordComplete();
														});
													return;
												}

												if (pRecord.Deleted == 1)
												{
													// Already marked deleted locally
													return fRecordComplete();
												}

												// Record exists locally but is not deleted -- update it
												const tmpRecordToCommit = this.marshalRecord(pEntityRecord);

												const tmpUpdateQuery = this.Meadow.query.addRecord(tmpRecordToCommit);
												tmpUpdateQuery.setDisableAutoIdentity(true);
												tmpUpdateQuery.setDisableAutoDateStamp(true);
												tmpUpdateQuery.setDisableAutoUserStamp(true);
												tmpUpdateQuery.setDisableDeleteTracking(true);

												this.Meadow.doUpdate(tmpUpdateQuery,
													(pUpdateError) =>
													{
														if (pUpdateError)
														{
															this.log.error(`Error marking record as deleted ${this.EntitySchema.TableName} ID ${tmpRecordID}: ${pUpdateError}`);
														}
														return fRecordComplete();
													});
											});
									},
									(pRecordSyncError) =>
									{
										return fPageComplete();
									});
							});
					},
					(pDeleteSyncError) =>
					{
						this.fable.log.info(`Delete sync complete for ${this.EntitySchema.TableName} (${tmpDeletedCount} deleted records processed).`);
						return fCallback();
					});
			});
	}

	sync(fCallback)
	{
		if (this.skipSync)
		{
			this.log.warn(`Skipping sync for ${this.EntitySchema.TableName} -- local table schema does not match expected schema.`);
			return fCallback();
		}

		this.operation.createTimeStamp('EntityInitialSync');

		this.log.info(`Syncing ${this.EntitySchema.TableName} (PageSize: ${this.PageSize}, SyncDeletedRecords: ${this.SyncDeletedRecords})`);

		const tmpSyncState = (
			{
				Local: { MaxIDEntity: -1, RecordCount: 0 },
				Server: { MaxIDEntity: -1, RecordCount: 0 },
			});

		// Detect whether the table has a Deleted column
		if (this.EntitySchema.MeadowSchema && Array.isArray(this.EntitySchema.MeadowSchema.Schema))
		{
			for (let i = 0; i < this.EntitySchema.MeadowSchema.Schema.length; i++)
			{
				const tmpColumn = this.EntitySchema.MeadowSchema.Schema[i];
				if (tmpColumn.Type == 'Deleted' || tmpColumn.Column == 'Deleted')
				{
					tmpSyncState.HasDeletedColumn = true;
				}
			}
		}

		this.fable.Utility.waterfall(
			[
				(fStageComplete) =>
				{
					// Get the Max ID from local database
					const tmpQuery = this.Meadow.query;
					tmpQuery.setSort({ Column: this.DefaultIdentifier, Direction: 'Descending' });
					tmpQuery.setCap(1);
					if (!tmpSyncState.HasDeletedColumn)
					{
						tmpQuery.setDisableDeleteTracking(true);
					}
					this.Meadow.doRead(tmpQuery,
						(pReadError, pQuery, pRecord) =>
						{
							if (pReadError)
							{
								return fStageComplete(`Error reading local max entity ID ${this.EntitySchema.TableName}: ${pReadError}`);
							}
							if (pRecord)
							{
								tmpSyncState.Local.MaxIDEntity = pRecord[this.DefaultIdentifier];
							}
							return fStageComplete();
						});
				},
				(fStageComplete) =>
				{
					// Get the count from local database
					const tmpQuery = this.Meadow.query;
					if (!tmpSyncState.HasDeletedColumn)
					{
						tmpQuery.setDisableDeleteTracking(true);
					}
					this.Meadow.doCount(tmpQuery,
						(pCountError, pQuery, pCount) =>
						{
							if (pCountError)
							{
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
								this.fable.log.warn(`Could not get server max entity ID for ${this.EntitySchema.TableName} (${pError}); continuing sync.`);
								return fStageComplete();
							}
							if (pBody && pBody.hasOwnProperty(this.DefaultIdentifier))
							{
								tmpSyncState.Server.MaxIDEntity = pBody[this.DefaultIdentifier];
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
								this.fable.log.warn(`Could not get server count for ${this.EntitySchema.TableName} (${pError}); estimating from max ID.`);
								tmpSyncState.Server.RecordCount = tmpSyncState.Server.MaxIDEntity > 0 ? tmpSyncState.Server.MaxIDEntity : 0;
								return fStageComplete();
							}
							if (pBody && pBody.hasOwnProperty('Count'))
							{
								tmpSyncState.Server.RecordCount = pBody.Count;
							}
							return fStageComplete();
						});
				},
				(fStageComplete) =>
				{
					tmpSyncState.EstimatedRecordCount = tmpSyncState.Server.RecordCount - tmpSyncState.Local.RecordCount;

					// Apply MaxRecordsPerEntity cap if configured
					let tmpRecordCap = (this.MaxRecordsPerEntity > 0)
						? Math.min(tmpSyncState.Server.RecordCount, this.MaxRecordsPerEntity)
						: tmpSyncState.Server.RecordCount;

					if (this.MaxRecordsPerEntity > 0 && tmpSyncState.EstimatedRecordCount > this.MaxRecordsPerEntity)
					{
						tmpSyncState.EstimatedRecordCount = this.MaxRecordsPerEntity;
					}

					this.operation.createProgressTracker(tmpSyncState.EstimatedRecordCount, `FullSync-${this.EntitySchema.TableName}`);
					this.operation.printProgressTrackerStatus(`FullSync-${this.EntitySchema.TableName}`);

					// Generate paginated URL partials
					tmpSyncState.URLPartials = [];
					for (let i = 0; i < tmpRecordCap; i += this.PageSize)
					{
						tmpSyncState.URLPartials.push(`${this.EntitySchema.TableName}s/FilteredTo/FBV~${this.DefaultIdentifier}~GT~${tmpSyncState.Local.MaxIDEntity}~FSF~${this.DefaultIdentifier}~ASC~ASC/${i}/${this.PageSize}`);
					}

					this.fable.log.info(`${this.EntitySchema.TableName}: downloading ${tmpSyncState.URLPartials.length} pages (local: ${tmpSyncState.Local.RecordCount}/${tmpSyncState.Local.MaxIDEntity}, server: ${tmpSyncState.Server.RecordCount}/${tmpSyncState.Server.MaxIDEntity}, estimated new: ${tmpSyncState.EstimatedRecordCount}${this.MaxRecordsPerEntity > 0 ? `, capped at ${this.MaxRecordsPerEntity}` : ''})`);

					return fStageComplete();
				},
				(fStageComplete) =>
				{
					let tmpPageIndex = 0;
					let tmpRecordsCreated = 0;
					let tmpRecordsSkipped = 0;
					let tmpRecordsErrored = 0;

					this.fable.Utility.eachLimit(tmpSyncState.URLPartials, 1,
						(pURLPartial, fDownloadComplete) =>
						{
							tmpPageIndex++;

							this.fable.MeadowCloneRestClient.getJSON(pURLPartial,
								(pDownloadError, pResponse, pBody) =>
								{
									if (pDownloadError)
									{
										this.fable.log.error(`${this.EntitySchema.TableName}: page ${tmpPageIndex} download error: ${pDownloadError}`);
										return fDownloadComplete();
									}
									if (pBody && Array.isArray(pBody) && pBody.length > 0)
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

												if (!tmpSyncState.HasDeletedColumn)
												{
													tmpQuery.setDisableDeleteTracking(true);
												}

												this.Meadow.doRead(tmpQuery,
													(pReadError, pQuery, pRecord) =>
													{
														if (pReadError)
														{
															tmpRecordsErrored++;
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
																		let tmpErrorStr = (typeof(pCreateError) === 'string') ? pCreateError : JSON.stringify(pCreateError);
																		if (tmpErrorStr.toLowerCase().indexOf('duplicate') > -1 || tmpErrorStr.toLowerCase().indexOf('unique') > -1)
																		{
																			// Duplicate key (likely GUID conflict) -- fall back to update
																			this.log.warn(`${this.EntitySchema.TableName}: duplicate key on create for ID ${tmpRecord[this.DefaultIdentifier]}; falling back to update.`);
																			const tmpUpdateQuery = this.Meadow.query.addRecord(tmpRecordToCommit);
																			tmpUpdateQuery.setDisableAutoIdentity(true);
																			tmpUpdateQuery.setDisableAutoDateStamp(true);
																			tmpUpdateQuery.setDisableAutoUserStamp(true);
																			tmpUpdateQuery.setDisableDeleteTracking(true);
																			this.Meadow.doUpdate(tmpUpdateQuery,
																				(pUpdateError) =>
																				{
																					if (pUpdateError)
																					{
																						tmpRecordsErrored++;
																						this.log.error(`${this.EntitySchema.TableName}: fallback update also failed for ID ${tmpRecord[this.DefaultIdentifier]}: ${pUpdateError}`);
																						return fEntitySyncComplete();
																					}
																					tmpRecordsCreated++;
																					this.operation.incrementProgressTrackerStatus(`FullSync-${this.EntitySchema.TableName}`, 1);
																					return fEntitySyncComplete();
																				});
																			return;
																		}
																		tmpRecordsErrored++;
																		this.log.error(`${this.EntitySchema.TableName}: doCreate error for ID ${tmpRecord[this.DefaultIdentifier]}: ${pCreateError}`);
																		return fEntitySyncComplete();
																	}
																	tmpRecordsCreated++;
																	this.operation.incrementProgressTrackerStatus(`FullSync-${this.EntitySchema.TableName}`, 1);
																	return fEntitySyncComplete();
																});
														}
														else
														{
															tmpRecordsSkipped++;
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
							this.fable.log.info(`${this.EntitySchema.TableName}: sync complete — created: ${tmpRecordsCreated}, skipped: ${tmpRecordsSkipped}, errors: ${tmpRecordsErrored}`);
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
					this.fable.log.error(`${this.EntitySchema.TableName}: sync error: ${pError}`);
				}

				if (this.SyncDeletedRecords)
				{
					return this.syncDeletedRecords(() => { return fCallback(); });
				}

				return fCallback();
			});
	}
}

module.exports = MeadowSyncEntityInitial;
