require("dotenv").config();
const express = require("express");
const ethers = require("ethers");
const cors = require("cors");
const FACTORY_ABI = require("./config/FACTORY_ABI.json");
const COMMUNITY_ABI = require("./config/COMMUNITY_ABI.json");
const morgan = require("morgan");
const BigNumber = require("bignumber.js");
const {
  sequelize,
  User,
  Message,
  Reaction,
  Group,
  Reward,
} = require("./models");
const TelegramBot = require("node-telegram-bot-api");
const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(morgan("common"));
const BOT_TOKEN = process.env.BOT_TOKEN;
const SERVER_URL = process.env.SERVER_URL;
const EXPLORER_URI = process.env.EXPLORER_URI;
const LIKE = "LIKE";
const DISLIKE = "DISLIKE";

const bot = new TelegramBot(BOT_TOKEN, { webHook: true });
bot.setWebHook(`${SERVER_URL}/bot${BOT_TOKEN}`);
app.post(`/bot${BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

async function process_error(error, msg) {
  const reasonRegex = /reason="([^"]*)"/;
  const messageRegex = /message="([^"]*)"/;
  const reasonMatch = error.message.match(reasonRegex);
  const messageMatch = error.message.match(messageRegex);
  let response;
  if (reasonMatch && reasonMatch[1]) {
    response = reasonMatch[1];
  } else if (messageMatch && messageMatch[1]) {
    response = messageMatch[1];
  } else {
    response = error.message;
  }

  await bot.sendMessage(msg.chat.id, response, {
    message_thread_id: msg.message_thread_id,
    reply_to_message_id: msg.message_id,
  });
}

/// CHECK IF GROUP IS INITIALIZED
async function checkGroup(title, id, message_thread_id) {
  try {
    const find = await Group.findOne({
      where: {
        name: title,
        id: id.toString(),
      },
    });

    if (find) {
      return true;
    } else {
      await bot.sendMessage(id, `${title} IS NOT REGISTERED WITH BOT`, {
        message_thread_id,
      });
      return false;
    }
  } catch (error) {
    console.log(error);
    throw new Error(error.toString());
  }
}

/// EXTRACT CONTRACT ADDRESS FROM USERNAME
async function extract_address(username) {
  try {
    const user = await User.findOne({
      where: {
        username,
      },
    });
    if (!user) throw new Error("USER_DOES_NOT_EXIST");
    // const hashedPassword = await bcrypt.hash(user.username, 10);
    let wallet = ethers.Wallet.fromEncryptedJsonSync(
      user.encryptionKey,
      user.username
    );

    return wallet.address;
  } catch (error) {
    console.log(error);
    throw new Error(error);
  }
}

/// GET CONTRACT INSTANCE
async function process_contract(username, community, is_main) {
  try {
    const user = await User.findOne({
      where: {
        username,
      },
    });

    if (!user) return;
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    let wallet = ethers.Wallet.fromEncryptedJsonSync(
      user.encryptionKey,
      user.username
    );
    wallet = wallet.connect(provider);
    const factoryContract = new ethers.Contract(
      process.env.CONTRACT_ADDRESS,
      FACTORY_ABI,
      wallet
    );

    if (is_main) {
      return factoryContract;
    }

    const tx = await factoryContract.getContract(community);
    if (ethers.ZeroAddress === tx) {
      return;
    }

    const contract = new ethers.Contract(tx, COMMUNITY_ABI, wallet);

    return contract;
  } catch (error) {
    console.log(error);
    return;
  }
}

bot.onText(/\/tip (.+)/, async (msg, match) => {
  try {
    if (!msg?.from?.username) return;
    const chatType = msg.chat.type; // Get the chat type
    if (
      chatType !== "channel" &&
      chatType !== "group" &&
      chatType !== "supergroup"
    ) {
      return;
    }
    if (
      !(await checkGroup(msg.chat.title, msg.chat.id, msg.message_thread_id))
    ) {
      return;
    }
    const chatId = msg.chat.id;
    const data = match[1].trim().split(" ");

    if (data.length !== 2) {
      bot.sendMessage(
        chatId,
        "INVALID TIP COMMAND. USE '/tip @receiverUsername amount'",
        {
          message_thread_id: msg.message_thread_id,
          reply_to_message_id: msg.message_id,
        }
      );
      return;
    }
    const receiver = data[0].trim();
    if (!receiver.startsWith("@")) {
      bot.sendMessage(chatId, "INVALID RECEIVER USERNAME.", {
        message_thread_id: msg.message_thread_id,
        reply_to_message_id: msg.message_id,
      });
      return;
    }

    const amount = data[1].trim();

    if (isNaN(Number(amount)) || Number(amount) === 0) {
      await bot.sendMessage(chatId, `INVALID AMOUNT '${amount}'.`, {
        message_thread_id: msg.message_thread_id,
        reply_to_message_id: msg.message_id,
      });
      return;
    }

    const findSender = await User.findOne({
      where: {
        username: msg.from.username,
      },
    });
    if (!findSender) {
      bot.sendMessage(chatId, "YOU ARE NOT REGISTERED.", {
        message_thread_id: msg.message_thread_id,
        reply_to_message_id: msg.message_id,
      });
      return;
    }
    const findReceiver = await User.findOne({
      where: {
        username: receiver.replace("@", ""),
      },
    });

    if (!findReceiver) {
      bot.sendMessage(chatId, "RECEIVER IS NOT REGISTERED.", {
        message_thread_id: msg.message_thread_id,
        reply_to_message_id: msg.message_id,
      });
      return;
    }

    const contract = await process_contract(msg.from.username, msg.chat.title);
    if (contract) {
      const tx = await (
        await contract.tip(await extract_address(findReceiver.username), {
          value: ethers.parseEther(amount),
        })
      ).wait();
      if (tx.status) {
        bot.sendMessage(chatId, `TIP SUCCESSFULL.`, {
          message_thread_id: msg.message_thread_id,
          reply_to_message_id: msg.message_id,
        });
      } else {
        bot.sendMessage(
          chatId,
          `COULD NOT PROCESS TRANSACTION. ${
            tx.reason ? `REASON: ${tx.reason}` : ""
          }`,
          {
            message_thread_id: msg.message_thread_id,
            reply_to_message_id: msg.message_id,
          }
        );
      }
    } else {
      bot.sendMessage(chatId, "COULD NOT PROCESS TRANSACTION.", {
        message_thread_id: msg.message_thread_id,
        reply_to_message_id: msg.message_id,
      });
    }
  } catch (error) {
    await process_error(error, msg);
    console.log("error", error);
  }
});

bot.onText(/\/batch_tip (.+)/, async (msg, match) => {
  try {
    if (!msg?.from?.username) return;
    const chatType = msg.chat.type; // Get the chat type
    if (
      chatType !== "channel" &&
      chatType !== "group" &&
      chatType !== "supergroup"
    ) {
      return;
    }
    if (
      !(await checkGroup(msg.chat.title, msg.chat.id, msg.message_thread_id))
    ) {
      return;
    }

    let should_proceed = true;
    const data = match[1].trim().split(",");
    let processed_data = [];
    const chatId = msg.chat.id;
    for (let i = 0; i < data.length; i++) {
      if (!should_proceed) {
        break;
      }
      const element = data[i];
      if (!element.length) {
        continue;
      }

      const tx_detail = element.trim().split(" ");
      if (tx_detail.length !== 2) {
        await bot.sendMessage(chatId, "INVALID QUERY.", {
          message_thread_id: msg.message_thread_id,
          reply_to_message_id: msg.message_id,
        });
        should_proceed = false;
      } else {
        if (!tx_detail[0].trim().startsWith("@")) {
          await bot.sendMessage(
            chatId,
            `INVALID RECEIVER USERNAME '${tx_detail[0]}'.`,
            {
              message_thread_id: msg.message_thread_id,
              reply_to_message_id: msg.message_id,
            }
          );
        } else {
          if (
            isNaN(Number(tx_detail[1].trim())) ||
            Number(tx_detail[1].trim()) === 0
          ) {
            await bot.sendMessage(chatId, `INVALID AMOUNT '${tx_detail[1]}'.`, {
              message_thread_id: msg.message_thread_id,
              reply_to_message_id: msg.message_id,
            });
            should_proceed = false;
          } else {
            processed_data.push({
              username: tx_detail[0].replace("@", "").trim(),
              amount: tx_detail[1].trim(),
            });
          }
        }
      }
    }

    console.log("Processed data", processed_data);

    if (!should_proceed) {
      return;
    }

    const findSender = await User.findOne({
      where: {
        username: msg.from.username,
      },
    });
    if (!findSender) {
      bot.sendMessage(chatId, "YOU ARE NOT REGISTERED.", {
        message_thread_id: msg.message_thread_id,
        reply_to_message_id: msg.message_id,
      });
      return;
    }

    for (let i = 0; i < processed_data.length; i++) {
      if (!should_proceed) {
        break;
      }
      const element = processed_data[i];
      const findReceiver = await User.findOne({
        where: {
          username: element.username.replace("@", ""),
        },
      });

      if (!findReceiver) {
        bot.sendMessage(
          chatId,
          `RECEIVER '${element.username}' IS NOT REGISTERED.`,
          {
            message_thread_id: msg.message_thread_id,
            reply_to_message_id: msg.message_id,
          }
        );
        should_proceed = false;
      }
    }

    if (!should_proceed) {
      return;
    }

    /// CALL BATCH TIP
    const contract = await process_contract(msg.from.username, msg.chat.title);
    if (contract) {
      let users = [];
      let amounts = [];
      let total = 0;
      for (let i = 0; i < processed_data.length; i++) {
        const element = processed_data[i];
        users.push(await extract_address(element.username));
        amounts.push(ethers.parseEther(element.amount));
        total += Number(element.amount);
      }

      const tx = await (
        await contract.batchTip(users, amounts, {
          value: ethers.parseEther(BigNumber(total).toFixed().toString()),
        })
      ).wait();
      if (tx.status) {
        bot.sendMessage(chatId, `TIP SUCCESSFULL. ${EXPLORER_URI}/${tx.hash}`, {
          message_thread_id: msg.message_thread_id,
          reply_to_message_id: msg.message_id,
        });
      } else {
        bot.sendMessage(
          chatId,
          `COULD NOT PROCESS TRANSACTION. ${
            tx.reason ? `REASON: ${tx.reason}` : ""
          }`,
          {
            message_thread_id: msg.message_thread_id,
            reply_to_message_id: msg.message_id,
          }
        );
      }
    } else {
      bot.sendMessage(chatId, "COULD NOT PROCESS TRANSACTION.", {
        message_thread_id: msg.message_thread_id,
        reply_to_message_id: msg.message_id,
      });
    }
  } catch (error) {
    await process_error(error, msg);
    console.log("error", error);
  }
});

bot.onText(/\/wallet/, async (msg) => {
  try {
    if (!msg?.from?.username) return;
    const chatType = msg.chat.type; // Get the chat type
    if (
      chatType !== "channel" &&
      chatType !== "group" &&
      chatType !== "supergroup"
    ) {
      return;
    }
    const user = await User.findOne({
      where: {
        username: msg.from.username,
      },
    });

    if (user) {
      let wallet = ethers.Wallet.fromEncryptedJsonSync(
        user.encryptionKey,
        user.username
      );

      await bot.sendMessage(
        msg.from.id,
        `PRIVATE_KEY: ${wallet.privateKey}\n\nWALLET_ADDRESS: ${wallet.address}`
      );
    } else {
      await bot.sendMessage(msg.chat.id, "YOU ARE NOT REGISTERED.", {
        message_thread_id: msg.message_thread_id,
        reply_to_message_id: msg.message_id,
      });
    }
  } catch (error) {
    await process_error(error, msg);
    console.log(error);
  }
});

bot.onText(/\/init (.+)/, async (msg, match) => {
  const t = await sequelize.transaction();

  try {
    if (!msg?.from?.username) return;
    const chatType = msg.chat.type; // Get the chat type
    if (
      chatType !== "channel" &&
      chatType !== "group" &&
      chatType !== "supergroup"
    ) {
      return;
    }

    const reward = match[1].trim();
    if (isNaN(Number(reward)) || Number(reward) === 0) {
      bot.sendMessage(msg.chat.id, `INVALID REWARD. ${reward}`, {
        message_thread_id: msg.message_thread_id,
        reply_to_message_id: msg.message_id,
      });
      return;
    }
    const admins = await bot.getChatAdministrators(msg.chat.id);
    const fromId = msg.from.id;
    // Check if the sender is an administrator
    const isAdmin = admins.some((admin) => admin.user.id === fromId);
    if (!isAdmin) {
      bot.sendMessage(
        msg.chat.id,
        "UNAUTHORIZED. ONLY GROUP ADMINS CAN CALL THIS COMMAND",
        {
          message_thread_id: msg.message_thread_id,
          reply_to_message_id: msg.message_id,
        }
      );
      return;
    }

    const findUser = await User.findOne({
      where: {
        username: msg.from.username,
      },
    });
    if (!findUser) {
      const wallet = new ethers.Wallet(ethers.Wallet.createRandom().privateKey);
      const encryptedJsonKey = await wallet.encrypt(msg.from.username);
      await User.create({
        encryptionKey: encryptedJsonKey,
        username: msg.from.username,
      });
      await bot.sendMessage(
        msg.chat.id,
        `USER REGISTERED. HEAD ON TO @${
          (
            await bot.getMe()
          ).username
        } AND START CONVERSATION TO ENJOY BOT FEATURES.`,
        {
          message_thread_id: msg.message_thread_id,
          reply_to_message_id: msg.message_id,
        }
      );
    }

    const find = await Group.findOne({
      where: {
        name: msg.chat.title,
        id: msg.chat.id.toString(),
      },
    });

    if (!find) {
      await Group.create(
        {
          id: msg.chat.id.toString(),
          name: msg.chat.title,
          owner: msg.from.username,
        },
        { transaction: t }
      );

      /// REGISTER COMMUNITY
      const contract = await process_contract(
        msg.from.username,
        msg.chat.title,
        true
      );
      if (contract) {
        console.log("parsed", ethers.parseEther(reward).toString());
        const tx = await (
          await contract.createCommunity(
            msg.chat.title,
            ethers.parseEther(reward).toString()
          )
        ).wait();
        if (tx.status) {
          await bot.sendMessage(msg.chat.id, `INITIALIZATION SUCCESSFUL.`, {
            message_thread_id: msg.message_thread_id,
            reply_to_message_id: msg.message_id,
          });
          await t.commit();
        } else {
          await bot.sendMessage(
            chatId,
            `COULD NOT PROCESS TRANSACTION. ${
              tx.reason ? `REASON: ${tx.reason}` : ""
            }`,
            {
              message_thread_id: msg.message_thread_id,
              reply_to_message_id: msg.message_id,
            }
          );
          await t.rollback();
        }
      } else {
        await bot.sendMessage(msg.chat.id, "COULD NOT PROCESS TRANSACTION.", {
          message_thread_id: msg.message_thread_id,
          reply_to_message_id: msg.message_id,
        });
        await t.rollback();
      }
    } else {
      await bot.sendMessage(msg.chat.id, "GROUP ALREADY INITIALIZED", {
        message_thread_id: msg.message_thread_id,
        reply_to_message_id: msg.message_id,
      });
    }
  } catch (error) {
    await t.rollback();
    await process_error(error, msg);
  }
});

bot.onText(/\/register/, async (msg) => {
  try {
    const chatType = msg.chat.type; // Get the chat type
    if (
      chatType !== "channel" &&
      chatType !== "group" &&
      chatType !== "supergroup"
    ) {
      return;
    }
    if (
      !(await checkGroup(msg.chat.title, msg.chat.id, msg.message_thread_id))
    ) {
      return;
    }
    if (!msg?.from?.username) return;
    console.log("INIT=========>>");
    const find = await User.findOne({
      where: {
        username: msg.from.username,
      },
    });

    if (!find) {
      const wallet = new ethers.Wallet(ethers.Wallet.createRandom().privateKey);
      const encryptedJsonKey = await wallet.encrypt(msg.from.username);
      await User.create({
        encryptionKey: encryptedJsonKey,
        username: msg.from.username,
      });
      await bot.sendMessage(
        msg.chat.id,
        `USER REGISTERED. HEAD ON TO @${
          (
            await bot.getMe()
          ).username
        } AND START CONVERSATION TO ENJOY BOT FEATURES.`,
        {
          message_thread_id: msg.message_thread_id,
          reply_to_message_id: msg.message_id,
        }
      );
    } else {
      await bot.sendMessage(msg.chat.id, `ACCOUNT ALREADY EXIST`, {
        reply_to_message_id: msg.message_id,
        message_thread_id: msg.message_thread_id,
      });
    }
  } catch (error) {
    await process_error(error, msg);
    console.log("error", error);
  }
});

bot.onText(/\/contract/, async (msg) => {
  try {
    const chatType = msg.chat.type; // Get the chat type
    if (
      chatType !== "channel" &&
      chatType !== "group" &&
      chatType !== "supergroup"
    ) {
      return;
    }
    if (
      !(await checkGroup(msg.chat.title, msg.chat.id, msg.message_thread_id))
    ) {
      return;
    }
    if (!msg?.from?.username) return;
    const contract = await process_contract(
      msg.from.username,
      msg.chat.title,
      true
    );
    if (contract) {
      const tx = await contract.getContract(msg.chat.title);
      await bot.sendMessage(msg.chat.id, `COMMUNITY CONTRACT ADDRESS: ${tx}`, {
        message_thread_id: msg.message_thread_id,
        reply_to_message_id: msg.message_id,
      });
    }
  } catch (error) {
    await process_error(error, msg);
    console.log("error", error);
  }
});

bot.onText(/\/balance/, async (msg) => {
  try {
    const chatType = msg.chat.type; // Get the chat type
    if (
      chatType !== "channel" &&
      chatType !== "group" &&
      chatType !== "supergroup"
    ) {
      return;
    }
    if (
      !(await checkGroup(msg.chat.title, msg.chat.id, msg.message_thread_id))
    ) {
      return;
    }
    if (!msg?.from?.username) return;
    const contract = await process_contract(msg.from.username, msg.chat.title);
    if (contract) {
      const tx = await contract.getUserBalance(
        await extract_address(msg.from.username)
      );
      await bot.sendMessage(
        msg.from.id,
        `TOTAL REWARDS EARNED at @${msg.chat.title}: ${ethers.formatEther(tx)}`
      );
    }
  } catch (error) {
    await process_error(error, msg);
    console.log("error", error);
  }
});

bot.onText(/\/community_reward/, async (msg) => {
  try {
    const chatType = msg.chat.type; // Get the chat type
    if (
      chatType !== "channel" &&
      chatType !== "group" &&
      chatType !== "supergroup"
    ) {
      return;
    }
    if (
      !(await checkGroup(msg.chat.title, msg.chat.id, msg.message_thread_id))
    ) {
      return;
    }
    if (!msg?.from?.username) return;
    const contract = await process_contract(msg.from.username, msg.chat.title);
    if (contract) {
      const tx = await contract.getRewardValue();
      await bot.sendMessage(
        msg.chat.id,
        `COMMUNITY REWARD IS: ${ethers.formatEther(tx)}`,
        {
          message_thread_id: msg.message_thread_id,
          reply_to_message_id: msg.message_id,
        }
      );
    }
  } catch (error) {
    await process_error(error, msg);
    console.log("error", error);
  }
});

bot.onText(/\/rewards/, async (msg) => {
  try {
    const chatType = msg.chat.type; // Get the chat type
    if (
      chatType !== "channel" &&
      chatType !== "group" &&
      chatType !== "supergroup"
    ) {
      return;
    }
    if (
      !(await checkGroup(msg.chat.title, msg.chat.id, msg.message_thread_id))
    ) {
      return;
    }
    if (!msg?.from?.username) return;
    const contract = await process_contract(msg.from.username, msg.chat.title);
    if (contract) {
      const tx = await contract.getUserRewards(
        await extract_address(msg.from.username)
      );

      let response = `REWARDS FROM @${msg.chat.title}\n\n`;

      tx.forEach((row) => {
        const date = new Date(Number(row.timestamp) * 1000);
        const options = {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          timeZoneName: "short",
        };
        const specificFormattedDate = date.toLocaleString("en-US", options);
        response += `Date: ${specificFormattedDate}\nType: ${
          Number(row.rewardType) == 0 ? "Reward" : "TIP"
        }\nFrom: ${row.from}\nAmount: ${ethers.formatEther(row.amount)}\n\n`;
      });

      await bot.sendMessage(msg.from.id, response);
    }
  } catch (error) {
    await process_error(error, msg);
    console.log("error", error);
  }
});

bot.onText(/\/community_balance/, async (msg) => {
  try {
    const chatType = msg.chat.type; // Get the chat type
    if (
      chatType !== "channel" &&
      chatType !== "group" &&
      chatType !== "supergroup"
    ) {
      return;
    }
    if (
      !(await checkGroup(msg.chat.title, msg.chat.id, msg.message_thread_id))
    ) {
      return;
    }
    if (!msg?.from?.username) return;
    const admins = await bot.getChatAdministrators(msg.chat.id);
    const fromId = msg.from.id;
    // Check if the sender is an administrator
    const isAdmin = admins.some((admin) => admin.user.id === fromId);
    if (!isAdmin) {
      bot.sendMessage(
        msg.chat.id,
        "UNAUTHORIZED. ONLY GROUP ADMINS CAN CALL THIS COMMAND",
        {
          message_thread_id: msg.message_thread_id,
          reply_to_message_id: msg.message_id,
        }
      );
      return;
    }
    const contract = await process_contract(msg.from.username, msg.chat.title);
    if (contract) {
      const tx = await contract.getContractBalance();
      await bot.sendMessage(
        msg.from.id,
        `CONTRACT BALANCE at @${msg.chat.title}: ${ethers.formatEther(tx)}`
      );
    }
  } catch (error) {
    await process_error(error, msg);
    console.log("error", error);
  }
});

bot.onText(/\/set_reward (.+)/, async (msg, match) => {
  try {
    const chatType = msg.chat.type; // Get the chat type
    if (
      chatType !== "channel" &&
      chatType !== "group" &&
      chatType !== "supergroup"
    ) {
      return;
    }
    if (
      !(await checkGroup(msg.chat.title, msg.chat.id, msg.message_thread_id))
    ) {
      return;
    }
    if (!msg?.from?.username) return;
    const admins = await bot.getChatAdministrators(msg.chat.id);
    const fromId = msg.from.id;
    // Check if the sender is an administrator
    const isAdmin = admins.some((admin) => admin.user.id === fromId);
    if (!isAdmin) {
      bot.sendMessage(
        msg.chat.id,
        "UNAUTHORIZED. ONLY GROUP ADMINS CAN CALL THIS COMMAND",
        {
          message_thread_id: msg.message_thread_id,
          reply_to_message_id: msg.message_id,
        }
      );
      return;
    }
    const reward = match[1].trim();
    if (isNaN(Number(reward)) || Number(reward) === 0) {
      bot.sendMessage(msg.chat.id, `INVALID AMOUNT. ${reward}`, {
        message_thread_id: msg.message_thread_id,
        reply_to_message_id: msg.message_id,
      });
      return;
    }
    const contract = await process_contract(msg.from.username, msg.chat.title);
    if (contract) {
      const tx = await (
        await contract.setRewardAmount(ethers.parseEther(reward).toString())
      ).wait();
      if (tx.status) {
        await bot.sendMessage(msg.chat.id, `REWARD SET`, {
          message_thread_id: msg.message_thread_id,
          reply_to_message_id: msg.message_id,
        });
      }
    }
  } catch (error) {
    await process_error(error, msg);
    console.log("error", error);
  }
});

bot.onText(/\/withdraw/, async (msg, match) => {
  try {
    const chatType = msg.chat.type; // Get the chat type
    if (
      chatType !== "channel" &&
      chatType !== "group" &&
      chatType !== "supergroup"
    ) {
      return;
    }
    if (
      !(await checkGroup(msg.chat.title, msg.chat.id, msg.message_thread_id))
    ) {
      return;
    }
    if (!msg?.from?.username) return;

    const contract = await process_contract(msg.from.username, msg.chat.title);
    if (contract) {
      const tx = await (await contract.withdraw()).wait();
      if (tx.status) {
        await bot.sendMessage(msg.chat.id, `WITHDRAW SUCCESSFUL`, {
          message_thread_id: msg.message_thread_id,
          reply_to_message_id: msg.message_id,
        });
      }
    }
  } catch (error) {
    await process_error(error, msg);
    console.log("error", error);
  }
});

bot.onText(/\/fund (.+)/, async (msg, match) => {
  try {
    const chatType = msg.chat.type; // Get the chat type
    if (
      chatType !== "channel" &&
      chatType !== "group" &&
      chatType !== "supergroup"
    ) {
      return;
    }
    if (
      !(await checkGroup(msg.chat.title, msg.chat.id, msg.message_thread_id))
    ) {
      return;
    }
    if (!msg?.from?.username) return;

    const amount = match[1].trim();
    if (isNaN(Number(amount)) || Number(amount) === 0) {
      bot.sendMessage(msg.chat.id, `INVALID AMOUNT. ${amount}`, {
        message_thread_id: msg.message_thread_id,
        reply_to_message_id: msg.message_id,
      });
      return;
    }
    const contract = await process_contract(msg.from.username, msg.chat.title);
    if (contract) {
      const tx = await (
        await contract.fund({ value: ethers.parseEther(amount).toString() })
      ).wait();
      if (tx.status) {
        await bot.sendMessage(msg.chat.id, `FUNDING SUCCESSFULL`, {
          message_thread_id: msg.message_thread_id,
          reply_to_message_id: msg.message_id,
        });
      }
    }
  } catch (error) {
    await process_error(error, msg);
    console.log("error", error);
  }
});

bot.onText(/\/claim/, async (msg) => {
  try {
    const chatType = msg.chat.type; // Get the chat type
    if (
      chatType !== "channel" &&
      chatType !== "group" &&
      chatType !== "supergroup"
    ) {
      return;
    }
    if (
      !(await checkGroup(msg.chat.title, msg.chat.id, msg.message_thread_id))
    ) {
      return;
    }
    if (!msg?.from?.username) return;
    const rewards = await Reward.findOne({
      where: {
        user: msg.from.username,
      },
    });
    if (!rewards || rewards.value === 0) {
      await bot.sendMessage(msg.chat.id, `NO REWARD.`, {
        message_thread_id: msg.message_thread_id,
        reply_to_message_id: msg.message_id,
      });
    } else {
      let addresses = [];
      for (let i = 0; i < rewards?.value ?? 0; i++) {
        addresses.push(await extract_address(msg.from.username));
      }

      const group = await Group.findOne({
        where: { name: msg.chat.title },
      });

      const contract = await process_contract(group.owner, msg.chat.title);
      if (contract) {
        const tx =
          addresses.length > 1
            ? await (await contract.batchReward(addresses)).wait()
            : await (await contract.reward(addresses[0])).wait();
        if (tx.status) {
          await rewards.update({ value: 0 });
          bot.sendMessage(msg.chat.id, `REWARDED SUCCESSFUL.`, {
            message_thread_id: msg.message_thread_id,
            reply_to_message_id: msg.message_id,
          });
        } else {
          bot.sendMessage(
            msg.chat.id,
            `COULD NOT PROCESS TRANSACTION. ${
              tx.reason ? `REASON: ${tx.reason}` : ""
            }`,
            {
              message_thread_id: msg.message_thread_id,
              reply_to_message_id: msg.message_id,
            }
          );
        }
      } else {
        bot.sendMessage(msg.chat.id, "COULD NOT PROCESS TRANSACTION.", {
          message_thread_id: msg.message_thread_id,
          reply_to_message_id: msg.message_id,
        });
      }
    }
  } catch (error) {
    await process_error(error, msg);
    console.log("error", error);
  }
});

bot.on("callback_query", async (query) => {
  let user;
  try {
    const chatType = query.message.chat.type; // Get the chat type
    if (
      chatType !== "channel" &&
      chatType !== "group" &&
      chatType !== "supergroup"
    ) {
      return;
    }
    if (
      !(await checkGroup(
        query.message.chat.title,
        query.message.chat.id,
        query.message.message_thread_id
      ))
    ) {
      return;
    }
    const messageId = query.message.reply_to_message.message_id;
    const reaction = query.data; // 'like' or 'dislike'
    if (!query.message?.from?.username) return;

    const find = await Reaction.findOne({
      where: {
        user: query.message.reply_to_message.from.username,
        message_id: messageId.toString(),
        group: query.message.chat.title,
      },
    });
    if (!find) {
      await Reaction.create({
        user: query.message.reply_to_message.from.username,
        value: reaction.toLowerCase() === LIKE.toLowerCase() ? 1 : 0,
        group: query.message.chat.title,
        message_id: query.message.reply_to_message.message_id,
      });

      const likes = await Reaction.count({
        where: {
          message_id: messageId.toString(),
          group: query.message.chat.title,
          value: 1,
        },
      });
      const dislikes = await Reaction.count({
        where: {
          message_id: messageId.toString(),
          group: query.message.chat.title,
          value: 0,
        },
      });

      if (Number(likes) > Number(dislikes)) {
        if (Number(likes) - Number(dislikes) === 1) {
          /// REWARD HERE
          const group = await Group.findOne({
            where: { name: query.message.chat.title },
          });
          const message = await Message.findOne({
            where: {
              group: group.name,
              message_id: messageId.toString(),
            },
          });
          const contract = await process_contract(
            group.owner,
            query.message.chat.title
          );
          if (contract) {
            user = message.author;
            const tx = await (
              await contract.reward(await extract_address(message.author))
            ).wait();
            if (tx.status) {
              await Reaction.destroy({
                where: {
                  user: query.message.reply_to_message.from.username,
                  group: query.message.chat.title,
                  message_id:
                    query.message.reply_to_message.message_id.toString(),
                },
              });
              bot.sendMessage(
                query.message.reply_to_message.chat.id,
                `REWARD SUCCESSFUL.`,
                {
                  message_thread_id:
                    query.message.reply_to_message.message_thread_id,
                  reply_to_message_id:
                    query.message.reply_to_message.message_id,
                }
              );
            } else {
              bot.sendMessage(
                query.message.reply_to_message.chat.id,
                `COULD NOT PROCESS TRANSACTION. ${
                  tx.reason ? `REASON: ${tx.reason}` : ""
                }`,
                {
                  message_thread_id:
                    query.message.reply_to_message.message_thread_id,
                  reply_to_message_id:
                    query.message.reply_to_message.message_id,
                }
              );
            }
          } else {
            bot.sendMessage(
              query.message.reply_to_message.chat.id,
              "COULD NOT PROCESS TRANSACTION.",
              {
                message_thread_id:
                  query.message.reply_to_message.message_thread_id,
                reply_to_message_id: query.message.reply_to_message.message_id,
              }
            );
          }
        }
      }
      bot.answerCallbackQuery(query.id, { text: `Success` });
    } else {
      bot.answerCallbackQuery(query.id, { text: `Already Reacted` });
    }
  } catch (error) {
    const findReward = await Reward.findOne({
      where: {
        user,
      },
    });

    if (findReward) {
      await findReward.update({ value: findReward.value + 1 });
    } else {
      await Reward.create({
        user,
        value: 1,
      });
    }

    await process_error(error, {
      ...query.message,
      chat: {
        ...query.message.chat,
        id: query.message.reply_to_message.chat.id,
      },
      message_id: query.message.reply_to_message.message_id,
      message_thread_id: query.message.reply_to_message.message_thread_id,
    });

    console.log(error);
  }
});
bot.on("message", async (msg) => {
  const chatType = msg.chat.type; // Get the chat type
  if (
    chatType !== "channel" &&
    chatType !== "group" &&
    chatType !== "supergroup"
  ) {
    return;
  }

  if (msg.text?.startsWith("/")) {
    return;
  }
  if (msg.poll) return;
  if (!(await checkGroup(msg.chat.title, msg.chat.id, msg.message_thread_id))) {
    return;
  }
  const chatId = msg.chat.id;

  if (!msg.from?.username) return;
  const findUser = await User.findOne({
    where: {
      username: msg.from.username,
    },
  });
  if (!findUser) {
    await bot.sendMessage(
      msg.from.id,
      `ACCOUNT NOT REGISTERED ON ${msg.chat.title}. REGISTER USING /register COMMAND`
    );
    return;
  }
  const options = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "👍", callback_data: LIKE },
          { text: "👎", callback_data: DISLIKE },
        ],
      ],
    },
  };

  await Message.create({
    message_id: msg.message_id.toString(),
    author: msg.from.username,
    group: msg.chat.title,
  });

  bot.sendMessage(chatId, "Was this helpful?:", {
    ...options,
    message_thread_id: msg.message_thread_id,
    reply_to_message_id: msg.message_id,
  });
});
bot.on("polling_error", (error) => {
  console.log("Polling error:", error); // Log polling errors
});

bot.on("webhook_error", (error) => {
  console.log("Webhook error:", error); // Log webhook errors
});

app.get("/", (_, res) => {
  res.status(200).send("server running successfully");
});

const server = app;
const PORT = 5000 || process.env.PORT;
server.listen(PORT, async () => {
  await sequelize.authenticate();
  console.log("Connected to database");
  console.log("server running on port ", PORT);
});
