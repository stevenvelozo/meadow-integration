const libCommandLineCommand = require('pict-service-commandlineutility').ServiceCommandLineCommand;

const libFS = require('fs');
const libPath = require('path');
const libReadline = require('readline');

class QuackageCommandCSVIntersect extends libCommandLineCommand
{
	constructor(pFable, pManifest, pServiceHash)
	{
		super(pFable, pManifest, pServiceHash);

		this.options.CommandKeyword = 'csvintersect';
		this.options.Description = 'Intersect a CSV into a comprehension, As a cheap join between two value sets.';

		this.options.CommandArguments.push({ Name: '<file>', Description: 'The CSV file to intersect.' });

		// File Parameters
		this.options.CommandOptions.push({ Name: '-o, --output [filepath]', Description: 'The comprehension output file.  Defaults to ./CSV-Comprehension-[filename].json'});

		this.options.CommandOptions.push({ Name: '-f, --first_entity [first_entity]', Description: 'The first entity we are mapping a synthesized join record for.. the generated Entity will be FirstEntitySecondEntityJoin and it will be joined by GUIDFirstEntity and GUIDSecondEntity.'});
		this.options.CommandOptions.push({ Name: '-s, --second_entity [second_entity]', Description: 'The second entity we are mapping a synthesized join record for.. the generated Entity will be FirstEntitySecondEntityJoin and it will be joined by GUIDFirstEntity and GUIDSecondEntity.'});

		this.options.CommandOptions.push({ Name: '-x, --extended', Description: 'Enable extended JSON object output (output all application state and not just the outcome Comprehension).'});

		// Auto add the command on initialization
		this.addCommand();
	}

	generateConfigurationFromFilename(pFileName, pRecord)
	{
		let tmpConfiguration = {};

		let tmpFileNameParts = pFileName.split('-');
		if (tmpFileNameParts.length < 2)
		{
			// This is pretty bad if the user doesn't provide a valid filename
			tmpConfiguration.FirstEntity = pFileName;
			tmpConfiguration.SecondEntity = '__UNKNOWN';
		}

		return tmpConfiguration;
	}

	/**
	 * Take a set of records and generate an intersection comprehension from it.
	 * FirstEntity is the left side of the table.
	 * SecondEntity is the top side of the table.
	 * @param {string} pFirstEntity 
	 * @param {string} pSecondEntity 
	 * @param {Array} pRecords 
	 * @param {Object} pComprehension 
	 */
	intersectTabularData(pFirstEntity, pSecondEntity, pRecords, pComprehension)
	{
		// If there isn't at least one row, there are no joins defined
		if (pRecords.length < 1)
		{
			return pComprehension;
		}

		let tmpJoinEntityName = `${pFirstEntity}${pSecondEntity}Join`;
		let tmpJoinEntityGUIDName = `GUID${tmpJoinEntityName}`;

		if (!pComprehension[tmpJoinEntityName])
		{
			pComprehension[tmpJoinEntityName] = {};
		}

		let tmpFirstLeftEntityKey = `__GUID__`;
		for (let i = 0; i < pRecords.length; i++)
		{
			let tmpRecord = pRecords[i];

			// Now see if there is data .. there should be at least 2 keys
			let tmpRecordKeys = Object.keys(tmpRecord);
			if (tmpRecordKeys.length < 2)
			{
				continue;
			}

			// Get the left side of the join, which is stable for the whole record
			tmpFirstLeftEntityKey = `GUID${pFirstEntity}`;
			let tmpFirstLeftEntityValue = tmpRecord[tmpRecordKeys[0]];

			// Enumerate each column and see if there is something that warrants creating a record
			for (let j = 1; j < tmpRecordKeys.length; j++)
			{
				let tmpRecordValue = tmpRecord[tmpRecordKeys[j]];
				if ((tmpRecordValue.toLowerCase() === 'x') || (tmpRecordValue.toLowerCase() === 'true') || (tmpRecordValue.toLowerCase() === '1'))
				{
					let tmpSecondTopEntityKey = `GUID${pSecondEntity}`;
					let tmpSecondTopEntityValue = tmpRecordKeys[j];
					let tmpJoinRecordGUID = `L-${tmpFirstLeftEntityValue}-T-${tmpSecondTopEntityValue}`;

					let tmpJoinRecord = {};
					tmpJoinRecord[tmpJoinEntityGUIDName] = tmpJoinRecordGUID;
					tmpJoinRecord[tmpFirstLeftEntityKey] = tmpFirstLeftEntityValue;
					tmpJoinRecord[tmpSecondTopEntityKey] = tmpSecondTopEntityValue;

					if (!pComprehension[tmpJoinEntityName][tmpJoinRecordGUID])
					{
						pComprehension[tmpJoinEntityName][tmpJoinRecordGUID] = tmpJoinRecord;
					}
					else
					{
						// This is a duplicate record
						this.fable.log.warn(`Duplicate record detected for ${tmpJoinEntityName} with GUID ${tmpJoinRecordGUID}.  Merging.`);
						pComprehension[tmpJoinEntityName][tmpJoinRecordGUID] = Object.assign({}, pComprehension[tmpJoinEntityName][tmpJoinRecordGUID], tmpJoinRecord);
					}
				}
			}
		}
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
			tmpOutputFileName = `${process.cwd()}/CSV-Intersection-${libPath.basename(tmpFile)}.json`;
			this.log.error(`No output filename provided.  Defaulting to ${tmpOutputFileName}`);
		}

