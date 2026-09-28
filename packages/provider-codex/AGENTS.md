# Codex subscription provider

Local-only adapter over the installed official Codex App Server, reusing its subscription login. Never copy tokens, invoke logout, auto-install Codex, or fall back to an API key. Keep account and model selection explicit.

Measurement is gated on captured web-tool source evidence. A final-answer URL counts only when it matches an actual tool-result source header or citation reference. Search/open actions alone and model-generated source lists are not evidence. Missing or incompatible raw events fail the query. Exec-bridge output is trusted only after the program passes the verbatim web-result AST guard; never classify arbitrary model-written tool output as source evidence. Experimental raw-event compatibility is checked on every answer; preserve fixtures when updating the supported protocol.

Fresh ephemeral conversations use a fixed prompt and live search. No inherited skills, plugins, MCP tools, shell, or repository context. Child-process cleanup and deadlines are mandatory. Never log authentication replies or persist reasoning/input instructions in raw snapshots.

Pure provider-specific normalization lives here; generic utilities stay in contracts. Test normalization independently of the process, and process behavior with a fake App Server. Live acceptance uses the saved Aurora Solar basket and requires explicit authorization for quota consumption.

Verified runtime versions are 0.157.1 and 0.158.0. Failed measurement turns invoke the host failure-capture callback before rejection with allowlisted answer/web evidence only; preserve the original provider error if diagnostic persistence fails.

Native attribution-line redirect destinations are verified source aliases. Never infer redirects from webpage prose, matching domains, or guessed URL normalization. The captured Enact failure is the regression fixture for this boundary.
