# Final Codex acceptance: September 28, 2026

**59 of 60 requested observations succeeded (98.3%).** The three frozen-basket passes saved 20, 19, and 20 results. This exceeds the 95% completion gate. All 60 final answers were inspected, including the rejected answer; all 59 saved observations agree with the independently recorded mention/citation review. Replay found zero extraction differences or duplicate/mis-scoped observations. A separate audit of all 59 original Markdown answers also found zero differences in visible target mentions or final-link sets; its restricted-format oracle is archived in `audit-pr-raw-answers.mjs.txt`. This is assistant evidence review, not an external human audit or exhaustive fact-check of vendor claims.

| Query class | Requested | Saved | Missing | Mentioned | Cited |
|---|---:|---:|---:|---:|---:|
| Non-brand | 54 | 53 | 1 | 35 / 53 | 44 / 53 |
| Branded | 6 | 6 | 0 | 6 / 6 | 6 / 6 |

Branded and non-brand outcomes remain separate. The comparison-directory query varied from neither signal to mentioned-only; the manual-quoting query varied in mention presence. These are live answer changes, not extraction regressions. The benchmark uses one domain/category and is not a general answer-quality comparison with the OpenAI API or consumer ChatGPT.

## Retained failure

Pass 2 rejected **“solar proposal software pricing for enterprise.”** Its answer cited `https://www.solargraf.com/pricing`, but the captured fetch returned **403 Forbidden** and no matching source existed in the trusted captured evidence. The complete final answer and accepted web outputs are retained in `failed-turns.json` (or its gzip copy); `failure-review.json` records the diagnosis. The rejection did not create a negative observation.

An earlier search action occurred, but its exec program/output was not retained in this benchmark build. Therefore the captures do not establish whether that earlier search contained usable pricing evidence, and we do not label the answer fabricated. Final code now retains rejected exec calls separately, with explicit size limits, to make future capture-policy rejections diagnosable. They remain ineligible as citation evidence.

The native redirect bug reproduced in the interrupted prior attempt was fixed before all three passes here. That [captured regression](../redirect-investigation-2026-09-28/README.md) now passes without relaxing the source requirement. The original September 26 result remains 58/60; this capture does not rewrite it.

## Build and validation scope

- Model: `gpt-6-astra`; App Server: `0.158.0`; release version: `5.29.0`.
- Exact frozen 20-query Aurora Solar basket, no location override, fresh ephemeral conversation per query, concurrency one, explicit Codex selection, probe runs.
- All three runs belong to the intended project. Aggregate visibility stats remained empty because probes are excluded.
- The source parser, fixed prompt, retrieval policy, and mention/citation calculations were unchanged throughout this run. Provenance includes the capture-time commit, dirty-state declaration, source hashes, and build hashes.
- After capture started, final review added diagnostic retention ordering, rejected-exec diagnostics, workspace-aware identity checks, and a saved-model label correction. These changes do not alter measurement extraction. Focused tests and a [separate final compiled-server smoke](../release-smoke/summary.json) verify that build; its one result is separate from this 60-query score. Disconnect preserved CLI subscription authentication.
- Advanced measurement is covered by automated scoped-execution tests. Live acceptance here uses Simple portfolios.
- GitHub Actions remains disabled on the fork at the operator’s explicit request. No full-workspace CI result is claimed.

## Contents

`manifest.json` records the basket, actual project identity, model/runtime, three-pass budget and provenance. The metadata inherited from the original one-pass manifest was corrected after capture; query text and the original baseline were unchanged. `stored-snapshots.json.gz`, per-run results, `observations.json`, `evaluation.json`, and `assistant-reviews.json` preserve saved answers and their evaluation. Raw rejected-answer diagnostics are separate. The archived harness files describe execution and evaluation.

Repository copies retain full final answers, native source attribution lines (including redirects and relevant fetch errors), source IDs/URLs, accepted web programs, normalized results and reviews. Retrieved page bodies are omitted from published copies. Full allowlisted outputs remain in `.context/codex-final-acceptance-20260928T173107Z` on the originating machine. Authentication configuration, tokens, reasoning and private instruction messages are excluded.

From the repository root, `node --import tsx scripts/replay-codex-evaluation.mjs` replays 199 saved observations across the original baseline, earlier acceptance/smoke, this acceptance, and final release smoke, with no network calls.
