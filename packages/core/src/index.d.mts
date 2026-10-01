import type { ContractRunner, JsonRpcProvider } from "ethers";
export const TESTNET: Readonly<{chainId: number; rpc: string; mirror: string; explorer: string; factory: string; router: string; whbar: string; sauce: string}>;
export const TOKEN_ABI: string[];
export const LOCK_ABI: string[];
export const PAIR_ABI: string[];
export const FACTORY_ABI: string[];
export const ROUTER_ABI: string[];
export interface Pool { pair: string; factory: string; token0: string; token1: string; lpToken: string; lpTokenId: string; decimals: number; reserve0: string; reserve1: string; totalSupply: string; hasLiquidity: boolean; observedAt: string; network: string }
export function address(value: unknown): string;
export function nativeId(value: string): string;
export function amountUnits(value: string, decimals: number): bigint;
export function lockId(value: string): bigint;
export function provider(url?: string): JsonRpcProvider;
export function assertTestnet(rpc: JsonRpcProvider): Promise<void>;
export function discoverPair(runner: ContractRunner): Promise<string>;
export function readPool(pair: string, runner: ContractRunner): Promise<Pool>;
export function message(error: unknown): string;
export function mirrorGet(path: string, fetcher?: typeof fetch): Promise<Record<string, unknown>>;
