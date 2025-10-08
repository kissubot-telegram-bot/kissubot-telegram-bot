const axios = require('axios');
const { getCachedUserProfile } = require('./auth');

const API_BASE = process.env.API_BASE || 'http://localhost:3000/api';

function setupProfileCommands(bot) {
  // PROFILE command - View/edit profile
  bot.onText(/\/profile/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    try {
      const user = await getCachedUserProfile(telegramId);
      
      const profileMsg = `👤 **YOUR PROFILE** 👤\n\n` +
        `📝 **Name:** ${user.name || 'Not set'}\n` +
        `🎂 **Age:** ${user.age || 'Not set'}\n` +
        `📍 **Location:** ${user.location || 'Not set'}\n` +
        `💬 **Bio:** ${user.bio || 'Not set'}\n\n` +
        `📸 **Photos:** ${user.photos?.length || 0} uploaded\n\n` +
        `✨ Choose what to edit:`;

      const opts = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✏️ Edit Name', callback_data: 'edit_name' },
              { text: '🎂 Edit Age', callback_data: 'edit_age' }
            ],
            [
              { text: '📍 Edit Location', callback_data: 'edit_location' },
              { text: '💬 Edit Bio', callback_data: 'edit_bio' }
            ],
            [
              { text: '📸 Manage Photos', callback_data: 'manage_photos' }
            ],
            [
              { text: '🔙 Back to Main Menu', callback_data: 'main_menu' }
            ]
          ]
        }
      };

      bot.sendMessage(chatId, profileMsg, opts);
    } catch (err) {
      bot.sendMessage(chatId, '❌ Failed to load your profile. Please try /register first.');
    }
  });

  // Profile editing commands
  bot.onText(/\/setname (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const name = match[1];

    try {
      await axios.post(`${API_BASE}/profile/update/${telegramId}`, { field: 'name', value: name });
      bot.sendMessage(chatId, `✅ Name updated to: ${name}`);
    } catch (err) {
      bot.sendMessage(chatId, '❌ Failed to update name. Please try again.');
    }
  });

  bot.onText(/\/setage (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const age = parseInt(match[1]);

    if (age < 18 || age > 100) {
      return bot.sendMessage(chatId, '❌ Age must be between 18 and 100.');
    }

    try {
      await axios.post(`${API_BASE}/profile/update/${telegramId}`, { field: 'age', value: age });
      bot.sendMessage(chatId, `✅ Age updated to: ${age}`);
    } catch (err) {
      bot.sendMessage(chatId, '❌ Failed to update age. Please try again.');
    }
  });

  bot.onText(/\/setlocation (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const location = match[1];

    try {
      await axios.post(`${API_BASE}/profile/update/${telegramId}`, { field: 'location', value: location });
      bot.sendMessage(chatId, `✅ Location updated to: ${location}`);
    } catch (err) {
      bot.sendMessage(chatId, '❌ Failed to update location. Please try again.');
    }
  });

  bot.onText(/\/setbio (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const bio = match[1];

    if (bio.length > 500) {
      return bot.sendMessage(chatId, '❌ Bio must be 500 characters or less.');
    }

    try {
      await axios.post(`${API_BASE}/profile/update/${telegramId}`, { field: 'bio', value: bio });
      bot.sendMessage(chatId, `✅ Bio updated successfully!`);
    } catch (err) {
      bot.sendMessage(chatId, '❌ Failed to update bio. Please try again.');
    }
  });

  // Photo upload command
  bot.onText(/\/photo/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    
    bot.sendMessage(chatId, '📸 **PHOTO UPLOAD** 📸\n\n' +
      'Send me a photo to add to your profile!\n\n' +
      '📋 **Tips:**\n' +
      '• Use high-quality photos\n' +
      '• Show your face clearly\n' +
      '• Maximum 6 photos allowed\n\n' +
      '📤 Just send the photo as your next message!');
  });
}

module.exports = { setupProfileCommands };
