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
		this.options.Description = 'Turn an object-based comprehension or an array of objects into a CSV file.';
		this.options.Aliases.push('object_array_to_csv');
		this.options.Aliases.push('array_to_csv');

		this.options.CommandArguments.push({ Name: '<file>', Description: 'The primary comprehension file to turn into a CSV file.' });

		this.options.CommandOptions.push({ Name: '-o, --output [filepath]', Description: 'The comprehension output file.  Defaults to ./Array-Comprehension-[filename]-[entity].csv'});
		this.options.CommandOptions.push({ Name: '-e, --entity [entity]', Description: 'The (optional) Entity we are pulling into the comprehension.  No entity expects the file to be an array.', Default: false});

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
			}
			else
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
		let tmpRawInputFilePath = this.ArgumentString;
		if ((!tmpRawInputFilePath) || (typeof(tmpRawInputFilePath) != 'string') || (tmpRawInputFilePath.length === 0))
		{
			this.log.error('No valid filename provided.');
			return fCallback();
		}
		let tmpEntity = this.CommandOptions.entity;

		let tmpRawOutputFilePath = this.CommandOptions.output;
		if ((!tmpRawOutputFilePath) || (typeof(tmpRawOutputFilePath) != 'string') || (tmpRawOutputFilePath.length === 0))
		{
			if (tmpEntity)
			{
				tmpRawOutputFilePath = libPath.join(process.cwd(), `/Flattened-Object-${libPath.basename(tmpRawInputFilePath)}-Entity-${tmpEntity}.csv`);
			}
			else
			{
				tmpRawOutputFilePath = libPath.join(process.cwd(), `/Flattened-Object-${libPath.basename(tmpRawInputFilePath)}.csv`);
			}
			this.log.error(`No output filename provided.  Defaulting to ${tmpRawOutputFilePath}`);
		}

		this.fable.instantiateServiceProvider('FilePersistence');

		// Do some input file housekeeping
		if (!this.fable.FilePersistence.existsSync(tmpRawInputFilePath))
		{
			this.fable.log.error(`File [${tmpRawInputFilePath}] does not exist.`);
		}

		const tmpMappingOutcome = {};

		if (this.fable.FilePersistence.existsSync(tmpRawInputFilePath))
		{
			try
			{
				// This may or may not be a "comprehension"
				tmpMappingOutcome.RawRecordSet = JSON.parse(this.fable.FilePersistence.readFileSync(tmpRawInputFilePath));
				if (tmpEntity)
				{
					// Check for the entity
					if ((typeof(tmpMappingOutcome.RawRecordSet) == 'object') && (tmpEntity in tmpMappingOutcome.RawRecordSet))
					{
						this.fable.log.info(`Entity [${tmpEntity} found in the raw recordset comprehension.`);
						if (!Array.isArray(tmpMappingOutcome.RawRecordSet[tmpEntity]))
						{
							let tmpErrorMessage = `Expected an Array at Entity location in comprehension; data type was: ${typeof(tmpMappingOutcome.RawRecordSet)}`;
							this.fable.log.error(tmpErrorMessage);
							return fCallback();
						}
						tmpMappingOutcome.RecordArray = tmpMappingOutcome.RawRecordSet[tmpEntity];
					}
					else if ((typeof(tmpMappingOutcome.RawRecordSet) == 'object') && (Array.isArray(tmpMappingOutcome.RawRecordSet)))
					{
						this.fable.log.info(`Raw recordset is an array.`);
						tmpMappingOutcome.RecordArray = tmpMappingOutcome.RawRecordSet;
					}

					if (!tmpMappingOutcome.RecordArray || !Array.isArray(tmpMappingOutcome.RecordArray))
					{
						this.fable.log.error(`Could not locate a valid record array in JSON file.`);
						return fCallback();
					}
					if (tmpMappingOutcome.RecordArray.length < 1)
					{
						this.fable.log.error(`No records in the record array.`);
						return fCallback();
					}
				}
			}
			catch (pError)
			{
				this.fable.log.error(`Error reading Record Array file [${tmpRawInputFilePath}]: ${pError.message}`);
				return fCallback();
			}
		}

		try
		{
			this.streamFlattenedJSONToCSV(tmpMappingOutcome.RecordArray, tmpRawOutputFilePath)
				.then(
					() =>
					{
						this.pict.log.info(`CSV file created successfully: ${tmpRawOutputFilePath}`);
					})
				.catch(
					(pError) =>
					{
						this.pict.log.error(`Error generating or writing CSV:`, pError);
					});
		}
		catch (pError)
		{
			this.pict.log.error(`Error processing file ${tmpRawInputFilePath}:`, pError);
		}

		this.fable.log.info(`CSV File written to [${tmpRawOutputFilePath}].`);
		this.fable.log.info(`Have a nice day!`);
		return fCallback();
	};
}

module.exports = CommandConvertComprehensionToArray;
