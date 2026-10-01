// Hashio may omit custom error data. Require an execution revert, never a transport failure.
function isContractRevert(error) {
  return error?.code === "CALL_EXCEPTION" || /execution reverted|CONTRACT_REVERT_EXECUTED/.test(String(error?.message));
}
module.exports = { isContractRevert };
