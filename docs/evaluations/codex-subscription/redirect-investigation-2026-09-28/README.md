# Reproduced attribution failure: native redirects

The final-build acceptance attempt on September 28 reproduced the Enact/Solo failure. Production failure capture retained the complete final answer and native web outputs before rejection.

The unmatched final-answer URLs were:

- `https://enact.solar/providers/`
- `https://enact.solar/providers/provider-pricing/`

Both destinations were explicitly present in native web-tool attribution metadata. The tool's displayed header used the older URL:

| Source reference | Header URL | Tool-reported redirect destination |
|---|---|---|
| `turn4view1` | `https://enact.solar/installers/` | `https://enact.solar/providers/` |
| `turn4view0` | `https://enact.solar/installers/installer-pricing/` | `https://enact.solar/providers/provider-pricing/` |

The source extractor retained only the header URL and ignored `Redirected to URL: …; Total lines: …` on the native attribution line. The model cited verified destinations, so rejecting this answer was a **false attribution failure caused by the adapter**.

The fix recognizes only redirect destinations explicitly reported on that attribution line. It does not trust webpage body text, same-host guesses, or arbitrary URL normalization. The exact retained answer now replays successfully, with five verified cited URLs and domains `enact.solar` and `gosolo.io`. It neither mentions nor cites the Aurora Solar target. Tests cover this captured failure, forged redirects in page text, unreported URL variants, and conflicting redirect destinations. The original 139-observation corpus still replays without differences.

The earlier six diagnostic reruns did not encounter these redirect-only URLs and all passed. This new reproduction explains a real failure mode on the same Enact/Solo query. **It cannot prove the cause of either original September 26 failure**, because those original bodies were not saved.

The interrupted pre-fix acceptance attempt saved 14 successful observations and two diagnostic records: the reproduced attribution failure and an interrupted in-flight turn. It was deliberately stopped for this fix and is not an acceptance score. Original files remain under `.context/codex-final-acceptance-20260928T171823Z`. A fresh 60-query run uses the corrected parser; its outcome is recorded separately.

`retained-failure.json.gz` preserves the full answer, accepted web programs and native source attribution lines, including redirects. Retrieved page bodies are omitted from the repository copy; full allowlisted outputs remain in the local capture. The same fixture is tested in `packages/provider-codex/test/fixtures/redirect-failure.json`.
