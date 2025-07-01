const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const API_BASE = process.env.API_BASE || 'https://kisu1bot-backend-repo.onrender.com/api/user';
const UPLOAD_URL = 'https://kisu1bot-backend-repo.onrender.com/api/upload-photo';

const userMatchQueue = {};
const awaitingPhoto = {};

bot.onText(/\/photo/, (msg) => {
  const chatId = msg.chat.id;
  awaitingPhoto[chatId] = true;
  bot.sendMessage(chatId, 'Please send a profile photo.');
});

bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;

  if (!awaitingPhoto[chatId]) return;

  const fileId = msg.photo[msg.photo.length - 1].file_id;
  const filePath = await bot.getFileLink(fileId);

  try {
    const response = await axios({
      method: 'POST',
      url: `${UPLOAD_URL}/${telegramId}`,
      data: { image: filePath },
      headers: { 'Content-Type': 'application/json' }
    });

    bot.sendMessage(chatId, 'Photo uploaded successfully!');
  } catch (err) {
    console.error(err.message);
    bot.sendMessage(chatId, 'Photo upload failed.');
  }

  delete awaitingPhoto[chatId];
});
