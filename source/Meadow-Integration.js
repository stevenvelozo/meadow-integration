const libTabularCheck = require(`./services/tabular/Service-TabularCheck.js`);
const libIntegrationServer = require(`./restserver/Meadow-Integration-Server.js`);

module.exports = (
	{
		TabularCheck: libTabularCheck,
		IntegrationServer: libIntegrationServer
	});