const libMeadowIntegrationCLI = require(`../source/cli/Meadow-Integration-CLI-Program.js`);

//libMeadowIntegrationCLI.run(['node', 'Harness.js', 'comprehensionintersect', 'Set1.json', '-i', 'Set2.json', '-o', 'Intersected-Comprehension-Set.json']);

//libMeadowIntegrationCLI.run(['node', 'Harness.js', 'objectarraytocsv', './Array-Comprehension-Intersected-Comprehension-Set.json.json']);

//libMeadowIntegrationCLI.run(['node', 'Harness.js', 'tsvtransform', './RIDOT.tsv', '-g', '{~D:Record.IDDocument~}']);

libMeadowIntegrationCLI.run([
	'node', 'Harness.js',
	'csvtransform',
	`${__dirname}/../docs/examples/data/books.csv`,
	'-m', `${__dirname}/../docs/examples/bookstore/mapping_book_author_join.json`,
	'-o', `${__dirname}/Books-Transformed-BookAuthorJoin.json`]);

// libMeadowIntegrationCLI.run([
// 	'node', 'Harness.js',
// 	'csvtransform',
// 	`${__dirname}/../docs/examples/data/books.csv`,
// 	'-m', `${__dirname}/../docs/examples/bookstore/mapping_books_author.json`,
// 	'-o', `${__dirname}/Books-Transformed-Author.json`]);


