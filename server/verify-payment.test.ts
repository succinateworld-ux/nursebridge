import { describe, expect, it, vi } from "vitest";
import { encodeEventTopics, encodeAbiParameters, parseAbi, type Address } from "viem";
import { TESTNET } from "./config.js";
import { verifyPayment, type ChainReader, type ReceiptLog, type VerifyPaymentArgs } from "./verify-payment.js";

const payTo = "0x1111111111111111111111111111111111111111" as const;
const payer = "0x2222222222222222222222222222222222222222" as const;
const hash = `0x${"a".repeat(64)}`;
const abi = parseAbi(["event Transfer(address indexed from, address indexed to, uint256 value)"]);
const log = (token: Address = TESTNET.musd, to: Address = payTo, value = 1000000000000000n): ReceiptLog => ({
  address: token,
  topics: encodeEventTopics({ abi, eventName: "Transfer", args: { from: payer, to } }) as readonly string[],
  data: encodeAbiParameters([{ type: "uint256" }], [value])
});
function reader(receipt: { status: "success" | "reverted"; logs: ReceiptLog[] }, chainId = 31611): ChainReader {
  return { getChainId: vi.fn().mockResolvedValue(chainId), getTransactionReceipt: vi.fn().mockResolvedValue({ ...receipt, transactionHash: hash }) };
}
const request = (chain: ChainReader, extra: Partial<Pick<VerifyPaymentArgs, "network" | "txHash" | "payer">> = {}) => verifyPayment({ chain, txHash: hash, network: TESTNET.network, payer, expectedPayTo: payTo, expectedAmount: 1000000000000000n, ...extra });

describe("independent MUSD payment verification", () => {
  it("accepts a confirmed exact transfer on Mezo Testnet", async () => {
    expect(await request(reader({ status: "success", logs: [log()] }))).toMatchObject({ ok: true, payer, payTo });
  });
  it("rejects a different network", async () => expect((await request(reader({ status: "success", logs: [log()] }), { network: "eip155:31612" })).ok).toBe(false));
  
  it("rejects an RPC connected to the wrong chain", async () => {
    expect(
      (await request(reader({ status: "success", logs: [log()] }, 31612))).ok
    ).toBe(false);
  });

  it("rejects a receipt whose transaction hash differs from the settlement hash", async () => {
    const chain = reader({ status: "success", logs: [log()] });
    vi.mocked(chain.getTransactionReceipt).mockResolvedValue({ status: "success", logs: [log()], transactionHash: `0x${"b".repeat(64)}` });
    const result = await request(chain);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("different transaction");
  });
  it("rejects reverted or pending receipts", async () => {
    expect((await request(reader({ status: "reverted", logs: [log()] }))).ok).toBe(false);
    expect((await request(reader({ status: "success", logs: [] }))).ok).toBe(false);
  });
  it("rejects wrong token, merchant, amount, and payer", async () => {
    expect((await request(reader({ status: "success", logs: [log("0x3333333333333333333333333333333333333333")] }))).ok).toBe(false);
    expect((await request(reader({ status: "success", logs: [log(TESTNET.musd, payer)] }))).ok).toBe(false);
    expect((await request(reader({ status: "success", logs: [log(TESTNET.musd, payTo, 5n)] }))).ok).toBe(false);
    expect((await request(reader({ status: "success", logs: [log()] }), { payer: "0x3333333333333333333333333333333333333333" })).ok).toBe(false);
  });
  it("rejects malformed settlement hashes and reports RPC failures", async () => {
    expect((await request(reader({ status: "success", logs: [log()] }), { txHash: "not-a-hash" })).ok).toBe(false);
    const failed = reader({ status: "success", logs: [log()] });
    vi.mocked(failed.getTransactionReceipt).mockRejectedValue(new Error("not found"));
    const result = await request(failed);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("Could not confirm");
  });
});
