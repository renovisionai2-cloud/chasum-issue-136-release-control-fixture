# Issue #136: external P-3 / P-4 / P-6 proof sequence

This is a future execution runbook for the already-supplied exact P-3/P-4/P-6 criteria, not evidence that the platform assertions passed. **External hosted proofs: NOT RUN.** This documentation-only session must not create a repository/project, push, deploy, or change remote settings. Execute this sequence only in a later session authorized to operate a **new disposable GitHub repository and disposable Vercel project**. Never use Chasum/GVM secrets, real Production/Staging resources, or the application repository, project, domains, credentials, or configuration. The synthetic fixture app calls no external APIs and contains no cron code. Production/Preview labels and future operator GitHub/Vercel API commands below apply only to the disposable fixture. P-5 and cron are out of scope.

The authoritative fixture is the Next.js app in `app/page.tsx` with identity route `app/api/identity/route.ts`, quality workflow `.github/workflows/fixture-quality.yml`, and manual release workflow `.github/workflows/release-production.yml`. Its packages pin Next.js **16.3.6** and React/React DOM **19.2.4**; `npm run build` produces `.next/`.

The Program Lead has already reported local validation performed outside this documentation-only session: **validate config PASS; 34 tests PASS; Next build PASS**. This records that earlier validation result, not a newly executed suite or its current test count. Hosted deployment, approval, alias, status/check, and introducing-merge assertions remain unproven.

Run P-4's introducing merge first, then P-3 with the resulting block already active, then P-6. This isolates the introducing-merge question without requiring a second project. If P-3 is intended to evaluate a different Production Git-source control, use a separate disposable project and record the exact setting; do not conflate controls.

## 1. Establish a clean baseline

