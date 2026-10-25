import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

export type PaymentPurpose = "premium" | "sponsor";
export interface PaymentIntent {
  id: string; payer: `0x${string}`; purpose: PaymentPurpose; payTo: `0x${string}`; amountUsd: string; amountAtomic: string;
  network: string; token: `0x${string}`; createdAt: string; expiresAt: string; status: "pending" | "verified" | "expired" | "failed"; txHash?: `0x${string}`;
}
export interface PaymentRecord {
  hash: `0x${string}`; payer: `0x${string}`; payTo: `0x${string}`; amount: string; verifiedAt: string; purpose: PaymentPurpose;
  intentId: string; entitlementExpiresAt?: string;
}
export interface PendingSettlement { hash: `0x${string}`; payer: `0x${string}`; purpose: PaymentPurpose; intentId: string; firstSeenAt: number; checkedAt: number }
export interface SponsorshipRequest { id: string; requesterKeyHash: string; status: "pending" | "approved" | "rejected" | "cancelled"; createdAt: string; updatedAt: string }
export interface AccessChallenge { id: string; wallet: `0x${string}`; message: string; createdAt: string; expiresAt: string; usedAt?: string }
export interface AccessSession { tokenHash: string; wallet: `0x${string}`; createdAt: string; expiresAt: string }
export interface StoreState {
  version: 1; intents: PaymentIntent[]; payments: PaymentRecord[]; pending: PendingSettlement[]; sponsorshipRequests: SponsorshipRequest[];
  accessChallenges: AccessChallenge[]; accessSessions: AccessSession[];
}
const initialState = (): StoreState => ({ version: 1, intents: [], payments: [], pending: [], sponsorshipRequests: [], accessChallenges: [], accessSessions: [] });
export interface JsonStore { read(): StoreState; transact<T>(change: (draft: StoreState) => T | Promise<T>): Promise<T> }

function parseState(raw: unknown): StoreState {
  if (!raw || typeof raw !== "object") throw new Error("NurseBridge data file is not a valid object.");
  const value = raw as Partial<StoreState>;
  if (value.version !== 1 || !Array.isArray(value.intents) || !Array.isArray(value.payments) || !Array.isArray(value.pending) || !Array.isArray(value.sponsorshipRequests) || !Array.isArray(value.accessChallenges) || !Array.isArray(value.accessSessions)) {
    throw new Error("NurseBridge data file has an unsupported or invalid schema. Back it up and restore a valid version 1 data file.");
  }
  return value as StoreState;
}

export async function createJsonStore(filePath: string): Promise<JsonStore> {
  await mkdir(dirname(filePath), { recursive: true, mode: 0o700 });
  let state = initialState();
  try { state = parseState(JSON.parse(await readFile(filePath, "utf8"))); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  let queue: Promise<void> = Promise.resolve();
  const persist = async (draft: StoreState) => {
    const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(draft), { encoding: "utf8", flag: "wx", mode: 0o600 });
    await rename(temporaryPath, filePath);
  };
  return {
    read: () => structuredClone(state),
    transact<T>(change: (draft: StoreState) => T | Promise<T>): Promise<T> {
      const operation = queue.then(async () => {
        const draft = structuredClone(state);
        const result = await change(draft);
        await persist(draft);
        state = draft;
        return result;
      });
      queue = operation.then(() => undefined, () => undefined);
      return operation;
    }
  };
}
