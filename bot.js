// bot.js
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

const BOT_TOKEN = process.env.BOT_TOKEN;
const API_BASE = process.env.API_BASE;
const bot = new TelegramBot(BOT_TOKEN);

// Webhook setup
const PORT = process.env.PORT || 3000;
app.post(`/bot${BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Start webhook
bot.setWebHook(`${process.env.RENDER_EXTERNAL_URL}/bot${BOT_TOKEN}`);

const userMatchQueue = {}; // Temporary in-memory queue

function sendNextProfile(chatId, telegramId) {
  const queue = userMatchQueue[telegramId];
  if (!queue || queue.length === 0) {
    return bot.sendMessage(chatId, 'No more profiles right now.');
  }

  const user = queue.shift();
  const text = `@${user.username || 'unknown'}\nAge: ${user.age}\nGender: ${user.gender}\nBio: ${user.bio}\nInterests: ${user.interests?.join(', ') || 'None'}`;
  const opts = {
    reply_markup: {
      inline_keyboard: [[
        { text: '❤️ Like', callback_data: `like_${user.telegramId}` },
        { text: '❌ Pass', callback_data: `pass` }
      ]]
    }
  };

  bot.sendMessage(chatId, text, opts);
}

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Welcome to Kisu1bot! Use /register to get started.');
});

// START
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `👋 Welcome to KissuBot!

Meet new people, find love, or just have fun 💘
Use /profile to set up your profile and start browsing!`);
});

// PROFILE
bot.onText(/\/profile/, async (msg) => {
  const chatId = msg.chat.id;
  // Placeholder: you can fetch real user data from DB later
  bot.sendMessage(chatId, `🧍 Your Profile:

• Name: (not set)
• Age: (not set)
• Gender: (not set)
• Bio: (not set)

Update coming soon!`);
});

// MATCHES
bot.onText(/\/matches/, async (msg) => {
  const chatId = msg.chat.id;
  // Placeholder for matched users
  bot.sendMessage(chatId, `💞 You have no matches yet.
Keep browsing and liking profiles!`);
});

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const telegramId = query.from.id;
  const data = query.data;

  if (data.startsWith('like_')) {
    const toId = data.split('_')[1];
    try {
      const res = await axios.post(${API_BASE}/like, {
        fromId: telegramId,
        toId,
      });

      if (res.data.matched) {
        bot.sendMessage(chatId, You matched with @${res.data.username || 'someone'}!);
      } else {
        bot.sendMessage(chatId, res.data.message || 'Liked!');
      }
    } catch (err) {
      bot.sendMessage(chatId, 'Error while liking.');
    }
  }

  sendNextProfile(chatId, telegramId);
// LIKESYOU (VIP Only)
bot.onText(/\/likesyou/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `🔐 This feature is for VIP users only!

Upgrade to VIP to see who already liked your profile 💖`);
});

// STORIES
bot.onText(/\/stories/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `📸 Stories feature coming soon!

You'll be able to watch anonymous photo stories and reply.`);
});

// GIFTS
bot.onText(/\/gifts/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `🎁 Send virtual gifts to impress someone special!

Feature in development... stay tuned!`);
});

// COINS
bot.onText(/\/coins/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `💰 You currently have 0 KissuCoins.

Earn more by staying active or upgrade to VIP for bonuses.`);
});

// VIP
bot.onText(/\/vip/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `🌟 VIP Features:

• See who liked you
• Appear first in searches
• Unlimited likes
• Access to hidden profiles
• Reply to stories

Upgrade coming soon! 💎`);
});

// PRIORITY
bot.onText(/\/priority/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `🚀 Boost your profile visibility!

Stay on top of everyone's search results.

Priority Boosts launching soon.`);
});

// SEARCH SETTINGS
bot.onText(/\/search_settings/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `🔍 Match Filters:

Currently showing all users.

Soon you'll be able to filter by:
• Age range
• Gender
• Location
• Interests`);
});

// SETTINGS
bot.onText(/\/settings/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `⚙️ Settings Menu:

Coming soon — you'll be able to:
• Change language
• Adjust notifications
• Privacy settings`);
});

// HELP
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `🆘 Help Menu:

Use the following commands:
• /start – Begin your journey
• /profile – Edit your profile
• /matches – View your matches
• /likesyou – VIP feature
• /vip – Learn about VIP
• /delete_profile – Remove your account
• /contact_support – Get help`);
});

// REPORT
bot.onText(/\/report/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `🚨 To report a user, send us their @username and issue.

Our team will take immediate action if needed.`);
});

// DELETE PROFILE
bot.onText(/\/delete_profile/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `⚠️ Are you sure you want to delete your profile?

Send /confirm_delete to proceed (this action is irreversible).`);
});

// CONTACT SUPPORT
bot.onText(/\/contact_support/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `💬 You can reach us at @KissuSupport

We’ll reply within 24 hours.`);
});







