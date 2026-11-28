# Versioning

We use [Semantic Versioning](https://semver.org/) to version Simple Icons. In short, this means that version numbers are structured as `MAJOR.MINOR.PATCH`. For example, version `3.1.4` is major version `3`, minor version `1`, and patch `4`. Increasing each of these numbers implies certain kinds of changes.

For Simple Icons, given a change to the version number you can expect the following kinds of changes:

| Version number increase | Kinds of changes |
| :-- | :-- |
| _Major_ | Removed icons; Slug changed icons; Breaking API changes |
| _Minor_ | New icons; Title changed icons; API changes |
| _Patch_ | Updated SVGs; Updated metadata |

## Release Schedule

_Minor_ releases and _patches_ are scheduled on a weekly basis and are generally released on a Sunday.

_Major_ releases are scheduled on a half-year basis, mainly to remove old SVGs. That is, approximately every 6 months a normal Sunday release is a _major_ release instead of a _minor_ release or _patch_.

## Preparing and publishing a release

The **Create Release Pull Request** workflow compares the last published numeric tag with `main`. It opens or refreshes the bot’s `release/next` PR with the version bump, generated files and release notes. An ordinary merge into `main` only runs CI.

To preview the notes locally, fetch the release tag and run `node scripts/release/generate-release-note.mjs <tag> main` in a clone with full history. For API changes, run the workflow manually on `main`, choose the minimum version bump and supply the additional release notes.

Review the release PR and approve its current head. The bot merges after the required checks pass. If `main` advances first, run the preparation workflow again and approve the refreshed PR. The publisher uses the merge commit for npm and the GitHub Release, then dispatches the font and legacy website workflows. To recover from a failed publishing step, rerun the failed jobs for that merge.

## Deprecation

After a _major_ release, the only other supported version is the last version of the previous _major_ release. This previous version will only receive bug fixes to either the npm library, or our internal APIs.
