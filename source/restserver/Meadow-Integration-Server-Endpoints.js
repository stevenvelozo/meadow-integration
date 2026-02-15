/**
 * Meadow Integration Server - Endpoint Registration
 *
 * Registers all REST API endpoints with the Orator service server.
 *
 * Endpoint Summary:
 *
 * --- Status ---
 * GET  /1.0/Status                             Server status and available endpoints
 *
 * --- CSV Operations ---
 * POST /1.0/CSV/Check                          Analyze a CSV file for statistics
 * POST /1.0/CSV/Transform                      Transform a CSV file into a comprehension
 *
 * --- TSV Operations ---
 * POST /1.0/TSV/Check                          Analyze a TSV file for statistics
 * POST /1.0/TSV/Transform                      Transform a TSV file into a comprehension
 *
 * --- JSON Array Operations ---
 * POST /1.0/JSONArray/Transform                Transform a JSON Array file into a comprehension
 * POST /1.0/JSONArray/TransformRecords         Transform an in-memory JSON array into a comprehension
 *
 * --- Comprehension Operations ---
 * POST /1.0/Comprehension/Intersect            Merge two comprehension objects (in-memory)
 * POST /1.0/Comprehension/IntersectFiles       Merge two comprehension files
 * POST /1.0/Comprehension/ToArray              Convert comprehension to array (in-memory)
 * POST /1.0/Comprehension/ToArrayFromFile      Convert comprehension file to array
 * POST /1.0/Comprehension/ToCSV               Convert comprehension/array to CSV (in-memory)
 * POST /1.0/Comprehension/ToCSVFromFile        Convert comprehension/array file to CSV
 * POST /1.0/Comprehension/Push                 Push comprehension to Meadow REST APIs (in-memory)
 * POST /1.0/Comprehension/PushFile             Push comprehension file to Meadow REST APIs
 *
 * --- Entity Generation ---
 * POST /1.0/Entity/FromTabularFolder           Generate comprehensions from a folder of tabular files
 */

module.exports.connectRoutes = function(pFable, pOrator)
{
	// Status endpoint
	pOrator.serviceServer.get('/1.0/Status',
		(pRequest, pResponse, fNext) =>
		{
			pResponse.send(200,
				{
					Product: pFable.settings.Product,
					Version: pFable.settings.ProductVersion || require('../../package.json').version,
					Status: 'Running',
					Endpoints:
						[
							'POST /1.0/CSV/Check',
							'POST /1.0/CSV/Transform',
							'POST /1.0/TSV/Check',
							'POST /1.0/TSV/Transform',
							'POST /1.0/JSONArray/Transform',
							'POST /1.0/JSONArray/TransformRecords',
							'POST /1.0/Comprehension/Intersect',
							'POST /1.0/Comprehension/IntersectFiles',
							'POST /1.0/Comprehension/ToArray',
							'POST /1.0/Comprehension/ToArrayFromFile',
							'POST /1.0/Comprehension/ToCSV',
							'POST /1.0/Comprehension/ToCSVFromFile',
							'POST /1.0/Comprehension/Push',
							'POST /1.0/Comprehension/PushFile',
							'POST /1.0/Entity/FromTabularFolder'
						]
				});
			return fNext();
		});

	// Register all endpoint handlers
	require('./endpoints/Endpoint-CSVCheck.js')(pFable, pOrator);
	require('./endpoints/Endpoint-CSVTransform.js')(pFable, pOrator);
	require('./endpoints/Endpoint-TSVCheck.js')(pFable, pOrator);
	require('./endpoints/Endpoint-TSVTransform.js')(pFable, pOrator);
	require('./endpoints/Endpoint-JSONArrayTransform.js')(pFable, pOrator);
	require('./endpoints/Endpoint-ComprehensionIntersect.js')(pFable, pOrator);
	require('./endpoints/Endpoint-ComprehensionArray.js')(pFable, pOrator);
	require('./endpoints/Endpoint-ObjectArrayToCSV.js')(pFable, pOrator);
	require('./endpoints/Endpoint-ComprehensionPush.js')(pFable, pOrator);
	require('./endpoints/Endpoint-EntityFromTabularFolder.js')(pFable, pOrator);

	pFable.log.info(`Meadow Integration Server: ${15} REST endpoints registered.`);
};
