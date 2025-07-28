const libCommandLineCommand = require('pict-service-commandlineutility').ServiceCommandLineCommand;

const libFS = require('fs');
const libPath = require('path');
const libReadline = require('readline');

class CommandComprehensionIntersect extends libCommandLineCommand
{
	constructor(pFable, pManifest, pServiceHash)
	{
		super(pFable, pManifest, pServiceHash);

		this.options.CommandKeyword = 'comprehensionintersect';
		this.options.Description = 'Intersect two comprehension JSON files.';

		this.options.CommandArguments.push({ Name: '<file>', Description: 'The primary comprehension file to intersect.' });

		// File Parameters
		this.options.CommandOptions.push({ Name: '-i, --intersect [intersectiong_file]', Description: 'The secondary comprehension file to intersect with the first.'});
		this.options.CommandOptions.push({ Name: '-o, --output [filepath]', Description: 'The comprehension output file.  Defaults to ./CSV-Comprehension-[filename].json'});

		this.options.CommandOptions.push({ Name: '-e, --entity [entity]', Description: 'The Entity we are pulling into the comprehension.'});

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
		let tmpIntersectionFileName = this.CommandOptions.intersect;
		if ((!tmpIntersectionFileName) || (typeof(tmpIntersectionFileName) != 'string') || (tmpIntersectionFileName.length === 0))
		{
			this.log.error(`No incoming secondary comprehension filename provided.`);
			return fCallback();
		}
		let tmpOutputFileName = this.CommandOptions.output;
		if ((!tmpOutputFileName) || (typeof(tmpOutputFileName) != 'string') || (tmpOutputFileName.length === 0))
		{
			tmpOutputFileName = `${process.cwd()}/Intersected-Comprehension-${libPath.basename(tmpFile)}.json`;
			this.log.error(`No output filename provided.  Defaulting to ${tmpOutputFileName}`);
		}

		this.fable.instantiateServiceProvider('FilePersistence');

		const tmpMappingOutcome = {};

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
		if (!this.fable.FilePersistence.existsSync(tmpIntersectionFileName))
		{
			this.fable.log.error(`File [${tmpIntersectionFileName}] does not exist.  Checking in the current working directory...`);
			tmpFile = libPath.join(process.cwd(), tmpFile);
			if (!this.fable.FilePersistence.existsSync(tmpFile))
			{
				this.fable.log.error(`File [${tmpFile}] does not exist in the current working directory.  Could not parse input secondary comprehension file.  Aborting.`);
				return fCallback();
			}
		}

		if (this.fable.FilePersistence.existsSync(tmpFile))
		{
			try
			{
				tmpMappingOutcome.ExistingComprehension = JSON.parse(this.fable.FilePersistence.readFileSync(tmpFile));
			}
			catch (pError)
			{
				this.fable.log.error(`Error reading existing comprehension file [${tmpFile}]: ${pError.message}`);
				return fCallback();
			}
		}
		if (this.fable.FilePersistence.existsSync(tmpIntersectionFileName))
		{
			try
			{
				tmpMappingOutcome.IntersectingComprehension = JSON.parse(this.fable.FilePersistence.readFileSync(tmpIntersectionFileName));
			}
			catch (pError)
			{
				this.fable.log.error(`Error reading existing comprehension file [${tmpIntersectionFileName}]: ${pError.message}`);
				return fCallback();
			}
		}

		if (this.CommandOptions.entity)
		{
			tmpMappingOutcome.Entity = this.CommandOptions.entity;
		}
		else
		{
			let tmpEntityInference = Object.keys(tmpMappingOutcome.ExistingComprehension);
			if (tmpEntityInference.length > 0)
			{
				tmpMappingOutcome.Entity = tmpEntityInference[0];
				this.fable.log.info(`No entity specified.  Using [${tmpMappingOutcome.Entity}] as the inferred entity for comprehension intersection based on primary comprehension.`);
			}
			else
			{
				this.fable.log.error(`No entity specified and no entities found in the primary comprehension file.  Cannot proceed with intersection.`);
				return fCallback();
			}
		}


		tmpMappingOutcome.IntersectingComprehensionKeys = Object.keys(tmpMappingOutcome.IntersectingComprehension[tmpMappingOutcome.Entity] || {});
		for (let i = 0; i < tmpMappingOutcome.IntersectingComprehensionKeys.length; i++)
		{
			const tmpRecordGUID = tmpMappingOutcome.IntersectingComprehensionKeys[i];
			if (tmpMappingOutcome.ExistingComprehension[tmpMappingOutcome.Entity][tmpRecordGUID])
			{
				tmpMappingOutcome.ExistingComprehension[tmpMappingOutcome.Entity][tmpRecordGUID] = Object.assign(tmpMappingOutcome.ExistingComprehension[tmpMappingOutcome.Entity][tmpRecordGUID], tmpMappingOutcome.IntersectingComprehension[tmpMappingOutcome.Entity][tmpRecordGUID]);
			}
			else
			{
				tmpMappingOutcome.ExistingComprehension[tmpMappingOutcome.Entity][tmpRecordGUID] = tmpMappingOutcome.IntersectingComprehension[tmpRecordGUID];
			}
		}

		this.fable.FilePersistence.writeFileSyncFromObject(tmpOutputFileName, tmpMappingOutcome.ExistingComprehension, null, 2);
		this.fable.log.info(`Comprehension written to [${tmpOutputFileName}].`);
		this.fable.log.info(`Have a nice day!`);
		return fCallback();
	};
}

module.exports = CommandComprehensionIntersect;