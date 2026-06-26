// Meadow-Integration-Engine — the browser-safe, dependency-light entry point for the comprehension
// transform / push ENGINE classes, decoupled from the full meadow-integration package.
//
// The package `main` (Meadow-Integration.js) and the `browser` entry pull in orator, the meadow ORM,
// the DB connection drivers, xlsx, etc. — none of which the engine itself needs. These three services
// depend ONLY on fable-serviceproviderbase (and each other), so an in-browser consumer — e.g.
// pict-section-dataimport — can `require('meadow-integration/source/Meadow-Integration-Engine.js')`
// to get the engine WITHOUT dragging any server-only code into its bundle.
//
// This file is the stable public contract for in-browser engine consumers: if the internal layout
// under source/ ever changes, update the requires HERE and consumers keep importing this one path.
//
//   const { MeadowIntegrationTabularTransform, MeadowIntegrationAdapter, MeadowGUIDMap, getAdapter }
//       = require('meadow-integration/source/Meadow-Integration-Engine.js');
//
// - MeadowIntegrationTabularTransform : maps tabular rows -> a Comprehension (transformRecord per row;
//   runs Solvers + MultipleGUIDUniqueness fan-out).
// - MeadowIntegrationAdapter          : GUID marshaling, FK resolution, bulk upsert (setRestClient,
//   addSourceRecord, integrateRecords). Use getAdapter(fable, entity, prefix, options) for the
//   per-entity singleton.
// - MeadowGUIDMap                     : the in-session external-GUID <-> Meadow-ID map.

const MeadowIntegrationTabularTransform = require('./services/tabular/Service-TabularTransform.js');
const MeadowIntegrationAdapter = require('./Meadow-Service-Integration-Adapter.js');
const MeadowGUIDMap = require('./Meadow-Service-Integration-GUIDMap.js');

// Opt-in context-aware GUID layer (pure, dependency-light): compose deterministic, length-safe GUIDs that
// embed parent context (e.g. `UI_C10_P01278_LI8675309`) + a compiler that turns a per-entity strategy
// config into the structured spec the TabularTransform stamps. Reusable by the CLI, the server endpoints,
// and the browser import wizard alike.
const MeadowIntegrationGUIDComposer = require('./services/guid/Meadow-Integration-GUIDComposer.js');
const MeadowIntegrationGUIDStrategy = require('./services/guid/Meadow-Integration-GUIDStrategy.js');

module.exports =
{
	MeadowIntegrationTabularTransform,
	MeadowIntegrationAdapter,
	MeadowGUIDMap,
	// The per-entity adapter factory (caches on fable.servicesMap.IntegrationAdapter[Entity]).
	getAdapter: MeadowIntegrationAdapter.getAdapter,

	// Context-aware GUID composition + strategy compilation.
	MeadowIntegrationGUIDComposer,
	MeadowIntegrationGUIDStrategy,
	composeGUID: MeadowIntegrationGUIDComposer.composeGUID,
	compileGUIDStrategy: MeadowIntegrationGUIDStrategy.compile,
};
