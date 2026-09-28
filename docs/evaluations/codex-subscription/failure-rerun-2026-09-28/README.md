# Investigation of the two Codex attribution failures

On September 28, 2026, both originally rejected queries were rerun three times each. **All six new attempts passed the unchanged citation validator.** This does not explain the original failures or prove that they were harmless: their original answer bodies were not retained.

| Query | Original failure | New diagnostic attempts | Result |
|---|---|---|---|
| Enact Systems vs Solo for solar proposals (q16) | Pass 1: source link without captured attribution | Three | 3/3 accepted |
| Aurora Solar vs EnergyLink for residential solar (q15) | Pass 2: source link without captured attribution | Three | 3/3 accepted |

Across the six final answers, all **33 link occurrences** matched captured web-source URLs (30 unique cited sources when deduplicated within each answer). No unresolved citation references or rejected web programs occurred. These counts describe attribution, not the factual accuracy of the answers. All final answers use Markdown links, with no special citation reference markers.

## What this establishes

- Neither query fails consistently in the new environment. The exact original attribution error was not reproduced.
- The new captures contain final answers, native web-tool programs/results, captured source headers and URLs, URL-match diagnostics, errors if any, and normalized results. Events were written to disk before normalization, so a validation exception cannot erase the diagnostic answer.
- The original error means at least one final-answer URL did not match a URL extracted from captured source headers. Without the original answer and tool evidence, we cannot tell whether this was an ungrounded model link, a URL variant, a missing capture, or a parser limitation.
- The confirmed implementation gap was failure retention: the old adapter threw before returning raw evidence to snapshot storage. This investigation fixes capture in its diagnostic harness; it does **not** add a persistent failed-attempt store to production.
- The original benchmark remains **58/60 (96.7%)**. These six attempts are separate diagnostic evidence, not replacements or retroactive successes.

## Runtime difference and scope

The installed CLI/App Server is now **0.158.0**; the original benchmark used **0.157.1**. The production adapter correctly rejected the new runtime before any model query. The production version guard has **not** been changed.

For the bounded diagnostic pilot, a copy of the production runtime changed only the accepted version string and relocated imports. The exact changes are in `runtime-adaptation.patch.gz`. All prompts, location handling, isolation settings, deadlines, source extraction and the final provenance guard remained the same. The model stayed **gpt-6-astra**, with the original query text and no location override. No API fallback was used and no project observations were written.

Before the pilot, locally generated protocol schemas were compared. The `custom_tool_call` and `custom_tool_call_output` variants used by this integration are unchanged; other protocol areas gained or changed fields. Six successful calls are not a complete compatibility certification. The original 60-query run also predates the final provenance hardening, which was active for all these reruns. Therefore these results cannot isolate model variation from runtime or adapter changes.

## Captures and reproduction

`summary.json` lists all six outcomes. Each `pass-N/` directory contains the manifest, per-query diagnostic JSON, and event journal. Diagnostic and event files are gzip-compressed.

The final answers, source headers/URLs/reference IDs, tool programs, link comparisons, and normalized results are retained in the repository. Retrieved-page bodies are omitted from the published copies; the full allowlisted event journals and outputs remain in the corresponding local `.context/codex-failure-rerun-*` directories. Authentication responses, tokens, reasoning, and private instruction messages were never captured by this harness.

The archived `capture-script.mjs.txt` records the exact harness. To reproduce, restore it to `.context/rerun-codex-failures.mjs`, copy the runtime at commit `bd0a3f9b` to `.context/diagnostic-runtime-0.158.0.ts` using the included gzip-compressed adaptation, and run `node --import tsx .context/rerun-codex-failures.mjs`. Each invocation sends exactly two queries and writes a new timestamped directory. Recheck runtime compatibility first; do not use this pilot as a reason to bypass the production guard.

The local initial version-check failure is separately retained at `.context/codex-failure-rerun-2026-09-28T17-01-59-925Z/fatal.json`; it made no model request.

## Next diagnostic requirement

A future full benchmark should use pre-validation capture for **every** attempt. If an unmatched link recurs, preserve its exact URL, captured alternatives, relevant tool outputs and final answer. Determine whether a narrowly defined URL-normalization fix is warranted from that evidence; do not relax citation validation merely to raise completion rates.
