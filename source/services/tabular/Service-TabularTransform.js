const libCommandLineCommand = require('pict-service-commandlineutility').ServiceCommandLineCommand;

const libFS = require('fs');
const libPath = require('path');
const libReadline = require('readline');

class QuackageCommandCSVTransform extends libCommandLineCommand
{
	constructor(pFable, pManifest, pServiceHash)
	{
		super(pFable, pManifest, pServiceHash);

		this.options.CommandKeyword = 'csvtransform';
		this.options.Description = 'Transform a CSV into a comprehension, and either inject it in a file or create a new comprehension file.';

		this.options.CommandArguments.push({ Name: '<file>', Description: 'The CSV file to transform.' });

		// File Parameters
		this.options.CommandOptions.push({ Name: '-i, --incoming [incoming_comprehension]', Description: 'Incoming comprehension file.'});
		this.options.CommandOptions.push({ Name: '-o, --output [filepath]', Description: 'The comprehension output file.  Defaults to ./CSV-Comprehension-[filename].json'});

		// Comprehension Parameters
		// This can be *either* a mapping file, in the following format, or a set of parameters listed below.  The mapping file lets you map columns way easier!
/* Comprehension Mapping File (for the file `/debug/testdata/airports.csv` in this repository):
{
	"Entity": "Airport",
	"GUIDTemplate": "Airport-{~D:iata~}",
	"Mappings":
	{
		"Code": "{~D:iata~}",
		"Name": "{~D:name~}",
		"Description": "{~D:name~} airport in {~D:city~} auto-ingested from CSV file.",
		"City": "{~D:city~}",
		"State": "{~D:state~}",
		"Country": "{~D:country~}",
		"Latitude": "{~D:lat~}",
		"Longitude": "{~D:long~}"
	}
}

Alternate command-line only:

quack csvtransform testdata/airports.csv -e Airport -n "GUIDAirport" -g "Airport-{~D:iata~}"" -c "Code={~D:iata~},Name={~D:name~},Description={~D:name~} airport in {~D:city~} auto-ingested from CSV file.,City={~D:city~},State={~D:state~},Country={~D:country~},Latitude={~D:lat~},Longitude={~D:long~}"

Note command-line will not allow you to use equal signs or commas in the templates at the moment.
*/
		this.options.CommandOptions.push({ Name: '-m, --mappingfile [filepath]', Description: 'The mapping file for the comprehension.'});

		this.options.CommandOptions.push({ Name: '-e, --entity [entity]', Description: 'The Entity we are pulling into the comprehension.'});
		this.options.CommandOptions.push({ Name: '-n, --guidname [guidname]', Description: 'The name of the GUID column in the generated comprehension.'});
		this.options.CommandOptions.push({ Name: '-g, --guidtemplate [template]', Description: 'The Pict template for the entity GUID; for instance if the CSV has a column named "id", you could use {~D:id~} and that would be the GUID for the entity.'});
		this.options.CommandOptions.push({ Name: '-c, --columns [columns]', Description: 'The columns to map to the comprehension.  Format is "Column1={~D:column1~},Column2={~D:column2~},Column3={~D:column3~}"'});

		this.options.CommandOptions.push({ Name: '-x, --extended', Description: 'Enable extended JSON object output (output all application state and not just the outcome Comprehension).'});

		// Auto add the command on initialization
		this.addCommand();
	}

/* Generate a Comprehension
 *
 * This will generate a comprehension from a CSV file.
 * 
 * If a comprehension already exists, it will map the records to the existing comprehension.
 * 
 * Required Data Elements:
 * 
 * - Entity: The entity name for the comprehension.  Generated from the Filename if not provided.
 * - GUIDColumn: The column that contains the GUID for the record.
 * - Mappings: The mappings for the comprehension.  if not provided, will be generated from the first row of the CSV.
 */
	generateMappingFromRecord(pFileName, pRecord)
	{
		let tmpMapping = {};

		// Generate the entity name from the filename
		// For instance "my favorite cats.csv" would become "MyFavoriteCats"
		tmpMapping.Entity = this.fable.DataFormat.cleanNonAlphaCharacters(this.fable.DataFormat.capitalizeEachWord(libPath.basename(pFileName, libPath.extname(pFileName))));
		tmpMapping.GUIDName = `GUID${tmpMapping.Entity}`;

		let tmpKeys = Object.keys(pRecord);
		if (tmpKeys.length < 1)
		{
			tmpMapping.GUIDTemplate = ``;
		}
		else
		{
			tmpMapping.GUIDTemplate = `GUID-${tmpMapping.Entity}-{~Data:Record.${tmpKeys[0]}~}`;
		}

		tmpMapping.Mappings = {};

		for (let i = 0; i < tmpKeys.length; i++)
		{
			tmpMapping.Mappings[tmpKeys[i]] = `{~Data:Record.${tmpKeys[i]}~}`;
		}

		return tmpMapping;
	}

