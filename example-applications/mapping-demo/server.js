/**
 * Mapping Demo Server
 *
 * Demonstrates the full meadow-integration pipeline:
 *   Parse → Map → Comprehension → Load → Verify
 *
 * Starts a single Orator server on port 8092 that:
 *   - Serves the demo web UI at http://localhost:8092/
 *   - Exposes a Book entity via meadow-endpoints (SQLite in-memory)
 *   - Provides demo pipeline REST endpoints under /1.0/Demo/
 *
 * Run from this directory:
 *   node server.js
 */
'use strict';

const libPath = require('path');
const libFS = require('fs');
const libReadline = require('readline');

const libPict = require('pict');
const libOrator = require('orator');
const libOratorRestify = require('orator-serviceserver-restify');
const libMeadow = require('meadow');
const libMeadowEndpoints = require('meadow-endpoints');
const libMeadowConnectionSQLite = require('meadow-connection-sqlite');

// meadow-integration's own pipeline components (resolved relative to module root)
const libIntegrationAdapter = require('../../source/Meadow-Service-Integration-Adapter.js');
const libGUIDMap = require('../../source/Meadow-Service-Integration-GUIDMap.js');
const libRestClient = require('../../source/services/clone/Meadow-Service-RestClient.js');
const libTabularTransform = require('../../source/services/tabular/Service-TabularTransform.js');

// ── Constants ──────────────────────────────────────────────────────────────────

const PORT = 8092;
const SERVER_URL = `http://localhost:${PORT}/1.0/`;
const DATA_FILE = libPath.join(__dirname, 'data', 'books-sample.csv');
const MAPPING_FILE = libPath.join(__dirname, 'mappings', 'books-to-book.json');
const WEB_DIR = libPath.join(__dirname, 'web');

// Book schema as micro-DDL — used by the visual mapping editor TGT node.
// Only includes user-editable fields (not system/audit columns).
const BOOK_TARGET_SCHEMA_DDL = `!Book
$Title 200
$Type 32
$Genre 128
$ISBN 64
$Language 12
$ImageURL 254
#PublicationYear`;

// ── Book entity schema (inlined from retold-harness bookstore schema) ──────────

const _BookMeadowSchema =
{
	Scope: 'Book',
	DefaultIdentifier: 'IDBook',
	Domain: 'Default',
	Schema:
	[
		{ Column: 'IDBook',          Type: 'AutoIdentity', Size: 'Default' },
		{ Column: 'GUIDBook',        Type: 'AutoGUID',     Size: '128'     },
		{ Column: 'CreateDate',      Type: 'CreateDate',   Size: 'Default' },
		{ Column: 'CreatingIDUser',  Type: 'CreateIDUser', Size: 'int'     },
		{ Column: 'UpdateDate',      Type: 'UpdateDate',   Size: 'Default' },
		{ Column: 'UpdatingIDUser',  Type: 'UpdateIDUser', Size: 'int'     },
		{ Column: 'Deleted',         Type: 'Deleted',      Size: 'Default' },
		{ Column: 'DeleteDate',      Type: 'DeleteDate',   Size: 'Default' },
		{ Column: 'DeletingIDUser',  Type: 'DeleteIDUser', Size: 'int'     },
		{ Column: 'Title',           Type: 'String',       Size: '200'     },
		{ Column: 'Type',            Type: 'String',       Size: '32'      },
		{ Column: 'Genre',           Type: 'String',       Size: '128'     },
		{ Column: 'ISBN',            Type: 'String',       Size: '64'      },
		{ Column: 'Language',        Type: 'String',       Size: '12'      },
		{ Column: 'ImageURL',        Type: 'String',       Size: '254'     },
		{ Column: 'PublicationYear', Type: 'Integer',      Size: 'int'     }
	],
	DefaultObject:
	{
		IDBook: 0, GUIDBook: '', CreateDate: null, CreatingIDUser: 0,
		UpdateDate: null, UpdatingIDUser: 0, Deleted: false,
		DeleteDate: null, DeletingIDUser: 0,
		Title: '', Type: '', Genre: '', ISBN: '',
		Language: '', ImageURL: '', PublicationYear: 0
	},
	// JsonSchema.properties is required by meadow-endpoints for field filtering
	JsonSchema:
	{
		title: 'Book',
		type: 'object',
		properties:
		{
			IDBook:          { type: 'integer', size: 'Default' },
			GUIDBook:        { type: 'string',  size: '128'     },
			CreateDate:      { type: 'string',  size: 'Default' },
			CreatingIDUser:  { type: 'integer', size: 'int'     },
			UpdateDate:      { type: 'string',  size: 'Default' },
			UpdatingIDUser:  { type: 'integer', size: 'int'     },
			Deleted:         { type: 'boolean', size: 'Default' },
			DeleteDate:      { type: 'string',  size: 'Default' },
			DeletingIDUser:  { type: 'integer', size: 'int'     },
			Title:           { type: 'string',  size: '200'     },
			Type:            { type: 'string',  size: '32'      },
			Genre:           { type: 'string',  size: '128'     },
			ISBN:            { type: 'string',  size: '64'      },
			Language:        { type: 'string',  size: '12'      },
			ImageURL:        { type: 'string',  size: '254'     },
			PublicationYear: { type: 'integer', size: 'int'     }
		},
		required: ['IDBook']
	}
};

