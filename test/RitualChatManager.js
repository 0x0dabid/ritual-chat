const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RitualChatManager", () => {
  const LLM_PRECOMPILE = "0x0000000000000000000000000000000000000802";
  const LLM_LOCK_DURATION = 10000n;

  async function deployFixture() {
    const [executor, caller] = await ethers.getSigners();
    const Wallet = await ethers.getContractFactory("MockRitualWallet");
    const ritualWallet = await Wallet.deploy();
    await ritualWallet.waitForDeployment();

    const Manager = await ethers.getContractFactory("RitualChatManager");
    const manager = await Manager.deploy(
      LLM_PRECOMPILE,
      executor.address,
      await ritualWallet.getAddress(),
      LLM_LOCK_DURATION,
    );
    await manager.waitForDeployment();

    await ethers.provider.send("hardhat_setCode", [
      LLM_PRECOMPILE,
      "0x60006000f3",
    ]);

    return { executor, caller, manager, ritualWallet };
  }

  it("rejects empty prompts", async () => {
    const { manager } = await deployFixture();

    await expect(manager.sendChatMessage(""))
      .to.be.revertedWithCustomError(manager, "EmptyPrompt");
  });

  it("rejects prompts over 1000 characters", async () => {
    const { manager } = await deployFixture();

    await expect(manager.sendChatMessage("a".repeat(1001)))
      .to.be.revertedWithCustomError(manager, "PromptTooLong");
  });

  it("calls the LLM precompile and emits a chat event", async () => {
    const { caller, manager } = await deployFixture();
    await manager.refreshLlmWalletLock({ value: ethers.parseEther("1") });

    await expect(manager.connect(caller).sendChatMessage("hello"))
      .to.emit(manager, "ChatMessageSubmitted");
  });

  it("rejects zero lock duration", async () => {
    const [executor] = await ethers.getSigners();
    const Wallet = await ethers.getContractFactory("MockRitualWallet");
    const ritualWallet = await Wallet.deploy();
    await ritualWallet.waitForDeployment();

    const Manager = await ethers.getContractFactory("RitualChatManager");
    await expect(Manager.deploy(
      LLM_PRECOMPILE,
      executor.address,
      await ritualWallet.getAddress(),
      0,
    )).to.be.revertedWithCustomError(Manager, "InvalidLockDuration");
  });

  it("rejects chat when the LLM wallet lock is missing", async () => {
    const { manager } = await deployFixture();

    await expect(manager.sendChatMessage("hello"))
      .to.be.revertedWithCustomError(manager, "InsufficientLlmLock");
  });

  it("stores a positive LLM lock duration", async () => {
    const { manager } = await deployFixture();

    expect(await manager.llmLockDuration()).to.equal(LLM_LOCK_DURATION);
  });
});
