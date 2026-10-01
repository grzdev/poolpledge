// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @dev EVM-only boundary mock. Does not emulate HTS cryptographic authorization or fees.
contract MockAssociation {
    int64 public response;
    mapping(address => mapping(address => bool)) public associated;
    function setResponse(int64 value) external { response = value; }
    function associateToken(address account, address token) external returns (int64) {
        int64 code = response == 0 ? int64(22) : response;
        if (code == 22 || code == 194) associated[account][token] = true;
        return code;
    }
}
contract MockFactory {
    mapping(address => mapping(address => address)) public getPair;
    function setPair(address a, address b, address pair) external { getPair[a][b] = pair; getPair[b][a] = pair; }
}
contract MockPair {
    address public factory;
    address public token0;
    address public token1;
    address public lpToken;
    constructor(address f, address a, address b, address lp) { factory = f; token0 = a; token1 = b; lpToken = lp; }
}
contract MockToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    bool public failTransfer;
    bool public takeFee;
    address public callbackTarget;
    bytes public callbackData;
    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
    function setFailure(bool fail, bool fee) external { failTransfer = fail; takeFee = fee; }
    function setCallback(address target, bytes calldata data) external { callbackTarget = target; callbackData = data; }
    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (failTransfer) return false;
        require(allowance[from][msg.sender] >= amount, "allowance");
        allowance[from][msg.sender] -= amount;
        _transfer(from, to, amount);
        return true;
    }
    function transfer(address to, uint256 amount) external returns (bool) {
        if (failTransfer) return false;
        _transfer(msg.sender, to, amount);
        return true;
    }
    function _transfer(address from, address to, uint256 amount) private {
        require(balanceOf[from] >= amount, "balance");
        balanceOf[from] -= amount;
        balanceOf[to] += takeFee ? amount - 1 : amount;
        if (callbackTarget != address(0)) {
            (bool ok,) = callbackTarget.call(callbackData);
            require(ok, "callback rejected");
        }
    }
}
