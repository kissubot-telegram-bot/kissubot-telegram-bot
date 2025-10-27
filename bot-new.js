const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
require('dotenv').config();

// Import command modules
const { setupAuthCommands } = require('./commands/auth');
const { setupProfileCommands } = require('./commands/profile');
const { setupBrowsingCommands } = require('./commands/browsing');
const { setupHelpCommands } = require('./commands/help');
const { setupSettingsCommands } = require('./commands/settings');
const { setupPremiumCommands } = require('./commands/premium');
const { setupSocialCommands } = require('./commands/social');

// Bot configuration
const token = process.env.BOT_TOKEN;
const API_BASE = process.env.API_BASE || 'http://localhost:3000';

if (!token) {
  console.error('❌ BOT_TOKEN is required in .env file');
  process.exit(1);
}

// Create bot instance with better error handling and timeout settings
const bot = new TelegramBot(token, { 
  polling: {
    interval: 1000,
    autoStart: true,
    params: {
      timeout: 10
    }
  },
  request: {
    agentOptions: {
      keepAlive: true,
      family: 4 // Force IPv4
    },
    timeout: 30000 // 30 second timeout
  }
});

// User state management for interactive flows
const userStates = {};

// Helper functions for optimized callback handling
function handleProfileEdit(chatId, telegramId, field) {
  userStates[telegramId] = { editing: field };
  
  const editMessages = {
    name: {
      title: '✏️ **Edit Name** ✏️',
      prompt: 'Please enter your new display name:',
      tips: ['Use your real first name', 'Keep it simple and memorable', 'Avoid special characters']
    },
    age: {
      title: '🎂 **Edit Age** 🎂',
      prompt: 'Please enter your age (18-100):',
      tips: ['Be honest about your age', 'Age helps with better matches', 'Must be between 18 and 100']
    },
    location: {
      title: '📍 **Edit Location** 📍',
      prompt: 'Please enter your city and country:',
      tips: ['Examples:', '• New York, USA', '• London, UK', '• Tokyo, Japan']
    },
    bio: {
      title: '💬 **Edit Bio** 💬',
      prompt: 'Tell others about yourself (max 500 characters):',
      tips: ['Share your interests and hobbies', 'Be authentic and positive', 'Mention what you\'re looking for', 'Keep it engaging and fun']
    }
  };
  
  const config = editMessages[field];
  if (config) {
    const message = `${config.title}\n\n${config.prompt}\n\n💡 **Tips:**\n${config.tips.map(tip => tip.startsWith('•') ? tip : `• ${tip}`).join('\n')}\n\n❌ Type /cancel to stop editing`;
    bot.sendMessage(chatId, message);
  }
}

function handleReportFlow(chatId, telegramId, reportType) {
  const type = reportType.replace('report_', '');
  userStates[telegramId] = { reporting: type === 'feature_request' ? 'feature' : type };
  
  const reportMessages = {
    report_user: {
      title: '👤 **Report User** 👤',
      prompt: 'Please describe the inappropriate behavior:',
      details: ['What the user did wrong', 'When it happened', 'Any relevant context']
    },
    report_content: {
      title: '📸 **Report Content** 📸',
      prompt: 'Please describe the inappropriate content:',
      details: ['What type of content (photo, message, etc.)', 'Why it\'s inappropriate', 'Where you saw it']
    },
    report_bug: {
      title: '🐛 **Report Bug** 🐛',
      prompt: 'Please describe the technical issue:',
      details: ['What you were trying to do', 'What went wrong', 'Any error messages you saw'],
      footer: '🔧 **This helps us fix issues faster**'
    },
    feature_request: {
      title: '💡 **Feature Request** 💡',
      prompt: 'Please describe your feature idea:',
      details: ['What feature you\'d like to see', 'How it would help you', 'Any specific details'],
      footer: '🚀 **Great ideas help improve Kisu1bot**'
    }
  };
  
  const config = reportMessages[reportType];
  if (config) {
    const message = `${config.title}\n\n${config.prompt}\n\n📋 **Include details about:**\n${config.details.map(detail => `• ${detail}`).join('\n')}\n\n${config.footer || '🔒 **Your report is confidential**'}\n❌ Type /cancel to stop${reportType === 'feature_request' ? '' : ' reporting'}`;
    bot.sendMessage(chatId, message);
  }
}

