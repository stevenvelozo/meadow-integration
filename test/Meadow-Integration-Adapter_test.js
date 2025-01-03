/*
	Unit tests for Retold Integration Adapter
*/

const Chai = require('chai');
const Expect = Chai.expect;

const libFable = require('fable');
const libIntegrationAdapter = require('../Meadow-Service-Integration-Adapter.js');

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
								let _Fable = new libFable();
								_Fable.addServiceType('IntegrationAdapter', libIntegrationAdapter);
								let tmpIntegrationAdapter = _Fable.instantiateServiceProvider('IntegrationAdapter', { Entity: 'TestEntity' }, 'TestEntity');
								Expect(tmpIntegrationAdapter).to.be.an('object');
								return fDone();
							});
						/*  This works if you have the right database set up; will adapt for real tests later when time arises
						test(
							'Integrate some Book Prices',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.addServiceType('IntegrationAdapter', libIntegrationAdapter);
								let tmpIntegrationAdapter = _Fable.instantiateServiceProvider('IntegrationAdapter', { Entity: 'BookPrice' }, 'BookPrice');

								tmpIntegrationAdapter.addSourceRecord({ GUIDBookPrice:'GUID-3', CouponCode:'TestyCoupon', Price:3.50 });
								tmpIntegrationAdapter.addSourceRecord({ GUIDBookPrice:'GUID-4', CouponCode:'TestyCoupon', Price:3.22232 });
								tmpIntegrationAdapter.addSourceRecord({ GUIDBookPrice:'GUID-5', CouponCode:'None', Price:3.50 });
								tmpIntegrationAdapter.addSourceRecord({ GUIDBookPrice:'GUID-6', CouponCode:'', Price:3.57 });
								tmpIntegrationAdapter.addSourceRecord({ GUIDBookPrice:'GUID-7', Price:3.50 });
								tmpIntegrationAdapter.addSourceRecord({ GUIDBookPrice:'GUID-8', CouponCode:'TestyCoupon', Price:183.77 });
								tmpIntegrationAdapter.integrateRecords(fDone);
							});
						test(
							'Integrate some Book Prices via the static method',
							(fDone) =>
							{
								let _Fable = new libFable({});

								_Fable.addServiceType('IntegrationAdapter', libIntegrationAdapter);

								let tmpIntegrationAdapter = libIntegrationAdapter.getAdapter(_Fable, 'BookPrice', 'BP');

								tmpIntegrationAdapter.addSourceRecord({ GUIDBookPrice:'GUID-dd3', CouponCode:'TestyCoupon', Price:3.50 });
								tmpIntegrationAdapter.addSourceRecord({ GUIDBookPrice:'GUID-dd4', CouponCode:'TestyCoupon', Price:3.22232 });
								tmpIntegrationAdapter.addSourceRecord({ GUIDBookPrice:'GUID-dd5', CouponCode:'None', Price:3.50 });
								tmpIntegrationAdapter.addSourceRecord({ GUIDBookPrice:'GUID-dd6', CouponCode:'', Price:3.57 });
								tmpIntegrationAdapter.addSourceRecord({ GUIDBookPrice:'GUID-dd7', Price:3.540 });
								tmpIntegrationAdapter.addSourceRecord({ GUIDBookPrice:'GUID-dd8', CouponCode:'TestyCoupon', Price:183.77 });
								tmpIntegrationAdapter.integrateRecords(fDone);
							});
						*/
					}
				);
		}
	);