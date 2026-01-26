const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
require('dotenv').config();

// Import command modules
const { setupAuthCommands, invalidateUserCache, handleRegister } = require('./commands/auth');
const { setupProfileCommands } = require('./commands/profile');
const { setupBrowsingCommands } = require('./commands/browsing');
const { setupHelpCommands } = require('./commands/help');
const { setupSettingsCommands } = require('./commands/settings');
const { setupPremiumCommands } = require('./commands/premium');
const { setupGiftCommands } = require('./commands/gifts');
const { setupSocialDebugCommands } = require('./commands/social-debug');
const { setupSocialCommands } = require('./commands/social');
const { setupSearchCommands } = require('./commands/search');
const { setupLikesCommands } = require('./commands/likes');
const { setupMatchesCommands } = require('./commands/matches');


// Bot configuration
const token = process.env.BOT_TOKEN;
const { API_BASE } = require('./config');

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

// Initialize command modules
// setupAuthCommands(bot, userStates);
// setupProfileCommands(bot, userStates);
// browsingCommands.setupBrowsingCommands(bot, getCachedUserProfile);

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
      prompt: 'Please ent er your city and country:',
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
setupGiftCommands(bot);
setupSocialDebugCommands(bot);
setupSocialCommands(bot);
setupSearchCommands(bot);
setupLikesCommands(bot);
setupMatchesCommands(bot);

// Additional commands not in modules

// Helper function for time ago
function getTimeAgo(date) {
  const now = new Date();
  const diffMs = now - new Date(date);
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}

// Redundant commands are removed as they are now handled in their respective modules.
// /coins -> commands/premium.js
// /gifts -> commands/social.js
// /priority -> commands/premium.js
// /search -> commands/settings.js
// /setname -> commands/profile.js


// Media handlers for photos and videos
bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;
  const userState = userStates.get(telegramId);

  if (!userState) return;

  if (userState.action === 'uploading_photo') {
    try {
      // Get the highest resolution photo
      const photo = msg.photo[msg.photo.length - 1];
      const fileId = photo.file_id;

      // Upload photo to profile
      const uploadRes = await axios.post(`${API_BASE}/profile/${telegramId}/photo`, {
        fileId: fileId,
        caption: msg.caption || ''
      });

      userStates.delete(telegramId);

      const successMsg = `✅ **Photo Uploaded Successfully!** ✅\n\n` +
        `Your new photo has been added to your profile.\n\n` +
        `📸 **Want to add more photos?**`;

      const opts = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📸 Add Another Photo', callback_data: 'add_another_photo' },
              { text: '👤 View Profile', callback_data: 'view_profile' }
            ],
            [
              { text: '🔍 Start Browsing', callback_data: 'browse_profiles' },
              { text: '🔙 Back', callback_data: 'main_menu' }
            ]
          ]
        }
      };

      bot.sendMessage(chatId, successMsg, opts);
    } catch (err) {
      console.error('Photo upload error:', err.response?.data || err.message);
      userStates.delete(telegramId);
      bot.sendMessage(chatId, '❌ Failed to upload photo. Please try again later.');
    }
  } else if (userState.action === 'uploading_story') {
    try {
      // Get the highest resolution photo
      const photo = msg.photo[msg.photo.length - 1];
      const fileId = photo.file_id;

      // Upload story photo
      const storyRes = await axios.post(`${API_BASE}/stories/${telegramId}`, {
        type: 'photo',
        fileId: fileId,
        caption: msg.caption || ''
      });

      userStates.delete(telegramId);

      const successMsg = `✅ **Story Posted!** ✅\n\n` +
        `Your story has been shared with your matches!\n\n` +
        `👀 **Your story will be visible for 24 hours.**`;

      const opts = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📸 Add Another Story', callback_data: 'add_story' },
              { text: '👀 View My Stories', callback_data: 'view_my_stories' }
            ],
            [
              { text: '🔙 Back to Menu', callback_data: 'main_menu' }
            ]
          ]
        }
      };

      bot.sendMessage(chatId, successMsg, opts);
    } catch (err) {
      console.error('Story upload error:', err.response?.data || err.message);
      userStates.delete(telegramId);
      bot.sendMessage(chatId, '❌ Failed to post story. Please try again later.');
    }
  }
});

