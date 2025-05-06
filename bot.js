const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();
const axios = require('axios');

const TELEGRAM_BOT_TOKEN = process.env.BOT_TOKEN;
const API_BASE = process.env.API_BASE || 'https://kissubot-backend-repo.onrender.com/api/user';

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

// Function to send match notification
const notifyMatch = async (userA, userB) => {
  const message = `You matched with @${userB.username || 'someone'}! Tap to chat: https://t.me/${userB.username || ''}`;
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    await axios.post(url, {
      chat_id: userA.telegramId,
      text: message,
    });
  } catch (err) {
    console.error('Failed to notify:', err.message);
  }
};

const userMatchQueue = {};

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;
  const username = msg.from.username;

  try {
    await axios.post(`${API_BASE}/register`, {
      telegramId,
      username,
    });
    bot.sendMessage(chatId, `Welcome to KissuBot, @${username}! Use /profile to set up your profile.`);
  } catch (err) {
    bot.sendMessage(chatId, 'Error during registration.');
  }
});

bot.onText(/\/profile/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;

  bot.sendMessage(chatId, 'Send your age, gender, bio, and interests (comma-separated) on 4 lines:\n\n25\nMale\nLove movies\ntravel,books');

  bot.once('message', async (response) => {
    const lines = response.text.split('\n');
    if (lines.length < 4) return bot.sendMessage(chatId, 'Invalid format. Use 4 lines.');

    const [age, gender, bio, interests] = lines;
    try {
      await axios.post(`${API_BASE}/register`, {
        telegramId,
        username: msg.from.username,
        age: parseInt(age),
        gender,
        bio,
        interests: interests.split(',').map(i => i.trim())
      });
      bot.sendMessage(chatId, 'Profile saved!');
    } catch (err) {
      bot.sendMessage(chatId, 'Error saving profile.');
    }
  });
});

bot.onText(/\/match/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;

  try {
    const res = await axios.get(`${API_BASE}/discover/${telegramId}`);
    const profiles = res.data;

    if (profiles.length === 0) return bot.sendMessage(chatId, 'No new users found.');

    userMatchQueue[telegramId] = profiles;
    sendNextProfile(chatId, telegramId);
  } catch (err) {
    bot.sendMessage(chatId, 'Error finding matches.');
  }
});

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

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const telegramId = query.from.id;
  const data = query.data;

  if (data.startsWith('like_')) {
    const toId = data.split('_')[1];
    try {
      const res = await axios.post(`${API_BASE}/like`, {
        fromId: telegramId,
        toId
      });

      if (res.data.matched) {
        await notifyMatch({ telegramId }, { username: res.data.username });
      }

      bot.sendMessage(chatId, res.data.message || 'Liked!');
    } catch (err) {
      bot.sendMessage(chatId, 'Error liking user.');
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
      bot.sendMessage(chatId, `Matched with @${user.username || 'unknown'} - Age: ${user.age}, Bio: ${user.bio}`);
    });
  } catch (err) {
    bot.sendMessage(chatId, 'Error retrieving matches.');
  }
});
git add bot.js
git commit -m "Fix duplicate axios declaration"
git push origin main






