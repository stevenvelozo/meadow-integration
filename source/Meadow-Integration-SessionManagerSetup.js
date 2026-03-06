/**
 * Meadow Integration - Session Manager Setup
 *
 * Utility to initialize pict-sessionmanager from configuration.
 * Used by CLI, Console UI, and REST server entry points.
 * Modules that use meadow-integration services directly should
 * manage their own session lifecycle.
 *
 * @author Steven Velozo <steven@velozo.com>
 */
const libPictSessionManager = require('pict-sessionmanager');

/**
 * Initialize a SessionManager on a fable/pict instance from a config object.
 *
 * @param {object} pFable - A fable or pict instance
 * @param {object} pSessionManagerConfig - The SessionManager configuration block
 * @param {object} pSessionManagerConfig.Sessions - Map of session name to session configuration
 * @returns {object|false} The instantiated SessionManager, or false if no sessions configured
 */
function initializeSessionManager(pFable, pSessionManagerConfig)
{
	if (!pFable)
	{
		return false;
	}
	if (!pSessionManagerConfig || typeof(pSessionManagerConfig) !== 'object')
	{
		return false;
	}
	if (!pSessionManagerConfig.Sessions || typeof(pSessionManagerConfig.Sessions) !== 'object')
	{
		return false;
	}

	let tmpSessionNames = Object.keys(pSessionManagerConfig.Sessions);
	if (tmpSessionNames.length < 1)
	{
		return false;
	}

	pFable.serviceManager.addServiceType('SessionManager', libPictSessionManager);
	pFable.serviceManager.instantiateServiceProvider('SessionManager');

	for (let i = 0; i < tmpSessionNames.length; i++)
	{
		let tmpSessionName = tmpSessionNames[i];
		let tmpSessionConfig = pSessionManagerConfig.Sessions[tmpSessionName];
		pFable.SessionManager.addSession(tmpSessionName, tmpSessionConfig);
	}

	return pFable.SessionManager;
}

/**
 * Authenticate all configured sessions that have Credentials set.
 *
 * @param {object} pFable - A fable or pict instance with SessionManager instantiated
 * @param {function} fCallback - Callback (pError)
 */
function authenticateSessions(pFable, fCallback)
{
	if (!pFable || !pFable.SessionManager)
	{
		return fCallback();
	}

	let tmpSessionNames = Object.keys(pFable.SessionManager.sessions);
	if (tmpSessionNames.length < 1)
	{
		return fCallback();
	}

	pFable.Utility.eachLimit(tmpSessionNames, 1,
		(pSessionName, fSessionCallback) =>
		{
			let tmpSession = pFable.SessionManager.getSession(pSessionName);
			let tmpCredentials = tmpSession.Configuration.Credentials;

			if (!tmpCredentials || typeof(tmpCredentials) !== 'object' || Object.keys(tmpCredentials).length < 1)
			{
				pFable.log.info(`SessionManager setup: Session [${pSessionName}] has no credentials configured; skipping authentication.`);
				return fSessionCallback();
			}

			pFable.log.info(`SessionManager setup: Authenticating session [${pSessionName}]...`);
			pFable.SessionManager.authenticate(pSessionName, tmpCredentials,
				(pError, pSessionState) =>
				{
					if (pError)
					{
						pFable.log.error(`SessionManager setup: Failed to authenticate session [${pSessionName}]: ${pError.message}`);
						return fSessionCallback(pError);
					}

					pFable.log.info(`SessionManager setup: Session [${pSessionName}] authenticated successfully.`);
					return fSessionCallback();
				});
		},
		(pError) =>
		{
			return fCallback(pError);
		});
}

/**
 * Connect the SessionManager to a RestClient so credentials are injected automatically.
 *
 * If no RestClient is provided, SessionManager will use the default
 * RestClient on the fable/pict instance (instantiating it if needed).
 *
 * @param {object} pFable - A fable or pict instance with SessionManager instantiated
 * @param {object} [pRestClient] - A fable RestClient instance to connect to (optional)
 * @returns {boolean} True if connected
 */
function connectSessionManagerToRestClient(pFable, pRestClient)
{
	if (!pFable || !pFable.SessionManager)
	{
		return false;
	}

	// SessionManager.connectToRestClient handles null by using the default
	// pict RestClient (instantiating it if necessary).
	pFable.SessionManager.connectToRestClient(pRestClient);
	return true;
}

module.exports = (
	{
		initializeSessionManager: initializeSessionManager,
		authenticateSessions: authenticateSessions,
		connectSessionManagerToRestClient: connectSessionManagerToRestClient
	});
