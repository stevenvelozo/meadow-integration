const libFS = require('fs');
const libPath = require('path');
const libReadline = require('readline');

/**
 * POST /1.0/CSV/Transform
 *
 * Transform a CSV file into a comprehension.
 *
 * Request body (JSON):
 * {
 *   "File": "/absolute/path/to/file.csv",            // The CSV file to transform
 *   "Entity": "MyEntity",                             // (optional) Entity name
 *   "GUIDName": "GUIDMyEntity",                       // (optional) GUID column name
 *   "GUIDTemplate": "{~D:Record.id~}",                // (optional) Pict template for GUID
 *   "Mappings": { "Col1": "{~D:Record.col1~}" },      // (optional) Column mappings object
 *   "MappingConfiguration": { ... },                  // (optional) Full explicit mapping config
 *   "IncomingComprehension": { ... },                 // (optional) Existing comprehension to merge into
 *   "Extended": false,                                // (optional) Return full operation state
 *   "QuoteDelimiter": "\""                            // (optional) Quote delimiter character
 * }
 *
 * Response: Comprehension JSON (or extended state if Extended=true)
 */
module.exports = function(pFable, pOrator)
{
	pOrator.serviceServer.postWithBodyParser('/1.0/CSV/Transform',
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

			// Create a fresh CSVParser for each request to reset header state
			let tmpCSVParser = pFable.instantiateServiceProviderWithoutRegistration('CSVParser');

			if (tmpBody.QuoteDelimiter)
			{
				tmpCSVParser.QuoteCharacter = tmpBody.QuoteDelimiter;
			}

			let tmpMappingOutcome = pFable.MeadowIntegrationTabularTransform.newMappingOutcomeObject();

			// Apply user configuration from request body
			if (tmpBody.Entity)
			{
				tmpMappingOutcome.UserConfiguration.Entity = tmpBody.Entity;
			}
			if (tmpBody.GUIDName)
			{
				tmpMappingOutcome.UserConfiguration.GUIDName = tmpBody.GUIDName;
			}
			if (tmpBody.GUIDTemplate)
			{
				tmpMappingOutcome.UserConfiguration.GUIDTemplate = tmpBody.GUIDTemplate;
			}
			if (tmpBody.Mappings && (typeof(tmpBody.Mappings) === 'object'))
			{
				tmpMappingOutcome.UserConfiguration.Mappings = tmpBody.Mappings;
			}

			// Apply explicit mapping configuration
			if (tmpBody.MappingConfiguration && (typeof(tmpBody.MappingConfiguration) === 'object'))
			{
				tmpMappingOutcome.ExplicitConfiguration = tmpBody.MappingConfiguration;
			}

			// Apply incoming comprehension
			if (tmpBody.IncomingComprehension && (typeof(tmpBody.IncomingComprehension) === 'object'))
			{
				tmpMappingOutcome.ExistingComprehension = tmpBody.IncomingComprehension;
				tmpMappingOutcome.Comprehension = JSON.parse(JSON.stringify(tmpBody.IncomingComprehension));
			}

			const tmpReadline = libReadline.createInterface(
				{
					input: libFS.createReadStream(tmpInputFilePath),
					crlfDelay: Infinity,
				});

			tmpReadline.on('line',
				(pLine) =>
				{
					const tmpIncomingRecord = tmpCSVParser.parseCSVLine(pLine);
					tmpMappingOutcome.ParsedRowCount++;

					if (tmpIncomingRecord)
					{
						if (!tmpMappingOutcome.ImplicitConfiguration)
						{
							tmpMappingOutcome.ImplicitConfiguration = pFable.MeadowIntegrationTabularTransform.generateMappingConfigurationPrototype(libPath.basename(tmpInputFilePath), tmpIncomingRecord);

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
							for (let i = 0; i < tmpMappingOutcome.Configuration.Solvers.length; i++)
							{
								let tmpSolver = tmpMappingOutcome.Configuration.Solvers[i];
								pFable.ExpressionParser.solve(tmpSolver, tmpMappingRecordSolution, tmpSolverResultsObject, pFable.manifest, tmpMappingRecordSolution);
							}
						}

						if (tmpMappingOutcome.Configuration.MultipleGUIDUniqueness && tmpMappingRecordSolution.NewRecordsGUIDUniqueness.length > 0)
						{
							for (let i = 0; i < tmpMappingRecordSolution.NewRecordsGUIDUniqueness.length; i++)
							{
								pFable.MeadowIntegrationTabularTransform.addRecordToComprehension(tmpIncomingRecord, tmpMappingOutcome, tmpMappingRecordSolution.NewRecordPrototype, tmpMappingRecordSolution.NewRecordsGUIDUniqueness[i]);
							}
						}
						else if (!tmpMappingOutcome.Configuration.MultipleGUIDUniqueness)
						{
							pFable.MeadowIntegrationTabularTransform.addRecordToComprehension(tmpIncomingRecord, tmpMappingOutcome, tmpMappingRecordSolution.NewRecordPrototype);
						}
					}
				});

			tmpReadline.on('close',
				() =>
				{
					pFable.log.info(`CSV Transform: Parsed ${tmpMappingOutcome.ParsedRowCount} rows from [${tmpInputFilePath}].`);
					if (tmpBody.Extended)
					{
						pResponse.send(200, tmpMappingOutcome);
					}
					else
					{
						pResponse.send(200, tmpMappingOutcome.Comprehension);
					}
					return fNext();
				});

			tmpReadline.on('error',
				(pError) =>
				{
					pFable.log.error(`CSV Transform error reading file [${tmpInputFilePath}]: ${pError}`, pError);
					pResponse.send(500, { Error: `Error reading CSV file: ${pError.message}` });
					return fNext();
				});
		});
};
