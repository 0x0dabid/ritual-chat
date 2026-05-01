const { expect } = require("chai");
const { ethers, network } = require("hardhat");

describe("RitualChatSmartAccountFactory", () => {
  async function deployFixture() {
    const [deployer, owner, sessionKey, other, allowedTarget, blockedTarget] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("RitualChatSmartAccountFactory");
    const factory = await Factory.deploy();
    await factory.waitForDeployment();

    return { deployer, owner, sessionKey, other, allowedTarget, blockedTarget, factory };
  }

  it("returns the same account address for the same owner", async () => {
    const { owner, factory } = await deployFixture();

    const predictedA = await factory.getAccountAddress(owner.address);
    const predictedB = await factory.getAccountAddress(owner.address);

    await factory.createAccount(owner.address);
    const predictedAfterCreate = await factory.getAccountAddress(owner.address);

    expect(predictedA).to.equal(predictedB);
    expect(predictedA).to.equal(predictedAfterCreate);
  });

  it("emits AccountCreated when creating an account", async () => {
    const { owner, factory } = await deployFixture();
    const predicted = await factory.getAccountAddress(owner.address);

    await expect(factory.createAccount(owner.address))
      .to.emit(factory, "AccountCreated")
      .withArgs(owner.address, predicted);
  });

  it("prevents non-owner from setting a session key", async () => {
    const { owner, sessionKey, other, factory } = await deployFixture();
    await factory.createAccount(owner.address);
    const account = await ethers.getContractAt(
      "RitualChatSmartAccount",
      await factory.getAccountAddress(owner.address),
    );

    await expect(
      account.connect(other).setSessionKey(sessionKey.address, Math.floor(Date.now() / 1000) + 3600),
    ).to.be.revertedWithCustomError(account, "NotOwner");
  });

  it("blocks session key calls to arbitrary targets", async () => {
    const { owner, sessionKey, blockedTarget, factory } = await deployFixture();
    await factory.createAccount(owner.address);
    const account = await ethers.getContractAt(
      "RitualChatSmartAccount",
      await factory.getAccountAddress(owner.address),
    );
    await account.connect(owner).setSessionKey(sessionKey.address, Math.floor(Date.now() / 1000) + 3600);

    await expect(
      account.connect(sessionKey).executeChatCall(blockedTarget.address, "0x"),
    ).to.be.revertedWithCustomError(account, "TargetNotAllowed");
  });

  it("expires session keys", async () => {
    const { owner, sessionKey, factory } = await deployFixture();
    await factory.createAccount(owner.address);
    const account = await ethers.getContractAt(
      "RitualChatSmartAccount",
      await factory.getAccountAddress(owner.address),
    );

    const latest = await ethers.provider.getBlock("latest");
    const expiresAt = Number(latest.timestamp) + 10;
    await account.connect(owner).setSessionKey(sessionKey.address, expiresAt);
    expect(await account.isValidSessionKey(sessionKey.address)).to.equal(true);

    await network.provider.send("evm_setNextBlockTimestamp", [expiresAt + 1]);
    await network.provider.send("evm_mine");

    expect(await account.isValidSessionKey(sessionKey.address)).to.equal(false);
  });
});
