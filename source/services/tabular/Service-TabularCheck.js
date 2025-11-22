const libFableService = require('fable-serviceproviderbase');

class MeadowIntegrationTabularCheck extends libFableService
{
	constructor(pFable, pManifest, pServiceHash)
	{
		super(pFable, pManifest, pServiceHash);
	}

	/**
	 * Create a new statistics container object
	 * @param {string} pTabularDatasetName 
	 */
	newStatisticsObject(pTabularDatasetName)
	{
		const tmpStatistics =(
			{
				DataSet: pTabularDatasetName,
				FirstRow: null,
				RowCount: 0,
				LastRow: null,
				Headers: [],
				ColumnCount: 0,
				ColumnStatistics: {},
				Records: null
			});
		return tmpStatistics;
	}

	/**
	 * Collect statistics on a set of records.
	 * 
	 * It is left up to the consumer of this class to make sure each record is only sent through once.
	 * 
	 * @param {Object} tmpStatisticsObject 
	 * @param {Object} pRecord 
	 * @param {boolean} pStoreFullRecord 
	 * 
	 * @returns {Object} The statistics object that this record affected
	 */
	collectStatistics(pRecord, pStatisticsObject, pStoreFullRecord = false)
	{
		let tmpStatisticsObject = (typeof(pStatisticsObject) === 'object') ? pStatisticsObject : this.newStatisticsObject(`Unknown-${this.fable.getUUID()}`);

		if (pRecord)
		{
			tmpStatisticsObject.RowCount++;

			if (tmpStatisticsObject.FirstRow === null)
			{
				tmpStatisticsObject.FirstRow = pRecord;
			}
			tmpStatisticsObject.LastRow = pRecord;

			let tmpKeys = Object.keys(pRecord);
			for (let i = 0; i < tmpKeys.length; i++)
			{
				let tmpKey = tmpKeys[i];
				if (!(tmpKey in tmpStatisticsObject.ColumnStatistics))
				{
					tmpStatisticsObject.ColumnCount++;
					tmpStatisticsObject.ColumnStatistics[tmpKey] = { Count: 0, EmptyCount: 0, NumericCount: 0, FirstValue: null, LastValue: null };
					tmpStatisticsObject.Headers.push(tmpKey);
				}
				tmpStatisticsObject.ColumnStatistics[tmpKey].Count++;
				if (tmpStatisticsObject.ColumnStatistics[tmpKey].FirstValue === null)
				{
					tmpStatisticsObject.ColumnStatistics[tmpKey].FirstValue = pRecord[tmpKey];
				}
				tmpStatisticsObject.ColumnStatistics[tmpKey].LastValue = pRecord[tmpKey];
				if ((pRecord[tmpKey] === null) || (pRecord[tmpKey] === ''))
				{
					tmpStatisticsObject.ColumnStatistics[tmpKey].EmptyCount++;
				}
				if (!isNaN(this.fable.Math.parsePrecise(pRecord[tmpKey], NaN)))
				{
					tmpStatisticsObject.ColumnStatistics[tmpKey].NumericCount++;
				}
				if (pStoreFullRecord)
				{
					tmpStatisticsObject.Records.push(pRecord)
				}
			}
		}

		return tmpStatisticsObject;
	}
}

module.exports = MeadowIntegrationTabularCheck;