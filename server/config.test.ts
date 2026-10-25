import { describe, expect, it } from "vitest";
import { loadConfig, loadServerConfig } from "./config.js";

const base = { PAY_TO: "0x1111111111111111111111111111111111111111" };

describe("testnet-only server configuration", () => {
  it("loads the documented testnet defaults with an explicit merchant address", () => {
    const config = loadConfig(base);
    expect(config.payTo).toBe("0x1111111111111111111111111111111111111111");
    expect(config.priceUsd).toBe("0.001");
    expect(config.priceAtomic).toBe(1000000000000000n);
    expect(config.rpcUrl).toBe("https://rpc.test.mezo.org");
  });
  it("requires a valid merchant address", () => {
    expect(() => loadConfig({ ...base, PAY_TO: "" })).toThrow(/PAY_TO/);
    expect(() => loadConfig({ ...base, PAY_TO: "not-an-address" })).toThrow(/PAY_TO/);
    expect(() => loadConfig({ ...base, PAY_TO: "0x0000000000000000000000000000000000000000" })).toThrow(/zero address/);
  });
  it("rejects unsafe prices and invalid ports", () => {
    expect(() => loadConfig({ ...base, PRICE_USD: "0" })).toThrow(/PRICE_USD/);
    expect(() => loadConfig({ ...base, PRICE_USD: "10.01" })).toThrow(/PRICE_USD/);
    expect(() => loadConfig({ ...base, PORT: "0" })).toThrow(/PORT/);
  });
  it("refuses RPC or facilitator endpoints outside the documented testnet services", () => {
    expect(() => loadConfig({ ...base, MEZO_TESTNET_RPC: "https://rpc.mezo.org" })).toThrow(/MEZO_TESTNET_RPC/);
    expect(() => loadConfig({ ...base, FACILITATOR_URL: "https://example.com" })).toThrow(/FACILITATOR_URL/);
  });
  it("allows the free-learning server to start without payment recipients and validates optional sponsor settings", () => {
    const config = loadServerConfig({});
    expect(config.payTo).toBeNull();
    expect(config.sponsorTo).toBeNull();
    expect(config.sponsorPriceUsd).toBe("0.01");
    expect(() => loadServerConfig({ SPONSOR_TO: "invalid" })).toThrow(/SPONSOR_TO/);
    expect(() => loadServerConfig({ SPONSOR_PRICE_USD: "0" })).toThrow(/SPONSOR_PRICE_USD/);
    expect(() => loadServerConfig({ ...base, SPONSOR_TO: base.PAY_TO })).toThrow(/different wallet/);
    const separated = loadServerConfig({ ...base, SPONSOR_TO: "0x2222222222222222222222222222222222222222" });
    expect(separated.payTo).not.toBe(separated.sponsorTo);
    expect(separated.sponsorPriceAtomic).toBe(10000000000000000n);
  });
});
