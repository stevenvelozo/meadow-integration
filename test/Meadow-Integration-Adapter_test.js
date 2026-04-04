/*
	Unit tests for Retold Integration Adapter

	Validates that the integration adapter correctly fetches the remote
	schema, marshals source records, and upserts them to the server.

	Uses a mock HTTP server to simulate meadow-endpoints API responses.
*/

const Chai = require('chai');
const Expect = Chai.expect;

const libHTTP = require('http');
const libPict = require('pict');
const libIntegrationAdapter = require('../source/Meadow-Service-Integration-Adapter.js');
const libMeadowCloneRestClient = require('../source/services/clone/Meadow-Service-RestClient.js');

// ── Test Constants ──────────────────────────────────────────────────────────────

const MOCK_PORT = 18199;
const MOCK_BASE_URL = `http://localhost:${MOCK_PORT}/1.0/`;

// ── Mock Schema ─────────────────────────────────────────────────────────────────
// This is what the Schema endpoint returns — a JSON schema with properties.

const MOCK_SCHEMA =
{
	title: 'TestEntity',
	type: 'object',
	properties:
	{
		IDTestEntity:   { type: 'integer' },
		GUIDTestEntity: { type: 'string', size: 128 },
		Name:           { type: 'string', size: 200 },
		Value:          { type: 'integer' }
	},
	required: ['IDTestEntity']
};

// ── Mock Server State ───────────────────────────────────────────────────────────

let _MockState =
{
	NextID: 1,
	UpsertedRecords: [],
	StoredRecords: {}
};

function resetMockState()
{
	_MockState.NextID = 1;
	_MockState.UpsertedRecords = [];
	_MockState.StoredRecords = {};
}

// ── Mock HTTP Server ────────────────────────────────────────────────────────────
// Simulates meadow-endpoints API responses for the TestEntity entity.

