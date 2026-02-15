const libPath = require('path');

/**
 * POST /1.0/JSONArray/Transform
 *
 * Transform a JSON Array file into a comprehension.
 *
 * Request body (JSON):
 * {
 *   "File": "/absolute/path/to/file.json",            // The JSON array file to transform
 *   "Entity": "MyEntity",                              // (optional) Entity name
 *   "GUIDName": "GUIDMyEntity",                        // (optional) GUID column name
 *   "GUIDTemplate": "{~D:Record.id~}",                 // (optional) Pict template for GUID
 *   "Mappings": { "Col1": "{~D:Record.col1~}" },       // (optional) Column mappings object
 *   "MappingConfiguration": { ... },                   // (optional) Full explicit mapping config
 *   "IncomingComprehension": { ... },                  // (optional) Existing comprehension to merge into
 *   "Extended": false                                  // (optional) Return full operation state
 * }
 *
 * OR send a JSON array directly:
 *
 * POST /1.0/JSONArray/TransformRecords
 * {
 *   "Records": [ {...}, {...}, ... ],                   // The JSON array of records
 *   "Entity": "MyEntity",                              // (optional) Entity name
 *   ...same options as above...
 * }
 *
 * Response: Comprehension JSON (or extended state if Extended=true)
 */
module.exports = function(pFable, pOrator)
{
	// File-based transform
	pOrator.serviceServer.postWithBodyParser('/1.0/JSONArray/Transform',
		(pRequest, pResponse, fNext) =>
		{
			let tmpBody = pRequest.body || {};

			if (!tmpBody.File || (typeof(tmpBody.File) !== 'string'))
			{
				pResponse.send(400, { Error: 'No valid File path provided in request body.' });
				return fNext();
			}

			pFable.instantiateServiceProvider('FilePersistence');
			pFable.addAndInstantiateServiceTypeIfNotExists('MeadowIntegrationTabularTransform', require('../../services/tabular/Service-TabularTransform.js'));

			let tmpInputFilePath = pFable.FilePersistence.resolvePath(tmpBody.File);

			if (!pFable.FilePersistence.existsSync(tmpInputFilePath))
			{
				pResponse.send(404, { Error: `File [${tmpInputFilePath}] does not exist.` });
				return fNext();
			}

			let tmpJSONArrayRecords;
			try
			{
				let tmpRawContents = pFable.FilePersistence.readFileSync(tmpInputFilePath, { encoding: 'utf8' });
				tmpJSONArrayRecords = JSON.parse(tmpRawContents);
			}
			catch (pError)
			{
				pResponse.send(400, { Error: `Error parsing JSON file [${tmpInputFilePath}]: ${pError.message}` });
				return fNext();
			}

			if (!Array.isArray(tmpJSONArrayRecords))
			{
				pResponse.send(400, { Error: `File [${tmpInputFilePath}] does not contain a valid JSON array.` });
				return fNext();
			}

			let tmpResult = processJSONArrayTransform(pFable, tmpBody, tmpJSONArrayRecords, libPath.basename(tmpInputFilePath));
			if (tmpResult.Error)
			{
				pResponse.send(400, tmpResult);
				return fNext();
			}

			if (tmpBody.Extended)
			{
				pResponse.send(200, tmpResult.MappingOutcome);
			}
			else
			{
				pResponse.send(200, tmpResult.MappingOutcome.Comprehension);
			}
			return fNext();
		});

	// In-memory records transform (no file needed)
	pOrator.serviceServer.postWithBodyParser('/1.0/JSONArray/TransformRecords',
		(pRequest, pResponse, fNext) =>
		{
			let tmpBody = pRequest.body || {};

			if (!tmpBody.Records || !Array.isArray(tmpBody.Records))
			{
				pResponse.send(400, { Error: 'No valid Records array provided in request body.' });
				return fNext();
			}

			if (tmpBody.Records.length < 1)
			{
				pResponse.send(400, { Error: 'Records array is empty.' });
				return fNext();
			}

			pFable.addAndInstantiateServiceTypeIfNotExists('MeadowIntegrationTabularTransform', require('../../services/tabular/Service-TabularTransform.js'));

			let tmpDatasetName = tmpBody.Entity || 'Records';
			let tmpResult = processJSONArrayTransform(pFable, tmpBody, tmpBody.Records, tmpDatasetName);
			if (tmpResult.Error)
			{
				pResponse.send(400, tmpResult);
				return fNext();
			}

			if (tmpBody.Extended)
			{
				pResponse.send(200, tmpResult.MappingOutcome);
			}
			else
			{
				pResponse.send(200, tmpResult.MappingOutcome.Comprehension);
			}
			return fNext();
		});
};

