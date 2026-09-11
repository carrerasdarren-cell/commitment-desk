# Commitment Desk — Devpost draft

Status: prepared for review; not submitted. Track: **Professional Agents**.

## Project name

Commitment Desk

## Elevator pitch

Turn project updates into a commitment queue with source evidence and follow-up drafts a person controls.

## Inspiration

A project manager should not have to reconstruct the week before sending a reminder. The original task list might say a checklist is due, while a later channel update says it was delivered. Another item may be blocked, and a third may never have had an agreed deadline.

Commitment Desk explores a specific question: can an agent organize those updates without turning uncertainty into a confident but incorrect follow-up?

## What it does

Paste dated project updates and choose a review date. A Strands agent reads each supplied source and extracts commitment events with exact quotations. Application logic checks those quotations, reconciles the dated history, and groups the work into overdue, blocked, needs clarity, upcoming, and completed items.

The reviewer can open each item's evidence, inspect what changed, and edit its follow-up. Approval marks a draft for a Markdown handoff. The application does not send email or messages.

The included Northline Studio scenario is synthetic: three updates describe five commitments. A later checklist delivery suppresses a stale reminder, an invoice stays blocked on a purchase order, and an unconfirmed kickoff remains undated. The initial example is clearly labeled; clicking Analyze with Strands runs the actual model.

## How we built it

The interface uses React, TypeScript and shadcn components. A server route runs the Strands Agents SDK for TypeScript with Amazon Nova Lite 1.0 through AWS Bedrock in us-east-2. The agent executes a read_updates tool before submitting events through Strands structured output. Tool hooks populate the run activity view.

Each source is extracted separately. Source dates and titles remain in application logic, while the model receives the source ID, body, and previously established commitment keys and titles. A source-specific schema checks exact quotations and supplied owners and deadlines. Invalid extractions receive correction feedback within a bounded agent run. Ordinary code then reconciles chronology, completion, explicit withdrawals and conflicts.

The privately hosted app runs on a Worker. The Bedrock client uses a fetch transport, and a dedicated AWS identity has only the configured Nova Lite invocation permissions. Credentials remain in server-side secrets. AgentCore is not used.

## Challenges we ran into

An exact quote is necessary evidence, but it does not prove the interpretation is right. We kept human review central and made unknown or conflicting details visible.

A later live run correctly marked the checklist completed but omitted its historical deadline even though the source quote retained it. That remaining limitation reinforces the need for human review and a broader evaluation set.

The first Nova sample also exposed a practical extraction issue: headers could be mistaken for deadlines or owners. Separating header metadata from model input and validating the structured output addressed that observed failure. The Worker deployment required an explicit fetch transport instead of the SDK's Node HTTP transport.

## Accomplishments we are proud of

The same full synthetic scenario passed through the Node agent, local Worker route, and privately published Worker route. Each saved run retained nine evidence records, covered the five expected attention states, rejected zero events, and recorded successful read and structured-output tools for all three sources. Seventeen domain, schema and adapter tests passed.

These are bounded checks of this scenario, not a general accuracy benchmark. The live browser review, draft editing and approval are now recorded. A later user-assisted live Markdown download was independently checked: all five commitments and nine source quotes were retained, with exactly one approved draft matching the edited Maya message. The later download and file inspection are separate from the recorded footage.

## What we learned

Agent interpretation and application rules do different jobs. A model can organize language; explicit code can apply a review date, preserve conflicting evidence and stop completed work from generating reminders. Keeping the two responsibilities visible makes a review easier to question and correct.

## What's next

Validate the workflow with project managers using synthetic or permissioned examples. Measure incorrect reminders and unresolved details before making time-saving claims. Expand the evaluation set, improve task matching across differently worded updates, and add appropriate access and usage controls before wider deployment.

## Built with

Strands Agents SDK for TypeScript; Amazon Bedrock; Amazon Nova Lite 1.0; TypeScript; React; Vinext; Cloudflare Workers; Zod; shadcn; Sites.

## Original work and AI disclosure

Started September 8, 2026 for Agents for Humans. Built with AI coding assistance. The Sites/React/shadcn scaffold, Strands SDK, and other libraries are pre-existing third-party building blocks. Commitment extraction, reconciliation, the review flow, synthetic scenario and entry materials were created for this project. MIT licensed; third-party packages retain their licenses. No customer, revenue, independent accuracy benchmark or prize result is claimed.

## Links and eligibility — complete before submission

- Public source repository: [carrerasdarren-cell/commitment-desk](https://github.com/carrerasdarren-cell/commitment-desk) — published under MIT.
- Public demo: [Commitment Desk | Agents for Humans 2026](https://www.youtube.com/watch?v=zkPgiwAC5kY) — 3:04, published after approval. A later live export was independently verified.
- Architecture: `architecture.svg` / `architecture.png` in this folder.
- Judge testing access (website, functioning demo or test build): pending; the current hosted app is owner-only.
- Devpost hackathon registration: verified; a project draft exists. AWS Builder ID email still needs verification; the AWS console account alone does not establish this.
- Final entrant eligibility, project description and terms acceptance: Darren's review required.

Deadline verified September 10: September 14, 2026, 5 p.m. Pacific / 8 p.m. Eastern. Keep the judge access route working through judging, which ends October 8. Sources: [official rules](https://agentsforhumans.devpost.com/rules), [FAQ](https://agentsforhumans.devpost.com/details/faqs).
