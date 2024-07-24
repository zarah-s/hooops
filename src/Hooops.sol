// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;
import "./Community.sol";

contract Hooops {
    event CommunityInitialized(
        address indexed communityAddress,
        string indexed name,
        uint indexed timestamp
    );
    mapping(string => address) community;

    function getContract(
        string memory communityName
    ) external view returns (address) {
        address res = community[communityName];
        require(res != address(0), "COMMUNITY_NOT_INITIALIZED");
        return community[communityName];
    }

    function createCommunity(string memory name, uint initialReward) external {
        require(community[name] == address(0), "COMMUNITY_ALREADY_EXIST");
        require(initialReward > 0, "REWARD_CANNOT_BE_ZERO");
        Community new_community = new Community(
            name,
            msg.sender,
            initialReward
        );
        community[name] = address(new_community);
        emit CommunityInitialized(
            address(new_community),
            name,
            block.timestamp
        );
    }
}
