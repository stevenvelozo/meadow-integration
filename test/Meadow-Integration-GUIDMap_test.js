/*
	Unit tests for Retold Integration Adapter
*/

const Chai = require('chai');
const Expect = Chai.expect;

const libFable = require('fable');
const libGUIDMap = require('../Meadow-Service-Integration-GUIDMap.js');

suite
	(
		'MeadowIntegrationGUIDMap Basic Tests',
		() =>
		{
			setup(() => { });

			suite
				(
					'Basic Map Tests',
					() =>
					{
						test('Object Instantiation',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.serviceManager.addServiceType('MeadowGUIDMap', libGUIDMap);
								let tmpGUIDMap = _Fable.serviceManager.instantiateServiceProvider('MeadowGUIDMap');
								Expect(_Fable.MeadowGUIDMap).to.be.an('object');
								return fDone();
							});
						test('Empty Set',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.serviceManager.addServiceType('MeadowGUIDMap', libGUIDMap);
								let tmpGUIDMap = _Fable.serviceManager.instantiateServiceProvider('MeadowGUIDMap');
								Expect(_Fable.MeadowGUIDMap.getIDFromGUID('MyEntity', 'SomeGUID')).to.equal(false, 'Empty set should return false.');
								Expect(_Fable.MeadowGUIDMap.getGUIDFromID('MyEntity', 22)).to.equal(false, 'Empty set should return false.');
								return fDone();
							});
						test('Simple Lookups',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.serviceManager.addServiceType('MeadowGUIDMap', libGUIDMap);
								let tmpGUIDMap = _Fable.serviceManager.instantiateServiceProvider('MeadowGUIDMap');
								_Fable.MeadowGUIDMap.mapGUIDToID('MyEntity', 'SomeGUID', 22);
								Expect(_Fable.MeadowGUIDMap.getIDFromGUID('MyEntity', 'SomeGUID')).to.equal(22, 'Mapped ID should be returned.');
								_Fable.MeadowGUIDMap.mapGUIDToID('MyEntity', 'SomeOtherGUID', 25);
								Expect(_Fable.MeadowGUIDMap.getIDFromGUID('MyEntity', 'SomeGUID')).to.equal(22, 'Mapped ID should be returned.');
								Expect(_Fable.MeadowGUIDMap.getIDFromGUID('MyEntity', 'SomeOtherGUID')).to.equal(25, 'Mapped ID should be returned.');
								Expect(_Fable.MeadowGUIDMap.getGUIDFromID('MyEntity', 22)).to.equal('SomeGUID', 'Mapped GUID should be returned.');
								Expect(_Fable.MeadowGUIDMap.getIDFromGUID('MyEntity')).to.equal(false, 'Empty set should return false.');
								return fDone();
							});
						test('Multiple Entity Lookups',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.serviceManager.addServiceType('MeadowGUIDMap', libGUIDMap);
								let tmpGUIDMap = _Fable.serviceManager.instantiateServiceProvider('MeadowGUIDMap');
								_Fable.MeadowGUIDMap.mapGUIDToID('MyEntity', 'SomeGUID', 22);
								_Fable.MeadowGUIDMap.mapGUIDToID('AnotherEntity', 'SomeGUID', 3030);
								_Fable.MeadowGUIDMap.mapGUIDToID('MyEntity', 'NewGUID', 75);
								Expect(_Fable.MeadowGUIDMap.getIDFromGUID('MyEntity', 'SomeGUID')).to.equal(22, 'Mapped ID should be returned.');
								_Fable.MeadowGUIDMap.mapGUIDToID('MyEntity', 'SomeOtherGUID', 25);
								Expect(_Fable.MeadowGUIDMap.getIDFromGUID('MyEntity', 'SomeGUID')).to.equal(22, 'Mapped ID should be returned.');
								Expect(_Fable.MeadowGUIDMap.getIDFromGUID('MyEntity', 'SomeOtherGUID')).to.equal(25, 'Mapped ID should be returned.');
								Expect(_Fable.MeadowGUIDMap.getIDFromGUID('AnotherEntity', 'SomeGUID')).to.equal(3030, 'Mapped ID should be returned.');
								Expect(_Fable.MeadowGUIDMap.getGUIDFromID('MyEntity', 22)).to.equal('SomeGUID', 'Mapped GUID should be returned.');
								Expect(_Fable.MeadowGUIDMap.getIDFromGUID('MyEntity')).to.equal(false, 'Empty set should return false.');
								return fDone();
							});
						test('External Entity GUID Lookups',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.serviceManager.addServiceType('MeadowGUIDMap', libGUIDMap);
								let tmpGUIDMap = _Fable.serviceManager.instantiateServiceProvider('MeadowGUIDMap');
								_Fable.MeadowGUIDMap.mapGUIDToID('MyEntity', 'SomeGUID', 22);
								_Fable.MeadowGUIDMap.mapGUIDToID('AnotherEntity', 'SomeGUID', 3030);
								_Fable.MeadowGUIDMap.mapGUIDToID('MyEntity', 'NewGUID', 75);
								_Fable.MeadowGUIDMap.mapExternalGUIDtoMeadowGUID('MyEntity', 'BADOLDSYSTEM_GUID', 'SomeGUID');
								Expect(_Fable.MeadowGUIDMap.getMeadowIDFromExternalGUID('MyEntity', 'BADOLDSYSTEM_GUID')).to.equal(22, 'Mapped ID should be returned.');
								Expect(_Fable.MeadowGUIDMap.getMeadowGUIDFromExternalGUID('MyEntity', 'BADOLDSYSTEM_GUID')).to.equal('SomeGUID', 'Mapped GUID should be returned.');
								return fDone();
							});
					}
				);
		}
	);