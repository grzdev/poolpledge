const assert = require("node:assert/strict");
const { ethers, network } = require("hardhat");

describe("PoolPledge custody and native boundary", function () {
  let owner, beneficiary, stranger, token, factory, pair, pledge, hts;
  const HTS = "0x0000000000000000000000000000000000000167";
  beforeEach(async function () {
    await network.provider.send("hardhat_reset");
    [owner, beneficiary, stranger] = await ethers.getSigners();
    const mock = await ethers.deployContract("MockAssociation");
    await network.provider.send("hardhat_setCode", [HTS, await ethers.provider.getCode(await mock.getAddress())]);
    hts = await ethers.getContractAt("MockAssociation", HTS);
    token = await ethers.deployContract("MockToken");
    factory = await ethers.deployContract("MockFactory");
    pair = await ethers.deployContract("MockPair", [await factory.getAddress(), owner.address, stranger.address, await token.getAddress()]);
    await factory.setPair(owner.address, stranger.address, await pair.getAddress());
    pledge = await ethers.deployContract("PoolPledge", [await factory.getAddress()]);
    await token.mint(owner.address, 1000n);
    await token.approve(await pledge.getAddress(), 1000n);
  });
  async function expiry() { return (await ethers.provider.getBlock("latest")).timestamp + 3600; }
  async function create(amount = 100n, to = beneficiary.address) {
    const at = await expiry();
    await pledge.createLock(await pair.getAddress(), amount, to, at);
    return at;
  }
  async function mature(at) { await network.provider.send("evm_setNextBlockTimestamp", [at]); await network.provider.send("evm_mine"); }

  it("associates the separate HTS LP token exactly once", async function () {
    await pledge.registerPair(await pair.getAddress());
    assert.equal(await pledge.registeredToken(await pair.getAddress()), await token.getAddress());
    assert.equal(await hts.associated(await pledge.getAddress(), await token.getAddress()), true);
    await hts.setResponse(7);
    await pledge.registerPair(await pair.getAddress());
  });
  it("accepts the native already-associated response", async function () {
    await hts.setResponse(194);
    await pledge.registerPair(await pair.getAddress());
    assert.equal(await pledge.registeredToken(await pair.getAddress()), await token.getAddress());
  });
  it("rolls registration back on native HTS failure", async function () {
    await hts.setResponse(7);
    await assert.rejects(pledge.registerPair(await pair.getAddress()), /HtsAssociationFailed/);
    assert.equal(await pledge.registeredToken(await pair.getAddress()), ethers.ZeroAddress);
  });
  it("rejects a spoofed pool even when it claims the canonical factory", async function () {
    const fake = await ethers.deployContract("MockPair", [await factory.getAddress(), owner.address, stranger.address, await token.getAddress()]);
    await assert.rejects(pledge.registerPair(await fake.getAddress()), /InvalidPair/);
  });
  it("rejects invalid commitments before moving balances", async function () {
    const at = await expiry();
    for (const [amount, to, time] of [[0n, beneficiary.address, at], [1n, ethers.ZeroAddress, at], [1n, await pledge.getAddress(), at], [1n, beneficiary.address, 1], [1n, beneficiary.address, at + 6 * 365 * 86400], [9223372036854775808n, beneficiary.address, at]]) {
      await assert.rejects(pledge.createLock(await pair.getAddress(), amount, to, time), /InvalidLock/);
    }
    assert.equal(await token.balanceOf(owner.address), 1000n);
  });
  it("enforces beneficiary, maturity, and exactly-once release", async function () {
    const at = await create();
    await assert.rejects(pledge.connect(stranger).withdraw(0), /Unauthorized/);
    await assert.rejects(pledge.connect(beneficiary).withdraw(0), /NotMature/);
    await mature(at);
    await pledge.connect(beneficiary).withdraw(0);
    assert.equal(await token.balanceOf(beneficiary.address), 100n);
    assert.equal(await pledge.totalLocked(await token.getAddress()), 0n);
    await assert.rejects(pledge.connect(beneficiary).withdraw(0), /AlreadyWithdrawn/);
  });
  it("keeps multiple beneficiaries' liabilities isolated", async function () {
    const at = await create(100n);
    await create(200n, stranger.address);
    await mature(at + 100);
    await pledge.connect(beneficiary).withdraw(0);
    assert.equal(await pledge.totalLocked(await token.getAddress()), 200n);
    assert.equal(await token.balanceOf(await pledge.getAddress()), 200n);
    await pledge.connect(stranger).withdraw(1);
    assert.equal(await token.balanceOf(stranger.address), 200n);
  });
  it("rejects failed transfers and fee-on-transfer deposits without creating liabilities", async function () {
    await token.setFailure(true, false);
    await assert.rejects(create(), /TransferFailed/);
    await token.setFailure(false, true);
    await assert.rejects(create(), /BalanceMismatch/);
    assert.equal(await pledge.nextLockId(), 0n);
    assert.equal(await token.balanceOf(owner.address), 1000n);
  });
  it("rolls withdrawal state back on failed transfer so funds remain claimable", async function () {
    const at = await create(); await mature(at);
    await token.setFailure(true, false);
    await assert.rejects(pledge.connect(beneficiary).withdraw(0), /TransferFailed/);
    assert.equal((await pledge.locks(0)).withdrawn, false);
    assert.equal(await pledge.totalLocked(await token.getAddress()), 100n);
    await token.setFailure(false, false);
    await pledge.connect(beneficiary).withdraw(0);
  });
  it("blocks reentrant token callbacks and restores deposit balances", async function () {
    await token.setCallback(await pledge.getAddress(), pledge.interface.encodeFunctionData("registerPair", [await pair.getAddress()]));
    await assert.rejects(create(), /callback rejected/);
    assert.equal(await token.balanceOf(owner.address), 1000n);
    assert.equal(await pledge.nextLockId(), 0n);
  });
  it("rejects missing approval and nonexistent withdrawals", async function () {
    await token.approve(await pledge.getAddress(), 0n);
    await assert.rejects(create(), /allowance/);
    await assert.rejects(pledge.withdraw(0), /InvalidLock/);
  });
});
