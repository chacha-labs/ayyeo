# Codex subscription provider

Local Canonry can use the existing Codex CLI subscription session alongside its API providers. Results identify the provider as `codex`, not consumer ChatGPT or the OpenAI API. It does not change Aero's reasoning backend.

## Connect and select

```sh
codex login
cnry settings codex connect --format json
cnry settings codex status --format json
cnry settings codex refresh --format json
cnry run my-project --provider codex --probe --wait --format json
cnry settings codex disconnect --format json
```

`connect --model <id>` chooses an available model explicitly. The first connection pins the runtime's discovered default; reconnect preserves the selected model unless overridden. Project and Advanced-plan model overrides remain supported. Settings and AI Visibility setup expose the same connection controls. Select Codex in project engine settings, an explicit run request, or an Advanced plan to use it. Connecting never adds it to implicit “all configured providers” sweeps or schedules.

The Canonry server must run under the same OS user and effective Codex home as the CLI session. Sign in on that machine. Canonry never opens an OAuth flow, installs Codex, copies tokens, calls logout, or falls back to API-key billing. API-key-authenticated CLI sessions are rejected. Disconnect stops Canonry's runtime and prevents new dispatches while leaving the CLI signed in. The observed account email is fingerprinted locally to detect a changed login; the protocol does not expose a separate workspace identity. Codex owns token refresh and credential storage. Canonry's config contains only enablement, selected model, quota, and the account fingerprint.

Connection status is a cached, non-generating read. Refresh and connect inspect account/model metadata; they do not generate answers. Connection routes require instance-administrator authority, including for API and MCP callers. Hosted `apps/api` exposes an unavailable status and refuses connection changes. The setup MCP tools are `canonry_codex_status`, `canonry_codex_connect`, `canonry_codex_refresh`, and `canonry_codex_disconnect`.

## Evidence and runtime compatibility

The verified App Server runtimes are **0.157.1** and **0.158.0**. Compatibility is checked against initialization, not the launcher version. The 0.158.0 protocol was compared with the original schemas and exercised by six bounded live queries; captured evidence is covered by replay fixtures. Other runtime versions fail closed until their protocol is evaluated.

Five live pilot queries recovered final source links through experimental `rawResponseItem/completed` events. Public search-action events alone are insufficient. An AST check accepts only exec-bridge programs that print unmodified native web-tool results; model-authored or transformed source text is rejected. Captured tool programs are retained with their output for replay. The adapter accepts a final-answer HTTP link or citation reference only when it matches a source header in an actual captured web-tool result, including a redirect destination explicitly reported on that result’s native attribution line. Redirect-like text in page bodies and guessed URL variants are not trusted. Missing raw events, absent source evidence, unresolved citations, and unsupported output formatting fail the query; they never produce a successful “not cited” observation.

Snapshots preserve the original answer Markdown, captured web-tool output, source mappings, search queries, and requested model. Normalized answer text contains visible Markdown text, excluding hidden link destinations, so citations do not manufacture mentions. `servedModel` remains absent when the runtime does not independently report it. The retrieval contract is `codex-web-search-v1`; changes to its fixed prompt or search policy require a new contract version. General text-generation calls preserve the requested output format and do not claim visibility measurements.

Each query starts an ephemeral conversation in an empty temporary working directory. Repository instructions, skills, plugins, MCP tools, shell execution, and image tools are disabled. Codex can still report its global CLI `AGENTS.md` as an instruction source; no repository instruction file is accepted. Subprocess environments exclude provider API keys. Snapshots omit authentication replies, reasoning, and inherited instructions.

Failed measurement turns retain their final answer (when available), captured native web evidence, query/run context, requested model, runtime version, and error under `~/.canonry/diagnostics/codex/` (or `CANONRY_CONFIG_DIR/diagnostics/codex/`). These gzip JSON files are host-only diagnostics, not observations or API error payloads. Files use owner-only permissions and are retained up to 100 files / 100 MiB, pruning older captures. No authentication replies, reasoning, or input instruction messages are captured. Storage errors are logged separately without replacing the original provider failure. Disconnect preserves these files and historical observations.

Defaults are one concurrent query, six logical queries per minute, 100 per day, and a three-minute turn deadline. The runtime serializes callers across projects. Codex's subscription limits also include your other coding sessions; Canonry cannot reserve or expand that allowance. Quota and disconnected-stream failures are reported without replaying the paid turn. Cancellation interrupts the active turn; shutdown/disconnect closes the managed subprocess.

## Validation

Use `packages/provider-codex/test/` for evidence/protocol tests and the Codex connection/surface tests in Canonry and the web app. Advanced and Simple execution are covered alongside the existing measurement suite. The sanitized Aurora Solar before/after corpus and handoff are committed under [`docs/evaluations/codex-subscription`](../evaluations/codex-subscription/README.md); the original local baseline remains under `.context/baselines/20260926T210118Z`. Do not overwrite the baseline. Compare deterministic replays separately from changing live answers. Live acceptance requires a bounded capture, source-attribution review, and disclosure of failures and unsupported cases.
