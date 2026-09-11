# Validation — September 10, 2026

## Live Nova integration passed

The Node agent check, local Worker HTTP route, and privately published Worker HTTP route completed the full synthetic Northline Studio review using Amazon Nova Lite 1.0 in us-east-2.

- All five expected attention states: overdue, blocked, needs clarity, upcoming, and completed.
- All nine evidence records retained; zero rejected events.
- Later S-02 completion retained and no follow-up draft generated for completed work.
- Successful real read_updates and strands_structured_output calls for all three sources.
- Reports identify live mode and the Bedrock Nova provider.

Evidence: `evidence/local-agent-run.json`, `evidence/worker-agent-run.json` (local Worker), and `evidence/hosted-agent-run.json` (privately published Worker). These are executed synthetic-data runs, not manually populated reports or a general accuracy benchmark.

The hosted check finished at `2026-09-10T23:08:25.791Z` against deployed application commit `4422b3dc49de0a50906690d3cdecdd331013e4b0`, using the owner's authorized access. Deployment completed at `2026-09-10T23:07:39.125407Z`, with runtime environment revision 1. This proves the tested private endpoint worked; it does not establish access for external judges. Subsequent entry documentation and Node version metadata do not change the deployed application code.

## Application checks

- Seventeen domain, extraction-schema, and local adapter tests passed.
- TypeScript and authored-code lint passed.
- Dependency audit reported zero known vulnerabilities after the Cloudflare toolchain patch update.
- Local application returned HTTP 200; the actual Worker analysis endpoint passed the same full sample assertions.
- The bounded live browser flow was subsequently checked as described below; a later user-assisted live handoff download was independently read and verified.
- Runtime used for these checks: Node 26.0.0. Other supported Node versions have not been independently tested.

## Changes required for Nova

Native Converse tool calls replace local-model formatting instructions. Output length and temperature fit Nova v1. The AWS SDK uses a fetch transport for Workers and explicit server-side credentials. Source headers remain in deterministic processing instead of being exposed as possible deadline/owner evidence. Exact-evidence validation inside the output tool returns correction feedback within the existing five-turn limit. Literal null markers become missing values without introducing facts.

## Limits

Earlier Ollama integration attempts did not pass. The first Nova sample exposed unsupported header metadata and null formatting; the current checks cover those failures. A passing sample does not establish general extraction accuracy, public availability, a hackathon submission, or a prize outcome. Human evidence review remains required. The deployed site stays owner-only, and API concurrency protection remains per instance.

## Public source package check

A clean installation of the prepared source release passed all 17 tests, typecheck, lint and the production build on Node 26.0.0. The dependency audit reported zero known vulnerabilities. Its local development page and configuration endpoint returned HTTP 200 at the Local URL printed by Vinext (localhost); the page rendered the product name and Synthetic example label. This was an HTTP check, not a browser interaction check. No model call was made for the source-release check.

The release preserves optional empty binding configuration and replaces only its copy of the Sites project identifier with null. The working deployment retains its real configuration. Source credentials, environment files, logs, dependencies, build output and Git history are excluded. Build warnings about a Node deprecation and static route classification were non-blocking. See the separately packaged source-release-check.json for the release checksum and provenance.

## Recorded browser review

The live interface was exercised with the synthetic sample: the example label changed to a live Bedrock/Nova result; all five attention states appeared; the kickoff stayed undated; and the later S-02 checklist completion suppressed its draft. Editing and approving the launch budget follow-up were visible. Run activity showed three successful read tools and three successful structured-output tools, with zero rejected extractions.

The recorded export button displayed a confirmation, but its browser download event timed out and no file was independently verified at recording time. A later user-assisted download was checked separately as described below. The private 3:04 preview labels this later verification accurately; it uses actual browser frames with edited timing and generic synthetic narration. Its full video/audio decode passed. No native Codex interface was captured, and opening the downloaded file is not shown. See evidence/browser-review.json. The video has not been publicly uploaded.

## Downloaded handoff verification

A later live Bedrock/Nova review was exported by the user on September 10 Eastern (September 11 UTC). Independent inspection of the downloaded Markdown confirmed the live-provider label, all five commitment sections and nine source quotes, and exactly one approved draft containing the edited Maya message. The other commitments have no follow-up drafts; the completed checklist has no reminder. See `evidence/export-handoff-check.json` and the unchanged downloaded content in `evidence/approved-handoff.md`.

This verifies the user-assisted download path. Automated export clicks showed a success notice without creating another file. The original sample-only download was not accepted as proof of an approved live handoff. Review and approval state is held in browser memory and resets on reload or a new analysis. In this later run, the checklist remained correctly completed but its deadline was unconfirmed despite the date in its source quote; passing earlier runs should not be interpreted as general extraction accuracy.
