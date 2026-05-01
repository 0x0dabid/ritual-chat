// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

abstract contract PrecompileConsumer {
    error PrecompileCallFailed(bytes result);

    function _executePrecompile(address precompile, bytes memory input) internal returns (bytes memory output) {
        (bool ok, bytes memory result) = precompile.call(input);
        if (!ok) revert PrecompileCallFailed(result);
        return result;
    }
}

contract RitualChatManager is PrecompileConsumer {
    error InvalidAddress();
    error InvalidLlmConfig();
    error EmptyPrompt();
    error PromptTooLong();
    error LlmResponseError(string message);

    struct StorageRef {
        string platform;
        string path;
        string keyRef;
    }

    address public immutable llmPrecompile;
    address public immutable executor;
    uint256 public immutable ttl;
    int256 public immutable temperature;
    string public model;
    StorageRef private _convoHistory;

    uint256 public constant MAX_PROMPT_LENGTH = 1000;
    int256 public constant MAX_COMPLETION_TOKENS = 4096;

    event ChatPromptSubmitted(address indexed smartAccount, address indexed caller, string prompt);
    event ChatResponseReceived(
        address indexed smartAccount,
        bytes completionData,
        bytes modelMetadata,
        StorageRef updatedConvoHistory
    );

    constructor(
        address llmPrecompile_,
        address executor_,
        string memory model_,
        uint256 ttl_,
        int256 temperature_,
        StorageRef memory convoHistory_
    ) {
        if (llmPrecompile_ == address(0) || executor_ == address(0)) revert InvalidAddress();
        if (
            ttl_ == 0
                || bytes(model_).length == 0
                || bytes(convoHistory_.platform).length == 0
                || bytes(convoHistory_.path).length == 0
                || bytes(convoHistory_.keyRef).length == 0
        ) {
            revert InvalidLlmConfig();
        }

        llmPrecompile = llmPrecompile_;
        executor = executor_;
        model = model_;
        ttl = ttl_;
        temperature = temperature_;
        _convoHistory = convoHistory_;
    }

    function convoHistory() external view returns (StorageRef memory) {
        return _convoHistory;
    }

    function sendChatMessage(string calldata prompt) external returns (bytes memory completionData) {
        bytes memory promptBytes = bytes(prompt);
        if (promptBytes.length == 0) revert EmptyPrompt();
        if (promptBytes.length > MAX_PROMPT_LENGTH) revert PromptTooLong();

        emit ChatPromptSubmitted(msg.sender, msg.sender, prompt);

        bytes memory result = _executePrecompile(llmPrecompile, _buildLlmInput(prompt));
        (
            bool hasError,
            bytes memory responseCompletionData,
            bytes memory modelMetadata,
            string memory errorMessage,
            StorageRef memory updatedConvoHistory
        ) = abi.decode(result, (bool, bytes, bytes, string, StorageRef));

        if (hasError) revert LlmResponseError(errorMessage);

        emit ChatResponseReceived(msg.sender, responseCompletionData, modelMetadata, updatedConvoHistory);
        return responseCompletionData;
    }

    function previewLlmInput(string calldata prompt) external view returns (bytes memory) {
        return _buildLlmInput(prompt);
    }

    function _buildLlmInput(string calldata prompt) internal view returns (bytes memory) {
        bytes[] memory emptyBytesArray = new bytes[](0);

        return abi.encode(
            executor,
            emptyBytesArray,
            ttl,
            emptyBytesArray,
            bytes(""),
            _messagesJson(prompt),
            model,
            int256(0),
            "",
            false,
            MAX_COMPLETION_TOKENS,
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
            temperature,
            bytes(""),
            bytes(""),
            int256(-1),
            int256(1000),
            "",
            false,
            _convoHistory
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