function showMainMenu(chatId) {
  const mainMenuMsg = `🏠 **MAIN MENU** 🏠\n\n` +
    `Welcome to Kisu1bot! Choose what you'd like to do:\n\n` +
    `👤 **Profile & Dating**\n` +
    `• View and edit your profile\n` +
    `• Browse and match with people\n` +
    `• See your matches\n\n` +
    `⚙️ **Settings & Support**\n` +
    `• Customize your preferences\n` +
    `• Get help and support\n` +
    `• Upgrade to VIP`;

  bot.sendMessage(chatId, mainMenuMsg, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '👤 My Profile', callback_data: 'view_profile' },
          { text: '🔍 Browse Profiles', callback_data: 'browse_profiles' }
        ],
        [
          { text: '💕 My Matches', callback_data: 'view_matches' },
          { text: '⚙️ Settings', callback_data: 'main_settings' }
        ],
        [
          { text: '💎 Get VIP', callback_data: 'manage_vip' },
          { text: '❓ Help', callback_data: 'show_help' }
        ]
      ]
    }
  });
}

function handleNavigation(chatId, action) {
  const navigationMessages = {
    show_help: '❓ For help, use the /help command to see all available options.',
    view_profile: '👤 Use the /profile command to view and edit your profile.',
    browse_profiles: '🔍 Use the /browse command to start browsing profiles.',
    view_matches: '💕 Use the /matches command to see your matches.',
    main_settings: '⚙️ Use the /settings command to access all settings.',
    manage_vip: '💎 Use the /vip command to manage your VIP membership.',
    contact_support: '📞 Use the /contact command to get support information.',
    report_menu: '🚨 Use the /report command to report issues or users.'
  };
  
  const message = navigationMessages[action];
  if (message) {
    bot.sendMessage(chatId, message);
  }
}

console.log('🤖 Kisu1bot is starting...');

// Get bot information
bot.getMe().then((botInfo) => {
  console.log('🤖 Bot Details:');
  console.log('Name:', botInfo.first_name);
  console.log('Username: @' + botInfo.username);
  console.log('ID:', botInfo.id);
  console.log('Description:', botInfo.description || 'No description set');
}).catch((error) => {
  console.error('❌ Failed to get bot info:', error.message);
});

// Setup all command modules
setupAuthCommands(bot);
setupProfileCommands(bot);
setupBrowsingCommands(bot);
setupHelpCommands(bot);
setupSettingsCommands(bot);
setupPremiumCommands(bot);
setupSocialCommands(bot);

// Global message handler for interactive flows (editing, reporting)
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;
  const text = msg.text;

  // Skip if it's a command
  if (text && text.startsWith('/')) return;

  // Handle user states
  if (userStates[telegramId]) {
    const state = userStates[telegramId];

    // Handle profile editing states
    if (state.editing) {
      if (text === '/cancel') {
        delete userStates[telegramId];
        return bot.sendMessage(chatId, '❌ **Editing Cancelled**\n\nYour profile remains unchanged.');
      }

      const field = state.editing;
      let value = text;

      // Validate input based on field
      if (field === 'age') {
        value = parseInt(text);
        if (isNaN(value) || value < 18 || value > 100) {
          return bot.sendMessage(chatId, '❌ **Invalid Age**\n\nPlease enter an age between 18 and 100, or use /cancel to stop editing.');
        }
      }

      if (field === 'bio' && text.length > 500) {
        return bot.sendMessage(chatId, '❌ **Bio Too Long**\n\nPlease keep your bio under 500 characters, or use /cancel to stop editing.');
      }

      try {
        await axios.post(`${API_BASE}/profile/update/${telegramId}`, { field, value });
        delete userStates[telegramId];
        
        bot.sendMessage(chatId, `✅ **${field.charAt(0).toUpperCase() + field.slice(1)} Updated!**\n\n` +
          `Your ${field} has been successfully updated to: **${value}**\n\n` +
          `💡 Use /profile to see your complete profile.`);
      } catch (err) {
        console.error(`Update ${field} error:`, err.response?.data || err.message);
        bot.sendMessage(chatId, `❌ **Update Failed**\n\nFailed to update your ${field}. Please try again later.`);
      }
      return;
    }

    // Handle reporting states
    if (state.reporting) {
      if (text === '/cancel') {
        delete userStates[telegramId];
        return bot.sendMessage(chatId, '❌ **Report Cancelled**\n\nNo report was submitted.');
      }

      if (text.length < 10) {
        return bot.sendMessage(chatId, '❌ **Report Too Short**\n\nPlease provide at least 10 characters describing the issue, or use /cancel to stop reporting.');
      }

      const reportType = state.reporting;
      const reportData = {
        type: reportType,
        description: text,
        reportedBy: telegramId,
        reportedAt: new Date().toISOString()
      };

      console.log(`📋 New ${reportType} report:`, reportData);
      delete userStates[telegramId];

      bot.sendMessage(chatId, `✅ **Report Submitted**\n\n` +
        `Thank you for reporting this ${reportType} issue. Our team will review it shortly.\n\n` +
        `📋 **Report ID:** ${Date.now()}\n` +
        `⏰ **Submitted:** ${new Date().toLocaleString()}\n\n` +
        `🔒 **All reports are confidential and help keep Kisu1bot safe for everyone.**`);
      return;
    }
  }
});

