'use strict';

const libFableServiceProviderBase = require('fable-serviceproviderbase');
const libPath = require('path');

const defaultFileParserOptions = (
	{
		format: ''
	});

// Extension to format mapping
const EXTENSION_FORMAT_MAP = (
	{
		'.csv': 'csv',
		'.tsv': 'csv',
		'.txt': 'csv',
		'.json': 'json',
		'.jsonl': 'json',
		'.xlsx': 'xlsx',
		'.xlsm': 'xlsx',
		'.xls': 'xlsx',
		'.xml': 'xml',
		'.fw': 'fixedwidth',
		'.dat': 'fixedwidth'
	});

class MeadowIntegrationFileParser extends libFableServiceProviderBase
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({}, defaultFileParserOptions, pOptions);
		super(pFable, tmpOptions, pServiceHash);

		this.serviceType = 'MeadowIntegrationFileParser';

		// Register sub-parser service types
		this.fable.addAndInstantiateServiceTypeIfNotExists('MeadowIntegrationFileParserCSV', require('./Service-FileParser-CSV.js'));
		this.fable.addAndInstantiateServiceTypeIfNotExists('MeadowIntegrationFileParserJSON', require('./Service-FileParser-JSON.js'));
		this.fable.addAndInstantiateServiceTypeIfNotExists('MeadowIntegrationFileParserXLSX', require('./Service-FileParser-XLSX.js'));
		this.fable.addAndInstantiateServiceTypeIfNotExists('MeadowIntegrationFileParserXML', require('./Service-FileParser-XML.js'));
		this.fable.addAndInstantiateServiceTypeIfNotExists('MeadowIntegrationFileParserFixedWidth', require('./Service-FileParser-FixedWidth.js'));
	}

	/**
	 * Detect the format of a file from its extension, then from a content prefix.
	 *
	 * @param {string} pFilePath - File path (used for extension detection)
	 * @param {string} [pContentPrefix] - First bytes of content for content-based detection
	 * @returns {string} Format string: 'csv', 'json', 'xlsx', 'xml', 'fixedwidth'
	 */
	detectFormat(pFilePath, pContentPrefix)
	{
		// Extension-based detection
		if (pFilePath && typeof pFilePath === 'string')
		{
			let tmpExt = libPath.extname(pFilePath).toLowerCase();
			if (tmpExt && EXTENSION_FORMAT_MAP[tmpExt])
			{
				return EXTENSION_FORMAT_MAP[tmpExt];
			}
		}

		// Content-based detection
		if (pContentPrefix && typeof pContentPrefix === 'string')
		{
			let tmpTrimmed = pContentPrefix.trim();
			if (tmpTrimmed.startsWith('[') || tmpTrimmed.startsWith('{'))
			{
				return 'json';
			}
			if (tmpTrimmed.startsWith('<?xml') || tmpTrimmed.startsWith('<'))
			{
				return 'xml';
			}
		}

		return 'csv';
	}

	/**
	 * Get the appropriate sub-parser service for a given format.
	 *
	 * @param {string} pFormat - Format string
	 * @returns {object} Sub-parser service instance
	 */
	_getParser(pFormat)
	{
		switch (pFormat)
		{
			case 'json':
				return this.fable.MeadowIntegrationFileParserJSON;
			case 'xlsx':
				return this.fable.MeadowIntegrationFileParserXLSX;
			case 'xml':
				return this.fable.MeadowIntegrationFileParserXML;
			case 'fixedwidth':
				return this.fable.MeadowIntegrationFileParserFixedWidth;
			case 'csv':
			default:
				return this.fable.MeadowIntegrationFileParserCSV;
		}
	}

	/**
	 * Parse a file using streaming, dispatching to the appropriate sub-parser.
	 * Format is determined from options.format, then from file extension, then content.
	 *
	 * @param {string} pFilePath - Absolute path to the file
	 * @param {object} pOptions - Parser options; pOptions.format overrides detection
	 * @param {function} pChunkCallback - Called with (pError, pRecords) as records are ready
	 * @param {function} pCompletionCallback - Called with (pError, pTotalCount) when done
	 */
	parseFile(pFilePath, pOptions, pChunkCallback, pCompletionCallback)
	{
		let tmpOptions = Object.assign({}, this.options, pOptions);
		let tmpFormat = tmpOptions.format ? tmpOptions.format.toLowerCase() : this.detectFormat(pFilePath);
		let tmpParser = this._getParser(tmpFormat);

		this.fable.log.info(`FileParser: parsing [${pFilePath}] as format [${tmpFormat}]`);
		return tmpParser.parseFile(pFilePath, tmpOptions, pChunkCallback, pCompletionCallback);
	}

	/**
	 * Parse content using a full-array (non-streaming) interface.
	 * Format is determined from options.format, then from content prefix detection.
	 *
	 * @param {string|Buffer} pContent - Raw file content
	 * @param {object} pOptions - Parser options; pOptions.format overrides detection
	 * @param {function} fCallback - Called with (pError, pRecords)
	 */
	parseContent(pContent, pOptions, fCallback)
	{
		let tmpOptions = Object.assign({}, this.options, pOptions);
		let tmpContentPrefix = Buffer.isBuffer(pContent) ? '' : (pContent || '').substring(0, 100);
		let tmpFormat = tmpOptions.format ? tmpOptions.format.toLowerCase() : this.detectFormat('', tmpContentPrefix);
		let tmpParser = this._getParser(tmpFormat);

		return tmpParser.parseContent(pContent, tmpOptions, fCallback);
	}
}

module.exports = MeadowIntegrationFileParser;
