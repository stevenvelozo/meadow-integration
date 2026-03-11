const libFableServiceProviderBase = require('fable-serviceproviderbase');

const defaultMeadowGUIDMapOptions = (
	{
		// Nothing here yet.
		// Maybe overwrite rules?  Right now it's just obliterate.
		// When we add persistence that would be here as well.
	});

class MeadowGUIDMap extends libFableServiceProviderBase
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({}, defaultMeadowGUIDMapOptions, pOptions);
		super(pFable, tmpOptions, pServiceHash);

		this.serviceType = 'MeadowGUIDMap';

		// For now, keep GUID mappings to IDs in memory forever.
		// At the moment, we don't have enough data throughput for that to be a problem really.
		// When it becomes so, we can shift the persistence to some kind of key-value store.
		// These are back and forth between the Meadow GUIDs and the Meadow IDs
		this._GUIDMap = {};
		this._IDMap = {};

		// Keep track of *external* GUIDS that map to Meadow GUIDs
		this._ExternalGUIDMap = {};
	}

	// Add an entity for the mapping
	addEntity(pEntity)
	{
		if (!this._GUIDMap.hasOwnProperty(pEntity))
		{
			this._GUIDMap[pEntity] = {};
			this._IDMap[pEntity] = {};
			this._ExternalGUIDMap[pEntity] = {};
		}

		return true;
	}

	// Map a Meadow GUID to an ID
	mapGUIDToID(pEntity, pGUID, pID)
	{
		if (!this._GUIDMap.hasOwnProperty(pEntity))
		{
			this.addEntity(pEntity);
		}

		this._GUIDMap[pEntity][pGUID] = pID;
		this._IDMap[pEntity][pID] = pGUID;

		return true;
	}

	// Get an ID from a GUID
	getIDFromGUID(pEntity, pGUID)
	{
		if (!this._GUIDMap.hasOwnProperty(pEntity))
		{
			this.addEntity(pEntity);
		}

		return (this._GUIDMap[pEntity].hasOwnProperty(pGUID)) ? this._GUIDMap[pEntity][pGUID] : false;
	}

	/**
	 * Get an ID from a GUID, loading from the server if not already cached.
	 *
	 * @param {string} pEntity - The entity name
	 * @param {string} pGUID - The GUID to look up
	 * @param {function} fCallback - Callback (pError, pID)
	 * @param {object} [pClient] - Optional REST client to use for the server lookup
	 *                              (defaults to this.fable.MeadowRestClient or this.fable.MeadowCloneRestClient)
	 */
	getIDFromGUIDAsync(pEntity, pGUID, fCallback, pClient)
	{
		if (!this._GUIDMap.hasOwnProperty(pEntity))
		{
			this.addEntity(pEntity);
		}

		// If it has already been loaded, return it.
		if (this._GUIDMap[pEntity].hasOwnProperty(pGUID))
		{
			fCallback(null, this._GUIDMap[pEntity][pGUID]);
		}
		else
		{
			// Resolve the REST client to use for the server lookup
			let tmpClient = pClient || this.fable.MeadowRestClient || this.fable.MeadowCloneRestClient;

			if (!tmpClient || typeof(tmpClient.getEntityByGUID) !== 'function')
			{
				return fCallback(new Error(`No REST client with getEntityByGUID available for GUID lookup of [${pEntity}].[${pGUID}].`), false);
			}

			// Try to load it from the server
			tmpClient.getEntityByGUID(pEntity, pGUID,
				(pError, pBody) =>
				{
					if (pError)
					{
						return fCallback(pError);
					}
					else
					{
						let tmpEntityIDName = `ID${pEntity}`;
						if (pBody && pBody.hasOwnProperty(tmpEntityIDName))
						{
							this.mapGUIDToID(pEntity, pGUID, pBody[tmpEntityIDName]);
							return fCallback(pError, pBody[tmpEntityIDName]);
						}
						else
						{
							return fCallback(pError, false)
						}
					}
				});
		}
	}

	// Get a GUID from an ID
	getGUIDFromID(pEntity, pID)
	{
		if (!this._IDMap.hasOwnProperty(pEntity))
		{
			this.addEntity(pEntity);
		}

		return (this._IDMap[pEntity].hasOwnProperty(pID)) ? this._IDMap[pEntity][pID] : false;
	}

	// For now this is one-directional; we may need two for bi-directional sync but there are other ways to resolve this.
	mapExternalGUIDtoMeadowGUID(pEntity, pExternalGUID, pMeadowGUID)
	{
		if (!this._GUIDMap.hasOwnProperty(pEntity))
		{
			this.addEntity(pEntity);
		}

		this._ExternalGUIDMap[pEntity][pExternalGUID] = pMeadowGUID;

		return true;
	}

	getMeadowGUIDFromExternalGUID(pEntity, pExternalGUID)
	{
		if (!this._GUIDMap.hasOwnProperty(pEntity))
		{
			this.addEntity(pEntity);
		}

		return (this._ExternalGUIDMap[pEntity].hasOwnProperty(pExternalGUID)) ? this._ExternalGUIDMap[pEntity][pExternalGUID] : false;
	}

	getMeadowIDFromExternalGUID(pEntity, pExternalGUID)
	{
		if (!this._GUIDMap.hasOwnProperty(pEntity))
		{
			this.addEntity(pEntity);
		}

		let tmpMeadowGUID = this.getMeadowGUIDFromExternalGUID(pEntity, pExternalGUID);
		return (tmpMeadowGUID) ? this.getIDFromGUID(pEntity, tmpMeadowGUID) : false;
	}
}

module.exports = MeadowGUIDMap;

module.exports.default_configuration = defaultMeadowGUIDMapOptions;