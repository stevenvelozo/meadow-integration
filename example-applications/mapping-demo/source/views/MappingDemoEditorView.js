'use strict';

// Path: mapping-demo/source/views/ → ../../../../source/views/PictView-MeadowMappingEditor.js
const libMeadowMappingEditorView = require('../../../../source/views/PictView-MeadowMappingEditor.js');

// ── View configuration ────────────────────────────────────────────────────────
// Same template HTML as the generic base editor, but with 'MappingDemoEditor'
// in all onclick handlers so pict resolves this registered view name.
// DOM IDs stay as MeadowMap-* so inherited JS methods work without changes.

const _ViewConfiguration =
{
	ViewIdentifier: 'MappingDemoEditor',

	DefaultRenderable: 'MappingDemoEditor-Content',
	DefaultDestinationAddress: '#MeadowMap-Editor-Container',

	AutoRender: false,

	CSS: libMeadowMappingEditorView.default_configuration.CSS,

	Templates:
	[
		{
			Hash: 'MappingDemoEditor-Template',
			Template: /*html*/`
<div>
	<div id="MeadowMap-Editor" class="meadow-mapping-editor">
		<div class="meadow-mapping-header">
			<button class="meadow-mapping-btn meadow-mapping-btn-secondary meadow-mapping-btn-small" onclick="{~P~}.views['MappingDemoEditor'].closeMappingEditor()">&larr; Back</button>
			<h3 id="MeadowMap-Title">Mapping Editor</h3>
			<div class="meadow-schema-mode-tabs">
				<button class="meadow-schema-mode-tab active" id="MeadowMap-Mode-Flow" onclick="{~P~}.views['MappingDemoEditor'].switchMapMode('flow')">Visual Mapper</button>
				<button class="meadow-schema-mode-tab" id="MeadowMap-Mode-JSON" onclick="{~P~}.views['MappingDemoEditor'].switchMapMode('json')">JSON Config</button>
			</div>
		</div>

		<div id="MeadowMap-List-Wrap">
			<div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.75em;">
				<div class="meadow-section-title" style="margin:0;">Existing Mappings</div>
				<button class="meadow-mapping-btn meadow-mapping-btn-primary meadow-mapping-btn-small" onclick="{~P~}.views['MappingDemoEditor'].newMapping()">+ New Mapping</button>
			</div>
			<div id="MeadowMap-List"></div>
		</div>

		<div id="MeadowMap-Detail" style="display:none;">
			<div style="display:flex; gap:0.5em; align-items:center; margin-bottom:0.75em;">
				<label style="font-size:0.78em; font-weight:600;">Mapping Name</label>
				<input type="text" id="MeadowMap-Name" placeholder="Mapping name" style="flex:1; padding:0.3em 0.5em; font-size:0.85em; border:1px solid var(--border); border-radius:4px; background:var(--bg-card); color:var(--text);">
			</div>

			<div style="display:flex; gap:0.5em; align-items:center; margin-bottom:0.75em;">
				<label style="font-size:0.78em; font-weight:600;">Source</label>
				<select id="MeadowMap-Source" style="flex:1; padding:0.3em 0.5em; font-size:0.85em; border:1px solid var(--border); border-radius:4px;"></select>
				<button class="meadow-mapping-btn meadow-mapping-btn-secondary meadow-mapping-btn-small" onclick="{~P~}.views['MappingDemoEditor'].discoverSourceFields()">Discover Fields</button>
			</div>

			<div id="MeadowMap-Flow-Wrap">
				<div id="MeadowMap-Flow-Container" class="meadow-flow-container"></div>
			</div>

			<div id="MeadowMap-JSON-Wrap" style="display:none;">
				<textarea class="meadow-mapping-json-editor" id="MeadowMap-JSON" placeholder='{"Entity":"Book","GUIDTemplate":"{~D:Record.id~}","Mappings":{},"Solvers":[],"ManyfestAddresses":false}'></textarea>
			</div>

			<div style="margin-top:0.75em;">
				<div style="font-size:0.72em; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; color:var(--text-dim); margin-bottom:0.35em;">Target Stores</div>
				<div id="MeadowMap-Stores" class="meadow-mapping-store-checklist"></div>
			</div>

			<div style="margin-top:0.75em; display:flex; gap:0.5em; flex-wrap:wrap; align-items:center;">
				<button class="meadow-mapping-btn meadow-mapping-btn-primary" onclick="{~P~}.views['MappingDemoEditor'].saveMapping()">Save Mapping</button>
			</div>
		</div>
	</div>
</div>
`
		}
	],

	Renderables:
	[
		{
			RenderableHash: 'MappingDemoEditor-Content',
			TemplateHash: 'MappingDemoEditor-Template',
			ContentDestinationAddress: '#MeadowMap-Editor-Container',
			RenderMethod: 'replace'
		}
	]
};

/**
 * MappingDemoEditorView
 *
 * Extends MeadowMappingEditorView and wires the _do* data methods to the
 * mapping-demo server's REST API endpoints.  All visual/canvas/serialization
 * logic lives in the base class; this subclass only supplies data access.
 */
class MappingDemoEditorView extends libMeadowMappingEditorView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);
	}

	// ── Data methods ─────────────────────────────────────────────────────────

	_doLoadMappings(pContextID)
	{
		return fetch('/1.0/Demo/VisualMapping').then(function(r) { return r.json(); });
	}

	_doLoadSources()
	{
		return fetch('/1.0/Demo/Sources').then(function(r) { return r.json(); });
	}

	_doLoadStores(pContextID)
	{
		return Promise.resolve({ Stores: [] });
	}

	_doLoadTargetSchema(pContextID)
	{
		return fetch('/1.0/Demo/TargetSchema').then(function(r) { return r.json(); });
	}

	_doLoadMapping(pMappingID)
	{
		return fetch('/1.0/Demo/VisualMapping/' + pMappingID).then(function(r) { return r.json(); });
	}

	_doDeleteMapping(pMappingID)
	{
		return fetch('/1.0/Demo/VisualMapping/' + pMappingID,
			{ method: 'DELETE' }).then(function(r) { return r.json(); });
	}

	_doDiscoverSourceFields(pContextID, pSourceID, pRecordLimit)
	{
		return fetch('/1.0/Demo/SourceSchema').then(function(r) { return r.json(); });
	}

	_doCreateMapping(pContextID, pData)
	{
		return fetch('/1.0/Demo/VisualMapping',
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(pData)
			}).then(function(r) { return r.json(); });
	}

	_doUpdateMapping(pMappingID, pData)
	{
		return fetch('/1.0/Demo/VisualMapping/' + pMappingID,
			{
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(pData)
			}).then(function(r) { return r.json(); });
	}

	_onClose()
	{
		// Hide the editor and restore the step placeholder
		let tmpEditor = document.getElementById('MeadowMap-Editor');
		if (tmpEditor)
		{
			tmpEditor.classList.remove('active');
		}

		let tmpPlaceholder = document.getElementById('mapping-editor-placeholder');
		if (tmpPlaceholder)
		{
			tmpPlaceholder.style.display = '';
		}

		// Dispatch an event so the outer UI can mark this step done
		document.dispatchEvent(new CustomEvent('mapping-editor-closed'));
	}
}

module.exports = MappingDemoEditorView;

module.exports.default_configuration = _ViewConfiguration;
