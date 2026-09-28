# Handoff: Codex subscription provider

[PR #1](https://github.com/chacha-labs/ayyeo/pull/1) targets `main` from `feat/codex-subscription-provider`. The feature version is **5.29.0**. The [evaluation summary](README.md) records validation and failure findings; [validation-summary.json](validation-summary.json) retains the check results. Actions is intentionally disabled. No merge, production deployment, or Codex logout was performed.

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

Essential captured regression fixtures remain in `packages/provider-codex/test/fixtures/`. Bulk evaluation artifacts and their replay script were moved to the local `.context` archive described in the evaluation summary; they are not required to build or test the feature.

## Limits and follow-up rules

- Supported App Server runtimes: `0.157.1` and `0.158.0`. Evaluate protocol changes with captured fixtures and a bounded live pilot before extending the guard.
- Only verified final-answer citations count. Missing evidence fails explicitly; never weaken validation or substitute mention-only measurement to improve completion rates.
- Identity checks include the workspace account ID when disclosed; older responses fall back to email. An upgrade from an email-only fingerprint requires reconnecting.
- Repository instructions, skills, plugins, MCP tools, shell and image tools are disabled, but global CLI instructions may still be present.
- Failed turns retain owner-only diagnostics under the local config directory's `diagnostics/codex/`, capped at 100 files / 100 MiB. Rejected exec data is separately bounded and never trusted as source evidence. Storage errors do not mask provider failures.
- Defaults: one concurrent query, six logical requests/minute, 100/day, three-minute turn deadline. Subscription allowance is shared; there is no automatic API fallback.
- Changing the prompt or retrieval policy requires a new retrieval contract. Parsing changes need captured regression tests. Keep historical baselines intact and record new live attempts separately, including failures.
- Recheck the published version before landing the PR. Report local validation separately from CI, which remains disabled by request.
