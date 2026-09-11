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
- No browser interaction or visual QA was performed on the app.
- Runtime used for these checks: Node 26.0.0. Other supported Node versions have not been independently tested.

## Changes required for Nova

Native Converse tool calls replace local-model formatting instructions. Output length and temperature fit Nova v1. The AWS SDK uses a fetch transport for Workers and explicit server-side credentials. Source headers remain in deterministic processing instead of being exposed as possible deadline/owner evidence. Exact-evidence validation inside the output tool returns correction feedback within the existing five-turn limit. Literal null markers become missing values without introducing facts.

## Limits

Earlier Ollama integration attempts did not pass. The first Nova sample exposed unsupported header metadata and null formatting; the current checks cover those failures. A passing sample does not establish general extraction accuracy, public availability, a hackathon submission, or a prize outcome. Human evidence review remains required. The deployed site stays owner-only, and API concurrency protection remains per instance.

## Public source package check

A clean installation of the prepared source release passed all 17 tests, typecheck, lint and the production build on Node 26.0.0. The dependency audit reported zero known vulnerabilities. Its local development page and configuration endpoint returned HTTP 200 at the Local URL printed by Vinext (localhost); the page rendered the product name and Synthetic example label. This was an HTTP check, not a browser interaction check. No model call was made for the source-release check.

The release preserves optional empty binding configuration and replaces only its copy of the Sites project identifier with null. The working deployment retains its real configuration. Source credentials, environment files, logs, dependencies, build output and Git history are excluded. Build warnings about a Node deprecation and static route classification were non-blocking. See the separately packaged source-release-check.json for the release checksum and provenance.
