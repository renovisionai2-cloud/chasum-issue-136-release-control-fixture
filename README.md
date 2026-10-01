# Issue #136 disposable release-control fixture

A minimal Next.js app for the already-supplied P-3, P-4, and P-6 criteria. This is synthetic, disposable fixture code only. The app calls no external APIs and has no secrets, provider integrations, database, email, payment, or cron code. Never use Chasum/GVM secrets or real Production/Staging resources. Local validation never pushes or deploys. Use only a separately authorized disposable repository/project later; Production/Preview labels below refer only to that disposable fixture.

## Current fixture

- `app/page.tsx`: the Next.js fixture page and visible feature marker.
- `app/api/identity/route.ts`: the dynamic, public identity endpoint at `/api/identity`.
- `.github/workflows/fixture-quality.yml`: PR/main configuration validation, tests, and Next.js build.
- `.github/workflows/release-production.yml`: manually dispatched, approved exact-SHA release workflow.
- `package.json` and `package-lock.json`: pinned Next.js **16.3.6**, React/React DOM **19.2.4**, and TypeScript **5.9.3**. This app has runtime and development dependencies; `npm run build` builds the Next.js app into `.next/`.

## Local validation

The Program Lead has already reported local validation performed outside this documentation-only session: **validate config PASS; 34 tests PASS; Next build PASS**. These are the previously reported results, not a new test run or a statement of the current test count. External hosted P-3/P-4/P-6 proofs are **NOT RUN**.

Use Node 22 or newer; GitHub workflows select Node 22:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run validate:config
npm test
NEXT_TELEMETRY_DISABLED=1 npm run build
npm start -- --hostname 127.0.0.1
```

`GET /api/identity` reads values at request time and returns only:

- `fixture`: `chasum-issue-136-disposable`
- `VERCEL_ENV`, `VERCEL_GIT_COMMIT_SHA`, `VERCEL_GIT_COMMIT_REF`: platform values or `null` when unset locally
- `FIXTURE_ENV_NAME`: a synthetic public label, defaulting to `local`
- `VERCEL_URL`: only when present

The endpoint is dynamic and sends `Cache-Control: no-store`. It does not enumerate the environment or return request headers. Next.js provides HEAD/OPTIONS handling and rejects write methods because no write handlers exist.

## Configuration proofs

Active `vercel.json` initially contains only the schema URL and **no Git rule**. `fixtures/vercel-main-disabled.json` is the inactive valid P-4 variant. The deliberately invalid `fixtures/vercel-malformed.json` stays inactive locally.

`scripts/validate-vercel-config.mjs` parses JSON and checks a deliberately narrow, offline schema: only the initial config or `git.deploymentEnabled.main=false` is allowed. It rejects unknown keys, wrong types, global blocks, and Preview blocks. It is not a full implementation of Vercel's remote schema. Tests reject both malformed JSON and parseable invalid configuration.

The `.github/workflows/fixture-quality.yml` workflow runs on every PR to main and every main push, including docs-only changes. It installs, validates configuration, tests, and builds without release credentials. Externally make its `Fixture quality` check required before merging. The malformed active-config probe must stay on its own branch/PR and must never merge.

## Exact-SHA releases

`.github/workflows/release-production.yml` runs only by manual dispatch on main, requires `sha`, has `contents: read`, and uses `production-release` concurrency with `cancel-in-progress: false`. Its credential-free preflight checks the candidate. The release job uses GitHub Environment `production`.

The guard rejects floating refs, malformed/missing/non-commit SHAs, missing origin, incomplete history, and commits outside the ancestry of fetched `origin/main`. Both an equal commit and an older ancestor can qualify. It reads `release/candidates.json` from the fetched main commit, requiring an unexpired approved entry. Empty policy authorizes nothing. Policy format:

```json
{
  "version": 1,
  "candidates": [
    {
      "sha": "<replace with an existing 40-character commit SHA>",
      "status": "approved",
      "expiresAt": "<replace with a future UTC ISO timestamp>"
    }
  ]
}
```

These placeholders are deliberately invalid. Approve an existing commit in a later reviewed policy commit. Revoke with `status: "revoked"`, or remove the entry. Stale means approval has expired, not merely that main has advanced. Policy changes and candidate contents require review.

```sh
git fetch --no-tags origin +refs/heads/main:refs/remotes/origin/main
node scripts/assert-release-sha.mjs '<exact SHA>'
```

The script makes no network requests. The workflow fetches current main before preflight, after Environment approval, and immediately before deployment. Control scripts stay in a separate checkout of the trusted workflow revision. The candidate is checked out by SHA, tested and built, then exported with `git archive` for a clean source upload. Vercel CLI 59.1.4 uses `--prod --force` to create a fresh deployment even when that SHA was previously deployed. The release explicitly sets public SHA/ref metadata and runtime identity values; cross-check these provenance assertions against the actual checkout/archive and deployment record.

Configure these externally, only on the disposable GitHub `production` Environment:

- Required independent reviewers, prevent self-review, disable admin bypass, and allow deployments only from main.
- Environment secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`. No values are stored here. Do not duplicate them in repository/organization secrets. The built-in read-only GitHub token fetches Git.
- An existing disposable Vercel project, synthetic Preview/Production environment labels, exposed system variables, and public access to fixture identity. No deployment-protection bypass credential is used.

