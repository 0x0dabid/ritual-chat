const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RitualChatManager", () => {
  const LLM_PRECOMPILE = "0x0000000000000000000000000000000000000802";
  const MODEL = "zai-org/GLM-4.7-FP8";
  const TTL = 30n;
  const TEMPERATURE = 700n;
  const MAX_COMPLETION_TOKENS = 64n;
  const CONVO_HISTORY = ["gcs", "ritual-chat/test-session.jsonl", "GCS_CREDS"];

  async function deployFixture() {
    const [executor, caller] = await ethers.getSigners();
    const Mock = await ethers.getContractFactory("MockLlmPrecompile");
    const mock = await Mock.deploy();
    await mock.waitForDeployment();
    const runtimeCode = await ethers.provider.getCode(await mock.getAddress());
    await ethers.provider.send("hardhat_setCode", [LLM_PRECOMPILE, runtimeCode]);

    const Manager = await ethers.getContractFactory("RitualChatManager");
    const manager = await Manager.deploy(
      LLM_PRECOMPILE,
      executor.address,
      MODEL,
      TTL,
      TEMPERATURE,
      MAX_COMPLETION_TOKENS,
      CONVO_HISTORY,
    );
    await manager.waitForDeployment();

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

  it("forwards LLM input to 0x0802 via the precompile consumer path", async () => {
    const { caller, manager } = await deployFixture();

    await expect(manager.connect(caller).sendChatMessage("hello"))
      .to.emit(manager, "ChatPromptSubmitted")
      .and.to.emit(manager, "ChatResponseReceived");
  });

  it("does not require a manual manager lock for basic LLM chat", async () => {
    const { manager } = await deployFixture();

    await expect(manager.sendChatMessage("hello"))
      .to.emit(manager, "ChatResponseReceived");
  });

  it("allows no-history config for simple v1 chat", async () => {
    const [executor] = await ethers.getSigners();
    const Manager = await ethers.getContractFactory("RitualChatManager");

    const manager = await Manager.deploy(
      LLM_PRECOMPILE,
      executor.address,
      MODEL,
      TTL,
      TEMPERATURE,
      MAX_COMPLETION_TOKENS,
      ["", "", ""],
    );
    await manager.waitForDeployment();
    const history = await manager.convoHistory();
    expect(history.platform).to.equal("");
    expect(history.path).to.equal("");
    expect(history.keyRef).to.equal("");
  });

  it("rejects partial convoHistory config", async () => {
    const [executor] = await ethers.getSigners();
    const Manager = await ethers.getContractFactory("RitualChatManager");

    await expect(Manager.deploy(
      LLM_PRECOMPILE,
      executor.address,
      MODEL,
      TTL,
      TEMPERATURE,
      0n,
      ["hf", "", ""],
    )).to.be.revertedWithCustomError(Manager, "InvalidLlmConfig");
  });

  it("uses the 30-field LLM ABI with model, ttl, temperature, and convoHistory", async () => {
    const { executor, manager } = await deployFixture();
    const encoded = await manager.previewLlmInput("hello");
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    const decoded = abiCoder.decode([
      "address",
      "bytes[]",
      "uint256",
      "bytes[]",
      "bytes",
      "string",
      "string",
      "int256",
      "string",
      "bool",
      "int256",
      "string",
      "string",
      "uint256",
      "bool",
      "int256",
      "string",
      "bytes",
      "int256",
      "string",
      "string",
      "bool",
      "int256",
      "bytes",
      "bytes",
      "int256",
      "int256",
      "string",
      "bool",
      "tuple(string platform,string path,string keyRef)",
    ], encoded);

    expect(decoded.length).to.equal(30);
    expect(decoded[0]).to.equal(executor.address);
    expect(decoded[2]).to.equal(TTL);
    expect(decoded[6]).to.equal(MODEL);
    expect(decoded[21]).to.equal(false);
    expect(decoded[22]).to.equal(TEMPERATURE);
    expect(decoded[10]).to.equal(MAX_COMPLETION_TOKENS);
    expect(decoded[29].platform).to.equal(CONVO_HISTORY[0]);
    expect(decoded[29].path).to.equal(CONVO_HISTORY[1]);
    expect(decoded[29].keyRef).to.equal(CONVO_HISTORY[2]);
  });
});
