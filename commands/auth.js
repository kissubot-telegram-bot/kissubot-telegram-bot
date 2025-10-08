const axios = require('axios');

const API_BASE = process.env.API_BASE || 'http://localhost:3000/api';

// Cache for user profiles
const userProfileCache = new Map();

async function getCachedUserProfile(telegramId) {
  if (userProfileCache.has(telegramId)) {
    return userProfileCache.get(telegramId);
  }
  
  const res = await axios.get(`${API_BASE}/users/${telegramId}`);
  userProfileCache.set(telegramId, res.data);
  return res.data;
}

function setupAuthCommands(bot) {
  // START command - Simple welcome message
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, '🎉 Welcome to Kisu1bot! 🎉\n\n' +
      '💕 Your journey to find love starts here!\n\n' +
      '🚀 **Get Started:**\n' +
      '• Use /register to create your dating profile\n' +
      '• Use /help for guidance and support\n\n' +
      'Ready to meet someone special? Let\'s begin! 💖');
  });

  // REGISTER command - Create new profile
  bot.onText(/\/register/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    try {
      // Check if user is already registered
      try {
        const existingUser = await getCachedUserProfile(telegramId);
        if (existingUser) {
          return bot.sendMessage(
            chatId,
            '✅ You\'re already registered!\n\n' +
            'You can:\n' +
            '• Use /profile to view your profile\n' +
            '• Use /browse to find people\n' +
            '• Use /matches to see your matches'
          );
        }
      } catch (err) {
        // User not found, continue with registration
        if (err.response?.status !== 404) {
          throw err;
        }
      }

      // Register the user
      const res = await axios.post(`${API_BASE}/register`, {
        telegramId,
        username: msg.from.username || '',
        name: msg.from.first_name || '',
      });

      // Send welcome message with next steps
      const welcomeMsg = 
        '🎉 Registration successful!\n\n' +
        'Let\'s set up your profile:\n' +
        '1️⃣ Use /setname to set your display name\n' +
        '2️⃣ Use /setage to set your age\n' +
        '3️⃣ Use /setlocation to set your location\n' +
        '4️⃣ Use /setbio to write about yourself\n\n' +
        'After setting up your profile, you can:\n' +
        '• Use /browse to find people\n' +
        '• Use /matches to see your matches';

      bot.sendMessage(chatId, welcomeMsg);
    } catch (err) {
      console.error('[/register] Error:', err.response?.data || err.message);
      bot.sendMessage(
        chatId,
        '❌ Registration failed. Please try again later.\n' +
        'If the problem persists, contact support.'
      );
    }
  });
}

module.exports = {
  setupAuthCommands,
  getCachedUserProfile
};
