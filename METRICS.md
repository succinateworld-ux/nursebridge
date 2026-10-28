# NurseBridge user metrics

## Render Free deployment

Keep the existing free Render web service. Metrics now support persistent Neon Postgres through `METRICS_DATABASE_URL` (server only). Create a free Neon project, then add its Postgres connection URL to Render's protected environment settings. Keep `METRICS_ADMIN_TOKEN` as a separate random server secret of at least 32 characters. Do not put either value in source code or a `VITE_` variable.

The server creates its own namespaced metrics tables on first use. Event IDs are unique in Postgres, events and first-seen updates commit atomically, values are parameterized, and connections use HTTPS to a validated Neon endpoint. No npm dependencies are added. Database outages return 503 while learning remains available. Production never falls back to Render's ephemeral disk for metrics. Local development can still use `DATA_DIR/analytics.json` when no metrics database is configured.

Free tiers have quotas. Neon Free does not require a paid Render instance; monitor its storage and compute limits. Render Free Postgres has a 30-day expiry and is not the selected metrics store. This change only persists analytics: existing payment and sponsorship JSON storage is unchanged and still needs separate persistence planning if those features are used.

Run `node check-metrics.mjs` for the seven isolated analytics and database-adapter checks. The database transport checks use mocked HTTPS responses; real provisioning, SQL execution, the full production build, and live browser checks remain required before deployment is considered complete.

## Run

1. Install the repository dependencies with `npm.cmd ci` on a machine with npm access.
2. Copy `.env.example` to `.env` if needed. Set `METRICS_ADMIN_TOKEN` to a random secret containing at least 32 characters. Generate one with:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

3. Run `npm.cmd run dev`, or `npm.cmd run build` then `npm.cmd start` with `NODE_ENV=production`.
4. Open the app and append `#admin` to its URL. Enter the token to view metrics. Keep the token server-side; never use a `VITE_` variable for it. Use HTTPS when hosted.

The dashboard offers 7, 30 and 90 day periods, UTC daily counts, new and returning learners, questions answered, completed practice sets, submitted mock exams, completed lessons, pathways and exact-day 7/30 retention. It starts empty. No old browser progress is uploaded. The token is kept only in React state and can be cleared with Lock dashboard.

## Definitions

- A learner is a random identifier saved in one browser's local storage; the server stores its SHA-256 digest. This is not an account or a verified individual.
- Active learners have at least one recorded event in the period. A visible app records a visit on opening and a heartbeat at most once per minute, so keeping a visible tab open counts as activity.
- Daily active uses the current UTC date; monthly active uses the last 30 UTC dates including today.
- New learners were first observed during the selected period. Returning learners were first observed before its start and recorded activity within it. These are disjoint groups.
- Day N retention considers learners first observed during the selected period whose Nth UTC day has arrived, and counts those active on that exact day. An empty denominator displays an awaiting-cohort message.
- Questions count submitted practice answers and answered questions in submitted mock exams. Repeated submissions in separate attempts count again. No selected answers, correctness, question text, wallet identifiers, email addresses or names are included.
- Practice completion happens when the learner leaves the last question using the completion control. Mistake review may include previously answered items. Starts and completions are separate event counts, not a matched-session conversion funnel.
- Pathway counts can overlap because a learner may use multiple pathways.

## Storage and limitations

For local development, `DATA_DIR/analytics.json` is separate from payment and sponsorship records. File writes are serialized and replaced atomically, with duplicate event IDs ignored. Production uses the Neon tables described above. Events use server receipt dates, not client timestamps. Events older than 90 days are pruned on activity (once a day with Neon); anonymous first-seen dates remain. Database reads exclude old events even before pruning.

The API accepts a fixed event-name/pathway allowlist, drops extra fields and applies the app's existing API rate limit. Admin reads require the server token and return aggregate data only, with `Cache-Control: no-store`. Activity is client-reported and can be fabricated, blocked or lost; these are product estimates, not audited traffic. There is no retry queue for offline usage. Clearing storage, opting out and back in, or changing devices can create another learner ID.

Learners can use the Usage privacy control to stop future collection. Browser Do Not Track is respected. Opting out removes the local metrics ID but does not erase stored historical metrics. Learning and device-local progress continue when analytics fails or is disabled.

## Validation

On Node 24+, run `node --test server/analytics.check.mjs` for validation, retention, access-control and persistence checks. The existing project suite remains `npm.cmd test`; production compilation remains `npm.cmd run build`.

In the authoring environment, all four analytics checks passed and the three new frontend modules passed TypeScript checks against the available compiler. Full dependency installation was blocked by network restrictions and unavailable npm cache entries, so the complete build, existing Vitest suite and browser rendering still require verification with installed dependencies.

This folder is a source snapshot of GitHub commit `2d05529cd57a9cb86021c4a39fbca73e13c09342` plus the metrics implementation. It is not a Git clone and has not been pushed or deployed.
