# Hooops

Hooops is a decentralized social network built on Core Chain and powered by the Telegram Bot API, designed to enhance user engagement through humor, internet culture, and memes. The platform integrates reward systems for participation and engagement, robust governance mechanisms, and ensures scalability with low fees and high performance.

## Table of Contents

- [Features](#features)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Usage](#usage)
  - [Community Setup](#community-setup)
  - [Bot Commands](#bot-commands)
- [Technical Details](#technical-details)
  - [Core Chain Integration](#core-chain-integration)
  - [Content Management](#content-management)
  - [Reward Mechanism](#reward-mechanism)
  - [Governance](#governance)
- [Challenges and Solutions](#challenges-and-solutions)
- [Contributing](#contributing)

## Features

- **User-Generated Content & Rewards**: Users can submit memes and humorous content via a Telegram bot, earning rewards based on engagement.
- **Creator Economy**: Content creators earn tokens for high engagement and can sell exclusive content or meme templates as NFTs.
- **Community Engagement & Gamification**: Daily challenges, meme competitions, leaderboards, and badge/achievement systems.
- **Governance**: Decentralized Autonomous Organization (DAO) for community governance, allowing token holders to propose and vote on platform changes.
- **Scalability & Performance**: Utilizes Core Chain's features for high throughput and low fees.
- **Privacy & Security**: End-to-end encryption for private messages and decentralized identity verification.

## Getting Started

### Prerequisites

- Telegram account
- Access to the Hooops Telegram bot: [Hooops Bot](https://t.me/HOOOPS_CORE_BOT)
- [Node.js](https://nodejs.org/)
- [npm](https://www.npmjs.com/get-npm) or [yarn](https://yarnpkg.com/)
- [Git](https://git-scm.com/)
- [ngrok](https://ngrok.com/) for exposing local servers to the internet

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/zarah-s/hooops.git
   cd hooops
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
   or
   ```bash
   yarn install
   ```
3. **Configure env:**

   ```
   make create-env
   ```

4. **Deploy and verify contract:**
   ```
   make deploy-contract
   ```
5. **Spin up ngrok tunnel:**
   ```
   ngrok http http://127.0.0.1:5000
   ```
6. **Start local server:**
   ```
   cd api/ && npm run dev
   ```

## Usage

### Community Setup

To set up the Hooops bot as an administrator in your community, follow these steps:

1. **Create a new Telegram group or use an existing group.**
2. **Add the Hooops bot to your group as an administrator:**
   - Open your Telegram group.
   - Tap on the group name at the top.
   - Click on the edit icon at the top right corner.
   - Scroll down to "Administrators".
   - Search for `@HOOOPS_CORE_BOT` and select the bot from the search results.
   - Click "Save".

Now, the Hooops bot should be set up as an administrator in your community and ready to facilitate engagement and rewards.

### Bot Commands

- `/tip @username amount` - Tip a user for their content.
- `/batch_tip @username amount, @username amount, ...` - Tip multiple users for their content.
- `/wallet` - View your wallet details.
- `/init rewardValue` - Initialize community with reward value.
- `/community_reward` - Gets community reward value.
- `/register` - Register as a user.
- `/contract` - View contract details.
- `/balance` - View your balance.
- `/rewards` - View your rewards.
- `/community_balance` - View the community balance.
- `/set_reward rewardValue` - Update the reward value.
- `/withdraw` - Withdraw your funds.
- `/fund amount` - Fund the community pool.
- `/claim` - Claim your rewards.

## Technical Details

### Core Chain Integration

- **Smart Contracts**: Used for reward distribution, content ownership, and governance.
- **Low-Fee Transactions**: Facilitates tipping and token transfers efficiently.

<!-- ### Content Management

- **Decentralized Storage**: Uses IPFS or Arweave for hosting media content.
- **NFT Integration**: Supports digital asset ownership and trading. -->

### Reward Mechanism

- **Proof-of-Engagement Algorithm**: Calculates rewards based on user interactions.
- **Automated Reward Distribution**: Managed through smart contracts.

### Governance

- **DAO Framework**: Enables token holders to propose and vote on platform changes.
- **Smart Contracts**: Execute approved proposals.

## Challenges and Solutions

1. **Content Moderation**

   - **Challenge**: Ensuring appropriate content while maintaining decentralization.
   - **Solution**: Community-driven moderation with voting on flagged content.

2. **Scalability**

   - **Challenge**: Handling large volumes of content and user interactions.
   - **Solution**: Leverage Core Chain’s scalability features and decentralized storage solutions.

3. **User Adoption**

   - **Challenge**: Attracting users to a new platform.
   - **Solution**: Incentivize early adopters with higher rewards and exclusive benefits.

4. **Regulatory Compliance**
   - **Challenge**: Navigating varying regulations on digital content and cryptocurrencies.
   - **Solution**: Implement clear terms of service and work with legal experts to ensure compliance.

## Contributing

We welcome contributions to Hooops! Please follow these steps to contribute:

1. Fork the repository.
2. Create a new branch (`git checkout -b feature/YourFeature`).
3. Commit your changes (`git commit -am 'Add YourFeature'`).
4. Push to the branch (`git push origin feature/YourFeature`).
5. Open a pull request.
