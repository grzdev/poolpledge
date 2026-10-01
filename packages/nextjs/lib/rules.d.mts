import type { Eip1193Provider } from "ethers";
export function validateLock(amount: string, decimals: number, balance: string, unlockDate: string, nowSeconds: number): {units: bigint; unlockAt: number};
export function withdrawalState(lock: {withdrawn: boolean; unlockAt: number; beneficiary: string}, account: string, chain: string, nowSeconds: number): string;
export function requireWallet(ethereum: Eip1193Provider | undefined, expectedAccount: string): Promise<void>;
export function walletError(error: unknown): string;
