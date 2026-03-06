#!/usr/bin/env node
/**
 * Example 011: Clone with SessionManager
 * ----------------------------------------
 * Demonstrates using pict-sessionmanager to manage credentials for a
 * data clone operation. The SessionManager handles authentication with
 * the source API and automatically injects session credentials into
 * all outbound REST requests during cloning.
 *
 * This example uses the programmatic API to set up SessionManager and
 * run a clone, which is equivalent to what the CLI `data-clone` command
 * does when SessionManager configuration is present in .meadow.config.json.
 *
 * Usage:  node Example-011-Clone-With-SessionManager.js
 *
 * Prerequisites:
 *   - A running Meadow API server as the clone source
 *   - A destination database (MySQL or MSSQL)
 *   - A Meadow extended schema JSON file
 *
 * Configuration:
 *   This example shows both inline configuration and file-based configuration.
 *   In production, put your SessionManager config in .meadow.config.json.
 */
const libPict = require('pict');
const libPath = require('path');

const libMeadowConnectionManager = require('../source/services/clone/Meadow-Service-ConnectionManager.js');
const libMeadowCloneRestClient = require('../source/services/clone/Meadow-Service-RestClient.js');
const libMeadowSync = require('../source/services/clone/Meadow-Service-Sync.js');
const libSessionManagerSetup = require('../source/Meadow-Integration-SessionManagerSetup.js');

// ============================================================================
// Configuration
// ============================================================================

// Source API configuration
const tmpSourceConfig = {
	ServerURL: 'https://myapp.example.com/1.0/',
	// Note: UserID and Password are NOT set here because SessionManager
	// handles authentication instead of the built-in mechanism.
	UserID: false,
	Password: false
};

// Destination database configuration
const tmpDestinationConfig = {
	Provider: 'MySQL',
	MySQL: {
		server: '127.0.0.1',
		port: 3306,
		user: 'root',
		password: '',
		database: 'meadow_clone',
		connectionLimit: 20
	}
};

// Sync configuration
const tmpSyncConfig = {
	DefaultSyncMode: 'Initial',
	PageSize: 100,
	SyncEntityList: [],
	SyncEntityOptions: {}
};

// SessionManager configuration
// This is the key addition -- it defines how to authenticate with the
// source API and how credentials are injected into REST requests.
const tmpSessionManagerConfig = {
	Sessions: {
		// Each key is a session name. You can have multiple sessions
		// for different APIs or security contexts.
		SourceAPI: {
			// Type can be 'Header', 'Cookie', or 'Both'
			Type: 'Cookie',

			// Authentication configuration
			AuthenticationMethod: 'post',
			AuthenticationURITemplate: 'https://myapp.example.com/1.0/Authenticate',
			AuthenticationRequestBody: {
				// Templates use Pict's {~D:Record.Key~} syntax.
				// Record refers to the Credentials object.
				UserName: '{~D:Record.UserName~}',
				Password: '{~D:Record.Password~}'
			},
			AuthenticationRetryCount: 2,
			AuthenticationRetryDebounce: 500,

			// Session check configuration (optional, for verifying session validity)
			CheckSessionURITemplate: 'https://myapp.example.com/1.0/CheckSession',
			CheckSessionLoginMarkerType: 'boolean',
			CheckSessionLoginMarker: 'LoggedIn',

			// Credential injection -- how the session token gets into requests
			// DomainMatch: requests to URLs containing this string get credentials
			DomainMatch: 'myapp.example.com',

			// For cookie-based auth, specify the cookie name and where in
			// the authentication response to find the value
			CookieName: 'UserSession',
			CookieValueAddress: 'SessionID',

			// Credentials to use for authentication
			// In .meadow.config.json these would be in the file.
			// You can also pass them at authenticate() time.
			Credentials: {
				UserName: 'admin',
				Password: 'my-secret-password'
			}
		}
	}
};

// ============================================================================
// Alternative: Header-based authentication
// ============================================================================
// If your API uses header-based tokens instead of cookies, configure like this:
//
// const tmpSessionManagerConfigHeader = {
// 	Sessions: {
// 		SourceAPI: {
// 			Type: 'Header',
// 			AuthenticationMethod: 'get',
// 			AuthenticationURITemplate: 'https://myapp.example.com/1.0/Authenticate/{~D:Record.LoginID~}/{~D:Record.LoginPassword~}',
// 			DomainMatch: 'myapp.example.com',
// 			HeaderName: 'x-session-token',
// 			HeaderValueTemplate: '{~D:Record.Token~}',
// 			Credentials: {
// 				LoginID: 'admin',
// 				LoginPassword: 'my-secret-password'
// 			}
// 		}
// 	}
// };

