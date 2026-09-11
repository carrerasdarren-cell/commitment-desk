# Commitment Desk

A project commitment review tool built with the **Strands Agents SDK for TypeScript**. Paste dated project updates; a Strands agent reads each source separately, extracts work commitments and links each event to an exact passage. Deterministic reconciliation classifies overdue, blocked, uncertain, upcoming and completed work. A person reviews and edits follow-up drafts, then exports an approved handoff. The app never sends messages.

The default screen is explicitly marked **Synthetic example**. It is a manually curated example and makes no claim that a model has run. **Analyze with Strands** invokes the real agent. Its actual read/output tool activity appears in the Run activity tab.

## Current validation status

The live Nova Lite sample check passed on September 10, 2026: all five expected attention states, all nine evidence records, zero rejected events, and real read/structured-output tool execution for all three sources. Seventeen domain, extraction-schema, and adapter tests pass. This is a bounded synthetic sample, not a general accuracy benchmark or a completed hackathon submission. See `docs/validation.md` for runtime and publication verification.

## Local setup

Requires Node 22.18+ on the Node 22 line, or Node 24+. This project was tested with **Node 26.0.0** and npm; `.node-version` records that version. The verified provider is Amazon Nova Lite 1.0 in AWS Bedrock, region `us-east-2`.

```sh
npm ci
cp .env.example .env
```

Keep `MODEL_PROVIDER=bedrock` in `.env`. Configure an AWS identity with the model invocation permissions shown in `docs/bedrock-policy.json`. For the web application, supply its credentials through the commented server-only variables in the ignored `.env` file. Temporary credentials also require `AWS_SESSION_TOKEN`. The standalone Node agent check can alternatively use the standard AWS SDK credential chain; the Worker runtime cannot read your local AWS credential files. Never put credentials in client code or Git. Your AWS account must have working Nova Lite access and quota; model calls use that account's inference allowance and may incur charges.

```sh
npm run dev -- --port 3047
```

Open the Local URL printed by the development server. The initial screen is a curated synthetic example and makes no model request. Choose **Source updates**, keep the sample review date `2026-09-08`, then choose **Analyze with Strands** for a real Bedrock run. Review evidence before approving any draft. **Export handoff** creates a local Markdown download; it does not send messages.

Without AWS credentials, the example, domain tests, typecheck, lint and production build can still run. Live analysis requires a configured provider. A Sites account is not required for local setup. The included `.openai/hosting.json` supplies optional binding configuration used by the Vite setup; public source distributions omit the private deployment project identifier.

## Optional Ollama development

Ollama uses `qwen2.5-coder:7b` with a 16,384-token context. **The full sample has not passed with that model**, so use the Bedrock setup above to reproduce the verified integration.

```sh
ollama pull qwen2.5-coder:7b
ollama create commitment-desk-qwen -f models/Modelfile
ollama serve
npm run dev -- --port 3047
```

If Ollama is already serving, do not start a second instance.

For Ollama, set `MODEL_PROVIDER=ollama` to use its local OpenAI-compatible endpoint. The local compatibility adapter accepts a model-emitted JSON function call only when it names a declared tool; Strands then validates and executes it. This handles an observed Ollama/Qwen formatting mismatch without fabricating tool results. Environment variables are documented in `.env.example`. The frontend never receives model credentials. For direct command-line model testing, export the environment variables in your shell.

## Checks

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

To run the live model check with your local environment file:

```sh
node --env-file=.env scripts/check-agent.ts
```

`npm run test:agent` is equivalent when the variables are already exported in your shell. This invokes the model, verifies the five expected statuses, nine evidence records, zero rejected events, and successful read/output tools for every source. It saves a synthetic-data-only report under `docs/evidence/`. Set `CHECK_WORKER_URL` to the application analysis endpoint to run the same assertions through its HTTP route. Model behavior may vary; a passing sample is not a general accuracy benchmark.

With the development server running at the port above:

```sh
CHECK_WORKER_URL=http://localhost:3047/api/analyze node --env-file=.env scripts/check-agent.ts
```

`npm start` is a **local Wrangler preview** of an existing production build, so run `npm run build` first. It is not a deployment command or a Node production server. The local preview needs its own server-side provider configuration for live analysis.

## Input format

```text
[S-01] 2026-09-03 | Thursday meeting
Maya will send the launch budget by 2026-09-07.

[S-02] 2026-09-08 | Project update
The launch budget has been delivered.
```

Use unique IDs and valid ISO dates, with no more than 18,000 characters per review. Owners and deadlines must be present in the quoted passage. Relative or unspecified deadlines remain uncertain. Dates after the review date are excluded. Explicit later completion suppresses follow-up; same-day conflicting states, owners or deadlines require clarification. Explicit withdrawal can clear an old assignment/deadline; progress-only updates preserve them.

## Deployment and data

The app uses a server route and stores no project notes in a database. Notes are sent to the configured model for analysis and remain in browser memory for review; exports are local downloads. Do not treat exact quote matching as a guarantee of semantic accuracy: the model can still group tasks incorrectly, misinterpret intent, or miss information. Human review remains essential.

Cloud deployment requires a reachable model provider. A hosted server cannot reach the developer's local Ollama service. Production live analysis is disabled until `MODEL_PROVIDER` is explicitly configured. The Bedrock adapter uses `BEDROCK_MODEL_ID`, `AWS_REGION`, server-only AWS credentials (or the SDK credential chain locally), and a fetch transport compatible with Workers. The dedicated `commitment-desk-bedrock` identity has no console access and only the Nova Lite invocation permissions in `docs/bedrock-policy.json`. Hosted credentials are Sites secrets; the site remains owner-only. Review usage and access controls before sharing paid inference. Current concurrency protection is per server instance, not a distributed quota.

The model has only a read tool for the supplied updates. It has no email, network browsing, shell, or calendar tool. Source instructions are treated as untrusted data; schema and quote checks constrain output, but are not a proof against all prompt injection. Review is bounded to eight sources, five model turns per source and four minutes overall. Sources are extracted separately to keep later conclusions from being attached to earlier quotes. The model receives the source ID and body, while dates and source titles stay in deterministic processing. Exact quote/owner/deadline checks run inside structured output so the model can correct an invalid extraction within the existing turn limit. Literal null markers are normalized to missing values; no evidence is invented. No project text is printed in server error logs.

## Entry materials

- `docs/architecture.md` — data flow and trust boundaries
- `docs/submission-draft.md` — project description and remaining submission steps
- `docs/demo-script.md` — a demo under five minutes
- `docs/evidence/` — executed Node, local Worker, and privately hosted Worker evidence

Started September 8, 2026 for AWS Agents for Humans, Professional Agents track. Built with AI assistance. The Sites/React/shadcn scaffold, Strands SDK, and their dependencies are pre-existing third-party building blocks; commitment extraction, reconciliation, review flow, scenario and submission materials were created for this entry. No independent benchmark, paying user, production reliability or prize result is claimed.

MIT licensed; third-party packages retain their licenses.

Lint covers authored application, domain, adapter and tests. Generated shadcn component templates and its unused mobile hook are excluded; their upstream lint findings were not changed as application code.
