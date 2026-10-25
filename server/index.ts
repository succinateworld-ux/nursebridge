import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import express, { type Request, type Response, type NextFunction } from "express";
import helmet from "helmet";
import { createPublicClient, getAddress, http, isAddress, isHex, type Address, type Hash } from "viem";
import { HTTPFacilitatorClient, x402ResourceServer, type RouteConfig } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { paymentMiddleware } from "@x402/express";
import { loadServerConfig, TESTNET } from "./config.js";
import { verifyPayment } from "./verify-payment.js";
import { createJsonStore, type PaymentIntent, type PaymentPurpose } from "./store.js";
import { premiumReviewPack } from "./premium-content.js";
import { accessSessionWallet, createAccessSession, createSponsorshipRequest, getActiveEntitlement, issueAccessChallenge, saveVerifiedPayment, validatePaymentIntent } from "./services.js";

const config = loadServerConfig();
const dataDirectory = resolve(process.env.DATA_DIR ?? ".data");
const storePromise = createJsonStore(resolve(dataDirectory, "nursebridge.json"));
const app = express();
const publicClient = createPublicClient({ transport: http(config.rpcUrl, { timeout: 10_000 }) });
const facilitator = new HTTPFacilitatorClient({ url: config.facilitatorUrl });
const resourceServer = new x402ResourceServer(facilitator).register(TESTNET.network, new ExactEvmScheme());
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
const intentLifetimeMs = 15 * 60_000;
const pendingLifetimeMs = 60 * 60_000;

app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: { directives: {
  defaultSrc: ["'self'"], scriptSrc: ["'self'", "'unsafe-inline'"], styleSrc: ["'self'", "'unsafe-inline'"],
  fontSrc: ["'self'", "data:"], imgSrc: ["'self'", "data:"],
  connectSrc: ["'self'", "https://rpc.test.mezo.org", "https://facilitator.vativ.io"],
  frameSrc: ["'self'"], frameAncestors: ["'self'"], objectSrc: ["'none'"], baseUri: ["'self'"], formAction: ["'self'"]
} } }));
app.use(express.json({ limit: "12kb", strict: true }));

