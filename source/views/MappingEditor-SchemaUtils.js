const MICRODDL_TYPE_MAP =
{
	'@': { DataType: 'AutoIdentity', Label: 'Auto ID', HasSize: false },
	'%': { DataType: 'GUID', Label: 'GUID', HasSize: false },
	'$': { DataType: 'String', Label: 'String', HasSize: true },
	'*': { DataType: 'Text', Label: 'Text', HasSize: false },
	'#': { DataType: 'Numeric', Label: 'Numeric', HasSize: false },
	'.': { DataType: 'Decimal', Label: 'Decimal', HasSize: true },
	'&': { DataType: 'DateTime', Label: 'Date/Time', HasSize: false },
	'^': { DataType: 'Boolean', Label: 'Boolean', HasSize: false }
};

const DATATYPE_TO_SYMBOL = {};
for (let tmpSymbol in MICRODDL_TYPE_MAP)
{
	DATATYPE_TO_SYMBOL[MICRODDL_TYPE_MAP[tmpSymbol].DataType] = tmpSymbol;
}

function columnsToMicroDDL(pColumns, pTableName)
{
	let tmpTableName = (pTableName || 'Untitled').replace(/[^a-zA-Z0-9_]/g, '');
	let tmpLines = ['!' + tmpTableName];

	for (let i = 0; i < pColumns.length; i++)
	{
		let tmpCol = pColumns[i];
		let tmpSymbol = DATATYPE_TO_SYMBOL[tmpCol.DataType] || '$';
		let tmpLine = tmpSymbol + (tmpCol.Name || 'Column' + i);

		if (MICRODDL_TYPE_MAP[tmpSymbol].HasSize && tmpCol.Size)
		{
			tmpLine += ' ' + tmpCol.Size;
		}

		tmpLines.push(tmpLine);
	}

	return tmpLines.join('\n');
}

function microDDLToColumns(pDDL)
{
	let tmpLines = pDDL.split('\n');
	let tmpColumns = [];

	for (let i = 0; i < tmpLines.length; i++)
	{
		let tmpLine = tmpLines[i].trim();
		if (!tmpLine || tmpLine.startsWith('!') || tmpLine.startsWith('//') || tmpLine.startsWith('--') || tmpLine.startsWith('->'))
		{
			continue;
		}

		let tmpSymbol = tmpLine.charAt(0);
		if (MICRODDL_TYPE_MAP.hasOwnProperty(tmpSymbol))
		{
			let tmpRest = tmpLine.substring(1).trim();
			let tmpParts = tmpRest.split(/\s+/);
			tmpColumns.push(
			{
				Name: tmpParts[0] || '',
				DataType: MICRODDL_TYPE_MAP[tmpSymbol].DataType,
				Size: tmpParts[1] || ''
			});
		}
	}

	return tmpColumns;
}

module.exports = { MICRODDL_TYPE_MAP, DATATYPE_TO_SYMBOL, columnsToMicroDDL, microDDLToColumns };
