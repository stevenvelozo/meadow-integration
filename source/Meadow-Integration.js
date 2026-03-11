const libTabularCheck = require(`./services/tabular/Service-TabularCheck.js`);
const libIntegrationServer = require(`./restserver/Meadow-Integration-Server.js`);

const libConnectionManager = require(`./services/clone/Meadow-Service-ConnectionManager.js`);
const libCloneRestClient = require(`./services/clone/Meadow-Service-RestClient.js`);
const libSync = require(`./services/clone/Meadow-Service-Sync.js`);
const libSyncEntityInitial = require(`./services/clone/Meadow-Service-Sync-Entity-Initial.js`);
const libSyncEntityOngoing = require(`./services/clone/Meadow-Service-Sync-Entity-Ongoing.js`);
const libOperation = require(`./services/clone/Meadow-Service-Operation.js`);

const libIntegrationAdapter = require(`./Meadow-Service-Integration-Adapter.js`);
const libGUIDMap = require(`./Meadow-Service-Integration-GUIDMap.js`);

module.exports = (
	{
		TabularCheck: libTabularCheck,
		IntegrationServer: libIntegrationServer,

		ConnectionManager: libConnectionManager,
		CloneRestClient: libCloneRestClient,
		Sync: libSync,
		SyncEntityInitial: libSyncEntityInitial,
		SyncEntityOngoing: libSyncEntityOngoing,
		Operation: libOperation,

		IntegrationAdapter: libIntegrationAdapter,
		GUIDMap: libGUIDMap
	});