// ============================================================================
// Equivalent .meadow.config.json
// ============================================================================
// When using the CLI, all of the above goes into .meadow.config.json:
//
// {
// 	"Source": {
// 		"ServerURL": "https://myapp.example.com/1.0/"
// 	},
// 	"Destination": {
// 		"Provider": "MySQL",
// 		"MySQL": {
// 			"server": "127.0.0.1",
// 			"port": 3306,
// 			"user": "root",
// 			"password": "",
// 			"database": "meadow_clone",
// 			"connectionLimit": 20
// 		}
// 	},
// 	"SchemaPath": "./schema/Model-Extended.json",
// 	"Sync": {
// 		"DefaultSyncMode": "Initial",
// 		"PageSize": 100,
// 		"SyncEntityList": [],
// 		"SyncEntityOptions": {}
// 	},
// 	"SessionManager": {
// 		"Sessions": {
// 			"SourceAPI": {
// 				"Type": "Cookie",
// 				"AuthenticationMethod": "post",
// 				"AuthenticationURITemplate": "https://myapp.example.com/1.0/Authenticate",
// 				"AuthenticationRequestBody": {
// 					"UserName": "{~D:Record.UserName~}",
// 					"Password": "{~D:Record.Password~}"
// 				},
// 				"CheckSessionURITemplate": "https://myapp.example.com/1.0/CheckSession",
// 				"CheckSessionLoginMarker": "LoggedIn",
// 				"DomainMatch": "myapp.example.com",
// 				"CookieName": "UserSession",
// 				"CookieValueAddress": "SessionID",
// 				"Credentials": {
// 					"UserName": "admin",
// 					"Password": "my-secret-password"
// 				}
// 			}
// 		}
// 	}
// }
//
// Then run:  mdwint clone --schema_path ./schema/Model-Extended.json

// ============================================================================
// Clone Execution
// ============================================================================

console.log('=== Example 011: Clone with SessionManager ===\n');

// Create a Pict instance (needed for SessionManager's template engine)
let _Fable = new libPict({ LogLevel: 3 });

// Register clone services
_Fable.serviceManager.addServiceType('MeadowCloneRestClient', libMeadowCloneRestClient);
_Fable.serviceManager.instantiateServiceProvider('MeadowCloneRestClient', tmpSourceConfig);

_Fable.serviceManager.addServiceType('MeadowConnectionManager', libMeadowConnectionManager);
_Fable.serviceManager.instantiateServiceProvider('MeadowConnectionManager', tmpDestinationConfig);

_Fable.serviceManager.addServiceType('MeadowSync', libMeadowSync);

// Initialize SessionManager from config
let tmpSessionManager = libSessionManagerSetup.initializeSessionManager(_Fable, tmpSessionManagerConfig);
if (tmpSessionManager)
{
	console.log('SessionManager initialized with sessions:', Object.keys(tmpSessionManager.sessions).join(', '));

	// Connect SessionManager to the clone RestClient's internal HTTP client.
	// This means every REST request made during cloning will automatically
	// have session credentials injected.
	libSessionManagerSetup.connectSessionManagerToRestClient(_Fable, _Fable.MeadowCloneRestClient.restClient);
	console.log('SessionManager connected to clone RestClient.\n');
}
else
{
	console.log('No SessionManager sessions configured.\n');
}

// Run the clone workflow
_Fable.Utility.waterfall(
	[
		// Step 1: Authenticate SessionManager sessions
		(fStageComplete) =>
		{
			if (!tmpSessionManager)
			{
				return fStageComplete();
			}

			console.log('Step 1: Authenticating SessionManager sessions...');
			libSessionManagerSetup.authenticateSessions(_Fable,
				(pError) =>
				{
					if (pError)
					{
						console.error(`  Authentication failed: ${pError.message}`);
						console.error('  (This is expected if there is no actual server running.)');
						return fStageComplete(pError);
					}
					console.log('  All sessions authenticated.\n');
					return fStageComplete();
				});
		},

		// Step 2: Connect to destination database
		// (fStageComplete) =>
		// {
		// 	console.log('Step 2: Connecting to destination database...');
		// 	_Fable.MeadowConnectionManager.connect(
		// 		(pError, pConnectionPool) =>
		// 		{
		// 			if (pError)
		// 			{
		// 				console.error(`  Database connection failed: ${pError.message}`);
		// 				return fStageComplete(pError);
		// 			}
		// 			console.log('  Connected.\n');
		// 			return fStageComplete(null, pConnectionPool);
		// 		});
		// },

		// Step 3: Load schema and sync
		// (pConnectionPool, fStageComplete) =>
		// {
		// 	const tmpSchemaPath = libPath.resolve('./schema/Model-Extended.json');
		// 	console.log(`Step 3: Loading schema from ${tmpSchemaPath}...`);
		// 	// ... load schema and run sync
		// },
	],
	(pError) =>
	{
		if (pError)
		{
			console.error(`\nClone ended with error: ${pError.message}`);
			console.log('\nNote: This example is designed to demonstrate the configuration');
			console.log('pattern. To run a real clone, point the Source and Destination');
			console.log('settings at real servers and uncomment the database/sync steps.');
		}
		else
		{
			console.log('\nClone complete.');
		}

		console.log('\n=== Example Complete ===');
	});
