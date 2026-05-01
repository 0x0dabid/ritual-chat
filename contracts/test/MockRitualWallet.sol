// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockRitualWallet {
    mapping(address => uint256) public balanceOf;
    mapping(address => uint256) public lockUntil;

    function depositFor(address user, uint256 lockDuration) external payable {
        balanceOf[user] += msg.value;

        uint256 lockedBlock = block.number + lockDuration;
        if (lockedBlock > lockUntil[user]) {
            lockUntil[user] = lockedBlock;
        }
    }
}