// ── Fable / service setup ──────────────────────────────────────────────────────

let _Fable = new libPict(
	{
		Product: 'MappingDemo',
		ProductVersion: '1.0.0',
		APIServerPort: PORT,
		SQLite: { SQLiteFilePath: ':memory:' },
		LogStreams: [ { streamtype: 'console', level: 'warn' } ]
	});

_Fable.serviceManager.addServiceType('OratorServiceServer', libOratorRestify);
_Fable.serviceManager.addServiceType('MeadowSQLiteProvider', libMeadowConnectionSQLite);
_Fable.serviceManager.addServiceType('MeadowIntegrationTabularTransform', libTabularTransform);
_Fable.serviceManager.addServiceType('IntegrationAdapter', libIntegrationAdapter);
_Fable.serviceManager.addServiceType('MeadowGUIDMap', libGUIDMap);
_Fable.serviceManager.addServiceType('MeadowCloneRestClient', libRestClient);

let _Orator = new libOrator(_Fable, {});

// ── In-memory pipeline state ────────────────────────────────────────────────────

let _RawRecords = null;       // Parsed CSV records
let _MappingConfig = null;    // Loaded mapping JSON (used by Transform step)
let _LastComprehension = {};  // Most recent comprehension from Transform step

// Visual mapping store — persisted in memory.
// Initialized from books-to-book.json; updated when user saves via the editor.
let _VisualMappingStore = null;   // { IDProjectionMapping, Name, IDSource, MappingConfiguration, FlowDiagramState, Active }
let _VisualMappingNextID = 2;     // Auto-increment for create operations

// ── Startup: load static data ───────────────────────────────────────────────────

function loadStaticData()
{
	let tmpCSVContent = libFS.readFileSync(DATA_FILE, 'utf8');
	let tmpLines = tmpCSVContent.split('\n');
	let tmpHeaders = null;
	let tmpRecords = [];

	for (let i = 0; i < tmpLines.length; i++)
	{
		let tmpLine = tmpLines[i].trim();
		if (!tmpLine)
		{
			continue;
		}

		let tmpValues = tmpLine.split(',');

		if (!tmpHeaders)
		{
			tmpHeaders = tmpValues.map(function(v) { return v.trim(); });
			continue;
		}

		let tmpRecord = {};
		for (let j = 0; j < tmpHeaders.length; j++)
		{
			tmpRecord[tmpHeaders[j]] = (tmpValues[j] || '').trim();
		}
		tmpRecords.push(tmpRecord);
	}

	_RawRecords = tmpRecords;
	_MappingConfig = JSON.parse(libFS.readFileSync(MAPPING_FILE, 'utf8'));

	// Seed the visual mapping store from the JSON file so the editor starts
	// with the existing mapping pre-loaded.  Inject sourceColumns from the
	// parsed CSV headers so the SRC flow node shows all fields immediately.
	let tmpSourceColumns = tmpHeaders || [];
	let tmpConfigWithColumns = Object.assign({}, _MappingConfig, { sourceColumns: tmpSourceColumns });
	_VisualMappingStore =
	{
		IDProjectionMapping: 1,
		Name: 'Books to Book',
		IDSource: 1,
		IDProjectionStore: 0,
		MappingConfiguration: JSON.stringify(tmpConfigWithColumns),
		FlowDiagramState: null,
		Active: 1
	};

	console.log(`Loaded ${_RawRecords.length} sample records and mapping configuration.`);
}

