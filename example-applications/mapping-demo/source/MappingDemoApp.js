'use strict';

const libPictApplication = require('pict-application');

const libPictSectionModal = require('pict-section-modal');
const libPictSectionTheme = require('pict-section-theme');

const libMappingDemoBrand = require('./MappingDemoBrand.js');
const libMappingDemoEditorView = require('./views/MappingDemoEditorView.js');

/**
 * MappingDemoApplication
 *
 * Pict application that hosts the MappingDemoEditorView and brings up
 * the unified pict-section-theme stack so visitors can flip themes and
 * watch the embedded MeadowMappingEditor library view reskin live.
 *
 * Loaded client-side by Pict.safeLoadPictApplication(MappingDemoApplication, 2).
 *
 * After initialization it exposes window.openMappingEditor() so the
 * static HTML pipeline UI can activate the visual editor from a plain
 * onclick handler.
 */
class MappingDemoApplication extends libPictApplication
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		// Modal system (confirm dialogs the editor may pop)
		this.pict.addView('Pict-Section-Modal', libPictSectionModal.default_configuration, libPictSectionModal);

		this.pict.addView(
			'MappingDemoEditor',
			libMappingDemoEditorView.default_configuration,
			libMappingDemoEditorView);

		// Unified theme stack — the demo's whole point is to prove the
		// library view picks up theme tokens, so the picker is exposed
		// inline in the page header (not behind a gear toggle). Just
		// register the runtime here; mount the controls in onAfterInitializeAsync
		// once the destination div exists in the DOM.
		this.pict.addProvider('Theme-Section',
			{
				ApplyDefault: 'pict-default',
				DefaultMode:  'system',
				DefaultScale: 1.0,
				Brand:        libMappingDemoBrand,
				Views: ['Picker', 'ModeToggle', 'ScaleSelect', 'BrandMark']
			}, libPictSectionTheme);
	}

	onAfterInitializeAsync(fCallback)
	{
		// Mount the theme controls directly into the header strip so users
		// can switch themes and watch every surface (the static HTML
		// pipeline UI + the embedded library editor) reskin in lockstep.
		let tmpThemeProvider = this.pict.providers['Theme-Section'];
		if (tmpThemeProvider && typeof tmpThemeProvider.mount === 'function')
		{
			tmpThemeProvider.mount(
			{
				Container: '#MappingDemo-Theme-Controls',
				Views: ['Picker', 'ModeToggle', 'ScaleSelect']
			});
		}

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