// Global callback query handler
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const telegramId = query.from.id;
  const data = query.data;

  // Removed debug logging for production

  // Answer callback query to remove loading state
  bot.answerCallbackQuery(query.id);

  try {
    switch (data) {
      // Profile editing callbacks
      case 'edit_name':
      case 'edit_age':
      case 'edit_location':
      case 'edit_bio':
        handleProfileEdit(chatId, telegramId, data.replace('edit_', ''));
        break;

      // Report callbacks
      case 'report_user':
      case 'report_content':
      case 'report_bug':
      case 'feature_request':
        handleReportFlow(chatId, telegramId, data);
        break;

      case 'cancel_report':
        delete userStates[telegramId];
        bot.sendMessage(chatId, '❌ **Report Cancelled**\n\nNo report was submitted.');
        break;

      // Delete profile callbacks (from memory - these were implemented)
      case 'cancel_delete':
        bot.sendMessage(chatId, '✅ **Profile Deletion Cancelled** ✅\n\n' +
          'Your profile is safe and remains active.\n\n' +
          '💡 **Need help instead?**\n' +
          '• Use /help for guidance\n' +
          '• Contact support with /contact\n' +
          '• Adjust settings with /settings\n\n' +
          'Thank you for staying with Kisu1bot! 💕');
        break;

      case 'deactivate_profile':
        try {
          await axios.post(`${API_BASE}/users/deactivate/${telegramId}`);
          
          bot.sendMessage(chatId, '⏸️ **Profile Deactivated** ⏸️\n\n' +
            'Your profile has been temporarily deactivated.\n\n' +
            '📋 **What this means:**\n' +
            '• Your profile is hidden from other users\n' +
            '• You won\'t receive new matches\n' +
            '• Your data is safely stored\n' +
            '• You can reactivate anytime\n\n' +
            '🔄 **To reactivate:** Use /start when you\'re ready to return', {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '🔄 Reactivate Now', callback_data: 'reactivate_profile' },
                  { text: '📞 Contact Support', callback_data: 'contact_support' }
                ]
              ]
            }
          });
        } catch (err) {
          console.error('Deactivate profile error:', err.response?.data || err.message);
          bot.sendMessage(chatId, '❌ Failed to deactivate your profile. Please try again later or contact support.');
        }
        break;

      case 'reactivate_profile':
        try {
          await axios.post(`${API_BASE}/users/reactivate/${telegramId}`);
          
          bot.sendMessage(chatId, '🎉 **Welcome Back!** 🎉\n\n' +
            'Your profile has been reactivated successfully!\n\n' +
            '✅ **You\'re back in action:**\n' +
            '• Your profile is visible again\n' +
            '• You can receive new matches\n' +
            '• All your data is restored\n\n' +
            '🚀 **Ready to continue?**\n' +
            '• Use /browse to find matches\n' +
            '• Update your profile with /profile\n' +
            '• Check your settings with /settings\n\n' +
            'Happy dating! 💕');
        } catch (err) {
          console.error('Reactivate profile error:', err.response?.data || err.message);
          bot.sendMessage(chatId, '❌ Failed to reactivate your profile. Please try again later or contact support.');
        }
        break;

      case 'confirm_delete_profile':
        const finalWarningMsg = '🚨 **FINAL WARNING** 🚨\n\n' +
          '⚠️ **THIS WILL PERMANENTLY DELETE YOUR PROFILE**\n\n' +
          '🗑️ **What will be deleted:**\n' +
          '• All your profile information\n' +
          '• All your photos\n' +
          '• All your matches and conversations\n' +
          '• Your VIP status and coins\n' +
          '• All your activity history\n\n' +
          '❌ **This action CANNOT be undone!**\n\n' +
          '💔 Are you absolutely sure you want to delete everything?';

        bot.sendMessage(chatId, finalWarningMsg, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🗑️ Yes, Delete Everything', callback_data: 'final_confirm_delete' }],
              [{ text: '❌ Cancel - Keep My Account', callback_data: 'cancel_delete' }]
            ]
          }
        });
        break;

      case 'final_confirm_delete':
        try {
          await axios.delete(`${API_BASE}/users/delete/${telegramId}`);
          
          bot.sendMessage(chatId, '💔 **Profile Deleted** 💔\n\n' +
            'Your profile has been permanently deleted from Kisu1bot.\n\n' +
            '🙏 **Thank you for using Kisu1bot**\n\n' +
            'If you ever want to return:\n' +
            '• Use /start to create a new profile\n' +
            '• Contact us if you need help\n\n' +
            'We\'re sorry to see you go. Take care! 💕');
        } catch (err) {
          console.error('Delete profile error:', err.response?.data || err.message);
          bot.sendMessage(chatId, '❌ Failed to delete your profile. Please contact support for assistance.');
        }
        break;

      // Email support callbacks
      case 'email_support':
        bot.sendMessage(chatId, '📧 **CONTACT SUPPORT** 📧\n\n' +
          'Get help from our support team:\n' +
          '📮 **support@kisu1bot.com**\n\n' +
          '📋 **When emailing, please include:**\n' +
          '• Your username: @' + (query.from.username || 'N/A') + '\n' +
          '• Detailed description of your issue\n' +
          '• Screenshots if applicable\n' +
          '• Steps you\'ve already tried\n\n' +
          '⏰ **Response time:** Usually within 24 hours\n\n' +
          '🙏 **Thank you for using Kisu1bot!**');
        break;

      case 'email_feedback':
        bot.sendMessage(chatId, '📧 **SEND FEEDBACK** 📧\n\n' +
          'Share your thoughts with us:\n' +
          '📮 **feedback@kisu1bot.com**\n\n' +
          '📋 **We\'d love to hear about:**\n' +
          '• Feature suggestions\n' +
          '• User experience improvements\n' +
          '• What you like about the app\n' +
          '• What could be better\n\n' +
          '📝 **Include your username:** @' + (query.from.username || 'N/A') + '\n\n' +
          '🙏 **Thank you for helping us improve Kisu1bot!**');
        break;

      // Main menu and navigation callbacks
      case 'main_menu':
        showMainMenu(chatId);
        break;

      // Navigation shortcuts
      case 'show_help':
      case 'view_profile':
      case 'browse_profiles':
      case 'view_matches':
      case 'main_settings':
      case 'manage_vip':
      case 'contact_support':
      case 'report_menu':
        handleNavigation(chatId, data);
        break;

      case 'user_guide':
        bot.sendMessage(chatId, '📚 **USER GUIDE** 📚\n\n' +
          'Here are the main commands to get started:\n\n' +
          '🚀 **Getting Started:**\n' +
          '• /register - Create your profile\n' +
          '• /profile - Edit your information\n' +
          '• /browse - Find matches\n\n' +
          '💕 **Dating Features:**\n' +
          '• /matches - See your matches\n' +
          '• /likesyou - See who likes you (VIP)\n\n' +
          '⚙️ **Settings:**\n' +
          '• /settings - Customize preferences\n' +
          '• /help - Get help and support');
        break;

      case 'manage_photos':
        bot.sendMessage(chatId, '📸 **MANAGE PHOTOS** 📸\n\n' +
          'Photo management features:\n\n' +
          '📤 **Upload Photos:**\n' +
          '• Send photos directly to the bot\n' +
          '• Use /photo command for guided upload\n\n' +
          '🗂️ **Photo Tips:**\n' +
          '• Use high-quality, clear photos\n' +
          '• Show your face clearly\n' +
          '• Add variety (close-up, full body, activities)\n' +
          '• Keep photos recent and authentic\n\n' +
          '💡 **Pro Tip:** Profiles with photos get 10x more matches!');
        break;

      // Settings menu callbacks
      case 'settings_profile':
        bot.sendMessage(chatId, '👤 **PROFILE SETTINGS** 👤\n\n' +
          'Manage your profile information:\n\n' +
          '📝 **Edit Profile:**\n' +
          '• /setname - Change your name\n' +
          '• /setage - Update your age\n' +
          '• /setlocation - Set your location\n' +
          '• /setbio - Write your bio\n\n' +
          '📸 **Photos:**\n' +
          '• Send photos directly to update\n' +
          '• /photo - Guided photo upload\n\n' +
          '👁️ **View Profile:**\n' +
          '• /profile - See your complete profile');
        break;

      case 'settings_search':
        bot.sendMessage(chatId, '🔍 **SEARCH SETTINGS** 🔍\n\n' +
          'Customize your search preferences:\n\n' +
          '🎯 **Age Range:**\n' +
          '• Set minimum and maximum age\n\n' +
          '📍 **Distance:**\n' +
          '• Set maximum search radius\n\n' +
          '👥 **Gender Preference:**\n' +
          '• Choose who you want to see\n\n' +
          '🌍 **Location:**\n' +
          '• Set preferred search areas\n\n' +
          '💡 Use /searchsettings to modify these preferences');
        break;

      case 'settings_notifications':
        bot.sendMessage(chatId, '🔔 **NOTIFICATION SETTINGS** 🔔\n\n' +
          'Control your notification preferences:\n\n' +
          '💕 **Match Notifications:**\n' +
          '• Get notified of new matches\n\n' +
          '💌 **Message Notifications:**\n' +
          '• Receive message alerts\n\n' +
          '👀 **Profile View Notifications:**\n' +
          '• Know when someone views you\n\n' +
          '🎁 **Gift Notifications:**\n' +
          '• Get alerted about received gifts\n\n' +
          '⚙️ Notification settings are managed through your Telegram app settings.');
        break;

      case 'settings_privacy':
        bot.sendMessage(chatId, '🔒 **PRIVACY SETTINGS** 🔒\n\n' +
          'Control your privacy and visibility:\n\n' +
          '👁️ **Profile Visibility:**\n' +
          '• Control who can see your profile\n\n' +
          '📍 **Location Privacy:**\n' +
          '• Manage location sharing\n\n' +
          '🚫 **Blocking:**\n' +
          '• Block unwanted users\n\n' +
          '📊 **Data Control:**\n' +
          '• Manage your personal data\n\n' +
          '🔐 **Account Security:**\n' +
          '• Your account is secured by Telegram\'s encryption');
        break;

      case 'settings_help':
        bot.sendMessage(chatId, '❓ **HELP & SUPPORT** ❓\n\n' +
          'Get help and support:\n\n' +
          '📚 **User Guide:**\n' +
          '• /help - Complete command list\n' +
          '• /guide - Step-by-step tutorial\n\n' +
          '🆘 **Support:**\n' +
          '• /contact - Contact support team\n' +
          '• /report - Report issues or users\n\n' +
          '💡 **Tips:**\n' +
          '• /tips - Dating and profile tips\n\n' +
          '🔄 **Updates:**\n' +
          '• Stay updated with new features\n\n' +
          '📞 **Emergency:** Contact @support for urgent issues');
        break;

      default:
        // Handle like, pass, superlike callbacks with dynamic IDs
        if (data.startsWith('like_')) {
          const targetUserId = data.replace('like_', '');
          try {
            await axios.post(`${API_BASE}/like`, {
              fromUserId: telegramId,
              toUserId: targetUserId
            });
            
            bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
              chat_id: chatId,
              message_id: query.message.message_id
            });
            
            bot.sendMessage(chatId, '💚 **LIKED!** 💚\n\nYour like has been sent! If they like you back, it\'s a match! 💕\n\nUse /browse to see more profiles.');
          } catch (err) {
            console.error('Like error:', err.response?.data || err.message);
            bot.sendMessage(chatId, '❌ Failed to send like. Please try again.');
          }
        } else if (data.startsWith('pass_')) {
          const targetUserId = data.replace('pass_', '');
          try {
            await axios.post(`${API_BASE}/pass`, {
              fromUserId: telegramId,
              toUserId: targetUserId
            });
            
            bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
              chat_id: chatId,
              message_id: query.message.message_id
            });
            
            bot.sendMessage(chatId, '💔 **PASSED** 💔\n\nNo worries, there are plenty more profiles to explore!\n\nUse /browse to continue browsing.');
          } catch (err) {
            console.error('Pass error:', err.response?.data || err.message);
            bot.sendMessage(chatId, '❌ Failed to pass. Please try again.');
          }
        } else if (data.startsWith('superlike_')) {
          const targetUserId = data.replace('superlike_', '');
          try {
            await axios.post(`${API_BASE}/superlike`, {
              fromUserId: telegramId,
              toUserId: targetUserId
            });
            
            bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
              chat_id: chatId,
              message_id: query.message.message_id
            });
            
            bot.sendMessage(chatId, '⭐ **SUPER LIKED!** ⭐\n\nYour super like has been sent! This shows extra interest and increases your chances of matching! 💫\n\nUse /browse to see more profiles.');
          } catch (err) {
            console.error('Super like error:', err.response?.data || err.message);
            bot.sendMessage(chatId, '❌ Failed to send super like. Please try again.');
          }
        } else {
          console.log('Unhandled callback data:', data);
          bot.sendMessage(chatId, '❓ This feature is not yet implemented. Please use the corresponding command instead.');
        }
        break;
    }
  } catch (err) {
    console.error('Callback query error:', err.response?.data || err.message);
    bot.sendMessage(chatId, '❌ Something went wrong. Please try again later.');
  }
});

