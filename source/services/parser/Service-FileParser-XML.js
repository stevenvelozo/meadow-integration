'use strict';

const libFableServiceProviderBase = require('fable-serviceproviderbase');
const libFS = require('fs');

const defaultXMLParserOptions = (
	{
		recordPath: '',
		attributePrefix: '@_',
		ignoreAttributes: false
	});

class MeadowIntegrationFileParserXML extends libFableServiceProviderBase
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({}, defaultXMLParserOptions, pOptions);
		super(pFable, tmpOptions, pServiceHash);

		this.serviceType = 'MeadowIntegrationFileParserXML';
	}

	/**
	 * Walk an XML-parsed object looking for the first array of object records.
	 * Recurses one level at a time: checks direct children first, then recurses.
	 *
	 * @param {object} pObject - Parsed XML object node
	 * @returns {Array|null} First array of objects found, or null
	 */
	_extractXMLRecords(pObject)
	{
		if (!pObject || typeof pObject !== 'object')
		{
			return null;
		}

		let tmpKeys = Object.keys(pObject);

		// First pass: look for array-valued keys whose elements are objects
		for (let i = 0; i < tmpKeys.length; i++)
		{
			let tmpValue = pObject[tmpKeys[i]];
			if (Array.isArray(tmpValue) && tmpValue.length > 0 && typeof tmpValue[0] === 'object')
			{
				return tmpValue;
			}
		}

		// Second pass: recurse into object-valued keys
		for (let i = 0; i < tmpKeys.length; i++)
		{
			let tmpValue = pObject[tmpKeys[i]];
			if (typeof tmpValue === 'object' && !Array.isArray(tmpValue))
			{
				let tmpResult = this._extractXMLRecords(tmpValue);
				if (tmpResult)
				{
					return tmpResult;
				}
			}
		}

		return null;
	}

	/**
	 * Navigate a parsed XML object using a dot-separated recordPath.
	 *
	 * @param {object} pParsed - Parsed XML object
	 * @param {string} pRecordPath - Dot-separated path to the records array
	 * @returns {Array|null} Records array or null
	 */
	_resolveRecordPath(pParsed, pRecordPath)
	{
		let tmpParts = pRecordPath.split('.');
		let tmpCurrent = pParsed;

		for (let i = 0; i < tmpParts.length; i++)
		{
			if (!tmpCurrent || typeof tmpCurrent !== 'object' || !(tmpParts[i] in tmpCurrent))
			{
				return null;
			}
			tmpCurrent = tmpCurrent[tmpParts[i]];
		}

		return Array.isArray(tmpCurrent) ? tmpCurrent : [tmpCurrent];
	}

	/**
	 * Parse an XML file into an array of records.
	 * Reads the entire file into memory.
	 *
	 * @param {string} pFilePath - Absolute path to the XML file
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
			return pCompletionCallback(new Error(`XML file read error: ${pError.message}`));
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
	 * Parse XML content string into a full array of records.
	 *
	 * @param {string} pContent - Raw XML text
	 * @param {object} pOptions - Parser options
	 * @param {function} fCallback - Called with (pError, pRecords)
	 */
	parseContent(pContent, pOptions, fCallback)
	{
		let tmpOptions = Object.assign({}, this.options, pOptions);
		let tmpRecordPath = tmpOptions.recordPath || '';
		let tmpAttributePrefix = tmpOptions.attributePrefix || '@_';
		let tmpIgnoreAttributes = tmpOptions.ignoreAttributes === true;

		let tmpXMLParser;
		try
		{
			let libFastXMLParser = require('fast-xml-parser');
			tmpXMLParser = new libFastXMLParser.XMLParser(
				{
					ignoreAttributes: tmpIgnoreAttributes,
					attributeNamePrefix: tmpAttributePrefix
				});
		}
		catch (pError)
		{
			return fCallback(new Error(`fast-xml-parser library not available: ${pError.message}`));
		}

		let tmpParsed;
		try
		{
			tmpParsed = tmpXMLParser.parse(pContent);
		}
		catch (pError)
		{
			return fCallback(new Error(`XML parse error: ${pError.message}`));
		}

		let tmpRecords;

		if (tmpRecordPath)
		{
			tmpRecords = this._resolveRecordPath(tmpParsed, tmpRecordPath);
			if (!tmpRecords)
			{
				return fCallback(new Error(`recordPath '${tmpRecordPath}' not found in XML`));
			}
		}
		else
		{
			// Smart extraction: walk tree looking for first array of objects
			tmpRecords = this._extractXMLRecords(tmpParsed);
		}

		if (!tmpRecords)
		{
			// Wrap the entire parsed result as a single record
			tmpRecords = [tmpParsed];
		}

		return fCallback(null, tmpRecords);
	}
}

module.exports = MeadowIntegrationFileParserXML;
