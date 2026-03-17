import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";

const config = new AptosConfig({ network: Network.MAINNET });
export const aptos = new Aptos(config);

// Circle USDC on Aptos (Bridged via LayerZero?) - Verify address matches user's existing constant
export const APTOS_USDC_ADDRESS = '0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDC';
