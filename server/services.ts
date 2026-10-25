import { createHash, randomBytes, randomUUID } from "node:crypto";
import { getAddress, verifyMessage, type Address, type Hash } from "viem";
import type { AccessChallenge, JsonStore, PaymentIntent, PaymentPurpose, PaymentRecord, SponsorshipRequest } from "./store.js";

export interface VerifiedTransfer { hash: Hash; payer: Address; payTo: Address; amount: bigint }
export type SavePaymentResult = "saved" | "same" | "duplicate" | "expired";

export async function saveVerifiedPayment(store: JsonStore, intentId: string, transfer: VerifiedTransfer, now = Date.now()): Promise<SavePaymentResult> {
  return store.transact(state => {
    const existing = state.payments.find(payment => payment.hash.toLowerCase() === transfer.hash.toLowerCase());
    if (existing) return existing.intentId === intentId ? "same" : "duplicate";
    const intent = state.intents.find(item => item.id === intentId);
    if (!intent || intent.status !== "pending") return "duplicate";
    if (intent.payTo.toLowerCase() !== transfer.payTo.toLowerCase() || intent.payer.toLowerCase() !== transfer.payer.toLowerCase() || BigInt(intent.amountAtomic) !== transfer.amount) return "duplicate";
    const deadline = Date.parse(intent.expiresAt);
    const pending = state.pending.find(item => item.hash.toLowerCase() === transfer.hash.toLowerCase() && item.intentId === intentId && item.firstSeenAt <= deadline);
    if (now >= deadline && !pending) { intent.status = "expired"; return "expired"; }
    let entitlementExpiresAt: string | undefined;
    if (intent.purpose === "premium") {
      const prior = state.payments.filter(payment => payment.purpose === "premium" && payment.payer.toLowerCase() === transfer.payer.toLowerCase() && payment.entitlementExpiresAt && Date.parse(payment.entitlementExpiresAt) > now)
        .reduce((latest, payment) => Math.max(latest, Date.parse(payment.entitlementExpiresAt!)), 0);
      entitlementExpiresAt = new Date(Math.max(now, prior) + 30 * 24 * 60 * 60_000).toISOString();
    }
    const payment: PaymentRecord = {
      hash: transfer.hash, payer: transfer.payer, payTo: transfer.payTo, amount: transfer.amount.toString(), verifiedAt: new Date(now).toISOString(),
      purpose: intent.purpose, intentId: intent.id, ...(entitlementExpiresAt ? { entitlementExpiresAt } : {})
    };
    state.payments.push(payment);
    intent.status = "verified"; intent.txHash = transfer.hash;
    state.pending = state.pending.filter(item => item.hash.toLowerCase() !== transfer.hash.toLowerCase());
    return "saved";
  });
}

export async function createSponsorshipRequest(store: JsonStore, requesterKeyHash: string, now = Date.now()): Promise<{ request: SponsorshipRequest; duplicate: boolean }> {
  return store.transact(state => {
    const prior = state.sponsorshipRequests.find(item => item.requesterKeyHash === requesterKeyHash && item.status === "pending");
    if (prior) return { request: prior, duplicate: true };
    const timestamp = new Date(now).toISOString();
    const request: SponsorshipRequest = { id: randomUUID(), requesterKeyHash, status: "pending", createdAt: timestamp, updatedAt: timestamp };
    state.sponsorshipRequests.push(request);
    return { request, duplicate: false };
  });
}

export function validatePaymentIntent(intent: PaymentIntent | undefined, purpose: PaymentPurpose, wallet: string, now = Date.now()): "valid" | "missing" | "wrong_wallet" | "wrong_purpose" | "already_used" | "expired" {
  if (!intent) return "missing";
  if (intent.purpose !== purpose) return "wrong_purpose";
  if (intent.payer.toLowerCase() !== wallet.toLowerCase()) return "wrong_wallet";
  if (intent.status === "verified") return "already_used";
  if (intent.status !== "pending" || Date.parse(intent.expiresAt) <= now) return "expired";
  return "valid";
}

const sessionLifetimeMs = 30 * 60_000;
const challengeLifetimeMs = 5 * 60_000;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

export async function issueAccessChallenge(store: JsonStore, rawWallet: string, now = Date.now()): Promise<AccessChallenge> {
  const wallet = getAddress(rawWallet);
  const id = randomUUID();
  const createdAt = new Date(now).toISOString();
  const expiresAt = new Date(now + challengeLifetimeMs).toISOString();
  const message = [
    "NurseBridge premium content access",
    "This signature proves wallet control. It does not authorize a payment or transaction.",
    `Wallet: ${wallet}`,
    "Network: eip155:31611",
    `Challenge: ${id}`,
    `Expires: ${expiresAt}`
  ].join("\n");
  const challenge: AccessChallenge = { id, wallet, message, createdAt, expiresAt };
  await store.transact(state => {
    state.accessChallenges = state.accessChallenges.filter(item => Date.parse(item.expiresAt) > now && !item.usedAt).slice(-200);
    state.accessChallenges.push(challenge);
  });
  return challenge;
}

export async function createAccessSession(store: JsonStore, challengeId: string, rawWallet: string, signature: string, now = Date.now()): Promise<{ token: string; expiresAt: string } | null> {
  if (!/^0x[0-9a-f]{130}$/i.test(signature)) return null;
  const wallet = getAddress(rawWallet);
  const challenge = store.read().accessChallenges.find(item => item.id === challengeId);
  if (!challenge || challenge.wallet.toLowerCase() !== wallet.toLowerCase() || challenge.usedAt || Date.parse(challenge.expiresAt) <= now) return null;
  let valid = false;
  try { valid = await verifyMessage({ address: wallet, message: challenge.message, signature: signature as `0x${string}` }); }
  catch { return null; }
  if (!valid) return null;
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now + sessionLifetimeMs).toISOString();
  const saved = await store.transact(state => {
    const current = state.accessChallenges.find(item => item.id === challengeId);
    if (!current || current.wallet.toLowerCase() !== wallet.toLowerCase() || current.usedAt || Date.parse(current.expiresAt) <= now) return false;
    current.usedAt = new Date(now).toISOString();
    state.accessSessions = state.accessSessions.filter(item => Date.parse(item.expiresAt) > now).slice(-500);
    state.accessSessions.push({ tokenHash: digest(token), wallet, createdAt: new Date(now).toISOString(), expiresAt });
    return true;
  });
  return saved ? { token, expiresAt } : null;
}

export function accessSessionWallet(store: JsonStore, token: string | undefined, now = Date.now()): Address | null {
  if (!token || token.length > 200) return null;
  const tokenHash = digest(token);
  const session = store.read().accessSessions.find(item => item.tokenHash === tokenHash && Date.parse(item.expiresAt) > now);
  return session?.wallet ?? null;
}

export function getActiveEntitlement(payments: PaymentRecord[], wallet: string, now = Date.now()): PaymentRecord | undefined {
  return payments.filter(payment => payment.purpose === "premium" && payment.payer.toLowerCase() === wallet.toLowerCase() && payment.entitlementExpiresAt && Date.parse(payment.entitlementExpiresAt) > now)
    .sort((a, b) => Date.parse(b.entitlementExpiresAt!) - Date.parse(a.entitlementExpiresAt!))[0];
}
