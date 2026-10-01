import { Contract, FetchRequest, JsonRpcProvider, getAddress, isAddress, ZeroAddress } from "ethers";

export const TESTNET = Object.freeze({
  chainId: 296,
  rpc: "https://testnet.hashio.io/api",
  mirror: "https://testnet.mirrornode.hedera.com/api/v1",
  explorer: "https://hashscan.io/testnet",
  factory: "0x00000000000000000000000000000000000026e7",
  router: "0x0000000000000000000000000000000000004b40",
  whbar: "0x0000000000000000000000000000000000003ad2",
  sauce: `0x${BigInt(1183558).toString(16).padStart(40, "0")}`,
});
export const FACTORY_ABI = ["function getPair(address,address) view returns(address)"];
export const PAIR_ABI = [
  "function factory() view returns(address)", "function token0() view returns(address)",
  "function token1() view returns(address)", "function lpToken() view returns(address)",
  "function getReserves() view returns(uint112,uint112,uint32)",
];
export const TOKEN_ABI = [
  "function balanceOf(address) view returns(uint256)", "function allowance(address,address) view returns(uint256)",
  "function approve(address,uint256) returns(bool)", "function totalSupply() view returns(uint256)",
  "function decimals() view returns(uint8)", "function associate() returns(int64)",
  "function isAssociated() view returns(bool)",
];
export const ROUTER_ABI = [
  "function factory() view returns(address)",
  "function getAmountsOut(uint256,address[]) view returns(uint256[])",
  "function swapExactETHForTokens(uint256,address[],address,uint256) payable returns(uint256[])",
  "function addLiquidityETH(address,uint256,uint256,uint256,address,uint256) payable returns(uint256,uint256,uint256)",
];
export const LOCK_ABI = [
  "function factory() view returns(address)",
  "function registerPair(address) returns(address)",
  "function registeredToken(address) view returns(address)",
  "function totalLocked(address) view returns(uint256)",
  "function nextLockId() view returns(uint256)",
  "function locks(uint256) view returns(address depositor,address beneficiary,address pair,address token,uint256 amount,uint64 unlockAt,bool withdrawn)",
  "function createLock(address,uint256,address,uint64) returns(uint256)",
  "function withdraw(uint256)",
  "event Locked(uint256 indexed id,address indexed depositor,address indexed beneficiary,address pair,address token,uint256 amount,uint64 unlockAt)",
  "event PairRegistered(address indexed pair,address indexed token)",
  "error InvalidFactory()", "error InvalidPair()", "error InvalidLock()", "error HtsAssociationFailed(int64)",
  "error TransferFailed()", "error BalanceMismatch()", "error Unauthorized()", "error NotMature()", "error AlreadyWithdrawn()", "error Reentrant()",
];

export function address(value) {
  if (typeof value !== "string" || !isAddress(value) || value.toLowerCase() === ZeroAddress) throw new Error("Enter a nonzero EVM address (0x + 40 hex characters).");
  return getAddress(value);
}
export function nativeId(value) {
  const normalized = address(value);
  if (!/^0x0{24}/i.test(normalized)) throw new Error("This EVM alias is not a shard-0 realm-0 long-zero token address.");
  return `0.0.${BigInt(normalized)}`;
}
export function amountUnits(value, decimals) {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) throw new Error("Unsupported token decimals.");
  if (typeof value !== "string" || !/^(0|[1-9]\d*)(\.\d+)?$/.test(value)) throw new Error("Enter a plain positive decimal amount.");
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > decimals) throw new Error(`At most ${decimals} decimal places are allowed.`);
  const units = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, "0") || "0");
  if (units <= 0n || units > 9223372036854775807n) throw new Error("Amount must fit a positive HTS int64.");
  return units;
}
export function lockId(value) {
  if (typeof value !== "string" || !/^(0|[1-9]\d{0,19})$/.test(value)) throw new Error("Invalid lock ID.");
  return BigInt(value);
}
export function provider(url = TESTNET.rpc) {
  const request = new FetchRequest(url);
  request.timeout = 15000;
  return new JsonRpcProvider(request, undefined, { batchMaxCount: 1, pollingInterval: 3000, cacheTimeout: -1 });
}
export async function assertTestnet(rpc) {
  if ((await rpc.getNetwork()).chainId !== 296n) throw new Error("Refusing a network other than Hedera testnet (296).");
}
export async function discoverPair(runner) {
  const result = await new Contract(TESTNET.factory, FACTORY_ABI, runner).getPair(TESTNET.whbar, TESTNET.sauce);
  if (result === ZeroAddress) throw new Error("The canonical testnet WHBAR/SAUCE pair is unavailable. Testnet may have reset.");
  return address(result);
}
export async function readPool(pairAddress, runner) {
  const pair = address(pairAddress);
  const pool = new Contract(pair, PAIR_ABI, runner);
  const [poolFactory, token0, token1, lpToken, reserves] = await Promise.all([
    pool.factory(), pool.token0(), pool.token1(), pool.lpToken(), pool.getReserves(),
  ]);
  if (poolFactory.toLowerCase() !== TESTNET.factory.toLowerCase()) throw new Error("Pool is not from the canonical SaucerSwap V1 testnet factory.");
  const canonical = await new Contract(TESTNET.factory, FACTORY_ABI, runner).getPair(token0, token1);
  if (canonical.toLowerCase() !== pair.toLowerCase()) throw new Error("Factory does not authenticate this pool.");
  if (address(lpToken).toLowerCase() === pair.toLowerCase()) throw new Error("Invalid LP token: it must be a separate HTS entity.");
  const token = new Contract(lpToken, TOKEN_ABI, runner);
  const [supply, decimals] = await Promise.all([token.totalSupply(), token.decimals()]);
  if (Number(decimals) > 18) throw new Error("Unsupported LP token decimals.");
  return {
    pair, factory: TESTNET.factory, token0: address(token0), token1: address(token1),
    lpToken: address(lpToken), lpTokenId: nativeId(lpToken), decimals: Number(decimals),
    reserve0: reserves[0].toString(), reserve1: reserves[1].toString(), totalSupply: supply.toString(),
    hasLiquidity: reserves[0] > 0n && reserves[1] > 0n && supply > 0n,
    observedAt: new Date().toISOString(), network: "testnet",
  };
}
export async function mirrorGet(path, fetcher = fetch) {
  const response = await fetcher(`${TESTNET.mirror}${path}`, { signal: AbortSignal.timeout(15000), headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Mirror node returned HTTP ${response.status}. Retry after indexing or rate-limit delay.`);
  return response.json();
}
export function message(error) {
  // Do not send RPC URLs, signed transactions, or credential-bearing error objects to the browser/logs.
  if (error && typeof error === "object" && "code" in error) {
    if (error.code === "ACTION_REJECTED") return "Signature declined. No new transaction was submitted by this action.";
    if (error.code === "CALL_EXCEPTION") return "Contract call reverted. Check network, balance, allowance, token association, and lock maturity.";
    if (error.code === "NETWORK_ERROR" || error.code === "TIMEOUT" || error.code === "SERVER_ERROR") return "Hedera RPC is unavailable or rate-limited. Retry shortly.";
  }
  return error instanceof Error ? error.message.slice(0, 240) : "Operation failed.";
}
