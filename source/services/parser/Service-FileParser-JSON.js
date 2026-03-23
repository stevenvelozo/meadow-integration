'use strict';

const libFableServiceProviderBase = require('fable-serviceproviderbase');
const libFS = require('fs');

const defaultJSONParserOptions = (
	{
		rootPath: '',
		flattenNested: false,
		flattenDelimiter: '_'
	});

class MeadowIntegrationFileParserJSON extends libFableServiceProviderBase
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({}, defaultJSONParserOptions, pOptions);
		super(pFable, tmpOptions, pServiceHash);

		this.serviceType = 'MeadowIntegrationFileParserJSON';
	}

	/**
	 * Navigate a nested object using a dot-separated path with optional
	 * array index notation (e.g. "Results.series[0].data").
	 *
	 * @param {object} pObject - The object to navigate
	 * @param {string} pPath - Dot-separated path, segments may include [n]
	 * @returns {*} The resolved value, or null if the path is invalid
	 */
	_resolveDataPath(pObject, pPath)
	{
		if (!pPath || typeof pPath !== 'string')
		{
			return pObject;
		}

		let tmpSegments = pPath.split('.');
		let tmpCurrent = pObject;

		for (let i = 0; i < tmpSegments.length; i++)
		{
			if (tmpCurrent === null || tmpCurrent === undefined || typeof tmpCurrent !== 'object')
			{
				return null;
			}

			let tmpSegment = tmpSegments[i];
			// Check for array index notation: name[index]
			let tmpMatch = tmpSegment.match(/^([^\[]+)\[(\d+)\]$/);
			if (tmpMatch)
			{
				let tmpKey = tmpMatch[1];
				let tmpIndex = parseInt(tmpMatch[2], 10);
				if (!(tmpKey in tmpCurrent) || !Array.isArray(tmpCurrent[tmpKey]))
				{
					return null;
				}
				tmpCurrent = tmpCurrent[tmpKey][tmpIndex];
			}
			else
			{
				if (!(tmpSegment in tmpCurrent))
				{
					return null;
				}
				tmpCurrent = tmpCurrent[tmpSegment];
			}
		}

		return tmpCurrent;
	}

	/**
	 * Flatten a nested object into a single-level object using a delimiter.
	 *
	 * @param {object} pObject - Nested object
	 * @param {string} pDelimiter - Key delimiter (default '_')
	 * @param {string} pPrefix - Key prefix for recursion
	 * @returns {object} Flat object
	 */
	_flattenObject(pObject, pDelimiter, pPrefix)
	{
		let tmpDelimiter = pDelimiter || '_';
		let tmpPrefix = pPrefix || '';
		let tmpResult = {};

		let tmpKeys = Object.keys(pObject);
		for (let i = 0; i < tmpKeys.length; i++)
		{
			let tmpKey = tmpKeys[i];
			let tmpFullKey = tmpPrefix ? `${tmpPrefix}${tmpDelimiter}${tmpKey}` : tmpKey;
			let tmpValue = pObject[tmpKey];

			if (tmpValue !== null && typeof tmpValue === 'object' && !Array.isArray(tmpValue))
			{
				let tmpNested = this._flattenObject(tmpValue, tmpDelimiter, tmpFullKey);
				let tmpNestedKeys = Object.keys(tmpNested);
				for (let j = 0; j < tmpNestedKeys.length; j++)
				{
					tmpResult[tmpNestedKeys[j]] = tmpNested[tmpNestedKeys[j]];
				}
			}
			else
			{
				tmpResult[tmpFullKey] = tmpValue;
			}
		}

		return tmpResult;
	}

	/**
	 * Resolve parsed JSON to a records array, applying rootPath navigation.
	 *
	 * @param {*} pParsed - Parsed JSON value
	 * @param {object} pOptions - Parser options
	 * @returns {Array|null} Array of records or null on failure
	 */
	_resolveRecords(pParsed, pOptions)
	{
		let tmpData = pParsed;

		if (pOptions && pOptions.rootPath)
		{
			tmpData = this._resolveDataPath(pParsed, pOptions.rootPath);
			if (tmpData === null || tmpData === undefined)
			{
				return null;
			}
		}

		let tmpRecords;
		if (Array.isArray(tmpData))
		{
			tmpRecords = tmpData;
		}
		else if (typeof tmpData === 'object' && tmpData !== null)
		{
			// Common envelope keys
			if (Array.isArray(tmpData.data))
			{
				tmpRecords = tmpData.data;
			}
			else if (Array.isArray(tmpData.records))
			{
				tmpRecords = tmpData.records;
			}
			else if (Array.isArray(tmpData.rows))
			{
				tmpRecords = tmpData.rows;
			}
			else
			{
				tmpRecords = [tmpData];
			}
		}
		else
		{
			return null;
		}

		return tmpRecords;
	}

	/**
	 * Parse a JSON file into an array of records.
	 * Reads the entire file into memory.
	 *
	 * @param {string} pFilePath - Absolute path to the JSON file
	 * @param {object} pOptions - Parser options
	 * @param {function} pChunkCallback - Called with (pError, pRecords) once with all records
	 * @param {function} pCompletionCallback - Called with (pError, pTotalCount) when done
	 */
	parseFile(pFilePath, pOptions, pChunkCallback, pCompletionCallback)
	{
		let tmpOptions = Object.assign({}, this.options, pOptions);

		let tmpContent;
		try
		{
			tmpContent = libFS.readFileSync(pFilePath, 'utf8');
		}
		catch (pError)
		{
			return pCompletionCallback(new Error(`JSON file read error: ${pError.message}`));
		}

		this.parseContent(tmpContent, tmpOptions,
			(pError, pRecords) =>
			{
				if (pError)
				{
					return pCompletionCallback(pError);
				}
				pChunkCallback(null, pRecords);
				return pCompletionCallback(null, pRecords.length);
			});
	}

	/**
	 * Parse JSON content string into a full array of records.
	 *
	 * @param {string} pContent - Raw JSON text
	 * @param {object} pOptions - Parser options
	 * @param {function} fCallback - Called with (pError, pRecords)
	 */
	parseContent(pContent, pOptions, fCallback)
	{
		let tmpOptions = Object.assign({}, this.options, pOptions);
		let tmpFlattenNested = tmpOptions.flattenNested || false;
		let tmpFlattenDelimiter = tmpOptions.flattenDelimiter || '_';

		let tmpParsed;
		try
		{
			tmpParsed = JSON.parse(pContent);
		}
		catch (pError)
		{
			return fCallback(new Error(`JSON parse error: ${pError.message}`));
		}

		let tmpRecords = this._resolveRecords(tmpParsed, tmpOptions);
		if (tmpRecords === null)
		{
			if (tmpOptions.rootPath)
			{
				return fCallback(new Error(`rootPath '${tmpOptions.rootPath}' not found in JSON content`));
			}
			return fCallback(new Error(`Could not resolve records from JSON content`));
		}

		if (tmpFlattenNested)
		{
			let tmpFlattened = [];
			for (let i = 0; i < tmpRecords.length; i++)
			{
				if (tmpRecords[i] !== null && typeof tmpRecords[i] === 'object')
				{
					tmpFlattened.push(this._flattenObject(tmpRecords[i], tmpFlattenDelimiter));
				}
				else
				{
					tmpFlattened.push(tmpRecords[i]);
				}
			}
			return fCallback(null, tmpFlattened);
		}

		return fCallback(null, tmpRecords);
	}
}

module.exports = MeadowIntegrationFileParserJSON;
