export function walletScope(deployment, chain, account) {
  return `poolpledge:${deployment.toLowerCase()}:${chain.toLowerCase()}:${account.toLowerCase()}`;
}
export function savedTransaction(raw) {
  try {
    const value = JSON.parse(raw);
    if (!/^0x[\da-f]{64}$/i.test(value.hash)) return null;
    const labels = ["Approve LP allowance", "Deposit LP", "Withdraw LP"];
    return { hash: value.hash, label: labels.includes(value.label) ? value.label : "Previously submitted transaction" };
  } catch { return null; }
}
export function lockStatus(lock, now) {
  return lock.withdrawn ? "Withdrawn" : now >= Number(lock.unlockAt) ? "Ready to withdraw" : "Locked";
}
export function scanIds(total, cursor, size = 20n) {
  const end = cursor === null ? total : BigInt(cursor);
  if (end < 0n || end > total) throw new Error("Invalid lock cursor");
  const start = end > size ? end - size : 0n;
  return { ids: Array.from({length: Number(end - start)}, (_, i) => end - 1n - BigInt(i)), nextCursor: start > 0n ? start.toString() : null };
}
export function legacyWalletName(provider) {
  if (provider.isOkxWallet || provider.isOKExWallet) return "OKX Wallet";
  if (provider.isMetaMask) return "MetaMask";
  if (provider.isCoinbaseWallet) return "Coinbase Wallet";
  return "Injected EVM wallet";
}
export async function reconcileReference(raw, readReceipt) {
  const reference = savedTransaction(raw);
  if (!reference) return null;
  const receipt = await readReceipt(reference.hash);
  return { reference, receipt };
}
