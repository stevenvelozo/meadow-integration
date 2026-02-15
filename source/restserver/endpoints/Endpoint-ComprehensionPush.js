const libPath = require('path');

const libIntegrationAdapter = require('../../Meadow-Service-Integration-Adapter.js');

/**
 * POST /1.0/Comprehension/Push
 *
 * Push a comprehension to Meadow REST APIs via the Integration Adapter.
 *
 * Request body (JSON):
 * {
 *   "Comprehension": { ... },                 // The comprehension object to push
 *   "GUIDPrefix": "INTG-",                    // (optional) GUID prefix for the comprehension push
 *   "EntityGUIDPrefix": "E-",                 // (optional) GUID prefix per entity
 *   "ServerURL": "http://localhost:8086/1.0/"  // (optional) Target Meadow API server URL
 * }
 *
 * OR file-based:
 *
 * POST /1.0/Comprehension/PushFile
 * {
 *   "File": "/path/to/comprehension.json",    // Comprehension file path
 *   "GUIDPrefix": "INTG-",                    // (optional) GUID prefix
 *   "EntityGUIDPrefix": "E-",                 // (optional) Entity GUID prefix
 *   "ServerURL": "http://localhost:8086/1.0/"  // (optional) Target Meadow API server URL
 * }
 *
 * Response: { "Success": true, "EntitiesPushed": [...], "Message": "..." }
 */
module.exports = function(pFable, pOrator)
{
	// In-memory push
	pOrator.serviceServer.postWithBodyParser('/1.0/Comprehension/Push',
		(pRequest, pResponse, fNext) =>
		{
			let tmpBody = pRequest.body || {};

			if (!tmpBody.Comprehension || (typeof(tmpBody.Comprehension) !== 'object'))
			{
				pResponse.send(400, { Error: 'No valid Comprehension object provided in request body.' });
				return fNext();
			}

			pushComprehension(pFable, tmpBody.Comprehension, tmpBody,
				(pError, pResult) =>
				{
					if (pError)
					{
						pResponse.send(500, { Error: `Error pushing comprehension: ${pError.message || pError}` });
						return fNext();
					}
					pResponse.send(200, pResult);
					return fNext();
				});
		});

	// File-based push
	pOrator.serviceServer.postWithBodyParser('/1.0/Comprehension/PushFile',
		(pRequest, pResponse, fNext) =>
		{
			let tmpBody = pRequest.body || {};

			if (!tmpBody.File || (typeof(tmpBody.File) !== 'string'))
			{
				pResponse.send(400, { Error: 'No valid File path provided in request body.' });
				return fNext();
			}

			pFable.instantiateServiceProvider('FilePersistence');

			let tmpFilePath = pFable.FilePersistence.resolvePath(tmpBody.File);

			if (!pFable.FilePersistence.existsSync(tmpFilePath))
			{
				pResponse.send(404, { Error: `File [${tmpFilePath}] does not exist.` });
				return fNext();
			}

			let tmpComprehension;
			try
			{
				tmpComprehension = JSON.parse(pFable.FilePersistence.readFileSync(tmpFilePath));
			}
			catch (pError)
			{
				pResponse.send(400, { Error: `Error parsing comprehension file: ${pError.message}` });
				return fNext();
			}

			pushComprehension(pFable, tmpComprehension, tmpBody,
				(pError, pResult) =>
				{
					if (pError)
					{
						pResponse.send(500, { Error: `Error pushing comprehension: ${pError.message || pError}` });
						return fNext();
					}
					pResponse.send(200, pResult);
					return fNext();
				});
		});
};

function getCapitalLettersAsString(pInputString)
{
	let tmpRegex = /[A-Z]/g;
	let tmpMatch = pInputString.match(tmpRegex);
	return tmpMatch ? tmpMatch.join('') : 'UNK';
}

function pushComprehension(pFable, pComprehension, pOptions, fCallback)
{
	pFable.serviceManager.addServiceType('IntegrationAdapter', libIntegrationAdapter);

	let tmpAnticipate = pFable.newAnticipate();
	let tmpEntitiesPushed = [];

	let tmpIntegrationAdapterSet = Object.keys(pComprehension);

	pFable.log.info(`Pushing comprehension with ${tmpIntegrationAdapterSet.length} entity(ies) to Meadow APIs...`);

	tmpAnticipate.anticipate(
		(fDone) =>
		{
			try
			{
				for (let i = 0; i < tmpIntegrationAdapterSet.length; i++)
				{
					let tmpAdapterKey = tmpIntegrationAdapterSet[i];
					let tmpAdapterOptions = { Entity: tmpAdapterKey, EntityGUIDMarshalPrefix: getCapitalLettersAsString(tmpAdapterKey) };

					if (pOptions.ServerURL)
					{
						tmpAdapterOptions.ServerURL = pOptions.ServerURL;
					}

					libIntegrationAdapter.getAdapter(pFable, tmpAdapterKey, getCapitalLettersAsString(tmpAdapterKey), { SimpleMarshal: true, ForceMarshal: true });

					let tmpAdapter = pFable.servicesMap.IntegrationAdapter[tmpAdapterKey];

					if (pOptions.GUIDPrefix)
					{
						tmpAdapter.AdapterSetGUIDMarshalPrefix = pOptions.GUIDPrefix;
					}
					if (pOptions.EntityGUIDPrefix)
					{
						tmpAdapter.EntityGUIDMarshalPrefix = pOptions.EntityGUIDPrefix;
					}

					let tmpDataMap = pComprehension[tmpAdapterKey];
					if (!tmpDataMap)
					{
						pFable.log.info(`No records to push for [${tmpAdapterKey}].`);
						continue;
					}

					tmpEntitiesPushed.push(tmpAdapterKey);

					// Add source records
					tmpAnticipate.anticipate(
						(function(pAdapter, pDataMap)
						{
							return function(fRecordDone)
							{
								for (const tmpRecord in pDataMap)
								{
									pAdapter.addSourceRecord(pDataMap[tmpRecord]);
								}
								return fRecordDone();
							};
						})(tmpAdapter, tmpDataMap));

					// Integrate records
					tmpAnticipate.anticipate(
						(function(pAdapter)
						{
							return function(fIntegrateDone)
							{
								pAdapter.integrateRecords(fIntegrateDone);
							};
						})(tmpAdapter));
				}
			}
			catch (pError)
			{
				pFable.log.error(`Error wiring up integration adapters: ${pError}`, pError);
				return fDone(pError);
			}

			return fDone();
		});

	tmpAnticipate.wait(
		(pError) =>
		{
			if (pError)
			{
				pFable.log.error(`Error pushing comprehension.`, pError);
				return fCallback(pError);
			}
			pFable.log.info(`Finished pushing comprehension for entities: [${tmpEntitiesPushed.join(', ')}].`);
			return fCallback(null,
				{
					Success: true,
					EntitiesPushed: tmpEntitiesPushed,
					Message: `Pushed comprehension for ${tmpEntitiesPushed.length} entity(ies).`
				});
		});
}