// ── Startup: database initialization ────────────────────────────────────────────

function initializeDatabase(fCallback)
{
	_Fable.serviceManager.instantiateServiceProvider('MeadowSQLiteProvider');
	_Fable.serviceManager.instantiateServiceProvider('MeadowIntegrationTabularTransform');

	_Fable.MeadowSQLiteProvider.connectAsync(
		function(pError)
		{
			if (pError)
			{
				return fCallback(pError);
			}

			let tmpDB = _Fable.MeadowSQLiteProvider.db;

			tmpDB.exec(`
				CREATE TABLE IF NOT EXISTS User (
					IDUser INTEGER PRIMARY KEY AUTOINCREMENT,
					GUIDUser TEXT DEFAULT '',
					LoginID TEXT DEFAULT '',
					Password TEXT DEFAULT '',
					NameFirst TEXT DEFAULT '',
					NameLast TEXT DEFAULT '',
					FullName TEXT DEFAULT '',
					Config TEXT DEFAULT ''
				);
				CREATE TABLE IF NOT EXISTS Book (
					IDBook INTEGER PRIMARY KEY AUTOINCREMENT,
					GUIDBook TEXT DEFAULT '',
					CreateDate TEXT DEFAULT '',
					CreatingIDUser INTEGER DEFAULT 0,
					UpdateDate TEXT DEFAULT '',
					UpdatingIDUser INTEGER DEFAULT 0,
					Deleted INTEGER DEFAULT 0,
					DeleteDate TEXT DEFAULT '',
					DeletingIDUser INTEGER DEFAULT 0,
					Title TEXT DEFAULT '',
					Type TEXT DEFAULT '',
					Genre TEXT DEFAULT '',
					ISBN TEXT DEFAULT '',
					Language TEXT DEFAULT '',
					ImageURL TEXT DEFAULT '',
					PublicationYear INTEGER DEFAULT 0
				);
			`);

			// Seed the system user so meadow audit fields don't fail
			tmpDB.prepare(
				`INSERT OR IGNORE INTO User
				 (IDUser, GUIDUser, LoginID, Password, NameFirst, NameLast, FullName, Config)
				 VALUES (1, 'system-user', 'system', '', 'System', 'User', 'System User', '{}')`
			).run();

			return fCallback();
		});
}

// ── Startup: Meadow DAL and endpoints ───────────────────────────────────────────

function initializeMeadowEndpoints()
{
	let tmpMeadow = libMeadow.new(_Fable);
	let tmpBookDAL = tmpMeadow.loadFromPackageObject(_BookMeadowSchema);
	tmpBookDAL.setProvider('SQLite');

	let tmpBookEndpoints = libMeadowEndpoints.new(tmpBookDAL);
	tmpBookEndpoints.connectRoutes(_Fable.OratorServiceServer);

	console.log(`Book entity endpoints registered at /1.0/Book(s).`);
}

// ── Route: static web UI and pict bundles ────────────────────────────────────

