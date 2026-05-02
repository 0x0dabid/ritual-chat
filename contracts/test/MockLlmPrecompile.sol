// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockLlmPrecompile {
    struct StorageRef {
        string platform;
        string path;
        string keyRef;
    }

    event LlmInputReceived(bytes input);

    fallback(bytes calldata input) external returns (bytes memory) {
        emit LlmInputReceived(input);
        bytes memory actualOutput = abi.encode(
            false,
            bytes("mock completion"),
            bytes("mock metadata"),
            "",
            StorageRef("gcs", "ritual-chat/updated.jsonl", "GCS_CREDS")
        );
        return abi.encode(input, actualOutput);
    }
}
