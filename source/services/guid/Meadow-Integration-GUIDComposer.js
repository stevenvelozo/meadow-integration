// Meadow-Integration-GUIDComposer — deterministic, length-safe composition of context-aware GUIDs.
//
// A "context-aware" GUID embeds its parents' identifiers so it is globally unique without a true UUID,
// e.g. a Line Item 8675309 on Contract 10 / Project 01278 composes to `UI_C10_P01278_LI8675309`. The
// hard part is staying inside the destination GUID column's width: when the composed string is too long
// this DETERMINISTICALLY hashes segments (interior context first, then the own segment, then the first)
// until it fits — `UI_C10_HASH_LI8675309` → `UI_C10_HASH_HASH` — so the same source row always yields the
// same GUID (idempotent upsert) even after shrinking.
//
// PURE + dependency-light on purpose: no node `crypto`, no fable, no DOM. It runs unchanged in the browser
// engine bundle (the Meadow-Integration-Engine boundary) and is trivially unit-testable in isolation.

const _DEFAULT_SEPARATOR = '_';
const _DEFAULT_HASH_LENGTH = 10;

/**
 * Deterministic 53-bit string hash (cyrb53) rendered as a fixed-length base36 token. Same input → same
 * output in any JS runtime, forever — which is what makes a shrunk GUID still match on re-import.
 * @param {string} pValue
 * @param {number} [pLength] - max token length (default 10)
 * @returns {string}
 */
function hashSegment(pValue, pLength)
{
	const tmpLength = (typeof pLength === 'number' && pLength > 0) ? pLength : _DEFAULT_HASH_LENGTH;
	const tmpString = String((pValue === null || pValue === undefined) ? '' : pValue);
	let tmpH1 = 0xdeadbeef;
	let tmpH2 = 0x41c6ce57;
	for (let i = 0; i < tmpString.length; i++)
	{
		const tmpCharCode = tmpString.charCodeAt(i);
		tmpH1 = Math.imul(tmpH1 ^ tmpCharCode, 2654435761);
		tmpH2 = Math.imul(tmpH2 ^ tmpCharCode, 1597334677);
	}
	tmpH1 = Math.imul(tmpH1 ^ (tmpH1 >>> 16), 2246822507) ^ Math.imul(tmpH2 ^ (tmpH2 >>> 13), 3266489909);
	tmpH2 = Math.imul(tmpH2 ^ (tmpH2 >>> 16), 2246822507) ^ Math.imul(tmpH1 ^ (tmpH1 >>> 13), 3266489909);
	// 53-bit unsigned integer (safe-integer range) → base36 token.
	const tmpHashNumber = 4294967296 * (2097151 & tmpH2) + (tmpH1 >>> 0);
	const tmpToken = tmpHashNumber.toString(36);
	return (tmpToken.length > tmpLength) ? tmpToken.slice(0, tmpLength) : tmpToken;
}

/** Render one segment as `<abbrev><value>` (e.g. `P01278`). */
function segmentString(pSegment)
{
	const tmpSegment = pSegment || {};
	const tmpAbbrev = (tmpSegment.abbrev === null || tmpSegment.abbrev === undefined) ? '' : String(tmpSegment.abbrev);
	const tmpValue = (tmpSegment.value === null || tmpSegment.value === undefined) ? '' : String(tmpSegment.value);
	return `${tmpAbbrev}${tmpValue}`;
}

/** Join the prefix (if any) + the segment strings with the separator. */
function _assemble(pPrefix, pSegmentStrings, pSeparator)
{
	const tmpParts = pPrefix ? [ pPrefix ].concat(pSegmentStrings) : pSegmentStrings.slice();
	return tmpParts.join(pSeparator);
}

/**
 * The order to hash segments when shrinking: interior context segments first (left→right), then the own
 * (last) segment, then the first context segment — so the prefix + first context + own stay readable
 * longest. Deterministic, so the same overflow always shrinks the same way.
 * @param {number} pCount
 * @returns {Array<number>}
 */
