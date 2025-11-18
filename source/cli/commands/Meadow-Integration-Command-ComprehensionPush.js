const libCLICommandLineCommand = require('pict-service-commandlineutility').ServiceCommandLineCommand;

const libPath = require('path');

const libIntegrationAdapter = require('../../Meadow-Service-Integration-Adapter.js');

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

		this.options.CommandOptions.push({ Name: '-p, --prefix [guid_prefix]', Description: 'GUID Prefix for the comprehension push.'});
		this.options.CommandOptions.push({ Name: '-e, --entityguidprefix [entity_guid_prefix]', Description: 'GUID Prefix for each entity.'});

		this.addCommand();

		this.comprehension = {};
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

		let tmpAnticipate = this.fable.newAnticipate();
		this.fable.log.info(`Pushing comprehension file [${tmpComprehensionPath}] to the Meadow Endpoints APIs.`);

		this.fable.log.info(`Initializing and configuring data integration adapters...`);
		this.fable.serviceManager.addServiceType('IntegrationAdapter', libIntegrationAdapter);

		tmpAnticipate.anticipate(
			function (fCallback)
			{
				try
				{
					this.fable.log.info(`Loading Comprehension File...`);
					tmpComprehensionPath = libPath.resolve(tmpComprehensionPath);
					this.comprehension = require(tmpComprehensionPath);
					return fCallback();
				}
				catch(pError)
				{
					this.fable.log.error(`Error loading comprehension file [${tmpComprehensionPath}]: ${pError}`, pError);
					return fCallback(pError);
				}
			}.bind(this));

		tmpAnticipate.anticipate(
			(fCallback) =>
			{
				this.fable.log.info(`Wiring up Integration Adapters...`);

				let tmpIntegrationAdapterSet = Object.keys(this.comprehension);

				try
				{
					for (let i = 0; i < tmpIntegrationAdapterSet.length; i++)
					{
						let tmpAdapterKey = tmpIntegrationAdapterSet[i];
						libIntegrationAdapter.getAdapter(this.fable, tmpAdapterKey, this.getCapitalLettersAsString(tmpAdapterKey), { SimpleMarshal: true, ForceMarshal: true });
						this.runAdapter(tmpAnticipate, tmpAdapterKey, this.comprehension[tmpAdapterKey]);
					}
				}
				catch (pError)
				{
					this.fable.log.error(`Error wiring up integration adapters: ${pError}`, pError);
					return fCallback(pError);
				}

				return fCallback();
			});

		tmpAnticipate.wait(
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
		return this.pushComprehension((pError)=> 
		{
			return fCallback(pError);
		});
	}
}

module.exports = PushComprehensionsViaIntegration;
