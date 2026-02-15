/*
	Unit tests for Meadow Integration REST Server

	Exercises all REST API endpoints provided by the integration server.
*/

const Chai = require('chai');
const Expect = Chai.expect;

const libHTTP = require('http');
const libPath = require('path');

const MeadowIntegrationServer = require('../source/restserver/Meadow-Integration-Server.js');

const TEST_PORT = 18086;
const TEST_BASE_URL = `http://localhost:${TEST_PORT}`;

const TEST_DATA_DIR = libPath.join(__dirname, 'data');
const EXAMPLE_DATA_DIR = libPath.join(__dirname, '..', 'docs', 'examples', 'data');

let _Server = null;

// Helper to make HTTP requests
function makeRequest(pMethod, pPath, pBody, fCallback)
{
	let tmpBodyString = (pBody !== null && pBody !== undefined) ? JSON.stringify(pBody) : null;
	let tmpOptions =
		{
			hostname: 'localhost',
			port: TEST_PORT,
			path: pPath,
			method: pMethod,
			headers: {}
		};

	if (tmpBodyString)
	{
		tmpOptions.headers['Content-Type'] = 'application/json';
		tmpOptions.headers['Content-Length'] = Buffer.byteLength(tmpBodyString);
	}

	const tmpRequest = libHTTP.request(tmpOptions,
		(pResponse) =>
		{
			let tmpData = '';
			pResponse.on('data', (pChunk) => { tmpData += pChunk; });
			pResponse.on('end',
				() =>
				{
					let tmpParsed = null;
					try
					{
						tmpParsed = JSON.parse(tmpData);
					}
					catch (pError)
					{
						// Not JSON — return raw string (e.g. CSV)
						tmpParsed = tmpData;
					}
					return fCallback(null, pResponse.statusCode, tmpParsed, pResponse.headers);
				});
		});

	tmpRequest.on('error', (pError) => { return fCallback(pError); });

	if (tmpBodyString)
	{
		tmpRequest.write(tmpBodyString);
	}

	tmpRequest.end();
}

