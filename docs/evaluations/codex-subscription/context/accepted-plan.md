# Add Codex subscription access alongside API providers

## Summary

Add **Codex — subscription** as a distinct, opt-in provider for local Canonry. Reuse the existing Codex CLI login; retain OpenAI, Gemini, Claude, and other API providers.

The installed CLI is version `0.144.5` and reports subscription authentication. The completed Aurora Solar baseline contains 40 full Gemini/Claude results and replay fixtures.

## SHOWCASE — implementation

1. **Validate source evidence first.**
   Use the official Codex App Server over stdio and capture five pilot queries from the frozen basket. Verify that final answers and their cited sources can be recovered reliably. Search activity alone does not establish a citation. If source attribution cannot be recovered, keep measurement disabled and report the blocker; do not manufacture citations or silently substitute mention-only measurement. [App Server documentation](https://learn.chatgpt.com/docs/app-server)

2. **Connect the existing CLI session.**
   Add “Connect existing Codex” and “Disconnect” controls. Connect verifies subscription authentication and saves non-secret provider configuration. Codex continues owning credentials and token refresh. Disconnect disables Canonry’s connection without calling Codex logout. Missing CLI, signed-out, API-key authentication, and changed-account states produce actionable errors; account changes require reconnecting.

3. **Add the provider and controlled execution.**
   Implement a `codex` adapter and a managed App Server process. Resolve the available default model on connection and persist its explicit ID. Each query uses a fresh ephemeral conversation with live web search, a fixed versioned prompt, and the requested location context. Prevent inherited repository instructions, skills, MCP servers, shell execution, and file access from affecting measurement. Start with concurrency one, bounded deadlines, cancellation, and shutdown cleanup. Preserve quota errors; never fall back automatically to an API provider.

4. **Integrate all product surfaces.**
   Add typed status, connect, refresh, and disconnect API operations, matching CLI commands and MCP tools, and dashboard controls in Settings and AI Visibility setup. Connection management requires instance-administrator authority. Regenerate SDK types and expose safe connection/model metadata through existing provider catalogs. Hosted deployments report Codex unavailable. Existing API routes and API-key forms remain compatible.

5. **Preserve measurement behavior.**
   Require explicit Codex selection at project, run, or Advanced-plan level. Connecting it must not expand existing “all configured providers” runs or schedules. Support Simple and Advanced execution, including Property, Target, market, query class, and location. Persist final answer text, source evidence, search activity, requested/reported model identity, retrieval policy, and sanitized replay data. Use the existing independent mention and citation calculations. Missing evidence is an explicit failure, not a successful “not cited” result.

## SHOWCASE — verification and evaluation

6. **Automated verification.**
   Test runtime protocol handling, authentication states, account changes, duplicate events, interrupted streams, timeouts, cancellation, rate limits, and process cleanup. Test exact mention/citation outcomes and source attribution with captured fixtures. Exercise real API/CLI/MCP transport boundaries and both portfolio paths. Verify probe exclusion, explicit enrollment, model selection, and operation without Codex installed.

7. **Regression comparison.**
   Preserve the existing baseline unchanged. Replay all 40 Gemini/Claude responses against the modified code and require zero unexplained differences. Rerun the 112 existing focused checks plus new tests, affected typechecks, `pnpm check`, and affected builds. CI owns full workspace validation and generated-file drift checks.

8. **Live acceptance.**
   After the evidence pilot passes, capture three Codex passes of the same 20-query basket and one after-change pass each for Gemini and Claude. Review all 60 Codex answers for extraction accuracy and source support. Require zero observed extraction mismatches, traceable evidence for every counted citation, no duplicate or mis-scoped observations, and at least 95% successful completion under available quota. Report live answer variation separately from software regressions.

## Assumptions and release conditions

- Local Canonry only; reuse CLI login only. No embedded OAuth flow, automatic CLI installation, or token copying.
- This adds an answer-engine provider; changing Aero’s reasoning backend is outside this implementation.
- Results are labeled **Codex**, without implying consumer ChatGPT equivalence.
- Keep the feature opt-in until evidence and regression gates pass. Disabling it preserves historical observations.
- Update provider/setup/API/CLI/MCP documentation and apply the repository’s minor-version release policy.