// Error handling
bot.on('polling_error', (error) => {
  console.error('❌ Polling error:', error.message);
  
  // If it's a network error, try to restart polling after a delay
  if (error.code === 'ENOTFOUND' || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
    console.log('🔄 Network error detected, attempting to restart polling in 10 seconds...');
    setTimeout(() => {
      try {
        bot.stopPolling();
        setTimeout(() => {
          bot.startPolling();
          console.log('✅ Polling restarted successfully');
        }, 5000);
      } catch (restartError) {
        console.error('❌ Failed to restart polling:', restartError.message);
      }
    }, 10000);
  }
});

bot.on('error', (error) => {
  console.error('❌ Bot error:', error.message);
});

// Add connection status monitoring
bot.on('webhook_error', (error) => {
  console.error('❌ Webhook error:', error.message);
});

// Handle photo uploads
bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;
  
  try {
    // Get the highest resolution photo
    const photo = msg.photo[msg.photo.length - 1];
    const fileId = photo.file_id;
    
    // Get file info from Telegram
    const file = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`;
    
    // Send loading message
    const loadingMsg = await bot.sendMessage(chatId, '📤 Uploading your photo...');
    
    // Download and upload to server
    const axios = require('axios');
    const FormData = require('form-data');
    const fs = require('fs');
    const path = require('path');
    
    // Download the image
    const response = await axios.get(fileUrl, { responseType: 'stream' });
    const tempPath = path.join(__dirname, `temp_${telegramId}_${Date.now()}.jpg`);
    const writer = fs.createWriteStream(tempPath);
    
    response.data.pipe(writer);
    
    writer.on('finish', async () => {
      try {
        // Create form data for upload
        const form = new FormData();
        form.append('image', fs.createReadStream(tempPath));
        
        // Upload to server
        const uploadResponse = await axios.post(`${API_BASE}/upload-photo/${telegramId}`, form, {
          headers: {
            ...form.getHeaders()
          }
        });
        
        // Clean up temp file
        fs.unlinkSync(tempPath);
        
        // Update loading message with success
        bot.editMessageText('✅ **Photo Uploaded Successfully!**\n\n📸 Your profile photo has been updated and is now visible to other users.\n\n🌟 **Profile Boost:** Profiles with photos get 10x more matches!\n\n💡 Tip: Use /profile to see your complete profile', {
          chat_id: chatId,
          message_id: loadingMsg.message_id
        });
        
      } catch (uploadErr) {
        console.error('Photo upload error:', uploadErr);
        
        // Clean up temp file
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
        
        bot.editMessageText('❌ Failed to upload photo. Please try again.', {
          chat_id: chatId,
          message_id: loadingMsg.message_id
        });
      }
    });
    
    writer.on('error', (err) => {
      console.error('File write error:', err);
      bot.editMessageText('❌ Failed to process photo. Please try again.', {
        chat_id: chatId,
        message_id: loadingMsg.message_id
      });
    });
    
  } catch (err) {
    console.error('Photo handler error:', err);
    bot.sendMessage(chatId, '❌ Failed to process your photo. Please try again.');
  }
});

console.log('✅ Kisu1bot is running successfully!');
console.log('🔗 API Base:', API_BASE);
console.log('📱 Bot ready to receive messages...');

module.exports = bot;
