'use strict';

const libFableServiceProviderBase = require('fable-serviceproviderbase');
const libFS = require('fs');

const defaultXLSXParserOptions = (
	{
		sheetName: '',
		sheetIndex: 0,
		headerRow: 1,
		dataStartRow: 2,
		maxFileSizeMB: 50
	});

class MeadowIntegrationFileParserXLSX extends libFableServiceProviderBase
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({}, defaultXLSXParserOptions, pOptions);
		super(pFable, tmpOptions, pServiceHash);

		this.serviceType = 'MeadowIntegrationFileParserXLSX';
	}

	/**
	 * Parse an XLSX file into an array of records.
	 * Entire file is read into memory. Enforces maxFileSizeMB guard.
	 *
	 * @param {string} pFilePath - Absolute path to the XLSX file
	 * @param {object} pOptions - Parser options
	 * @param {function} pChunkCallback - Called with (pError, pRecords) once with all records
	 * @param {function} pCompletionCallback - Called with (pError, pTotalCount) when done
	 */
	parseFile(pFilePath, pOptions, pChunkCallback, pCompletionCallback)
	{
		let tmpOptions = Object.assign({}, this.options, pOptions);
		let tmpMaxFileSizeMB = parseFloat(tmpOptions.maxFileSizeMB) || 50;
		let tmpMaxBytes = tmpMaxFileSizeMB * 1024 * 1024;

		let tmpStat;
		try
		{
			tmpStat = libFS.statSync(pFilePath);
		}
		catch (pError)
		{
			return pCompletionCallback(new Error(`XLSX file stat error: ${pError.message}`));
		}

		if (tmpStat.size > tmpMaxBytes)
		{
			return pCompletionCallback(new Error(`XLSX file size ${(tmpStat.size / 1024 / 1024).toFixed(1)}MB exceeds maxFileSizeMB limit of ${tmpMaxFileSizeMB}MB`));
		}

		let tmpBuffer;
		try
		{
			tmpBuffer = libFS.readFileSync(pFilePath);
		}
		catch (pError)
		{
			return pCompletionCallback(new Error(`XLSX file read error: ${pError.message}`));
		}

		this._parseBuffer(tmpBuffer, tmpOptions,
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
	 * Parse XLSX content (Buffer) into a full array of records.
	 * Content must be a Buffer containing xlsx file bytes.
	 *
	 * @param {Buffer|string} pContent - XLSX file as Buffer (or base64 string)
	 * @param {object} pOptions - Parser options
	 * @param {function} fCallback - Called with (pError, pRecords)
	 */
	parseContent(pContent, pOptions, fCallback)
	{
		let tmpOptions = Object.assign({}, this.options, pOptions);
		let tmpBuffer = Buffer.isBuffer(pContent) ? pContent : Buffer.from(pContent, 'base64');
		return this._parseBuffer(tmpBuffer, tmpOptions, fCallback);
	}

	/**
	 * Internal: parse an xlsx Buffer into records using the xlsx library.
	 *
	 * @param {Buffer} pBuffer - XLSX bytes
	 * @param {object} pOptions - Merged options
	 * @param {function} fCallback - Called with (pError, pRecords)
	 */
	_parseBuffer(pBuffer, pOptions, fCallback)
	{
		let tmpXLSX;
		try
		{
			tmpXLSX = require('xlsx');
		}
		catch (pError)
		{
			return fCallback(new Error(`xlsx library not available: ${pError.message}`));
		}

		let tmpWorkbook;
		try
		{
			tmpWorkbook = tmpXLSX.read(pBuffer, { type: 'buffer' });
		}
		catch (pError)
		{
			return fCallback(new Error(`XLSX parse error: ${pError.message}`));
		}

		// Determine sheet to use
		let tmpSheetName;
		if (pOptions.sheetName && typeof pOptions.sheetName === 'string' && pOptions.sheetName.length > 0)
		{
			tmpSheetName = pOptions.sheetName;
		}
		else
		{
			let tmpSheetIndex = parseInt(pOptions.sheetIndex, 10) || 0;
			tmpSheetName = tmpWorkbook.SheetNames[tmpSheetIndex];
		}

		if (!tmpSheetName || !tmpWorkbook.Sheets[tmpSheetName])
		{
			return fCallback(new Error(`XLSX sheet '${tmpSheetName}' not found in workbook`));
		}

		let tmpSheet = tmpWorkbook.Sheets[tmpSheetName];
		let tmpHeaderRow = parseInt(pOptions.headerRow, 10) || 1;
		let tmpDataStartRow = parseInt(pOptions.dataStartRow, 10) || 2;

		// When headerRow and dataStartRow are at their defaults (1 and 2),
		// use xlsx's built-in sheet_to_json which handles this automatically
		if (tmpHeaderRow === 1 && tmpDataStartRow === 2)
		{
			try
			{
				let tmpRecords = tmpXLSX.utils.sheet_to_json(tmpSheet);
				return fCallback(null, tmpRecords);
			}
			catch (pError)
			{
				return fCallback(new Error(`XLSX sheet_to_json error: ${pError.message}`));
			}
		}

		// Custom header/data row offsets: read as raw array first
		try
		{
			let tmpRawRows = tmpXLSX.utils.sheet_to_json(tmpSheet, { header: 1 });

			// Header row is 1-based; convert to 0-based index
			let tmpHeaderIdx = tmpHeaderRow - 1;
			let tmpDataIdx = tmpDataStartRow - 1;

			if (tmpHeaderIdx >= tmpRawRows.length)
			{
				return fCallback(new Error(`XLSX headerRow ${tmpHeaderRow} is beyond sheet row count`));
			}

			let tmpHeaders = tmpRawRows[tmpHeaderIdx];
			let tmpRecords = [];

			for (let i = tmpDataIdx; i < tmpRawRows.length; i++)
			{
				let tmpRow = tmpRawRows[i];
				let tmpRecord = {};
				for (let j = 0; j < tmpHeaders.length; j++)
				{
					tmpRecord[tmpHeaders[j]] = (tmpRow && tmpRow[j] !== undefined) ? tmpRow[j] : '';
				}
				tmpRecords.push(tmpRecord);
			}

			return fCallback(null, tmpRecords);
		}
		catch (pError)
		{
			return fCallback(new Error(`XLSX custom row parse error: ${pError.message}`));
		}
	}
}

module.exports = MeadowIntegrationFileParserXLSX;
