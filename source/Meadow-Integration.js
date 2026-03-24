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

const libFileParser = require(`./services/parser/Service-FileParser.js`);
const libFileParserCSV = require(`./services/parser/Service-FileParser-CSV.js`);
const libFileParserJSON = require(`./services/parser/Service-FileParser-JSON.js`);
const libFileParserXLSX = require(`./services/parser/Service-FileParser-XLSX.js`);
const libFileParserXML = require(`./services/parser/Service-FileParser-XML.js`);
const libFileParserFixedWidth = require(`./services/parser/Service-FileParser-FixedWidth.js`);

const libMeadowMappingEditorView = require(`./views/PictView-MeadowMappingEditor.js`);
const libMappingEditorSchemaUtils = require(`./views/MappingEditor-SchemaUtils.js`);
const libFlowCardMappingSource = require(`./views/flow-cards/FlowCard-MappingSource.js`);
const libFlowCardMappingTarget = require(`./views/flow-cards/FlowCard-MappingTarget.js`);
const libFlowCardTemplateExpression = require(`./views/flow-cards/FlowCard-TemplateExpression.js`);
const libFlowCardSolverExpression = require(`./views/flow-cards/FlowCard-SolverExpression.js`);

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
		GUIDMap: libGUIDMap,

		FileParser: libFileParser,
		FileParserCSV: libFileParserCSV,
		FileParserJSON: libFileParserJSON,
		FileParserXLSX: libFileParserXLSX,
		FileParserXML: libFileParserXML,
		FileParserFixedWidth: libFileParserFixedWidth,

		// Visual mapping editor components (for browser bundles)
		MeadowMappingEditorView: libMeadowMappingEditorView,
		MappingEditorSchemaUtils: libMappingEditorSchemaUtils,
		FlowCardMappingSource: libFlowCardMappingSource,
		FlowCardMappingTarget: libFlowCardMappingTarget,
		FlowCardTemplateExpression: libFlowCardTemplateExpression,
		FlowCardSolverExpression: libFlowCardSolverExpression
	});