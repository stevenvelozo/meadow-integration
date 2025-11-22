const libCommandLineCommand = require('pict-service-commandlineutility').ServiceCommandLineCommand;

const libFS = require('fs');
const libPath = require('path');
const libReadline = require('readline');

class QuackageCommandTSVCheck extends libCommandLineCommand
{
	constructor(pFable, pManifest, pServiceHash)
	{
		super(pFable, pManifest, pServiceHash);

		this.options.CommandKeyword = 'tsvcheck';
		this.options.Description = 'Check a TSV for Statistics.';
		this.options.Aliases.push('tsv_c');
		this.options.Aliases.push('tsv_check');

		this.options.CommandArguments.push({ Name: '<file>', Description: 'The tsv file to load.' });

		this.options.CommandOptions.push({ Name: '-f, --file [filepath]', Description: 'The tsv file to read.'});
		this.options.CommandOptions.push({ Name: '-o, --output [filepath]', Description: 'The statistics output file.  Defaults to ./TSV-Stats-[filename].json'});
		this.options.CommandOptions.push({ Name: '-r, --records', Description: 'Output the full record dump of the TSV file in the statistics object.'});

		this.options.CommandOptions.push({ Name: '-q, --quotedelimiter [quotedelimiter]', Description: 'The quote delimiter character, defaulted to nothing (no quote delimiter) for TSV files.  Quote delimiters are required to be doubled (e.g. "" if it were double quotes) if it is a character rather than a delimiter.', Default: '"'});

		this.addCommand();
	}

	onRunAsync(fCallback)
	{
		let tmpOperationState = (
			{
				RawInputFile: this.ArgumentString,
				RawOutputFile: this.CommandOptions.output
			});

		if ((!tmpOperationState.RawInputFile) || (typeof(tmpOperationState.RawInputFile) != 'string') || (tmpOperationState.length === 0))
		{
			this.log.error(`No valid filename provided.`);
			return fCallback();
		}
		if ((!tmpOperationState.RawOutputFile) || (typeof(tmpOperationState.RawOutputFile) != 'string') || (tmpOperationState.RawOutputFile.length === 0))
		{
			tmpOperationState.RawOutputFile = `${process.cwd()}/TSV-Stats-${libPath.basename(tmpOperationState.RawInputFile)}.json`;
			this.log.error(`No valid output filename provided.  Defaulting to ${tmpOperationState.RawOutputFile}`);
		}
		if (this.CommandOptions.records)
		{
			tmpOperationState.OutputAllRecords = true;
		}

		// Initialize the fable TSV parser and file management stuff
		this.fable.instantiateServiceProvider('CSVParser');
		this.fable.CSVParser.Delimiter = '\t'; // TSV files are tab-delimited
		// This is set because TSV and CSV deviate in default quoting behavior, so there is a default parameter to fix the CSV parser to take quotes properly from TSV
		this.fable.CSVParser.QuoteCharacter = this.CommandOptions.quotedelimiter;
		this.fable.instantiateServiceProvider('FilePersistence');
		// Initialize the meadow integration tabular data check service
		this.fable.addAndInstantiateServiceTypeIfNotExists('MeadowIntegrationTabularCheck', require('../../services/tabular/Service-TabularCheck.js'));

		tmpOperationState.InputFilePath = this.fable.FilePersistence.resolvePath(tmpOperationState.RawInputFile);
		tmpOperationState.OutputFilePath = this.fable.FilePersistence.resolvePath(tmpOperationState.RawOutputFile);

		if (!this.fable.FilePersistence.existsSync(tmpOperationState.InputFilePath))
		{
			this.fable.log.error(`File [${tmpOperationState.InputFilePath}] does not exist.`);
			return fCallback();
		}

		///////////////////////////////////////////////////////////////////////////////
		// Parse the TSV file
		tmpOperationState.Statistics = this.fable.MeadowIntegrationTabularCheck.newStatisticsObject(tmpOperationState.InputFilePath);

		const tmpRecords = [];
		this.fable.log.info(`Parsing TSV file [${tmpOperationState.InputFilePath}]...`);

		const tmpReadline = libReadline.createInterface(
			{
				input: libFS.createReadStream(tmpOperationState.InputFilePath),
				crlfDelay: Infinity,
			});

		tmpReadline.on('line',
			(pLine) =>
			{
				const tmpRecord = this.fable.CSVParser.parseCSVLine(pLine);
				if (tmpRecord)
				{
					this.fable.MeadowIntegrationTabularCheck.collectStatistics(tmpRecord, tmpOperationState.Statistics, tmpOperationState.OutputAllRecords);
				}
			});

		tmpReadline.on('close',
			() =>
			{
				let tmpStatistics = tmpOperationState.Statistics;
				this.fable.log.info(`...TSV parser completed, examined ${tmpStatistics.RowCount} rows of data.`);
				this.fable.log.info(`...Found ${tmpStatistics.ColumnCount} columns in the TSV file.`);
				this.fable.log.info(`...Writing statistics to file [${tmpOperationState.OutputFilePath}]...`);
				this.fable.FilePersistence.writeFileSyncFromObject(tmpOperationState.OutputFilePath, tmpStatistics);
				this.fable.log.info(`...Statistics written.`);
				this.fable.log.info(`Summary: ${tmpStatistics.RowCount} rows, ${tmpStatistics.ColumnCount} columns in [${tmpOperationState.InputFilePath}].`);
				this.fable.log.info(`  Headers: ${tmpStatistics.Headers.join(', ')}`);
				this.fable.log.info(`  First Row: ${JSON.stringify(tmpStatistics.FirstRow)}`);
				this.fable.log.info(`  Last Row: ${JSON.stringify(tmpStatistics.LastRow)}`);
				this.fable.log.info(`  Column Statistics:`);
				let tmpKeys = Object.keys(tmpStatistics.ColumnStatistics);
				for (let i = 0; i < tmpKeys.length; i++)
				{
					let tmpKey = tmpKeys[i];
					this.fable.log.info(`    -> [${tmpKey}]: ${JSON.stringify(tmpStatistics.ColumnStatistics[tmpKey])}`);
				}
				this.fable.log.info(`Have a nice day!`);
			});
	};
}

module.exports = QuackageCommandTSVCheck;