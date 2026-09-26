# Aurora Solar provider baseline — COMPLETE

Recorded from Canonry 5.20.1, commit `ce28687c960cb27f6e173cc56510b33b44a0f0b3` (clean checkout matching origin/main at capture).
Target: **aurorasolar.com**, brand **Aurora Solar**, US / English, no location override.
20 exact queries selected from the repository's B2B SaaS discovery fixture; two name Aurora Solar and 18 are non-brand relative to Aurora Solar. Exact inputs, source indices, model choices, quota settings, and basket hash are in [manifest.json](manifest.json).

## Capture

One pass per provider, using a one-query pilot and then the remaining 19 queries. No application-level repeat sweeps. Existing provider/SDK retries remain unchanged. All runs use `probe` in an isolated local database. No production data, scheduled jobs, or agent wakeups were used. The temporary server has been stopped.

| Provider | Requested model | Saved / expected | Non-empty answers |
|---|---|---|---|
| gemini | `gemini-2.5-flash` | 20/20 | 20 |
| claude | `claude-sonnet-4-6` | 20/20 | 20 |

## Observed signals

Mention = brand/domain appears in answer text. Cited = project domain appears in source evidence. These are baseline observations, not independently judged answer quality or rankings. Branded and non-brand denominators remain separate.

| Provider | Query class | Observations | Mentioned | Cited |
|---|---|---|---|---|
| gemini | non-brand | 18 | 11 | 6 |
| gemini | branded | 2 | 2 | 2 |
| claude | non-brand | 18 | 12 | 0 |
| claude | branded | 2 | 2 | 2 |

## Verification

- CLI/server build succeeded and `/health` commit matched the captured checkout.
- 112 focused tests passed: provider adapters, execution limits/retrieval handling, provider surface/location handling, and probe exclusion. Full workspace CI was not run for this capture.
- Offline replay: 40 saved responses; 0 field mismatches against stored observations. This proves round-trip consistency, not independently labeled correctness.
- No duplicate query/provider observations; raw response bodies and normalized results are retained for later replay.
- Provider keys are outside this artifact directory in an isolated local config with mode 0600. Artifacts are scanned for the supplied keys and the local instance token.

## Files and comparison procedure

- [summary.json](summary.json): terminal statuses, run IDs, expected/actual counts, elapsed times.
- [provenance.json](provenance.json) and [health.json](health.json): git/build/runtime identity, lockfile and built-file hashes.
- [results-export.json](results-export.json): standard Canonry export, including probes.
- [stored-snapshots.json](stored-snapshots.json): saved database observations with raw provider bodies; read-only extraction from the isolated database.
- [replay-fixtures.json](replay-fixtures.json): frozen raw inputs plus baseline expected normalized fields.
- [replay-verification.json](replay-verification.json): baseline replay result.
- [review-observations.json](review-observations.json): answers, sources, signal labels, and unfilled human-review fields.
- [observations.md](observations.md): compact per-query citation + mention table for both providers.
- [quality-summary.json](quality-summary.json): empty answers, source availability, served models, retrieval/capture statuses.
- [test-summary.json](test-summary.json): local checks; detailed test outputs and sanitized run logs are adjacent.

For an after-change capture, use a fresh isolated instance and this exact manifest, retain the before fixtures unchanged, and record the new server commit. Compare deterministic normalized fields against the frozen `expected` objects in `replay-fixtures.json`; live answer differences must be reviewed separately. The archived scripts document how this baseline was captured; their active copies live at repository `.context/capture-baseline.py` and `.context/verify-baseline.mjs`. The replay helper writes output files, so run it against a copy when checking another revision.

## Limits

This is one 20-query pass per provider, not the planned three-repeat stability study. No Codex results exist yet. This captures the Simple portfolio path; Advanced portfolio parity remains a later integration test. Human/source-support review is still pending. `unknown` retrieval status is retained rather than inferred from source counts. Raw responses alone do not preserve the exact future content of third-party pages.