function createMockServer()
{
	return libHTTP.createServer(
		(pRequest, pResponse) =>
		{
			let tmpURL = pRequest.url;
			let tmpBody = '';

			pResponse.setHeader('Content-Type', 'application/json');

			pRequest.on('data',
				(pChunk) =>
				{
					tmpBody += pChunk;
				});

			pRequest.on('end',
				() =>
				{
					// GET /1.0/TestEntity/Schema
					if (pRequest.method === 'GET' && tmpURL.match(/\/1\.0\/TestEntity\/Schema/))
					{
						pResponse.end(JSON.stringify(MOCK_SCHEMA));
						return;
					}

					// PUT /1.0/TestEntity/Upsert
					if (pRequest.method === 'PUT' && tmpURL.match(/\/1\.0\/TestEntity\/Upsert/))
					{
						let tmpRecord = {};
						try
						{
							tmpRecord = JSON.parse(tmpBody);
						}
						catch (pError)
						{
							pResponse.statusCode = 400;
							pResponse.end(JSON.stringify({ Error: 'Invalid JSON' }));
							return;
						}

						// Assign an auto-incremented ID if not present or zero
						if (!tmpRecord.IDTestEntity || tmpRecord.IDTestEntity === 0)
						{
							tmpRecord.IDTestEntity = _MockState.NextID++;
						}

						// Store and track the upserted record
						_MockState.UpsertedRecords.push(JSON.parse(JSON.stringify(tmpRecord)));
						_MockState.StoredRecords[tmpRecord.GUIDTestEntity] = tmpRecord;

						pResponse.end(JSON.stringify(tmpRecord));
						return;
					}

					// GET /1.0/TestEntitys/By/GUIDTestEntity/{guid}/0/1
					if (pRequest.method === 'GET' && tmpURL.match(/\/1\.0\/TestEntitys\/By\/GUIDTestEntity\//))
					{
						let tmpParts = tmpURL.split('/');
						// URL pattern: /1.0/TestEntitys/By/GUIDTestEntity/{guid}/0/1
						let tmpGUID = tmpParts[5];
						let tmpRecord = _MockState.StoredRecords[tmpGUID];
						if (tmpRecord)
						{
							pResponse.end(JSON.stringify([tmpRecord]));
						}
						else
						{
							pResponse.end(JSON.stringify([]));
						}
						return;
					}

					// Fallback — 404
					pResponse.statusCode = 404;
					pResponse.end(JSON.stringify({ Error: `Unknown endpoint: ${pRequest.method} ${tmpURL}` }));
				});
		});
}

suite
(
	'Integration Adapter Basic',
	() =>
	{
		setup(() => { });

		suite
		(
			'Basic Tests',
			() =>
			{
				test(
					'Object Instantiation',
					(fDone) =>
					{
						let _Fable = new libPict();
						_Fable.addServiceType('IntegrationAdapter', libIntegrationAdapter);
						let tmpIntegrationAdapter = _Fable.instantiateServiceProvider('IntegrationAdapter', { Entity: 'TestEntity' }, 'TestEntity');
						Expect(tmpIntegrationAdapter).to.be.an('object');
						return fDone();
					});
			}
		);
	}
);

suite
(
	'Integration Adapter with Mock Server',
	() =>
	{
		let _MockServer = null;

		suiteSetup
		(
			(fDone) =>
			{
				_MockServer = createMockServer();
				_MockServer.listen(MOCK_PORT,
					() =>
					{
						return fDone();
					});
			}
		);

		suiteTeardown
		(
			(fDone) =>
			{
				if (_MockServer)
				{
					_MockServer.close(fDone);
				}
				else
				{
					return fDone();
				}
			}
		);

		setup
		(
			() =>
			{
				resetMockState();
			}
		);

		// ── Schema Fetch ────────────────────────────────────────────────────

		suite
		(
			'Schema Fetch',
			() =>
			{
				test
				(
					'meadowSchema should be populated after integrateRecords',
					(fDone) =>
					{
						let tmpFable = new libPict(
							{
								Product: 'AdapterTest',
								ProductVersion: '1.0.0',
								LogStreams: [{ streamtype: 'console', level: 'error' }]
							});
						tmpFable.addServiceType('IntegrationAdapter', libIntegrationAdapter);
						tmpFable.serviceManager.addServiceType('MeadowCloneRestClient', libMeadowCloneRestClient);
						tmpFable.serviceManager.instantiateServiceProvider('MeadowCloneRestClient',
							{
								ServerURL: MOCK_BASE_URL
							});

						let tmpAdapter = tmpFable.instantiateServiceProvider('IntegrationAdapter',
							{
								Entity: 'TestEntity',
								SimpleMarshal: true
							}, 'TestEntity');

						tmpAdapter.addSourceRecord({ GUIDTestEntity: 'test-schema-1', Name: 'SchemaCheck', Value: 1 });

						// Before integration, meadowSchema should not be set
						Expect(tmpAdapter.meadowSchema).to.not.be.ok;

						tmpAdapter.integrateRecords(
							(pError) =>
							{
								Expect(pError).to.not.exist;

								// After integration, meadowSchema should be populated
								Expect(tmpAdapter.meadowSchema).to.be.an('object');
								Expect(tmpAdapter.meadowSchema).to.have.property('properties');
								Expect(tmpAdapter.meadowSchema.properties).to.have.property('Name');
								Expect(tmpAdapter.meadowSchema.properties).to.have.property('Value');
								Expect(tmpAdapter.meadowSchema.properties).to.have.property('IDTestEntity');
								Expect(tmpAdapter.meadowSchema.properties).to.have.property('GUIDTestEntity');

								return fDone();
							});
					}
				);
			}
		);

		// ── Full Integration Pipeline ───────────────────────────────────────

		suite
		(
			'Full Integration Pipeline',
			() =>
			{
				test
				(
					'upsert body should include marshaled field values (not just the GUID)',
					function (fDone)
					{
						this.timeout(10000);

						let tmpFable = new libPict(
							{
								Product: 'AdapterTest',
								ProductVersion: '1.0.0',
								LogStreams: [{ streamtype: 'console', level: 'error' }]
							});
						tmpFable.addServiceType('IntegrationAdapter', libIntegrationAdapter);
						tmpFable.serviceManager.addServiceType('MeadowCloneRestClient', libMeadowCloneRestClient);
						tmpFable.serviceManager.instantiateServiceProvider('MeadowCloneRestClient',
							{
								ServerURL: MOCK_BASE_URL
							});

						let tmpAdapter = tmpFable.instantiateServiceProvider('IntegrationAdapter',
							{
								Entity: 'TestEntity',
								SimpleMarshal: true
							}, 'TestEntity');

						tmpAdapter.addSourceRecord({ GUIDTestEntity: 'test-1', Name: 'Alice', Value: 42 });

						tmpAdapter.integrateRecords(
							(pError) =>
							{
								Expect(pError).to.not.exist;

								// The mock server should have received exactly one upsert
								Expect(_MockState.UpsertedRecords.length).to.equal(1,
									`Expected 1 upserted record, got ${_MockState.UpsertedRecords.length}`);

								let tmpUpsertedRecord = _MockState.UpsertedRecords[0];

								// The GUID should be present (with the adapter prefix)
								Expect(tmpUpsertedRecord).to.have.property('GUIDTestEntity');
								Expect(tmpUpsertedRecord.GUIDTestEntity).to.be.a('string');
								Expect(tmpUpsertedRecord.GUIDTestEntity).to.include('test-1');

								// CRITICAL: Verify field values were marshaled through.
								// If the arrow-function arguments bug is present, the schema
								// fetch would fail silently, meadowSchema would be null, and
								// SimpleMarshal would not copy Name and Value through.
								Expect(tmpUpsertedRecord).to.have.property('Name');
								Expect(tmpUpsertedRecord.Name).to.equal('Alice');
								Expect(tmpUpsertedRecord).to.have.property('Value');
								Expect(tmpUpsertedRecord.Value).to.equal(42);

								// Verify the schema was also populated
								Expect(tmpAdapter.meadowSchema).to.be.an('object');
								Expect(tmpAdapter.meadowSchema.properties).to.have.property('Name');

								return fDone();
							});
					}
				);

				test
				(
					'should integrate multiple records with correct field values',
					function (fDone)
					{
						this.timeout(10000);

						let tmpFable = new libPict(
							{
								Product: 'AdapterTest',
								ProductVersion: '1.0.0',
								LogStreams: [{ streamtype: 'console', level: 'error' }]
							});
						tmpFable.addServiceType('IntegrationAdapter', libIntegrationAdapter);
						tmpFable.serviceManager.addServiceType('MeadowCloneRestClient', libMeadowCloneRestClient);
						tmpFable.serviceManager.instantiateServiceProvider('MeadowCloneRestClient',
							{
								ServerURL: MOCK_BASE_URL
							});

						let tmpAdapter = tmpFable.instantiateServiceProvider('IntegrationAdapter',
							{
								Entity: 'TestEntity',
								SimpleMarshal: true
							}, 'TestEntity');

						tmpAdapter.addSourceRecord({ GUIDTestEntity: 'multi-1', Name: 'Alice', Value: 42 });
						tmpAdapter.addSourceRecord({ GUIDTestEntity: 'multi-2', Name: 'Bob', Value: 99 });
						tmpAdapter.addSourceRecord({ GUIDTestEntity: 'multi-3', Name: 'Charlie', Value: 7 });

						tmpAdapter.integrateRecords(
							(pError) =>
							{
								Expect(pError).to.not.exist;

								Expect(_MockState.UpsertedRecords.length).to.equal(3,
									`Expected 3 upserted records, got ${_MockState.UpsertedRecords.length}`);

								// Build a lookup by the original GUID suffix for easy verification
								let tmpByGUID = {};
								for (let i = 0; i < _MockState.UpsertedRecords.length; i++)
								{
									let tmpRec = _MockState.UpsertedRecords[i];
									if (tmpRec.GUIDTestEntity.indexOf('multi-1') > -1) tmpByGUID['multi-1'] = tmpRec;
									if (tmpRec.GUIDTestEntity.indexOf('multi-2') > -1) tmpByGUID['multi-2'] = tmpRec;
									if (tmpRec.GUIDTestEntity.indexOf('multi-3') > -1) tmpByGUID['multi-3'] = tmpRec;
								}

								Expect(tmpByGUID['multi-1'].Name).to.equal('Alice');
								Expect(tmpByGUID['multi-1'].Value).to.equal(42);

								Expect(tmpByGUID['multi-2'].Name).to.equal('Bob');
								Expect(tmpByGUID['multi-2'].Value).to.equal(99);

								Expect(tmpByGUID['multi-3'].Name).to.equal('Charlie');
								Expect(tmpByGUID['multi-3'].Value).to.equal(7);

								// Each record should have been assigned a server-side ID
								Expect(tmpByGUID['multi-1'].IDTestEntity).to.be.above(0);
								Expect(tmpByGUID['multi-2'].IDTestEntity).to.be.above(0);
								Expect(tmpByGUID['multi-3'].IDTestEntity).to.be.above(0);

								return fDone();
							});
					}
				);

				test
				(
					'without SimpleMarshal, fields not in schema properties are excluded',
					function (fDone)
					{
						this.timeout(10000);

						let tmpFable = new libPict(
							{
								Product: 'AdapterTest',
								ProductVersion: '1.0.0',
								LogStreams: [{ streamtype: 'console', level: 'error' }]
							});
						tmpFable.addServiceType('IntegrationAdapter', libIntegrationAdapter);
						tmpFable.serviceManager.addServiceType('MeadowCloneRestClient', libMeadowCloneRestClient);
						tmpFable.serviceManager.instantiateServiceProvider('MeadowCloneRestClient',
							{
								ServerURL: MOCK_BASE_URL
							});

						let tmpAdapter = tmpFable.instantiateServiceProvider('IntegrationAdapter',
							{
								Entity: 'TestEntity',
								SimpleMarshal: false
							}, 'TestEntity');

						// ExtraField is not in the mock schema
						tmpAdapter.addSourceRecord({ GUIDTestEntity: 'test-extra', Name: 'Diana', Value: 55, ExtraField: 'should-not-appear' });

						tmpAdapter.integrateRecords(
							(pError) =>
							{
								Expect(pError).to.not.exist;

								Expect(_MockState.UpsertedRecords.length).to.equal(1);

								let tmpUpsertedRecord = _MockState.UpsertedRecords[0];

								// Name and Value should be marshaled through the schema
								Expect(tmpUpsertedRecord).to.have.property('Name');
								Expect(tmpUpsertedRecord.Name).to.equal('Diana');
								Expect(tmpUpsertedRecord).to.have.property('Value');
								Expect(tmpUpsertedRecord.Value).to.equal(55);

								// ExtraField should NOT be in the upserted record
								Expect(tmpUpsertedRecord).to.not.have.property('ExtraField');

								return fDone();
							});
					}
				);
			}
		);
	}
);
