const libCommandLineCommand = require('pict-service-commandlineutility').ServiceCommandLineCommand;

const MeadowIntegrationServer = require('../../restserver/Meadow-Integration-Server.js');

class MeadowIntegrationCommandServe extends libCommandLineCommand
{
	constructor(pFable, pManifest, pServiceHash)
	{
		super(pFable, pManifest, pServiceHash);

		this.options.CommandKeyword = 'serve';
		this.options.Description = 'Start the Meadow Integration REST API server.';
		this.options.Aliases.push('server');
		this.options.Aliases.push('rest');

		this.options.CommandOptions.push({ Name: '-p, --port [port]', Description: 'The port to listen on.  Defaults to 8086.', Default: '8086' });

		this.addCommand();
	}

	onRunAsync(fCallback)
	{
		let tmpPort = parseInt(this.CommandOptions.port, 10) || 8086;

		// Also respect the environment variable
		if (process.env.MEADOW_INTEGRATION_PORT)
		{
			tmpPort = parseInt(process.env.MEADOW_INTEGRATION_PORT, 10) || tmpPort;
		}

		this.log.info(`Starting Meadow Integration REST server on port ${tmpPort}...`);

		let tmpServer = new MeadowIntegrationServer(
			{
				APIServerPort: tmpPort
			});

		tmpServer.start(
			(pError) =>
			{
				if (pError)
				{
					this.log.error(`Failed to start server: ${pError}`, pError);
					return fCallback(pError);
				}
				// Server is running; don't call fCallback so the process stays alive.
			});
	}
}

module.exports = MeadowIntegrationCommandServe;
