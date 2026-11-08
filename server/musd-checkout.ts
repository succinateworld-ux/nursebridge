import type { RouteConfig, SettleResultContext, VerifyResultContext, HTTPTransportContext } from "@x402/core/server";
import type { Address } from "viem";
import { TESTNET } from "./config.js";
import { declareEip2612GasSponsoringExtension } from "@x402/extensions";
import { evmPaywall } from "@x402/paywall/evm";

// @x402/paywall 2.28.0 drops readContract when adapting its extended wallet
// client. Without it ExactEvmScheme silently skips the EIP-2612 permit.
// Keep this narrow compatibility fix guarded against upstream template changes.
export const musdPaywall: typeof evmPaywall = {
  ...evmPaywall,
  generateHtml(requirement, paymentRequired, config) {
    const html = evmPaywall.generateHtml(requirement, paymentRequired, config);
    const original = "return{address:e.account.address,signTypedData:";
    if (html.split(original).length !== 2) throw new Error("Review pinned x402 paywall signer compatibility patch before deploying.");
    return html.replace(original, "return{address:e.account.address,readContract:t=>e.readContract(t),signTypedData:");
  }
};

// Pin both the token and signing domain. MUSD uses Permit2 with EIP-2612,
// not transferWithAuthorization (EIP-3009).
export function musdRoute(payTo: Address, amount: bigint, description: string): RouteConfig {
  const permit = declareEip2612GasSponsoringExtension().eip2612GasSponsoring;
  return {
    accepts: [{ scheme: "exact", network: TESTNET.network, payTo, maxTimeoutSeconds: 120,
      price: { asset: TESTNET.musd, amount: amount.toString(),
        extra: { assetTransferMethod: "permit2", name: "Mezo USD", version: "1" } } }],
    description, mimeType: "application/json",
    // The client replaces extension info with signed permit fields. Advertise
    // only the invariant version: echo validation requires every advertised
    // info field, while the helper's descriptive sentence is not echoed.
    extensions: { eip2612GasSponsoring: { ...permit, info: { version: "1" } } }
  };
}

export function checkoutIntentId(context: Pick<SettleResultContext | VerifyResultContext, "transportContext">): string | null {
  const transport = context.transportContext as HTTPTransportContext | undefined;
  const id = transport?.request?.adapter?.getQueryParam?.("intent");
  return typeof id === "string" ? id : null;
}
