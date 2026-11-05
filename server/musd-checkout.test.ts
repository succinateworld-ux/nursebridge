import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { createPaywall } from "@x402/paywall";
import { evmPaywall } from "@x402/paywall/evm";
import type { FacilitatorClient } from "@x402/core/server";
import { musdRoute, checkoutIntentId } from "./musd-checkout.js";
import { TESTNET } from "./config.js";

const payer = "0x1111111111111111111111111111111111111111";
const payTo = "0x2222222222222222222222222222222222222222";
const hash = `0x${"a".repeat(64)}`;
const servers: Server[] = [];
afterEach(async () => { for (const server of servers.splice(0)) await new Promise<void>(resolve => server.close(() => resolve())); });

describe("MUSD x402 checkout lifecycle", () => {
  it("advertises MUSD and its permit domain, then settles after a successful acknowledgement", async () => {
    const settle = vi.fn(async () => ({ success: true, network: TESTNET.network, transaction: hash, payer }));
    const facilitator: FacilitatorClient = {
      getSupported: async () => ({ kinds: [{ x402Version: 2, scheme: "exact", network: TESTNET.network,
        extra: { assetTransferMethod: "permit2" } }], extensions: [], signers: {} }),
      verify: async () => ({ isValid: true, payer }), settle
    };
    const resource = new x402ResourceServer(facilitator).register(TESTNET.network, new ExactEvmScheme());
    const recorded: string[] = [];
    resource.onAfterSettle(async context => {
      expect(checkoutIntentId(context)).toBe("intent-1");
      recorded.push(context.result.transaction);
    });
    const app = express();
    app.use(paymentMiddleware({ "GET /premium": musdRoute(payTo, 1000000000000000n, "Premium") }, resource,
      { appName: "NurseBridge", testnet: true }, createPaywall().withNetwork(evmPaywall).build()));
    app.get("/premium", (_req, res) => {
      expect(res.getHeader("PAYMENT-RESPONSE")).toBeUndefined();
      expect(settle).not.toHaveBeenCalled();
      res.json({ status: "pending" });
    });
    const server = app.listen(0, "127.0.0.1"); servers.push(server);
    await new Promise<void>(resolve => server.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing test server port");
    const url = `http://127.0.0.1:${address.port}/premium?intent=intent-1`;
    const unpaid = await fetch(url);
    expect(unpaid.status).toBe(402);
    const required = JSON.parse(Buffer.from(unpaid.headers.get("payment-required")!, "base64").toString());
    const accepted = required.accepts[0];
    expect(accepted.asset).toBe(TESTNET.musd);
    expect(accepted.amount).toBe("1000000000000000");
    expect(accepted.extra).toMatchObject({ name: "Mezo USD", version: "1", assetTransferMethod: "permit2" });
    expect(settle).not.toHaveBeenCalled();
    const html = await fetch(url, { headers: { Accept: "text/html", "User-Agent": "Mozilla/5.0" } });
    expect(html.status).toBe(402);
    expect(html.headers.get("content-type")).toContain("text/html");
    const signature = Buffer.from(JSON.stringify({ x402Version: 2, resource: required.resource,
      accepted, payload: {} })).toString("base64");
    const paid = await fetch(url, { headers: { "PAYMENT-SIGNATURE": signature } });
    expect(paid.status).toBe(200);
    expect(await paid.json()).toEqual({ status: "pending" });
    expect(settle).toHaveBeenCalledOnce();
    expect(recorded).toEqual([hash]);
    expect(paid.headers.get("payment-response")).toBeTruthy();
  }, 20000);
});
