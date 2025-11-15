const libMeadowIntegrationCLI = require(`../source/cli/Meadow-Integration-CLI-Program.js`);

//libMeadowIntegrationCLI.run(['node', 'Harness.js', 'comprehensionintersect', 'Set1.json', '-i', 'Set2.json', '-o', 'Intersected-Comprehension-Set.json']);

//libMeadowIntegrationCLI.run(['node', 'Harness.js', 'objectarraytocsv', './Array-Comprehension-Intersected-Comprehension-Set.json.json']);

//libMeadowIntegrationCLI.run(['node', 'Harness.js', 'tsvtransform', './RIDOT.tsv', '-g', '{~D:Record.IDDocument~}']);


// libMeadowIntegrationCLI.run([
// 	'node', 'Harness.js',
// 	'csvtransform',
// 	`${__dirname}/../docs/examples/data/books.csv`,
// 	'-m', `${__dirname}/../docs/examples/bookstore/mapping_books_Book.json`,
// 	/*'-i', `${__dirname}/Books-Comprehension.json`,*/
// 	'-o', `${__dirname}/Books-Comprehension.json`]);


// libMeadowIntegrationCLI.run([
// 	'node', 'Harness.js',
// 	'csvtransform',
// 	`${__dirname}/../docs/examples/data/books.csv`,
// 	'-m', `${__dirname}/../docs/examples/bookstore/mapping_books_Author.json`,
// 	'-i', `${__dirname}/Books-Comprehension.json`,
// 	'-o', `${__dirname}/Books-Comprehension.json`]);


// libMeadowIntegrationCLI.run([
// 	'node', 'Harness.js',
// 	'csvtransform',
// 	`${__dirname}/../docs/examples/data/books.csv`,
// 	'-m', `${__dirname}/../docs/examples/bookstore/mapping_books_BookAuthorJoin.json`,
// 	'-i', `${__dirname}/Books-Comprehension.json`,
// 	'-o', `${__dirname}/Books-Comprehension.json`]);


libMeadowIntegrationCLI.run([
	'node', 'Harness.js',
	'push',
	`${__dirname}/Books-Comprehension.json`]);


