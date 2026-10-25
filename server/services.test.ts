import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { createJsonStore } from "./store.js";
import { accessSessionWallet, createAccessSession, createSponsorshipRequest, getActiveEntitlement, issueAccessChallenge, saveVerifiedPayment, validatePaymentIntent } from "./services.js";
import { TESTNET } from "./config.js";

const wallet = "0x1111111111111111111111111111111111111111" as const;
const other = "0x2222222222222222222222222222222222222222" as const;
const hash = `0x${"a".repeat(64)}` as const;
const now = Date.parse("2026-10-24T00:00:00.000Z");
const sampleIntent = (id: string, purpose: "premium" | "sponsor" = "premium") => ({
  id, payer: wallet, purpose, payTo: other, amountUsd: "0.001", amountAtomic: "1000000000000000", network: TESTNET.network,
  token: TESTNET.musd, createdAt: new Date(now).toISOString(), expiresAt: new Date(now + 60_000).toISOString(), status: "pending" as const
});
async function withStore(run: (store: Awaited<ReturnType<typeof createJsonStore>>) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), "nursebridge-service-"));
  try { await run(await createJsonStore(join(directory, "state.json"))); }
  finally { await rm(directory, { recursive: true, force: true }); }
}

describe("server-side access and sponsor services", () => {
  it("rejects missing, wrong-wallet, wrong-purpose, used, and expired intents", () => {
    const intent = sampleIntent("intent-1");
    expect(validatePaymentIntent(undefined, "premium", wallet, now)).toBe("missing");
    expect(validatePaymentIntent(intent, "premium", other, now)).toBe("wrong_wallet");
    expect(validatePaymentIntent(intent, "sponsor", wallet, now)).toBe("wrong_purpose");
    expect(validatePaymentIntent({ ...intent, status: "verified" }, "premium", wallet, now)).toBe("already_used");
    expect(validatePaymentIntent(intent, "premium", wallet, now + 60_000)).toBe("expired");
  });
  it("grants only after a matching verified transfer and rejects an expired intent", async () => withStore(async store => {
    await store.transact(state => { state.intents.push(sampleIntent("active"), sampleIntent("expired")); });
    const transfer = { hash, payer: wallet, payTo: other, amount: 1000000000000000n };
    expect(await saveVerifiedPayment(store, "active", transfer, now)).toBe("saved");
    expect(await saveVerifiedPayment(store, "active", transfer, now)).toBe("same");
    const expiry = new Date(now + 30 * 24 * 60 * 60_000).toISOString();
    expect(store.read().payments[0].verifiedAt).toBe(new Date(now).toISOString());
    expect(store.read().payments[0].entitlementExpiresAt).toBe(expiry);
    expect(getActiveEntitlement(store.read().payments, wallet, now)?.entitlementExpiresAt).toBe(expiry);
    expect(getActiveEntitlement(store.read().payments, wallet, Date.parse(expiry))).toBeUndefined();
    expect(await saveVerifiedPayment(store, "expired", { ...transfer, hash: `0x${"b".repeat(64)}` }, now + 60_000)).toBe("expired");
    expect(store.read().payments).toHaveLength(1);
  }));
  it("prevents a transaction hash from being used for a second intent", async () => withStore(async store => {
    await store.transact(state => { state.intents.push(sampleIntent("first"), sampleIntent("second")); });
    const transfer = { hash, payer: wallet, payTo: other, amount: 1000000000000000n };
    expect(await saveVerifiedPayment(store, "first", transfer, now)).toBe("saved");
    expect(await saveVerifiedPayment(store, "second", transfer, now)).toBe("duplicate");
    expect(store.read().payments).toHaveLength(1);
  }));
  it("deduplicates concurrent sponsorship requests for the same private requester key", async () => withStore(async store => {
    const result = await Promise.all(Array.from({ length: 10 }, () => createSponsorshipRequest(store, "private-key-hash", now)));
    expect(store.read().sponsorshipRequests).toHaveLength(1);
    expect(result.filter(item => item.duplicate)).toHaveLength(9);
  }));
  it("requires a one-time wallet signature for a short-lived premium content session", async () => withStore(async store => {
    const account = privateKeyToAccount(`0x${"1".repeat(64)}`);
    const challenge = await issueAccessChallenge(store, account.address, now);
    const signature = await account.signMessage({ message: challenge.message });
    const session = await createAccessSession(store, challenge.id, account.address, signature, now + 1_000);
    expect(session).not.toBeNull();
    expect(accessSessionWallet(store, session?.token, now + 2_000)?.toLowerCase()).toBe(account.address.toLowerCase());
    expect(accessSessionWallet(store, "guessed-token", now + 2_000)).toBeNull();
    await expect(createAccessSession(store, challenge.id, account.address, signature, now + 2_000)).resolves.toBeNull();
  }));
  it("rejects a signature from another wallet and an expired access challenge", async () => withStore(async store => {
    const intended = privateKeyToAccount(`0x${"2".repeat(64)}`);
    const otherAccount = privateKeyToAccount(`0x${"3".repeat(64)}`);
    const challenge = await issueAccessChallenge(store, intended.address, now);
    const wrongSignature = await otherAccount.signMessage({ message: challenge.message });
    await expect(createAccessSession(store, challenge.id, intended.address, wrongSignature, now + 1_000)).resolves.toBeNull();
    await expect(createAccessSession(store, challenge.id, intended.address, await intended.signMessage({ message: challenge.message }), now + 6 * 60_000)).resolves.toBeNull();
  }));
});