function registerStaticRoutes(pOrator)
{
	pOrator.serviceServer.get('/',
		function(pRequest, pResponse, fNext)
		{
			let tmpHTML = libFS.readFileSync(libPath.join(WEB_DIR, 'index.html'), 'utf8');
			pResponse.setHeader('Content-Type', 'text/html; charset=utf-8');
			pResponse.end(tmpHTML);
			return fNext();
		});

	// Serve pict.min.js (copied to web/ by the build step)
	pOrator.serviceServer.get('/pict.min.js',
		function(pRequest, pResponse, fNext)
		{
			let tmpFile = libPath.join(WEB_DIR, 'pict.min.js');
			if (!libFS.existsSync(tmpFile))
			{
				pResponse.send(404, 'pict.min.js not found — run: npm run build');
				return fNext();
			}
			let tmpContent = libFS.readFileSync(tmpFile);
			pResponse.setHeader('Content-Type', 'application/javascript; charset=utf-8');
			pResponse.end(tmpContent);
			return fNext();
		});

	// Serve the mapping-demo editor bundle (built by quackage)
	pOrator.serviceServer.get('/mapping-demo-editor.min.js',
		function(pRequest, pResponse, fNext)
		{
			let tmpFile = libPath.join(WEB_DIR, 'mapping-demo-editor.min.js');
			if (!libFS.existsSync(tmpFile))
			{
				// Return a stub so the page still loads without a build
				pResponse.setHeader('Content-Type', 'application/javascript; charset=utf-8');
				pResponse.end('/* mapping-demo-editor.min.js not built — run: npm run build */');
				return fNext();
			}
			let tmpContent = libFS.readFileSync(tmpFile);
			pResponse.setHeader('Content-Type', 'application/javascript; charset=utf-8');
			pResponse.end(tmpContent);
			return fNext();
		});

	// ── Favicons (generated by `npm run brand` into web/favicons/) ──
	let tmpFaviconDir = libPath.join(WEB_DIR, 'favicons');
	let fServeFavicon = (pFileName, pContentType) =>
	{
		return function(pRequest, pResponse, fNext)
		{
			let tmpFile = libPath.join(tmpFaviconDir, pFileName);
			if (!libFS.existsSync(tmpFile))
			{
				pResponse.send(404, { Success: false, Error: 'Favicon not found: ' + pFileName });
				return fNext();
			}
			let tmpIsBinary = !/\.svg$/i.test(pFileName);
			let tmpContent = libFS.readFileSync(tmpFile, tmpIsBinary ? null : 'utf8');
			pResponse.setHeader('Content-Type', pContentType);
			pResponse.end(tmpContent);
			return fNext();
		};
	};
	pOrator.serviceServer.get('/favicons/favicon.svg',          fServeFavicon('favicon.svg',          'image/svg+xml'));
	pOrator.serviceServer.get('/favicons/favicon-light.svg',    fServeFavicon('favicon-light.svg',    'image/svg+xml'));
	pOrator.serviceServer.get('/favicons/favicon-dark.svg',     fServeFavicon('favicon-dark.svg',     'image/svg+xml'));
	pOrator.serviceServer.get('/favicons/favicon-16.png',       fServeFavicon('favicon-16.png',       'image/png'));
	pOrator.serviceServer.get('/favicons/favicon-32.png',       fServeFavicon('favicon-32.png',       'image/png'));
	pOrator.serviceServer.get('/favicons/favicon-192.png',      fServeFavicon('favicon-192.png',      'image/png'));
	pOrator.serviceServer.get('/favicons/favicon-512.png',      fServeFavicon('favicon-512.png',      'image/png'));
	pOrator.serviceServer.get('/favicons/apple-touch-icon.png', fServeFavicon('apple-touch-icon.png', 'image/png'));
}

// ── Route: GET /1.0/Demo/SourceSchema ────────────────────────────────────────
// Returns the CSV column names for the visual editor's SRC node ports.

function registerDemoSourceSchemaRoute(pOrator)
{
	pOrator.serviceServer.get('/1.0/Demo/SourceSchema',
		function(pRequest, pResponse, fNext)
		{
			let tmpHeaders = (_RawRecords && _RawRecords.length > 0)
				? Object.keys(_RawRecords[0])
				: [];

			pResponse.send(200,
				{
					Headers: tmpHeaders,
					SampleSize: _RawRecords ? _RawRecords.length : 0
				});
			return fNext();
		});
}

// ── Route: GET /1.0/Demo/Sources ─────────────────────────────────────────────
// Returns the list of available source datasets with their column names.
// The Columns array lets the mapping editor SRC node show fields without
// requiring a separate "Discover Fields" API call.

function registerDemoSourcesRoute(pOrator)
{
	pOrator.serviceServer.get('/1.0/Demo/Sources',
		function(pRequest, pResponse, fNext)
		{
			let tmpColumns = (_RawRecords && _RawRecords.length > 0)
				? Object.keys(_RawRecords[0])
				: [];
			pResponse.send(200, [{ IDSource: 1, Name: 'books-sample.csv', Columns: tmpColumns }]);
			return fNext();
		});
}

