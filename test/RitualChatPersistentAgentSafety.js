const { expect } = require("chai");
const { ethers, network } = require("hardhat");

const PERSISTENT_AGENT_FACTORY = "0xD4AA9D55215dc8149Af57605e70921Ea16b73591";

describe("RitualChat persistent agent safety", function () {
  async function deployFixture() {
    const [factoryOwner, walletOwner, relayer, sessionKey, target] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("RitualChatSmartAccountFactory");
    const factory = await Factory.connect(factoryOwner).deploy();
    await factory.waitForDeployment();
    const accountAddress = await factory.getAccountAddress(walletOwner.address);
    await factory.createAccount(walletOwner.address);
    const account = await ethers.getContractAt("RitualChatSmartAccount", accountAddress);

    return { factoryOwner, walletOwner, relayer, sessionKey, target, factory, account };
  }

  it("stores the connected wallet as smart account owner, not the relayer", async function () {
    const { walletOwner, relayer, account } = await deployFixture();

    expect(await account.owner()).to.equal(walletOwner.address);
    expect(await account.owner()).to.not.equal(relayer.address);
  });

  it("requires factory owner approval before a session key can call PersistentAgentFactory", async function () {
    const { walletOwner, sessionKey, account } = await deployFixture();
    const latest = await ethers.provider.getBlock("latest");
    await account.connect(walletOwner).setSessionKey(sessionKey.address, latest.timestamp + 3600);

    await expect(
      account.connect(sessionKey).executeChatCall(PERSISTENT_AGENT_FACTORY, "0x"),
    ).to.be.revertedWithCustomError(account, "TargetNotAllowed");
  });

  it("allows only the PersistentAgentFactory target when explicitly approved", async function () {
    const { factoryOwner, walletOwner, sessionKey, target, factory, account } = await deployFixture();
    const latest = await ethers.provider.getBlock("latest");
    await account.connect(walletOwner).setSessionKey(sessionKey.address, latest.timestamp + 3600);
    await factory.connect(factoryOwner).setApprovedChatTarget(PERSISTENT_AGENT_FACTORY, true);

    await network.provider.send("hardhat_setCode", [
      PERSISTENT_AGENT_FACTORY,
      "0x60006000f3",
    ]);

    await expect(account.connect(sessionKey).executeChatCall(PERSISTENT_AGENT_FACTORY, "0x"))
      .to.emit(account, "ChatCallExecuted");
    await expect(account.connect(sessionKey).executeChatCall(target.address, "0x"))
      .to.be.revertedWithCustomError(account, "TargetNotAllowed");
  });
});
