#!/usr/bin/env node
/**
 * Example 010: Programmatic API
 * ------------------------------
 * Use meadow-integration services directly in your own Node.js code.
 * This demonstrates using the TabularCheck and TabularTransform services
 * without the CLI, which is useful when integrating into larger applications.
 *
 * Usage:  node Example-010-Programmatic-API.js
 */
const libPict = require('pict');
const libFS = require('fs');
const libPath = require('path');

// Initialize pict (which extends fable with template parsing)
// The TabularTransform service uses parseTemplate, which requires pict.
let _Fable = new libPict({ LogLevel: 3 });

// Instantiate necessary services
_Fable.instantiateServiceProvider('CSVParser');

// Load and register the TabularCheck service
const libTabularCheck = require('../source/services/tabular/Service-TabularCheck.js');
_Fable.addAndInstantiateServiceType('MeadowIntegrationTabularCheck', libTabularCheck);

// Load and register the TabularTransform service
const libTabularTransform = require('../source/services/tabular/Service-TabularTransform.js');
_Fable.addAndInstantiateServiceType('MeadowIntegrationTabularTransform', libTabularTransform);

// ---- Part 1: Collecting Statistics ----
console.log('=== Part 1: TabularCheck - Collecting Statistics ===\n');

let tmpStatistics = _Fable.MeadowIntegrationTabularCheck.newStatisticsObject('ProgrammaticBooks');

// Read and parse a few lines from the CSV
let tmpCSVContent = libFS.readFileSync(
	libPath.join(__dirname, '..', 'docs', 'examples', 'data', 'books.csv'),
	'utf8'
);
let tmpLines = tmpCSVContent.split('\n');

// Parse each line and collect statistics (first 50 rows for quick demo)
let tmpRecordCount = 0;
for (let i = 0; i < Math.min(tmpLines.length, 50); i++)
{
	let tmpRecord = _Fable.CSVParser.parseCSVLine(tmpLines[i]);
	if (tmpRecord)
	{
		_Fable.MeadowIntegrationTabularCheck.collectStatistics(tmpRecord, tmpStatistics);
		tmpRecordCount++;
	}
}

console.log(`Analyzed ${tmpStatistics.RowCount} rows with ${tmpStatistics.ColumnCount} columns`);
console.log(`Headers: ${tmpStatistics.Headers.join(', ')}`);
console.log('');

// Show a few column statistics
let tmpColumnKeys = Object.keys(tmpStatistics.ColumnStatistics);
for (let i = 0; i < Math.min(tmpColumnKeys.length, 5); i++)
{
	let tmpKey = tmpColumnKeys[i];
	let tmpStats = tmpStatistics.ColumnStatistics[tmpKey];
	console.log(`  [${tmpKey}]: ${tmpStats.Count} values, ${tmpStats.EmptyCount} empty, ${tmpStats.NumericCount} numeric`);
}

// ---- Part 2: Transforming Records ----
console.log('\n=== Part 2: TabularTransform - Creating Comprehensions ===\n');

// Set up a mapping outcome
let tmpMappingOutcome = _Fable.MeadowIntegrationTabularTransform.newMappingOutcomeObject();

// Provide explicit configuration (same as a mapping file)
tmpMappingOutcome.ExplicitConfiguration = {
	"Entity": "Book",
	"GUIDTemplate": "Book_{~D:Record.id~}",
	"Mappings": {
		"Title": "{~D:Record.title~}",
		"Language": "{~D:Record.language_code~}",
		"ISBN": "{~D:Record.isbn~}",
		"Genre": "Unknown",
		"Type": "Book"
	}
};

// Create an implicit config from the first record
let tmpFirstRecord = _Fable.CSVParser.parseCSVLine(tmpLines[1]);
tmpMappingOutcome.ImplicitConfiguration = _Fable.MeadowIntegrationTabularTransform.generateMappingConfigurationPrototype('books.csv', tmpFirstRecord);

// Merge configurations
tmpMappingOutcome.Configuration = Object.assign({},
	tmpMappingOutcome.ImplicitConfiguration,
	tmpMappingOutcome.ExplicitConfiguration
);
tmpMappingOutcome.Configuration.GUIDName = `GUID${tmpMappingOutcome.Configuration.Entity}`;
tmpMappingOutcome.Comprehension[tmpMappingOutcome.Configuration.Entity] = {};

// Transform records into the comprehension
for (let i = 1; i < Math.min(tmpLines.length, 11); i++)
{
	let tmpRecord = _Fable.CSVParser.parseCSVLine(tmpLines[i]);
	if (tmpRecord)
	{
		_Fable.MeadowIntegrationTabularTransform.addRecordToComprehension(
			tmpRecord, tmpMappingOutcome);
	}
}

// Show results
let tmpBookKeys = Object.keys(tmpMappingOutcome.Comprehension.Book);
console.log(`Created ${tmpBookKeys.length} Book records in comprehension`);
console.log('');

// Print first 3 records
for (let i = 0; i < Math.min(tmpBookKeys.length, 3); i++)
{
	let tmpBook = tmpMappingOutcome.Comprehension.Book[tmpBookKeys[i]];
	console.log(`  ${tmpBook.GUIDBook}: ${tmpBook.Title} (${tmpBook.Language})`);
}

// ---- Part 3: GUIDMap Service ----
console.log('\n=== Part 3: GUIDMap - Tracking External System IDs ===\n');

const libGUIDMap = require('../source/Meadow-Service-Integration-GUIDMap.js');
_Fable.addAndInstantiateServiceType('MeadowGUIDMap', libGUIDMap);

// Map external GUIDs to Meadow GUIDs and IDs
_Fable.MeadowGUIDMap.mapGUIDToID('Book', 'Book_1', 101);
_Fable.MeadowGUIDMap.mapGUIDToID('Book', 'Book_2', 102);
_Fable.MeadowGUIDMap.mapExternalGUIDtoMeadowGUID('Book', 'LEGACY-ISBN-439023483', 'Book_1');

// Look up in both directions
console.log(`  GUID 'Book_1' -> ID: ${_Fable.MeadowGUIDMap.getIDFromGUID('Book', 'Book_1')}`);
console.log(`  ID 101 -> GUID: ${_Fable.MeadowGUIDMap.getGUIDFromID('Book', 101)}`);
console.log(`  External 'LEGACY-ISBN-439023483' -> Meadow GUID: ${_Fable.MeadowGUIDMap.getMeadowGUIDFromExternalGUID('Book', 'LEGACY-ISBN-439023483')}`);
console.log(`  External 'LEGACY-ISBN-439023483' -> Meadow ID: ${_Fable.MeadowGUIDMap.getMeadowIDFromExternalGUID('Book', 'LEGACY-ISBN-439023483')}`);

console.log('\nDone!');
