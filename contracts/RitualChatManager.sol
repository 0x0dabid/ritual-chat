// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract RitualChatManager {
    error InvalidAddress();
    error EmptyPrompt();
    error PromptTooLong();
    error LlmCallFailed(bytes result);

    struct StorageRef {
        string platform;
        string path;
        string keyRef;
    }

    address public immutable llmPrecompile;
    address public immutable executor;
    string public constant MODEL = "zai-org/GLM-4.7-FP8";
    uint256 public constant MAX_PROMPT_LENGTH = 1000;

    event ChatMessageSubmitted(
        address indexed smartAccount,
        address indexed caller,
        string prompt,
        bytes output
    );

    constructor(address llmPrecompile_, address executor_) {
        if (llmPrecompile_ == address(0) || executor_ == address(0)) revert InvalidAddress();
        llmPrecompile = llmPrecompile_;
        executor = executor_;
    }

    function sendChatMessage(string calldata prompt) external returns (bytes memory output) {
        bytes memory promptBytes = bytes(prompt);
        if (promptBytes.length == 0) revert EmptyPrompt();
        if (promptBytes.length > MAX_PROMPT_LENGTH) revert PromptTooLong();

        bytes memory input = _buildLlmInput(prompt);
        (bool ok, bytes memory result) = llmPrecompile.call(input);
        if (!ok) revert LlmCallFailed(result);

        emit ChatMessageSubmitted(msg.sender, msg.sender, prompt, result);
        return result;
    }

    function _buildLlmInput(string calldata prompt) internal view returns (bytes memory) {
        bytes[] memory emptyBytesArray = new bytes[](0);
        StorageRef memory emptyConvoHistory = StorageRef("", "", "");

        return abi.encode(
            executor,
            emptyBytesArray,
            uint256(300),
            emptyBytesArray,
            bytes(""),
            _messagesJson(prompt),
            MODEL,
            int256(0),
            "",
            false,
            int256(4096),
            "",
            "",
            uint256(1),
            true,
            int256(0),
            "medium",
            bytes(""),
            int256(-1),
            "auto",
            "",
            false,
            int256(700),
            bytes(""),
            bytes(""),
            int256(-1),
            int256(1000),
            "",
            false,
            emptyConvoHistory
        );
    }

    function _messagesJson(string calldata prompt) internal pure returns (string memory) {
        return string.concat(
            '[{"role":"system","content":"You are RITUAL CHAT, a helpful text-only assistant powered by Ritual LLM."},',
            '{"role":"user","content":"',
            _escapeJson(prompt),
            '"}]'
        );
    }

    function _escapeJson(string calldata value) internal pure returns (string memory) {
        bytes calldata input = bytes(value);
        bytes memory buffer = new bytes(input.length * 2);
        uint256 length;

        for (uint256 i = 0; i < input.length; i += 1) {
            bytes1 char = input[i];
            if (char == bytes1('"') || char == bytes1("\\")) {
                buffer[length] = "\\";
                length += 1;
            } else if (char == 0x0a) {
                buffer[length] = "\\";
                buffer[length + 1] = "n";
                length += 2;
                continue;
            } else if (char == 0x0d) {
                buffer[length] = "\\";
                buffer[length + 1] = "r";
                length += 2;
                continue;
            } else if (char == 0x09) {
                buffer[length] = "\\";
                buffer[length + 1] = "t";
                length += 2;
                continue;
            }
            buffer[length] = char;
            length += 1;
        }

        bytes memory output = new bytes(length);
        for (uint256 i = 0; i < length; i += 1) {
            output[i] = buffer[i];
        }
        return string(output);
    }
}