// Video handler for stories
bot.on('video', async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;
  const userState = userStates.get(telegramId);

  if (!userState || userState.action !== 'uploading_story') return;

  try {
    const video = msg.video;
    const fileId = video.file_id;

    // Check video duration (max 30 seconds for stories)
    if (video.duration > 30) {
      return bot.sendMessage(chatId, '❌ Video too long! Stories can be maximum 30 seconds.');
    }

    // Upload story video
    const storyRes = await axios.post(`${API_BASE}/stories/${telegramId}`, {
      type: 'video',
      fileId: fileId,
      duration: video.duration,
      caption: msg.caption || ''
    });

    userStates.delete(telegramId);

    const successMsg = `✅ **Video Story Posted!** ✅\n\n` +
      `Your video story has been shared with your matches!\n\n` +
      `👀 **Your story will be visible for 24 hours.**`;

    const opts = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📹 Add Another Story', callback_data: 'add_story' },
            { text: '👀 View My Stories', callback_data: 'view_my_stories' }
          ],
          [
            { text: '🔙 Back to Menu', callback_data: 'main_menu' }
          ]
        ]
      }
    };

    bot.sendMessage(chatId, successMsg, opts);
  } catch (err) {
    console.error('Video story upload error:', err.response?.data || err.message);
    userStates.delete(telegramId);
    bot.sendMessage(chatId, '❌ Failed to post video story. Please try again later.');
  }
});

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

  // Skip answering VIP callbacks immediately - let premium.js handle them
  const vipCallbacks = [
    'extend_vip', 'gift_vip', 'manage_vip', 'cancel_vip',
    'buy_vip_1', 'buy_vip_3', 'buy_vip_6',
    'gift_vip_1', 'gift_vip_3', 'gift_vip_6',
    'vip_purchase_monthly', 'vip_purchase_yearly', 'vip_purchase_lifetime'
  ];
  
  if (!vipCallbacks.includes(data)) {
    // Answer callback query to remove loading state for non-VIP callbacks
    bot.answerCallbackQuery(query.id);
  }

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
        // VIP and Premium callbacks are handled in commands/premium.js
        // VIP handlers are now in commands/premium.js
        // Search Settings callbacks are handled in commands/settings.js
        // Gift handlers are now in commands/gifts.js
        if (data === 'view_matches') {
          // Redirect to matches command
          bot.sendMessage(chatId, '💕 Loading your matches...');
          setTimeout(() => {
            bot.sendMessage(chatId, '/matches');
          }, 500);
        } else if (data === 'browse_profiles') {
          // Redirect to browse command
          bot.sendMessage(chatId, '🔍 Starting profile browsing...');
          setTimeout(() => {
            bot.sendMessage(chatId, '/browse');
          }, 500);
        } else if (data === 'edit_profile') {
          // Redirect to profile command
          bot.sendMessage(chatId, '👤 Opening profile editor...');
          setTimeout(() => {
            bot.sendMessage(chatId, '/profile');
          }, 500);
        } else if (data === 'main_settings') {
          // Redirect to settings command
          bot.sendMessage(chatId, '⚙️ Opening settings...');
          setTimeout(() => {
            bot.sendMessage(chatId, '/settings');
          }, 500);
        } else if (data === 'main_menu') {
          // Redirect to start command
          bot.sendMessage(chatId, '🏠 Returning to main menu...');
          setTimeout(() => {
            bot.sendMessage(chatId, '/start');
          }, 500);
        } else if (data === 'priority_boost') {
          // Redirect to priority command
          bot.sendMessage(chatId, '🚀 Opening priority boost...');
          setTimeout(() => {
            bot.sendMessage(chatId, '/priority');
          }, 500);
        } else if (data === 'back_to_search') {
          // Redirect to search command
          bot.sendMessage(chatId, '🔍 Returning to search settings...');
          setTimeout(() => {
            bot.sendMessage(chatId, '/search');
          }, 500);
        } else if (data === 'live_chat_support' || data === 'email_support' || data === 'faq_support' || data === 'report_issue') {
          // Support options
          bot.sendMessage(chatId, '📞 **SUPPORT CONTACT** 📞\n\n' +
            'Thank you for reaching out! Here are your support options:\n\n' +
            '📧 **Email:** support@kisu1bot.com\n' +
            '💬 **Live Chat:** Available 9 AM - 6 PM EST\n' +
            '📱 **Response Time:** Usually within 24 hours\n\n' +
            '🔒 **All communications are confidential and secure.**');
        // Search callback handlers
        } else if (data === 'search_age_range') {
          bot.sendMessage(chatId, '🎂 **SET AGE RANGE** 🎂\n\nChoose your preferred age range for matches:', {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '18-25', callback_data: 'age_range_18_25' },
                  { text: '26-35', callback_data: 'age_range_26_35' }
                ],
                [
                  { text: '36-45', callback_data: 'age_range_36_45' },
                  { text: '46-55', callback_data: 'age_range_46_55' }
                ],
                [
                  { text: '18-35', callback_data: 'age_range_18_35' },
                  { text: '25-45', callback_data: 'age_range_25_45' }
                ],
                [
                  { text: '🔙 Back to Search', callback_data: 'back_to_search' }
                ]
              ]
            }
          });
        } else if (data === 'search_distance') {
          bot.sendMessage(chatId, '📍 **SET DISTANCE** 📍\n\nChoose maximum distance for matches:', {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '10 km', callback_data: 'distance_10' },
                  { text: '25 km', callback_data: 'distance_25' }
                ],
                [
                  { text: '50 km', callback_data: 'distance_50' },
                  { text: '100 km', callback_data: 'distance_100' }
                ],
                [
                  { text: '250 km', callback_data: 'distance_250' },
                  { text: 'Unlimited', callback_data: 'distance_unlimited' }
                ],
                [
                  { text: '🔙 Back to Search', callback_data: 'back_to_search' }
                ]
              ]
            }
          });
        } else if (data === 'search_gender') {
          bot.sendMessage(chatId, '👥 **SET GENDER PREFERENCE** 👥\n\nWho would you like to see?', {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '👨 Men', callback_data: 'gender_male' },
                  { text: '👩 Women', callback_data: 'gender_female' }
                ],
                [
                  { text: '👥 Everyone', callback_data: 'gender_any' }
                ],
                [
                  { text: '🔙 Back to Search', callback_data: 'back_to_search' }
                ]
              ]
            }
          });
        } else if (data === 'search_location') {
          bot.sendMessage(chatId, '🌍 **SET LOCATION FILTER** 🌍\n\nChoose location preferences:', {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '📍 Current Location', callback_data: 'location_current' },
                  { text: '🏙️ Specific City', callback_data: 'location_city' }
                ],
                [
                  { text: '🌎 Any Location', callback_data: 'location_any' }
                ],
                [
                  { text: '🔙 Back to Search', callback_data: 'back_to_search' }
                ]
              ]
            }
          });
        } else if (data === 'search_vip_filters') {
          try {
            const userRes = await axios.get(`${API_BASE}/profile/${telegramId}`);
            const user = userRes.data;
            
            if (!user.isVip) {
              bot.sendMessage(chatId, '👑 **VIP FILTERS** 👑\n\n' +
                '🔒 **VIP Exclusive Features:**\n' +
                '• Filter by interests & hobbies\n' +
                '• Education level filter\n' +
                '• Height preferences\n' +
                '• Profession filter\n' +
                '• Lifestyle preferences\n\n' +
                '✨ **Upgrade to VIP to unlock advanced filters!**', {
                reply_markup: {
                  inline_keyboard: [
                    [
                      { text: '👑 Get VIP', callback_data: 'manage_vip' }
                    ],
                    [
                      { text: '🔙 Back to Search', callback_data: 'back_to_search' }
                    ]
                  ]
                }
              });
            } else {
              bot.sendMessage(chatId, '👑 **VIP FILTERS** 👑\n\n' +
                'Choose advanced filters:', {
                reply_markup: {
                  inline_keyboard: [
                    [
                      { text: '🎯 Interests', callback_data: 'filter_interests' },
                      { text: '🎓 Education', callback_data: 'filter_education' }
                    ],
                    [
                      { text: '📏 Height', callback_data: 'filter_height' },
                      { text: '💼 Profession', callback_data: 'filter_profession' }
                    ],
                    [
                      { text: '🏃 Lifestyle', callback_data: 'filter_lifestyle' }
                    ],
                    [
                      { text: '🔙 Back to Search', callback_data: 'back_to_search' }
                    ]
                  ]
                }
              });
            }
          } catch (err) {
            console.error('VIP filters error:', err);
            bot.sendMessage(chatId, '❌ Failed to load VIP filters. Please try again.');
          }
        } else if (data === 'start_advanced_search') {
          try {
            const userRes = await axios.get(`${API_BASE}/profile/${telegramId}`);
            const user = userRes.data;
            const preferences = user.searchPreferences || {};
            
            // Start advanced search with current preferences
            const searchRes = await axios.post(`${API_BASE}/search/advanced/${telegramId}`, {
              ageRange: preferences.ageRange || '18-35',
              maxDistance: preferences.maxDistance || 50,
              gender: preferences.gender || 'any',
              location: preferences.location || 'any'
            });
            
            const profiles = searchRes.data.profiles;
            
            if (profiles.length === 0) {
              bot.sendMessage(chatId, '🔍 **SEARCH RESULTS** 🔍\n\n' +
                'No profiles found matching your criteria.\n\n' +
                '💡 **Try adjusting your filters:**\n' +
                '• Increase distance range\n' +
                '• Expand age range\n' +
                '• Change gender preference\n\n' +
                'Or browse all profiles with /browse', {
                reply_markup: {
                  inline_keyboard: [
                    [
                      { text: '⚙️ Adjust Filters', callback_data: 'back_to_search' },
                      { text: '🔍 Browse All', callback_data: 'browse_profiles' }
                    ],
                    [
                      { text: '🔙 Back', callback_data: 'main_menu' }
                    ]
                  ]
                }
              });
            } else {
              bot.sendMessage(chatId, `🔍 **SEARCH RESULTS** 🔍\n\n` +
                `Found ${profiles.length} profiles matching your criteria!\n\n` +
                `🎯 **Your Search Filters:**\n` +
                `• Age: ${preferences.ageRange || '18-35'}\n` +
                `• Distance: ${preferences.maxDistance || 50} km\n` +
                `• Gender: ${preferences.gender || 'Any'}\n\n` +
                `Ready to start browsing?`, {
                reply_markup: {
                  inline_keyboard: [
                    [
                      { text: '👀 Start Browsing', callback_data: 'browse_profiles' }
                    ],
                    [
                      { text: '⚙️ Adjust Filters', callback_data: 'back_to_search' },
                      { text: '🔙 Back', callback_data: 'main_menu' }
                    ]
                  ]
                }
              });
            }
          } catch (err) {
             console.error('Advanced search error:', err);
             bot.sendMessage(chatId, '❌ Failed to perform search. Please try again later.');
           }
        // Location filter handlers
        } else if (data === 'location_current') {
          try {
            await axios.post(`${API_BASE}/preferences/${telegramId}`, {
              location: 'current'
            });
            bot.sendMessage(chatId, '✅ **Location updated to current location!**\n\nYour search will now prioritize people near you.');
          } catch (err) {
            console.error('Location update error:', err);
            bot.sendMessage(chatId, '❌ Failed to update location preference. Please try again.');
          }
        } else if (data === 'location_city') {
          bot.sendMessage(chatId, '🏙️ **SPECIFIC CITY** 🏙️\n\n' +
            'Please send me the name of the city you want to search in.\n\n' +
            '📍 **Example:** "New York" or "London"\n\n' +
            'I\'ll update your location preference once you send the city name.');
        } else if (data === 'location_any') {
          try {
            await axios.post(`${API_BASE}/preferences/${telegramId}`, {
              location: 'any'
            });
            bot.sendMessage(chatId, '✅ **Location updated to any location!**\n\nYour search will now include people from anywhere.');
          } catch (err) {
            console.error('Location update error:', err);
            bot.sendMessage(chatId, '❌ Failed to update location preference. Please try again.');
          }
        // VIP filter handlers
        } else if (data === 'filter_interests') {
          bot.sendMessage(chatId, '🎯 **INTEREST FILTERS** 🎯\n\n' +
            'Choose interests to filter by:', {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '🎵 Music', callback_data: 'interest_music' },
                  { text: '🏃 Sports', callback_data: 'interest_sports' }
                ],
                [
                  { text: '📚 Reading', callback_data: 'interest_reading' },
                  { text: '🎬 Movies', callback_data: 'interest_movies' }
                ],
                [
                  { text: '✈️ Travel', callback_data: 'interest_travel' },
                  { text: '🍳 Cooking', callback_data: 'interest_cooking' }
                ],
                [
                  { text: '🎨 Art', callback_data: 'interest_art' },
                  { text: '🎮 Gaming', callback_data: 'interest_gaming' }
                ],
                [
                  { text: '🔙 Back to VIP Filters', callback_data: 'search_vip_filters' }
                ]
              ]
            }
          });
        } else if (data === 'filter_education') {
          bot.sendMessage(chatId, '🎓 **EDUCATION FILTERS** 🎓\n\n' +
            'Filter by education level:', {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '🏫 High School', callback_data: 'edu_highschool' },
                  { text: '🎓 Bachelor\'s', callback_data: 'edu_bachelors' }
                ],
                [
                  { text: '📚 Master\'s', callback_data: 'edu_masters' },
                  { text: '🔬 PhD', callback_data: 'edu_phd' }
                ],
                [
                  { text: '💼 Professional', callback_data: 'edu_professional' },
                  { text: '🎯 Any Level', callback_data: 'edu_any' }
                ],
                [
                  { text: '🔙 Back to VIP Filters', callback_data: 'search_vip_filters' }
                ]
              ]
            }
          });
        } else if (data === 'filter_height') {
          bot.sendMessage(chatId, '📏 **HEIGHT FILTERS** 📏\n\n' +
            'Filter by height preference:', {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '< 160cm', callback_data: 'height_under160' },
                  { text: '160-170cm', callback_data: 'height_160_170' }
                ],
                [
                  { text: '170-180cm', callback_data: 'height_170_180' },
                  { text: '180-190cm', callback_data: 'height_180_190' }
                ],
                [
                  { text: '> 190cm', callback_data: 'height_over190' },
                  { text: '🎯 Any Height', callback_data: 'height_any' }
                ],
                [
                  { text: '🔙 Back to VIP Filters', callback_data: 'search_vip_filters' }
                ]
              ]
            }
          });
        } else if (data === 'filter_profession') {
          bot.sendMessage(chatId, '💼 **PROFESSION FILTERS** 💼\n\n' +
            'Filter by profession:', {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '💻 Tech', callback_data: 'prof_tech' },
                  { text: '⚕️ Healthcare', callback_data: 'prof_healthcare' }
                ],
                [
                  { text: '📚 Education', callback_data: 'prof_education' },
                  { text: '💰 Finance', callback_data: 'prof_finance' }
                ],
                [
                  { text: '🎨 Creative', callback_data: 'prof_creative' },
                  { text: '🏢 Business', callback_data: 'prof_business' }
                ],
                [
                  { text: '🔧 Engineering', callback_data: 'prof_engineering' },
                  { text: '🎯 Any Profession', callback_data: 'prof_any' }
                ],
                [
                  { text: '🔙 Back to VIP Filters', callback_data: 'search_vip_filters' }
                ]
              ]
            }
          });
        } else if (data === 'filter_lifestyle') {
          bot.sendMessage(chatId, '🏃 **LIFESTYLE FILTERS** 🏃\n\n' +
            'Filter by lifestyle preferences:', {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '🚭 Non-smoker', callback_data: 'lifestyle_nonsmoker' },
                  { text: '🍷 Social Drinker', callback_data: 'lifestyle_social_drinker' }
                ],
                [
                  { text: '🏃 Active', callback_data: 'lifestyle_active' },
                  { text: '📚 Intellectual', callback_data: 'lifestyle_intellectual' }
                ],
                [
                  { text: '🌱 Vegetarian', callback_data: 'lifestyle_vegetarian' },
                  { text: '🐕 Pet Lover', callback_data: 'lifestyle_pet_lover' }
                ],
                [
                  { text: '🎯 Any Lifestyle', callback_data: 'lifestyle_any' }
                ],
                [
                  { text: '🔙 Back to VIP Filters', callback_data: 'search_vip_filters' }
                ]
              ]
            }
          });
        // Interest filter handlers
        } else if (data.startsWith('interest_')) {
          const interest = data.replace('interest_', '');
          try {
            await axios.post(`${API_BASE}/preferences/${telegramId}`, {
              interests: [interest]
            });
            bot.sendMessage(chatId, `✅ **Interest filter updated!**\n\nYou will now see people interested in ${interest}.`);
          } catch (err) {
            console.error('Interest filter error:', err);
            bot.sendMessage(chatId, '❌ Failed to update interest filter. Please try again.');
          }
        // Education filter handlers
        } else if (data.startsWith('edu_')) {
          const education = data.replace('edu_', '').replace('_', ' ');
          try {
            await axios.post(`${API_BASE}/preferences/${telegramId}`, {
              education: education
            });
            bot.sendMessage(chatId, `✅ **Education filter updated!**\n\nYou will now see people with ${education} education.`);
          } catch (err) {
            console.error('Education filter error:', err);
            bot.sendMessage(chatId, '❌ Failed to update education filter. Please try again.');
          }
        // Height filter handlers
        } else if (data.startsWith('height_')) {
          const height = data.replace('height_', '').replace('_', '-');
          try {
            await axios.post(`${API_BASE}/preferences/${telegramId}`, {
              height: height
            });
            bot.sendMessage(chatId, `✅ **Height filter updated!**\n\nYou will now see people with ${height} height preference.`);
          } catch (err) {
            console.error('Height filter error:', err);
            bot.sendMessage(chatId, '❌ Failed to update height filter. Please try again.');
          }
        // Profession filter handlers
        } else if (data.startsWith('prof_')) {
          const profession = data.replace('prof_', '');
          try {
            await axios.post(`${API_BASE}/preferences/${telegramId}`, {
              profession: profession
            });
            bot.sendMessage(chatId, `✅ **Profession filter updated!**\n\nYou will now see people working in ${profession}.`);
          } catch (err) {
            console.error('Profession filter error:', err);
            bot.sendMessage(chatId, '❌ Failed to update profession filter. Please try again.');
          }
        // Lifestyle filter handlers
        } else if (data.startsWith('lifestyle_')) {
          const lifestyle = data.replace('lifestyle_', '').replace('_', ' ');
          try {
            await axios.post(`${API_BASE}/preferences/${telegramId}`, {
              lifestyle: lifestyle
            });
            bot.sendMessage(chatId, `✅ **Lifestyle filter updated!**\n\nYou will now see people with ${lifestyle} lifestyle.`);
          } catch (err) {
            console.error('Lifestyle filter error:', err);
            bot.sendMessage(chatId, '❌ Failed to update lifestyle filter. Please try again.');
          }
        } else {
          // Skip callbacks that are handled by other modules
          const handledCallbacks = [
            // VIP callbacks handled by premium.js
            'extend_vip', 'gift_vip', 'manage_vip', 'cancel_vip',
            'buy_vip_1', 'buy_vip_3', 'buy_vip_6',
            'gift_vip_1', 'gift_vip_3', 'gift_vip_6',
            'vip_purchase_monthly', 'vip_purchase_yearly', 'vip_purchase_lifetime',
            'vip_purchase_weekly',
            // Settings callbacks handled by settings.js
            'age_range_18_25', 'age_range_26_35', 'age_range_36_45', 'age_range_46_55',
            'age_range_18_35', 'age_range_25_45',
            'distance_10', 'distance_25', 'distance_50', 'distance_100', 'distance_250', 'distance_unlimited',
            'gender_male', 'gender_female', 'gender_any',
            'set_age_range', 'set_distance', 'set_gender_pref',
            'settings_search', 'back_to_search', 'main_settings',
            'settings_profile', 'settings_notifications', 'settings_privacy', 'settings_help',
            // Search callbacks handled in bot-new.js
            'search_age_range', 'search_distance', 'search_gender', 'search_location',
            'vip_filters', 'search_vip_filters', 'start_advanced_search',
            'location_current', 'location_city', 'location_any',
            // VIP filter callbacks
            'filter_interests', 'filter_education', 'filter_height', 'filter_profession', 'filter_lifestyle',
            // Likes You callbacks
            'view_all_likes', 'back_to_likes'
          ];
          
          // Check for dynamic callbacks (with IDs)
          const isDynamicCallback = data.startsWith('view_liker_') || 
                                   data.startsWith('like_') || 
                                   data.startsWith('pass_') || 
                                   data.startsWith('superlike_');
          
          if (!handledCallbacks.includes(data) && !isDynamicCallback) {
            console.log('Unhandled callback data:', data);
            bot.sendMessage(chatId, '❓ This feature is not yet implemented. Please use the corresponding command instead.');
          }
          // These callbacks are handled by other modules - do nothing here
        }
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
        
        // Invalidate cache so /profile shows updated photo
        invalidateUserCache(telegramId);
        
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

// Temporary code to simulate /register command for debugging
// handleRegister(bot, {
//   from: { id: 12345, username: 'testuser', first_name: 'Test' },
//   chat: { id: 12345 }
// });

module.exports = bot;