function processJSONArrayTransform(pFable, pOptions, pRecords, pDatasetName)
{
	let tmpMappingOutcome = pFable.MeadowIntegrationTabularTransform.newMappingOutcomeObject();

	// Apply user configuration
	if (pOptions.Entity)
	{
		tmpMappingOutcome.UserConfiguration.Entity = pOptions.Entity;
	}
	if (pOptions.GUIDName)
	{
		tmpMappingOutcome.UserConfiguration.GUIDName = pOptions.GUIDName;
	}
	if (pOptions.GUIDTemplate)
	{
		tmpMappingOutcome.UserConfiguration.GUIDTemplate = pOptions.GUIDTemplate;
	}
	if (pOptions.Mappings && (typeof(pOptions.Mappings) === 'object'))
	{
		tmpMappingOutcome.UserConfiguration.Mappings = pOptions.Mappings;
	}

	// Apply explicit mapping configuration
	if (pOptions.MappingConfiguration && (typeof(pOptions.MappingConfiguration) === 'object'))
	{
		tmpMappingOutcome.ExplicitConfiguration = pOptions.MappingConfiguration;
	}

	// Apply incoming comprehension
	if (pOptions.IncomingComprehension && (typeof(pOptions.IncomingComprehension) === 'object'))
	{
		tmpMappingOutcome.ExistingComprehension = pOptions.IncomingComprehension;
		tmpMappingOutcome.Comprehension = JSON.parse(JSON.stringify(pOptions.IncomingComprehension));
	}

	for (let i = 0; i < pRecords.length; i++)
	{
		const tmpIncomingRecord = pRecords[i];
		tmpMappingOutcome.ParsedRowCount++;

		if (tmpIncomingRecord)
		{
			if (!tmpMappingOutcome.ImplicitConfiguration)
			{
				tmpMappingOutcome.ImplicitConfiguration = pFable.MeadowIntegrationTabularTransform.generateMappingConfigurationPrototype(pDatasetName, tmpIncomingRecord);

				if ((!tmpMappingOutcome.ExplicitConfiguration) || (typeof(tmpMappingOutcome.ExplicitConfiguration) != 'object'))
				{
					tmpMappingOutcome.Configuration = Object.assign({}, tmpMappingOutcome.ImplicitConfiguration, tmpMappingOutcome.UserConfiguration);
				}
				else
				{
					tmpMappingOutcome.Configuration = Object.assign({}, tmpMappingOutcome.ImplicitConfiguration, tmpMappingOutcome.ExplicitConfiguration, tmpMappingOutcome.UserConfiguration);
				}

				if (!('GUIDName' in tmpMappingOutcome.Configuration))
				{
					tmpMappingOutcome.Configuration.GUIDName = `GUID${tmpMappingOutcome.Configuration.Entity}`;
				}

				if (!(tmpMappingOutcome.Configuration.Entity in tmpMappingOutcome.Comprehension))
				{
					tmpMappingOutcome.Comprehension[tmpMappingOutcome.Configuration.Entity] = {};
				}
			}

			let tmpMappingRecordSolution = (
				{
					IncomingRecord: tmpIncomingRecord,
					MappingConfiguration: tmpMappingOutcome.Configuration,
					MappingOutcome: tmpMappingOutcome,
					RowIndex: tmpMappingOutcome.ParsedRowCount,
					NewRecordsGUIDUniqueness: [],
					NewRecordPrototype: {},
					Fable: pFable,
					Pict: pFable,
					AppData: pFable.AppData
				});

			// Run the solvers for this record
			let tmpSolverResultsObject = {};
			if (tmpMappingOutcome.Configuration.Solvers && Array.isArray(tmpMappingOutcome.Configuration.Solvers))
			{
				for (let j = 0; j < tmpMappingOutcome.Configuration.Solvers.length; j++)
				{
					let tmpSolver = tmpMappingOutcome.Configuration.Solvers[j];
					pFable.ExpressionParser.solve(tmpSolver, tmpMappingRecordSolution, tmpSolverResultsObject, pFable.manifest, tmpMappingRecordSolution);
				}
			}

			if (tmpMappingOutcome.Configuration.MultipleGUIDUniqueness && tmpMappingRecordSolution.NewRecordsGUIDUniqueness.length > 0)
			{
				for (let j = 0; j < tmpMappingRecordSolution.NewRecordsGUIDUniqueness.length; j++)
				{
					pFable.MeadowIntegrationTabularTransform.addRecordToComprehension(tmpIncomingRecord, tmpMappingOutcome, tmpMappingRecordSolution.NewRecordPrototype, tmpMappingRecordSolution.NewRecordsGUIDUniqueness[j]);
				}
			}
			else if (!tmpMappingOutcome.Configuration.MultipleGUIDUniqueness)
			{
				pFable.MeadowIntegrationTabularTransform.addRecordToComprehension(tmpIncomingRecord, tmpMappingOutcome, tmpMappingRecordSolution.NewRecordPrototype);
			}
		}
	}

	pFable.log.info(`JSON Array Transform: Parsed ${tmpMappingOutcome.ParsedRowCount} records from [${pDatasetName}].`);
	return { MappingOutcome: tmpMappingOutcome };
}
