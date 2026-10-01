import { amountUnits } from "@poolpledge/core";
export function validateLock(amount, decimals, balance, unlockDate, nowSeconds) {
  const units = amountUnits(amount, decimals);
  if (units > BigInt(balance)) throw new Error("LP amount exceeds your available balance.");
  const millis = new Date(unlockDate).getTime();
  if (!Number.isFinite(millis)) throw new Error("Choose a valid unlock date and time.");
  const unlockAt = Math.floor(millis / 1000);
  if (unlockAt <= nowSeconds + 60) throw new Error("Choose an unlock time more than one minute ahead.");
  if (unlockAt > nowSeconds + 5 * 365 * 86400) throw new Error("The maximum lock duration is five years.");
  return { units, unlockAt };
}
export function withdrawalState(lock, account, chain, nowSeconds) {
  if (lock.withdrawn) return "Withdrawn";
  if (nowSeconds < Number(lock.unlockAt)) return "Locked until expiry";
  if (!account) return "Connect the owner wallet";
  if (chain !== "0x128") return "Switch to Hedera testnet";
  if (account.toLowerCase() !== lock.beneficiary.toLowerCase()) return "Only the owner can withdraw";
  return "Ready to withdraw";
}
export async function requireWallet(ethereum, expectedAccount) {
  if (!ethereum) throw new Error("Install an EVM wallet such as MetaMask, then reload this page.");
  if (await ethereum.request({ method: "eth_chainId" }) !== "0x128") throw new Error("Switch your wallet to Hedera testnet (296).");
  const accounts = await ethereum.request({ method: "eth_accounts" });
  if (!accounts[0] || accounts[0].toLowerCase() !== expectedAccount.toLowerCase()) throw new Error("Wallet account changed. Refresh and review this action again.");
}
export function walletError(error) {
  const code = error?.code ?? error?.info?.error?.code;
  if (code === 4001 || code === "ACTION_REJECTED") return "Request declined in your wallet. This action was not submitted.";
  if (code === "INSUFFICIENT_FUNDS") return "Insufficient test HBAR to pay the network fee.";
  if (code === -32002) return "A wallet request is already open. Complete it in your wallet.";
  if (code === "CALL_EXCEPTION") return "Transaction reverted. Refresh the balance, allowance, and lock status before retrying.";
  if (code === "TIMEOUT" || code === "NETWORK_ERROR" || code === "SERVER_ERROR") return "RPC unavailable or request timed out. A submitted transaction may still confirm; check its status before retrying.";
  const text = String(error?.message || "Request failed. Please retry.");
  if (/fetch|network|rate.limit/i.test(text)) return "RPC unavailable or rate-limited. Retry shortly.";
  return text.replace(/https?:\/\/\S+/g, "[RPC endpoint]").replace(/0x[a-fA-F0-9]{64,}/g, "[transaction data]").slice(0, 240);
}
