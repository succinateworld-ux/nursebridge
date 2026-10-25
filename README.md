# NurseBridge

**Study smarter. Practise confidently. Know what to improve next.** NurseBridge by Nurse Succinate is a guest-first nursing study and practice app. Free lessons, original questions, mock practice, a private study plan and device-local progress do not require an account, wallet or cryptocurrency. Optional Mezo Testnet MUSD supports a 30-day premium review pack and a separately configured student-access fund.

NurseBridge practice material is educational content, not official RPHN, NMCN or NCLEX examination material, clinical advice, or a promise of examination results. Use current course materials, local protocols and qualified supervision.

## What works in this build

- **Free study:** Four short source-linked lessons and 59 original four-option questions across ten subject areas. Eight questions are shared foundations. Pathway-focused counts are NMCN RN 10, NMCN RM 10, NMCN RPHN 10, NCLEX-RN 10 and NCLEX-PN 11. Search and filter by subject, topic, study tag, difficulty and content type.
- **Exam pathways:** Select NMCN RN, NMCN RM, NMCN RPHN, NCLEX-RN or NCLEX-PN. Each has a distinct jurisdiction, purpose, proposed focus areas and an official reference status. Pathway changes preserve separate new progress and study targets.
- **Practice:** Quick, topic, pathway, daily, random, weak-topic, bookmarked and mistake-review modes use real bank and learner state. Answer one question at a time, submit, read the rationale and review incorrect options. Timed mock practice has question navigation, a running deadline, a leave confirmation, answer review and resumable drafts. Sets are not mapped to an exam blueprint and are not official exam simulations.
- **Study plan and progress:** Set an optional target date and weekly question goal for the selected pathway. Recommendations and trend views use only submitted answers saved in the current browser.
- **Three access routes:** Continue studying free; submit a pseudonymous sponsorship request; or optionally buy the defined premium pack with MUSD on Mezo Testnet.
- **Premium checkout:** x402 payment routes are enabled only when a Testnet merchant address is configured. The server checks the Mezo RPC chain, successful transaction receipt, official MUSD `Transfer` event, payer, recipient and exact amount before storing a verified payment. A verified payment creates 30-day access tied to that wallet. Protected review content requires a short-lived, one-use wallet signature session.
- **Sponsor contributions:** A separately configured Testnet fund address can receive a defined MUSD contribution. The server records only independently verified transfers in its contribution summary. Sponsor funds are sent directly to that wallet; the app does not hold or allocate funds.
- **Honest sponsorship status:** Requests are private and remain pending. This build has no authenticated review/admin workflow or grant allocation, so it cannot approve, fund or assign sponsored access.

No real Testnet payment has been performed as part of this repository work. A working build or unit test is not evidence of a live facilitator settlement.

### Exam-content count and review status

The current bank contains **59 distinct question IDs**: 8 shared general questions, plus 10 NMCN RN, 10 NMCN RM, 10 NMCN RPHN, 10 NCLEX-RN and 11 NCLEX-PN pathway-focused practice questions. Each item has a source URL and checked date. All 59 are labeled **source-checked**; **0 are clinically reviewed** and **0 are marked ready for use**. “Source-checked” records a checked reference link and date; it is not a claim that a qualified clinician reviewed or approved the question. Items use single-best-answer grading only. There are four short lessons.

