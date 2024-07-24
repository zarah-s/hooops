// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

contract Community {
    uint totalRewards;
    string communityName;
    address owner;
    uint rewardAmount;
    uint rewardDeposit;

    event RewardEvent(
        address indexed from,
        address indexed to,
        uint indexed amount,
        RewardType rewardType
    );
    event Withdraw(
        address indexed user,
        uint indexed amount,
        uint indexed timestamp
    );
    event Deposit(
        address indexed user,
        uint indexed amount,
        uint indexed timestamp
    );

    enum RewardType {
        Reward,
        Tip
    }

    constructor(
        string memory _communityName,
        address _owner,
        uint initialReward
    ) {
        communityName = _communityName;
        owner = _owner;
        rewardAmount = initialReward;
    }

    struct Reward {
        uint amount;
        address from;
        RewardType rewardType;
        uint timestamp;
    }

    struct User {
        uint balance;
    }

    mapping(address => Reward[]) userRewards;
    mapping(address => uint) userBalance;

    function setRewardAmount(uint amount) external OnlyOwner {
        rewardAmount = amount;
    }

    function tip(address _receiver) external payable {
        require(msg.value > 0, "CANNOT_TIP_ZERO_VALUE");
        userBalance[_receiver] += msg.value;
        Reward[] storage rewards = userRewards[_receiver];
        rewards.push(
            Reward({
                amount: msg.value,
                rewardType: RewardType.Tip,
                timestamp: block.timestamp,
                from: msg.sender
            })
        );

        emit RewardEvent(msg.sender, _receiver, msg.value, RewardType.Tip);
    }

    function batchTip(
        address[] memory receivers,
        uint[] memory amounts
    ) external payable {
        require(msg.value > 0, "CANNOT_TIP_ZERO_VALUE");
        if (receivers.length != amounts.length) {
            revert("UNMATCHED_ARGUMENT_LENGTH");
        }
        uint value = msg.value;
        for (uint i = 0; i < receivers.length; i++) {
            require(value >= amounts[i], "INSUFFICIENT_FUNDS");
            address _receiver = receivers[i];
            userBalance[_receiver] += amounts[i];
            value -= amounts[i];
            Reward[] storage rewards = userRewards[_receiver];
            rewards.push(
                Reward({
                    amount: amounts[i],
                    rewardType: RewardType.Tip,
                    timestamp: block.timestamp,
                    from: msg.sender
                })
            );

            emit RewardEvent(msg.sender, _receiver, msg.value, RewardType.Tip);
        }
    }

    modifier OnlyOwner() {
        require(msg.sender == owner, "UNAUTHORIZED");
        _;
    }

    function batchReward(
        address[] memory users
    )
        external
        // uint[] memory amounts
        OnlyOwner
    {
        require(rewardDeposit > 0, "INSUFFICIENT_FUNDS");
        require(rewardAmount > 0, "NO_REWARD");
        // if (users.length != amounts.length) {
        //     revert("UNMATCHED_ARGUMENT_LENGTH");
        // }

        for (uint i = 0; i < users.length; i++) {
            require(rewardDeposit >= rewardAmount, "INSUFFICIENT_FUNDS");

            // User storage user = userBalance[users[i]];
            userBalance[users[i]] += rewardAmount;
            rewardDeposit -= rewardAmount;
            Reward[] storage rewards = userRewards[users[i]];
            rewards.push(
                Reward({
                    amount: rewardAmount,
                    rewardType: RewardType.Reward,
                    timestamp: block.timestamp,
                    from: address(this)
                })
            );
            emit RewardEvent(
                address(this),
                users[i],
                rewardAmount,
                RewardType.Reward
            );

            // (bool success, ) = payable(users[i]).call{value: amounts[i]}("");
            // require(success);
        }
    }

    function getRewardValue() external view returns (uint) {
        return rewardAmount;
    }

    function reward(address user) external OnlyOwner {
        require(rewardDeposit >= rewardAmount, "INSUFFICIENT_FUNDS");
        require(rewardAmount > 0, "NO_REWARD");

        userBalance[user] += rewardAmount;
        rewardDeposit -= rewardAmount;
        Reward[] storage rewards = userRewards[user];
        rewards.push(
            Reward({
                amount: rewardAmount,
                rewardType: RewardType.Reward,
                timestamp: block.timestamp,
                from: address(this)
            })
        );
        emit RewardEvent(address(this), user, rewardAmount, RewardType.Reward);
    }

    function getUserRewards(
        address user
    ) external view returns (Reward[] memory) {
        return userRewards[user];
    }

    function getUserBalance(address user) external view returns (uint) {
        return userBalance[user];
    }

    function withdraw() external {
        // uint  user = userBalance[msg.sender];
        uint balance = userBalance[msg.sender];
        require(balance > 0, "INSUFICIENT FUNDS");
        userBalance[msg.sender] = 0;
        delete userRewards[msg.sender];
        (bool success, ) = payable(msg.sender).call{value: balance}("");
        require(success);
        emit Withdraw(msg.sender, balance, block.timestamp);
    }

    function getContractBalance() external view returns (uint) {
        return address(this).balance;
    }

    function fund() public payable {
        emit Deposit(msg.sender, msg.value, block.timestamp);
    }

    receive() external payable {
        rewardDeposit += msg.value;
        emit Deposit(msg.sender, msg.value, block.timestamp);
    }

    fallback() external payable {
        rewardDeposit += msg.value;
        emit Deposit(msg.sender, msg.value, block.timestamp);
    }
}
