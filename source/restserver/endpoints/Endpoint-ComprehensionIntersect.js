const libPath = require('path');

/**
 * POST /1.0/Comprehension/Intersect
 *
 * Merge two comprehension objects together.
 *
 * Request body (JSON):
 * {
 *   "PrimaryComprehension": { ... },          // The primary comprehension object
 *   "SecondaryComprehension": { ... },        // The secondary comprehension to merge in
 *   "Entity": "MyEntity"                      // (optional) Entity name; auto-inferred if omitted
 * }
 *
 * OR file-based:
 *
 * POST /1.0/Comprehension/IntersectFiles
 * {
 *   "File": "/path/to/primary.json",          // Primary comprehension file
 *   "IntersectFile": "/path/to/secondary.json",// Secondary comprehension file
 *   "Entity": "MyEntity"                      // (optional) Entity name
 * }
 *
 * Response: Merged comprehension JSON
 */
module.exports = function(pFable, pOrator)
{
	// In-memory intersection
	pOrator.serviceServer.postWithBodyParser('/1.0/Comprehension/Intersect',
		(pRequest, pResponse, fNext) =>
		{
			let tmpBody = pRequest.body || {};

			if (!tmpBody.PrimaryComprehension || (typeof(tmpBody.PrimaryComprehension) !== 'object'))
			{
				pResponse.send(400, { Error: 'No valid PrimaryComprehension object provided in request body.' });
				return fNext();
			}
			if (!tmpBody.SecondaryComprehension || (typeof(tmpBody.SecondaryComprehension) !== 'object'))
			{
				pResponse.send(400, { Error: 'No valid SecondaryComprehension object provided in request body.' });
				return fNext();
			}

			let tmpResult = processComprehensionIntersect(pFable, tmpBody.PrimaryComprehension, tmpBody.SecondaryComprehension, tmpBody.Entity);
			if (tmpResult.Error)
			{
				pResponse.send(400, tmpResult);
				return fNext();
			}

			pResponse.send(200, tmpResult.Comprehension);
			return fNext();
		});

	// File-based intersection
	pOrator.serviceServer.postWithBodyParser('/1.0/Comprehension/IntersectFiles',
		(pRequest, pResponse, fNext) =>
		{
			let tmpBody = pRequest.body || {};

			if (!tmpBody.File || (typeof(tmpBody.File) !== 'string'))
			{
				pResponse.send(400, { Error: 'No valid File path provided in request body.' });
				return fNext();
			}
			if (!tmpBody.IntersectFile || (typeof(tmpBody.IntersectFile) !== 'string'))
			{
				pResponse.send(400, { Error: 'No valid IntersectFile path provided in request body.' });
				return fNext();
			}

			pFable.instantiateServiceProvider('FilePersistence');

			let tmpPrimaryFilePath = pFable.FilePersistence.resolvePath(tmpBody.File);
			let tmpSecondaryFilePath = pFable.FilePersistence.resolvePath(tmpBody.IntersectFile);

			if (!pFable.FilePersistence.existsSync(tmpPrimaryFilePath))
			{
				pResponse.send(404, { Error: `Primary file [${tmpPrimaryFilePath}] does not exist.` });
				return fNext();
			}
			if (!pFable.FilePersistence.existsSync(tmpSecondaryFilePath))
			{
				pResponse.send(404, { Error: `Secondary file [${tmpSecondaryFilePath}] does not exist.` });
				return fNext();
			}

			let tmpPrimaryComprehension;
			let tmpSecondaryComprehension;

			try
			{
				tmpPrimaryComprehension = JSON.parse(pFable.FilePersistence.readFileSync(tmpPrimaryFilePath));
			}
			catch (pError)
			{
				pResponse.send(400, { Error: `Error parsing primary comprehension file: ${pError.message}` });
				return fNext();
			}

			try
			{
				tmpSecondaryComprehension = JSON.parse(pFable.FilePersistence.readFileSync(tmpSecondaryFilePath));
			}
			catch (pError)
			{
				pResponse.send(400, { Error: `Error parsing secondary comprehension file: ${pError.message}` });
				return fNext();
			}

			let tmpResult = processComprehensionIntersect(pFable, tmpPrimaryComprehension, tmpSecondaryComprehension, tmpBody.Entity);
			if (tmpResult.Error)
			{
				pResponse.send(400, tmpResult);
				return fNext();
			}

			pResponse.send(200, tmpResult.Comprehension);
			return fNext();
		});
};

function processComprehensionIntersect(pFable, pPrimaryComprehension, pSecondaryComprehension, pEntity)
{
	let tmpEntity = pEntity;

	if (!tmpEntity)
	{
		let tmpEntityInference = Object.keys(pPrimaryComprehension);
		if (tmpEntityInference.length > 0)
		{
			tmpEntity = tmpEntityInference[0];
			pFable.log.info(`No entity specified. Using [${tmpEntity}] as the inferred entity.`);
		}
		else
		{
			return { Error: 'No entity specified and no entities found in the primary comprehension.' };
		}
	}

	// Deep clone the primary to avoid mutation
	let tmpResultComprehension = JSON.parse(JSON.stringify(pPrimaryComprehension));

	if (!tmpResultComprehension[tmpEntity])
	{
		tmpResultComprehension[tmpEntity] = {};
	}

	let tmpIntersectingKeys = Object.keys(pSecondaryComprehension[tmpEntity] || {});
	for (let i = 0; i < tmpIntersectingKeys.length; i++)
	{
		const tmpRecordGUID = tmpIntersectingKeys[i];
		if (tmpResultComprehension[tmpEntity][tmpRecordGUID])
		{
			tmpResultComprehension[tmpEntity][tmpRecordGUID] = Object.assign(tmpResultComprehension[tmpEntity][tmpRecordGUID], pSecondaryComprehension[tmpEntity][tmpRecordGUID]);
		}
		else
		{
			tmpResultComprehension[tmpEntity][tmpRecordGUID] = pSecondaryComprehension[tmpEntity][tmpRecordGUID];
		}
	}

	pFable.log.info(`Comprehension Intersect: Merged ${tmpIntersectingKeys.length} records for entity [${tmpEntity}].`);
	return { Comprehension: tmpResultComprehension };
}