function rateLimit(max: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.ip ?? "unknown"}:${req.path}`;
    const now = Date.now();
    const bucket = rateBuckets.get(key);
    if (!bucket || bucket.resetAt <= now) rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    else if (++bucket.count > max) {
      res.setHeader("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
      res.status(429).json({ error: "Too many requests. Please wait a moment and try again." });
      return;
    }
    if (rateBuckets.size > 5_000) for (const [bucketKey, value] of rateBuckets) if (value.resetAt <= now) rateBuckets.delete(bucketKey);
    next();
  };
}
app.use("/api", rateLimit(90, 60_000));
app.use("/premium", rateLimit(12, 60_000));
app.use("/sponsor", rateLimit(12, 60_000));

function publicIntent(intent: PaymentIntent) {
  return { id: intent.id, purpose: intent.purpose, payer: intent.payer, payTo: intent.payTo, amountUsd: intent.amountUsd,
    amountAtomic: intent.amountAtomic, token: intent.token, network: intent.network, createdAt: intent.createdAt, expiresAt: intent.expiresAt, status: intent.status, txHash: intent.txHash ?? null };
}
function validHash(value: unknown): value is Hash { return typeof value === "string" && isHex(value, { strict: true }) && value.length === 66; }
function paymentPathPurpose(path: string): PaymentPurpose | null { return path === "/premium" ? "premium" : path === "/sponsor" ? "sponsor" : null; }

app.get("/api/health", (_req, res) => res.setHeader("Cache-Control", "no-store").json({ ok: true, network: TESTNET.network }));
app.get("/api/config", (_req, res) => res.setHeader("Cache-Control", "no-store").json({
  network: TESTNET.network, chainId: TESTNET.chainId, networkName: TESTNET.name, token: TESTNET.musd, decimals: TESTNET.decimals,
  explorer: TESTNET.explorerUrl, premiumAvailable: Boolean(config.payTo), premiumPrice: config.priceUsd, premiumPayTo: config.payTo,
  sponsorAvailable: Boolean(config.sponsorTo), sponsorPrice: config.sponsorPriceUsd, sponsorPayTo: config.sponsorTo,
  persistence: "single_instance_json_file", authentication: "guest_mode"
}));

app.post("/api/payment-intents", async (req, res) => {
  const body = req.body as { purpose?: unknown; payer?: unknown } | undefined;
  if (body?.purpose !== "premium" && body?.purpose !== "sponsor") { res.status(400).json({ error: "Choose a valid payment purpose." }); return; }
  if (typeof body.payer !== "string" || !isAddress(body.payer)) { res.status(400).json({ error: "Connect a valid EVM wallet to continue." }); return; }
  const purpose: PaymentPurpose = body.purpose;
  const recipient = purpose === "premium" ? config.payTo : config.sponsorTo;
  if (!recipient) { res.status(503).json({ error: purpose === "premium" ? "Premium checkout is unavailable until a merchant Testnet address is configured." : "Sponsor contributions are unavailable until the sponsor fund Testnet address is configured." }); return; }
  const amountUsd = purpose === "premium" ? config.priceUsd : config.sponsorPriceUsd;
  const amountAtomic = purpose === "premium" ? config.priceAtomic : config.sponsorPriceAtomic;
  const now = new Date();
  const intent: PaymentIntent = {
    id: randomUUID(), payer: getAddress(body.payer), purpose, payTo: recipient, amountUsd, amountAtomic: amountAtomic.toString(),
    token: TESTNET.musd, network: TESTNET.network, createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + intentLifetimeMs).toISOString(), status: "pending"
  };
  await (await storePromise).transact(state => { state.intents.push(intent); });
  const path = purpose === "premium" ? "/premium" : "/sponsor";
  res.status(201).setHeader("Cache-Control", "no-store").json({ ...publicIntent(intent), checkoutUrl: `${path}?intent=${encodeURIComponent(intent.id)}&wallet=${encodeURIComponent(intent.payer)}` });
});

async function reconcilePending(): Promise<void> {
  const store = await storePromise;
  const now = Date.now();
  for (const pending of store.read().pending) {
    if (now - pending.checkedAt < 2_500) continue;
    const state = store.read();
    const intent = state.intents.find(item => item.id === pending.intentId);
    if (!intent || now - pending.firstSeenAt > pendingLifetimeMs) {
      await store.transact(state => {
        state.pending = state.pending.filter(item => item.hash.toLowerCase() !== pending.hash.toLowerCase());
        const stale = state.intents.find(item => item.id === pending.intentId);
        if (stale && stale.status === "pending") stale.status = "expired";
      });
      continue;
    }
    await store.transact(draft => { const item = draft.pending.find(entry => entry.hash.toLowerCase() === pending.hash.toLowerCase()); if (item) item.checkedAt = now; });
    const verification = await verifyPayment({ chain: publicClient, txHash: pending.hash, network: intent.network, payer: intent.payer, expectedPayTo: intent.payTo, expectedAmount: BigInt(intent.amountAtomic) });
    if (verification.ok) {
      const saved = await saveVerifiedPayment(store, intent.id, { hash: verification.hash, payer: verification.payer, payTo: verification.payTo, amount: verification.amount });
      if (saved === "expired" || saved === "duplicate") await store.transact(state => {
        state.pending = state.pending.filter(item => item.hash.toLowerCase() !== pending.hash.toLowerCase());
        const stale = state.intents.find(item => item.id === pending.intentId);
        if (stale && stale.status === "pending") stale.status = saved === "expired" ? "expired" : "failed";
      });
    }
    else if (!verification.reason.includes("Could not confirm") && !verification.reason.includes("not found")) {
      await store.transact(state => {
        state.pending = state.pending.filter(item => item.hash.toLowerCase() !== pending.hash.toLowerCase());
        const failed = state.intents.find(item => item.id === pending.intentId); if (failed) failed.status = "failed";
      });
    }
  }
}

async function markPending(intent: PaymentIntent, hash: Hash): Promise<void> {
  const store = await storePromise;
  await store.transact(state => {
    const found = state.pending.find(item => item.hash.toLowerCase() === hash.toLowerCase() && item.intentId === intent.id);
    if (!found) state.pending.push({ hash, payer: intent.payer, purpose: intent.purpose, intentId: intent.id, firstSeenAt: Date.now(), checkedAt: 0 });
  });
}

// Bind checkout pages to an unexpired, server-created intent before x402 shows a payment request.
app.use(async (req, res, next) => {
  const purpose = req.method === "GET" ? paymentPathPurpose(req.path) : null;
  if (!purpose) { next(); return; }
  const intentId = req.query.intent;
  const wallet = req.query.wallet;
  if (typeof intentId !== "string" || typeof wallet !== "string") { res.status(400).json({ error: "Create a payment intent from the app before opening checkout." }); return; }
  const store = await storePromise;
  const intent = store.read().intents.find(item => item.id === intentId);
  const intentStatus = validatePaymentIntent(intent, purpose, wallet);
  if (intentStatus === "missing" || intentStatus === "wrong_wallet" || intentStatus === "wrong_purpose") { res.status(404).json({ error: "Payment intent was not found for this wallet." }); return; }
  if (intentStatus === "already_used") { res.status(409).json({ error: "This payment intent has already been used." }); return; }
  if (intentStatus !== "valid") { res.status(410).json({ error: "This payment intent has expired. Create a new one to try again." }); return; }
  if ((purpose === "premium" && !config.payTo) || (purpose === "sponsor" && !config.sponsorTo)) { res.status(503).json({ error: "This checkout is not configured for Mezo Testnet." }); return; }
  res.locals.paymentIntent = intent;
  next();
});

const paidRoutes: Record<string, RouteConfig> = {};
if (config.payTo) paidRoutes["GET /premium"] = { accepts: [{ scheme: "exact", price: `$${config.priceUsd}`, network: TESTNET.network, payTo: config.payTo, maxTimeoutSeconds: 120 }], description: `NurseBridge 30-day premium study access — $${config.priceUsd} MUSD on Mezo Testnet`, mimeType: "application/json" };
if (config.sponsorTo) paidRoutes["GET /sponsor"] = { accepts: [{ scheme: "exact", price: `$${config.sponsorPriceUsd}`, network: TESTNET.network, payTo: config.sponsorTo, maxTimeoutSeconds: 120 }], description: `NurseBridge student access fund contribution — $${config.sponsorPriceUsd} MUSD on Mezo Testnet`, mimeType: "application/json" };

// Track x402 pending receipts durably; pending payments never grant access until RPC verification succeeds.
app.use(["/premium", "/sponsor"], (_req, res, next) => {
  res.on("finish", () => {
    if (res.statusCode !== 402) return;
    const header = res.getHeader("PAYMENT-RESPONSE") ?? res.getHeader("payment-response");
    const intent = res.locals.paymentIntent as PaymentIntent | undefined;
    if (typeof header !== "string" || !intent) return;
    try {
      const reply = JSON.parse(Buffer.from(header, "base64").toString("utf8")) as { errorReason?: string; transaction?: string; network?: string; payer?: string };
      if (reply.errorReason === "settlement_pending" && reply.network === TESTNET.network && validHash(reply.transaction) && reply.payer && isAddress(reply.payer) && getAddress(reply.payer) === intent.payer) void markPending(intent, reply.transaction);
    } catch { /* An unreadable facilitator response cannot grant access. */ }
  });
  next();
});

if (Object.keys(paidRoutes).length) app.use(paymentMiddleware(paidRoutes, resourceServer, { appName: "NurseBridge", testnet: true }));

async function finishCheckout(_req: Request, res: Response, purpose: PaymentPurpose): Promise<void> {
  const intent = res.locals.paymentIntent as PaymentIntent | undefined;
  if (!intent || intent.purpose !== purpose) { res.status(400).json({ error: "A matching payment intent is required." }); return; }
  const header = res.getHeader("PAYMENT-RESPONSE") ?? res.getHeader("payment-response");
  if (typeof header !== "string") { res.status(402).json({ error: "No x402 settlement response was provided. Nothing was unlocked." }); return; }
  let settlement: { success?: boolean; errorReason?: string; transaction?: string; network?: string; payer?: string };
  try { settlement = JSON.parse(Buffer.from(header, "base64").toString("utf8")); }
  catch { res.status(502).json({ error: "The facilitator response could not be read. Access remains locked." }); return; }
  if (settlement.errorReason === "settlement_pending" && validHash(settlement.transaction) && settlement.network === intent.network && settlement.payer && isAddress(settlement.payer) && getAddress(settlement.payer) === intent.payer) {
    await markPending(intent, settlement.transaction);
    res.status(202).json({ status: "pending", error: "Settlement is still confirming. Access remains locked while Mezo Testnet is checked.", transaction: settlement.transaction }); return;
  }
  if (!settlement.success || !validHash(settlement.transaction) || settlement.network !== intent.network || !settlement.payer || !isAddress(settlement.payer) || getAddress(settlement.payer) !== intent.payer) {
    res.status(402).json({ status: "unverified", error: "Settlement details did not match this payment intent. No access was granted." }); return;
  }
  const store = await storePromise;
  const prior = store.read().payments.find(payment => payment.hash.toLowerCase() === settlement.transaction!.toLowerCase());
  if (prior) {
    if (prior.intentId === intent.id) { res.json({ ok: true, status: "verified", purpose, transaction: prior.hash, expiresAt: prior.entitlementExpiresAt ?? null, idempotent: true }); return; }
    res.status(409).json({ error: "This transaction has already been processed and cannot be reused." }); return;
  }
  const verification = await verifyPayment({ chain: publicClient, txHash: settlement.transaction, network: settlement.network, payer: intent.payer, expectedPayTo: intent.payTo, expectedAmount: BigInt(intent.amountAtomic) });
  if (!verification.ok) {
    const pending = verification.reason.includes("Could not confirm") || verification.reason.includes("not found");
    if (pending) { await markPending(intent, settlement.transaction); res.status(202).json({ status: "pending", error: "Mezo Testnet has not confirmed the receipt yet. Access remains locked.", transaction: settlement.transaction }); }
    else res.status(402).json({ status: "unverified", error: "The receipt did not match the expected MUSD payment. No access was granted." });
    return;
  }
  const saved = await saveVerifiedPayment(store, intent.id, { hash: verification.hash, payer: verification.payer, payTo: verification.payTo, amount: verification.amount });
  if (saved === "expired") { res.status(410).json({ error: "The payment intent expired before the receipt could be confirmed. No access was granted." }); return; }
  if (saved === "duplicate") { res.status(409).json({ error: "This intent or transaction has already been processed. No additional access was granted." }); return; }
  const payment = store.read().payments.find(item => item.hash.toLowerCase() === verification.hash.toLowerCase());
  res.json({ ok: true, status: "verified", purpose, transaction: verification.hash, expiresAt: payment?.entitlementExpiresAt ?? null, idempotent: saved === "same" });
}

app.get("/premium", async (req, res) => finishCheckout(req, res, "premium"));
app.get("/sponsor", async (req, res) => finishCheckout(req, res, "sponsor"));

app.get("/api/payment-intents/:id", async (req, res) => {
  const wallet = req.query.wallet;
  if (typeof wallet !== "string" || !isAddress(wallet)) { res.status(400).json({ error: "A valid wallet address is required to view this intent." }); return; }
  const store = await storePromise;
  const intent = store.read().intents.find(item => item.id === req.params.id && item.payer.toLowerCase() === wallet.toLowerCase());
  if (!intent) { res.status(404).json({ error: "Payment intent not found." }); return; }
  const awaitingSettlement = store.read().pending.some(item => item.intentId === intent.id && item.firstSeenAt <= Date.parse(intent.expiresAt));
  if (intent.status === "pending" && Date.parse(intent.expiresAt) <= Date.now() && !awaitingSettlement) {
    await store.transact(state => { const expired = state.intents.find(item => item.id === intent.id); if (expired?.status === "pending") expired.status = "expired"; });
  }
  await reconcilePending();
  const latestState = (await storePromise).read();
  const updated = latestState.intents.find(item => item.id === intent.id)!;
  const payment = latestState.payments.find(item => item.intentId === intent.id);
  res.setHeader("Cache-Control", "no-store").json({ ...publicIntent(updated), entitlementExpiresAt: payment?.entitlementExpiresAt ?? null });
});

app.get("/api/entitlements", async (req, res) => {
  const wallet = await walletForAccessRequest(req);
  if (!wallet) { res.status(401).json({ error: "Sign the one-time wallet access challenge to check this wallet's entitlement." }); return; }
  const entitlement = getActiveEntitlement((await storePromise).read().payments, wallet);
  res.setHeader("Cache-Control", "no-store").json({ active: Boolean(entitlement), expiresAt: entitlement?.entitlementExpiresAt ?? null, package: entitlement ? "30-day premium study access" : null });
});

app.post("/api/access-challenges", async (req, res) => {
  const wallet = (req.body as { wallet?: unknown } | undefined)?.wallet;
  if (typeof wallet !== "string" || !isAddress(wallet)) { res.status(400).json({ error: "A valid wallet address is required." }); return; }
  const challenge = await issueAccessChallenge(await storePromise, wallet);
  res.setHeader("Cache-Control", "no-store").json({ id: challenge.id, message: challenge.message, expiresAt: challenge.expiresAt });
});

app.post("/api/access-sessions", async (req, res) => {
  const body = req.body as { challengeId?: unknown; wallet?: unknown; signature?: unknown } | undefined;
  if (typeof body?.challengeId !== "string" || typeof body.wallet !== "string" || !isAddress(body.wallet) || typeof body.signature !== "string") {
    res.status(400).json({ error: "A wallet, access challenge, and wallet signature are required." }); return;
  }
  const session = await createAccessSession(await storePromise, body.challengeId, body.wallet, body.signature);
  if (!session) { res.status(401).json({ error: "The wallet signature was invalid, expired, or already used." }); return; }
  const entitlement = getActiveEntitlement((await storePromise).read().payments, body.wallet);
  res.setHeader("Cache-Control", "no-store").json({ accessToken: session.token, expiresAt: session.expiresAt, entitlement: { active: Boolean(entitlement), expiresAt: entitlement?.entitlementExpiresAt ?? null, package: entitlement ? "30-day premium study access" : null } });
});

async function walletForAccessRequest(req: Request): Promise<Address | null> {
  const header = req.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return accessSessionWallet(await storePromise, header.slice(7));
}

app.get("/api/premium/content", async (req, res) => {
  const wallet = await walletForAccessRequest(req);
  if (!wallet) { res.status(401).json({ error: "Sign the one-time wallet access challenge to continue." }); return; }
  const state = (await storePromise).read();
  const entitlement = getActiveEntitlement(state.payments, wallet);
  if (!entitlement) { res.status(403).json({ error: "Active verified premium access is required." }); return; }
  res.setHeader("Cache-Control", "no-store").json({ access: { expiresAt: entitlement.entitlementExpiresAt, transaction: entitlement.hash }, content: premiumReviewPack });
});

function validRequesterKey(value: unknown): value is string { return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function hashRequesterKey(value: string): string { return createHash("sha256").update(value).digest("hex"); }
app.post("/api/sponsorship/requests", async (req, res) => {
  const key = (req.body as { requesterKey?: unknown } | undefined)?.requesterKey;
  if (!validRequesterKey(key)) { res.status(400).json({ error: "A valid private request key is required." }); return; }
  const requesterKeyHash = hashRequesterKey(key);
  const result = await createSponsorshipRequest(await storePromise, requesterKeyHash);
  res.status(result.duplicate ? 200 : 201).json({ requestId: result.request.id, status: result.request.status, createdAt: result.request.createdAt,
    duplicate: result.duplicate, ...(!result.duplicate ? { message: "Your private request is recorded as pending review. It is not an approval or a funded grant." } : {}) });
});

app.post("/api/sponsorship/status", async (req, res) => {
  const key = (req.body as { requesterKey?: unknown } | undefined)?.requesterKey;
  if (!validRequesterKey(key)) { res.status(400).json({ error: "A valid private request key is required." }); return; }
  const hash = hashRequesterKey(key);
  const request = (await storePromise).read().sponsorshipRequests.find(item => item.requesterKeyHash === hash);
  if (!request) { res.status(404).json({ error: "No request was found for this browser." }); return; }
  res.setHeader("Cache-Control", "no-store").json({ requestId: request.id, status: request.status, createdAt: request.createdAt, updatedAt: request.updatedAt });
});

app.get("/api/sponsorship/summary", async (_req, res) => {
  const state = (await storePromise).read();
  const contributions = state.payments.filter(payment => payment.purpose === "sponsor");
  const totalAtomic = contributions.reduce((total, payment) => total + BigInt(payment.amount), 0n);
  res.setHeader("Cache-Control", "no-store").json({
    contributionCount: contributions.length, confirmedMUsdAtomic: totalAtomic.toString(), pendingRequests: state.sponsorshipRequests.filter(item => item.status === "pending").length,
    grantsIssued: 0, allocationStatus: "No grant allocation or admin review has been configured.",
    contributions: contributions.sort((a, b) => b.verifiedAt.localeCompare(a.verifiedAt)).slice(0, 20).map(payment => ({ hash: payment.hash, amount: payment.amount, verifiedAt: payment.verifiedAt, payTo: payment.payTo }))
  });
});

app.get("/api/history", async (_req, res) => {
  await reconcilePending();
  const state = (await storePromise).read();
  res.setHeader("Cache-Control", "no-store").json({ source: "verified_nursebridge_records", persistence: "single_instance_json_file", payments: state.payments.map(({ hash, payTo, amount, verifiedAt, purpose, entitlementExpiresAt }) => ({ hash, payTo, amount, verifiedAt, purpose, entitlementExpiresAt })), pendingCount: state.pending.length });
});

app.get("/api/access/:hash", async (req, res) => {
  if (!validHash(req.params.hash)) { res.status(400).json({ error: "A valid transaction hash is required." }); return; }
  const wallet = await walletForAccessRequest(req);
  if (!wallet) { res.status(401).json({ error: "Sign the one-time wallet access challenge to continue." }); return; }
  const payment = (await storePromise).read().payments.find(record => record.hash.toLowerCase() === req.params.hash.toLowerCase());
  if (!payment || payment.payer.toLowerCase() !== wallet.toLowerCase() || payment.purpose !== "premium" || !payment.entitlementExpiresAt || Date.parse(payment.entitlementExpiresAt) <= Date.now()) { res.status(403).json({ error: "No active premium entitlement was found for this wallet and transaction." }); return; }
  res.setHeader("Cache-Control", "no-store").json({ ok: true, payment: { hash: payment.hash, verifiedAt: payment.verifiedAt, expiresAt: payment.entitlementExpiresAt }, data: premiumReviewPack });
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (res.headersSent) return;
  console.error("NurseBridge request failed", error instanceof Error ? error.name : "unknown error");
  res.status(500).json({ error: "The request could not be completed. Please try again." });
});

if (process.env.NODE_ENV === "production") app.use(express.static("dist", { index: "index.html", maxAge: "1h" }));
void storePromise.then(() => {
  app.listen(config.port, () => console.info(`NurseBridge listening on http://localhost:${config.port} (${TESTNET.network}); payment routes ${config.payTo || config.sponsorTo ? "configured" : "disabled"}.`));
}).catch(error => {
  console.error("NurseBridge data store could not be opened", error instanceof Error ? error.name : "unknown error");
  process.exitCode = 1;
});
