const libCommandLineCommand = require('pict-service-commandlineutility').ServiceCommandLineCommand;

const libFS = require('fs');
const libPath = require('path');

class QuackageCommandEntityComprehensionsFromTabularFolder extends libCommandLineCommand
{
	constructor(pFable, pManifest, pServiceHash)
	{
		super(pFable, pManifest, pServiceHash);

		this.options.CommandKeyword = 'entitycomprehensionsfromtabularfolders';
		this.options.Description = 'Generate entity comprehensions from tabular folder(s).';
		this.options.Aliases.push('entity_comprehensions_from_tabular_folders');
		this.options.Aliases.push('entc_ftf');

		this.options.CommandArguments.push({ Name: '<folder>', Description: 'The folder to read tabular data from.' });

		this.options.CommandOptions.push({ Name: '-e, --entity [forced_entity]', Description: 'Force all files to a specific entity.'});
		this.options.CommandOptions.push({ Name: '-m, --mapping [mapping_file]', Description: 'The mapping hints file.'});
		this.options.CommandOptions.push({ Name: '-o, --output [output_file]', Description: 'Output file name.'});

		this.addCommand();
	}

	onRunAsync(fCallback)
	{
		let tmpOperationState = {};

		tmpOperationState.InputFolder = this.ArgumentString;
		if ((!tmpOperationState.InputFolder) || (typeof(tmpOperationState.InputFolder) != 'string') || (tmpOperationState.InputFolder.length === 0))
		{
			this.log.error('No valid folder provided.');
			return fCallback();
		}
		tmpOperationState.OutputFileName = this.CommandOptions.output;
		if ((!tmpOperationState.OutputFileName) || (typeof(tmpOperationState.OutputFileName) != 'string') || (tmpOperationState.OutputFileName.length === 0))
		{
			tmpOperationState.OutputFileName = `${process.cwd()}/Auto-Comprehension.json`;
			this.log.error(`No output filename provided.  Defaulting to: ${tmpOperationState.OutputFileName}`);
		}

		let tmpAnticipate = this.fable.newAnticipate();

		tmpAnticipate.anticipate(
			function (fNext)
			{
				this.log.trace(`Entity from tabular operation starting.  Run state:`, tmpOperationState);
				return fNext();
			}.bind(this));

		tmpAnticipate.wait(
			function (pError)
			{
				if (pError)
				{
					this.fable.log.error(`Error running entity tabular operation: ${pError}`, pError);
				}
				this.fable.log.info(`Entity from tabular operation complete!  Have a nice day.`);
			}.bind(this));
	};
}

module.exports = QuackageCommandEntityComprehensionsFromTabularFolder;