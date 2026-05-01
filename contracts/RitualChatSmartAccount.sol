// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IRitualChatSmartAccountFactory {
    function isApprovedChatTarget(address target) external view returns (bool);
}

contract RitualChatSmartAccount {
    error AlreadyInitialized();
    error InvalidAddress();
    error NotOwner();
    error NotFactory();
    error NotAuthorizedForChat();
    error TargetNotAllowed();
    error CallFailed(bytes result);

    address private _owner;
    address public sessionKey;
    uint256 public sessionKeyExpiresAt;
    address public immutable factory;
    bool public initialized;

    event Initialized(address indexed owner);
    event SessionKeySet(address indexed sessionKey, uint256 expiresAt);
    event SessionKeyCleared(address indexed sessionKey);
    event ChatCallExecuted(address indexed caller, address indexed target, bytes result);
    event OwnerCallExecuted(address indexed target, uint256 value, bytes result);

    modifier onlyOwner() {
        if (msg.sender != _owner) revert NotOwner();
        _;
    }

    constructor() {
        factory = msg.sender;
    }

    receive() external payable {}

    function initialize(address owner_) external {
        if (msg.sender != factory) revert NotFactory();
        if (initialized) revert AlreadyInitialized();
        if (owner_ == address(0)) revert InvalidAddress();

        _owner = owner_;
        initialized = true;

        emit Initialized(owner_);
    }

    function owner() external view returns (address) {
        return _owner;
    }

    function setSessionKey(address sessionKey_, uint256 expiresAt) external onlyOwner {
        if (sessionKey_ == address(0)) revert InvalidAddress();
        if (expiresAt <= block.timestamp) revert InvalidAddress();

        sessionKey = sessionKey_;
        sessionKeyExpiresAt = expiresAt;

        emit SessionKeySet(sessionKey_, expiresAt);
    }

    function clearSessionKey() external onlyOwner {
        address previous = sessionKey;
        sessionKey = address(0);
        sessionKeyExpiresAt = 0;

        emit SessionKeyCleared(previous);
    }

    function isValidSessionKey(address sessionKey_) public view returns (bool) {
        return sessionKey_ != address(0)
            && sessionKey_ == sessionKey
            && sessionKeyExpiresAt >= block.timestamp;
    }

    function executeChatCall(address target, bytes calldata data) external returns (bytes memory result) {
        if (msg.sender != _owner && !isValidSessionKey(msg.sender)) revert NotAuthorizedForChat();
        if (!IRitualChatSmartAccountFactory(factory).isApprovedChatTarget(target)) revert TargetNotAllowed();

        (bool success, bytes memory returnData) = target.call(data);
        if (!success) revert CallFailed(returnData);

        emit ChatCallExecuted(msg.sender, target, returnData);
        return returnData;
    }

    function executeOwnerCall(
        address target,
        uint256 value,
        bytes calldata data
    ) external onlyOwner returns (bytes memory result) {
        (bool success, bytes memory returnData) = target.call{value: value}(data);
        if (!success) revert CallFailed(returnData);

        emit OwnerCallExecuted(target, value, returnData);
        return returnData;
    }
}
