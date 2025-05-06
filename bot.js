const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
require('dotenv').config();

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const API_BASE = process.env.API_BASE || 'https://kissubot-backend-repo.onrender.com/api/user';

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

  bot.sendMessage(chatId, 'Please send your age, gender, bio, and interests (comma-separated) in the format:

25
Male
Loves movies and books
music,travel,reading');

  bot.once('message', async (response) => {
    const lines = response.text.split('\n');
    if (lines.length < 4) return bot.sendMessage(chatId, 'Invalid format. Please use 4 lines.');

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

    if (profiles.length === 0) return bot.sendMessage(chatId, 'No new users found. Try again later.');

    profiles.forEach((user) => {
      bot.sendMessage(chatId,
        `@${user.username || 'unknown'}
Age: ${user.age}
Gender: ${user.gender}
Bio: ${user.bio}
Interests: ${user.interests?.join(', ') || 'None'}

Use /like ${user.telegramId} to like`
      );
    });
  } catch (err) {
    bot.sendMessage(chatId, 'Error getting matches.');
  }
});

bot.onText(/\/like (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const fromId = msg.from.id;
  const toId = match[1];

  try {
    const res = await axios.post(`${API_BASE}/like`, { fromId, toId });
    bot.sendMessage(chatId, res.data.message || 'Liked!');
  } catch (err) {
    bot.sendMessage(chatId, 'Error liking user.');
  }
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
