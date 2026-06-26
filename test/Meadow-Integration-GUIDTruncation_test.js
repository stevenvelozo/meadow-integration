/*
	Unit tests for the adapter's opt-in GUIDTruncationStrategy (the marshaling-path length safety).

	"substring" (default) preserves the external GUID and truncates the prefix — existing behavior.
	"hash" keeps the prefix and deterministically hashes the external GUID to fit — stable across runs.
*/

const Chai = require('chai');
const Expect = Chai.expect;

const libFable = require('fable');

const libEngine = require('../source/Meadow-Integration-Engine.js');

const newAdapter = (pOptions) =>
{
	const tmpFable = new libFable({ Product: 'GUIDTruncTest', LogStreams: [ { streamtype: 'console', level: 'error' } ] });
	return new libEngine.MeadowIntegrationAdapter(tmpFable, Object.assign(
		{
			Entity: 'Specification',
			AllowGUIDTruncation: true,
			GUIDMaxLength: 36,
			AdapterSetGUIDMarshalPrefix: 'HLICLI',
			EntityGUIDMarshalPrefix: 'E-Specification',
		}, pOptions || {}), 'GUIDTruncTest');
};

const EXTERNAL = 'SpecSet-2026-001278';   // 19 chars; prefix + this exceeds 36, exercising truncation

suite
(
	'Meadow Integration — adapter GUID truncation strategy',
	() =>
	{
		test
		(
			'substring (default) keeps the external GUID whole + truncates the prefix',
			() =>
			{
				const tmpAdapter = newAdapter({ GUIDTruncationStrategy: 'substring' });
				const tmpGUID = tmpAdapter.generateMeadowGUIDFromExternalGUID(EXTERNAL);
				Expect(tmpGUID.length, tmpGUID).to.be.at.most(36);
				Expect(tmpGUID.endsWith(EXTERNAL), 'external GUID preserved at the tail').to.equal(true);
			}
		);
		test
		(
			'hash keeps the prefix whole + hashes the external GUID to fit, deterministically',
			() =>
			{
				const tmpAdapter = newAdapter({ GUIDTruncationStrategy: 'hash' });
				const tmpGUID = tmpAdapter.generateMeadowGUIDFromExternalGUID(EXTERNAL);
				Expect(tmpGUID.length, tmpGUID).to.be.at.most(36);
				Expect(tmpGUID.indexOf(tmpAdapter.GUIDPrefix), 'prefix preserved at the head').to.equal(0);
				Expect(tmpGUID).to.not.equal(EXTERNAL);
				// deterministic across adapter instances
				Expect(newAdapter({ GUIDTruncationStrategy: 'hash' }).generateMeadowGUIDFromExternalGUID(EXTERNAL)).to.equal(tmpGUID);
			}
		);
		test
		(
			'a short GUID is unchanged regardless of strategy',
			() =>
			{
				const tmpShort = 'ABC';
				Expect(newAdapter({ GUIDTruncationStrategy: 'hash' }).generateMeadowGUIDFromExternalGUID(tmpShort))
					.to.equal(newAdapter({ GUIDTruncationStrategy: 'substring' }).generateMeadowGUIDFromExternalGUID(tmpShort));
			}
		);
	}
);