1. Before any later authorized deployment, check current Next.js release guidance and update the pinned version if required, regenerating the lockfile. Re-run `npm ci`, `npm test`, `npm run build`, and `npm run validate:config` on the completed fixture. Save command exit codes and logs. The stored malformed sample is expected to be rejected; it must not replace active `vercel.json` here. [Next.js release announcements](https://nextjs.org/blog).
2. Create/import only the disposable repository/project after obtaining that later authorization. Use `main` as GitHub default branch and Vercel Production branch; use the repository root and the Next.js framework preset. Commit only this fixture's tracked sources and lockfile. Keep the initial `vercel.json` with no Git deployment rule.
3. Retain Git integration and automatic Preview deployments. Use only generated disposable `vercel.app` domains. Set the nonsecret synthetic `FIXTURE_ENV_NAME` to `fixture-production` for Production and `fixture-preview` for Preview. Enable Vercel system environment variables. Allow public identity GETs on this disposable project so the workflow can verify without a bypass secret. Do not add provider configuration or application secrets.
4. Disable project-level deployment/build skipping that would omit a README-only change, including “Skip unaffected projects” if present. Record its availability and setting. Keep the Ignored Build Step unset. If a docs-only commit is skipped despite this, P-3's docs-only Preview assertion has failed or remains unresolved; a skipped check is not a successful Preview deployment. [Vercel project settings](https://vercel.com/docs/project-configuration/project-settings), [monorepo skipping](https://vercel.com/docs/monorepos).
5. Leave Production domain auto-assignment enabled. Turning only that setting off creates staged Production deployments and cannot satisfy “NO Production deployment.” [Vercel promotion behavior](https://vercel.com/docs/deployments/promoting-a-deployment).
6. Wait for baseline Git deployment `D0` to become Ready and Current. Record its full Git SHA `B0`, immutable deployment URL, deployment ID, target, source, timestamps, all Production aliases, and `/api/identity` from every serving Production alias and the immutable URL. The identity must identify marker `chasum-issue-136-disposable`, `production`, `B0`, `main`, and `fixture-production`.
7. Record the repository/project identifiers, commit SHA of the workflow and guard, Node/npm/Vercel CLI versions, project settings, and UTC start time. Do not record secret values. Use a scratch evidence directory outside the Git checkout.

Git normally creates Previews for branches and Production deployments for merges to the Production branch; this baseline verifies the integration is functioning before testing suppression. [Vercel Git integration](https://vercel.com/docs/git).

## 2. Capture comparable evidence

Use the authenticated GitHub CLI and an externally provided, disposable-project Vercel token in the operator's environment. Never paste tokens into this document or commit them. These commands are read-only. Replace only the nonsecret placeholders; `VERCEL_TOKEN` must already be injected securely. If the project belongs to a personal account, omit the `teamId` query parameter rather than substituting a project ID.

```bash
set -euo pipefail
export PROOF_REPO='OWNER/DISPOSABLE_REPO'
export PROOF_PROJECT_ID='prj_DISPOSABLE'
export PROOF_TEAM_ID='team_DISPOSABLE'
export PROOF_DIR='/tmp/issue-136-disposable-evidence'
mkdir -p "$PROOF_DIR"

github_evidence() {
  local proof_sha="$1" proof_label="$2"
  gh api "repos/$PROOF_REPO/commits/$proof_sha/status?per_page=100" \
    > "$PROOF_DIR/$proof_label-combined-status.json"
  gh api --paginate --slurp \
    "repos/$PROOF_REPO/commits/$proof_sha/statuses?per_page=100" \
    | jq 'add' > "$PROOF_DIR/$proof_label-status-history.json"
  gh api --paginate --slurp \
    "repos/$PROOF_REPO/commits/$proof_sha/check-runs?filter=all&per_page=100" \
    | jq '[.[].check_runs[] | {id,name,head_sha,status,conclusion,started_at,completed_at,details_url,app:{slug:.app.slug}}]' \
    > "$PROOF_DIR/$proof_label-check-runs.json"
}

vercel_evidence() {
  local proof_label="$1"
  date -u '+%Y-%m-%dT%H:%M:%SZ' > "$PROOF_DIR/$proof_label-time.txt"
  curl --fail --silent --show-error \
    -H "Authorization: Bearer $VERCEL_TOKEN" \
    "https://api.vercel.com/v7/deployments?projectId=$PROOF_PROJECT_ID&teamId=$PROOF_TEAM_ID&limit=100" \
    | jq '{deployments:[.deployments[] | {uid,id,url,target,source,created,createdAt,state,readyState,meta:{githubCommitSha:.meta.githubCommitSha,githubCommitRef:.meta.githubCommitRef,fixtureReleaseRun:.meta.fixtureReleaseRun}}],pagination}' \
    > "$PROOF_DIR/$proof_label-deployments.json"
  curl --fail --silent --show-error \
    -H "Authorization: Bearer $VERCEL_TOKEN" \
    "https://api.vercel.com/v4/aliases?projectId=$PROOF_PROJECT_ID&teamId=$PROOF_TEAM_ID&limit=100" \
    | jq '{aliases:[.aliases[] | {alias,deploymentId,deployment:{id:.deployment.id,url:.deployment.url},redirect,updatedAt}],pagination}' \
    > "$PROOF_DIR/$proof_label-aliases.json"
  jq -e '.pagination.next == null' "$PROOF_DIR/$proof_label-deployments.json"
  jq -e '.pagination.next == null' "$PROOF_DIR/$proof_label-aliases.json"
}

# Repeat for every Production alias and for the immutable deployment URL.
curl --fail --silent --show-error -H 'Cache-Control: no-cache' \
  'https://DISPOSABLE_ALIAS.vercel.app/api/identity' \
  | jq -S . > "$PROOF_DIR/baseline-identity.json"

node scripts/verify-identity.mjs "$PROOF_DIR/baseline-identity.json" \
  --sha "$B0" --env production --fixture-env fixture-production

# After saving a later identity response for that same alias:
node scripts/verify-identity.mjs "$PROOF_DIR/after-identity.json" \
  --sha "$B0" --env production --fixture-env fixture-production \
  --same-as "$PROOF_DIR/baseline-identity.json"
```

Run with shell `pipefail` enabled and stop on an HTTP/JSON error. The alias projection deliberately omits protection-bypass material. If either pagination assertion fails, retrieve subsequent pages using `until=<pagination.next>` until `next` is null; keep and compare **all** pages. Empty, unauthorized, truncated, or failed responses are not absence evidence. [Deployment listing API](https://vercel.com/docs/rest-api/deployments/list-deployments), [alias listing API](https://vercel.com/docs/rest-api/aliases/list-aliases).

At every named “snapshot” below, run `vercel_evidence LABEL`, record the Current deployment shown by the dashboard, and fetch identity at every Production alias. Record which aliases are Production aliases at baseline; feature-branch aliases may legitimately change. Compare the complete Production alias-to-deployment map, not just hostname strings or one domain.

For each PR, record its head SHA **before merging**, then query that exact SHA with `github_evidence`. After merging, obtain the resulting main SHA with:

```bash
gh pr view PR_NUMBER --repo "$PROOF_REPO" \
  --json number,url,headRefOid,mergeCommit,mergedAt
```

Query `mergeCommit.oid` separately. Do not substitute the PR head SHA or GitHub's synthetic PR merge ref. Inspect both legacy statuses and check runs, identify the Vercel publisher/context, and record exact context/name, conclusion/state, URL and timestamp. A combined `pending` state with no statuses does not itself mean Vercel posted a pending status. [GitHub status semantics](https://docs.github.com/en/rest/commits/statuses), [check-run API](https://docs.github.com/en/rest/checks/runs).

For every no-Production assertion, snapshot immediately before the merge and at approximately 30, 60, 120, 300, and 600 seconds afterward. Finish after Preview/quality checks have settled and any observed baseline queue latency has elapsed; extend the window if necessary. Record the actual UTC interval. Inspect every Production deployment state, including queued, building, blocked, canceled, and errored. A created-but-canceled Production deployment fails “NO Production deployment.” A finite observation window is evidence for that interval, not a guarantee about all future time.

## 3. P-4: the introducing merge and malformed branch

Required assertions (all currently **NOT RUN** externally):

- Apply only `git.deploymentEnabled.main=false`; feature branches must still produce Ready Previews and successful Vercel statuses/checks.
- Observe the merge that first introduces the rule separately: determine whether that exact main commit creates any Production deployment, and record all alias/identity effects. Later suppression cannot establish self-suppression.
- Observe malformed active configuration only on an isolated branch/PR; record the actual parser/schema failure and Vercel status/check, comment, deployment/error, or absence thereof.
- Require configuration validation through the `Fixture quality` check so the malformed PR cannot merge; keep main valid and Production aliases/identity unchanged.

1. Confirm there is no existing Git-source block in the baseline project or `main` configuration. Capture snapshot `p4-before` and the exact baseline active `vercel.json`.
2. From current `origin/main`, create branch `proof/p4-introduce-main-block`. Copy `fixtures/vercel-main-disabled.json` to `vercel.json`. Commit only that config change, push the branch, and open a PR targeting `main`.
3. Require fixture quality to pass and record a real Ready Preview for the PR head, its successful Vercel status/check, and identity showing `preview`, the exact head SHA, the feature branch, and `fixture-preview`. This also checks that unspecified feature branches remain enabled.
4. Merge the PR normally. Record introducing main commit `M4`, merge time, both parents when applicable, and the `vercel.json` blob at `M4`. Do not deploy/redeploy manually or modify project settings during the observation window.
5. Take the timed snapshots and `github_evidence "$M4" p4-introducing-main`. Determine empirically whether `M4` creates a Production deployment. If it does, record ID/state/source/SHA and any alias/identity change: self-suppression **failed**, even if later merges are suppressed. If none is created, record self-suppression **passed within the observed interval**. Do not infer this timing result from documentation. The documented rule disables matching branches and leaves unspecified branches enabled. [Vercel Git configuration](https://vercel.com/docs/project-configuration/git-configuration).
6. After the introducing event has fully settled, capture the new stable Production baseline `D_STABLE`. It may still be `D0`; if self-suppression failed, record the actual Current deployment instead. P-3 must compare against this stable baseline, not conceal the P-4 outcome.
7. From the now-blocked `main`, create `proof/p4-malformed`; copy `fixtures/vercel-malformed.json` to active `vercel.json` **only on this branch**. Run `npm run validate:config` and record its expected nonzero exit. Push and open a PR targeting `main` to observe Vercel's behavior safely.
8. Record fixture-quality validation failure, parser/schema error, Vercel status/check/comment or absence thereof, and any Preview deployment/error. Verify main remains valid and Production aliases/identity unchanged. Record actual malformed-config behavior; do not assume a particular error text or status exists.
9. Require the `Fixture quality` check from `.github/workflows/fixture-quality.yml` (job ID `quality`; confirm its actual displayed name). Show that this malformed PR is blocked from merging. Do not bypass the check or merge it. Close the PR. Never activate the malformed sample on `main` or pass it to the release workflow.

## 4. P-3: steady-state feature and docs-only proofs

Keep the verified `main: false` rule active. Do not disable all Git deployments; Preview must remain available.

Required assertions (all currently **NOT RUN** externally):

- A feature PR produces a Ready Preview and a successful Vercel status/check on its exact head SHA, with matching Preview identity.
- Merging that feature PR creates **NO Production deployment**, including queued, canceled, blocked, or errored deployments.
- Every Production alias target and the dashboard Current deployment remain at the stable baseline.
- The complete serving identity at every Production alias remains unchanged from its baseline.
- Record the exact Vercel status/check on each resulting main merge SHA, including an explicit absence when neither status nor check-run APIs contain a Vercel entry.
- A README-only PR also produces an actual Ready Preview and a successful Vercel status/check; a skipped/canceled build does not pass.
- Merging the README-only PR also creates no Production deployment and preserves all Production alias/Current targets and serving identities.

1. Capture snapshot `p3-feature-before` against `D_STABLE`. Create `proof/p3-feature` from current `main` and change a harmless visible string in `app/page.tsx`. Commit, push, and open its PR to `main`.
2. Save PR-head status/check evidence and the Preview deployment ID/URL. Require both a Ready Preview and a successful Vercel status/check on that exact head. Fetch Preview identity and compare exact SHA, `preview`, branch, and `fixture-preview`.
3. Merge and record resulting main SHA `M3_FEATURE`. Take all timed post-merge snapshots and capture its legacy statuses and check runs. Pass only if no new Production deployment was created, every Production alias still maps to `D_STABLE`, the dashboard Current deployment remains `D_STABLE`, and every Production identity remains identical to its baseline.
4. Repeat from updated main using `proof/p3-docs-only`, changing only `README.md`. Save `git diff --name-only origin/main...HEAD` before merge to prove docs-only scope. Require an actual Ready Preview and a successful Vercel status/check for the docs PR head; do not count a skipped/canceled build as a pass.
5. Merge and record `M3_DOCS`; repeat all snapshots and comparisons. Report the exact Vercel status/check, if any, for **each resulting main commit**, including an explicit “none observed” when both APIs contain no Vercel entry. Fixture-quality success alone is not Vercel success.

Report P-3.1 through P-3.7 independently. A Preview pass does not prove main suppression, unchanged identity does not prove no new deployment, and unchanged aliases do not prove unchanged alias targets.

## 5. P-6 prerequisites: approval and policy

Required assertions across sections 5–8 (all currently **NOT RUN** externally):

- Release through manual `workflow_dispatch` on main with a required full 40-character SHA; actual checkout/archive, deployment metadata, and runtime identity must match that exact approved commit.
- Reject floating refs, malformed/missing/non-commit SHAs, and commits outside fetched main's ancestry; an existing approved ancestor is eligible.
- Reject unapproved, revoked, and expired candidates using policy from freshly fetched main, including revocation during the Environment approval wait.
- Retain `contents: read`, the main-ref restriction, and `production-release` concurrency with `cancel-in-progress: false`; duplicate deployment intervals must not overlap or cancel an active release.
- Allow an explicitly approved older ancestor to roll back by a fresh source release; keep the Production Git-source block active and recheck merge suppression afterward.
- A previously deployed approved SHA can be released again as a fresh deployment; record new deployment IDs rather than assuming exactly-once behavior.
- Prove the `production` Environment approval gate: independent reviewers, prevented self-review, no administrator bypass, main-only deployments, and Environment-scoped release credentials unavailable before approval. An unauthorized operator cannot proceed to the credential-bearing step.
- Record deleted deployment-object behavior separately from source availability: a deleted object cannot supply rollback/reuse evidence, while its still-valid approved Git SHA can produce a new deployment. Missing/non-main Git objects must still be rejected.
- Record Ready Production, Current/alias targets, and exact runtime identity for successful releases and rollbacks; record no deployment or alias change for rejected or unapproved runs. Self-reported SHA values alone do not prove source provenance.

1. Keep the Production Git-source block active. Confirm release is manual `workflow_dispatch`, requires `sha`, checks out exact SHA, has only `contents: read`, and uses concurrency group `production-release` with `cancel-in-progress: false`.
2. Configure GitHub Environment **production** with required independent reviewers, prevent self-review, disable administrator bypass, and allow deployments only from the branch `main` (not a similarly named tag). Verify the repository/plan supports required reviewers; otherwise P-6.7 cannot be claimed. Put only `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` in this Environment. Do not duplicate them as repository/organization secrets accessible to this repository. Record names/settings, never values.
3. Protect `main` and review changes to the release workflow, guard, lockfile/build scripts, and `release/candidates.json`. Environment review must include the actual candidate source: an approved candidate can execute build scripts after approval. The policy file and workflow are trusted control code, not an independent external authorization service.
4. Select an existing full SHA `R1` already merged to main and containing the completed fixture and valid block. In a separate reviewed PR, add its policy entry `{ "sha": "<R1>", "status": "approved", "expiresAt": "<future UTC ISO timestamp>" }` to `release/candidates.json`; retain `version: 1`. Merge the policy PR. A later policy commit can approve an older ancestor; a commit cannot contain its own hash in its own content.
5. Fetch fresh main and independently confirm `git cat-file -t "$R1"` is `commit` and `git merge-base --is-ancestor "$R1" origin/main` succeeds. Record current main/policy SHA, candidate SHA, expiry, and review link. The guard reads policy from fetched main, not from the candidate checkout. “Stale” here means expired authorization; an older approved ancestor remains intentionally usable for rollback.

GitHub Environment protection prevents the gated job from starting and accessing Environment secrets before approval. This requires external settings; `environment: production` in YAML alone does not install required reviewers. [GitHub environment protection](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments), [deployment review](https://docs.github.com/en/actions/how-tos/managing-workflow-runs-and-deployments/managing-deployments/reviewing-deployments).

## 6. P-6 negative cases and credential gate

Dispatch from workflow ref `main`; substitute one test value at a time:

```bash
gh workflow run release-production.yml --repo "$PROOF_REPO" --ref main \
  -f sha='EXACT_TEST_VALUE'
```

Record the run URL/ID, supplied input, guard error, job states and skipped deployment step, plus before/after Production snapshots for every case:

1. Floating ref `main`: reject.
2. Malformed input `not-a-sha`, a 39-character hex string, and a 41-character hex string: reject. Do not trim or resolve these as refs.
3. Forty hex characters that do not identify a commit in the disposable repository (confirm absence first): reject.
4. A real commit on a new unmerged disposable feature branch: reject because it is not on/ancestor-equal to main. An extant tag alone is not membership in main.
5. A main ancestor absent from policy: reject as unapproved.
6. A main ancestor with a reviewed policy entry `status: "revoked"`: reject. Then separately test an approved entry whose `expiresAt` is in the past: reject as stale. Use separate reviewed policy changes/candidates so the failure reason is unambiguous.
7. For an approved candidate, dispatch as an operator who can start workflows but is not an Environment reviewer. Confirm the production job waits for approval, deployment steps have not started, and no new deployment/alias change exists. Capture the blocked self-review/review UI. Do not echo or probe secret values. Reject the Environment deployment and verify no credential-bearing step ran. A user without workflow-dispatch permission may simply be denied earlier; record that as a different access-control result.
8. Dispatch an approved candidate, leave it waiting, merge a policy revocation, then have an independent reviewer approve the waiting run. The post-approval refreshed-policy guard must reject it before the Vercel credential step. Repeat using expiry during the wait if desired. This proves approval of a run does not freeze a stale policy snapshot.
9. Dispatch the unchanged release workflow from a feature branch: the workflow's ref guard/environment branch restriction must stop deployment. Do not edit a branch workflow to exfiltrate credentials.

Do not approve negative runs merely to work around an unexpected preflight outcome. Stop and diagnose any deployment attempt for a negative case. A failed credential-free guard and a withheld Environment approval are distinct proof points.

## 7. P-6 exact release and duplicate runs

1. Restore a reviewed, unexpired approval for `R1`, capture a baseline, and dispatch the workflow from `main` with `sha="$R1"`. Record the workflow definition SHA separately from the candidate SHA.
2. An independent reviewer verifies input, current policy, source diff, and target disposable project, then approves the Environment. Confirm checkout HEAD, guard output, deployment metadata, and runtime `/api/identity` all identify the same exact 40-character `R1`. Confirm Production target, `fixture-production`, Ready state, Current deployment, and alias targets. A synthetic runtime SHA alone is insufficient: cross-check actual checkout and provider metadata.
3. Save the workflow log/summary and immutable deployment ID/URL. The workflow uses pinned Vercel CLI `59.1.4`, uploads source from the exact checkout, and forces a fresh build; it does not rely on an old Preview artifact. It sets SHA/ref metadata and runtime identity explicitly; verify those values against checkout HEAD rather than treating self-reported metadata as independent attestation. [Vercel deploy flags](https://vercel.com/docs/cli/deploy).
4. Dispatch two runs for the same approved `R1` close together while the first remains active. Approve only after inspecting each run. Record run/job start/end times and deployment IDs. Require credential-bearing deployment intervals to be nonoverlapping and the running release not to be canceled by the second run. Both completed runs may create separate fresh deployments of the same SHA; serialization is not exactly-once execution.
5. Optionally dispatch a third duplicate while one is running and one pending; record pending replacement/cancellation. With default concurrency queuing, `cancel-in-progress: false` protects the running job but does not promise that every pending request survives or that dispatch order is preserved. Out-of-band dashboard/CLI deployments are not covered by this repository concurrency group. [GitHub concurrency semantics](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency).

## 8. P-6 rollback and previously deployed/deleted objects

1. Choose older main ancestor `R0` that contains a valid fixture and the main-disabled rule. Approve it explicitly in current policy with a future expiry. Release `R0` using the same exact-SHA workflow and independent Environment approval while Git Production source remains blocked. Verify a fresh Ready Production deployment, aliases/Current pointing to it, and runtime identity equal to `R0`. This is an authorized source rollback.
2. To prove the block remains intact after that rollback, merge another harmless fixture-only PR and repeat the P-3 post-merge observation. Its Preview should work, while the Current Production deployment and identity remain the authorized rollback.
3. If testing Vercel's separate Instant Rollback feature, use a retained eligible earlier Production deployment through the disposable project's rollback UI, record success or the exact eligibility/plan error, then compare aliases and identity. This dashboard operation is outside the GitHub Environment gate and concurrency group; it is not evidence that the workflow gate controlled it. [Vercel Instant Rollback](https://vercel.com/docs/instant-rollback).
4. Record an older, **noncurrent** deployment `D_OLD` for a previously released approved SHA. Inspect it before any deletion, then, only with explicit authorization for this destructive disposable-object test, delete that deployment in the disposable dashboard. Do not delete the repository commit or Current deployment.
5. Query `GET /v13/deployments/D_OLD?teamId=...` or inspect the exact deployment ID; retain only HTTP status and error code/message to document not-found/deleted behavior. Record any failed rollback/reuse attempt without switching to another deployment silently. A deleted deployment cannot be instant-rolled back. [Vercel deployment deletion](https://vercel.com/docs/deployments/managing-deployments).
6. Fetch main and revalidate that the source SHA still exists, remains an ancestor, and is currently approved/unexpired. Dispatch that same SHA again. Require a new deployment ID, Ready Production, exact identity, and correct alias targets. `--force` requests a new deployment without build-cache reuse; no existing deployment is required for source release.
7. Separately distinguish a missing Git object or SHA no longer reachable from main: the guard must reject it even if a deployment for that SHA once existed. Use the missing/unmerged negative cases above; do not rewrite protected main just to simulate deletion. Deleting a branch does not delete a commit already reachable from main.

## 9. Report the results without filling in assumptions

For P-3.1–P-3.7, P-4.1–P-4.4 and P-6.1–P-6.9, record PASS / FAIL / NOT RUN, exact commit/run/deployment IDs, UTC observation interval, and evidence filenames/links. Keep introducing PR head, introducing merge, feature PR head, feature merge, docs PR head, docs merge, workflow-definition SHA, policy SHA, and release-candidate SHA distinct.

Include the observed status/check on each main merge, all alias-target comparisons, the stable serving identity, any skipped docs Preview, and any missing Environment plan feature. Describe revoked-policy timing as the guard's last fetched snapshot; a policy change after the final check is not atomically coupled to Vercel's deploy API. Do not claim local tests prove remote Git integration, approval isolation, alias behavior, or self-suppression. Do not post the report to an issue or send messages without separate authorization.