Pathway-specific items organize original practice by examination focus; they are **not formally mapped to current official blueprints**, endorsed, or official past questions. No NMCN detailed current RN/RM/RPHN blueprint was found on the Council pages checked. The 2026 NCSBN plans were checked and linked, but NurseBridge does not reproduce their protected plan text or claim alignment. Topic lists remain proposed study areas. See [NMCN Examination Division](https://nmcn.gov.ng/unitexam.html), [NMCN Education](https://nmcn.gov.ng/education.html), [2026 NCLEX-RN Test Plan](https://www.ncsbn.org/publications/2026-nclex-rn-test-plan) and [2026 NCLEX-PN Test Plan](https://www.ncsbn.org/public-files/2026_PN_Test%20Plan-F.pdf).

NurseBridge checked the NMCN Examination Division and Education pages, and the NCSBN 2026 NCLEX-RN and NCLEX-PN test plans on 24 October 2026. The NMCN pages confirm relevant qualifying and post-basic examination activity but did not provide a public, detailed current blueprint for the RN, RM or RPHN routes in the pages reviewed. NCSBN's current plans are linked per route, but NurseBridge content has not been mapped or independently reviewed against them. Topic lists are proposed study areas, not verified blueprints. See [NMCN Examination Division](https://nmcn.gov.ng/unitexam.html), [NMCN Education](https://nmcn.gov.ng/education.html), [2026 NCLEX-RN Test Plan](https://www.ncsbn.org/publications/2026-nclex-rn-test-plan) and [2026 NCLEX-PN Test Plan](https://www.ncsbn.org/public-files/2026_PN_Test%20Plan-F.pdf).

Pathway-specific progress applies to new activity. Existing progress from earlier versions is migrated without assigning it to an exam that the learner did not select at the time. Attempts (including the selected answer), bookmarks, study sessions and progress remain browser-local and are not backed up to an account. Review Mistakes opens the last incorrect choice and its rationale; a later correct response removes that item from the unresolved-mistake list. The daily challenge is selected deterministically by local date and pathway; it does not award a streak or reward.

## Technology and routes

- React 19, TypeScript, Vite 8, and `lucide-react` frontend.
- Express 5 API, viem, and x402 2.28.0 server-side payment middleware.
- Vite proxies `/api`, `/premium`, and `/sponsor` to the Express process in development. In production, Express serves `dist/`.
- Guest learning progress and sponsorship request lookup key live in browser local storage. Payment intents, verified transaction references, access challenges/sessions and pseudonymous sponsorship requests are written to the server data file.
- The app has guest mode, not full user accounts or password authentication. There is no admin interface.

## Requirements and local setup

Use Node.js 20.19+ (or a current Node 22 release) and npm. From this directory:

```powershell
npm.cmd install
Copy-Item .env.example .env
notepad .env
npm.cmd run dev
```

Open the Vite URL printed in the terminal, normally `http://localhost:5188` (kept separate from the older project preview on port `5173`). Free study and sponsorship requests work without payment addresses. The Express API uses port `4021` by default; Vite proxies API and checkout requests to it. The server creates `.data/nursebridge.json` for local persistent records.

### Optional Testnet payment configuration

Edit only the receiving addresses and prices in `.env`. Leave payment addresses empty to keep the payment routes disabled. Never put private keys, seed phrases, wallet passwords or API secrets in `.env`.

```env
PAY_TO=
SPONSOR_TO=
PORT=4021
PRICE_USD=0.001
SPONSOR_PRICE_USD=0.01
MEZO_TESTNET_RPC=https://rpc.test.mezo.org
FACILITATOR_URL=https://facilitator.vativ.io
DATA_DIR=.data
```

- `PAY_TO` is the merchant's **receiving wallet address** on Mezo Testnet.
- `SPONSOR_TO` is optional and must be a different Testnet wallet address. It receives sponsor contributions directly.
- Prices are configured in USD terms for x402 and are limited by startup validation. The current premium offer is 30 days; the configured price is shown in the app and checkout.
- `MEZO_TESTNET_RPC` and `FACILITATOR_URL` are pinned to the endpoints above and rejected if changed. Do not switch this app to mainnet.
- `DATA_DIR` should point to a writable, persistent directory if you host the server. `.data/` is ignored by Git.

## Mezo Testnet and MUSD

The app's centralized Testnet configuration is:

| Setting | Value |
|---|---|
| Chain ID | `31611` |
| x402 network | `eip155:31611` |
| RPC | `https://rpc.test.mezo.org` |
| Explorer | `https://explorer.test.mezo.org` |
| MUSD contract | `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503` |
| MUSD decimals | `18` |
| Facilitator | `https://facilitator.vativ.io` |

The app distinguishes MUSD from the MEZO network token and does not use MEZO as a payment asset. For current wallet, token and test-asset guidance, consult the [official Mezo x402 MUSD quickstart](https://testnet.mezo.org/docs/developers/getting-started/musd-payments-x402/x402-quickstart/), [Mezo network connection guide](https://testnet.mezo.org/docs/users/getting-started/connect) and [contract reference](https://testnet.mezo.org/docs/users/resources/contracts-reference). Testnet assets have no guaranteed real-world value. Confirm the selected chain and token in your wallet before signing anything.

To attempt an end-to-end Testnet payment after configuring a receiving address, use a wallet you control, switch it to Mezo Testnet, create a fresh intent in NurseBridge and review the x402 request before approving in the wallet. The server verifies the resulting receipt independently. Do not share signing credentials with the app. Closing checkout does not cancel an already broadcast transaction; an intent expires after 15 minutes, while a receipt first seen before expiry may be reconciled for up to one hour. No refund flow is implemented.

## API overview

- `GET /api/health` — process health and fixed Testnet network ID.
- `GET /api/config` — public network, MUSD token, prices, route availability and recipient addresses.
- `POST /api/payment-intents` — creates a 15-minute, purpose-specific intent for a valid payer address.
- `GET /api/payment-intents/:id?wallet=...` — returns status only for the wallet bound to that intent; pending receipts are reconciled against Mezo RPC.
- `GET /premium` and `GET /sponsor` — x402-protected premium purchase and sponsor contribution routes, enabled only when their recipient addresses are configured.
- `GET /api/entitlements` and `GET /api/premium/content` — require a short-lived Bearer session created by signing a one-use server challenge; premium content also requires an active verified entitlement.
- `POST /api/sponsorship/requests` and `/api/sponsorship/status` — create or view a pending request using a random browser key; only its SHA-256 hash is stored.
- `GET /api/sponsorship/summary` — confirmed sponsor contributions and aggregate pending request count; it never publishes request details.
- `GET /api/history` — server-side verified transaction references with payer addresses omitted.

All `/api` routes have an in-process per-IP rate limit and JSON size limit. The server logs error types only, not request bodies, wallet signatures or bearer tokens. Helmet sets security headers. The browser never receives a server signing key because none is used.

## Data, privacy and threat model

- Guest progress is kept in local storage on that device and is not sent to the API. Clearing browser storage removes it.
- A sponsorship request stores a random request identifier hash, status and timestamps. The app does not ask for a name, contact information, financial documents or personal circumstances. Keep the browser's local storage if you want to look up the request again.
- The server data file contains payment intent and verified on-chain reference data, pseudonymous request records, one-use challenges and hashed short-lived access tokens. A wallet address and transaction hash are public on-chain information, but can still identify a user's activity when associated elsewhere.
- On POSIX hosts, the data directory and temporary database files are created with restrictive owner permissions where supported. On Windows, secure the inherited directory ACL.
- The JSON file is a simple **single-process MVP store**, not a production multi-instance database. It has atomic file replacement, but no cross-process locking, migrations, backup automation or database-level uniqueness constraints. Run one server instance with a private persistent volume. Before public deployment, migrate to a transactional database with uniqueness constraints, backups, operational monitoring and a reviewed retention policy.
- There is no authenticated sponsor/admin review. Do not accept public contributions for a real-world fund until custody, allocation, reconciliation, reviewer access and grant controls are designed and audited.
- The x402 facilitator is an external dependency. The server independently verifies the chain receipt and exact transfer but does not guarantee service availability or offer refunds.
- Content has source links and source-check dates but has not received independent clinical educator review. Keep it clearly labelled as practice material.

## Checks

```powershell
npm.cmd test
npm.cmd run build
```

Vitest runs the source tests (content validation, local progress, configuration, sponsorship and entitlement services, payment verification). The build runs strict server TypeScript compilation and produces the Vite production frontend. There is no separate lint script in this project; `npm.cmd run build` is the configured type-check/build command. Unit tests mock chain reads and do not prove a live Testnet payment.

For a local production-mode run after building:

```powershell
$env:NODE_ENV = "production"
npm.cmd start
```

Keep the server behind HTTPS if it is reachable outside localhost. Use a persistent private data volume, set `DATA_DIR` and receiving addresses through the host's protected environment configuration, and do not publish or deploy until you have reviewed the complete payment and data-handling setup.
