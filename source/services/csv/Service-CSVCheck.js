const libCommandLineCommand = require('pict-service-commandlineutility').ServiceCommandLineCommand;

const libFS = require('fs');
const libPath = require('path');
const libReadline = require('readline');

class QuackageCommandCSVCheck extends libCommandLineCommand
{
	constructor(pFable, pManifest, pServiceHash)
	{
		super(pFable, pManifest, pServiceHash);

		this.options.CommandKeyword = 'csvcheck';
		this.options.Description = 'Check a CSV for Statistics.';

		this.options.CommandArguments.push({ Name: '<file>', Description: 'The csv file to load.' });

		this.options.CommandOptions.push({ Name: '-f, --file [filepath]', Description: 'The csv file to read.'});
		this.options.CommandOptions.push({ Name: '-o, --output [filepath]', Description: 'The statistics output file.  Defaults to ./CSV-Stats-[filename].json'});
		this.options.CommandOptions.push({ Name: '-c, --comprehension', Description: 'Output the full comprehension of the CSV file in the stats.'});

		// Auto add the command on initialization
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
		let tmpOutputFileName = this.CommandOptions.output;
		if ((!tmpOutputFileName) || (typeof(tmpOutputFileName) != 'string') || (tmpOutputFileName.length === 0))
		{
			tmpOutputFileName = `${process.cwd()}/CSV-Stats-${libPath.basename(tmpFile)}.json`;
			this.log.error(`No output filename provided.  Defaulting to ${tmpOutputFileName}`);
		}

		// Initialize the fable CSV parser
		this.fable.instantiateServiceProvider('CSVParser');
		this.fable.instantiateServiceProvider('FilePersistence');

		if (!this.fable.FilePersistence.existsSync(tmpFile))
		{
			this.fable.log.error(`File [${tmpFile}] does not exist.  Checking in the current working directory...`);
			tmpFile = libPath.join(process.cwd(), tmpFile);
			if (!this.fable.FilePersistence.existsSync(tmpFile))
			{
				this.fable.log.error(`File [${tmpFile}] does not exist in the current working directory.  Could not parse file.`);
				return fCallback();
			}
		}

		///////////////////////////////////////////////////////////////////////////////
		// Parse the CSV file
		const tmpStatistics =(
			{
				File: tmpFile,
				FirstRow: null,
				RowCount: 0,
				LastRow: null,
				Headers: [],
				ColumnCount: 0,
				ColumnStatistics: {},
			});
		const tmpRecords = [];
		this.fable.log.info(`Parsing CSV file [${tmpFile}]...`);

		const tmpReadline = libReadline.createInterface(
			{
				input: libFS.createReadStream(tmpFile),
				crlfDelay: Infinity,
			});

		tmpReadline.on('line',
			(pLine) =>
			{
				const tmpRecord = this.fable.CSVParser.parseCSVLine(pLine);
				if (tmpRecord)
				{
					tmpStatistics.RowCount++;

					if (tmpStatistics.FirstRow === null)
					{
						tmpStatistics.FirstRow = tmpRecord;
					}
					tmpStatistics.LastRow = tmpRecord;

					let tmpKeys = Object.keys(tmpRecord);
					for (let i = 0; i < tmpKeys.length; i++)
					{
						let tmpKey = tmpKeys[i];
						if (!(tmpKey in tmpStatistics.ColumnStatistics))
						{
							tmpStatistics.ColumnCount++;
							tmpStatistics.ColumnStatistics[tmpKey] = { Count: 0, EmptyCount: 0, NumericCount: 0, FirstValue: null, LastValue: null };
							tmpStatistics.Headers.push(tmpKey);
						}
						tmpStatistics.ColumnStatistics[tmpKey].Count++;
						if (tmpStatistics.ColumnStatistics[tmpKey].FirstValue === null)
						{
							tmpStatistics.ColumnStatistics[tmpKey].FirstValue = tmpRecord[tmpKey];
						}
						tmpStatistics.ColumnStatistics[tmpKey].LastValue = tmpRecord[tmpKey];
						if ((tmpRecord[tmpKey] === null) || (tmpRecord[tmpKey] === ''))
						{
							tmpStatistics.ColumnStatistics[tmpKey].EmptyCount++;
						}
						if (this.fable.Math.parsePrecise(tmpRecord[tmpKey], NaN) !== NaN)
						{
							tmpStatistics.ColumnStatistics[tmpKey].NumericCount++;
						}
					}
					tmpRecords.push(tmpRecord);
				}
			});

		tmpReadline.on('close',
			() =>
			{
				this.fable.log.info(`...CSV parser completed, examined ${tmpStatistics.RowCount} rows of data.`);
				this.fable.log.info(`...Found ${tmpStatistics.ColumnCount} columns in the CSV file.`);
				this.fable.log.info(`...Writing statistics to file [${tmpOutputFileName}]...`);
				if (this.CommandOptions.comprehension)
				{
					tmpStatistics.Records = tmpRecords
				}					
				this.fable.FilePersistence.writeFileSyncFromObject(tmpOutputFileName, tmpStatistics);
				this.fable.log.info(`...Statistics written.`);
				this.fable.log.info(`Summary: ${tmpStatistics.RowCount} rows, ${tmpStatistics.ColumnCount} columns in [${tmpFile}].`);
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

module.exports = QuackageCommandCSVCheck;