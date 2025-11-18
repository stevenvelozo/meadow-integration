const libCLIProgram = require('pict-service-commandlineutility');

let _PictCLIProgram = new libCLIProgram(
	{
		Product: 'Meadow-Integration-CLI',
		Version: require('../../package.json').version,

		Command: 'meadow-integration',
		Description: 'Meadow data integration toolkit.',

		DefaultProgramConfiguration: require('./Default-Meadow-Integration-Configuration.json'),

		ProgramConfigurationFileName: '.meadow-integration.json',
		AutoGatherProgramConfiguration: true,
		AutoAddConfigurationExplanationCommand: true
	},
	[
		// CSV file handling
		require('./commands/Meadow-Integration-Command-CSVCheck.js'),
		require('./commands/Meadow-Integration-Command-CSVTransform.js'),
		require('./commands/Meadow-Integration-Command-TSVTransform.js'),
		require('./commands/Meadow-Integration-Command-CSVIntersect.js'),
		require('./commands/Meadow-Integration-Command-ObjectArrayToCSV.js'),

		require('./commands/Meadow-Integration-Command-EntityFromTabularFolder.js'),

		// Comprehension file handling
		require('./commands/Meadow-Integration-Command-ComprehensionIntersect.js'),
		require('./commands/Meadow-Integration-Command-ComprehensionArray.js'),

		require('./commands/Meadow-Integration-Command-ComprehensionPush.js')
	]);

_PictCLIProgram.instantiateServiceProvider('FilePersistence');
_PictCLIProgram.instantiateServiceProvider('DataGeneration');

module.exports = _PictCLIProgram;