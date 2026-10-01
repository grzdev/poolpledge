// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

// Minimal independently authored ABI boundaries. See docs/ASSESSMENT.md for sources.
interface IPoolFactory {
    function getPair(address tokenA, address tokenB) external view returns (address);
}
interface IPool {
    function factory() external view returns (address);
    function token0() external view returns (address);
    function token1() external view returns (address);
    function lpToken() external view returns (address);
}
interface ILpToken {
    function balanceOf(address holder) external view returns (uint256);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}
interface ITokenAssociation {
    function associateToken(address account, address token) external returns (int64);
}

/// @notice Fixed-term custody of authenticated SaucerSwap V1 native HTS LP tokens.
/// @dev No admin, proxy, rescue, fee, or ability to shorten a commitment.
contract PoolPledge {
    struct Lock {
        address depositor;
        address beneficiary;
        address pair;
        address token;
        uint256 amount;
        uint64 unlockAt;
        bool withdrawn;
    }

    address public immutable factory;
    address private constant HTS = address(0x167);
    uint256 public constant MAX_DURATION = 5 * 365 days;
    uint256 public nextLockId;
    mapping(address => address) public registeredToken;
    mapping(address => uint256) public totalLocked;
    mapping(uint256 => Lock) public locks;
    uint256 private entered = 1;

    error InvalidFactory();
    error InvalidPair();
    error InvalidLock();
    error HtsAssociationFailed(int64 code);
    error TransferFailed();
    error BalanceMismatch();
    error Unauthorized();
    error NotMature();
    error AlreadyWithdrawn();
    error Reentrant();

    event PairRegistered(address indexed pair, address indexed token);
    event Locked(uint256 indexed id, address indexed depositor, address indexed beneficiary, address pair, address token, uint256 amount, uint64 unlockAt);
    event Withdrawn(uint256 indexed id, address indexed beneficiary, uint256 amount);

    constructor(address canonicalFactory) {
        if (canonicalFactory == address(0) || canonicalFactory.code.length == 0) revert InvalidFactory();
        factory = canonicalFactory;
    }

    modifier nonReentrant() {
        if (entered != 1) revert Reentrant();
        entered = 2;
        _;
        entered = 1;
    }

    function registerPair(address pair) external nonReentrant returns (address) {
        return _register(pair);
    }

    function _register(address pair) private returns (address token) {
        token = registeredToken[pair];
        if (token != address(0)) return token;
        if (pair.code.length == 0) revert InvalidPair();
        IPool pool = IPool(pair);
        address token0 = pool.token0();
        address token1 = pool.token1();
        if (token0 == address(0) || token1 == address(0) || token0 == token1 ||
            pool.factory() != factory || IPoolFactory(factory).getPair(token0, token1) != pair) revert InvalidPair();
        token = pool.lpToken();
        if (token == address(0) || token == pair) revert InvalidPair();
        int64 code = ITokenAssociation(HTS).associateToken(address(this), token);
        // SUCCESS=22, TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT=194 (native response codes).
        if (code != 22 && code != 194) revert HtsAssociationFailed(code);
        registeredToken[pair] = token;
        emit PairRegistered(pair, token);
    }

    function createLock(address pair, uint256 amount, address beneficiary, uint64 unlockAt)
        external nonReentrant returns (uint256 id)
    {
        if (amount == 0 || amount > uint256(uint64(type(int64).max)) || beneficiary == address(0) ||
            beneficiary == address(this) || unlockAt <= block.timestamp ||
            unlockAt > block.timestamp + MAX_DURATION) revert InvalidLock();
        address token = _register(pair);
        uint256 beforeBalance = ILpToken(token).balanceOf(address(this));
        if (!ILpToken(token).transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
        if (ILpToken(token).balanceOf(address(this)) != beforeBalance + amount) revert BalanceMismatch();
        id = nextLockId++;
        locks[id] = Lock(msg.sender, beneficiary, pair, token, amount, unlockAt, false);
        totalLocked[token] += amount;
        emit Locked(id, msg.sender, beneficiary, pair, token, amount, unlockAt);
    }

    function withdraw(uint256 id) external nonReentrant {
        if (id >= nextLockId) revert InvalidLock();
        Lock storage item = locks[id];
        if (msg.sender != item.beneficiary) revert Unauthorized();
        if (item.withdrawn) revert AlreadyWithdrawn();
        if (block.timestamp < item.unlockAt) revert NotMature();
        item.withdrawn = true;
        totalLocked[item.token] -= item.amount;
        if (!ILpToken(item.token).transfer(item.beneficiary, item.amount)) revert TransferFailed();
        emit Withdrawn(id, item.beneficiary, item.amount);
    }
}
