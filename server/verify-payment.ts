import { decodeEventLog, getAddress, isAddress, isHex, parseAbi, type Address, type Hash } from "viem";
import { TESTNET } from "./config.js";

const transferEvent = parseAbi(["event Transfer(address indexed from, address indexed to, uint256 value)"])[0];

export interface ReceiptLog { address: string; topics: readonly string[]; data: string }
export interface TxReceipt { status: "success" | "reverted"; logs: readonly ReceiptLog[]; transactionHash: string }
export interface ChainReader {
  getChainId(): Promise<number>;
  getTransactionReceipt(args: { hash: Hash }): Promise<TxReceipt>;
}
export interface VerifyPaymentArgs {
  chain: ChainReader;
  txHash: string;
  network: string;
  payer?: string;
  expectedPayTo: Address;
  expectedAmount: bigint;
}
export type Verification = { ok: true; hash: Hash; payer: Address; payTo: Address; amount: bigint } | { ok: false; reason: string };

export async function verifyPayment(args: VerifyPaymentArgs): Promise<Verification> {
  const { txHash, chain, expectedPayTo, expectedAmount } = args;
  if (args.network !== TESTNET.network) return { ok: false, reason: "Payment is for a different network." };
  if (!isHex(txHash, { strict: true }) || txHash.length !== 66) return { ok: false, reason: "Settlement did not include a valid transaction hash." };
  if (expectedAmount <= 0n || !isAddress(expectedPayTo)) return { ok: false, reason: "Merchant payment configuration is invalid." };
  try {
    if (await chain.getChainId() !== TESTNET.chainId) return { ok: false, reason: "RPC endpoint is not connected to Mezo Testnet." };
    const receipt = await chain.getTransactionReceipt({ hash: txHash as Hash });
    if (receipt.transactionHash.toLowerCase() !== txHash.toLowerCase()) return { ok: false, reason: "RPC returned a receipt for a different transaction." };
    if (receipt.status !== "success") return { ok: false, reason: "The payment transaction reverted." };
    const transfers: { from: Address; to: Address; value: bigint }[] = [];
    for (const log of receipt.logs) {
      if (getAddress(log.address) !== TESTNET.musd) continue;
      try {
        const decoded = decodeEventLog({ abi: [transferEvent], data: log.data as `0x${string}`, topics: log.topics as [ `0x${string}`, ...`0x${string}`[] ] });
        if (decoded.eventName === "Transfer") transfers.push(decoded.args as { from: Address; to: Address; value: bigint });
      } catch { /* Ignore unrelated logs from the MUSD contract. */ }
    }
    const matching = transfers.find(log => getAddress(log.to) === getAddress(expectedPayTo) && log.value === expectedAmount && (!args.payer || (isAddress(args.payer) && getAddress(log.from) === getAddress(args.payer))));
    if (!matching) return { ok: false, reason: "No MUSD transfer with the expected sender, recipient, and amount was found in the receipt." };
    return { ok: true, hash: txHash as Hash, payer: getAddress(matching.from), payTo: getAddress(matching.to), amount: matching.value };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "RPC lookup failed";
    return { ok: false, reason: `Could not confirm the transaction on Mezo Testnet: ${msg}` };
  }
}
