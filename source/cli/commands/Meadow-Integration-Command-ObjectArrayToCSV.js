const libCommandLineCommand = require('pict-service-commandlineutility').ServiceCommandLineCommand;

const libFS = require('fs');
const libPath = require('path');
const libReadline = require('readline');

class CommandConvertComprehensionToArray extends libCommandLineCommand
{
	constructor(pFable, pManifest, pServiceHash)
	{
		super(pFable, pManifest, pServiceHash);

		this.options.CommandKeyword = 'objectarraytocsv';
		this.options.Description = 'Turn an object-based comprehension into an array-based comprehension.';

		this.options.CommandArguments.push({ Name: '<file>', Description: 'The primary comprehension file to turn into an array.' });

		this.options.CommandOptions.push({ Name: '-o, --output [filepath]', Description: 'The comprehension output file.  Defaults to ./Array-Comprehension-[filename].json'});

		this.options.CommandOptions.push({ Name: '-e, --entity [entity]', Description: 'The Entity we are pulling into the comprehension.'});

		// Auto add the command on initialization
		this.addCommand();
	}

	flattenObject (pObject, pAddressPrefix = '')
	{
		let tmpFlattenedObject = {};
		for (const [pKey, pValue] of Object.entries(pObject))
		{
			const pPropertyPath = pAddressPrefix ? `${pAddressPrefix}.${pKey}` : pKey;
			if (pValue && typeof pValue === 'object' && !Array.isArray(pValue))
			{
				Object.assign(tmpFlattenedObject, flatten(pValue, pPropertyPath));
			} else
			{
				tmpFlattenedObject[pPropertyPath] = pValue;
			}
		}
		return tmpFlattenedObject;
	};

	escapeCSVValue (pValue)
	{
		if (pValue === null || pValue === undefined) return '';
		const str = String(pValue);
		return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
	}

	/**
	 * Streams a large JSON array to CSV, flattening nested properties using dot notation.
	 * @param {Array<Object>} pJSONArray - An iterable or array of JSON objects.
	 * @param {string} pOutputFilePath - Destination path for the CSV file.
	 */
	async streamFlattenedJSONToCSV(pJSONArray, pOutputFilePath)
	{
		const tmpOutputFile = libFS.createWriteStream(pOutputFilePath, { encoding: 'utf8' });
		const tmpAllKeysSet = new Set();
		const tmpFlattenedRecords = [];

		// First pass: flatten and collect all keys
		for (const tmpRecord of pJSONArray)
		{
			const tmpFlattenedObject = this.flattenObject(tmpRecord);
			tmpFlattenedRecords.push(tmpFlattenedObject);
			for (const tmpKey of Object.keys(tmpFlattenedObject))
			{
				tmpAllKeysSet.add(tmpKey);
			}
		}

		// TODO: This sorts the keys alphabetically .. is this the right behavior?
		const tmpAllObjectKeys = Array.from(tmpAllKeysSet).sort();

		// Write out the header header
		tmpOutputFile.write(tmpAllObjectKeys.join(',') + '\n');

		// Write each row
		for (const tmpFlatRecord of tmpFlattenedRecords)
		{
			const tmpRow = tmpAllObjectKeys.map(pKey => this.escapeCSVValue(tmpFlatRecord[pKey])).join(',');
			tmpOutputFile.write(tmpRow + '\n');
		}

		tmpOutputFile.end();
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
			tmpOutputFileName = `${process.cwd()}/Flattened-Object-${libPath.basename(tmpFile)}.csv`;
			this.log.error(`No output filename provided.  Defaulting to ${tmpOutputFileName}`);
		}

		this.fable.instantiateServiceProvider('FilePersistence');

		// Do some input file housekeeping
		if (!this.fable.FilePersistence.existsSync(tmpFile))
		{
			this.fable.log.error(`File [${tmpFile}] does not exist.  Checking in the current working directory...`);
			tmpFile = libPath.join(process.cwd(), tmpFile);
			if (!this.fable.FilePersistence.existsSync(tmpFile))
			{
				this.fable.log.error(`File [${tmpFile}] does not exist in the current working directory.  Could not parse input comprehension file.  Aborting.`);
				return fCallback();
			}
		}

		const tmpMappingOutcome = {};

		if (this.fable.FilePersistence.existsSync(tmpFile))
		{
			try
			{
				tmpMappingOutcome.RecordArray = JSON.parse(this.fable.FilePersistence.readFileSync(tmpFile));
			}
			catch (pError)
			{
				this.fable.log.error(`Error reading Record Array file [${tmpFile}]: ${pError.message}`);
				return fCallback();
			}
		}

		try
		{
			this.streamFlattenedJSONToCSV(
				tmpMappingOutcome.RecordArray,
				tmpOutputFileName
			).then(
				() =>
				{
					this.pict.log.info(`CSV file created successfully: ${tmpOutputFileName}`);
				}).catch(
					(pError) =>
					{
						this.pict.log.error(`Error generating or writing CSV:`, pError);
					});
		}
		catch (pError)
		{
			this.pict.log.error(`Error processing file ${tmpFile}:`, pError);
		}

		this.fable.log.info(`Array Comprehension written to [${tmpOutputFileName}].`);
		this.fable.log.info(`Have a nice day!`);
		return fCallback();
	};
}

module.exports = CommandConvertComprehensionToArray;
