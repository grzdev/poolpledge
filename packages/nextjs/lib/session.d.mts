import type { Eip1193Provider } from "ethers";
export function walletScope(deployment: string, chain: string, account: string): string;
export function savedTransaction(raw: string | null): {hash: string; label: string} | null;
export function lockStatus(lock: {withdrawn: boolean; unlockAt: number}, now: number): string;
export function scanIds(total: bigint, cursor: string | null, size?: bigint): {ids: bigint[]; nextCursor: string | null};
export function legacyWalletName(provider: Eip1193Provider & {isOkxWallet?: boolean; isOKExWallet?: boolean; isMetaMask?: boolean; isCoinbaseWallet?: boolean}): string;
export function reconcileReference<T>(raw: string | null, readReceipt: (hash: string) => Promise<T>): Promise<{reference: {hash: string; label: string}; receipt: T} | null>;
