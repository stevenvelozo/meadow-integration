const libFableService = require('fable-serviceproviderbase');

class MeadowIntegrationTabularCheck extends libFableService
{
	constructor(pFable, pManifest, pServiceHash)
	{
		super(pFable, pManifest, pServiceHash);
	}

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
	}

	/**
	 * Collect statistics on a record
	 * @param {*} pStatisticsObject 
	 * @param {*} pRecord 
	 * @param {*} pStoreFullRecord 
	 */
	collectStatistics(pStatisticsObject, pRecord, pStoreFullRecord)
	{
		if (pRecord)
		{
			tmpStatistics.RowCount++;

			if (tmpStatistics.FirstRow === null)
			{
				tmpStatistics.FirstRow = pRecord;
			}
			tmpStatistics.LastRow = pRecord;

			let tmpKeys = Object.keys(pRecord);
			for (let i = 0; i < tmpKeys.length; i++)
			{
				let tmpKey = tmpKeys[i];
				if (!(tmpKey in tmpStatistics.ColumnStatistics))
				{
					tmpStatistics.ColumnCount++;
					tmpStatistics.ColumnStatistics[tmpKey] = { Count: 0, EmptyCount: 0, NumericCount: 0, FirstValue: null, LastValue: null };
					tmpStatistics.Headers.push(tmpKey);
				}
				tmpStatistics.ColumnStatistics[tmpKey].Count++;
				if (tmpStatistics.ColumnStatistics[tmpKey].FirstValue === null)
				{
					tmpStatistics.ColumnStatistics[tmpKey].FirstValue = pRecord[tmpKey];
				}
				tmpStatistics.ColumnStatistics[tmpKey].LastValue = pRecord[tmpKey];
				if ((pRecord[tmpKey] === null) || (pRecord[tmpKey] === ''))
				{
					tmpStatistics.ColumnStatistics[tmpKey].EmptyCount++;
				}
				if (this.fable.Math.parsePrecise(pRecord[tmpKey], NaN) !== NaN)
				{
					tmpStatistics.ColumnStatistics[tmpKey].NumericCount++;
				}
				if (pStoreFullRecord)
				{
					tmpStatistics.Records.push(pRecord)
				}
			}
			tmpRecords.push(pRecord);
		}
	}
}

module.exports = MeadowIntegrationTabularCheck;