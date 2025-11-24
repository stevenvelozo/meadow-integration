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
		this.options.Aliases.push('csv_t');
		this.options.Aliases.push('csv_transform');

		this.options.CommandArguments.push({ Name: '<file>', Description: 'The CSV file to transform.' });

		// File Parameters
		this.options.CommandOptions.push({ Name: '-i, --incoming [incoming_comprehension]', Description: 'Incoming comprehension file.' });
		this.options.CommandOptions.push({ Name: '-o, --output [filepath]', Description: 'The comprehension output file.  Defaults to ./CSV-Comprehension-[filename].json' });
		this.options.CommandOptions.push({ Name: '-x, --extended', Description: 'Enable extended JSON object output (output all application state and not just the outcome Comprehension).' });

		// Mapping Configuration File
		this.options.CommandOptions.push({ Name: '-m, --mappingfile [filepath]', Description: 'The mapping file for the comprehension.' });

		// Command-line configuration options
		this.options.CommandOptions.push({ Name: '-e, --entity [entity]', Description: 'The Entity we are pulling into the comprehension.' });
		this.options.CommandOptions.push({ Name: '-n, --guidname [guidname]', Description: 'The name of the GUID column in the generated comprehension.' });
		this.options.CommandOptions.push({ Name: '-g, --guidtemplate [template]', Description: 'The Pict template for the entity GUID; for instance if the CSV has a column named "id", you could use {~D:id~} and that would be the GUID for the entity.' });
		this.options.CommandOptions.push({ Name: '-c, --columns [columns]', Description: 'The columns to map to the comprehension.  Format is "Column1={~D:column1~},Column2={~D:column2~},Column3={~D:column3~}"' });
		this.options.CommandOptions.push({ Name: '-q, --quotedelimiter [quotedelimiter]', Description: 'The quote delimiter character, defaulted to double quotes for CSV files.  Quote delimiters are required to be doubled ("") if it is a character rather than a delimiter.', Default: '"' });

		this.addCommand();
	}

	onRunAsync(fCallback)
	{

		let tmpOperationState = (
			{
				RawInputFile: this.ArgumentString,
				RawOutputFile: this.CommandOptions.output,

				RawIncomingComprehensionFile: this.CommandOptions.incoming
			});

		if ((!tmpOperationState.RawInputFile) || (typeof(tmpOperationState.RawInputFile) != 'string') || (tmpOperationState.length === 0))
		{
			this.log.error(`No valid filename provided.`);
			return fCallback();
		}
		if ((!tmpOperationState.RawOutputFile) || (typeof(tmpOperationState.RawOutputFile) != 'string') || (tmpOperationState.RawOutputFile.length === 0))
		{
			tmpOperationState.OutputFile = `CSV-Stats-${libPath.basename(tmpOperationState.RawInputFile)}.json`;
			this.log.error(`No valid output filename provided.  Defaulting to ${tmpOperationState.RawOutputFile}`);
		}

		if ((!tmpOperationState.RawIncomingComprehensionFile) || (typeof (tmpOperationState.RawIncomingComprehensionFile) != 'string') || (tmpOperationState.RawIncomingComprehensionFile.length === 0))
		{
			tmpOperationState.RawIncomingComprehensionFile = `CSV-Comprehension-${libPath.basename(tmpOperationState.RawInputFile)}.json`;
			this.log.error(`No incoming comprehension filename provided.  Defaulting to ${tmpOperationState.RawIncomingComprehensionFile}`);
		}

		// Initialize the fable CSV parser and file management stuff
		this.fable.instantiateServiceProvider('CSVParser');
		this.fable.instantiateServiceProvider('FilePersistence');
		// Initialize the meadow integration tabular data check service
		this.fable.addAndInstantiateServiceTypeIfNotExists('MeadowIntegrationTabularTransform', require('../../services/tabular/Service-TabularTransform.js'));

		tmpOperationState.InputFilePath = this.fable.FilePersistence.resolvePath(tmpOperationState.RawInputFile);
		tmpOperationState.OutputFilePath = this.fable.FilePersistence.resolvePath(tmpOperationState.RawOutputFile);
		tmpOperationState.IncomingComprehensionFilePath = this.fable.FilePersistence.resolvePath(tmpOperationState.RawIncomingComprehensionFile);

		if (!this.fable.FilePersistence.existsSync(tmpOperationState.InputFilePath))
		{
			this.fable.log.error(`File [${tmpOperationState.InputFilePath}] does not exist.`);
			return fCallback();
		}

		tmpOperationState.MappingOutcome = this.fable.MeadowIntegrationTabularTransform.newMappingOutcomeObject();

		if (this.CommandOptions.entity)
		{
			tmpOperationState.MappingOutcome.UserConfiguration.Entity = this.CommandOptions.entity;
		}
		if (this.CommandOptions.guidname)
		{
			tmpOperationState.MappingOutcome.UserConfiguration.GUIDName = this.CommandOptions.guidname;
		}
		if (this.CommandOptions.guidtemplate)
		{
			tmpOperationState.MappingOutcome.UserConfiguration.GUIDTemplate = this.CommandOptions.guidtemplate;
		}
		if (this.CommandOptions.columns)
		{
			let tmpColumnEntries = this.CommandOptions.columns.split(',');

			tmpOperationState.MappingOutcome.UserConfiguration.Mappings = {};
			for (let i = 0; i < tmpColumnEntries.length; i++)
			{
				let tmpColumnEntry = tmpColumnEntries[i].split('=');
				if (tmpColumnEntry.length == 2)
				{
					tmpOperationState.MappingOutcome.UserConfiguration.Mappings[tmpColumnEntry[0]] = tmpColumnEntry[1];
				}
			}

			tmpOperationState.MappingOutcome.UserConfiguration.Mappings = this.CommandOptions.columns;
		}

		if (this.CommandOptions.mappingfile)
		{
			tmpOperationState.RawMappingConfigurationFile = this.CommandOptions.mappingfile;
			tmpOperationState

			if (!this.fable.FilePersistence.existsSync(tmpOperationState.RawMappingConfigurationFile))
			{
				tmpOperationState.RawMappingConfigurationFile = libPath.join(process.cwd(), tmpOperationState.RawMappingConfigurationFile);
			}

			try
			{
				let tmpMappingConfigurationExplicit = this.fable.FilePersistence.readFileSync(tmpOperationState.RawMappingConfigurationFile);
				tmpOperationState.MappingOutcome.ExplicitConfiguration = JSON.parse(tmpMappingConfigurationExplicit);
			}
			catch (pError)
			{
				this.fable.log.error(`Error reading mapping file [${this.CommandOptions.mappingfile}]: ${pError}`, pError);
			}
		}

		// Initialize the fable CSV parser
		// TODO: We only use the CSVParser once -- if we ever want to process multiple files, we need to instantiate it for each file.
		this.fable.instantiateServiceProvider('CSVParser');
		this.fable.instantiateServiceProvider('FilePersistence');

		this.fable.CSVParser.QuoteCharacter = this.CommandOptions.quotedelimiter;

		// Do some input file housekeeping
		if (!this.fable.FilePersistence.existsSync(tmpOperationState.RawInputFile))
		{
			this.fable.log.error(`File [${tmpOperationState.RawInputFile}] does not exist.  Checking in the current working directory...`);
			tmpFile = libPath.join(process.cwd(), tmpOperationState.RawInputFile);
			if (!this.fable.FilePersistence.existsSync(tmpOperationState.RawInputFile))
			{
				this.fable.log.error(`File [${tmpOperationState.RawInputFile}] does not exist in the current working directory.  Could not parse input CSV file.  Aborting.`);
				return fCallback();
			}
		}

		if (this.fable.FilePersistence.existsSync(tmpOperationState.RawIncomingComprehensionFile))
		{
			try
			{
				tmpOperationState.MappingOutcome.ExistingComprehension = require(tmpOperationState.RawIncomingComprehensionFile);
				tmpOperationState.MappingOutcome.Comprehension = JSON.parse(JSON.stringify(tmpOperationState.MappingOutcome.ExistingComprehension));
			}
			catch (pError)
			{
				this.fable.log.error(`Error reading existing comprehension file [${tmpOutputFileName}].`);
			}
		}

		this.fable.log.info(`Parsing CSV file [${tmpOperationState.RawInputFile}]...`);
		const tmpReadline = libReadline.createInterface(
			{
				input: libFS.createReadStream(tmpOperationState.RawInputFile),
				crlfDelay: Infinity,
			});

		tmpReadline.on('line',
			(pLine) =>
			{
				const tmpIncomingRecord = this.fable.CSVParser.parseCSVLine(pLine);

				tmpOperationState.MappingOutcome.ParsedRowCount++;

				if (tmpIncomingRecord)
				{
					if (!tmpOperationState.MappingOutcome.ImplicitConfiguration)
					{
						tmpOperationState.MappingOutcome.ImplicitConfiguration = this.fable.MeadowIntegrationTabularTransform.generateMappingConfigurationPrototype(libPath.basename(tmpOperationState.RawInputFile), tmpOperationState.RawIncomingComprehensionFile, tmpIncomingRecord);

						if ((!tmpOperationState.MappingOutcome.ExplicitConfiguration) || (typeof (tmpOperationState.MappingOutcome.ExplicitConfiguration) != 'object'))
						{
							// Just use the implicit configuration
							this.fable.log.info(`Using implicit configuration for comprehension; no valid explicit configuration available.`);
							tmpOperationState.MappingOutcome.Configuration = Object.assign({}, tmpOperationState.MappingOutcome.ImplicitConfiguration, tmpOperationState.MappingOutcome.UserConfiguration);
						}
						else
						{
							this.fable.log.info(`Using explicit configuration for comprehension.`);

							tmpOperationState.MappingOutcome.Configuration = Object.assign({}, tmpOperationState.MappingOutcome.ImplicitConfiguration, tmpOperationState.MappingOutcome.ExplicitConfiguration, tmpOperationState.MappingOutcome.UserConfiguration);
						}

						if (!('GUIDName' in tmpOperationState.MappingOutcome.Configuration))
						{
							tmpOperationState.MappingOutcome.Configuration.GUIDName = `GUID${tmpOperationState.MappingOutcome.Configuration.Entity}`;
						}

						if (!(tmpOperationState.MappingOutcome.Configuration.Entity in tmpOperationState.MappingOutcome.Comprehension))
						{
							tmpOperationState.MappingOutcome.Comprehension[tmpOperationState.MappingOutcome.Configuration.Entity] = {};
						}
					}

					let tmpMappingRecordSolution = (
						{
							IncomingRecord: tmpIncomingRecord,
							MappingConfiguration: tmpOperationState.MappingOutcome.Configuration,
							MappingOutcome: tmpOperationState.MappingOutcome,

							RowIndex: tmpOperationState.MappingOutcome.ParsedRowCount,

							NewRecordsGUIDUniqueness: [],
							NewRecordPrototype: {},

							Fable: this.fable,
							Pict: this.pict,
							AppData: this.pict.AppData
						});

					// Run the solvers for this record
					let tmpSolverResultsObject = {};
					if (tmpOperationState.MappingOutcome.Configuration.Solvers && Array.isArray(tmpOperationState.MappingOutcome.Configuration.Solvers))
					{
						// Solvers have IncomingRecord, RecordGenerationRules, NewRecordPrototype
						for (let i = 0; i < tmpOperationState.MappingOutcome.Configuration.Solvers.length; i++)
						{
							let tmpSolver = tmpOperationState.MappingOutcome.Configuration.Solvers[i];
							this.fable.ExpressionParser.solve(tmpSolver, tmpMappingRecordSolution, tmpSolverResultsObject, this.fable.manifest, tmpMappingRecordSolution);
						}
					}

					if (tmpOperationState.MappingOutcome.Configuration.MultipleGUIDUniqueness && tmpMappingRecordSolution.NewRecordsGUIDUniqueness.length > 0)
					{
						// Run create record for each of the uniqueness guid entries
						for (let i = 0; i < tmpMappingRecordSolution.NewRecordsGUIDUniqueness.length; i++)
						{
							this.fable.MeadowIntegrationTabularTransform.addRecordToComprehension(tmpIncomingRecord, tmpOperationState.MappingOutcome, tmpMappingRecordSolution.NewRecordPrototype, tmpMappingRecordSolution.NewRecordsGUIDUniqueness[i]);
						}
					}
					else if (!tmpOperationState.MappingOutcome.Configuration.MultipleGUIDUniqueness)
					{
						this.fable.MeadowIntegrationTabularTransform.addRecordToComprehension(tmpIncomingRecord, tmpOperationState.MappingOutcome, tmpMappingRecordSolution.NewRecordPrototype);
					}
					else
					{
						this.fable.log.error(`No valid GUID uniqueness entries generated for record; skipping record.`);
					}


				}
			});

		tmpReadline.on('close',
			() =>
			{
				if (this.CommandOptions.extended)
				{
					this.fable.FilePersistence.writeFileSyncFromObject(tmpOperationState.OutputFilePath, tmpOperationState);
					this.fable.log.info(`Verbose Comprehension written to [${tmpOperationState.OutputFilePath}].`);
				}
				else
				{
					this.fable.FilePersistence.writeFileSyncFromObject(tmpOperationState.OutputFilePath, tmpOperationState.MappingOutcome.Comprehension);
					this.fable.log.info(`Comprehension written to [${tmpOperationState.OutputFilePath}].`);
				}
				this.fable.log.info(`Have a nice day!`);
				return fCallback();
			});
	};
}

module.exports = QuackageCommandCSVTransform;