// ── Route: GET /1.0/Demo/TargetSchema ────────────────────────────────────────
// Returns the Book entity schema in micro-DDL format for the TGT node.

function registerDemoTargetSchemaRoute(pOrator)
{
	pOrator.serviceServer.get('/1.0/Demo/TargetSchema',
		function(pRequest, pResponse, fNext)
		{
			pResponse.send(200, { SchemaDefinition: BOOK_TARGET_SCHEMA_DDL });
			return fNext();
		});
}

// ── Routes: GET|POST|PUT|DELETE /1.0/Demo/VisualMapping[/:id] ────────────────
// CRUD for the in-memory visual mapping.  The demo keeps a single mapping
// (ID=1) seeded from books-to-book.json; saving updates both the store and
// _MappingConfig so the Transform step uses the new wiring immediately.

function registerDemoVisualMappingRoutes(pOrator)
{
	// GET /1.0/Demo/VisualMapping — list
	pOrator.serviceServer.get('/1.0/Demo/VisualMapping',
		function(pRequest, pResponse, fNext)
		{
			let tmpMappings = _VisualMappingStore ? [ _VisualMappingStore ] : [];
			pResponse.send(200, { Mappings: tmpMappings });
			return fNext();
		});

	// GET /1.0/Demo/VisualMapping/:id — single
	pOrator.serviceServer.get('/1.0/Demo/VisualMapping/:id',
		function(pRequest, pResponse, fNext)
		{
			let tmpID = parseInt(pRequest.params.id, 10);
			if (!_VisualMappingStore || _VisualMappingStore.IDProjectionMapping !== tmpID)
			{
				pResponse.send(404, { Error: 'Mapping not found.' });
				return fNext();
			}
			pResponse.send(200, { Mapping: _VisualMappingStore });
			return fNext();
		});

	// POST /1.0/Demo/VisualMapping — create
	pOrator.serviceServer.postWithBodyParser('/1.0/Demo/VisualMapping',
		function(pRequest, pResponse, fNext)
		{
			let tmpData = pRequest.body || pRequest.params || {};
			let tmpNewMapping =
			{
				IDProjectionMapping: _VisualMappingNextID++,
				Name: tmpData.Name || 'New Mapping',
				IDSource: tmpData.IDSource || 1,
				IDProjectionStore: tmpData.IDProjectionStore || 0,
				MappingConfiguration: tmpData.MappingConfiguration || '{}',
				FlowDiagramState: tmpData.FlowDiagramState || null,
				Active: tmpData.Active !== undefined ? tmpData.Active : 1
			};

			// Replace the single-slot store with the new mapping
			_VisualMappingStore = tmpNewMapping;

			// Apply to the live transform pipeline
			_applyVisualMappingConfig(tmpNewMapping.MappingConfiguration);

			pResponse.send(200, { Mapping: _VisualMappingStore });
			return fNext();
		});

	// PUT /1.0/Demo/VisualMapping/:id — update
	pOrator.serviceServer.putWithBodyParser('/1.0/Demo/VisualMapping/:id',
		function(pRequest, pResponse, fNext)
		{
			let tmpID = parseInt(pRequest.params.id, 10);
			let tmpData = pRequest.body || pRequest.params || {};

			if (!_VisualMappingStore || _VisualMappingStore.IDProjectionMapping !== tmpID)
			{
				// Auto-create if not found (handles the first save after loading)
				_VisualMappingStore =
				{
					IDProjectionMapping: tmpID,
					Name: tmpData.Name || 'Books to Book',
					IDSource: tmpData.IDSource || 1,
					IDProjectionStore: tmpData.IDProjectionStore || 0,
					MappingConfiguration: tmpData.MappingConfiguration || '{}',
					FlowDiagramState: tmpData.FlowDiagramState || null,
					Active: tmpData.Active !== undefined ? tmpData.Active : 1
				};
			}
			else
			{
				if (tmpData.Name !== undefined)              _VisualMappingStore.Name = tmpData.Name;
				if (tmpData.IDSource !== undefined)          _VisualMappingStore.IDSource = tmpData.IDSource;
				if (tmpData.IDProjectionStore !== undefined) _VisualMappingStore.IDProjectionStore = tmpData.IDProjectionStore;
				if (tmpData.MappingConfiguration !== undefined) _VisualMappingStore.MappingConfiguration = tmpData.MappingConfiguration;
				if (tmpData.FlowDiagramState !== undefined)  _VisualMappingStore.FlowDiagramState = tmpData.FlowDiagramState;
				if (tmpData.Active !== undefined)            _VisualMappingStore.Active = tmpData.Active;
			}

			// Apply to the live transform pipeline
			_applyVisualMappingConfig(_VisualMappingStore.MappingConfiguration);

			pResponse.send(200, { Mapping: _VisualMappingStore });
			return fNext();
		});

	// DELETE /1.0/Demo/VisualMapping/:id
	pOrator.serviceServer.del('/1.0/Demo/VisualMapping/:id',
		function(pRequest, pResponse, fNext)
		{
			let tmpID = parseInt(pRequest.params.id, 10);
			if (_VisualMappingStore && _VisualMappingStore.IDProjectionMapping === tmpID)
			{
				_VisualMappingStore = null;
			}
			pResponse.send(200, { Deleted: tmpID });
			return fNext();
		});
}

