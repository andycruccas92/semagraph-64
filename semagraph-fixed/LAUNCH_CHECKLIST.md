# SemaGraph public launch checklist

Everything below is what stands between the current repo and a clean public
release across GitHub, npm, and crates.io. Items marked **[you]** need a human
decision or a secret only you hold; the rest is already prepared in the repo.

## 0. One thing to fill in first: the repository URL

Several files now contain the placeholder `OWNER`. Replace it with your real
GitHub owner (user or org) everywhere before publishing:

- `packages/kernel/package.json` — `homepage`, `repository.url`, `bugs.url`
- `packages/core-rs/Cargo.toml` — `repository`, `homepage`
- `packages/cli/Cargo.toml` — `repository`, `homepage`

Quick find: search the repo for `OWNER`.

## 1. Version alignment **[you]**

The monorepo currently ships three different versions:

| Package                | Version |
|------------------------|---------|
| root `semagraph`       | 0.6.2   |
| `@semagraph/kernel`    | 0.6.0   |
| `semagraph-core-rs`    | 0.7.0   |
| `semagraph` (CLI)      | 0.7.0   |

Independent versioning is fine, but for a first coordinated launch it is cleaner
to pick one line (e.g. `0.7.0`) and tag `v0.7.0`. If you bump `semagraph-core-rs`,
also update the `version` in the `cli/Cargo.toml` dependency to match.

## 2. GitHub open-source repo

- [ ] Replace `OWNER` (section 0).
- [ ] `LICENSE` present at root — Apache-2.0. ✔ already there.
- [ ] Add `CONTRIBUTING.md` and a `CODE_OF_CONDUCT.md` (optional but expected for OSS).
- [ ] Confirm the README's "install from crates.io (when published)" note is accurate once you publish.
- [ ] Make the repo public in GitHub settings.
- [ ] Verify CI is green on `main` (`.github/workflows/ci.yml` already runs typecheck, tests, build, parity fixtures, clippy, fmt, SIMD).

## 3. npm — `@semagraph/kernel`

Prepared: metadata, `files`, `publishConfig.access = public`, `prepublishOnly`
build, and a package README. **[you]** still need:

- [ ] Own the `@semagraph` scope/org on npm (create it if it doesn't exist).
- [ ] Create an npm **automation** token and add it as the `NPM_TOKEN` repo secret.
- [ ] Dry run locally: `cd packages/kernel && npm publish --dry-run` and inspect the file list (should be `dist/` + README + LICENSE + package.json only).

## 4. crates.io — `semagraph-core-rs` and `semagraph`

Prepared: `repository`/`keywords`/`categories` metadata and a `version` on the
path dependency (crates.io rejects path-only deps). **[you]** still need:

- [ ] Create a crates.io API token, add it as the `CARGO_REGISTRY_TOKEN` repo secret.
- [ ] Confirm both crate names are available on crates.io (`semagraph`, `semagraph-core-rs`).
- [ ] Dry run: `cd packages && cargo publish -p semagraph-core-rs --dry-run`.
- [ ] Remember publish order: **core-rs first**, then the CLI (the workflow does this).

## 5. Prebuilt binaries

Already handled by `.github/workflows/release.yml` (musl Linux, macOS x86_64 +
arm64, Windows). Triggered by pushing a `v*` tag. No action needed beyond tagging.

## 6. Cut the release

Once secrets are set and `OWNER`/versions are fixed:

```bash
git tag v0.7.0
git push origin v0.7.0
```

This fans out to three workflows on the tag:
- `ci.yml` — validation (runs on every push/PR anyway)
- `release.yml` — builds and attaches binaries to the GitHub Release
- `publish.yml` — publishes the npm package and the crates (each skips cleanly if its token is unset)

## Optional, recommended before 1.0

- **Property-based tests** for the shape invariants the design leans on
  (e.g. equal shape ⇒ equal endpoint; run-collapse + dwell reconstruct the path
  losslessly). Currently these are covered only by example-based tests.
- **Tighten the public narrative**: a one-paragraph, concrete "what problem this
  solves and for whom" at the top of the README, with a single worked example,
  before the abstract framing.
- Decide whether `weightedSnapshotSimilarity`'s strict-equality behaviour on
  numeric parameters is intended, and document it.
