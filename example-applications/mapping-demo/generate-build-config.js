'use strict';

/**
 * Copies pict.min.js from node_modules into web/ so the server can serve it.
 * The quackage build config comes from .quackage.json — no manual generation needed.
 *
 * Run automatically via `npm run build` before starting the demo.
 */

const libPath = require('path');
const libFS = require('fs');

// ── Copy pict.min.js from node_modules into web/ ──────────────────────────────

const tmpPictDistCandidates =
[
	libPath.resolve(__dirname, 'node_modules/pict/dist/pict.min.js'),
	libPath.resolve(__dirname, '../../node_modules/pict/dist/pict.min.js')
];

let tmpPictMinSrc = null;
for (let i = 0; i < tmpPictDistCandidates.length; i++)
{
	if (libFS.existsSync(tmpPictDistCandidates[i]))
	{
		tmpPictMinSrc = tmpPictDistCandidates[i];
		break;
	}
}

if (tmpPictMinSrc)
{
	const tmpWebDir = libPath.resolve(__dirname, 'web');
	if (!libFS.existsSync(tmpWebDir))
	{
		libFS.mkdirSync(tmpWebDir, { recursive: true });
	}
	libFS.copyFileSync(tmpPictMinSrc, libPath.join(tmpWebDir, 'pict.min.js'));
	console.log('Copied pict.min.js to web/');
}
else
{
	console.warn('WARNING: Could not find pict/dist/pict.min.js — run npm install in meadow-integration first.');
}
