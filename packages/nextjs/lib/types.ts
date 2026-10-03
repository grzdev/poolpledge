import type { Pool } from "@poolpledge/core";
export type PoolData = Pool & { symbols: string[]; underlyingDecimals: number[]; balance: string | null; allowance: string | null; account: string | null; chainTime: number };
export type LockData = { symbols: string[]; id: string; depositor: string; beneficiary: string; pair: string; token: string; amount: string; unlockAt: number; withdrawn: boolean; decimals: number; chainTime: number; observedAt: string };
