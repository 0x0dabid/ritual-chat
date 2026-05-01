const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RitualChatManager", () => {
  const LLM_PRECOMPILE = "0x0000000000000000000000000000000000000802";

  async function deployFixture() {
    const [executor, caller] = await ethers.getSigners();
    const Manager = await ethers.getContractFactory("RitualChatManager");
    const manager = await Manager.deploy(LLM_PRECOMPILE, executor.address);
    await manager.waitForDeployment();

    await ethers.provider.send("hardhat_setCode", [
      LLM_PRECOMPILE,
      "0x60006000f3",
    ]);

    return { executor, caller, manager };
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

    await expect(manager.connect(caller).sendChatMessage("hello"))
      .to.emit(manager, "ChatMessageSubmitted");
  });
});