// ── Helper: apply a saved MappingConfiguration JSON string to the live pipeline

function _applyVisualMappingConfig(pMappingConfigJSON)
{
	try
	{
		let tmpParsed = JSON.parse(pMappingConfigJSON || '{}');
		if (!tmpParsed.Entity)
		{
			tmpParsed.Entity = 'Book';
		}
		_MappingConfig = tmpParsed;
	}
	catch (e)
	{
		console.warn('Could not parse MappingConfiguration:', e.message);
	}
}

// ── Route: GET /1.0/Demo/SampleData ─────────────────────────────────────────────
// Returns the raw parsed records from books-sample.csv

function registerDemoSampleDataRoute(pOrator)
{
	pOrator.serviceServer.get('/1.0/Demo/SampleData',
		function(pRequest, pResponse, fNext)
		{
			pResponse.send(200,
				{
					Count: _RawRecords.length,
					Headers: Object.keys(_RawRecords[0] || {}),
					Records: _RawRecords
				});
			return fNext();
		});
}

// ── Route: GET /1.0/Demo/Mapping ────────────────────────────────────────────────
// Returns the current mapping configuration

function registerDemoMappingRoute(pOrator)
{
	pOrator.serviceServer.get('/1.0/Demo/Mapping',
		function(pRequest, pResponse, fNext)
		{
			pResponse.send(200,
				{
					MappingFile: 'mappings/books-to-book.json',
					Configuration: _MappingConfig
				});
			return fNext();
		});
}

// ── Route: POST /1.0/Demo/Transform ─────────────────────────────────────────────
// Runs TabularTransform on the sample data with the mapping config → comprehension

