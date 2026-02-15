const libFS = require('fs');
const libPath = require('path');
const libReadline = require('readline');

/**
 * POST /1.0/TSV/Check
 *
 * Analyze a TSV file for statistics.
 *
 * Request body (JSON):
 * {
 *   "File": "/absolute/path/to/file.tsv",     // The TSV file to analyze
 *   "Records": false,                          // (optional) Include full record dump
 *   "QuoteDelimiter": "\""                     // (optional) Quote delimiter character
 * }
 *
 * Response: JSON statistics object
 */
module.exports = function(pFable, pOrator)
{
	pOrator.serviceServer.postWithBodyParser('/1.0/TSV/Check',
		(pRequest, pResponse, fNext) =>
		{
			let tmpBody = pRequest.body || {};

			if (!tmpBody.File || (typeof(tmpBody.File) !== 'string'))
			{
				pResponse.send(400, { Error: 'No valid File path provided in request body.' });
				return fNext();
			}

			pFable.instantiateServiceProvider('FilePersistence');
			pFable.addAndInstantiateServiceTypeIfNotExists('MeadowIntegrationTabularCheck', require('../../services/tabular/Service-TabularCheck.js'));

			// Create a fresh CSVParser for each request to reset header state
			let tmpCSVParser = pFable.instantiateServiceProviderWithoutRegistration('CSVParser');

			// Configure for TSV
			tmpCSVParser.Delimiter = '\t';
			if (tmpBody.QuoteDelimiter)
			{
				tmpCSVParser.QuoteCharacter = tmpBody.QuoteDelimiter;
			}

			let tmpInputFilePath = pFable.FilePersistence.resolvePath(tmpBody.File);

			if (!pFable.FilePersistence.existsSync(tmpInputFilePath))
			{
				pResponse.send(404, { Error: `File [${tmpInputFilePath}] does not exist.` });
				return fNext();
			}

			let tmpStatistics = pFable.MeadowIntegrationTabularCheck.newStatisticsObject(tmpInputFilePath);
			let tmpStoreFullRecord = (tmpBody.Records === true);

			if (tmpStoreFullRecord)
			{
				tmpStatistics.Records = [];
			}

			const tmpReadline = libReadline.createInterface(
				{
					input: libFS.createReadStream(tmpInputFilePath),
					crlfDelay: Infinity,
				});

			tmpReadline.on('line',
				(pLine) =>
				{
					const tmpRecord = tmpCSVParser.parseCSVLine(pLine);
					if (tmpRecord)
					{
						pFable.MeadowIntegrationTabularCheck.collectStatistics(tmpRecord, tmpStatistics, tmpStoreFullRecord);
					}
				});

			tmpReadline.on('close',
				() =>
				{
					pFable.log.info(`TSV Check: ${tmpStatistics.RowCount} rows, ${tmpStatistics.ColumnCount} columns in [${tmpInputFilePath}].`);
					pResponse.send(200, tmpStatistics);
					return fNext();
				});

			tmpReadline.on('error',
				(pError) =>
				{
					pFable.log.error(`TSV Check error reading file [${tmpInputFilePath}]: ${pError}`, pError);
					pResponse.send(500, { Error: `Error reading TSV file: ${pError.message}` });
					return fNext();
				});
		});
};
