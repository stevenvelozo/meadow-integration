class MeadowOperation
{
	constructor(pFable)
	{
		this.log = pFable.log;

		this.timeStamps = {};
		this.progressTrackers = {};
	}

	createTimeStamp(pTimeStampHash)
	{
		const tmpTimeStampHash = (typeof(pTimeStampHash) == 'string') ? pTimeStampHash : 'Default';
		this.timeStamps[tmpTimeStampHash] = +new Date();
		return this.timeStamps[tmpTimeStampHash];
	}

	getTimeDelta(pTimeStampHash)
	{
		const tmpTimeStampHash = (typeof(pTimeStampHash) == 'string') ? pTimeStampHash : 'Default';
		if (this.timeStamps.hasOwnProperty(tmpTimeStampHash))
		{
			const tmpEndTime = +new Date();
			return tmpEndTime - this.timeStamps[tmpTimeStampHash];
		}
		else
		{
			return -1;
		}
	}

	logTimeDelta(pTimeStampHash, pMessage)
	{
		const tmpTimeStampHash = (typeof(pTimeStampHash) == 'string') ? pTimeStampHash : 'Default';
		const tmpMessage = (typeof(pMessage) !== 'undefined') ? pMessage : `Elapsed for ${tmpTimeStampHash}: `;
		const tmpOperationTime = this.getTimeDelta(pTimeStampHash);
		this.log.info(tmpMessage + ' (' + tmpOperationTime + 'ms)');
		return tmpOperationTime;
	}

	createProgressTracker(pTotalOperations, pProgressTrackerHash)
	{
		const tmpProgressTrackerHash = (typeof(pProgressTrackerHash) == 'string') ? pProgressTrackerHash : 'DefaultProgressTracker';
		const tmpTotalOperations = (typeof(pTotalOperations) == 'number') ? pTotalOperations : 100;

		const tmpProgressTracker = (
			{
				Hash: tmpProgressTrackerHash,
				StartTime: this.createTimeStamp(tmpProgressTrackerHash),
				EndTime: 0,
				CurrentTime: 0,
				PercentComplete: -1,
				AverageOperationTime: -1,
				EstimatedCompletionTime: -1,
				TotalCount: tmpTotalOperations,
				CurrentCount: -1,
			});

		this.progressTrackers[tmpProgressTrackerHash] = tmpProgressTracker;

		return tmpProgressTracker;
	}

	solveProgressTrackerStatus(pProgressTrackerHash)
	{
		const tmpProgressTrackerHash = (typeof(pProgressTrackerHash) == 'string') ? pProgressTrackerHash : 'DefaultProgressTracker';

		if (!this.progressTrackers.hasOwnProperty(tmpProgressTrackerHash))
		{
			this.createProgressTracker(100, tmpProgressTrackerHash);
		}

		const tmpProgressTracker = this.progressTrackers[tmpProgressTrackerHash];

		tmpProgressTracker.CurrentTime = this.getTimeDelta(tmpProgressTracker.Hash);

		if ((tmpProgressTracker.CurrentCount > 0) && (tmpProgressTracker.TotalCount > 0))
		{
			tmpProgressTracker.PercentComplete = (tmpProgressTracker.CurrentCount / tmpProgressTracker.TotalCount) * 100.0;
		}

		if ((tmpProgressTracker.CurrentCount > 0) && (tmpProgressTracker.CurrentTime > 0))
		{
			tmpProgressTracker.AverageOperationTime = tmpProgressTracker.CurrentTime / tmpProgressTracker.CurrentCount;
		}

		if ((tmpProgressTracker.CurrentCount < tmpProgressTracker.TotalCount) && (tmpProgressTracker.AverageOperationTime > 0))
		{
			tmpProgressTracker.EstimatedCompletionTime = (tmpProgressTracker.TotalCount - tmpProgressTracker.CurrentCount) * tmpProgressTracker.AverageOperationTime;
		}
	}

	updateProgressTrackerStatus(pProgressTrackerHash, pCurrentOperations)
	{
		const tmpProgressTrackerHash = (typeof(pProgressTrackerHash) == 'string') ? pProgressTrackerHash : 'DefaultProgressTracker';
		const tmpCurrentOperations = parseInt(pCurrentOperations);

		if (isNaN(tmpCurrentOperations))
		{
			return false;
		}

		if (!this.progressTrackers.hasOwnProperty(tmpProgressTrackerHash))
		{
			this.createProgressTracker(100, tmpProgressTrackerHash);
		}

		this.progressTrackers[tmpProgressTrackerHash].CurrentCount = tmpCurrentOperations;
		this.progressTrackers[tmpProgressTrackerHash].CurrentTime = this.getTimeDelta(tmpProgressTrackerHash);

		this.solveProgressTrackerStatus(tmpProgressTrackerHash);

		return this.progressTrackers[tmpProgressTrackerHash];
	}

	incrementProgressTrackerStatus(pProgressTrackerHash, pIncrementSize)
	{
		const tmpProgressTrackerHash = (typeof(pProgressTrackerHash) == 'string') ? pProgressTrackerHash : 'DefaultProgressTracker';
		const tmpIncrementSize = parseInt(pIncrementSize);

		if (isNaN(tmpIncrementSize))
		{
			return false;
		}

		if (!this.progressTrackers.hasOwnProperty(tmpProgressTrackerHash))
		{
			this.createProgressTracker(100, tmpProgressTrackerHash);
		}

		this.progressTrackers[tmpProgressTrackerHash].CurrentCount = this.progressTrackers[tmpProgressTrackerHash].CurrentCount + tmpIncrementSize;
		this.progressTrackers[tmpProgressTrackerHash].CurrentTime = this.getTimeDelta(tmpProgressTrackerHash);

		this.solveProgressTrackerStatus(tmpProgressTrackerHash);

		return this.progressTrackers[tmpProgressTrackerHash];
	}

	setProgressTrackerEndTime(pProgressTrackerHash, pCurrentOperations)
	{
		const tmpProgressTrackerHash = (typeof(pProgressTrackerHash) == 'string') ? pProgressTrackerHash : 'DefaultProgressTracker';
		const tmpCurrentOperations = parseInt(pCurrentOperations);

		if (!this.progressTrackers.hasOwnProperty(tmpProgressTrackerHash))
		{
			return false;
		}
		if (!isNaN(tmpCurrentOperations))
		{
			this.updateProgressTrackerStatus(tmpProgressTrackerHash, tmpCurrentOperations);
		}

		this.progressTrackers[tmpProgressTrackerHash].EndTime = this.getTimeDelta(tmpProgressTrackerHash);

		this.solveProgressTrackerStatus(tmpProgressTrackerHash);

		return this.progressTrackers[tmpProgressTrackerHash];
	}

	printProgressTrackerStatus(pProgressTrackerHash)
	{
		const tmpProgressTrackerHash = (typeof(pProgressTrackerHash) == 'string') ? pProgressTrackerHash : 'DefaultProgressTracker';

		if (!this.progressTrackers.hasOwnProperty(tmpProgressTrackerHash))
		{
			this.log.info(`>> Progress Tracker ${tmpProgressTrackerHash} does not exist!  No stats to display.`);
		}
		else
		{
			const tmpProgressTracker = this.progressTrackers[tmpProgressTrackerHash];

			if (tmpProgressTracker.CurrentCount < 1)
			{
				this.log.info(`>> Progress Tracker ${tmpProgressTracker.Hash} has no completed operations.  ${tmpProgressTracker.CurrentTime}ms have elapsed since it was started.`);
			}
			else if (tmpProgressTracker.EndTime < 1)
			{
				this.log.info(`>> Progress Tracker ${tmpProgressTracker.Hash} is ${tmpProgressTracker.PercentComplete.toFixed(3)}% completed` +
					` - ${tmpProgressTracker.CurrentCount} / ${tmpProgressTracker.TotalCount} operations over ${tmpProgressTracker.CurrentTime}ms ` +
					`(median ${tmpProgressTracker.AverageOperationTime.toFixed(3)} per).  Estimated completion in ${tmpProgressTracker.EstimatedCompletionTime.toFixed(0)}ms or ${(tmpProgressTracker.EstimatedCompletionTime / 1000 / 60).toFixed(2)} minutes`);
			}
			else
			{
				this.log.info(`>> Progress Tracker ${tmpProgressTracker.Hash} is done and completed ${tmpProgressTracker.CurrentCount} / ${tmpProgressTracker.TotalCount} operations in ${tmpProgressTracker.EndTime}ms.`);
			}
		}
	}

	logMemoryResourcesUsed()
	{
		const tmpResourcesUsed = process.memoryUsage().heapUsed / 1024 / 1024;
		this.log.info(`Memory usage at ${Math.round(tmpResourcesUsed * 100) / 100} MB`);
	}
}

module.exports = MeadowOperation;