		const tmpIntersectionOutcome = (
			{
				Comprehension: {},
				RawRecords: [],
				CommandConfiguration:
					{
//						FirstEntity: false,
//						SecondEntity: false
					},
				ImplicitConfiguration: false,
				Configuration: false,
				ParsedRowCount: 0,
				BadRecords: []
			});

		if (this.CommandOptions.first_entity)
		{
			tmpIntersectionOutcome.CommandConfiguration.FirstEntity = this.CommandOptions.first_entity;
		}
		if (this.CommandOptions.second_entity)
		{
			tmpIntersectionOutcome.CommandConfiguration.SecondEntity = this.CommandOptions.second_entity;
		}

		// Initialize the fable CSV parser
		this.fable.instantiateServiceProvider('CSVParser');
		this.fable.instantiateServiceProvider('FilePersistence');

		// Do some input file housekeeping
		if (!this.fable.FilePersistence.existsSync(tmpFile))
		{
			this.fable.log.error(`File [${tmpFile}] does not exist.  Checking in the current working directory...`);
			tmpFile = libPath.join(process.cwd(), tmpFile);
			if (!this.fable.FilePersistence.existsSync(tmpFile))
			{
				this.fable.log.error(`File [${tmpFile}] does not exist in the current working directory.  Could not parse input CSV file.  Aborting.`);
				return fCallback();
			}
		}

		this.fable.log.info(`Parsing CSV file [${tmpFile}]...`);
		const tmpReadline = libReadline.createInterface(
			{
				input: libFS.createReadStream(tmpFile),
				crlfDelay: Infinity,
			});

		tmpReadline.on('line',
			(pLine) =>
			{
				const tmpIncomingRecord = this.fable.CSVParser.parseCSVLine(pLine);

				tmpIntersectionOutcome.ParsedRowCount++;
				tmpIntersectionOutcome.RawRecords.push(tmpIncomingRecord);
			});

		tmpReadline.on('close',
			() =>
			{
				// Now perform the intersection
				this.intersectTabularData(tmpIntersectionOutcome.CommandConfiguration.FirstEntity, tmpIntersectionOutcome.CommandConfiguration.SecondEntity, tmpIntersectionOutcome.RawRecords, tmpIntersectionOutcome.Comprehension);

				if (this.CommandOptions.extended)
				{
					this.fable.FilePersistence.writeFileSyncFromObject(tmpOutputFileName, tmpIntersectionOutcome);
					this.fable.log.info(`Verbose Comprehension written to [${tmpOutputFileName}].`);
				}
				else
				{
					this.fable.FilePersistence.writeFileSyncFromObject(tmpOutputFileName, tmpIntersectionOutcome.Comprehension);
					this.fable.log.info(`Comprehension written to [${tmpOutputFileName}].`);
				}
				this.fable.log.info(`Have a nice day!`);
				return fCallback();
			});
	};
}

module.exports = QuackageCommandCSVIntersect;