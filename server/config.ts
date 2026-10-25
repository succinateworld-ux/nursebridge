import "dotenv/config";
import { getAddress, isAddress, parseUnits } from "viem";

export const TESTNET = {
  chainId: 31611,
  network: "eip155:31611",
  name: "Mezo Testnet",
  rpcUrl: "https://rpc.test.mezo.org",
  explorerUrl: "https://explorer.test.mezo.org",
  musd: getAddress("0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503"),
  decimals: 18
} as const;

export interface AppConfig {
  port: number;
  payTo: `0x${string}`;
  priceUsd: string;
  priceAtomic: bigint;
  sponsorTo: `0x${string}` | null;
  sponsorPriceUsd: string;
  sponsorPriceAtomic: bigint;
  facilitatorUrl: string;
  rpcUrl: string;
}

export interface ServerConfig extends Omit<AppConfig, "payTo"> { payTo: `0x${string}` | null }

function loadServerConfigBase(env = process.env): ServerConfig {
  const payTo = env.PAY_TO;
  if (payTo && !isAddress(payTo)) throw new Error("PAY_TO must be a valid Mezo Testnet merchant wallet address.");
  if (payTo && /^0x0{40}$/i.test(payTo)) throw new Error("PAY_TO cannot be the zero address.");
  const sponsorTo = env.SPONSOR_TO;
  if (sponsorTo && !isAddress(sponsorTo)) throw new Error("SPONSOR_TO must be a valid Mezo Testnet sponsor fund wallet address.");
  if (sponsorTo && /^0x0{40}$/i.test(sponsorTo)) throw new Error("SPONSOR_TO cannot be the zero address.");
  if (payTo && sponsorTo && getAddress(payTo) === getAddress(sponsorTo)) {
    throw new Error("SPONSOR_TO must be a different wallet from PAY_TO so student fund contributions remain separately accountable.");
  }
  const priceUsd = env.PRICE_USD ?? "0.001";
  if (!/^\d+(\.\d{1,6})?$/.test(priceUsd) || Number(priceUsd) <= 0 || Number(priceUsd) > 10) {
    throw new Error("PRICE_USD must be greater than 0 and at most 10 (up to 6 decimal places).");
  }
  const sponsorPriceUsd = env.SPONSOR_PRICE_USD ?? "0.01";
  if (!/^\d+(\.\d{1,6})?$/.test(sponsorPriceUsd) || Number(sponsorPriceUsd) <= 0 || Number(sponsorPriceUsd) > 10) {
    throw new Error("SPONSOR_PRICE_USD must be greater than 0 and at most 10 (up to 6 decimal places).");
  }
  const port = Number(env.PORT ?? 4021);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be a valid TCP port.");
  const rpcUrl = env.MEZO_TESTNET_RPC ?? TESTNET.rpcUrl;
  if (rpcUrl !== TESTNET.rpcUrl) {
    throw new Error("MEZO_TESTNET_RPC must use the official Mezo Testnet RPC endpoint https://rpc.test.mezo.org.");
  }
  const facilitatorUrl = env.FACILITATOR_URL ?? "https://facilitator.vativ.io";
  if (facilitatorUrl !== "https://facilitator.vativ.io") {
    throw new Error("FACILITATOR_URL must use the official facilitator.vativ.io endpoint over HTTPS.");
  }
  return {
    port, payTo: payTo ? getAddress(payTo) : null, priceUsd, priceAtomic: parseUnits(priceUsd, TESTNET.decimals),
    sponsorTo: sponsorTo ? getAddress(sponsorTo) : null, sponsorPriceUsd,
    sponsorPriceAtomic: parseUnits(sponsorPriceUsd, TESTNET.decimals), facilitatorUrl, rpcUrl
  };
}

export function loadServerConfig(env = process.env): ServerConfig { return loadServerConfigBase(env); }

export function loadConfig(env = process.env): AppConfig {
  const config = loadServerConfigBase(env);
  if (!config.payTo) throw new Error("PAY_TO must be a valid Mezo Testnet merchant wallet address.");
  return { ...config, payTo: config.payTo };
}
