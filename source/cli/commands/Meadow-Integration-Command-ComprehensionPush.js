const libCLICommandLineCommand = require('pict-service-commandlineutility').ServiceCommandLineCommand;

const libPath = require('path');

const libIntegrationAdapter = require('../../Meadow-Service-Integration-Adapter.js');
const libMeadowCloneRestClient = require('../../services/clone/Meadow-Service-RestClient.js');
const libSessionManagerSetup = require('../../Meadow-Integration-SessionManagerSetup.js');

class PushComprehensionsViaIntegration extends libCLICommandLineCommand
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this.options.CommandKeyword = 'load_comprehension';
		this.options.Description = 'Load a comprehension into a set of Meadow REST APIs.';
		this.options.Aliases.push('load');
		this.options.Aliases.push('push');

		this.options.CommandArguments.push({ Name: '<comprehension_file>', Description: 'The comprehension file path.' });

		this.options.CommandOptions.push({ Name: '-p, --prefix [guid_prefix]', Description: 'GUID Prefix for the comprehension push.' });
		this.options.CommandOptions.push({ Name: '-e, --entityguidprefix [entity_guid_prefix]', Description: 'GUID Prefix for each entity.' });

		this.options.CommandOptions.push({ Name: '-a, --api_server [api_server]', Description: 'The API server URL.' });
		this.options.CommandOptions.push({ Name: '-u, --api_username [api_username]', Description: 'The API username to authenticate with.' });
		this.options.CommandOptions.push({ Name: '-w, --api_password [api_password]', Description: 'The API password to authenticate with.' });

		this.options.CommandOptions.push({ Name: '--bulkupsert [bulk_upsert]', Description: 'Enable bulk upsert mode (true/false). Default: true.', DefaultValue: 'true' });
		this.options.CommandOptions.push({ Name: '--batchsize [batch_size]', Description: 'Bulk upsert batch size. Default: 100.', DefaultValue: '100' });
		this.options.CommandOptions.push({ Name: '--progressinterval [progress_interval]', Description: 'Per-entity progress log interval (records). Default: 100.', DefaultValue: '100' });
		this.options.CommandOptions.push({ Name: '--metaprogressinterval [meta_progress_interval]', Description: 'Meta (cross-entity) progress log interval. Default: 0 (disabled).', DefaultValue: '0' });
		this.options.CommandOptions.push({ Name: '--allowguidtruncation', Description: 'Allow automatic GUID prefix truncation when GUIDs exceed max length.' });
		this.options.CommandOptions.push({ Name: '--logfile [logfile_path]', Description: 'Path to write log output.' });

		this.addCommand();

		this.comprehension = {};
	}

	_resolveConfig()
	{
		const tmpConfig = JSON.parse(JSON.stringify(this.fable.ProgramConfiguration));

		// Apply command-line overrides for Source (API)
		if (!tmpConfig.Source)
		{
			tmpConfig.Source = {};
		}
		if (this.CommandOptions.api_server)
		{
			tmpConfig.Source.ServerURL = this.CommandOptions.api_server;
		}
		if (this.CommandOptions.api_username)
		{
			tmpConfig.Source.UserID = this.CommandOptions.api_username;
		}
		if (this.CommandOptions.api_password)
		{
			tmpConfig.Source.Password = this.CommandOptions.api_password;
		}

		return tmpConfig;
	}

	runAdapter(pAnticipate, pAdapter, pDataMap, fMarshalRecord)
	{
		let tmpAdapter = this.fable.servicesMap.IntegrationAdapter[pAdapter];

		if (this.CommandOptions.prefix)
		{
			tmpAdapter.AdapterSetGUIDMarshalPrefix = this.CommandOptions.prefix;
		}
		if (this.CommandOptions.entityguidprefix)
		{
			tmpAdapter.EntityGUIDMarshalPrefix = this.CommandOptions.entityguidprefix;
		}

		let tmpMarshalRecordFunction = fMarshalRecord;
		if (!tmpAdapter)
		{
			throw new Error(`Adapter [${pAdapter}] not found.`);
		}
		if (!pDataMap)
		{
			this.log.info(`No records to push for [${pAdapter}].`);
			return false;
		}
		pAnticipate.anticipate(
			(fDone) =>
			{
				for (const tmpRecord in pDataMap)
				{
					tmpAdapter.addSourceRecord(pDataMap[tmpRecord]);
				}
				return fDone()
			});
		pAnticipate.anticipate(
			(fDone) =>
			{
				tmpAdapter.integrateRecords(fDone, tmpMarshalRecordFunction);
			});
	}

	getCapitalLettersAsString(inputString)
	{
		let tmpRegex = /[A-Z]/g;
		let tmpMatch = inputString.match(tmpRegex);
		let tmpString = tmpMatch ? tmpMatch.join('') : 'UNK';
		return tmpString;
	}

	pushComprehension(fCallback)
	{
		let tmpComprehensionPath = this.ArgumentString;
		let tmpConfig = this._resolveConfig();

		this.fable.log.info(`Pushing comprehension file [${tmpComprehensionPath}] to the Meadow Endpoints APIs.`);

		// --- Setup REST client ---
		this.fable.serviceManager.addServiceType('MeadowCloneRestClient', libMeadowCloneRestClient);

		let tmpRestClientOptions = {};
		if (tmpConfig.Source && tmpConfig.Source.ServerURL)
		{
			tmpRestClientOptions.ServerURL = tmpConfig.Source.ServerURL;
		}
		if (tmpConfig.Source && tmpConfig.Source.UserID)
		{
			tmpRestClientOptions.UserID = tmpConfig.Source.UserID;
		}
		if (tmpConfig.Source && tmpConfig.Source.Password)
		{
			tmpRestClientOptions.Password = tmpConfig.Source.Password;
		}

		this.fable.serviceManager.instantiateServiceProvider('MeadowCloneRestClient', tmpRestClientOptions);

		// --- Initialize SessionManager if configured ---
		let tmpSessionManager = libSessionManagerSetup.initializeSessionManager(this.fable, tmpConfig.SessionManager);
		if (tmpSessionManager)
		{
			libSessionManagerSetup.connectSessionManagerToRestClient(this.fable, this.fable.MeadowCloneRestClient.restClient);
		}

		// --- Setup Integration Adapter service type ---
		this.fable.log.info(`Initializing and configuring data integration adapters...`);
		this.fable.serviceManager.addServiceType('IntegrationAdapter', libIntegrationAdapter);

		// --- Resolve adapter options from CLI flags + config ---
		let tmpBulkUpsertEnabled = (this.CommandOptions.bulkupsert !== 'false');
		let tmpBatchSize = parseInt(this.CommandOptions.batchsize) || 100;
		let tmpProgressInterval = parseInt(this.CommandOptions.progressinterval) || 100;
		let tmpMetaProgressInterval = parseInt(this.CommandOptions.metaprogressinterval) || 0;
		let tmpAllowGUIDTruncation = !!this.CommandOptions.allowguidtruncation;

		// Build shared adapter options
		let tmpAdapterOptions = {
			SimpleMarshal: true,
			ForceMarshal: true,
			BulkUpsertBatchSize: tmpBatchSize,
			RecordThresholdForBulkUpsert: tmpBulkUpsertEnabled ? 1000 : Infinity,
			ProgressLogInterval: tmpProgressInterval,
			AllowGUIDTruncation: tmpAllowGUIDTruncation
		};

		this.fable.Utility.waterfall(
			[
				(fStageComplete) =>
				{
					// Authenticate SessionManager sessions (if configured)
					if (tmpSessionManager)
					{
						this.log.info('Authenticating SessionManager sessions...');
						libSessionManagerSetup.authenticateSessions(this.fable,
							(pError) =>
							{
								if (pError)
								{
									this.log.error('Error authenticating SessionManager sessions.', pError);
								}
								return fStageComplete();
							});
					}
					else
					{
						return fStageComplete();
					}
				},
				(fStageComplete) =>
				{
					// Authenticate with the API server using built-in credentials
					if (tmpConfig.Source && tmpConfig.Source.UserID && tmpConfig.Source.Password)
					{
						this.log.info('Authenticating with API server...');
						this.fable.MeadowCloneRestClient.authenticate(
							(pError, pResponse) =>
							{
								if (pError)
								{
									this.log.error('Error authenticating with API server.', pError);
								}
								else
								{
									this.log.info(`Authenticated with API server as [${tmpConfig.Source.UserID}] at [${tmpConfig.Source.ServerURL}]`);
								}
								return fStageComplete();
							});
					}
					else
					{
						this.log.info('No Source credentials configured; skipping built-in authentication.');
						return fStageComplete();
					}
				},
				(fStageComplete) =>
				{
					// Load comprehension file
					try
					{
						this.fable.log.info(`Loading Comprehension File...`);
						tmpComprehensionPath = libPath.resolve(tmpComprehensionPath);
						this.comprehension = require(tmpComprehensionPath);
						return fStageComplete();
					}
					catch (pError)
					{
						this.fable.log.error(`Error loading comprehension file [${tmpComprehensionPath}]: ${pError}`, pError);
						return fStageComplete(pError);
					}
				},
				(fStageComplete) =>
				{
					this.fable.log.info(`Wiring up Integration Adapters...`);

					let tmpIntegrationAdapterSet = Object.keys(this.comprehension);

					// Count total records for meta progress tracking
					let tmpTotalRecords = 0;
					for (let i = 0; i < tmpIntegrationAdapterSet.length; i++)
					{
						let tmpAdapterKey = tmpIntegrationAdapterSet[i];
						if (this.comprehension[tmpAdapterKey] && typeof(this.comprehension[tmpAdapterKey]) === 'object')
						{
							tmpTotalRecords += Object.keys(this.comprehension[tmpAdapterKey]).length;
						}
					}

					// Start meta progress tracker if interval is configured
					let tmpMetaProgressHash = false;
					if (tmpMetaProgressInterval > 0 && tmpTotalRecords > 0)
					{
						this.fable.instantiateServiceProviderIfNotExists('ProgressTrackerSet');
						tmpMetaProgressHash = this.fable.getUUID();
						this.fable.ProgressTrackerSet.createProgressTracker(tmpMetaProgressHash, tmpTotalRecords);
						this.fable.ProgressTrackerSet.startProgressTracker(tmpMetaProgressHash);
						this.fable.log.info(`Meta progress: ${tmpTotalRecords} total records across ${tmpIntegrationAdapterSet.length} entities.`);
					}

					let tmpAnticipate = this.fable.newAnticipate();

					try
					{
						for (let i = 0; i < tmpIntegrationAdapterSet.length; i++)
						{
							let tmpAdapterKey = tmpIntegrationAdapterSet[i];
							let tmpAdapter = libIntegrationAdapter.getAdapter(this.fable, tmpAdapterKey, this.getCapitalLettersAsString(tmpAdapterKey), tmpAdapterOptions);

							// Inject the REST client
							tmpAdapter.setRestClient(this.fable.MeadowCloneRestClient);

							// Wire up meta progress tracking
							if (tmpMetaProgressHash)
							{
								tmpAdapter.MetaProgressTrackerHash = tmpMetaProgressHash;
								tmpAdapter.MetaProgressTrackerLogInterval = tmpMetaProgressInterval;
							}

							this.runAdapter(tmpAnticipate, tmpAdapterKey, this.comprehension[tmpAdapterKey]);
						}
					}
					catch (pError)
					{
						this.fable.log.error(`Error wiring up integration adapters: ${pError}`, pError);
						return fStageComplete(pError);
					}

					tmpAnticipate.wait(
						(pError) =>
						{
							// End meta progress tracker
							if (tmpMetaProgressHash)
							{
								this.fable.ProgressTrackerSet.endProgressTracker(tmpMetaProgressHash);
								this.fable.ProgressTrackerSet.logProgressTrackerStatus(tmpMetaProgressHash);
							}
							return fStageComplete(pError);
						});
				}
			],
			(pError) =>
			{
				if (pError)
				{
					this.fable.log.error(`Error importing comprehension file.`, pError);
					return fCallback(pError);
				}
				this.fable.log.info(`Finished importing comprehension file.`);
				return fCallback(pError);
			});
	}

	onRunAsync(fCallback)
	{
		return this.pushComprehension((pError) =>
		{
			return fCallback(pError);
		});
	}
}

module.exports = PushComprehensionsViaIntegration;
