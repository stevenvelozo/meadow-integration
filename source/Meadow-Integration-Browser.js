/**
 * Meadow-Integration Browser Entry Point
 *
 * Browser-safe exports only — no database drivers, no server-side
 * connection managers, no file system access.
 *
 * Use this entry point in browser bundles:
 *   const libMI = require('meadow-integration/source/Meadow-Integration-Browser.js');
 *
 * Or add to package.json "browser" field for automatic resolution.
 */

'use strict';

const libMeadowMappingEditorView = require(`./views/PictView-MeadowMappingEditor.js`);
const libMappingEditorSchemaUtils = require(`./views/MappingEditor-SchemaUtils.js`);
const libFlowCardMappingSource = require(`./views/flow-cards/FlowCard-MappingSource.js`);
const libFlowCardMappingTarget = require(`./views/flow-cards/FlowCard-MappingTarget.js`);
const libFlowCardTemplateExpression = require(`./views/flow-cards/FlowCard-TemplateExpression.js`);
const libFlowCardSolverExpression = require(`./views/flow-cards/FlowCard-SolverExpression.js`);

module.exports =
{
	// Visual mapping editor components
	MeadowMappingEditorView: libMeadowMappingEditorView,
	MappingEditorSchemaUtils: libMappingEditorSchemaUtils,
	FlowCardMappingSource: libFlowCardMappingSource,
	FlowCardMappingTarget: libFlowCardMappingTarget,
	FlowCardTemplateExpression: libFlowCardTemplateExpression,
	FlowCardSolverExpression: libFlowCardSolverExpression,
};
