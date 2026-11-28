#!/usr/bin/env node
// @ts-check
/**
 * @file
 * Rewrite some Markdown files.
 */

import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';

const rootDirectory = path.resolve(import.meta.dirname, '..', '..');
const readmeFile = path.resolve(rootDirectory, 'README.md');
const {version} = JSON.parse(
	await readFile(path.join(rootDirectory, 'package.json'), 'utf8'),
);
const disclaimerFile = path.resolve(rootDirectory, 'DISCLAIMER.md');

/**
 * Reformat a file.
 * @param {string} filePath Path to the file.
 */
const reformat = async (filePath) => {
	const fileContent = await readFile(filePath, 'utf8');
	await writeFile(
		filePath,
		fileContent
			// Link released copies of the slug table to their matching version.
			.replaceAll(
				'https://github.com/simple-icons/simple-icons/blob/HEAD/slugs.md',
				`https://github.com/simple-icons/simple-icons/blob/${version}/slugs.md`,
			)
			// Add &nbsp; spaces after icons that are inside a CDN link before text
			// Fixes rendering in npmjs.com and packagist.org
			// Reference: https://github.com/simple-icons/simple-icons/pull/14248
			.replaceAll(
				/<img src="https:\/\/cdn.simpleicons.org\/([^\/]+)\/000\/fff"([^>]+)>([^<]+)<\/a>/gv,
				'<img src="https://cdn.simpleicons.org/$1/000/fff"$2>&nbsp;$3</a>',
			)
			// Replace all GitHub blockquotes with regular markdown
			// Reference: https://github.com/orgs/community/discussions/16925
			.replaceAll(
				/\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?!\()/gv,
				(string_, $0) => {
					const capital = $0.slice(0, 1);
					const body = $0.slice(1).toLowerCase();
					return `**${capital + body}**`;
				},
			),
	);
};

await Promise.all([reformat(readmeFile), reformat(disclaimerFile)]);