suite
	(
		'Meadow Integration REST Server',
		() =>
		{
			suiteSetup
				(
					(fDone) =>
					{
						_Server = new MeadowIntegrationServer(
							{
								APIServerPort: TEST_PORT,
								LogLevel: 1
							});

						_Server.start(
							(pError) =>
							{
								if (pError)
								{
									console.log('Error starting test server: ', pError);
								}
								Expect(pError).to.not.exist;
								return fDone();
							});
					}
				);

			suiteTeardown
				(
					function(fDone)
					{
						this.timeout(10000);
						if (_Server)
						{
							_Server.stop(
								(pError) =>
								{
									return fDone();
								});
						}
						else
						{
							return fDone();
						}
					}
				);

			// ===== Status Endpoint =====
			suite
				(
					'GET /1.0/Status',
					() =>
					{
						test('Should return server status and endpoint list',
							(fDone) =>
							{
								makeRequest('GET', '/1.0/Status', null,
									(pError, pStatusCode, pBody) =>
									{
										Expect(pError).to.not.exist;
										Expect(pStatusCode).to.equal(200);
										Expect(pBody).to.be.an('object');
										Expect(pBody.Status).to.equal('Running');
										Expect(pBody.Product).to.equal('Meadow-Integration-Server');
										Expect(pBody.Endpoints).to.be.an('array');
										Expect(pBody.Endpoints.length).to.equal(15);
										return fDone();
									});
							});
					}
				);

			// ===== CSV Check Endpoint =====
			suite
				(
					'POST /1.0/CSV/Check',
					() =>
					{
						test('Should analyze a CSV file and return statistics',
							(fDone) =>
							{
								makeRequest('POST', '/1.0/CSV/Check',
									{ File: libPath.join(TEST_DATA_DIR, 'test-small.csv') },
									(pError, pStatusCode, pBody) =>
									{
										Expect(pError).to.not.exist;
										Expect(pStatusCode).to.equal(200);
										Expect(pBody).to.be.an('object');
										Expect(pBody.RowCount).to.equal(5);
										Expect(pBody.ColumnCount).to.equal(5);
										Expect(pBody.Headers).to.be.an('array');
										Expect(pBody.Headers).to.include('id');
										Expect(pBody.Headers).to.include('name');
										return fDone();
									});
							});

						test('Should return 400 when no File is provided',
							(fDone) =>
							{
								makeRequest('POST', '/1.0/CSV/Check', {},
									(pError, pStatusCode, pBody) =>
									{
										Expect(pError).to.not.exist;
										Expect(pStatusCode).to.equal(400);
										Expect(pBody.Error).to.be.a('string');
										return fDone();
									});
							});

						test('Should return 404 when file does not exist',
							(fDone) =>
							{
								makeRequest('POST', '/1.0/CSV/Check',
									{ File: '/tmp/nonexistent-test-file-99999.csv' },
									(pError, pStatusCode, pBody) =>
									{
										Expect(pError).to.not.exist;
										Expect(pStatusCode).to.equal(404);
										Expect(pBody.Error).to.be.a('string');
										return fDone();
									});
							});

						test('Should include records when Records flag is true',
							(fDone) =>
							{
								makeRequest('POST', '/1.0/CSV/Check',
									{ File: libPath.join(TEST_DATA_DIR, 'test-small.csv'), Records: true },
									(pError, pStatusCode, pBody) =>
									{
										Expect(pError).to.not.exist;
										Expect(pStatusCode).to.equal(200);
										Expect(pBody.Records).to.be.an('array');
										// Records are pushed per-column in collectStatistics, so count = rows * columns
										Expect(pBody.Records.length).to.be.greaterThan(0);
										Expect(pBody.RowCount).to.equal(5);
										return fDone();
									});
							});

						test('Should analyze the airports CSV',
							(fDone) =>
							{
								makeRequest('POST', '/1.0/CSV/Check',
									{ File: libPath.join(TEST_DATA_DIR, 'vega', 'airports.csv') },
									(pError, pStatusCode, pBody) =>
									{
										Expect(pError).to.not.exist;
										Expect(pStatusCode).to.equal(200);
										Expect(pBody.RowCount).to.equal(3376);
										Expect(pBody.ColumnCount).to.equal(7);
										return fDone();
									});
							});
					}
				);

			// ===== CSV Transform Endpoint =====
			suite
				(
					'POST /1.0/CSV/Transform',
					() =>
					{
						test('Should transform a CSV file into a comprehension with implicit config',
							(fDone) =>
							{
								makeRequest('POST', '/1.0/CSV/Transform',
									{ File: libPath.join(TEST_DATA_DIR, 'test-small.csv') },
									(pError, pStatusCode, pBody) =>
									{
										Expect(pError).to.not.exist;
										Expect(pStatusCode).to.equal(200);
										Expect(pBody).to.be.an('object');
										// Implicit config should auto-detect entity from filename
										let tmpEntityKeys = Object.keys(pBody);
										Expect(tmpEntityKeys.length).to.be.greaterThan(0);
										// Check that records exist in the entity
										let tmpFirstEntity = pBody[tmpEntityKeys[0]];
										Expect(Object.keys(tmpFirstEntity).length).to.equal(5);
										return fDone();
									});
							});

						test('Should transform with explicit entity and GUID template',
							(fDone) =>
							{
								makeRequest('POST', '/1.0/CSV/Transform',
									{
										File: libPath.join(TEST_DATA_DIR, 'test-small.csv'),
										Entity: 'Person',
										GUIDName: 'GUIDPerson',
										GUIDTemplate: 'Person_{~D:Record.id~}'
									},
									(pError, pStatusCode, pBody) =>
									{
										Expect(pError).to.not.exist;
										Expect(pStatusCode).to.equal(200);
										Expect(pBody).to.have.property('Person');
										Expect(pBody.Person).to.have.property('Person_1');
										Expect(pBody.Person).to.have.property('Person_5');
										Expect(pBody.Person['Person_1'].name).to.equal('Alice');
										return fDone();
									});
							});

						test('Should transform with custom column mappings',
							(fDone) =>
							{
								makeRequest('POST', '/1.0/CSV/Transform',
									{
										File: libPath.join(TEST_DATA_DIR, 'test-small.csv'),
										Entity: 'Person',
										GUIDName: 'GUIDPerson',
										GUIDTemplate: 'Person_{~D:Record.id~}',
										Mappings:
										{
											FullName: '{~D:Record.name~}',
											Location: '{~D:Record.city~}'
										}
									},
									(pError, pStatusCode, pBody) =>
									{
										Expect(pError).to.not.exist;
										Expect(pStatusCode).to.equal(200);
										Expect(pBody.Person['Person_1'].FullName).to.equal('Alice');
										Expect(pBody.Person['Person_1'].Location).to.equal('Seattle');
										return fDone();
									});
							});

						test('Should return extended state when Extended flag is set',
							(fDone) =>
							{
								makeRequest('POST', '/1.0/CSV/Transform',
									{
										File: libPath.join(TEST_DATA_DIR, 'test-small.csv'),
										Entity: 'Person',
										Extended: true
									},
									(pError, pStatusCode, pBody) =>
									{
										Expect(pError).to.not.exist;
										Expect(pStatusCode).to.equal(200);
										Expect(pBody).to.have.property('Comprehension');
										Expect(pBody).to.have.property('ParsedRowCount');
										Expect(pBody).to.have.property('Configuration');
										Expect(pBody.ParsedRowCount).to.be.greaterThan(0);
										return fDone();
									});
							});

						test('Should return 400 when no File is provided',
							(fDone) =>
							{
								makeRequest('POST', '/1.0/CSV/Transform', {},
									(pError, pStatusCode, pBody) =>
									{
										Expect(pError).to.not.exist;
										Expect(pStatusCode).to.equal(400);
										return fDone();
									});
							});

						test('Should return 404 when file does not exist',
							(fDone) =>
							{
								makeRequest('POST', '/1.0/CSV/Transform',
									{ File: '/tmp/nonexistent-test-file-99999.csv' },
									(pError, pStatusCode, pBody) =>
									{
										Expect(pError).to.not.exist;
										Expect(pStatusCode).to.equal(404);
										return fDone();
									});
							});
					}
				);

			// ===== TSV Check Endpoint =====
			suite
				(
					'POST /1.0/TSV/Check',
					() =>
					{
						test('Should analyze a TSV file and return statistics',
							(fDone) =>
							{
								makeRequest('POST', '/1.0/TSV/Check',
									{ File: libPath.join(TEST_DATA_DIR, 'test-small.tsv') },
									(pError, pStatusCode, pBody) =>
									{
										Expect(pError).to.not.exist;
										Expect(pStatusCode).to.equal(200);
										Expect(pBody.RowCount).to.equal(5);
										Expect(pBody.ColumnCount).to.equal(5);
										Expect(pBody.Headers).to.include('id');
										Expect(pBody.Headers).to.include('name');
										return fDone();
									});
							});

						test('Should return 400 when no File is provided',
							(fDone) =>
							{
								makeRequest('POST', '/1.0/TSV/Check', {},
									(pError, pStatusCode, pBody) =>
									{
										Expect(pError).to.not.exist;
										Expect(pStatusCode).to.equal(400);
										return fDone();
									});
							});

						test('Should return 404 for nonexistent file',
							(fDone) =>
							{
								makeRequest('POST', '/1.0/TSV/Check',
									{ File: '/tmp/nonexistent-test-file-99999.tsv' },
									(pError, pStatusCode, pBody) =>
									{
										Expect(pError).to.not.exist;
										Expect(pStatusCode).to.equal(404);
										return fDone();
									});
							});
					}
				);

			// ===== TSV Transform Endpoint =====
			suite
				(
					'POST /1.0/TSV/Transform',
					() =>
					{
						test('Should transform a TSV file into a comprehension',
							(fDone) =>
							{
								makeRequest('POST', '/1.0/TSV/Transform',
									{
										File: libPath.join(TEST_DATA_DIR, 'test-small.tsv'),
										Entity: 'Person',
										GUIDName: 'GUIDPerson',
										GUIDTemplate: 'Person_{~D:Record.id~}'
									},
									(pError, pStatusCode, pBody) =>
									{
										Expect(pError).to.not.exist;
										Expect(pStatusCode).to.equal(200);
										Expect(pBody).to.have.property('Person');
										Expect(pBody.Person).to.have.property('Person_1');
										Expect(pBody.Person['Person_1'].name).to.equal('Alice');
										Expect(Object.keys(pBody.Person).length).to.equal(5);
										return fDone();
									});
							});

						test('Should return 400 when no File is provided',
							(fDone) =>
							{
								makeRequest('POST', '/1.0/TSV/Transform', {},
									(pError, pStatusCode, pBody) =>
									{
										Expect(pError).to.not.exist;
										Expect(pStatusCode).to.equal(400);
										return fDone();
									});
							});
					}
				);

			// ===== JSON Array Transform Endpoint =====
			suite
				(
					'POST /1.0/JSONArray/Transform',
					() =>
					{
						test('Should transform a JSON array file into a comprehension',
							(fDone) =>
							{
								makeRequest('POST', '/1.0/JSONArray/Transform',
									{
										File: libPath.join(TEST_DATA_DIR, 'test-small.json'),
										Entity: 'Person',
										GUIDName: 'GUIDPerson',
										GUIDTemplate: 'Person_{~D:Record.id~}'
									},
									(pError, pStatusCode, pBody) =>
									{
										Expect(pError).to.not.exist;
										Expect(pStatusCode).to.equal(200);
										Expect(pBody).to.have.property('Person');
										Expect(pBody.Person).to.have.property('Person_1');
										Expect(pBody.Person['Person_1'].name).to.equal('Alice');
										Expect(Object.keys(pBody.Person).length).to.equal(5);
										return fDone();
									});
							});

						test('Should return 400 when no File is provided',
							(fDone) =>
							{
								makeRequest('POST', '/1.0/JSONArray/Transform', {},
									(pError, pStatusCode, pBody) =>
									{
										Expect(pError).to.not.exist;
										Expect(pStatusCode).to.equal(400);
										return fDone();
									});
							});

						test('Should return 404 for nonexistent file',
							(fDone) =>
							{
								makeRequest('POST', '/1.0/JSONArray/Transform',
									{ File: '/tmp/nonexistent-test-file-99999.json' },
									(pError, pStatusCode, pBody) =>
									{
										Expect(pError).to.not.exist;
										Expect(pStatusCode).to.equal(404);
										return fDone();
									});
							});
					}
				);

			// ===== JSON Array Transform Records Endpoint =====
			suite
				(
					'POST /1.0/JSONArray/TransformRecords',
					() =>
					{
						test('Should transform in-memory records into a comprehension',
							(fDone) =>
							{
								makeRequest('POST', '/1.0/JSONArray/TransformRecords',
									{
										Records:
										[
											{ id: '1', name: 'Alice', city: 'Seattle' },
											{ id: '2', name: 'Bob', city: 'Portland' },
											{ id: '3', name: 'Carol', city: 'Vancouver' }
										],
										Entity: 'Person',
										GUIDName: 'GUIDPerson',
										GUIDTemplate: 'Person_{~D:Record.id~}',
										Mappings:
										{
											FullName: '{~D:Record.name~}',
											Location: '{~D:Record.city~}'
										}
									},
									(pError, pStatusCode, pBody) =>
									{
										Expect(pError).to.not.exist;
										Expect(pStatusCode).to.equal(200);
										Expect(pBody).to.have.property('Person');
										Expect(pBody.Person).to.have.property('Person_1');
										Expect(pBody.Person['Person_1'].FullName).to.equal('Alice');
										Expect(pBody.Person['Person_1'].Location).to.equal('Seattle');
										Expect(Object.keys(pBody.Person).length).to.equal(3);
										return fDone();
									});
							});

						test('Should return 400 when no Records array is provided',
							(fDone) =>
							{
								makeRequest('POST', '/1.0/JSONArray/TransformRecords', {},
									(pError, pStatusCode, pBody) =>
									{
										Expect(pError).to.not.exist;
										Expect(pStatusCode).to.equal(400);
										Expect(pBody.Error).to.contain('Records');
										return fDone();
									});
							});

						test('Should return 400 when Records array is empty',
							(fDone) =>
							{
								makeRequest('POST', '/1.0/JSONArray/TransformRecords',
									{ Records: [] },
									(pError, pStatusCode, pBody) =>
									{
										Expect(pError).to.not.exist;
										Expect(pStatusCode).to.equal(400);
										Expect(pBody.Error).to.contain('empty');
										return fDone();
									});
							});

						test('Should return extended state when requested',
							(fDone) =>
							{
								makeRequest('POST', '/1.0/JSONArray/TransformRecords',
									{
										Records:
										[
											{ id: '1', name: 'Alice' }
										],
										Entity: 'Person',
										Extended: true
									},
									(pError, pStatusCode, pBody) =>
									{
										Expect(pError).to.not.exist;
										Expect(pStatusCode).to.equal(200);
										Expect(pBody).to.have.property('Comprehension');
										Expect(pBody).to.have.property('ParsedRowCount');
										Expect(pBody.ParsedRowCount).to.equal(1);
										return fDone();
									});
							});
					}
				);

			// ===== Comprehension Intersect Endpoint =====
			suite
				(
					'POST /1.0/Comprehension/Intersect',
					() =>
					{
						test('Should merge two in-memory comprehensions',
							(fDone) =>
							{
								makeRequest('POST', '/1.0/Comprehension/Intersect',
									{
										PrimaryComprehension:
										{
											Person:
											{
												Person_1: { GUIDPerson: 'Person_1', Name: 'Alice', City: 'Seattle' },
												Person_2: { GUIDPerson: 'Person_2', Name: 'Bob', City: 'Portland' }
											}
										},
										SecondaryComprehension:
										{
											Person:
											{
												Person_1: { GUIDPerson: 'Person_1', Score: '95' },
												Person_3: { GUIDPerson: 'Person_3', Name: 'Carol', City: 'Vancouver' }
											}
										},
										Entity: 'Person'
									},
									(pError, pStatusCode, pBody) =>
									{
										Expect(pError).to.not.exist;
										Expect(pStatusCode).to.equal(200);
										Expect(pBody.Person).to.have.property('Person_1');
										Expect(pBody.Person).to.have.property('Person_2');
										Expect(pBody.Person).to.have.property('Person_3');
										// Merged record should have both original and secondary properties
										Expect(pBody.Person['Person_1'].Name).to.equal('Alice');
										Expect(pBody.Person['Person_1'].Score).to.equal('95');
										Expect(Object.keys(pBody.Person).length).to.equal(3);
										return fDone();
									});
							});

						test('Should auto-detect entity when not specified',
							(fDone) =>
							{
								makeRequest('POST', '/1.0/Comprehension/Intersect',
									{
										PrimaryComprehension:
										{
											Book:
											{
												Book_1: { GUIDBook: 'Book_1', Title: 'Test Book' }
											}
										},
										SecondaryComprehension:
										{
											Book:
											{
												Book_1: { GUIDBook: 'Book_1', Rating: '4.5' }
											}
										}
									},
									(pError, pStatusCode, pBody) =>
									{
										Expect(pError).to.not.exist;
										Expect(pStatusCode).to.equal(200);
										Expect(pBody.Book['Book_1'].Title).to.equal('Test Book');
										Expect(pBody.Book['Book_1'].Rating).to.equal('4.5');
										return fDone();
									});
							});

						test('Should return 400 when PrimaryComprehension is missing',
							(fDone) =>
							{
								makeRequest('POST', '/1.0/Comprehension/Intersect',
									{ SecondaryComprehension: { Book: {} } },
									(pError, pStatusCode, pBody) =>
									{
										Expect(pError).to.not.exist;
										Expect(pStatusCode).to.equal(400);
										Expect(pBody.Error).to.contain('PrimaryComprehension');
										return fDone();
									});
							});

						test('Should return 400 when SecondaryComprehension is missing',
							(fDone) =>
							{
								makeRequest('POST', '/1.0/Comprehension/Intersect',
									{ PrimaryComprehension: { Book: {} } },
									(pError, pStatusCode, pBody) =>
									{
										Expect(pError).to.not.exist;
										Expect(pStatusCode).to.equal(400);
										Expect(pBody.Error).to.contain('SecondaryComprehension');
										return fDone();
									});
							});
					}
				);

			// ===== Comprehension Intersect Files Endpoint =====
			suite
				(
					'POST /1.0/Comprehension/IntersectFiles',
					() =>
					{
						test('Should merge two comprehension files',
							(fDone) =>
							{
								makeRequest('POST', '/1.0/Comprehension/IntersectFiles',
									{
										File: libPath.join(TEST_DATA_DIR, 'test-comprehension.json'),
										IntersectFile: libPath.join(TEST_DATA_DIR, 'test-comprehension-secondary.json'),
										Entity: 'Person'
									},
									(pError, pStatusCode, pBody) =>
									{
										Expect(pError).to.not.exist;
										Expect(pStatusCode).to.equal(200);
										Expect(pBody.Person).to.have.property('Person_1');
										Expect(pBody.Person).to.have.property('Person_2');
										Expect(pBody.Person).to.have.property('Person_3');
										Expect(pBody.Person).to.have.property('Person_4');
										// Merged fields
										Expect(pBody.Person['Person_1'].Name).to.equal('Alice');
										Expect(pBody.Person['Person_1'].Score).to.equal('95');
										return fDone();
									});
							});

						test('Should return 400 when File is missing',
							(fDone) =>
							{
								makeRequest('POST', '/1.0/Comprehension/IntersectFiles',
									{ IntersectFile: libPath.join(TEST_DATA_DIR, 'test-comprehension-secondary.json') },
									(pError, pStatusCode, pBody) =>
									{
										Expect(pError).to.not.exist;
										Expect(pStatusCode).to.equal(400);
										return fDone();
									});
							});

						test('Should return 400 when IntersectFile is missing',
							(fDone) =>
							{
								makeRequest('POST', '/1.0/Comprehension/IntersectFiles',
									{ File: libPath.join(TEST_DATA_DIR, 'test-comprehension.json') },
									(pError, pStatusCode, pBody) =>
									{
										Expect(pError).to.not.exist;
										Expect(pStatusCode).to.equal(400);
										return fDone();
									});
							});

						test('Should return 404 for nonexistent primary file',
							(fDone) =>
							{
								makeRequest('POST', '/1.0/Comprehension/IntersectFiles',
									{
										File: '/tmp/nonexistent-primary-99999.json',
										IntersectFile: libPath.join(TEST_DATA_DIR, 'test-comprehension-secondary.json')
									},
									(pError, pStatusCode, pBody) =>
									{
										Expect(pError).to.not.exist;
										Expect(pStatusCode).to.equal(404);
										return fDone();
									});
							});
					}
				);

			// ===== Comprehension ToArray Endpoint =====
			suite
				(
					'POST /1.0/Comprehension/ToArray',
					() =>
					{
						test('Should convert comprehension to an array',
							(fDone) =>
							{
								makeRequest('POST', '/1.0/Comprehension/ToArray',
									{
										Comprehension:
										{
											Person:
											{
												Person_1: { GUIDPerson: 'Person_1', Name: 'Alice' },
												Person_2: { GUIDPerson: 'Person_2', Name: 'Bob' },
												Person_3: { GUIDPerson: 'Person_3', Name: 'Carol' }
											}
										},
										Entity: 'Person'
									},
									(pError, pStatusCode, pBody) =>
									{
										Expect(pError).to.not.exist;
										Expect(pStatusCode).to.equal(200);
										Expect(pBody).to.be.an('array');
										Expect(pBody.length).to.equal(3);
										let tmpNames = pBody.map((r) => r.Name);
										Expect(tmpNames).to.include('Alice');
										Expect(tmpNames).to.include('Bob');
										Expect(tmpNames).to.include('Carol');
										return fDone();
									});
							});

						test('Should auto-detect entity when not specified',
							(fDone) =>
							{
								makeRequest('POST', '/1.0/Comprehension/ToArray',
									{
										Comprehension:
										{
											Book:
											{
												Book_1: { Title: 'Test Book' }
											}
										}
									},
									(pError, pStatusCode, pBody) =>
									{
										Expect(pError).to.not.exist;
										Expect(pStatusCode).to.equal(200);
										Expect(pBody).to.be.an('array');
										Expect(pBody.length).to.equal(1);
										Expect(pBody[0].Title).to.equal('Test Book');
										return fDone();
									});
							});

						test('Should return 400 when no Comprehension is provided',
							(fDone) =>
							{
								makeRequest('POST', '/1.0/Comprehension/ToArray', {},
									(pError, pStatusCode, pBody) =>
									{
										Expect(pError).to.not.exist;
										Expect(pStatusCode).to.equal(400);
										return fDone();
									});
							});
					}
				);

			// ===== Comprehension ToArrayFromFile Endpoint =====
			suite
				(
					'POST /1.0/Comprehension/ToArrayFromFile',
					() =>
					{
						test('Should convert comprehension file to an array',
							(fDone) =>
							{
								makeRequest('POST', '/1.0/Comprehension/ToArrayFromFile',
									{
										File: libPath.join(TEST_DATA_DIR, 'test-comprehension.json'),
										Entity: 'Person'
									},
									(pError, pStatusCode, pBody) =>
									{
										Expect(pError).to.not.exist;
										Expect(pStatusCode).to.equal(200);
										Expect(pBody).to.be.an('array');
										Expect(pBody.length).to.equal(3);
										return fDone();
									});
							});

						test('Should return 400 when no File is provided',
							(fDone) =>
							{
								makeRequest('POST', '/1.0/Comprehension/ToArrayFromFile', {},
									(pError, pStatusCode, pBody) =>
									{
										Expect(pError).to.not.exist;
										Expect(pStatusCode).to.equal(400);
										return fDone();
									});
							});

						test('Should return 404 for nonexistent file',
							(fDone) =>
							{
								makeRequest('POST', '/1.0/Comprehension/ToArrayFromFile',
									{ File: '/tmp/nonexistent-test-99999.json' },
									(pError, pStatusCode, pBody) =>
									{
										Expect(pError).to.not.exist;
										Expect(pStatusCode).to.equal(404);
										return fDone();
									});
							});
					}
				);

			// ===== Comprehension ToCSV Endpoint =====
			suite
				(
					'POST /1.0/Comprehension/ToCSV',
					() =>
					{
						test('Should convert a Records array to CSV',
							(fDone) =>
							{
								makeRequest('POST', '/1.0/Comprehension/ToCSV',
									{
										Records:
										[
											{ Name: 'Alice', City: 'Seattle', Score: 95 },
											{ Name: 'Bob', City: 'Portland', Score: 87 }
										]
									},
									(pError, pStatusCode, pBody, pHeaders) =>
									{
										Expect(pError).to.not.exist;
										Expect(pStatusCode).to.equal(200);
										// Body should be raw CSV text
										Expect(pBody).to.be.a('string');
										Expect(pBody).to.contain('City');
										Expect(pBody).to.contain('Name');
										Expect(pBody).to.contain('Alice');
										Expect(pBody).to.contain('Bob');
										return fDone();
									});
							});

						test('Should convert a Comprehension object to CSV',
							(fDone) =>
							{
								makeRequest('POST', '/1.0/Comprehension/ToCSV',
									{
										Comprehension:
										{
											Person:
											{
												Person_1: { Name: 'Alice', City: 'Seattle' },
												Person_2: { Name: 'Bob', City: 'Portland' }
											}
										},
										Entity: 'Person'
									},
									(pError, pStatusCode, pBody) =>
									{
										Expect(pError).to.not.exist;
										Expect(pStatusCode).to.equal(200);
										Expect(pBody).to.be.a('string');
										Expect(pBody).to.contain('Alice');
										Expect(pBody).to.contain('Seattle');
										return fDone();
									});
							});

						test('Should return 400 when no data is provided',
							(fDone) =>
							{
								makeRequest('POST', '/1.0/Comprehension/ToCSV', {},
									(pError, pStatusCode, pBody) =>
									{
										Expect(pError).to.not.exist;
										Expect(pStatusCode).to.equal(400);
										return fDone();
									});
							});
					}
				);

			// ===== Comprehension ToCSVFromFile Endpoint =====
			suite
				(
					'POST /1.0/Comprehension/ToCSVFromFile',
					() =>
					{
						test('Should convert a comprehension file to CSV',
							(fDone) =>
							{
								makeRequest('POST', '/1.0/Comprehension/ToCSVFromFile',
									{
										File: libPath.join(TEST_DATA_DIR, 'test-comprehension.json'),
										Entity: 'Person'
									},
									(pError, pStatusCode, pBody) =>
									{
										Expect(pError).to.not.exist;
										Expect(pStatusCode).to.equal(200);
										Expect(pBody).to.be.a('string');
										Expect(pBody).to.contain('Alice');
										Expect(pBody).to.contain('GUIDPerson');
										return fDone();
									});
							});

						test('Should convert a JSON array file to CSV',
							(fDone) =>
							{
								makeRequest('POST', '/1.0/Comprehension/ToCSVFromFile',
									{
										File: libPath.join(TEST_DATA_DIR, 'test-small.json')
									},
									(pError, pStatusCode, pBody) =>
									{
										Expect(pError).to.not.exist;
										Expect(pStatusCode).to.equal(200);
										Expect(pBody).to.be.a('string');
										Expect(pBody).to.contain('Alice');
										Expect(pBody).to.contain('Seattle');
										return fDone();
									});
							});

						test('Should return 400 when no File is provided',
							(fDone) =>
							{
								makeRequest('POST', '/1.0/Comprehension/ToCSVFromFile', {},
									(pError, pStatusCode, pBody) =>
									{
										Expect(pError).to.not.exist;
										Expect(pStatusCode).to.equal(400);
										return fDone();
									});
							});

						test('Should return 404 for nonexistent file',
							(fDone) =>
							{
								makeRequest('POST', '/1.0/Comprehension/ToCSVFromFile',
									{ File: '/tmp/nonexistent-test-99999.json' },
									(pError, pStatusCode, pBody) =>
									{
										Expect(pError).to.not.exist;
										Expect(pStatusCode).to.equal(404);
										return fDone();
									});
							});
					}
				);

			// ===== Comprehension Push Endpoint =====
			suite
				(
					'POST /1.0/Comprehension/Push',
					() =>
					{
						test('Should return 400 when no Comprehension is provided',
							(fDone) =>
							{
								makeRequest('POST', '/1.0/Comprehension/Push', {},
									(pError, pStatusCode, pBody) =>
									{
										Expect(pError).to.not.exist;
										Expect(pStatusCode).to.equal(400);
										Expect(pBody.Error).to.contain('Comprehension');
										return fDone();
									});
							});
					}
				);

			// ===== Comprehension PushFile Endpoint =====
			suite
				(
					'POST /1.0/Comprehension/PushFile',
					() =>
					{
						test('Should return 400 when no File is provided',
							(fDone) =>
							{
								makeRequest('POST', '/1.0/Comprehension/PushFile', {},
									(pError, pStatusCode, pBody) =>
									{
										Expect(pError).to.not.exist;
										Expect(pStatusCode).to.equal(400);
										return fDone();
									});
							});

						test('Should return 404 for nonexistent file',
							(fDone) =>
							{
								makeRequest('POST', '/1.0/Comprehension/PushFile',
									{ File: '/tmp/nonexistent-test-99999.json' },
									(pError, pStatusCode, pBody) =>
									{
										Expect(pError).to.not.exist;
										Expect(pStatusCode).to.equal(404);
										return fDone();
									});
							});
					}
				);

			// ===== Entity FromTabularFolder Endpoint =====
			suite
				(
					'POST /1.0/Entity/FromTabularFolder',
					() =>
					{
						test('Should generate comprehensions from a folder of CSV files',
							(fDone) =>
							{
								makeRequest('POST', '/1.0/Entity/FromTabularFolder',
									{
										Folder: libPath.join(EXAMPLE_DATA_DIR, 'seattle_neighborhoods')
									},
									(pError, pStatusCode, pBody) =>
									{
										Expect(pError).to.not.exist;
										Expect(pStatusCode).to.equal(200);
										Expect(pBody).to.be.an('object');
										// Should have entities derived from the 3 CSV files
										let tmpEntityKeys = Object.keys(pBody);
										Expect(tmpEntityKeys.length).to.be.greaterThan(0);
										return fDone();
									});
							});

						test('Should return 400 when no Folder is provided',
							(fDone) =>
							{
								makeRequest('POST', '/1.0/Entity/FromTabularFolder', {},
									(pError, pStatusCode, pBody) =>
									{
										Expect(pError).to.not.exist;
										Expect(pStatusCode).to.equal(400);
										Expect(pBody.Error).to.contain('Folder');
										return fDone();
									});
							});

						test('Should return 404 for nonexistent folder',
							(fDone) =>
							{
								makeRequest('POST', '/1.0/Entity/FromTabularFolder',
									{ Folder: '/tmp/nonexistent-folder-99999/' },
									(pError, pStatusCode, pBody) =>
									{
										Expect(pError).to.not.exist;
										Expect(pStatusCode).to.equal(404);
										return fDone();
									});
							});
					}
				);

			// ===== Server Instantiation Tests =====
			suite
				(
					'Server Instantiation',
					() =>
					{
						test('Should be able to instantiate a MeadowIntegrationServer',
							(fDone) =>
							{
								let tmpServer = new MeadowIntegrationServer({ APIServerPort: 19999 });
								Expect(tmpServer).to.be.an('object');
								Expect(tmpServer._Fable).to.be.an('object');
								Expect(tmpServer._Orator).to.be.an('object');
								return fDone();
							});

						test('Should export MeadowIntegrationServer from main module',
							(fDone) =>
							{
								let tmpModule = require('../source/Meadow-Integration.js');
								Expect(tmpModule).to.have.property('IntegrationServer');
								Expect(tmpModule.IntegrationServer).to.be.a('function');
								return fDone();
							});
					}
				);
		}
	);
