const axios = require('axios');


const API_BASE = process.env.API_BASE || 'http://localhost:3000';

const { getCachedUserProfile, invalidateUserCache } = require('./auth');

function setupProfileCommands(bot) {
  // User states for editing
  const userStates = {};

  // Callback query handlers
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const telegramId = query.from.id;
    const data = query.data;

    try {
      switch (data) {
        case 'edit_profile':
        case 'settings_profile':
          try {
            const profileRes = await axios.get(`${API_BASE}/profile/${telegramId}`);
            const user = profileRes.data;
  
            const profileMsg = `👤 **PROFILE SETTINGS** 👤\n\n` +
              `📝 **Current Information:**\n` +
              `• Name: ${user.name || 'Not set'}\n` +
              `• Age: ${user.age || 'Not set'}\n` +
              `• Location: ${user.location || 'Not set'}\n` +
              `• Bio: ${user.bio || 'Not set'}\n\n` +
              `✏️ **What would you like to edit?**`;
  
            const buttons = [
              [
                { text: '📝 Edit Name', callback_data: 'edit_name' },
                { text: '🎂 Edit Age', callback_data: 'edit_age' }
              ],
              [
                { text: '📍 Edit Location', callback_data: 'edit_location' },
                { text: '💭 Edit Bio', callback_data: 'edit_bio' }
              ],
              [
                { text: '📸 Manage Photos', callback_data: 'manage_photos' }
              ],
              [
                { text: '🔙 Back to Settings', callback_data: 'main_settings' }
              ]
            ];
  
            bot.sendMessage(chatId, profileMsg, {
              reply_markup: {
                inline_keyboard: buttons
              }
            });
          } catch (err) {
            bot.sendMessage(chatId, '❌ Failed to load your profile. Please try /register first.');
          }
          break;
  
        case 'edit_name':
          userStates[telegramId] = { editing: 'name' };
          bot.sendMessage(chatId, '📝 **Edit Name**\n\nPlease enter your new name:');
          break;
  
        case 'edit_age':
          userStates[telegramId] = { editing: 'age' };
          bot.sendMessage(chatId, '🎂 **Edit Age**\n\nPlease enter your age (18-99):');
          break;

        case 'edit_location':
          userStates[telegramId] = { editing: 'location' };
          bot.sendMessage(chatId, '📍 **Edit Location**\n\nPlease enter your location:');
          break;
  
        case 'edit_bio':
          userStates[telegramId] = { editing: 'bio' };
          bot.sendMessage(chatId, '💭 **Edit Bio**\n\nPlease enter your bio (max 500 characters):');
          break;

        case 'manage_photos':
          bot.sendMessage(chatId, '📸 **Upload Photos** 📸\n\nJust send me a photo and I\'ll add it to your profile!\n\n💡 **Tips:**\n• Use high-quality, clear photos\n• Show your face clearly\n• Maximum 6 photos allowed\n• Recent photos appear first\n\n📤 Ready to upload?');
          break;
      }
    } catch (err) {
      console.error('Profile callback error:', err);
      bot.sendMessage(chatId, '❌ Something went wrong. Please try again.');
    }
  });

  // Handle text messages for profile editing
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const text = msg.text;

    // Skip if it's a command or callback
    if (!text || text.startsWith('/') || !userStates[telegramId]) return;

    const userState = userStates[telegramId];
    
    if (userState.editing) {
      try {
        const field = userState.editing;
        let value = text.trim();
        
        // Validate input based on field
        if (field === 'age') {
          const age = parseInt(value);
          if (isNaN(age) || age < 18 || age > 99) {
            return bot.sendMessage(chatId, '❌ Please enter a valid age between 18 and 99.');
          }
          value = age;
        } else if (field === 'bio' && value.length > 500) {
          return bot.sendMessage(chatId, '❌ Bio must be 500 characters or less.');
        } else if (field === 'name' && (value.length < 1 || value.length > 50)) {
          return bot.sendMessage(chatId, '❌ Name must be between 1 and 50 characters.');
        }

        // Update profile
        await axios.post(`${API_BASE}/profile/update/${telegramId}`, {
          field,
          value
        });

        // Clear user state
        delete userStates[telegramId];
        
        // Invalidate cache
        invalidateUserCache(telegramId);
        
        // Send success message
        const fieldNames = {
          name: 'Name',
          age: 'Age', 
          location: 'Location',
          bio: 'Bio'
        };
        
        bot.sendMessage(chatId, `✅ **${fieldNames[field]} Updated!**\n\n` +
          `Your ${field} has been updated successfully.\n\n` +
          `Use /profile to view your complete profile.`, {
          reply_markup: {
            inline_keyboard: [[
              { text: '👤 View Profile', callback_data: 'edit_profile' },
              { text: '🔙 Back to Settings', callback_data: 'main_settings' }
            ]]
          }
        });
      } catch (err) {
        console.error('Profile update error:', err);
        delete userStates[telegramId];
        bot.sendMessage(chatId, '❌ Failed to update profile. Please try again.');
      }
    }
  });
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

  // PHOTOS command - Upload photos to profile
  bot.onText(/\/photos/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    try {
      const user = await getCachedUserProfile(telegramId);
      
      const photoMsg = `📸 **Photo Upload** 📸\n\n` +
        `You currently have **${user.photos?.length || 0} photos** on your profile.\n\n` +
        `✨ **Add a New Photo:**\n` +
        `Just send me a photo and I'll add it to your profile!\n\n` +
        `📋 **Tips:**\n` +
        `• Use high-quality, clear photos\n` +
        `• Show your face clearly\n` +
        `• Maximum 6 photos allowed\n` +
        `• Recent photos appear first\n\n` +
        `📤 Just send the photo as your next message!`;

      bot.sendMessage(chatId, photoMsg, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '👤 View Profile', callback_data: 'view_profile' }],
            [{ text: '🔙 Back', callback_data: 'main_menu' }]
          ]
        }
      });
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
      // Invalidate cache so /profile shows updated data
      invalidateUserCache(telegramId);
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
      // Invalidate cache so /profile shows updated data
      invalidateUserCache(telegramId);
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
      // Invalidate cache so /profile shows updated data
      invalidateUserCache(telegramId);
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
      // Invalidate cache so /profile shows updated data
      invalidateUserCache(telegramId);
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
