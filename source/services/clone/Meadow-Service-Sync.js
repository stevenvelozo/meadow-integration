const libFableServiceProviderBase = require('fable-serviceproviderbase');
const libMeadowSyncEntityInitial = require('./Meadow-Service-Sync-Entity-Initial.js');
const libMeadowSyncEntityOngoing = require('./Meadow-Service-Sync-Entity-Ongoing.js');

class MeadowSync extends libFableServiceProviderBase
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this.serviceType = 'MeadowSync';

		if (!this.fable.ServiceManager.servicesMap.hasOwnProperty('MeadowSyncEntityInitial'))
		{
			this.fable.ServiceManager.addServiceType('MeadowSyncEntityInitial', libMeadowSyncEntityInitial);
		}

		if (!this.fable.ServiceManager.servicesMap.hasOwnProperty('MeadowSyncEntityOngoing'))
		{
			this.fable.ServiceManager.addServiceType('MeadowSyncEntityOngoing', libMeadowSyncEntityOngoing);
		}

		// If this is empty, we will sync everything in the loaded Schema.
		// Otherwise, we will go through this list and sync them in this order.
		this.SyncEntityList = [];
		if (this.fable.ProgramConfiguration.hasOwnProperty('SyncEntityList') && Array.isArray(this.fable.ProgramConfiguration.SyncEntityList))
		{
			this.SyncEntityList = JSON.parse(JSON.stringify(this.fable.ProgramConfiguration.SyncEntityList));
		}
		else if (this.options.hasOwnProperty('SyncEntityList') && Array.isArray(this.options.SyncEntityList))
		{
			this.SyncEntityList = JSON.parse(JSON.stringify(this.options.SyncEntityList));
		}

		// Per-entity sync options.
		this.SyncEntityOptions = {};
		if (this.fable.ProgramConfiguration.hasOwnProperty('SyncEntityOptions') && typeof(this.fable.ProgramConfiguration.SyncEntityOptions) == 'object')
		{
			this.SyncEntityOptions = JSON.parse(JSON.stringify(this.fable.ProgramConfiguration.SyncEntityOptions));
		}
		else if (this.options.hasOwnProperty('SyncEntityOptions') && typeof(this.options.SyncEntityOptions) == 'object')
		{
			this.SyncEntityOptions = JSON.parse(JSON.stringify(this.options.SyncEntityOptions));
		}

		// When true, after syncing active records, also sync records marked Deleted=1 on the source.
		this.SyncDeletedRecords = false;
		if (this.fable.ProgramConfiguration.hasOwnProperty('SyncDeletedRecords'))
		{
			this.SyncDeletedRecords = !!this.fable.ProgramConfiguration.SyncDeletedRecords;
		}
		else if (this.options.hasOwnProperty('SyncDeletedRecords'))
		{
			this.SyncDeletedRecords = !!this.options.SyncDeletedRecords;
		}

		this.MeadowSchema = false;
		this.MeadowSchemaTableList = false;

		this.MeadowSyncEntities = {};

		this.SyncMode = 'Initial';

		this.fable._MeadowPrototype = require('meadow');
		this.fable.Meadow = this.fable._MeadowPrototype.new(this.fable, 'MeadowSync-Prototype');
	}

	loadMeadowSchema(pSchema, fCallback)
	{
		this.meadowSchema = pSchema;
		this.MeadowSchemaTableList = Object.keys(this.meadowSchema.Tables);

		this.log.info(`Loading schema for ${this.MeadowSchemaTableList.length} tables (mode: ${this.SyncMode})`);

		let tmpEntityIndex = 0;
		let tmpErrorCount = 0;
		let tmpSuccessCount = 0;

		this.fable.Utility.eachLimit(this.MeadowSchemaTableList, 1,
			(pEntitySchemaName, fSyncInitializationComplete) =>
			{
				tmpEntityIndex++;
				const tmpEntitySchema = this.meadowSchema.Tables[pEntitySchemaName];
				// If this is in the entity list or none is specified, create the sync entity object.
				if (this.SyncEntityList.length < 1 || this.SyncEntityList.indexOf(tmpEntitySchema.TableName) > -1)
				{
					const tmpSyncEntityOptions = {
						MeadowEntitySchema: tmpEntitySchema,
						ConnectionPool: this.options.ConnectionPool,
						PageSize: this.options.PageSize || 100,
						SyncDeletedRecords: this.SyncDeletedRecords,
					};

					let tmpSyncEntity;

					if (this.SyncMode == 'Ongoing')
					{
						tmpSyncEntity = this.fable.serviceManager.instantiateServiceProvider('MeadowSyncEntityOngoing', tmpSyncEntityOptions, `SyncEntity-${tmpEntitySchema.TableName}`);
					}
					else
					{
						tmpSyncEntity = this.fable.serviceManager.instantiateServiceProvider('MeadowSyncEntityInitial', tmpSyncEntityOptions, `SyncEntity-${tmpEntitySchema.TableName}`);
					}

					this.MeadowSyncEntities[tmpEntitySchema.TableName] = tmpSyncEntity;

					return tmpSyncEntity.initialize((pInitError) =>
					{
						if (pInitError)
						{
							tmpErrorCount++;
							this.log.warn(`Failed to initialize ${tmpEntitySchema.TableName}: ${pInitError}`);
						}
						else
						{
							tmpSuccessCount++;
						}
						// Always continue to next entity regardless of individual errors
						return fSyncInitializationComplete();
					});
				}
				else
				{
					return fSyncInitializationComplete();
				}
			},
			(pSyncInitializationError) =>
			{
				if (pSyncInitializationError)
				{
					this.log.error(`MeadowSync Error creating sync objects: ${pSyncInitializationError}`, pSyncInitializationError);
				}

				this.log.info(`Entity sync objects created: ${tmpSuccessCount} succeeded, ${tmpErrorCount} failed.`);

				if (this.SyncEntityList.length < 1)
				{
					this.SyncEntityList = Object.keys(this.MeadowSyncEntities);
				}

				return fCallback(pSyncInitializationError);
			});
	}

	syncEntity(pEntityHash, fCallback)
	{
		if (!this.MeadowSyncEntities.hasOwnProperty(pEntityHash))
		{
			this.log.warn(`MeadowSync.syncEntity called for an entity that does not exist: ${pEntityHash}`);
			return fCallback();
		}

		this.MeadowSyncEntities[pEntityHash].sync((pError) =>
		{
			if (pError)
			{
				this.log.error(`Sync failed for ${pEntityHash}: ${pError}`);
			}
			return fCallback(pError);
		});
	}

	syncAll(fCallback)
	{
		this.fable.Utility.eachLimit(this.SyncEntityList, 1,
			(pEntityHash, fSyncEntityComplete) =>
			{
				this.syncEntity(pEntityHash, fSyncEntityComplete);
			},
			(pSyncError) =>
			{
				if (pSyncError)
				{
					this.log.error(`MeadowSync Error syncing entities: ${pSyncError}`, pSyncError);
				}
				this.log.info('Entity sync complete!');
				return fCallback(pSyncError);
			});
	}
}

module.exports = MeadowSync;