function registerDemoTransformRoute(pOrator)
{
	pOrator.serviceServer.post('/1.0/Demo/Transform',
		function(pRequest, pResponse, fNext)
		{
			let tmpTransform = _Fable.MeadowIntegrationTabularTransform;
			let tmpOutcome = tmpTransform.newMappingOutcomeObject();

			tmpOutcome.ExplicitConfiguration = JSON.parse(JSON.stringify(_MappingConfig));

			for (let i = 0; i < _RawRecords.length; i++)
			{
				let tmpRecord = _RawRecords[i];

				// Initialize on first record
				if (!tmpOutcome.ImplicitConfiguration)
				{
					tmpOutcome.ImplicitConfiguration = tmpTransform.generateMappingConfigurationPrototype(
						'books-sample', tmpRecord);
					tmpOutcome.Configuration = Object.assign(
						{}, tmpOutcome.ImplicitConfiguration,
						tmpOutcome.ExplicitConfiguration,
						tmpOutcome.UserConfiguration);

					if (!('GUIDName' in tmpOutcome.Configuration))
					{
						tmpOutcome.Configuration.GUIDName = `GUID${tmpOutcome.Configuration.Entity}`;
					}

					if (!(tmpOutcome.Configuration.Entity in tmpOutcome.Comprehension))
					{
						tmpOutcome.Comprehension[tmpOutcome.Configuration.Entity] = {};
					}
				}

				tmpOutcome.ParsedRowCount++;

				let tmpSolution =
					{
						IncomingRecord: tmpRecord,
						MappingConfiguration: tmpOutcome.Configuration,
						MappingOutcome: tmpOutcome,
						RowIndex: tmpOutcome.ParsedRowCount,
						NewRecordsGUIDUniqueness: [],
						NewRecordPrototype: {},
						Fable: _Fable,
						Pict: _Fable,
						AppData: _Fable.AppData
					};

				if (tmpOutcome.Configuration.Solvers && Array.isArray(tmpOutcome.Configuration.Solvers))
				{
					let tmpSolverResults = {};
					for (let s = 0; s < tmpOutcome.Configuration.Solvers.length; s++)
					{
						_Fable.ExpressionParser.solve(
							tmpOutcome.Configuration.Solvers[s],
							tmpSolution, tmpSolverResults,
							_Fable.manifest, tmpSolution);
					}
				}

				tmpTransform.addRecordToComprehension(tmpRecord, tmpOutcome, tmpSolution.NewRecordPrototype);
			}

			// Cache for the Load step
			_LastComprehension = tmpOutcome.Comprehension;

			let tmpEntityName = tmpOutcome.Configuration ? tmpOutcome.Configuration.Entity : 'Book';
			let tmpRecords = tmpOutcome.Comprehension[tmpEntityName] || {};
			let tmpKeys = Object.keys(tmpRecords);
			let tmpSample = {};
			for (let k = 0; k < Math.min(3, tmpKeys.length); k++)
			{
				tmpSample[tmpKeys[k]] = tmpRecords[tmpKeys[k]];
			}

			pResponse.send(200,
				{
					Entity: tmpEntityName,
					TotalRecords: tmpKeys.length,
					BadRecords: tmpOutcome.BadRecords.length,
					SampleRecords: tmpSample,
					Comprehension: tmpOutcome.Comprehension
				});
			return fNext();
		});
}

// ── Route: POST /1.0/Demo/Load ──────────────────────────────────────────────────
// Pushes the last comprehension into the bookstore via IntegrationAdapter

function registerDemoLoadRoute(pOrator)
{
	pOrator.serviceServer.post('/1.0/Demo/Load',
		function(pRequest, pResponse, fNext)
		{
			let tmpEntityKeys = Object.keys(_LastComprehension);

			if (tmpEntityKeys.length === 0)
			{
				pResponse.send(400,
					{ Error: 'No comprehension available. Run the Transform step first.' });
				return fNext();
			}

			// Create a fresh REST client pointing to ourselves
			let tmpRestClient = _Fable.serviceManager.instantiateServiceProviderWithoutRegistration(
				'MeadowCloneRestClient',
				{ ServerURL: SERVER_URL });

			// Create adapter for the Book entity
			let tmpAdapter = _Fable.serviceManager.instantiateServiceProviderWithoutRegistration(
				'IntegrationAdapter',
				{
					Entity: 'Book',
					AdapterSetGUIDMarshalPrefix: 'DEMO',
					EntityGUIDMarshalPrefix: 'BK',
					ForceMarshal: true
				});

			tmpAdapter.setRestClient(tmpRestClient);

			// Add each record from the comprehension
			let tmpEntityName = tmpEntityKeys[0];
			let tmpDataMap = _LastComprehension[tmpEntityName];
			let tmpGUIDs = Object.keys(tmpDataMap);

			for (let i = 0; i < tmpGUIDs.length; i++)
			{
				tmpAdapter.addSourceRecord(tmpDataMap[tmpGUIDs[i]]);
			}

			tmpAdapter.integrateRecords(
				function(pError)
				{
					if (pError)
					{
						pResponse.send(500,
							{ Error: `Integration failed: ${pError.message || pError}` });
						return fNext();
					}

					pResponse.send(200,
						{
							Success: true,
							Entity: tmpEntityName,
							RecordsPushed: tmpGUIDs.length,
							Message: `Pushed ${tmpGUIDs.length} ${tmpEntityName} records into the bookstore database.`
						});
					return fNext();
				});
		});
}