function _shrinkOrder(pCount)
{
	const tmpOrder = [];
	for (let i = 1; i < pCount - 1; i++) { tmpOrder.push(i); }
	if (pCount - 1 >= 1) { tmpOrder.push(pCount - 1); }
	if (pCount >= 1) { tmpOrder.push(0); }
	const tmpSeen = {};
	return tmpOrder.filter((pIndex) => (tmpSeen[pIndex] ? false : (tmpSeen[pIndex] = true)));
}

/**
 * Compose a deterministic, length-safe context-aware GUID.
 * @param {object} pSpec
 * @param {string} [pSpec.prefix] - the leading token (e.g. `UI`); omitted if falsy
 * @param {Array<{abbrev:string, value:*}>} pSpec.segments - ordered context segments + the own segment last
 * @param {string} [pSpec.separator] - default `_`
 * @param {number} [pSpec.maxLength] - the destination GUID column width; <=0 means unbounded
 * @param {number} [pSpec.hashLength] - per-segment hash token length (default 10)
 * @returns {string}
 */
function composeGUID(pSpec)
{
	const tmpSpec = pSpec || {};
	const tmpPrefix = tmpSpec.prefix ? String(tmpSpec.prefix) : '';
	const tmpSeparator = (typeof tmpSpec.separator === 'string') ? tmpSpec.separator : _DEFAULT_SEPARATOR;
	const tmpMaxLength = (typeof tmpSpec.maxLength === 'number') ? tmpSpec.maxLength : 0;
	const tmpHashLength = (typeof tmpSpec.hashLength === 'number' && tmpSpec.hashLength > 0) ? tmpSpec.hashLength : _DEFAULT_HASH_LENGTH;
	const tmpSegments = Array.isArray(tmpSpec.segments) ? tmpSpec.segments : [];

	const tmpSegmentStrings = tmpSegments.map(segmentString);
	let tmpFull = _assemble(tmpPrefix, tmpSegmentStrings, tmpSeparator);
	if (tmpMaxLength <= 0 || tmpFull.length <= tmpMaxLength)
	{
		return tmpFull;
	}

	// Too long — hash segment VALUES (keeping each segment's abbreviation for readability) in shrink order
	// until it fits. The hash is deterministic, so this stays stable across runs.
	const tmpShrinkOrder = _shrinkOrder(tmpSegments.length);
	for (let k = 0; k < tmpShrinkOrder.length; k++)
	{
		const tmpIndex = tmpShrinkOrder[k];
		const tmpSegment = tmpSegments[tmpIndex] || {};
		const tmpAbbrev = (tmpSegment.abbrev === null || tmpSegment.abbrev === undefined) ? '' : String(tmpSegment.abbrev);
		tmpSegmentStrings[tmpIndex] = `${tmpAbbrev}${hashSegment(segmentString(tmpSegment), tmpHashLength)}`;
		tmpFull = _assemble(tmpPrefix, tmpSegmentStrings, tmpSeparator);
		if (tmpFull.length <= tmpMaxLength)
		{
			return tmpFull;
		}
	}

	// Last resort (even all-hashed is too long, or a tiny column): collapse the whole body after the prefix
	// into a single hash sized to the remaining budget.
	const tmpBody = _assemble(tmpPrefix, tmpSegments.map(segmentString), tmpSeparator);
	const tmpPrefixCost = tmpPrefix ? (tmpPrefix.length + tmpSeparator.length) : 0;
	const tmpBudget = Math.max(6, tmpMaxLength - tmpPrefixCost);
	tmpFull = (tmpPrefix ? `${tmpPrefix}${tmpSeparator}` : '') + hashSegment(tmpBody, tmpBudget);
	return (tmpFull.length > tmpMaxLength) ? tmpFull.slice(0, tmpMaxLength) : tmpFull;
}

module.exports = {
	composeGUID,
	hashSegment,
	segmentString,
};