	createRecordFromMapping(pRecord, pMapping)
	{
		let tmpRecord = {};

		tmpRecord[pMapping.GUIDName] = this.pict.parseTemplate(pMapping.GUIDTemplate, pRecord);

		let tmpKeys = Object.keys(pMapping.Mappings);
		for (let i = 0; i < tmpKeys.length; i++)
		{
			let tmpMappingKey = tmpKeys[i];
			tmpRecord[tmpMappingKey] = this.pict.parseTemplate(pMapping.Mappings[tmpMappingKey], pRecord);
		}

		return tmpRecord;
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
			tmpOutputFileName = `${process.cwd()}/CSV-Comprehension-${libPath.basename(tmpFile)}.json`;
			this.log.error(`No output filename provided.  Defaulting to ${tmpOutputFileName}`);
		}

		let tmpInputFileName = this.CommandOptions.incoming_comprehension;
		if ((!tmpInputFileName) || (typeof(tmpInputFileName) != 'string') || (tmpInputFileName.length === 0))
		{
			tmpInputFileName = `${process.cwd()}/CSV-Comprehension-${libPath.basename(tmpFile)}.json`;
			this.log.error(`No incoming comprehension filename provided.  Defaulting to ${tmpInputFileName}`);
		}

		const tmpMappingOutcome = (
			{
				Comprehension: {},
				CommandConfiguration:
					{
//						Entity: false,
//						GUIDName: false,
//						GUIDTemplate: false,
//						Mappings: false
					},
				ExistingComprehension: false,
				ExplicitConfiguration: false,
				ImplicitConfiguration: false,
				Configuration: false,
				ParsedRowCount: 0,
				BadRecords: []
			});

		if (this.CommandOptions.entity)
		{
			tmpMappingOutcome.CommandConfiguration.Entity = this.CommandOptions.entity;
		}
		if (this.CommandOptions.guidname)
		{
			tmpMappingOutcome.CommandConfiguration.GUIDName = this.CommandOptions.guidname;
		}
		if (this.CommandOptions.guidtemplate)
		{
			tmpMappingOutcome.CommandConfiguration.GUIDTemplate = this.CommandOptions.guidtemplate;
		}
		if (this.CommandOptions.columns)
		{
			let tmpColumnEntries = this.CommandOptions.columns.split(',');

			tmpMappingOutcome.CommandConfiguration.Mappings = {};
			for (let i = 0; i < tmpColumnEntries.length; i++)
			{
				let tmpColumnEntry = tmpColumnEntries[i].split('=');
				if (tmpColumnEntry.length == 2)
				{
					tmpMappingOutcome.CommandConfiguration.Mappings[tmpColumnEntry[0]] = tmpColumnEntry[1];
				}
			}

			tmpMappingOutcome.CommandConfiguration.Mappings = this.CommandOptions.columns;
		}

