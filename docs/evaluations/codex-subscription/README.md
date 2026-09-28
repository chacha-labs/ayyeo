# Codex subscription evaluation summary

The implementation adds a local, opt-in Codex answer engine. See the [handoff](HANDOFF.md) for implementation and follow-up guidance, the [provider guide](../../providers/codex.md) for setup, and [validation-summary.json](validation-summary.json) for recorded check results.

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
