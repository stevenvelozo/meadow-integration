/*
	Integration test: the GUID strategy flows end-to-end through the real TabularTransform.

	Compiler (config → spec) → transform (resolves segment templates per row) → composer (length-safe) →
	comprehension record with the entity's own GUID + its foreign-key GUID/ID fields. Uses a pict instance
	as the host fable (pict provides `parseTemplate`) — the same shape the browser import wizard passes.
*/

const Chai = require('chai');
const Expect = Chai.expect;

const libPict = require('pict');

const libEngine = require('../source/Meadow-Integration-Engine.js');

const newTransform = () =>
{
	const tmpPict = new libPict({ Product: 'GUIDStrategyTransformTest', LogStreams: [ { streamtype: 'console', level: 'error' } ] });
	return new libEngine.MeadowIntegrationTabularTransform(tmpPict);
};

const CATALOG =
{
	Project: { Abbrev: 'P' },
	Contract: { Abbrev: 'C' },
	LineItem: { Abbrev: 'LI' },
};
const SIZES = { Project: 64, Contract: 64, LineItem: 64 };

// Build the comprehension for one entity mapping over one row (mirrors DataImport-ComprehensionBuilder).
const runOneEntity = (pTransform, pMapping, pRow) =>
{
	const tmpOutcome = pTransform.newMappingOutcomeObject();
	tmpOutcome.ImplicitConfiguration = {};
	tmpOutcome.ExplicitConfiguration = pMapping;
	pTransform.initializeMappingOutcomeObject(tmpOutcome);
	pTransform.transformRecord(pRow, tmpOutcome);
	return tmpOutcome.Comprehension[pMapping.Entity] || {};
};

suite
(
	'Meadow Integration — GUID strategy through the transform',
	() =>
	{
		test
		(
			'composes a top-level entity own GUID from the strategy',
			() =>
			{
				const tmpTransform = newTransform();
				const tmpStrategy = libEngine.compileGUIDStrategy(
					{ Prefix: 'UI', Entities: { Project: { Mode: 'prefixed', OwnKeyColumn: 'ProjectCode' } } },
					{ Catalog: CATALOG, SchemaSizes: SIZES }).Strategies.Project;
				const tmpMapping = { Entity: 'Project', GUIDName: 'GUIDProject', GUIDStrategy: tmpStrategy, Mappings: { Name: '{~D:Record.ProjectName~}' } };

				const tmpComprehension = runOneEntity(tmpTransform, tmpMapping, { ProjectCode: '01278', ProjectName: 'Highway 10 Repave' });
				const tmpKeys = Object.keys(tmpComprehension);
				Expect(tmpKeys).to.deep.equal([ 'UI_P01278' ]);
				Expect(tmpComprehension['UI_P01278'].GUIDProject).to.equal('UI_P01278');
				Expect(tmpComprehension['UI_P01278'].Name).to.equal('Highway 10 Repave');
			}
		);
		test
		(
			'composes a child own GUID (context chain) + cross-session FK fields',
			() =>
			{
				const tmpTransform = newTransform();
				const tmpStrategy = libEngine.compileGUIDStrategy(
					{
						Prefix: 'UI',
						Entities:
						{
							LineItem:
							{
								Mode: 'prefixed',
								OwnKeyColumn: 'LineId',
								ContextEntities: [ 'Contract', 'Project' ],
								ContextKeyColumns: { Contract: 'ContractNum', Project: 'ProjectCode' },
								Joins:
								[
									{ ParentEntity: 'Project', Mode: 'prefixed', KeyColumn: 'ProjectCode', CrossSession: true },
									{ ParentEntity: 'Contract', Mode: 'prefixed', KeyColumn: 'ContractNum', CrossSession: true },
								],
							},
						},
					},
					{ Catalog: CATALOG, SchemaSizes: SIZES }).Strategies.LineItem;
				const tmpMapping = { Entity: 'LineItem', GUIDName: 'GUIDLineItem', GUIDStrategy: tmpStrategy, Mappings: { Quantity: '{~D:Record.qty~}' } };

				const tmpRow = { ContractNum: '10', ProjectCode: '01278', LineId: '8675309', qty: '5' };
				const tmpComprehension = runOneEntity(tmpTransform, tmpMapping, tmpRow);
				const tmpRecord = tmpComprehension['UI_C10_P01278_LI8675309'];
				Expect(tmpRecord, 'record keyed by composed own GUID').to.be.an('object');
				Expect(tmpRecord.GUIDLineItem).to.equal('UI_C10_P01278_LI8675309');
				// Cross-session FK fields use the `_GUID<Parent>` async-lookup convention + the parent's own GUID.
				Expect(tmpRecord._GUIDProject).to.equal('UI_P01278');
				Expect(tmpRecord._GUIDContract).to.equal('UI_C10');
				Expect(tmpRecord.Quantity).to.equal('5');
			}
		);
		test
		(
			'the child FK equals the parent\'s own GUID (so the join resolves) — and is idempotent',
			() =>
			{
				const tmpTransform = newTransform();
				const tmpCompiled = libEngine.compileGUIDStrategy(
					{
						Prefix: 'UI',
						Entities:
						{
							Project: { Mode: 'prefixed', OwnKeyColumn: 'ProjectCode' },
							LineItem: { Mode: 'prefixed', OwnKeyColumn: 'LineId', Joins: [ { ParentEntity: 'Project', Mode: 'prefixed', KeyColumn: 'ProjectCode', CrossSession: false } ] },
						},
					},
					{ Catalog: CATALOG, SchemaSizes: SIZES }).Strategies;

				const tmpProjectComp = runOneEntity(tmpTransform, { Entity: 'Project', GUIDName: 'GUIDProject', GUIDStrategy: tmpCompiled.Project, Mappings: {} }, { ProjectCode: '01278' });
				const tmpLineComp = runOneEntity(tmpTransform, { Entity: 'LineItem', GUIDName: 'GUIDLineItem', GUIDStrategy: tmpCompiled.LineItem, Mappings: {} }, { ProjectCode: '01278', LineId: '42' });

				const tmpProjectGUID = Object.keys(tmpProjectComp)[0];
				// same-upload join → sync `GUID<Parent>` field, value == the Project's own GUID
				Expect(tmpLineComp['UI_LI42'].GUIDProject).to.equal(tmpProjectGUID);
				// re-running yields the identical record (idempotent)
				const tmpLineComp2 = runOneEntity(newTransform(), { Entity: 'LineItem', GUIDName: 'GUIDLineItem', GUIDStrategy: tmpCompiled.LineItem, Mappings: {} }, { ProjectCode: '01278', LineId: '42' });
				Expect(Object.keys(tmpLineComp2)).to.deep.equal([ 'UI_LI42' ]);
			}
		);
		test
		(
			'a non-strategy mapping still uses the flat GUIDTemplate (no behavior change)',
			() =>
			{
				const tmpTransform = newTransform();
				const tmpMapping = { Entity: 'Airport', GUIDName: 'GUIDAirport', GUIDTemplate: 'Airport_{~D:Record.iata~}', Mappings: { Name: '{~D:Record.name~}' } };
				const tmpComprehension = runOneEntity(tmpTransform, tmpMapping, { iata: 'BTR', name: 'Baton Rouge' });
				Expect(Object.keys(tmpComprehension)).to.deep.equal([ 'Airport_BTR' ]);
				Expect(tmpComprehension['Airport_BTR'].Name).to.equal('Baton Rouge');
			}
		);
	}
);
