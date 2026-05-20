'use strict';

/**
 * Brand wrapper for the mapping-demo Pict app. Reads the retold.brand
 * block populated by `npm run brand` (which invokes
 * pict-section-theme/bin/pict-section-theme-brand.js with the forest
 * palette) and exposes it for the Theme-Section provider's BrandMark.
 */
const tmpPackage = require('../package.json');

if (!tmpPackage.retold || !tmpPackage.retold.brand)
{
	throw new Error('mapping-demo: package.json is missing retold.brand — '
		+ 'run `npm run brand` (chained from prebuild) before building');
}

module.exports = tmpPackage.retold.brand;