// ── Route: GET /1.0/Demo/Books ──────────────────────────────────────────────────
// Reads books back from the in-memory database via the meadow-endpoints API

function registerDemoBooksRoute(pOrator)
{
	pOrator.serviceServer.get('/1.0/Demo/Books',
		function(pRequest, pResponse, fNext)
		{
			// Query directly from SQLite for the demo read-back
			let tmpDB = _Fable.MeadowSQLiteProvider.db;
			let tmpBooks = tmpDB.prepare(
				`SELECT IDBook, GUIDBook, Title, Genre, Type, Language, ISBN, PublicationYear
				 FROM Book WHERE Deleted = 0 ORDER BY IDBook`
			).all();

			pResponse.send(200,
				{
					Count: tmpBooks.length,
					Books: tmpBooks
				});
			return fNext();
		});
}

// ── Route: GET /1.0/Demo/Status ─────────────────────────────────────────────────

function registerDemoStatusRoute(pOrator)
{
	pOrator.serviceServer.get('/1.0/Demo/Status',
		function(pRequest, pResponse, fNext)
		{
			pResponse.send(200,
				{
					Product: 'Mapping Demo',
					Status: 'Running',
					Port: PORT,
					SampleDataFile: 'data/books-sample.csv',
					MappingFile: 'mappings/books-to-book.json',
					RecordsLoaded: _RawRecords ? _RawRecords.length : 0,
					Pipeline:
					[
						'GET  /1.0/Demo/SampleData         – raw parsed CSV records',
						'GET  /1.0/Demo/Mapping            – static mapping config (JSON file)',
						'GET  /1.0/Demo/SourceSchema       – CSV column names for visual editor',
						'GET  /1.0/Demo/TargetSchema       – Book schema as micro-DDL',
						'GET  /1.0/Demo/VisualMapping      – visual mapping list',
						'GET  /1.0/Demo/VisualMapping/:id  – single visual mapping',
						'POST /1.0/Demo/VisualMapping      – save new visual mapping',
						'PUT  /1.0/Demo/VisualMapping/:id  – update visual mapping',
						'POST /1.0/Demo/Transform          – run mapping → comprehension',
						'POST /1.0/Demo/Load               – push comprehension to bookstore',
						'GET  /1.0/Demo/Books              – read books from bookstore',
						'GET  /1.0/Books/0/20              – Meadow-Endpoints book list'
					]
				});
			return fNext();
		});
}

// ── Main startup sequence ────────────────────────────────────────────────────────

loadStaticData();

initializeDatabase(
	function(pError)
	{
		if (pError)
		{
			console.error('Failed to initialize database:', pError);
			process.exit(1);
		}

		_Orator.initialize(
			function(pInitError)
			{
				if (pInitError)
				{
					console.error('Failed to initialize Orator:', pInitError);
					process.exit(1);
				}

				// Register Meadow Book endpoints
				initializeMeadowEndpoints();

				// Register demo pipeline routes
				registerDemoStatusRoute(_Orator);
				registerDemoSampleDataRoute(_Orator);
				registerDemoMappingRoute(_Orator);
				registerDemoTransformRoute(_Orator);
				registerDemoLoadRoute(_Orator);
				registerDemoBooksRoute(_Orator);

				// Register visual mapping editor API routes
				registerDemoSourcesRoute(_Orator);
				registerDemoSourceSchemaRoute(_Orator);
				registerDemoTargetSchemaRoute(_Orator);
				registerDemoVisualMappingRoutes(_Orator);

				// Serve the web UI and pict bundles (register last — catch-all)
				registerStaticRoutes(_Orator);

				_Orator.startService(
					function(pStartError)
					{
						if (pStartError)
						{
							console.error('Failed to start server:', pStartError);
							process.exit(1);
						}

						console.log('');
						console.log('  Meadow-Integration Mapping Demo');
						console.log('  ─────────────────────────────────────────────');
						console.log(`  Web UI:    http://localhost:${PORT}/`);
						console.log(`  Status:    http://localhost:${PORT}/1.0/Demo/Status`);
						console.log(`  Books API: http://localhost:${PORT}/1.0/Books/0/20`);
						console.log('  ─────────────────────────────────────────────');
						console.log('');
					});
			});
	});
