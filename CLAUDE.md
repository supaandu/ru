# RU — Claude Instructions

## Version Bumping

This app uses `electron-updater` for auto-updates. The updater compares the version in `package.json` against the latest GitHub Release to determine if an update is available.

**Rule**: Every PR and every commit to `main` that changes app behavior MUST include a patch version bump in `package.json` (e.g. `1.1.0` → `1.1.1`). Without this, installed apps won't see the update.

- Use **patch** (`x.x.+1`) for bug fixes and small changes
- Use **minor** (`x.+1.0`) for new features
- Use **major** (`+1.0.0`) for breaking changes

When preparing a commit or PR, bump the version as part of the changeset — not as a separate commit.