Naming an Environment in YAML does not configure approval rules. GitHub plan/repository settings must support them. Release secrets enter only the deployment step of the gated job. The final policy fetch is not atomic with Vercel's API: revocation after that check is outside this guard's guarantee. Concurrency serializes this workflow's runs; it provides neither exactly-once deployment nor a durable FIFO queue and does not constrain dashboard/other-workflow deployments. Failed post-deployment identity verification does not automatically roll back aliases.

## Identity evidence and external proofs

Download public identity JSON separately, then validate the local file:

```sh
node scripts/verify-identity.mjs identity.json \
  --sha '<exact SHA>' --env production --fixture-env fixture-production
# To prove the complete serving identity is unchanged, also pass:
# --same-as baseline-identity.json
```

The verifier performs no network request. It rejects extra fields, mismatched SHA/environment/marker, and changed baselines, including optional URL presence/value.

Execute [the exact external proof sequence](docs/external-proof-sequence.md) only in a later session authorized for disposable remote resources. It isolates the P-4 introducing merge before steady-state P-3, captures Preview checks and all Production aliases/identities, tests malformed config safely, and covers all nine P-6 assertions. Local tests do not prove remote deployment, approval, alias, status/check, or introducing-merge behavior.

The supplied assertions are explicit in the runbook:

- **P-3:** feature and README-only PRs each produce a Ready Preview with a successful Vercel status/check; their main merges create no Production deployment, move no Production alias/Current target, and leave serving identity unchanged. Record Vercel status/check behavior on each resulting main commit.
- **P-4:** test the main-only Git block while preserving feature Previews, measure whether the introducing merge suppresses its own Production deployment, and record malformed-config behavior on a separate PR that required quality validation prevents from merging.
- **P-6:** release only an approved, unexpired exact main/ancestor commit; reject invalid, floating, missing, non-main, unapproved, revoked, or expired inputs; prove Environment approval/credential isolation, duplicate-run serialization, rollback with the Git block retained, and fresh source releases for previously deployed SHAs even after an old deployment object is deleted. Cross-check checkout, deployment metadata, and runtime identity.

## References

- Branch-specific rules leave unspecified branches enabled: [Vercel Git configuration](https://vercel.com/docs/project-configuration/git-configuration).
- Environment approval gates secret access: [GitHub Environment protection](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments).
- Fresh source deployment flags: [Vercel CLI deploy](https://vercel.com/docs/cli/deploy).

<!-- disposable baseline trigger: 2026-10-01 -->

<!-- fixture project framework preset corrected to Next.js -->

P3 docs-only policy proof marker: 2026-10-01

P3c combined A+F docs-only proof marker: 2026-10-01T19:05Z
