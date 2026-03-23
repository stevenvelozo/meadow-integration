'use strict';

const libFableServiceProviderBase = require('fable-serviceproviderbase');
const libFS = require('fs');
const libReadline = require('readline');

const defaultFixedWidthParserOptions = (
	{
		skipLines: 0,
		columns: []
	});

class MeadowIntegrationFileParserFixedWidth extends libFableServiceProviderBase
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({}, defaultFixedWidthParserOptions, pOptions);
		super(pFable, tmpOptions, pServiceHash);

		this.serviceType = 'MeadowIntegrationFileParserFixedWidth';
	}

	/**
	 * Extract fields from a fixed-width line using a columns definition.
	 * Column start positions are 1-based.
	 *
	 * @param {string} pLine - Raw text line
	 * @param {Array} pColumns - Array of {name, start, width}
	 * @returns {object} Extracted record
	 */
	_parseLine(pLine, pColumns)
	{
		let tmpRecord = {};
		for (let i = 0; i < pColumns.length; i++)
		{
			let tmpCol = pColumns[i];
			// start is 1-based
			let tmpStartIdx = (parseInt(tmpCol.start, 10) || 1) - 1;
			let tmpWidth = parseInt(tmpCol.width, 10) || 0;
			let tmpValue = pLine.substring(tmpStartIdx, tmpStartIdx + tmpWidth).trim();
			tmpRecord[tmpCol.name] = tmpValue;
		}
		return tmpRecord;
	}

	/**
	 * Parse a fixed-width file using streaming readline.
	 *
	 * @param {string} pFilePath - Absolute path to the fixed-width file
	 * @param {object} pOptions - Parser options: skipLines, columns, chunkSize
	 * @param {function} pChunkCallback - Called with (pError, pRecords) per chunk
	 * @param {function} pCompletionCallback - Called with (pError, pTotalCount) when done
	 */
	parseFile(pFilePath, pOptions, pChunkCallback, pCompletionCallback)
	{
		let tmpOptions = Object.assign({}, this.options, pOptions);
		let tmpColumns = tmpOptions.columns || [];
		let tmpSkipLines = parseInt(tmpOptions.skipLines, 10) || 0;
		let tmpChunkSize = parseInt(tmpOptions.chunkSize, 10) || 100;

		if (!tmpColumns || tmpColumns.length === 0)
		{
			return pCompletionCallback(new Error('FixedWidth parser requires options.columns array of {name, start, width}'));
		}

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
				if (tmpLineIndex < tmpSkipLines)
				{
					tmpLineIndex++;
					return;
				}

				// Skip blank lines
				if (!pLine || pLine.trim().length === 0)
				{
					tmpLineIndex++;
					return;
				}

				let tmpRecord = this._parseLine(pLine, tmpColumns);
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
	 * Parse fixed-width content string into a full array of records.
	 *
	 * @param {string} pContent - Raw fixed-width text
	 * @param {object} pOptions - Parser options
	 * @param {function} fCallback - Called with (pError, pRecords)
	 */
	parseContent(pContent, pOptions, fCallback)
	{
		let tmpOptions = Object.assign({}, this.options, pOptions);
		let tmpColumns = tmpOptions.columns || [];
		let tmpSkipLines = parseInt(tmpOptions.skipLines, 10) || 0;

		if (!tmpColumns || tmpColumns.length === 0)
		{
			return fCallback(new Error('FixedWidth parser requires options.columns array of {name, start, width}'));
		}

		let tmpLines = pContent.split('\n');
		let tmpRecords = [];

		for (let i = tmpSkipLines; i < tmpLines.length; i++)
		{
			let tmpLine = tmpLines[i];

			// Skip blank lines
			if (!tmpLine || tmpLine.trim().length === 0)
			{
				continue;
			}

			tmpRecords.push(this._parseLine(tmpLine, tmpColumns));
		}

		return fCallback(null, tmpRecords);
	}
}

module.exports = MeadowIntegrationFileParserFixedWidth;
