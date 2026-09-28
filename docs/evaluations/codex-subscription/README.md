# Codex subscription implementation and evaluation

The fork now has a local, explicitly selected `codex` provider alongside the API providers. It reuses the existing CLI subscription login. Start with the [handoff](HANDOFF.md) for implementation details, usage, validation, and limitations.

## Recorded workload

Target: **Aurora Solar / aurorasolar.com**, US / English, no location override. The fixed basket contains 20 repository-supplied query strings: **18 non-brand and 2 branded** relative to Aurora Solar. See [the frozen manifest](before/manifest.json).

| Phase | Provider/model | Requested | Saved | Failed |
|---|---|---:|---:|---:|
| Before | Gemini `gemini-2.5-flash` | 20 | 20 | 0 |
| Before | Claude `claude-sonnet-4-6` | 20 | 20 | 0 |
| After | Gemini `gemini-2.5-flash` | 20 | 20 | 0 |
| After | Claude `claude-sonnet-4-6` | 20 | 20 | 0 |
| After, three passes | Codex `gpt-6-astra` | 60 | 58 | 2 |

Codex completion was **58/60 = 96.7%**, meeting the planned 95% threshold. Two answers were rejected for source links without captured attribution; neither became a “not cited” observation. The first two passes saved 19 each; the third saved all 20. See [run outcomes](after/summary.json) and [evaluation results](after/evaluation.json).

The 40 before-change API responses replayed with zero differences. All 98 after-change saved responses also replayed with zero differences. An independent assistant review covered all 58 saved Codex answers and found zero mention/citation label mismatches. Source relevance/support was reviewed against captured material; this is not an external human audit or exhaustive verification of vendor marketing claims. See [review notes](after/assistant-reviews.json).

The final verbatim-web-program AST guard was added after the 100-attempt workload. All 16 web programs from the five-query pilot pass that guard; adversarial transformed/synthesized-output tests reject it. A separate [final-build smoke query](final-smoke/summary.json) completed successfully through the hardened path. Disconnect was exercised and the CLI remained subscription-authenticated. The full three-pass workload was **not** repeated after this final hardening.

## Observations by query class

These are observed counts, not comparative rankings. Missing observations remain separate from measured negatives.

| Phase/provider | Query class | Measured | Mentioned | Cited | Missing |
|---|---|---:|---:|---:|---:|
| Before Gemini | non-brand | 18 | 11 | 6 | 0 |
| Before Claude | non-brand | 18 | 12 | 0 | 0 |
| After Gemini | non-brand | 18 | 12 | 4 | 0 |
| After Claude | non-brand | 18 | 14 | 1 | 0 |
| Codex, three passes | non-brand | 53 | 37 | 47 | 1 |
| Before Gemini | branded | 2 | 2 | 2 | 0 |
| Before Claude | branded | 2 | 2 | 2 | 0 |
| After Gemini | branded | 2 | 2 | 2 | 0 |
| After Claude | branded | 2 | 2 | 2 | 0 |
| Codex, three passes | branded | 5 | 5 | 5 | 1 |

Live answers naturally varied. Among the 18 queries measured successfully in all three Codex passes, one changed its mention outcome and one changed its citation outcome. The JSON evaluation retains the exact query-level comparison. This variability is distinct from a code regression; deterministic replay is the regression gate.

## Files

- [Before results](before/results-export.json), [before per-query table](before/observations.md), and [before raw snapshots](before/stored-snapshots.json.gz).
- [After results](after/results-export.json), [after observations](after/observations.json), and [after raw snapshots](after/stored-snapshots.json.gz).
- [Five-query pilot manifest](pilot/manifest.json), sanitized pilot event captures, and the recorded protocol schemas under `context/protocol/`.
- Final smoke response, raw snapshot, restored/refreshed/disconnected connection states, and outcome under `final-smoke/`.
- Test/check records under `checks/`; `checks/history/` includes superseded development failures and must not be read as the final status.
- Historical capture/review scripts under `context/scripts/`. These are archived as `.txt`; they assume the original `.context` layout. The portable offline replay command below is the supported replay entry point.
- [Accepted implementation plan](context/accepted-plan.md), [conversation decisions](context/decisions.md), and [original setup screenshot](context/original-setup.png).
- [Artifact inventory](artifact-inventory.json) and `SHA256SUMS` identify the sanitized published copies. Historical checksums refer to original captures and will differ where sanitization changed a file.

## Offline replay

From the repository root, with workspace dependencies installed:

```sh
node --import tsx scripts/replay-codex-evaluation.mjs
```

Expected: `before: 40`, `after: 98`, `final-smoke: 1`, zero mismatches. The script disables network access and does not mutate artifacts. Large raw JSON files are gzip-compressed; normal exports remain readable JSON.

Authentication files, credentials, private runtime instructions, account notifications, encrypted reasoning, retrieved-page bodies, and verbatim source excerpts are excluded. Source headers, reference IDs, and URLs are retained; the original local captures retain the retrieved material used during review. The complete saved answer text, citation evidence, normalized observations, and sanitized provider response bodies are retained. Rejected queries have error records; their discarded full model response bodies were not persisted by the measurement pipeline.

## PR preparation and final acceptance

The [final September 28 capture](final-acceptance/README.md) saved **59/60 (98.3%)** Codex observations with zero reviewed extraction or replay mismatches. The [retained native-redirect regression](redirect-investigation-2026-09-28/README.md) identified and fixed a real false rejection. The expanded offline replay now covers **199 saved observations**, including the separate final release smoke. The original baseline and 58/60 result remain unchanged. Actions is intentionally disabled on this fork; see the [handoff](HANDOFF.md) for local checks and limitations.
