const libCommandLineCommand = require('pict-service-commandlineutility').ServiceCommandLineCommand;

const libChildProcess = require(`child_process`);
const libFS = require('fs');
const libPath = require('path');

class CommandComprehensionIntersect extends libCommandLineCommand
{
	constructor(pFable, pManifest, pServiceHash)
	{
		super(pFable, pManifest, pServiceHash);

		this.options.CommandKeyword = 'convertxlsmtoxlsx';
		this.options.Description = 'Convert XLSM files to XLSX format using LibreOffice.';
		this.options.Aliases.push('convert_xlsm_to_xlsx');

		this.options.CommandArguments.push({ Name: '<file>', Description: 'The XLSM file to convert to xlsx' });

		this.options.CommandOptions.push({ Name: '-l, --libreofficepath [libre_office_path]', Description: 'The path for the libreoffice executable.', Default: 'soffice' });

		this.options.CommandOptions.push({ Name: '-o, --output [filepath]', Description: 'The output file name.  Defaults to [existingfilename].xlsx'});

		this.addCommand();
	}

	onRunAsync(fCallback)
	{
		let tmpFile = this.ArgumentString;
		if ((!tmpFile) || (typeof(tmpFile) != 'string') || (tmpFile.length === 0))
		{
			this.log.error('No valid filename provided.');
			return fCallback();
		}

		if (!libFS.existsSync(tmpFile))
		{
			// this.log.error(`File [${tmpFile}] does not exist.  Checking in the current working directory...`);
			tmpFile = libPath.join(process.cwd(), tmpFile);
			if (!libFS.existsSync(tmpFile))
			{
				this.log.error(`File [${tmpFile}] does not exist in the current working directory.  Could not parse input file.  Aborting.`);
				return fCallback();
			}
		}

		let tmpLibreOfficePath = this.CommandOptions.libreofficepath;

		let tmpOutputFilePath = this.CommandOptions.output;
		if ((!tmpOutputFilePath) || (typeof(tmpOutputFilePath) != 'string') || (tmpOutputFilePath.length === 0))
		{
			try
			{
				tmpOutputFilePath = `${libPath.dirname(tmpFile)}/${libPath.basename(tmpFile, '.xlsm')}.xlsx`;
			}
			catch (pError)
			{
				this.log.error(`Could not infer output file name from input file [${tmpFile}].  Please provide a valid input file name.`);
				return fCallback();
			}
		}

		_Pict.log.info(`Converting [${tmpFile}] to XLSX form XLSM...`);

		const _Launcher = libChildProcess.spawn(_Pict.settings.LibreOfficePath, ['--headless', '--convert-to', 'xlsx', tmpFile]);

		_Launcher.stdout.on('data',
			(pData) =>
			{
				// console.log(`STDOUT: ${pData}`);
			});

		_Launcher.stderr.on('data',
			(pData) => {
				// console.error(`STDERR: ${pData}`);
			});

		_Launcher.on('close',
			(pExitCode) =>
			{
				this.fable.log.info(`Comprehension written to [${tmpOutputFileName}].`);
				this.fable.log.info(`Have a nice day!`);
				_Pict.log.info(`...[${tmpFileData.FilePath}] exited with code ${pExitCode}`);
				return fCallback();
			});

		// Note: Left for posterity... libreoffice does not function with the chdild_process.exec() method for some reason.
		// libChildProcess.exec(_Pict.settings.LibreOfficePath, ['--headless', '--convert-to', 'xlsx', tmpFileData.FilePath],
		// 	(pError, pStdOut, pStdErr) =>
		// 	{
		// 		if (pError)
		// 		{
		// 			_Pict.log.error('Execution error:', pError);
		// 			return;
		// 		}
		// 		_ProgressTracker.incrementProgressTracker(`XLSM to XLSX Conversion`, 1);
		// 		_ProgressTracker.logProgressTrackerStatus(`XLSM to XLSX Conversion`);
		// 		console.log('STDOUT:', pStdOut);
		// 		console.error('STDERR:', pStdErr);
		// 		return fNext();
		// 	});
	};
}

module.exports = CommandComprehensionIntersect;