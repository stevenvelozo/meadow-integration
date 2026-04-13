const libMeadowSyncEntityOngoing = require('./Meadow-Service-Sync-Entity-Ongoing.js');

class MeadowSyncEntityComparisonOnly extends libMeadowSyncEntityOngoing
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this.serviceType = 'MeadowSyncEntityComparisonOnly';

		this.ComparisonReport = null;
	}

	// Compare a local ID range against the server and record the result in the
	// report.  Same logic as _bisectRange but never pulls or upserts records.
	_compareRange(pMinID, pMaxID, pDepth, pReport, fCallback)
	{
		const tmpRangeSize = pMaxID - pMinID + 1;
		const tmpIDCol = this.DefaultIdentifier;
		const tmpRangeFilter = `FBV~${tmpIDCol}~GE~${pMinID}~FBV~${tmpIDCol}~LE~${pMaxID}`;

		this._getLocalCount(pMinID, pMaxID,
			(pLocalCountError, pLocalCount) =>
			{
				if (pLocalCountError)
				{
					this.fable.log.warn(`${this.EntitySchema.TableName}: compare local count error for range ${pMinID}-${pMaxID}: ${pLocalCountError}`);
					pReport.Ranges.push(
						{
							MinID: pMinID,
							MaxID: pMaxID,
							Status: 'error',
							Error: `Local count error: ${pLocalCountError}`
						});
					return fCallback();
				}

				this._getServerCount(tmpRangeFilter,
					(pServerCountError, pServerCount) =>
					{
						if (pServerCountError)
						{
							this.fable.log.warn(`${this.EntitySchema.TableName}: compare server count error for range ${pMinID}-${pMaxID}: ${pServerCountError}`);
							pReport.Ranges.push(
								{
									MinID: pMinID,
									MaxID: pMaxID,
									Status: 'error',
									Error: `Server count error: ${pServerCountError}`
								});
							return fCallback();
						}

						if (pLocalCount === pServerCount)
						{
							if (!this._hasUpdateDate)
							{
								// Counts match, no UpdateDate to check -- record as match
								pReport.Ranges.push(
									{
										MinID: pMinID,
										MaxID: pMaxID,
										Status: 'match',
										LocalCount: pLocalCount,
										ServerCount: pServerCount
									});
								this._incrementProgress(pServerCount);
								return fCallback();
							}

							// Compare UpdateDate boundaries
							this._getLocalMaxUpdateDate(pMinID, pMaxID,
								(pLocalMaxErr, pLocalMaxDate) =>
								{
									if (pLocalMaxErr || !pLocalMaxDate)
									{
										// Can't determine UpdateDate -- treat as match by count
										pReport.Ranges.push(
											{
												MinID: pMinID,
												MaxID: pMaxID,
												Status: 'match',
												LocalCount: pLocalCount,
												ServerCount: pServerCount
											});
										this._incrementProgress(pServerCount);
										return fCallback();
									}

									const tmpMaxDateFilter = `${tmpRangeFilter}~FSF~UpdateDate~DESC~DESC`;
									this._getServerRecords(tmpMaxDateFilter, 0, 1,
										(pServerMaxErr, pServerMaxRecords) =>
										{
											if (pServerMaxErr || !pServerMaxRecords || pServerMaxRecords.length < 1)
											{
												pReport.Ranges.push(
													{
														MinID: pMinID,
														MaxID: pMaxID,
														Status: 'match',
														LocalCount: pLocalCount,
														ServerCount: pServerCount
													});
												this._incrementProgress(pServerCount);
												return fCallback();
											}

											const tmpServerMaxDate = pServerMaxRecords[0].UpdateDate;
											const tmpLocalNorm = this._normalizeDateUTC(pLocalMaxDate);
											const tmpServerNorm = this._normalizeDateUTC(tmpServerMaxDate);
											const tmpMaxDateDiff = Math.abs(tmpLocalNorm.diff(tmpServerNorm));

											if (tmpMaxDateDiff <= this.DateTimePrecisionMS)
											{
												// Counts and dates match -- in sync
												pReport.Ranges.push(
													{
														MinID: pMinID,
														MaxID: pMaxID,
														Status: 'match',
														LocalCount: pLocalCount,
														ServerCount: pServerCount
													});
												this._incrementProgress(pServerCount);
												return fCallback();
											}

											// Dates differ even though counts match
											if (tmpRangeSize <= this.BisectMinRangeSize)
											{
												pReport.Ranges.push(
													{
														MinID: pMinID,
														MaxID: pMaxID,
														Status: 'mismatch',
														LocalCount: pLocalCount,
														ServerCount: pServerCount,
														CountDifference: pServerCount - pLocalCount,
														LocalMaxUpdateDate: tmpLocalNorm.toISOString(),
														ServerMaxUpdateDate: tmpServerNorm.toISOString(),
														UpdateDateDifferenceMS: tmpMaxDateDiff
													});
												this._incrementProgress(pServerCount);
												return fCallback();
											}

											return this._compareSubdivideRange(pMinID, pMaxID, pDepth, pReport, fCallback);
										});
								});
							return;
						}

						// Counts differ
						if (tmpRangeSize <= this.BisectMinRangeSize)
						{
							const tmpMismatchEntry = {
								MinID: pMinID,
								MaxID: pMaxID,
								Status: 'mismatch',
								LocalCount: pLocalCount,
								ServerCount: pServerCount,
								CountDifference: pServerCount - pLocalCount
							};

							// Try to get UpdateDate info for the mismatch entry
							if (this._hasUpdateDate)
							{
								this._getLocalMaxUpdateDate(pMinID, pMaxID,
									(pLocalMaxErr, pLocalMaxDate) =>
									{
										if (!pLocalMaxErr && pLocalMaxDate)
										{
											const tmpMaxDateFilter = `${tmpRangeFilter}~FSF~UpdateDate~DESC~DESC`;
											this._getServerRecords(tmpMaxDateFilter, 0, 1,
												(pServerMaxErr, pServerMaxRecords) =>
												{
													if (!pServerMaxErr && pServerMaxRecords && pServerMaxRecords.length > 0)
													{
														const tmpLocalNorm = this._normalizeDateUTC(pLocalMaxDate);
														const tmpServerNorm = this._normalizeDateUTC(pServerMaxRecords[0].UpdateDate);
														tmpMismatchEntry.LocalMaxUpdateDate = tmpLocalNorm.toISOString();
														tmpMismatchEntry.ServerMaxUpdateDate = tmpServerNorm.toISOString();
														tmpMismatchEntry.UpdateDateDifferenceMS = Math.abs(tmpLocalNorm.diff(tmpServerNorm));
													}
													pReport.Ranges.push(tmpMismatchEntry);
													this._incrementProgress(Math.max(pLocalCount, pServerCount));
													return fCallback();
												});
											return;
										}
										pReport.Ranges.push(tmpMismatchEntry);
										this._incrementProgress(Math.max(pLocalCount, pServerCount));
										return fCallback();
									});
								return;
							}

							pReport.Ranges.push(tmpMismatchEntry);
							this._incrementProgress(Math.max(pLocalCount, pServerCount));
							return fCallback();
						}

						return this._compareSubdivideRange(pMinID, pMaxID, pDepth, pReport, fCallback);
					});
			});
	}

	_compareSubdivideRange(pMinID, pMaxID, pDepth, pReport, fCallback)
	{
		const tmpMidID = Math.floor((pMinID + pMaxID) / 2);

		this.fable.log.info(`${this.EntitySchema.TableName}: compare subdividing range ${pMinID}-${pMaxID} at ID ${tmpMidID} (depth ${pDepth})`);

		this._compareRange(pMinID, tmpMidID, pDepth + 1, pReport,
			() =>
			{
				this._compareRange(tmpMidID + 1, pMaxID, pDepth + 1, pReport, fCallback);
			});
	}

	_syncInternal(fCallback)
	{
		this.operation.createTimeStamp('EntityComparisonOnlySync');

		this._totalSyncedThisSync = 0;
		this._recordsCreated = 0;
		this._recordsUpdated = 0;

		const tmpSyncState = (
			{
				Local: { MaxIDEntity: -1, RecordCount: 0 },
				Server: { MaxIDEntity: -1, RecordCount: 0 },
			});

		this._hasUpdateDate = false;
		this._hasDeletedColumn = false;

		if (this.EntitySchema && this.EntitySchema.MeadowSchema && Array.isArray(this.EntitySchema.MeadowSchema.Schema))
		{
			for (let i = 0; i < this.EntitySchema.MeadowSchema.Schema.length; i++)
			{
				const tmpColumn = this.EntitySchema.MeadowSchema.Schema[i];
				if (tmpColumn.Column == 'UpdateDate')
				{
					this._hasUpdateDate = true;
				}
				if (tmpColumn.Type == 'Deleted' || tmpColumn.Column == 'Deleted')
				{
					this._hasDeletedColumn = true;
				}
			}
		}

		this.fable.log.info(`Syncing with COMPARISON ONLY STRATEGY entity ${this.EntitySchema.TableName} (UpdateDate: ${this._hasUpdateDate})...`);

		this.ComparisonReport = {
			Entity: this.EntitySchema.TableName,
			Timestamp: new Date().toISOString(),
			Summary: {
				LocalRecordCount: 0,
				ServerRecordCount: 0,
				LocalMaxID: 0,
				ServerMaxID: 0,
				TotalRangesChecked: 0,
				MatchingRanges: 0,
				MismatchedRanges: 0,
				ErrorRanges: 0,
				TotalCountDifference: 0
			},
			Ranges: []
		};

		this.fable.Utility.waterfall(
			[
				// ---- Stage 1: Gather local stats ----
				(fStageComplete) =>
				{
					const tmpQuery = this.Meadow.query;
					tmpQuery.setSort({ Column: this.DefaultIdentifier, Direction: 'Descending' });
					tmpQuery.setCap(1);
					if (!this._hasDeletedColumn)
					{
						tmpQuery.setDisableDeleteTracking(true);
					}
					this.Meadow.doRead(tmpQuery,
						(pReadError, pQuery, pRecord) =>
						{
							if (pReadError)
							{
								this.fable.log.error(`Error reading local max entity ID ${this.EntitySchema.TableName}: ${pReadError}`);
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
					const tmpQuery = this.Meadow.query;
					if (!this._hasDeletedColumn)
					{
						tmpQuery.setDisableDeleteTracking(true);
					}
					this.Meadow.doCount(tmpQuery,
						(pCountError, pQuery, pCount) =>
						{
							if (pCountError)
							{
								this.fable.log.error(`Error getting local count of ${this.EntitySchema.TableName}: ${pCountError}`);
								return fStageComplete(`Error getting local count of ${this.EntitySchema.TableName}: ${pCountError}`);
							}
							tmpSyncState.Local.RecordCount = pCount;
							return fStageComplete();
						});
				},

				// ---- Stage 2: Gather server stats ----
				(fStageComplete) =>
				{
					this.fable.MeadowCloneRestClient.getJSON(`${this.EntitySchema.TableName}/Max/${this.DefaultIdentifier}`,
						(pError, pResponse, pBody) =>
						{
							if (pError)
							{
								this.fable.log.warn(`Could not get server max entity ID for ${this.EntitySchema.TableName} (${pError}).`);
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
					this._getServerCount(null,
						(pError, pCount) =>
						{
							if (pError)
							{
								this.fable.log.warn(`Could not get server count for ${this.EntitySchema.TableName} (${pError}); estimating from max ID.`);
								tmpSyncState.Server.RecordCount = tmpSyncState.Server.MaxIDEntity > 0 ? tmpSyncState.Server.MaxIDEntity : 0;
								return fStageComplete();
							}
							tmpSyncState.Server.RecordCount = pCount;
							return fStageComplete();
						});
				},

				// Create progress tracker
				(fStageComplete) =>
				{
					let tmpTrackerTotal = Math.max(tmpSyncState.Server.RecordCount, tmpSyncState.Local.RecordCount);
					this.operation.createProgressTracker(tmpTrackerTotal, `FullSync-${this.EntitySchema.TableName}`);
					return fStageComplete();
				},

				// ---- Stage 3: Comparison bisection ----
				(fStageComplete) =>
				{
					const tmpMaxID = Math.max(tmpSyncState.Local.MaxIDEntity, tmpSyncState.Server.MaxIDEntity);

					if (tmpMaxID < 1)
					{
						this.fable.log.info(`${this.EntitySchema.TableName}: no records on either side; nothing to compare.`);
						return fStageComplete();
					}

					this.fable.log.info(`${this.EntitySchema.TableName}: starting comparison bisection (ID range 1-${tmpMaxID})...`);

					this._compareRange(1, tmpMaxID, 0, this.ComparisonReport, fStageComplete);
				},
			],
			(pError) =>
			{
				if (pError)
				{
					this.fable.log.error(`Error performing comparison sync ${this.EntitySchema.TableName}: ${pError}`, { Error: pError });
				}

				let tmpTracker = this.operation.progressTrackers[`FullSync-${this.EntitySchema.TableName}`];
				if (tmpTracker)
				{
					tmpTracker.CurrentCount = tmpTracker.TotalCount;
				}

				// Finalize report summary
				this.ComparisonReport.Summary.LocalRecordCount = tmpSyncState.Local.RecordCount;
				this.ComparisonReport.Summary.ServerRecordCount = tmpSyncState.Server.RecordCount;
				this.ComparisonReport.Summary.LocalMaxID = tmpSyncState.Local.MaxIDEntity;
				this.ComparisonReport.Summary.ServerMaxID = tmpSyncState.Server.MaxIDEntity;
				this.ComparisonReport.Summary.TotalRangesChecked = this.ComparisonReport.Ranges.length;

				let tmpTotalCountDifference = 0;
				for (let i = 0; i < this.ComparisonReport.Ranges.length; i++)
				{
					const tmpRange = this.ComparisonReport.Ranges[i];
					if (tmpRange.Status === 'match')
					{
						this.ComparisonReport.Summary.MatchingRanges++;
					}
					else if (tmpRange.Status === 'mismatch')
					{
						this.ComparisonReport.Summary.MismatchedRanges++;
						tmpTotalCountDifference += Math.abs(tmpRange.CountDifference || 0);
					}
					else if (tmpRange.Status === 'error')
					{
						this.ComparisonReport.Summary.ErrorRanges++;
					}
				}
				this.ComparisonReport.Summary.TotalCountDifference = tmpTotalCountDifference;

				this.fable.log.info(`${this.EntitySchema.TableName}: comparison complete -- ${this.ComparisonReport.Summary.MatchingRanges} matching, ${this.ComparisonReport.Summary.MismatchedRanges} mismatched out of ${this.ComparisonReport.Summary.TotalRangesChecked} ranges.`);

				this.syncResults = {
					Created: 0,
					Updated: 0,
					Deleted: 0,
					ServerRecordCount: tmpSyncState.Server.RecordCount,
					LocalRecordCount: tmpSyncState.Local.RecordCount,
					ComparisonReport: this.ComparisonReport
				};

				// No deleted record sync for comparison-only mode
				return fCallback();
			});
	}
}

module.exports = MeadowSyncEntityComparisonOnly;
