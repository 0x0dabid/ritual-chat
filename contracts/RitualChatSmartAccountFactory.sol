// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {RitualChatSmartAccount} from "./RitualChatSmartAccount.sol";

contract RitualChatSmartAccountFactory {
    error InvalidAddress();
    error NotOwner();

    address public owner;
    mapping(address target => bool approved) public approvedChatTargets;

    event AccountCreated(address indexed owner, address indexed account);
    event ChatTargetApprovalSet(address indexed target, bool approved);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    function getAccountAddress(address accountOwner) public view returns (address) {
        if (accountOwner == address(0)) revert InvalidAddress();

        bytes32 salt = _salt(accountOwner);
        bytes32 bytecodeHash = keccak256(type(RitualChatSmartAccount).creationCode);
        bytes32 digest = keccak256(
            abi.encodePacked(bytes1(0xff), address(this), salt, bytecodeHash)
        );

        return address(uint160(uint256(digest)));
    }

    function createAccount(address accountOwner) external returns (address account) {
        if (accountOwner == address(0)) revert InvalidAddress();

        account = getAccountAddress(accountOwner);
        if (account.code.length != 0) return account;

        RitualChatSmartAccount created = new RitualChatSmartAccount{salt: _salt(accountOwner)}();
        created.initialize(accountOwner);
        account = address(created);

        emit AccountCreated(accountOwner, account);
    }

    function setApprovedChatTarget(address target, bool approved) external onlyOwner {
        if (target == address(0)) revert InvalidAddress();

        approvedChatTargets[target] = approved;
        emit ChatTargetApprovalSet(target, approved);
    }

    function isApprovedChatTarget(address target) external view returns (bool) {
        return approvedChatTargets[target];
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress();

        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    function _salt(address accountOwner) private pure returns (bytes32) {
        return keccak256(abi.encode(accountOwner));
    }
}
