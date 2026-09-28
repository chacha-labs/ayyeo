# Codex subscription implementation and evaluation

Codex is a local, opt-in answer-engine provider. This README covers its implementation, commands, validation and limitations. See the [provider guide](../../providers/codex.md) for setup and [validation-summary.json](validation-summary.json) for recorded check results.

## Behavior and implementation


Codex is a distinct local answer-engine provider, disabled until connected and excluded from implicit provider selection even after connection. Existing API providers and Aero's reasoning backend remain available unchanged. Select Codex explicitly at project, run, or Advanced-plan level.

| Area | Implementation |
|---|---|
| App Server process, isolation, identity, cancellation | `packages/provider-codex/src/runtime.ts` |
| Verified source extraction, including native redirects | `packages/provider-codex/src/evidence.ts` |
| Verbatim web-result program validation | `packages/provider-codex/src/web-provenance.ts` |
| Non-secret connection configuration and registry | `packages/canonry/src/codex-connection.ts` |
| Private, bounded failed-turn storage | `packages/canonry/src/codex-diagnostics.ts` |
| Administrator-only connection routes | `packages/api-routes/src/codex.ts` |
| Public types | `packages/contracts/src/codex.ts`, OpenAPI and generated SDK |
| Dashboard controls | `apps/web/src/components/settings/CodexConnectionForm.tsx` |

`isImplicitProvider` excludes Codex from default run admission, execution, snapshots, and onboarding readiness. Simple and Advanced execution retain their existing scope. `readMarkdownAnswer` excludes hidden link destinations from mention text. The retrieval contract is `codex-web-search-v1`; requested model identity is recorded without fabricating a served model.

Connection routes require instance-administrator authority. Hosted `apps/api` returns unavailable and refuses connection changes. Canonry stores enablement, model selection, quota and an identity fingerprint; Codex owns credentials and refresh. No endpoint accepts tokens, executable paths, or a custom Codex API URL.

| Method | Route under the configured base path | CLI | MCP |
|---|---|---|---|
| GET | `/api/v1/settings/providers/codex/status` | `settings codex status` | `canonry_codex_status` |
| POST | `/api/v1/settings/providers/codex/connect` | `settings codex connect` | `canonry_codex_connect` |
| POST | `/api/v1/settings/providers/codex/refresh` | `settings codex refresh` | `canonry_codex_refresh` |
| POST | `/api/v1/settings/providers/codex/disconnect` | `settings codex disconnect` | `canonry_codex_disconnect` |

## Use and verify

Build/start this checkout's server; an older globally installed binary does not acquire these routes automatically. On the hosting machine:

```sh
codex login
cnry settings codex connect --format json
cnry settings codex status --format json
cnry settings codex refresh --format json
cnry run <project> --provider codex --probe --wait --format json
cnry settings codex disconnect --format json
```

`connect --model <id>` selects a discovered model. First connection pins the default; later connections preserve the pin unless overridden. Disconnect closes Canonry's runtime without logging out the CLI or removing historical observations.

```sh
pnpm exec vitest run --project provider-codex
pnpm exec vitest run --project canonry codex-connection.test.ts codex-surfaces.test.ts codex-diagnostics.test.ts
pnpm exec vitest run --project web codex-connection.test.tsx setup-ai-visibility-onboarding.test.tsx
pnpm check
```

## Limits and follow-up rules


- Supported App Server runtimes: `0.157.1` and `0.158.0`. Evaluate protocol changes with captured fixtures and a bounded live pilot before extending the guard.
- Only verified final-answer citations count. Missing evidence fails explicitly; never weaken validation or substitute mention-only measurement to improve completion rates.
- Identity checks include the workspace account ID when disclosed; older responses fall back to email. An upgrade from an email-only fingerprint requires reconnecting.
- Repository instructions, skills, plugins, MCP tools, shell and image tools are disabled, but global CLI instructions may still be present.
- Failed turns retain owner-only diagnostics under the local config directory's `diagnostics/codex/`, capped at 100 files / 100 MiB. Rejected exec data is separately bounded and never trusted as source evidence. Storage errors do not mask provider failures.
- Defaults: one concurrent query, six logical requests/minute, 100/day, three-minute turn deadline. Subscription allowance is shared; there is no automatic API fallback.
- Changing the prompt or retrieval policy requires a new retrieval contract. Parsing changes need captured regression tests. Keep historical baselines intact and record new live attempts separately, including failures.
- Recheck the published version before landing the PR. Report local validation separately from CI, which remains disabled by request.

