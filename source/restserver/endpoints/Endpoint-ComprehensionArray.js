/**
 * POST /1.0/Comprehension/ToArray
 *
 * Convert an object-based comprehension into an array.
 *
 * Request body (JSON):
 * {
 *   "Comprehension": { ... },                 // The comprehension object to convert
 *   "Entity": "MyEntity"                      // (optional) Entity name; auto-inferred if omitted
 * }
 *
 * OR file-based:
 *
 * POST /1.0/Comprehension/ToArrayFromFile
 * {
 *   "File": "/path/to/comprehension.json",    // Comprehension file path
 *   "Entity": "MyEntity"                      // (optional) Entity name
 * }
 *
 * Response: JSON array of records
 */
module.exports = function(pFable, pOrator)
{
	// In-memory conversion
	pOrator.serviceServer.postWithBodyParser('/1.0/Comprehension/ToArray',
		(pRequest, pResponse, fNext) =>
		{
			let tmpBody = pRequest.body || {};

			if (!tmpBody.Comprehension || (typeof(tmpBody.Comprehension) !== 'object'))
			{
				pResponse.send(400, { Error: 'No valid Comprehension object provided in request body.' });
				return fNext();
			}

			let tmpResult = processComprehensionToArray(pFable, tmpBody.Comprehension, tmpBody.Entity);
			if (tmpResult.Error)
			{
				pResponse.send(400, tmpResult);
				return fNext();
			}

			pResponse.send(200, tmpResult.RecordArray);
			return fNext();
		});

	// File-based conversion
	pOrator.serviceServer.postWithBodyParser('/1.0/Comprehension/ToArrayFromFile',
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

			let tmpResult = processComprehensionToArray(pFable, tmpComprehension, tmpBody.Entity);
			if (tmpResult.Error)
			{
				pResponse.send(400, tmpResult);
				return fNext();
			}

			pResponse.send(200, tmpResult.RecordArray);
			return fNext();
		});
};

function processComprehensionToArray(pFable, pComprehension, pEntity)
{
	let tmpEntity = pEntity;

	if (!tmpEntity)
	{
		let tmpEntityInference = Object.keys(pComprehension);
		if (tmpEntityInference.length > 0)
		{
			tmpEntity = tmpEntityInference[0];
			pFable.log.info(`No entity specified. Using [${tmpEntity}] as the inferred entity.`);
		}
		else
		{
			return { Error: 'No entity specified and no entities found in the comprehension.' };
		}
	}

	let tmpEntityRecords = pComprehension[tmpEntity] || {};
	let tmpRecordArray = [];

	let tmpRecordKeys = Object.keys(tmpEntityRecords);
	for (let i = 0; i < tmpRecordKeys.length; i++)
	{
		tmpRecordArray.push(tmpEntityRecords[tmpRecordKeys[i]]);
	}

	pFable.log.info(`Comprehension ToArray: Converted ${tmpRecordArray.length} records for entity [${tmpEntity}].`);
	return { RecordArray: tmpRecordArray };
}
