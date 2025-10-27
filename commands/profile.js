const axios = require('axios');
const { getCachedUserProfile } = require('./auth');

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

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
  // Help command for setname
  bot.onText(/^\/setname$/, (msg) => {
    const chatId = msg.chat.id;
    const helpMsg = `📝 **How to set your name:**\n\n` +
      `✅ **Correct usage:** \`/setname Your Name\`\n\n` +
      `📋 **Examples:**\n` +
      `• \`/setname John\`\n` +
      `• \`/setname Sarah Smith\`\n` +
      `• \`/setname Alex_123\`\n\n` +
      `⚠️ **Requirements:**\n` +
      `• Name must be 1-50 characters\n` +
      `• Can include letters, numbers, spaces, and basic symbols\n` +
      `• Cannot be empty\n\n` +
      `💡 **Tip:** Just type \`/setname\` followed by a space and your desired name!`;
    
    bot.sendMessage(chatId, helpMsg, { parse_mode: 'Markdown' });
  });

  bot.onText(/\/setname (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const name = match[1];

    console.log(`[/setname] User ${telegramId} trying to set name to: ${name}`);

    try {
      const response = await axios.post(`${API_BASE}/profile/update/${telegramId}`, { field: 'name', value: name });
      console.log(`[/setname] Success for user ${telegramId}`);
      bot.sendMessage(chatId, `✅ **Name Updated Successfully!**\n\n👤 Your name is now: **${name}**\n\n💡 Tip: Use /profile to see your complete profile`);
    } catch (err) {
      console.error(`[/setname] Error for user ${telegramId}:`, err.response?.data || err.message);
      if (err.code === 'ECONNREFUSED' || err.response?.status >= 500) {
        bot.sendMessage(chatId, '❌ Server connection issue. Please try again in a moment.');
      } else {
        bot.sendMessage(chatId, '❌ Failed to update name. Please try again.');
      }
    }
  });

  // Help command for setage
  bot.onText(/^\/setage$/, (msg) => {
    const chatId = msg.chat.id;
    const helpMsg = `🎂 **How to set your age:**\n\n` +
      `✅ **Correct usage:** \`/setage 25\`\n\n` +
      `📋 **Examples:**\n` +
      `• \`/setage 21\`\n` +
      `• \`/setage 35\`\n` +
      `• \`/setage 28\`\n\n` +
      `⚠️ **Requirements:**\n` +
      `• Age must be between 18 and 100\n` +
      `• Must be a valid number\n` +
      `• No letters or special characters\n\n` +
      `💡 **Tip:** Just type \`/setage\` followed by your age in numbers!`;
    
    bot.sendMessage(chatId, helpMsg, { parse_mode: 'Markdown' });
  });

  bot.onText(/\/setage (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const age = parseInt(match[1]);

    console.log(`[/setage] User ${telegramId} trying to set age to: ${age}`);

    if (age < 18 || age > 100) {
      return bot.sendMessage(chatId, '❌ Age must be between 18 and 100.');
    }

    try {
      const response = await axios.post(`${API_BASE}/profile/update/${telegramId}`, { field: 'age', value: age });
      console.log(`[/setage] Success for user ${telegramId}`);
      bot.sendMessage(chatId, `✅ **Age Updated Successfully!**\n\n🎂 Your age is now: **${age}**\n\n💡 Tip: Use /profile to see your complete profile`);
    } catch (err) {
      console.error(`[/setage] Error for user ${telegramId}:`, err.response?.data || err.message);
      if (err.code === 'ECONNREFUSED' || err.response?.status >= 500) {
        bot.sendMessage(chatId, '❌ Server connection issue. Please try again in a moment.');
      } else {
        bot.sendMessage(chatId, '❌ Failed to update age. Please try again.');
      }
    }
  });

  // Help command for setlocation
  bot.onText(/^\/setlocation$/, (msg) => {
    const chatId = msg.chat.id;
    const helpMsg = `📍 **How to set your location:**\n\n` +
      `✅ **Correct usage:** \`/setlocation Your City\`\n\n` +
      `📋 **Examples:**\n` +
      `• \`/setlocation New York\`\n` +
      `• \`/setlocation London, UK\`\n` +
      `• \`/setlocation Tokyo\`\n\n` +
      `⚠️ **Requirements:**\n` +
      `• Location must be 1-100 characters\n` +
      `• Can include letters, numbers, spaces, and commas\n` +
      `• Cannot be empty\n\n` +
      `💡 **Tip:** Be specific! Include city and country for better matches.`;
    
    bot.sendMessage(chatId, helpMsg, { parse_mode: 'Markdown' });
  });

  bot.onText(/\/setlocation (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const location = match[1];

    console.log(`[/setlocation] User ${telegramId} trying to set location to: ${location}`);

    try {
      const response = await axios.post(`${API_BASE}/profile/update/${telegramId}`, { field: 'location', value: location });
      console.log(`[/setlocation] Success for user ${telegramId}`);
      bot.sendMessage(chatId, `✅ **Location Updated Successfully!**\n\n📍 Your location is now: **${location}**\n\n💡 Tip: Use /profile to see your complete profile`);
    } catch (err) {
      console.error(`[/setlocation] Error for user ${telegramId}:`, err.response?.data || err.message);
      if (err.code === 'ECONNREFUSED' || err.response?.status >= 500) {
        bot.sendMessage(chatId, '❌ Server connection issue. Please try again in a moment.');
      } else {
        bot.sendMessage(chatId, '❌ Failed to update location. Please try again.');
      }
    }
  });

  // Help command for setbio
  bot.onText(/^\/setbio$/, (msg) => {
    const chatId = msg.chat.id;
    const helpMsg = `💬 **How to set your bio:**\n\n` +
      `✅ **Correct usage:** \`/setbio Your bio description\`\n\n` +
      `📋 **Examples:**\n` +
      `• \`/setbio Love traveling and photography\`\n` +
      `• \`/setbio Coffee enthusiast and book lover\`\n` +
      `• \`/setbio Looking for meaningful connections\`\n\n` +
      `⚠️ **Requirements:**\n` +
      `• Bio must be 1-500 characters\n` +
      `• Can include any text, emojis, and symbols\n` +
      `• Cannot be empty\n\n` +
      `💡 **Tip:** Make it interesting! Tell others about your hobbies and interests.`;
    
    bot.sendMessage(chatId, helpMsg, { parse_mode: 'Markdown' });
  });

  bot.onText(/\/setbio (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const bio = match[1];

    console.log(`[/setbio] User ${telegramId} trying to set bio (${bio.length} chars)`);

    if (bio.length > 500) {
      return bot.sendMessage(chatId, '❌ Bio must be 500 characters or less.');
    }

    try {
      const response = await axios.post(`${API_BASE}/profile/update/${telegramId}`, { field: 'bio', value: bio });
      console.log(`[/setbio] Success for user ${telegramId}`);
      bot.sendMessage(chatId, `✅ **Bio Updated Successfully!**\n\n💬 Your bio has been updated with your new description.\n\n💡 Tip: Use /profile to see your complete profile`);
    } catch (err) {
      console.error(`[/setbio] Error for user ${telegramId}:`, err.response?.data || err.message);
      if (err.code === 'ECONNREFUSED' || err.response?.status >= 500) {
        bot.sendMessage(chatId, '❌ Server connection issue. Please try again in a moment.');
      } else {
        bot.sendMessage(chatId, '❌ Failed to update bio. Please try again.');
      }
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