## Recorded validation


Target: Aurora Solar (`aurorasolar.com`), US / English, no location override. The basket contains 20 queries: 18 non-brand and two branded. It comes from `seedRawCandidates` in `packages/api-routes/test/fixtures/discovery-replay/b2b-saas.json`, using zero-based indexes `0–11, 14, 17, 18, 20–24`.

| Phase | Provider/model | Requested | Saved |
|---|---|---:|---:|
| Before | Gemini `gemini-2.5-flash` | 20 | 20 |
| Before | Claude `claude-sonnet-4-6` | 20 | 20 |
| After | Gemini `gemini-2.5-flash` | 20 | 20 |
| After | Claude `claude-sonnet-4-6` | 20 | 20 |
| Initial Codex acceptance | `gpt-6-astra`, runtime `0.157.1` | 60 | 58 |
| Final Codex acceptance | `gpt-6-astra`, runtime `0.158.0` | 60 | 59 |

Final completion was **59/60 (98.3%)**, above the 95% gate. The three passes saved 20, 19, and 20 observations. All 60 final answers were reviewed; the 59 saved observations had no observed mention/citation extraction mismatches. An independent audit of the original Markdown also found no visible-mention or final-link-set differences. Review was performed by the assistant, not an external human auditor or an exhaustive fact-check of vendor claims.

| Final query class | Requested | Saved | Missing | Mentioned | Cited |
|---|---:|---:|---:|---:|---:|
| Non-brand | 54 | 53 | 1 | 35 / 53 | 44 / 53 |
| Branded | 6 | 6 | 0 | 6 / 6 | 6 / 6 |

Local verification recorded **328 passing focused tests**, affected provider/CLI/API/web typechecks, CLI/web builds, `pnpm check`, and SDK/plugin/skill drift checks. The full 199-observation archive replayed with zero differences. A signed-in dashboard walkthrough covered connection controls and explicit enrollment; the final compiled-server smoke confirmed disconnect leaves the CLI signed in. Actions remains disabled at the operator's request; no full-workspace CI result is claimed.

## Failure findings

The original two rejected answers were not retained, so their causes cannot be proven. Six diagnostic reruns passed. A subsequent full-basket attempt reproduced an Enact/Solo failure: the parser recognized the old source URL but ignored the redirect destination explicitly reported by the native web tool. The fix accepts only those native redirect aliases. The captured case remains a regression fixture in `packages/provider-codex/test/fixtures/redirect-failure.json`.

The final run's single rejection was **“solar proposal software pricing for enterprise.”** It cited a Solargraf URL whose captured fetch returned 403, with no matching trusted source evidence. That answer and available web outputs were retained separately, without creating a negative observation. The earlier search program/output was not retained in that benchmark build, so this does not establish that the model invented the pricing. Final code additionally retains bounded rejected-exec diagnostics, without treating them as citation evidence.

The final 60-query capture included the redirect fix. Later diagnostic/identity refinements were covered by focused tests and a separate compiled-server smoke. Live acceptance used Simple portfolios; Advanced paths have automated coverage. Live answer variation is separate from software regressions, and these results do not establish consumer ChatGPT equivalence.

## Artifact retention

Bulk query answers, raw captures, protocol dumps, screenshots, historical scripts, logs, and duplicate result exports have been removed from the PR. The complete sanitized archive is preserved locally at `.context/codex-evaluation-archive/`; the original local captures remain intact. The three captured fixtures used by provider tests remain committed.

On the originating workspace only, the archived replay remains available:

```sh
node --import tsx .context/replay-codex-evaluation.mjs .context/codex-evaluation-archive
```

A fresh checkout contains the concise summary and regression fixtures, not the complete benchmark corpus.
