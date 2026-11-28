#!/usr/bin/env node
// @ts-check
/**
 * @file Generate Markdown release notes from two Git revisions.
 */

import {execFileSync} from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import {isDeepStrictEqual} from 'node:util';
import {getIconSlug} from '../../sdk.mjs';

const rootDirectory = path.resolve(import.meta.dirname, '../..');
const catalogPaths = ['data/simple-icons.json', '_data/simple-icons.json'];

/**
 * Read Git output in the repository containing this script.
 * @param {...string} args Git arguments.
 * @returns {string} Command output.
 */
const git = (...args) =>
	execFileSync('git', args, {
		cwd: rootDirectory,
		encoding: 'utf8',
		maxBuffer: 32 * 1024 * 1024,
	}).trimEnd();

/**
 * Read each catalog entry and its SVG blob from the same revision.
 * @param {string} revision Commit to read.
 * @returns {Map<string, {icon: import('../../types.js').IconData, svg: string | undefined}>} Icons indexed by slug.
 */
const snapshot = (revision) => {
	const tree = new Map(
		git(
			'ls-tree',
			'-r',
			'--format=%(path)%x09%(objectname)',
			revision,
			'--',
			'icons/',
			...catalogPaths,
		)
			.split('\n')
			.map((line) => /** @type {[string, string]} */ (line.split('\t'))),
	);
	const catalog = catalogPaths.find((file) => tree.has(file));
	if (!catalog) {
		throw new Error(`Missing icon catalog at ${revision}`);
	}

	const data = JSON.parse(git('show', `${revision}:${catalog}`));
	/** @type {Array<import('../../types.js').IconData>} */
	const icons = data.icons ?? data;
	return new Map(
		icons.map((icon) => {
			const slug = getIconSlug(icon);
			return [slug, {icon, svg: tree.get(`icons/${slug}.svg`)}];
		}),
	);
};

/**
 * Compare metadata and SVG blobs by slug, including deleted icons.
 * @param {ReturnType<typeof snapshot>} before Earlier snapshot.
 * @param {ReturnType<typeof snapshot>} after Later snapshot.
 * @yields {{slug: string, title: string, group: string}} Changed icon.
 */
function* changes(before, after) {
	for (const [slug, entry] of after) {
		if (!before.has(slug)) {
			yield {slug, title: entry.icon.title, group: 'new'};
		} else if (!isDeepStrictEqual(before.get(slug), entry)) {
			yield {slug, title: entry.icon.title, group: 'updated'};
		}
	}

	for (const [slug, entry] of before) {
		if (!after.has(slug)) {
			yield {slug, title: entry.icon.title, group: 'removed'};
		}
	}
}

/**
 * Collect PR numbers for changed icons from squash and merge commit subjects.
 * @param {string} before Released commit.
 * @param {string} after Candidate commit.
 * @param {Map<string, Set<string>>} numbers PR numbers per changed slug.
 */
const collectPullRequests = (before, after, numbers) => {
	// Older release tags include the icon PRs through a release merge's second parent.
	const history = git(
		'log',
		'--reverse',
		'--format=%H%x09%s',
		`${before}..${after}`,
	);
	for (const line of history.split('\n')) {
		const [commit, subject = ''] = line.split(/\t(.*)/v);
		const number =
			/^Merge pull request #(\d+)\b/v.exec(subject)?.[1] ??
			/\(#(\d+)\)$/v.exec(subject)?.[1];
		if (number) {
			for (const {slug} of changes(snapshot(`${commit}^1`), snapshot(commit))) {
				numbers.get(slug)?.add(number);
			}
		}
	}
};

const json = process.argv[2] === '--json';
const args = process.argv.slice(json ? 3 : 2);
const [beforeRef, afterRef = 'HEAD'] = args;
if (!beforeRef || args.length > 2) {
	console.error(
		'Usage: node scripts/release/generate-release-note.mjs [--json] <before> [after=HEAD]',
	);
	process.exit(1);
}

const resolveCommit = (/** @type {string} */ ref) =>
	git('rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`);
const before = resolveCommit(beforeRef);
const after = resolveCommit(afterRef);
const released = snapshot(before);
const diff = [...changes(released, snapshot(after))];
const sections = [];
if (diff.length > 0) {
	/** @type {Map<string, Set<string>>} */
	const numbers = new Map(diff.map(({slug}) => [slug, new Set()]));
	collectPullRequests(before, after, numbers);
	for (const group of ['new', 'updated', 'removed']) {
		const items = diff.filter((change) => change.group === group);
		if (items.length > 0) {
			const lines = items.map(({slug, title}) => {
				const references = [...(numbers.get(slug) ?? [])]
					.map((number) => `#${number}`)
					.join(', ');
				return references ? `- ${title} (${references})` : `- ${title}`;
			});
			sections.push(
				`## ${items.length} ${group} icon${items.length === 1 ? '' : 's'}\n\n${lines.join('\n')}`,
			);
		}
	}
}

const notes = sections.join('\n\n');
if (json) {
	let bump = null;
	if (diff.some(({group}) => group === 'removed')) {
		bump = 'major';
	} else if (
		diff.some(({slug, title}) => released.get(slug)?.icon.title !== title)
	) {
		bump = 'minor';
	} else if (diff.length > 0) {
		bump = 'patch';
	}

	process.stdout.write(JSON.stringify({bump, notes}) + '\n');
} else if (notes) {
	process.stdout.write(notes + '\n');
}
