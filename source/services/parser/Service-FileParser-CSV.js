'use strict';

const libFableServiceProviderBase = require('fable-serviceproviderbase');
const libFS = require('fs');
const libReadline = require('readline');

const defaultCSVParserOptions = (
	{
		delimiter: ',',
		quoteChar: '"',
		hasHeaders: true,
		skipRows: 0,
		commentPrefix: '',
		trim: true,
		chunkSize: 100
	});

class MeadowIntegrationFileParserCSV extends libFableServiceProviderBase
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({}, defaultCSVParserOptions, pOptions);
		super(pFable, tmpOptions, pServiceHash);

		this.serviceType = 'MeadowIntegrationFileParserCSV';

		this._headers = null;
	}

	/**
	 * Parse a single CSV line into an array of values.
	 * Handles quoted fields (including embedded commas and escaped quotes).
	 *
	 * @param {string} pLine - Raw CSV line
	 * @param {string} pDelimiter - Field delimiter character
	 * @param {string} pQuoteChar - Quote character
	 * @param {boolean} pTrim - Whether to trim field values
	 * @returns {Array<string>} Parsed field values
	 */
	_parseCSVLine(pLine, pDelimiter, pQuoteChar, pTrim)
	{
		let tmpDelimiter = pDelimiter || ',';
		let tmpQuoteChar = pQuoteChar || '"';
		let tmpValues = [];
		let tmpCurrent = '';
		let tmpInQuotes = false;

		for (let i = 0; i < pLine.length; i++)
		{
			let tmpChar = pLine[i];

			if (tmpChar === tmpQuoteChar)
			{
				if (tmpInQuotes && pLine[i + 1] === tmpQuoteChar)
				{
					// Escaped quote (doubled)
					tmpCurrent += tmpQuoteChar;
					i++;
				}
				else
				{
					tmpInQuotes = !tmpInQuotes;
				}
			}
			else if (tmpChar === tmpDelimiter && !tmpInQuotes)
			{
				tmpValues.push(pTrim ? tmpCurrent.trim() : tmpCurrent);
				tmpCurrent = '';
			}
			else
			{
				tmpCurrent += tmpChar;
			}
		}

		tmpValues.push(pTrim ? tmpCurrent.trim() : tmpCurrent);
		return tmpValues;
	}

	/**
	 * Parse a CSV file using streaming readline.
	 * Fires chunkCallback with arrays of records as they accumulate.
	 * Fires completionCallback when the file is fully consumed.
	 *
	 * @param {string} pFilePath - Absolute path to the CSV file
	 * @param {object} pOptions - Parser options (overrides instance options)
	 * @param {function} pChunkCallback - Called with (pError, pRecords) per chunk
	 * @param {function} pCompletionCallback - Called with (pError, pTotalCount) when done
	 */
	parseFile(pFilePath, pOptions, pChunkCallback, pCompletionCallback)
	{
		let tmpOptions = Object.assign({}, this.options, pOptions);
		let tmpChunkSize = tmpOptions.chunkSize || 100;
		let tmpHasHeaders = tmpOptions.hasHeaders !== false;
		let tmpSkipRows = parseInt(tmpOptions.skipRows, 10) || 0;
		let tmpCommentPrefix = tmpOptions.commentPrefix || '';
		let tmpTrim = tmpOptions.trim !== false;
		let tmpDelimiter = tmpOptions.delimiter || ',';
		let tmpQuoteChar = tmpOptions.quoteChar || '"';

		this._headers = null;

		let tmpLineIndex = 0;
		let tmpRecordCount = 0;
		let tmpChunkBuffer = [];

		const tmpReadline = libReadline.createInterface(
			{
				input: libFS.createReadStream(pFilePath),
				crlfDelay: Infinity
			});

		tmpReadline.on('line',
			(pLine) =>
			{
				// Skip comment lines
				if (tmpCommentPrefix && pLine.startsWith(tmpCommentPrefix))
				{
					return;
				}

				// Skip header/preamble rows
				if (tmpLineIndex < tmpSkipRows)
				{
					tmpLineIndex++;
					return;
				}

				let tmpValues = this._parseCSVLine(pLine, tmpDelimiter, tmpQuoteChar, tmpTrim);

				// First non-skipped, non-comment line becomes headers
				if (tmpHasHeaders && !this._headers)
				{
					this._headers = tmpValues;
					tmpLineIndex++;
					return;
				}

				let tmpRecord;
				if (this._headers)
				{
					tmpRecord = {};
					for (let i = 0; i < this._headers.length; i++)
					{
						tmpRecord[this._headers[i]] = (tmpValues && tmpValues[i] !== undefined) ? tmpValues[i] : '';
					}
				}
				else
				{
					tmpRecord = tmpValues || [];
				}

				tmpChunkBuffer.push(tmpRecord);
				tmpRecordCount++;
				tmpLineIndex++;

				if (tmpChunkBuffer.length >= tmpChunkSize)
				{
					pChunkCallback(null, tmpChunkBuffer.splice(0, tmpChunkBuffer.length));
				}
			});

		tmpReadline.on('close',
			() =>
			{
				if (tmpChunkBuffer.length > 0)
				{
					pChunkCallback(null, tmpChunkBuffer.splice(0, tmpChunkBuffer.length));
				}
				return pCompletionCallback(null, tmpRecordCount);
			});

		tmpReadline.on('error',
			(pError) =>
			{
				return pCompletionCallback(pError);
			});
	}

	/**
	 * Parse CSV content string into a full array of records.
	 *
	 * @param {string} pContent - Raw CSV text
	 * @param {object} pOptions - Parser options
	 * @param {function} fCallback - Called with (pError, pRecords)
	 */
	parseContent(pContent, pOptions, fCallback)
	{
		let tmpOptions = Object.assign({}, this.options, pOptions);
		let tmpHasHeaders = tmpOptions.hasHeaders !== false;
		let tmpSkipRows = parseInt(tmpOptions.skipRows, 10) || 0;
		let tmpCommentPrefix = tmpOptions.commentPrefix || '';
		let tmpTrim = tmpOptions.trim !== false;
		let tmpDelimiter = tmpOptions.delimiter || ',';
		let tmpQuoteChar = tmpOptions.quoteChar || '"';

		let tmpLines = pContent.split('\n');
		let tmpHeaders = null;
		let tmpRecords = [];
		let tmpLineIndex = 0;

		for (let i = 0; i < tmpLines.length; i++)
		{
			let tmpLine = tmpLines[i];

			// Strip trailing \r for Windows line endings
			if (tmpLine.length > 0 && tmpLine[tmpLine.length - 1] === '\r')
			{
				tmpLine = tmpLine.slice(0, -1);
			}

			// Skip comment lines
			if (tmpCommentPrefix && tmpLine.startsWith(tmpCommentPrefix))
			{
				continue;
			}

			// Skip preamble rows
			if (tmpLineIndex < tmpSkipRows)
			{
				tmpLineIndex++;
				continue;
			}

			// Skip blank lines
			if (!tmpLine || tmpLine.trim().length === 0)
			{
				tmpLineIndex++;
				continue;
			}

			let tmpValues = this._parseCSVLine(tmpLine, tmpDelimiter, tmpQuoteChar, tmpTrim);

			if (tmpHasHeaders && !tmpHeaders)
			{
				tmpHeaders = tmpValues;
				tmpLineIndex++;
				continue;
			}

			let tmpRecord;
			if (tmpHeaders)
			{
				tmpRecord = {};
				for (let j = 0; j < tmpHeaders.length; j++)
				{
					tmpRecord[tmpHeaders[j]] = (tmpValues && tmpValues[j] !== undefined) ? tmpValues[j] : '';
				}
			}
			else
			{
				tmpRecord = tmpValues || [];
			}

			tmpRecords.push(tmpRecord);
			tmpLineIndex++;
		}

		return fCallback(null, tmpRecords);
	}
}

module.exports = MeadowIntegrationFileParserCSV;
