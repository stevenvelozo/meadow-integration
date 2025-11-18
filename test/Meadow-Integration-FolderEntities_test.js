/*
	Unit tests for Retold Integration Entity Folder Parsing
*/

const Chai = require('chai');
const Expect = Chai.expect;

const libFable = require('fable');

suite
	(
		'Folder Entity Tests',
		() =>
		{
			setup(() => { });

			suite
				(
					'Generate comprehensions without configuration',
					() =>
					{
						test(
							'Object Instantiation',
							(fDone) =>
							{
								return fDone();
							});
					}
				);
		}
	);