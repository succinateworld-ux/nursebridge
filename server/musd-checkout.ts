import type { RouteConfig, SettleResultContext, VerifyResultContext, HTTPTransportContext } from "@x402/core/server";
import type { Address } from "viem";
import { TESTNET } from "./config.js";

// Pin both the token and signing domain. MUSD uses Permit2 with EIP-2612,
// not transferWithAuthorization (EIP-3009).
export function musdRoute(payTo: Address, amount: bigint, description: string): RouteConfig {
  return {
    accepts: [{ scheme: "exact", network: TESTNET.network, payTo, maxTimeoutSeconds: 120,
      price: { asset: TESTNET.musd, amount: amount.toString(),
        extra: { assetTransferMethod: "permit2", name: "Mezo USD", version: "1" } } }],
    description, mimeType: "application/json"
  };
}

export function checkoutIntentId(context: Pick<SettleResultContext | VerifyResultContext, "transportContext">): string | null {
  const transport = context.transportContext as HTTPTransportContext | undefined;
  const id = transport?.request?.adapter?.getQueryParam?.("intent");
  return typeof id === "string" ? id : null;
}
