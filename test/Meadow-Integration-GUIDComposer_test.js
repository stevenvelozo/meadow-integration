/*
	Unit tests for the context-aware GUID composer (Meadow-Integration-GUIDComposer).

	Pure module — no fable, no network. Verifies deterministic composition, the length-safe shrink-by-hash
	behavior across the real GUID column widths (36 / 64 / 128), and idempotency (same input → same GUID).
*/

const Chai = require('chai');
const Expect = Chai.expect;

const libComposer = require('../source/services/guid/Meadow-Integration-GUIDComposer.js');

const projectSpec = (pCode, pMaxLength) => (
{
	prefix: 'UI',
	maxLength: pMaxLength,
	segments: [ { abbrev: 'P', value: pCode } ],
});

const lineItemSpec = (pContract, pProject, pLineId, pMaxLength) => (
{
	prefix: 'UI',
	maxLength: pMaxLength,
	segments: [ { abbrev: 'C', value: pContract }, { abbrev: 'P', value: pProject }, { abbrev: 'LI', value: pLineId } ],
});

suite
(
	'Meadow Integration — GUID Composer',
	() =>
	{
		suite
		(
			'composition',
			() =>
			{
				test
				(
					'composes prefix + segments with underscores (the headline example)',
					() =>
					{
						const tmpGUID = libComposer.composeGUID(lineItemSpec('10', '01278', '8675309', 64));
						Expect(tmpGUID).to.equal('UI_C10_P01278_LI8675309');
					}
				);
				test
				(
					'a top-level entity composes prefix + own segment',
					() =>
					{
						Expect(libComposer.composeGUID(projectSpec('01278', 64))).to.equal('UI_P01278');
					}
				);
				test
				(
					'omits the prefix (and its separator) when falsy',
					() =>
					{
						const tmpGUID = libComposer.composeGUID({ prefix: '', maxLength: 64, segments: [ { abbrev: 'P', value: '01278' } ] });
						Expect(tmpGUID).to.equal('P01278');
					}
				);
				test
				(
					'a child FK recomputed from the parent spec matches the parent\'s own GUID',
					() =>
					{
						// Parent (Project) own GUID, and the same Project spec evaluated on the child's row values.
						const tmpParentOwn = libComposer.composeGUID(projectSpec('01278', 64));
						const tmpChildFK = libComposer.composeGUID(projectSpec('01278', 64));
						Expect(tmpChildFK).to.equal(tmpParentOwn);
					}
				);
			}
		);
		suite
		(
			'determinism',
			() =>
			{
				test
				(
					'same input → same GUID, every time',
					() =>
					{
						const tmpA = libComposer.composeGUID(lineItemSpec('10', 'VERYLONGPROJECTCODE-001278-REGION-NORTH', '8675309', 36));
						const tmpB = libComposer.composeGUID(lineItemSpec('10', 'VERYLONGPROJECTCODE-001278-REGION-NORTH', '8675309', 36));
						Expect(tmpA).to.equal(tmpB);
					}
				);
				test
				(
					'hashSegment is deterministic + length-bounded',
					() =>
					{
						Expect(libComposer.hashSegment('P01278', 10)).to.equal(libComposer.hashSegment('P01278', 10));
						Expect(libComposer.hashSegment('P01278', 10).length).to.be.at.most(10);
						Expect(libComposer.hashSegment('A')).to.not.equal(libComposer.hashSegment('B'));
					}
				);
			}
		);
		suite
		(
			'length-safety (real column widths)',
			() =>
			{
				test
				(
					'fits inside a 36-char column by hashing, staying prefixed + stable',
					() =>
					{
						const tmpSpec = lineItemSpec('CONTRACT-2026-NORTH', 'PROJECT-01278-HIGHWAY-10-REPAVE', 'LINEITEM-8675309-CONCRETE', 36);
						const tmpGUID = libComposer.composeGUID(tmpSpec);
						Expect(tmpGUID.length, tmpGUID).to.be.at.most(36);
						Expect(tmpGUID.indexOf('UI_'), 'keeps the UI prefix').to.equal(0);
						// idempotent
						Expect(libComposer.composeGUID(tmpSpec)).to.equal(tmpGUID);
					}
				);
				test
				(
					'a 64-char column keeps the readable form when it already fits',
					() =>
					{
						Expect(libComposer.composeGUID(lineItemSpec('10', '01278', '8675309', 64))).to.equal('UI_C10_P01278_LI8675309');
					}
				);
				test
				(
					'a 128-char column has ample room (PhysicalAsset-like)',
					() =>
					{
						const tmpGUID = libComposer.composeGUID(lineItemSpec('10', '01278', '8675309', 128));
						Expect(tmpGUID).to.equal('UI_C10_P01278_LI8675309');
						Expect(tmpGUID.length).to.be.at.most(128);
					}
				);
				test
				(
					'an unbounded (maxLength <= 0) compose never hashes',
					() =>
					{
						const tmpGUID = libComposer.composeGUID(lineItemSpec('CONTRACT-2026', 'PROJECT-01278-HIGHWAY', 'LINEITEM-8675309', 0));
						Expect(tmpGUID).to.equal('UI_CCONTRACT-2026_PPROJECT-01278-HIGHWAY_LILINEITEM-8675309');
					}
				);
				test
				(
					'a pathologically tiny column still produces a stable, in-budget GUID',
					() =>
					{
						const tmpSpec = lineItemSpec('CONTRACT-LONG', 'PROJECT-LONG', 'LINEITEM-LONG', 16);
						const tmpGUID = libComposer.composeGUID(tmpSpec);
						Expect(tmpGUID.length, tmpGUID).to.be.at.most(16);
						Expect(libComposer.composeGUID(tmpSpec)).to.equal(tmpGUID);
					}
				);
			}
		);
	}
);
