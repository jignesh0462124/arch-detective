# UI branding cleanup

## Removed or replaced

| Surface | Previous indicator | Current presentation |
| --- | --- | --- |
| Shared navigation | AI Advisor; prominent model-name button | Security Advisor; compact Model control |
| Model menu | Neural Reasoning Engine; unconditional ONLINE pulse; recommendation/speed badges; latency, throughput and context marketing | Select model; actual model choices and selected-model text |
| Advisor page and panel | Sparkle decoration; promotional error/loading text | Information/shield icons; Preparing response; safe interface errors |
| Conversation messages | Repeated model attribution badge; ANALYST QUERY | Security Advisor and You labels; response content unchanged |
| Attack Graph actions | Sparkle; Open in AI Advisor | Chat icon; Open Security Advisor; finding context preserved |
| Landing hero | Llama badge; Powered by Groq; machine-speed and signed-output claims | Plain project-review description and human-review disclosure |
| Workflow animation | Agentic RAG; provider/model branding; fake streaming run and ONLINE; fabricated counts/scores; cryptographic seal/signature claims | Explicit illustrative workflow describing upload, evidence, review, mappings and reporting |
| Landing supporting content | Live-system caption; invented ETA and surface-closed metrics; sealed reports; sample scores presented as current posture | Workflow illustration; factual stage labels; sample framework signals explicitly marked illustrative |
| About page | Signed audit reports; attestation and code-patch promises | Reports from saved results; remediation to review and test |
| Browser/social/app metadata | Agentic/LLM titles and descriptions; agentic wording embedded in social image | Security audits and threat modeling wording; regenerated social image using existing vector identity |

## Deliberately retained

- Scanning, model IDs, routing, provider fallback, and all Advisor entry points.
- Real model names inside the model menu, selection state, and keyboard controls.
- Truthful availability, loading, errors, and cancellation controls.
- Privacy disclosures about external providers; automated-review provenance in workbench/reports; review-and-test warnings.
- Saved source evidence, findings, chat responses and reports, without rewriting their contents.
- Internal module names, diagnostic integration, generated router files, and historical documentation: these are not visible branding.

No database, RLS, authentication, API contract, scanning, or analysis changes are part of this cleanup.

## Verification

- `node --test tests/branding-ui.test.mjs` checks rendered labels, preserved content/disclosures, illustrative marketing and safe error messages.
- `tests/branding-browser.cjs` runs against the isolated workbench fixture via Playwright CLI. It exercises model selection, keyboard dismissal, streamed responses, shared page/panel conversation, cancellation, finding context and unavailable state, plus desktop/mobile screenshots in both themes.
- Existing audit, graph, findings, reports, dashboard and theme regressions remain applicable.
