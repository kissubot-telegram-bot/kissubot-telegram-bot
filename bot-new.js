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
const API_BASE = process.env.API_BASE || 'http://localhost:3000/api';

if (!token) {
  console.error('❌ BOT_TOKEN is required in .env file');
  process.exit(1);
}

// Create bot instance
const bot = new TelegramBot(token, { polling: true });

// User state management for interactive flows
const userStates = {};

console.log('🤖 Kisu1bot is starting...');

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

  // Answer callback query to remove loading state
  bot.answerCallbackQuery(query.id);

  try {
    switch (data) {
      // Profile editing callbacks
      case 'edit_name':
        userStates[telegramId] = { editing: 'name' };
        bot.sendMessage(chatId, '✏️ **Edit Name** ✏️\n\n' +
          'Please enter your new display name:\n\n' +
          '💡 **Tips:**\n' +
          '• Use your real first name\n' +
          '• Keep it simple and memorable\n' +
          '• Avoid special characters\n\n' +
          '❌ Type /cancel to stop editing');
        break;

      case 'edit_age':
        userStates[telegramId] = { editing: 'age' };
        bot.sendMessage(chatId, '🎂 **Edit Age** 🎂\n\n' +
          'Please enter your age (18-100):\n\n' +
          '💡 **Tips:**\n' +
          '• Be honest about your age\n' +
          '• Age helps with better matches\n' +
          '• Must be between 18 and 100\n\n' +
          '❌ Type /cancel to stop editing');
        break;

      case 'edit_location':
        userStates[telegramId] = { editing: 'location' };
        bot.sendMessage(chatId, '📍 **Edit Location** 📍\n\n' +
          'Please enter your city and country:\n\n' +
          '💡 **Examples:**\n' +
          '• New York, USA\n' +
          '• London, UK\n' +
          '• Tokyo, Japan\n\n' +
          '❌ Type /cancel to stop editing');
        break;

      case 'edit_bio':
        userStates[telegramId] = { editing: 'bio' };
        bot.sendMessage(chatId, '💬 **Edit Bio** 💬\n\n' +
          'Tell others about yourself (max 500 characters):\n\n' +
          '💡 **Tips:**\n' +
          '• Share your interests and hobbies\n' +
          '• Be authentic and positive\n' +
          '• Mention what you\'re looking for\n' +
          '• Keep it engaging and fun\n\n' +
          '❌ Type /cancel to stop editing');
        break;

      // Report callbacks
      case 'report_user':
        userStates[telegramId] = { reporting: 'user' };
        bot.sendMessage(chatId, '👤 **Report User** 👤\n\n' +
          'Please describe the inappropriate behavior:\n\n' +
          '📋 **Include details about:**\n' +
          '• What the user did wrong\n' +
          '• When it happened\n' +
          '• Any relevant context\n\n' +
          '🔒 **Your report is confidential**\n' +
          '❌ Type /cancel to stop reporting');
        break;

      case 'report_content':
        userStates[telegramId] = { reporting: 'content' };
        bot.sendMessage(chatId, '📸 **Report Content** 📸\n\n' +
          'Please describe the inappropriate content:\n\n' +
          '📋 **Include details about:**\n' +
          '• What type of content (photo, message, etc.)\n' +
          '• Why it\'s inappropriate\n' +
          '• Where you saw it\n\n' +
          '🔒 **Your report is confidential**\n' +
          '❌ Type /cancel to stop reporting');
        break;

      case 'report_bug':
        userStates[telegramId] = { reporting: 'bug' };
        bot.sendMessage(chatId, '🐛 **Report Bug** 🐛\n\n' +
          'Please describe the technical issue:\n\n' +
          '📋 **Include details about:**\n' +
          '• What you were trying to do\n' +
          '• What went wrong\n' +
          '• Any error messages you saw\n\n' +
          '🔧 **This helps us fix issues faster**\n' +
          '❌ Type /cancel to stop reporting');
        break;

      case 'feature_request':
        userStates[telegramId] = { reporting: 'feature' };
        bot.sendMessage(chatId, '💡 **Feature Request** 💡\n\n' +
          'Please describe your feature idea:\n\n' +
          '📋 **Tell us about:**\n' +
          '• What feature you\'d like to see\n' +
          '• How it would help you\n' +
          '• Any specific details\n\n' +
          '🚀 **Great ideas help improve Kisu1bot**\n' +
          '❌ Type /cancel to stop');
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

      default:
        console.log('Unhandled callback data:', data);
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
});

bot.on('error', (error) => {
  console.error('❌ Bot error:', error.message);
});

console.log('✅ Kisu1bot is running successfully!');
console.log('🔗 API Base:', API_BASE);
console.log('📱 Bot ready to receive messages...');

module.exports = bot;
