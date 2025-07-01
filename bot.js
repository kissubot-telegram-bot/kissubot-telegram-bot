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

bot.onText(/\/register/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;

  try {
    const res = await axios.post(`${API_BASE}/register`, {
      telegramId,
      username: msg.from.username || '',
    });
    bot.sendMessage(chatId, res.data.message || 'Registered successfully!');
  } catch (err) {
    bot.sendMessage(chatId, 'Registration failed.');
  }
});

bot.onText(/\/browse/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;

  try {
    const res = await axios.get(`${API_BASE}/browse/${telegramId}`);
    userMatchQueue[telegramId] = res.data;
    sendNextProfile(chatId, telegramId);
  } catch (err) {
    bot.sendMessage(chatId, 'Failed to load profiles.');
  }
});

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const telegramId = query.from.id;
  const data = query.data;

  if (data.startsWith('like_')) {
    const toId = data.split('_')[1];
    try {
      const res = await axios.post(`${API_BASE}/like`, {
        fromId: telegramId,
        toId,
      });

      if (res.data.matched) {
        bot.sendMessage(chatId, `You matched with @${res.data.username || 'someone'}!`);
      } else {
        bot.sendMessage(chatId, res.data.message || 'Liked!');
      }
    } catch (err) {
      bot.sendMessage(chatId, 'Error while liking.');
    }
  }

  sendNextProfile(chatId, telegramId);
});

bot.onText(/\/matches/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;

  try {
    const res = await axios.get(`${API_BASE}/matches/${telegramId}`);
    const matches = res.data;

    if (!matches.length) return bot.sendMessage(chatId, 'No matches yet.');

    matches.forEach(user => {
      const matchMsg = `Matched with @${user.username || 'unknown'} - Age: ${user.age}, Bio: ${user.bio}`;
      bot.sendMessage(chatId, matchMsg);
    });
  } catch (err) {
    bot.sendMessage(chatId, 'Failed to retrieve matches.');
  }
});

app.listen(PORT, () => {
  console.log(`Bot server running on port ${PORT}`);
});
require('./bot');






