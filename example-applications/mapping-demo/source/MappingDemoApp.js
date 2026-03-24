'use strict';

const libPictApplication = require('pict-application');
const libMappingDemoEditorView = require('./views/MappingDemoEditorView.js');

/**
 * MappingDemoApplication
 *
 * Minimal pict application that hosts the MappingDemoEditorView.
 * Loaded client-side by Pict.safeLoadPictApplication(MappingDemoApplication, 2).
 *
 * After initialization it exposes window.openMappingEditor() so the static
 * HTML pipeline UI can activate the visual editor from a plain onclick handler.
 */
class MappingDemoApplication extends libPictApplication
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this.pict.addView(
			'MappingDemoEditor',
			libMappingDemoEditorView.default_configuration,
			libMappingDemoEditorView);
	}

	onAfterInitializeAsync(fCallback)
	{
		// Expose a global hook so the outer HTML can open the editor
		window.openMappingEditor = () =>
		{
			let tmpPlaceholder = document.getElementById('mapping-editor-placeholder');
			if (tmpPlaceholder)
			{
				tmpPlaceholder.style.display = 'none';
			}

			window._Pict.views['MappingDemoEditor'].editMappings(1, 'Book');
		};

		return super.onAfterInitializeAsync(fCallback);
	}
}

module.exports = MappingDemoApplication;

module.exports.default_configuration =
{
	Name: 'MappingDemoApp',
	Hash: 'MappingDemo',
	AutoSolveAfterInitialize: true
};