		if (this.CommandOptions.mappingfile)
		{
			let tmpMappingConfigurationFileName = this.CommandOptions.mappingfile;

			if (!this.fable.FilePersistence.existsSync(tmpMappingConfigurationFileName))
			{
				tmpMappingConfigurationFileName = libPath.join(process.cwd(), tmpMappingConfigurationFileName);
			}

			try
			{
				let tmpMappingConfigurationExplicit = this.fable.FilePersistence.readFileSync(tmpMappingConfigurationFileName);
				tmpMappingOutcome.ExplicitConfiguration = JSON.parse(tmpMappingConfigurationExplicit);
			}
			catch(pError)
			{
				this.fable.log.error(`Error reading mapping file [${this.CommandOptions.mappingfile}]: ${pError}`, pError);
			}
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

		if (this.fable.FilePersistence.existsSync(tmpInputFileName))
		{
			try
			{
				tmpMappingOutcome.ExistingComprehension = require(tmpInputFileName);
			}
			catch (pError)
			{
				this.fable.log.error(`Error reading existing comprehension file [${tmpOutputFileName}].`);
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

				tmpMappingOutcome.ParsedRowCount++;

				if (tmpIncomingRecord)
				{
					if (!tmpMappingOutcome.ImplicitConfiguration)
					{
						tmpMappingOutcome.ImplicitConfiguration = this.generateMappingFromRecord(tmpFile, tmpIncomingRecord);

						if ((!tmpMappingOutcome.ExplicitConfiguration) || (typeof(tmpMappingOutcome.ExplicitConfiguration) != 'object'))
						{
							// Just use the implicit configuration
							this.fable.log.info(`Using implicit configuration for comprehension; no valid explicit configuration available.`);
							tmpMappingOutcome.Configuration = Object.assign({}, tmpMappingOutcome.ImplicitConfiguration, tmpMappingOutcome.CommandConfiguration);
						}
						else
						{
							this.fable.log.info(`Using explicit configuration for comprehension.`);

							tmpMappingOutcome.Configuration = Object.assign({}, tmpMappingOutcome.ImplicitConfiguration, tmpMappingOutcome.ExplicitConfiguration, tmpMappingOutcome.CommandConfiguration);
						}

						if (!(tmpMappingOutcome.Configuration.Entity in tmpMappingOutcome.Comprehension))
						{
							tmpMappingOutcome.Comprehension[tmpMappingOutcome.Configuration.Entity] = {};
						}
					}

					let tmpNewRecord = this.createRecordFromMapping(tmpIncomingRecord, tmpMappingOutcome.Configuration);

					if (typeof(tmpNewRecord) != 'object')
					{
						this.fable.log.warn(`No valid record generated from incoming transformation operation.  Skipping.`);
						tmpMappingOutcome.BadRecords.push(tmpIncomingRecord);
					}
					else if (!tmpNewRecord[tmpMappingOutcome.Configuration.GUIDName] || tmpNewRecord[tmpMappingOutcome.Configuration.GUIDName] == '')
					{
						this.fable.log.warn(`No valid GUID found for record.  Skipping.`);
						tmpMappingOutcome.BadRecords.push(tmpIncomingRecord);
					}
					else
					{
						if (tmpNewRecord[tmpMappingOutcome.Configuration.GUIDName] in tmpMappingOutcome.Comprehension[tmpMappingOutcome.Configuration.Entity])
						{
							// Already been ingested once by this parse!
							this.fable.log.warn(`Duplicate record found for ${tmpMappingOutcome.Configuration.GUIDName}->[${tmpNewRecord[tmpMappingOutcome.Configuration.GUIDName]}].  Merging with previous record.`);
							tmpMappingOutcome.Comprehension[tmpMappingOutcome.Configuration.Entity][tmpNewRecord[tmpMappingOutcome.Configuration.GUIDName]] = Object.assign({}, tmpMappingOutcome.Comprehension[tmpMappingOutcome.Configuration.Entity][tmpNewRecord[tmpMappingOutcome.Configuration.GUIDName]], tmpNewRecord);
						}
						else if (tmpMappingOutcome.ExistingComprehension && (tmpMappingOutcome.Configuration.Entity in tmpMappingOutcome.ExistingComprehension) && (tmpNewRecord[tmpMappingOutcome.Configuration.GUIDName] in tmpMappingOutcome.ExistingComprehension[tmpMappingOutcome.Configuration.Entity]))
						{
							// Pull it in from the old comprehension
							tmpMappingOutcome.Comprehension[tmpMappingOutcome.Configuration.Entity][tmpNewRecord[tmpMappingOutcome.Configuration.GUIDName]] = Object.assign({}, tmpMappingOutcome.ExistingComprehension[tmpMappingOutcome.Configuration.Entity][tmpNewRecord[tmpMappingOutcome.Configuration.GUIDName]], tmpNewRecord);
						}
						else
						{
							// Net new record
							tmpMappingOutcome.Comprehension[tmpMappingOutcome.Configuration.Entity][tmpNewRecord[tmpMappingOutcome.Configuration.GUIDName]] = tmpNewRecord
						}
					}
				}
			});

		tmpReadline.on('close',
			() =>
			{
				if (this.CommandOptions.extended)
				{
					this.fable.FilePersistence.writeFileSyncFromObject(tmpOutputFileName, tmpMappingOutcome);
					this.fable.log.info(`Verbose Comprehension written to [${tmpOutputFileName}].`);
				}
				else
				{
					this.fable.FilePersistence.writeFileSyncFromObject(tmpOutputFileName, tmpMappingOutcome.Comprehension);
					this.fable.log.info(`Comprehension written to [${tmpOutputFileName}].`);
				}
				this.fable.log.info(`Have a nice day!`);
				return fCallback();
			});
	};
}

module.exports = QuackageCommandCSVTransform;