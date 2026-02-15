const libPict = require('pict');
const libOrator = require('orator');
const libOratorServiceServerRestify = require('orator-serviceserver-restify');

const libEndpoints = require('./Meadow-Integration-Server-Endpoints.js');

class MeadowIntegrationServer
{
	constructor(pSettings)
	{
		let tmpSettings = Object.assign(
			{
				Product: 'Meadow-Integration-Server',
				ProductVersion: require('../../package.json').version,

				APIServerPort: 8086,

				// The default working directory for file operations
				WorkingDirectory: process.cwd()
			}, pSettings);

		this._Settings = tmpSettings;

		// Use Pict instead of Fable so parseTemplate and ExpressionParser are available
		this._Fable = new libPict(tmpSettings);

		// Register the Restify service server type
		this._Fable.serviceManager.addServiceType('OratorServiceServer', libOratorServiceServerRestify);

		// Create the Orator service
		this._Orator = new libOrator(this._Fable, {});

		// Initialize core fable services that the endpoints rely on
		this._Fable.instantiateServiceProvider('CSVParser');
		this._Fable.instantiateServiceProvider('FilePersistence');
		this._Fable.instantiateServiceProvider('DataGeneration');
	}

	start(fCallback)
	{
		let tmpCallback = (typeof(fCallback) === 'function') ? fCallback : () => {};

		this._Orator.initialize(
			(pError) =>
			{
				if (pError)
				{
					this._Fable.log.error(`Error initializing Orator: ${pError}`, pError);
					return tmpCallback(pError);
				}

				// Register all endpoints
				libEndpoints.connectRoutes(this._Fable, this._Orator);

				this._Orator.startService(
					(pStartError) =>
					{
						if (pStartError)
						{
							this._Fable.log.error(`Error starting Orator service: ${pStartError}`, pStartError);
							return tmpCallback(pStartError);
						}

						this._Fable.log.info(`Meadow Integration Server running on port ${this._Settings.APIServerPort}`);
						return tmpCallback();
					});
			});
	}

	stop(fCallback)
	{
		let tmpCallback = (typeof(fCallback) === 'function') ? fCallback : () => {};

		this._Orator.stopService(
			(pError) =>
			{
				if (pError)
				{
					this._Fable.log.error(`Error stopping Orator service: ${pError}`, pError);
				}
				return tmpCallback(pError);
			});
	}
}

module.exports = MeadowIntegrationServer;
