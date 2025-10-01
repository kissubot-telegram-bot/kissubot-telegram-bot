// bot.js
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

const BOT_TOKEN = process.env.BOT_TOKEN;
// Use localhost for development, deployed URL for production
const API_BASE = process.env.NODE_ENV === 'production' 
  ? 'http://localhost:3000'  // Server runs on same instance in production
  : (process.env.API_BASE || 'http://localhost:3000');
// Bot configuration
// Use webhook for production (Render), polling for local development
const bot = new TelegramBot(BOT_TOKEN, {
  webHook: false, // We'll handle webhook manually via Express
  polling: process.env.NODE_ENV !== 'production' ? {
    interval: 300, // Poll interval in milliseconds
    autoStart: true, // Start polling automatically
    params: {
      timeout: 10 // Long polling timeout in seconds
    }
  } : false
});

// Error handling for polling errors
bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
  // Attempt to restart polling after a delay
  setTimeout(() => {
    try {
      bot.stopPolling();
      setTimeout(() => {
        bot.startPolling();
        console.log('Polling restarted after error');
      }, 5000);
    } catch (e) {
      console.error('Failed to restart polling:', e);
    }
  }, 10000);
});

// Handle other bot errors
bot.on('error', (error) => {
  console.error('Bot error:', error);
});

// Connection status logging
bot.on('webhook_error', (error) => {
  console.error('Webhook error:', error);
});

console.log('Bot initialized and starting...');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);

// Detect production environment
const isProduction = process.env.NODE_ENV === 'production' || (process.env.PORT && process.env.PORT !== '3001');

// Webhook setup for production deployment
const PORT = process.env.PORT || 3001;

// Webhook endpoint for Telegram
app.post(`/bot${BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'Kisu1bot is running!', 
    timestamp: new Date().toISOString(),
    mode: process.env.NODE_ENV || 'development',
    isProduction: isProduction,
    webhookEndpoint: `/bot${BOT_TOKEN ? '[TOKEN_SET]' : '[TOKEN_MISSING]'}`
  });
});

// Debug endpoint to check webhook status
app.get('/webhook-info', async (req, res) => {
  try {
    const webhookInfo = await bot.getWebHookInfo();
    res.json({
      webhook: webhookInfo,
      botToken: BOT_TOKEN ? 'SET' : 'MISSING',
      expectedUrl: `https://kissubot-telegram-bot.onrender.com/bot${BOT_TOKEN ? '[TOKEN]' : '[MISSING]'}`
    });
  } catch (error) {
    res.json({
      error: error.message,
      botToken: BOT_TOKEN ? 'SET' : 'MISSING'
    });
  }
});

// Set webhook URL for production
if (isProduction) {
  const webhookUrl = `https://kissubot-telegram-bot.onrender.com/bot${BOT_TOKEN}`;
  bot.setWebHook(webhookUrl)
    .then(() => {
      console.log('Webhook set successfully:', webhookUrl);
    })
    .catch((error) => {
      console.error('Failed to set webhook:', error);
    });
}

const userMatchQueue = {}; // Temporary in-memory queue
const userStates = {}; // Temporary user states for multi-step actions

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

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Welcome to Kisu1bot! Use /register to get started.');
});

// Help command
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const helpMsg = `🤖 **KISU1BOT HELP GUIDE** 🤖\n\n` +
    `📋 **Main Commands:**\n` +
    `• /start - Welcome message\n` +
    `• /register - Create your dating profile\n` +
    `• /browse - Browse and like profiles\n` +
    `• /profile - View/edit your profile\n` +
    `• /settings - Access all settings\n\n` +
    `💬 **Social Features:**\n` +
    `• /stories - Post and view stories\n` +
    `• /gifts - Send gifts to matches\n` +
    `• /matches - View your matches\n\n` +
    `💎 **Premium Features:**\n` +
    `• /coins - Buy coins for premium features\n` +
    `• /vip - Get VIP membership benefits\n\n` +
    `🛠️ **Support Commands:**\n` +
    `• /help - Show this help guide\n` +
    `• /report - Report users or issues\n` +
    `• /contact - Contact support team\n` +
    `• /delete - Delete your profile\n\n` +
    `💡 **Tips:**\n` +
    `• Complete your profile for better matches\n` +
    `• Be respectful and genuine\n` +
    `• Use stories to show your personality\n` +
    `• VIP membership unlocks premium features`;

  const buttons = [
    [
      { text: '👤 My Profile', callback_data: 'view_profile' },
      { text: '🔍 Browse Profiles', callback_data: 'browse_profiles' }
    ],
    [
      { text: '⚙️ Settings', callback_data: 'main_settings' },
      { text: '💎 Get VIP', callback_data: 'manage_vip' }
    ],
    [
      { text: '📞 Contact Support', callback_data: 'contact_support' }
    ]
  ];

  bot.sendMessage(chatId, helpMsg, {
    reply_markup: {
      inline_keyboard: buttons
    }
  });
});

// Report command
bot.onText(/\/report/, (msg) => {
  const chatId = msg.chat.id;
  const reportMsg = `🚨 **REPORT CENTER** 🚨\n\n` +
    `Help us keep Kisu1bot safe for everyone!\n\n` +
    `📝 **What can you report?**\n` +
    `• Inappropriate behavior\n` +
    `• Fake profiles\n` +
    `• Spam or harassment\n` +
    `• Technical issues\n` +
    `• Other violations\n\n` +
    `⚠️ **Before reporting:**\n` +
    `• Make sure you have valid reasons\n` +
    `• False reports may result in penalties\n` +
    `• Provide as much detail as possible`;

  const buttons = [
    [
      { text: '👤 Report User', callback_data: 'report_user' },
      { text: '🐛 Report Bug', callback_data: 'report_bug' }
    ],
    [
      { text: '💬 Report Inappropriate Content', callback_data: 'report_content' }
    ],
    [
      { text: '📞 Contact Support Instead', callback_data: 'contact_support' }
    ]
  ];

  bot.sendMessage(chatId, reportMsg, {
    reply_markup: {
      inline_keyboard: buttons
    }
  });
});

// Delete profile command
bot.onText(/\/delete/, (msg) => {
  const chatId = msg.chat.id;
  const deleteMsg = `⚠️ **DELETE PROFILE** ⚠️\n\n` +
    `🚨 **WARNING: This action cannot be undone!**\n\n` +
    `Deleting your profile will:\n` +
    `• Remove all your profile data\n` +
    `• Delete your photos and information\n` +
    `• Remove you from all matches\n` +
    `• Cancel any active VIP subscription\n` +
    `• Clear your chat history\n\n` +
    `💔 **Are you sure you want to continue?**\n\n` +
    `Consider these alternatives:\n` +
    `• Take a break (deactivate temporarily)\n` +
    `• Update your preferences\n` +
    `• Contact support for help`;

  const buttons = [
    [
      { text: '❌ Cancel - Keep My Profile', callback_data: 'cancel_delete' }
    ],
    [
      { text: '⏸️ Deactivate Temporarily', callback_data: 'deactivate_profile' }
    ],
    [
      { text: '🗑️ DELETE PERMANENTLY', callback_data: 'confirm_delete_profile' }
    ],
    [
      { text: '📞 Contact Support First', callback_data: 'contact_support' }
    ]
  ];

  bot.sendMessage(chatId, deleteMsg, {
    reply_markup: {
      inline_keyboard: buttons
    }
  });
});

// Contact support command
bot.onText(/\/contact/, (msg) => {
  const chatId = msg.chat.id;
  const contactMsg = `📞 **CONTACT SUPPORT** 📞\n\n` +
    `Our support team is here to help!\n\n` +
    `🕐 **Support Hours:**\n` +
    `Monday - Friday: 9 AM - 6 PM UTC\n` +
    `Weekend: Limited support\n\n` +
    `📧 **Contact Methods:**\n` +
    `• Email: support@kisu1bot.com\n` +
    `• Response time: 24-48 hours\n\n` +
    `💬 **Common Issues:**\n` +
    `• Profile not showing up\n` +
    `• Payment/VIP problems\n` +
    `• Technical difficulties\n` +
    `• Account recovery\n` +
    `• Report violations\n\n` +
    `📋 **Before contacting:**\n` +
    `• Check /help for common solutions\n` +
    `• Include your Telegram username\n` +
    `• Describe the issue clearly`;

  const buttons = [
    [
      { text: '📧 Email Support', callback_data: 'email_support' }
    ],
    [
      { text: '🚨 Report Issue', callback_data: 'report_user' },
      { text: '❓ FAQ/Help', callback_data: 'show_help' }
    ],
    [
      { text: '💬 Send Feedback', callback_data: 'send_feedback' }
    ]
  ];

  bot.sendMessage(chatId, contactMsg, {
    reply_markup: {
      inline_keyboard: buttons
    }
  });
});

// Settings command
bot.onText(/\/settings/, (msg) => {
  const chatId = msg.chat.id;
  const settingsMsg = `⚙️ **SETTINGS MENU** ⚙️\n\n` +
    `Customize your Kisu1bot experience!\n\n` +
    `👤 **Profile Settings**\n` +
    `• Edit your profile information\n` +
    `• Update photos and bio\n` +
    `• Privacy preferences\n\n` +
    `🔍 **Search Preferences**\n` +
    `• Age range and distance\n` +
    `• Gender preferences\n` +
    `• Location settings\n\n` +
    `💎 **Premium Features**\n` +
    `• VIP membership\n` +
    `• Coins and purchases\n` +
    `• Priority features\n\n` +
    `🔔 **Notifications**\n` +
    `• Match notifications\n` +
    `• Message alerts\n` +
    `• Activity updates`;

  const buttons = [
    [
      { text: '👤 Profile Settings', callback_data: 'settings_profile' },
      { text: '🔍 Search Preferences', callback_data: 'settings_search' }
    ],
    [
      { text: '💎 Premium Features', callback_data: 'settings_premium' },
      { text: '🔔 Notifications', callback_data: 'settings_notifications' }
    ],
    [
      { text: '🔒 Privacy & Safety', callback_data: 'settings_privacy' },
      { text: '🛠️ Account Settings', callback_data: 'settings_account' }
    ],
    [
      { text: '❓ Help & Support', callback_data: 'settings_help' }
    ]
  ];

  bot.sendMessage(chatId, settingsMsg, {
    reply_markup: {
      inline_keyboard: buttons
    }
  });
});

// START
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;

  try {
    // Check if user is already registered
    try {
      const existingUser = await axios.get(`${API_BASE}/profile/${telegramId}`);
      if (existingUser.data) {
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

// REGISTER command
bot.onText(/\/register/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;

  try {
    // Check if user is already registered
    try {
      const existingUser = await axios.get(`${API_BASE}/profile/${telegramId}`);
      if (existingUser.data) {
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

// BROWSE command
bot.onText(/\/browse/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;

  try {
    const res = await axios.get(`${API_BASE}/browse/${telegramId}`);
    const profile = res.data;

    if (!profile) {
      return bot.sendMessage(
        chatId,
        '🔍 No more profiles to show right now.\n\n' +
        'Try again later or adjust your search settings with /search'
      );
    }

    const profileText = `👤 ${profile.name || 'Anonymous'}, ${profile.age || '?'}\n` +
      `📍 ${profile.location || 'Location not set'}\n\n` +
      `${profile.bio || 'No bio available'}`;

    const opts = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '❤️ Like', callback_data: `like_${profile.telegramId}` },
            { text: '👎 Pass', callback_data: `pass_${profile.telegramId}` }
          ],
          [
            { text: '🎁 Send Gift', callback_data: `gift_${profile.telegramId}` },
            { text: '⭐ Super Like', callback_data: `superlike_${profile.telegramId}` }
          ]
        ]
      }
    };

    if (profile.photoUrl) {
      bot.sendPhoto(chatId, profile.photoUrl, {
        caption: profileText,
        reply_markup: opts.reply_markup
      });
    } else {
      bot.sendMessage(chatId, profileText, opts);
    }

  } catch (err) {
    console.error('[/browse] Error:', err.response?.data || err.message);
    bot.sendMessage(chatId, '❌ Failed to load profiles. Please try again later.');
  }
});

// PROFILE
bot.onText(/\/profile/, async (msg) => {
  const chatId = msg.chat.id;
  // Placeholder: you can fetch real user data from DB later
  bot.sendMessage(chatId, `🧍 Your Profile:

• Name: (not set)
• Age: (not set)
• Gender: (not set)
• Bio: (not set)

Update coming soon!`);
});

// MATCHES
bot.onText(/\/matches/, async (msg) => {
  const chatId = msg.chat.id;
  // Placeholder for matched users
  bot.sendMessage(chatId, `💞 You have no matches yet.
Keep browsing and liking profiles!`);
});

// Global message handler to process profile edits
bot.on('message', async (msg) => {
  try {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;
    if (!telegramId) return;

    const state = userStates[telegramId];
    if (!state) return; // not in any flow

    const text = (msg.text || '').trim();
    if (!text) return;

    // Handle cancel
    if (text.toLowerCase() === '/cancel') {
      delete userStates[telegramId];
      if (state.editing) {
        await bot.sendMessage(chatId, '❌ Edit cancelled.');
      } else if (state.reporting) {
        await bot.sendMessage(chatId, '❌ Report cancelled. Thank you for helping keep our community safe!');
      }
      return;
    }

    // Handle report submissions
    if (state.reporting) {
      const reportType = state.reporting; // 'user' | 'content' | 'bug' | 'feature'
      
      if (text.length < 10) {
        return bot.sendMessage(chatId, '❌ Please provide more details (at least 10 characters). Send a more detailed report or /cancel to abort.');
      }

      // Process the report
      const reportData = {
        type: reportType,
        reporterId: telegramId,
        description: text,
        timestamp: new Date().toISOString()
      };

      // Log the report (in a real app, you'd save this to database)
      console.log('Report received:', reportData);

      delete userStates[telegramId];

      const reportTypeLabels = {
        user: 'User Report',
        content: 'Content Report', 
        bug: 'Bug Report',
        feature: 'Feature Request'
      };

      await bot.sendMessage(chatId, `✅ **${reportTypeLabels[reportType]} Submitted** ✅\n\n` +
        `Thank you for your report! Our team will review it and take appropriate action.\n\n` +
        `📧 You may receive a follow-up email if we need more information.\n\n` +
        `🛡️ Your report helps keep Kisu1bot safe for everyone!`, {
        reply_markup: {
          inline_keyboard: [[
            { text: '📞 Contact Support', callback_data: 'contact_support' },
            { text: '🔙 Back to Help', callback_data: 'show_help' }
          ]]
        }
      });
      return;
    }

    // Handle profile edits
    if (!state.editing) return; // not in edit flow
    const field = state.editing; // 'name' | 'age' | 'location' | 'bio'
    let value = text;

    // Validate input
    if (field === 'name') {
      if (value.length < 2 || value.length > 50) {
        return bot.sendMessage(chatId, '❌ Name must be between 2 and 50 characters. Try again or send /cancel.');
      }
    } else if (field === 'age') {
      const n = parseInt(value, 10);
      if (isNaN(n) || n < 18 || n > 99) {
        return bot.sendMessage(chatId, '❌ Please send a valid age between 18 and 99.');
      }
      value = n;
    } else if (field === 'location') {
      if (value.length < 2 || value.length > 100) {
        return bot.sendMessage(chatId, '❌ Location must be between 2 and 100 characters. Try again or send /cancel.');
      }
    } else if (field === 'bio') {
      if (value.length > 300) {
        return bot.sendMessage(chatId, `❌ Bio is too long (${value.length} chars). Max is 300. Please shorten and resend.`);
      }
    }

    // Commit update to backend
    try {
      const res = await axios.post(`${API_BASE}/profile/update/${telegramId}`, { field, value });
      delete userStates[telegramId];

      const labelMap = { name: 'Name', age: 'Age', location: 'Location', bio: 'Bio' };
      await bot.sendMessage(chatId, `✅ ${labelMap[field]} updated successfully!`, {
        reply_markup: {
          inline_keyboard: [[
            { text: '🔙 Back to Profile Settings', callback_data: 'settings_profile' }
          ]]
        }
      });
    } catch (err) {
      console.error('Profile update error:', err.response?.data || err.message);
      await bot.sendMessage(chatId, '❌ Failed to update your profile. Please try again later.');
    }
  } catch (e) {
    console.error('Message handler error:', e);
  }
});

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const telegramId = query.from.id;
  const data = query.data;

  if (data.startsWith('like_')) {
    const toId = data.split('_')[1];
    try {
      const res = await axios.post(`${API_BASE}/like`, {
        fromId: telegramId,
        toId,
      });

      if (res.data.matched) {
        bot.sendMessage(chatId, `You matched with @${res.data.username || 'someone'}!`);
      } else {
        bot.sendMessage(chatId, res.data.message || 'Liked!');
      }
    } catch (err) {
      bot.sendMessage(chatId, 'Error while liking.');
    }
  } else {
    switch(data) {
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
          bot.sendMessage(chatId, '📍 **Edit Location**\n\nPlease enter your city/location:');
          break;
  
        case 'edit_bio':
          userStates[telegramId] = { editing: 'bio' };
          bot.sendMessage(chatId, '💭 **Edit Bio**\n\nPlease enter your bio (max 500 characters):');
          break;
      case 'view_stories':
        try {
          const storiesRes = await axios.get(`${API_BASE}/stories/recent/${telegramId}`);
          const stories = storiesRes.data.stories || [];
          
          if (stories.length === 0) {
            return bot.sendMessage(chatId, 
              '📸 **NO NEW STORIES** 📸\n\n' +
              '😔 No new stories to view right now.\n\n' +
              '💡 **Tips:**\n' +
              '• Follow more people to see their stories\n' +
              '• Post your own story to get more followers\n' +
              '• Use /browse to find interesting people'
            );
          }

          // Show stories viewer
          const viewMsg = `👀 **VIEWING STORIES** 👀\n\n` +
            `📱 Found **${stories.length}** new stories\n\n` +
            `Tap to view each story:`;

          const storyButtons = stories.slice(0, 6).map((story, index) => [
            { text: `📸 ${story.userName} ${story.isVip ? '👑' : ''}`, callback_data: `view_story_${story._id}` }
          ]);

          storyButtons.push([
            { text: '🔙 Back to Stories', callback_data: 'stories_main_menu' }
          ]);

          bot.editMessageText(viewMsg, {
            chat_id: chatId,
            message_id: query.message.message_id,
            reply_markup: { inline_keyboard: storyButtons },
            parse_mode: 'Markdown'
          });
        } catch (err) {
          bot.sendMessage(chatId, '❌ Unable to load stories. Please try again.');
        }
        break;

      case 'post_story':
        // Set user state to expect story content
        userStates[telegramId] = { awaitingStory: true };
        
        const postMsg = `📸 **POST YOUR STORY** 📸\n\n` +
          `📱 Send me a photo or video for your story!\n\n` +
          `✨ **Story Features:**\n` +
          `• Visible for 24 hours\n` +
          `• Add text caption\n` +
          `• See who viewed it\n` +
          `• Boost your profile visibility\n\n` +
          `📷 Just send your photo/video now!`;

        bot.editMessageText(postMsg, {
          chat_id: chatId,
          message_id: query.message.message_id,
          reply_markup: {
            inline_keyboard: [
              [{ text: '❌ Cancel', callback_data: 'stories_main_menu' }]
            ]
          },
          parse_mode: 'Markdown'
        });
        break;

      case 'my_stories':
        try {
          const userStoriesRes = await axios.get(`${API_BASE}/stories/user/${telegramId}`);
          const userStories = userStoriesRes.data.stories || [];
          
          if (userStories.length === 0) {
            const noStoriesMsg = `📱 **YOUR STORIES** 📱\n\n` +
              `📸 You haven't posted any stories yet.\n\n` +
              `💡 **Why post stories?**\n` +
              `• Get more profile views\n` +
              `• Show your personality\n` +
              `• Connect with more people\n` +
              `• Increase your matches\n\n` +
              `Ready to share your first story?`;

            bot.editMessageText(noStoriesMsg, {
              chat_id: chatId,
              message_id: query.message.message_id,
              reply_markup: {
                inline_keyboard: [
                  [{ text: '📸 Post First Story', callback_data: 'post_story' }],
                  [{ text: '🔙 Back to Stories', callback_data: 'stories_main_menu' }]
                ]
              },
              parse_mode: 'Markdown'
            });
          } else {
            const storiesMsg = `📱 **YOUR STORIES** 📱\n\n` +
              `📸 Active Stories: **${userStories.length}**\n\n` +
              userStories.slice(0, 5).map((story, index) => {
                const timeAgo = Math.floor((Date.now() - new Date(story.createdAt)) / (1000 * 60 * 60));
                const views = story.views ? story.views.length : 0;
                return `${index + 1}. ${story.type === 'photo' ? '📷' : '🎥'} Posted ${timeAgo}h ago\n` +
                       `   👀 ${views} views`;
              }).join('\n\n');

            const myStoriesButtons = [
              [
                { text: '📸 Post New Story', callback_data: 'post_story' },
                { text: '👀 View Analytics', callback_data: 'story_stats' }
              ],
              [{ text: '🔙 Back to Stories', callback_data: 'stories_main_menu' }]
            ];

            bot.editMessageText(storiesMsg, {
              chat_id: chatId,
              message_id: query.message.message_id,
              reply_markup: { inline_keyboard: myStoriesButtons },
              parse_mode: 'Markdown'
            });
          }
        } catch (err) {
          bot.sendMessage(chatId, '❌ Unable to load your stories. Please try again.');
        }
        break;

      case 'story_stats':
        try {
          const [userStoriesRes, analyticsRes] = await Promise.all([
            axios.get(`${API_BASE}/stories/user/${telegramId}`),
            axios.get(`${API_BASE}/stories/analytics/${telegramId}`)
          ]);
          
          const stories = userStoriesRes.data.stories || [];
          const analytics = analyticsRes.data || {};
          
          const statsMsg = `📊 **STORY ANALYTICS** 📊\n\n` +
            `📸 **Your Stories:**\n` +
            `   Total Posted: **${analytics.totalStories || 0}**\n` +
            `   Currently Active: **${stories.length}**\n\n` +
            `👀 **Views & Engagement:**\n` +
            `   Total Views: **${analytics.totalViews || 0}**\n` +
            `   Average Views: **${analytics.avgViews || 0}**\n` +
            `   Profile Visits: **${analytics.profileVisits || 0}**\n\n` +
            `🔥 **Performance:**\n` +
            `   Best Story: **${analytics.bestStoryViews || 0}** views\n` +
            `   Engagement Rate: **${analytics.engagementRate || 0}%**\n\n` +
            `💡 Post more stories to boost your visibility!`;

          bot.editMessageText(statsMsg, {
            chat_id: chatId,
            message_id: query.message.message_id,
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '📸 Post Story', callback_data: 'post_story' },
                  { text: '📱 My Stories', callback_data: 'my_stories' }
                ],
                [{ text: '🔙 Back to Stories', callback_data: 'stories_main_menu' }]
              ]
            },
            parse_mode: 'Markdown'
          });
        } catch (err) {
          bot.sendMessage(chatId, '❌ Unable to load story analytics. Please try again.');
        }
        break;

      case 'story_settings':
        const settingsMsg = `⚙️ **STORY SETTINGS** ⚙️\n\n` +
          `🔒 **Privacy Settings:**\n` +
          `• Who can view your stories\n` +
          `• Story visibility duration\n` +
          `• Auto-delete settings\n\n` +
          `📱 **Notification Settings:**\n` +
          `• New story alerts\n` +
          `• View notifications\n` +
          `• Story interaction alerts`;

        bot.editMessageText(settingsMsg, {
          chat_id: chatId,
          message_id: query.message.message_id,
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🔒 Privacy Settings', callback_data: 'story_privacy' },
                { text: '🔔 Notifications', callback_data: 'story_notifications' }
              ],
              [{ text: '🔙 Back to Stories', callback_data: 'stories_main_menu' }]
            ]
          },
          parse_mode: 'Markdown'
        });
        break;

      case 'story_help':
        const helpMsg = `❓ **STORY HELP GUIDE** ❓\n\n` +
          `📸 **What are Stories?**\n` +
          `Stories are photos/videos that disappear after 24 hours. They're perfect for sharing moments and connecting with others!\n\n` +
          `🎯 **How to Use Stories:**\n` +
          `1. Tap "📸 Post Story"\n` +
          `2. Send a photo or video\n` +
          `3. Add a caption (optional)\n` +
          `4. Your story goes live!\n\n` +
          `✨ **Story Benefits:**\n` +
          `• Increase profile visibility\n` +
          `• Show your personality\n` +
          `• Get more matches\n` +
          `• See who's interested in you\n\n` +
          `💡 **Pro Tips:**\n` +
          `• Post regularly for best results\n` +
          `• Use good lighting for photos\n` +
          `• Add engaging captions\n` +
          `• Check your story analytics`;

        bot.editMessageText(helpMsg, {
          chat_id: chatId,
          message_id: query.message.message_id,
          reply_markup: {
            inline_keyboard: [
              [{ text: '📸 Post Your First Story', callback_data: 'post_story' }],
              [{ text: '🔙 Back to Stories', callback_data: 'stories_main_menu' }]
            ]
          },
          parse_mode: 'Markdown'
        });
        break;

      case 'stories_main_menu':
        // Return to main stories menu
        try {
          const [userStoriesRes, recentStoriesRes] = await Promise.all([
            axios.get(`${API_BASE}/stories/user/${telegramId}`).catch(() => ({ data: { stories: [] } })),
            axios.get(`${API_BASE}/stories/recent/${telegramId}`).catch(() => ({ data: { stories: [] } }))
          ]);

          const userStories = userStoriesRes.data.stories || [];
          const recentStories = recentStoriesRes.data.stories || [];

          const mainMenuMsg = `📸 **STORIES CENTER** 📸\n\n` +
            `📱 Your Stories: **${userStories.length}** active\n` +
            `👀 New Stories: **${recentStories.length}** to view\n\n` +
            `🎯 What would you like to do?`;

          bot.editMessageText(mainMenuMsg, {
            chat_id: chatId,
            message_id: query.message.message_id,
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '📸 Post Story', callback_data: 'post_story' },
                  { text: '👀 View Stories', callback_data: 'view_stories' }
                ],
                [
                  { text: '📱 My Stories', callback_data: 'my_stories' },
                  { text: '📊 Story Stats', callback_data: 'story_stats' }
                ],
                [
                  { text: '⚙️ Story Settings', callback_data: 'story_settings' },
                  { text: '❓ Story Help', callback_data: 'story_help' }
                ]
              ]
            },
            parse_mode: 'Markdown'
          });
        } catch (err) {
          bot.sendMessage(chatId, '❌ Unable to load stories menu. Please try again.');
        }
        break;

      case 'buy_coins':
        try {
          const res = await axios.get(`${API_BASE}/coins/${telegramId}`);
          const { coins, packages } = res.data;

          const balanceMsg = `💰 Your Coin Balance: ${coins} 🪙\n\n` +
            '🎁 Available Packages:';

          const packageButtons = Object.entries(packages).map(([id, pack]) => ({
            text: `${pack.name} (${pack.coins + pack.bonus} coins)`,
            callback_data: `buy_coins_${id}`
          }));

          const buttonRows = packageButtons.reduce((rows, button, index) => {
            if (index % 2 === 0) {
              rows.push([button]);
            } else {
              rows[rows.length - 1].push(button);
            }
            return rows;
          }, []);

          const packagesMsg = Object.values(packages).map(pack => 
            `\n\n${pack.name}:` +
            `\n• ${pack.coins} coins` +
            (pack.bonus ? `\n• +${pack.bonus} bonus coins` : '') +
            `\n• $${pack.price}`
          ).join('');

          const opts = {
            reply_markup: {
              inline_keyboard: buttonRows
            }
          };

          bot.sendMessage(
            chatId,
            balanceMsg + packagesMsg + '\n\n💡 Coins can be used for VIP membership, gifts, and other premium features!',
            opts
          );
        } catch (err) {
          bot.sendMessage(chatId, 'Failed to fetch coin balance.');
        }
        break;

      case 'extend_vip':
        bot.sendMessage(chatId, 'Choose a plan to extend your VIP membership:', {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '📅 Monthly', callback_data: 'vip_purchase_monthly' },
                { text: '📆 Yearly', callback_data: 'vip_purchase_yearly' }
              ],
              [{ text: '♾️ Lifetime', callback_data: 'vip_purchase_lifetime' }]
            ]
          }
        });
        break;

      case 'cancel_vip':
        try {
          await axios.post(`${API_BASE}/vip/cancel/${telegramId}`);
          bot.sendMessage(chatId, 'Your VIP subscription has been cancelled. You will retain benefits until the current period ends.');
        } catch (err) {
          bot.sendMessage(chatId, 'Failed to cancel VIP subscription.');
        }
        break;

      case 'vip_purchase_monthly':
      case 'vip_purchase_yearly':
      case 'vip_purchase_lifetime':
        const planType = data.split('_')[2]; // monthly, yearly, or lifetime
        try {
          const res = await axios.post(`${API_BASE}/vip/purchase/${telegramId}`, {
            planType
          });
          
          const successMessage = `🎉 Congratulations! Your ${planType} VIP subscription is now active!\n\n` +
            `Remaining coins: ${res.data.remainingCoins} 🪙\n` +
            'Use /vip to see your benefits and status.';
          
          bot.sendMessage(chatId, successMessage);
        } catch (err) {
          if (err.response?.data?.error === 'Insufficient coins') {
            const required = err.response.data.required;
            const current = err.response.data.current;
            bot.sendMessage(chatId, 
              `You need ${required} coins for this plan, but you only have ${current} coins.\n` +
              'Use /coins to purchase more coins!'
            );
          } else {
            bot.sendMessage(chatId, 'Failed to purchase VIP subscription. Please try again later.');
          }
        }
        break;
      case data.match(/^priority_(.+)$/)?.input:
        const priorityPlan = data.split('_')[1];
        try {
          const res = await axios.post(`${API_BASE}/priority/purchase/${telegramId}`, {
            planType: priorityPlan
          });
          
          const expiryDate = new Date(res.data.expiresAt).toLocaleString();
          const successMsg = '⚡️ Priority Status Activated!\n\n' +
            `Your profile will be shown first until ${expiryDate}\n` +
            `Remaining coins: ${res.data.remainingCoins} 🪙`;
          
          bot.sendMessage(chatId, successMsg);
        } catch (err) {
          if (err.response?.data?.error === 'Insufficient coins') {
            const required = err.response.data.required;
            const current = err.response.data.current;
            bot.sendMessage(chatId, 
              `You need ${required} coins for this plan, but you only have ${current} coins.\n` +
              'Use /coins to get more coins!'
            );
          } else {
            bot.sendMessage(chatId, 'Failed to activate priority status. Please try again later.');
          }
        }
        break;

      case 'chat_(.+)'?.input:
        const chatUserId = data.split('_')[1];
        bot.sendMessage(chatId, 'Opening chat... (Chat feature coming soon)');
        break;

      case 'unmatch_(.+)'?.input:
        const unmatchUserId = data.split('_')[1];
        try {
          await axios.post(`${API_BASE}/matches/unmatch`, {
            fromId: telegramId,
            toId: unmatchUserId
          });
          bot.sendMessage(chatId, 'Successfully unmatched. Use /browse to find new matches!');
        } catch (err) {
          bot.sendMessage(chatId, 'Failed to unmatch. Please try again later.');
        }
        break;

      case 'pass_like_(.+)'?.input:
        const passUserId = data.split('_')[2];
        try {
          // Remove the like from the database
          await axios.post(`${API_BASE}/likes/remove`, {
            fromId: passUserId,
            toId: telegramId
          });
          bot.sendMessage(chatId, 'Profile passed. Use /likesyou to see your remaining likes!');
        } catch (err) {
          bot.sendMessage(chatId, 'Failed to pass profile. Please try again later.');
        }
        break;

      case 'view_story_(.+)'?.input:
        const storyId = data.split('_')[2];
        try {
          const response = await axios.post(`${API_BASE}/stories/view/${storyId}`, {
            viewerId: telegramId
          });
          
          const story = response.data.story;
          const viewCount = response.data.viewCount;
          
          // Send the story media with caption
          const storyCaption = `📸 **${story.ownerName}** ${story.ownerIsVip ? '👑' : ''}\n\n` +
            (story.caption ? `"${story.caption}"\n\n` : '') +
            `👀 ${viewCount} views • ${Math.floor((Date.now() - new Date(story.createdAt)) / (1000 * 60 * 60))}h ago`;
          
          if (story.type === 'photo') {
            await bot.sendPhoto(chatId, story.mediaUrl, {
              caption: storyCaption,
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: '👤 View Profile', callback_data: `view_profile_${story.userId}` },
                    { text: '❤️ Like', callback_data: `like_${story.userId}` }
                  ],
                  [
                    { text: '🔙 Back to Stories', callback_data: 'view_stories' }
                  ]
                ]
              }
            });
          } else if (story.type === 'video') {
            await bot.sendVideo(chatId, story.mediaUrl, {
              caption: storyCaption,
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: '👤 View Profile', callback_data: `view_profile_${story.userId}` },
                    { text: '❤️ Like', callback_data: `like_${story.userId}` }
                  ],
                  [
                    { text: '🔙 Back to Stories', callback_data: 'view_stories' }
                  ]
                ]
              }
            });
          }
        } catch (err) {
          if (err.response?.status === 410) {
            bot.sendMessage(chatId, '⏰ This story has expired and is no longer available.');
          } else {
            console.error('Error viewing story:', err);
            bot.sendMessage(chatId, '❌ Unable to load this story. Please try again.');
          }
        }
        break;
      // Handle coin package purchases
      case 'buy_coins_starter':
      case 'buy_coins_popular':
      case 'buy_coins_premium':
      case 'buy_coins_ultimate':
        const packageId = data.split('_')[2];
        try {
          const res = await axios.post(`${API_BASE}/coins/purchase/${telegramId}`, {
            packageId
          });
          
          const { coinsAdded, newBalance } = res.data;
          
          // Get package details for confirmation message
          const packageDetails = {
            starter: { name: 'Starter Pack', coins: 1000, bonus: 0, price: 4.99 },
            popular: { name: 'Popular Pack', coins: 5000, bonus: 500, price: 19.99 },
            premium: { name: 'Premium Pack', coins: 12000, bonus: 2000, price: 39.99 },
            ultimate: { name: 'Ultimate Pack', coins: 30000, bonus: 8000, price: 79.99 }
          };
          
          const pack = packageDetails[packageId];
          const successMsg = `🎉 **PURCHASE SUCCESSFUL!** 🎉\n\n` +
            `📦 **${pack.name}** purchased!\n` +
            `💰 **${coinsAdded} coins** added to your account\n` +
            `🪙 **New Balance:** ${newBalance} coins\n\n` +
            `✨ **What you can do with coins:**\n` +
            `• 👑 Purchase VIP membership\n` +
            `• 🎁 Send premium gifts\n` +
            `• ⚡️ Boost your profile priority\n` +
            `• 🌟 Unlock special features\n\n` +
            `Thank you for your purchase! 💙`;
          
          await bot.sendMessage(chatId, successMsg, {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '👑 Get VIP', callback_data: 'manage_vip' },
                  { text: '🎁 Send Gifts', callback_data: 'send_gift' }
                ],
                [
                  { text: '⚡️ Priority Boost', callback_data: 'priority_boost' },
                  { text: '💰 Buy More Coins', callback_data: 'buy_coins' }
                ]
              ]
            },
            parse_mode: 'Markdown'
          });
          
        } catch (err) {
          console.error('Coin purchase error:', err);
          if (err.response?.status === 400) {
            bot.sendMessage(chatId, '❌ Invalid package selected. Please try again.');
          } else if (err.response?.status === 404) {
            bot.sendMessage(chatId, '❌ User not found. Please register first using /start.');
          } else {
            bot.sendMessage(chatId, '❌ Failed to purchase coins. Please try again later.');
          }
        }
        break;

      case 'extend_vip':
        bot.sendMessage(chatId, 'Choose a plan to extend your VIP membership:', {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '📅 Monthly', callback_data: 'vip_purchase_monthly' },
                { text: '📆 Yearly', callback_data: 'vip_purchase_yearly' }
              ],
              [{ text: '♾️ Lifetime', callback_data: 'vip_purchase_lifetime' }]
            ]
          }
        });
        break;

      // Search Settings callbacks
      case 'set_age_range':
        bot.sendMessage(chatId, '👥 **SET AGE RANGE** 👥\n\nChoose your preferred age range for matches:', {
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
                { text: '🔙 Back to Settings', callback_data: 'back_to_search' }
              ]
            ]
          },
          parse_mode: 'Markdown'
        });
        break;

      case 'set_distance':
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
                { text: '🔙 Back to Settings', callback_data: 'back_to_search' }
              ]
            ]
          },
          parse_mode: 'Markdown'
        });
        break;

      case 'set_gender_pref':
        bot.sendMessage(chatId, '⚧️ **GENDER PREFERENCE** ⚧️\n\nWho would you like to see?', {
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
                { text: '🔙 Back to Settings', callback_data: 'back_to_search' }
              ]
            ]
          },
          parse_mode: 'Markdown'
        });
        break;

            // Apply age range selections
      case 'age_range_18_25':
      case 'age_range_26_35':
      case 'age_range_36_45':
      case 'age_range_46_55':
      case 'age_range_18_35':
      case 'age_range_25_45': {
        try {
          let ageMin = 18, ageMax = 35;
          switch (data) {
            case 'age_range_18_25': ageMin = 18; ageMax = 25; break;
            case 'age_range_26_35': ageMin = 26; ageMax = 35; break;
            case 'age_range_36_45': ageMin = 36; ageMax = 45; break;
            case 'age_range_46_55': ageMin = 46; ageMax = 55; break;
            case 'age_range_18_35': ageMin = 18; ageMax = 35; break;
            case 'age_range_25_45': ageMin = 25; ageMax = 45; break;
          }
          await axios.post(`${API_BASE}/search-settings/${telegramId}`, { ageMin, ageMax });
          await bot.sendMessage(chatId, `✅Age range updated to ${ageMin}-${ageMax} years!`, {
            reply_markup: { inline_keyboard: [[{ text: 'ðŸ”™ Back to Search', callback_data: 'back_to_search' }]] },
            parse_mode: 'Markdown'
          });
        } catch (err) {
          console.error('Set age range error:', err.response?.data || err.message);
          bot.sendMessage(chatId, 'âŒ Failed to update age range. Please try again.');
        }
        break;
      }

      // Apply distance selections
      case 'distance_10':
      case 'distance_25':
      case 'distance_50':
      case 'distance_100':
      case 'distance_250':
      case 'distance_unlimited': {
        try {
          let maxDistance;
          switch (data) {
            case 'distance_10': maxDistance = 10; break;
            case 'distance_25': maxDistance = 25; break;
            case 'distance_50': maxDistance = 50; break;
            case 'distance_100': maxDistance = 100; break;
            case 'distance_250': maxDistance = 250; break;
            case 'distance_unlimited': maxDistance = 100000; break;
          }
          await axios.post(`${API_BASE}/search-settings/${telegramId}`, { maxDistance });
          const label = data === 'distance_unlimited' ? 'Unlimited' : `${maxDistance} km`;
          await bot.sendMessage(chatId, `✅Max distance updated to ${label}!`, {
            reply_markup: { inline_keyboard: [[{ text: 'ðŸ”™ Back to Search', callback_data: 'back_to_search' }]] },
            parse_mode: 'Markdown'
          });
        } catch (err) {
          console.error('Set distance error:', err.response?.data || err.message);
          bot.sendMessage(chatId, 'âŒ Failed to update distance. Please try again.');
        }
        break;
      }

      // Apply gender preference selections
      case 'gender_male':
      case 'gender_female':
      case 'gender_any': {
        try {
          let genderPreference;
          if (data === 'gender_male') genderPreference = 'Male';
          else if (data === 'gender_female') genderPreference = 'Female';
          else genderPreference = 'Any';
          await axios.post(`${API_BASE}/search-settings/${telegramId}`, { genderPreference });
          await bot.sendMessage(chatId, `✅Gender preference set to ${genderPreference}!`, {
            reply_markup: { inline_keyboard: [[{ text: 'ðŸ”™ Back to Search', callback_data: 'back_to_search' }]] },
            parse_mode: 'Markdown'
          });
        } catch (err) {
          console.error('Set gender preference error:', err.response?.data || err.message);
          bot.sendMessage(chatId, 'âŒ Failed to update gender preference. Please try again.');
        }
        break;
      }case 'premium_filters':
        bot.sendMessage(chatId, '💎 **PREMIUM FILTERS** 💎\n\n👑 VIP members get access to:\n\n• Education level filter\n• Profession filter\n• Interests matching\n• Verified profiles only\n• Recent activity filter\n\nUpgrade to VIP to unlock these features!', {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '👑 Get VIP', callback_data: 'manage_vip' }
              ],
              [
                { text: '🔙 Back to Settings', callback_data: 'back_to_search' }
              ]
            ]
          }
        });
        break;

      case 'set_location_pref':
        const locationMsg = `🌍 **LOCATION PREFERENCES** 🌍\n\n` +
          `📍 **Choose your preferred search area:**\n\n` +
          `• Current City - Search in your current location\n` +
          `• Nearby Cities - Include surrounding areas\n` +
          `• Specific City - Choose a different city\n` +
          `• Anywhere - No location restrictions`;

        bot.editMessageText(locationMsg, {
          chat_id: chatId,
          message_id: query.message.message_id,
          reply_markup: {
            inline_keyboard: [
              [
                { text: '📍 Current City', callback_data: 'location_current' },
                { text: '🏙️ Nearby Cities', callback_data: 'location_nearby' }
              ],
              [
                { text: '🌆 Specific City', callback_data: 'location_specific' },
                { text: '🌍 Anywhere', callback_data: 'location_anywhere' }
              ],
              [
                { text: '🔙 Back to Search', callback_data: 'back_to_search' }
              ]
            ]
          }
        });
        break;

      case 'location_current':
      case 'location_nearby':
      case 'location_specific':
      case 'location_anywhere':
        const locationType = data.replace('location_', '');
        let locationPreference;
        let locationText;

        switch (locationType) {
          case 'current':
            locationPreference = 'current_city';
            locationText = 'Current City';
            break;
          case 'nearby':
            locationPreference = 'nearby_cities';
            locationText = 'Nearby Cities';
            break;
          case 'specific':
            locationPreference = 'specific_city';
            locationText = 'Specific City';
            break;
          case 'anywhere':
            locationPreference = null;
            locationText = 'Anywhere';
            break;
        }

        try {
          await axios.post(`${API_BASE}/search-settings/${telegramId}`, {
            locationPreference
          });
          bot.sendMessage(chatId, `✅ Location preference updated to ${locationText}!`);
        } catch (err) {
          bot.sendMessage(chatId, '❌ Failed to update location preference. Please try again.');
        }
        break;

      case 'reset_search':
        try {
          await axios.delete(`${API_BASE}/search-settings/${telegramId}`);
          bot.sendMessage(chatId, '🔄 Search settings have been reset to defaults!\n\n• Age Range: 18-35 years\n• Max Distance: 50 km\n• Gender: Any\n• Location: Any');
        } catch (err) {
          console.error('Reset search error:', err.response?.data || err.message);
          bot.sendMessage(chatId, '❌ Failed to reset search settings. Please try again.');
        }
        break;

      case 'back_to_search':
        // Re-trigger the search command
        try {
          const res = await axios.get(`${API_BASE}/search-settings/${telegramId}`);
          const settings = res.data;

          const settingsMsg = `🔍 **SEARCH SETTINGS** 🔍\n\n` +
            `📊 **Current Preferences:**\n` +
            `• Age Range: ${settings.ageMin}-${settings.ageMax} years\n` +
            `• Max Distance: ${settings.maxDistance} km\n` +
            `• Gender: ${settings.genderPreference}\n` +
            `• Location: ${settings.locationPreference || 'Any'}\n\n` +
            `⚙️ **Customize your search to find better matches!**`;

          const opts = {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '👥 Age Range', callback_data: 'set_age_range' },
                  { text: '📍 Distance', callback_data: 'set_distance' }
                ],
                [
                  { text: '⚧️ Gender Preference', callback_data: 'set_gender_pref' },
                  { text: '🌍 Location', callback_data: 'set_location_pref' }
                ],
                [
                  { text: '💎 Premium Filters', callback_data: 'premium_filters' },
                  { text: '🔄 Reset Settings', callback_data: 'reset_search' }
                ]
              ]
            }
          };

          bot.sendMessage(chatId, settingsMsg, opts);
        } catch (err) {
          bot.sendMessage(chatId, '❌ Failed to load search settings.');
        }
        break;

      case 'extend_vip':
        bot.sendMessage(chatId, 'Choose a plan to extend your VIP membership:', {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '📅 Monthly', callback_data: 'vip_purchase_monthly' },
                { text: '📆 Yearly', callback_data: 'vip_purchase_yearly' }
              ],
              [{ text: '♾️ Lifetime', callback_data: 'vip_purchase_lifetime' }]
            ]
          }
        });
        break;

      case 'pass':
        // Continue showing next profile for browse command
        sendNextProfile(chatId, telegramId);
        break;

      case 'manage_vip':
        try {
          const vipRes = await axios.get(`${API_BASE}/vip/${telegramId}`);
          const vipData = vipRes.data;

          let vipMsg;
          let buttons;

          if (vipData.isVip) {
            const expiresAt = new Date(vipData.expiresAt).toLocaleDateString();
            const subscriptionType = vipData.subscriptionType.charAt(0).toUpperCase() + vipData.subscriptionType.slice(1);
            
            vipMsg = `👑 **VIP STATUS** 👑\n\n` +
              `✅ **You are VIP!**\n` +
              `📅 Expires: ${vipData.subscriptionType === 'lifetime' ? 'Never' : expiresAt}\n` +
              `\nYour Benefits:\n` +
              `🔄 Extra Swipes: ${vipData.benefits.extraSwipes}\n` +
              `🚫 Ad-Free Experience\n` +
              `⚡️ Priority Matching\n` +
              `👀 See Profile Viewers\n` +
              `💫 Special Profile Badge`;

            buttons = [
              [
                { text: '🔄 Extend VIP', callback_data: 'extend_vip' },
                { text: '📊 VIP Stats', callback_data: 'vip_stats' }
              ],
              [
                { text: '🎁 VIP Perks', callback_data: 'vip_perks' }
              ],
              [
                { text: '🔙 Back to Premium', callback_data: 'settings_premium' }
              ]
            ];
          } else {
            vipMsg = `👑 **GET VIP MEMBERSHIP** 👑\n\n` +
              `🚀 **Unlock Premium Features:**\n` +
              `• ❤️ Unlimited likes\n` +
              `• 👀 See who liked you\n` +
              `• 🔍 Advanced search filters\n` +
              `• ⭐ Priority profile visibility\n` +
              `• 🚫 No advertisements\n` +
              `• 🎁 Exclusive features\n\n` +
              `💎 **Available VIP Plans:**`;

            buttons = [
              [
                { text: '👑 1 Month VIP (2000 coins)', callback_data: 'vip_1month' },
                { text: '💎 3 Months VIP (5000 coins)', callback_data: 'vip_3months' }
              ],
              [
                { text: '🌟 6 Months VIP (8000 coins)', callback_data: 'vip_6months' },
                { text: '🔥 1 Year VIP (12000 coins)', callback_data: 'vip_1year' }
              ],
              [
                { text: '🪙 Buy Coins First', callback_data: 'buy_coins' }
              ],
              [
                { text: '🔙 Back to Premium', callback_data: 'settings_premium' }
              ]
            ];
          }

          // Try to edit first, if it fails, send new message
          try {
            bot.editMessageText(vipMsg, {
              chat_id: chatId,
              message_id: query.message.message_id,
              reply_markup: {
                inline_keyboard: buttons
              }
            });
          } catch (editErr) {
            bot.sendMessage(chatId, vipMsg, {
              reply_markup: {
                inline_keyboard: buttons
              }
            });
          }

        } catch (err) {
          bot.sendMessage(chatId, '❌ Failed to load VIP information. Please try again.');
        }
        break;

      case 'vip_1month':
      case 'vip_3months':
      case 'vip_6months':
      case 'vip_1year':
        const vipPlan = data.replace('vip_', '');
        let duration, cost;

        switch (vipPlan) {
          case '1month':
            duration = 30;
            cost = 2000;
            break;
          case '3months':
            duration = 90;
            cost = 5000;
            break;
          case '6months':
            duration = 180;
            cost = 8000;
            break;
          case '1year':
            duration = 365;
            cost = 12000;
            break;
        }

        try {
          const purchaseRes = await axios.post(`${API_BASE}/vip/purchase/${telegramId}`, {
            duration,
            cost
          });

          if (purchaseRes.data.success) {
            const expiresAt = new Date(purchaseRes.data.expiresAt);
            bot.sendMessage(chatId, `🎉 **VIP ACTIVATED!** 🎉\n\n` +
              `👑 Welcome to VIP membership!\n` +
              `⏰ Valid until: ${expiresAt.toLocaleDateString()}\n` +
              `💰 Cost: ${cost} coins\n\n` +
              `✨ **Your VIP benefits are now active:**\n` +
              `• Unlimited likes\n` +
              `• See who liked you\n` +
              `• Advanced filters\n` +
              `• Priority visibility\n\n` +
              `🚀 Start exploring with your new powers!`);
          } else {
            bot.sendMessage(chatId, `❌ **VIP Purchase Failed**\n\n${purchaseRes.data.message}\n\n💡 Try buying more coins first!`);
          }
        } catch (err) {
          bot.sendMessage(chatId, '❌ Failed to purchase VIP. Please try again or contact support.');
        }
        break;

      case 'vip_stats':
        try {
          const vipRes = await axios.get(`${API_BASE}/vip/${telegramId}`);
          const vipData = vipRes.data;

          if (!vipData.isVip) {
            bot.sendMessage(chatId, '❌ You need VIP membership to view stats.');
            return;
          }

          const expiresAt = new Date(vipData.vipDetails.expiresAt);
          const daysLeft = Math.max(0, Math.ceil((expiresAt - new Date()) / (1000 * 60 * 60 * 24)));
          const subscriptionType = vipData.vipDetails.subscriptionType || 'Unknown';
          
          const statsMsg = `📊 **VIP STATISTICS** 📊\n\n` +
            `👑 **Membership Type:** ${subscriptionType.charAt(0).toUpperCase() + subscriptionType.slice(1)}\n` +
            `⏰ **Expires:** ${expiresAt.toLocaleDateString()}\n` +
            `📅 **Days Remaining:** ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}\n` +
            `✨ **Status:** ${daysLeft > 0 ? 'Active' : 'Expired'}\n\n` +
            `🎯 **VIP Benefits Used:**\n` +
            `• Extra Swipes: ${vipData.vipDetails.benefits?.extraSwipes || 0}\n` +
            `• Ad-Free Experience: ✅\n` +
            `• Priority Matching: ✅\n` +
            `• See Profile Viewers: ✅\n` +
            `• Special VIP Badge: ✅`;

          const buttons = [
            [
              { text: '🔄 Extend VIP', callback_data: 'extend_vip' }
            ],
            [
              { text: '🔙 Back to VIP', callback_data: 'manage_vip' }
            ]
          ];

          bot.editMessageText(statsMsg, {
            chat_id: chatId,
            message_id: query.message.message_id,
            reply_markup: {
              inline_keyboard: buttons
            }
          });

        } catch (err) {
          console.error('VIP stats error:', err);
          bot.sendMessage(chatId, '❌ Failed to load VIP statistics. Please try again.');
        }
        break;

      case 'vip_perks':
        try {
          const vipRes = await axios.get(`${API_BASE}/vip/${telegramId}`);
          const vipData = vipRes.data;

          if (!vipData.isVip) {
            bot.sendMessage(chatId, '❌ You need VIP membership to view perks.');
            return;
          }

          const perksMsg = `🎁 **VIP EXCLUSIVE PERKS** 🎁\n\n` +
            `✨ **Active Benefits:**\n\n` +
            `❤️ **Unlimited Likes**\n` +
            `• Like as many profiles as you want\n` +
            `• No daily limits or restrictions\n\n` +
            `👀 **See Who Liked You**\n` +
            `• View all your admirers instantly\n` +
            `• Never miss a potential match\n\n` +
            `🔍 **Advanced Search Filters**\n` +
            `• Filter by interests, education, job\n` +
            `• Find your perfect match faster\n\n` +
            `⭐ **Priority Profile Visibility**\n` +
            `• Your profile appears first in searches\n` +
            `• Get 10x more profile views\n\n` +
            `🚫 **Ad-Free Experience**\n` +
            `• No interruptions while browsing\n` +
            `• Smooth, premium experience\n\n` +
            `👑 **VIP Badge**\n` +
            `• Stand out with exclusive VIP status\n` +
            `• Show you're serious about dating`;

          const buttons = [
            [
              { text: '📊 View Stats', callback_data: 'vip_stats' }
            ],
            [
              { text: '🔙 Back to VIP', callback_data: 'manage_vip' }
            ]
          ];

          bot.editMessageText(perksMsg, {
            chat_id: chatId,
            message_id: query.message.message_id,
            reply_markup: {
              inline_keyboard: buttons
            }
          });

        } catch (err) {
          console.error('VIP perks error:', err);
          bot.sendMessage(chatId, '❌ Failed to load VIP perks. Please try again.');
        }
        break;

      // Help menu handlers
      case 'view_profile':
        try {
          const profileRes = await axios.get(`${API_BASE}/profile/${telegramId}`);
          const user = profileRes.data;

          let profileMsg = `👤 **YOUR PROFILE** 👤\n\n`;
          profileMsg += `📝 **Basic Info:**\n`;
          profileMsg += `• Name: ${user.name}\n`;
          profileMsg += `• Age: ${user.age}\n`;
          profileMsg += `• Location: ${user.location || 'Not set'}\n\n`;
          
          if (user.bio) {
            profileMsg += `💭 **Bio:** ${user.bio}\n\n`;
          }
          
          profileMsg += `📸 **Photos:** ${user.photos?.length || 0} uploaded\n`;
          profileMsg += `💎 **Status:** ${user.isVip ? '👑 VIP Member' : 'Regular Member'}\n`;
          profileMsg += `🪙 **Coins:** ${user.coins || 0}`;

          bot.editMessageText(profileMsg, {
            chat_id: chatId,
            message_id: query.message.message_id,
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '✏️ Edit Profile', callback_data: 'settings_profile' },
                  { text: '📸 Add Photos', callback_data: 'manage_photos' }
                ],
                [
                  { text: '🔙 Back to Help', callback_data: 'show_help' }
                ]
              ]
            }
          });
        } catch (err) {
          bot.sendMessage(chatId, '❌ Failed to load your profile. Please try /register first.');
        }
        break;

      case 'browse_profiles':
        try {
          const browseRes = await axios.get(`${API_BASE}/browse/${telegramId}`);
          const profiles = browseRes.data;

          if (!profiles || profiles.length === 0) {
            bot.editMessageText(
              `🔍 **BROWSE PROFILES** 🔍\n\n` +
              `😔 No profiles available right now.\n\n` +
              `💡 **Tips:**\n` +
              `• Complete your profile first\n` +
              `• Adjust your search preferences\n` +
              `• Check back later for new users\n\n` +
              `🚀 **Get started:**`,
              {
                chat_id: chatId,
                message_id: query.message.message_id,
                reply_markup: {
                  inline_keyboard: [
                    [
                      { text: '👤 Complete Profile', callback_data: 'settings_profile' },
                      { text: '🔍 Search Settings', callback_data: 'settings_search' }
                    ],
                    [
                      { text: '🔙 Back to Help', callback_data: 'show_help' }
                    ]
                  ]
                }
              }
            );
          } else {
            // Start browsing with first profile
            sendNextProfile(chatId, telegramId);
          }
        } catch (err) {
          bot.sendMessage(chatId, '❌ Failed to load profiles. Please try again later.');
        }
        break;

      case 'main_settings':
        bot.editMessageText(
          `⚙️ **SETTINGS MENU** ⚙️\n\n` +
          `Customize your Kisu1bot experience!\n\n` +
          `👤 **Profile Settings**\n` +
          `• Edit your profile information\n` +
          `• Update photos and bio\n` +
          `• Privacy preferences\n\n` +
          `🔍 **Search Preferences**\n` +
          `• Age range and distance\n` +
          `• Gender preferences\n` +
          `• Location settings\n\n` +
          `💎 **Premium Features**\n` +
          `• VIP membership\n` +
          `• Coins and purchases\n` +
          `• Priority features\n\n` +
          `🔔 **Notifications**\n` +
          `• Match notifications\n` +
          `• Message alerts\n` +
          `• Activity updates`,
          {
            chat_id: chatId,
            message_id: query.message.message_id,
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '👤 Profile Settings', callback_data: 'settings_profile' },
                  { text: '🔍 Search Preferences', callback_data: 'settings_search' }
                ],
                [
                  { text: '💎 Premium Features', callback_data: 'settings_premium' },
                  { text: '🔔 Notifications', callback_data: 'settings_notifications' }
                ],
                [
                  { text: '🔒 Privacy & Safety', callback_data: 'settings_privacy' },
                  { text: '🛠️ Account Settings', callback_data: 'settings_account' }
                ],
                [
                  { text: '❓ Help & Support', callback_data: 'settings_help' }
                ]
              ]
            }
          }
        );
        break;

      case 'email_support':
        bot.sendMessage(chatId, `📧 **EMAIL SUPPORT** 📧\n\n` +
          `Send your support request to:\n` +
          `📮 **support@kisu1bot.com**\n\n` +
          `📋 **Please include:**\n` +
          `• Your Telegram username: @${query.from.username || 'N/A'}\n` +
          `• Your user ID: ${telegramId}\n` +
          `• Detailed description of your issue\n` +
          `• Screenshots if relevant\n\n` +
          `⏰ **Response time:** 24-48 hours\n\n` +
          `💡 **Tip:** Copy the email address above and paste it in your email app.`);
        break;


      case 'contact_support':
        const supportMsg = `📞 **CONTACT SUPPORT** 📞\n\n` +
          `Our support team is here to help!\n\n` +
          `🕐 **Support Hours:**\n` +
          `Monday - Friday: 9 AM - 6 PM UTC\n` +
          `Weekend: Limited support\n\n` +
          `📧 **Contact Methods:**\n` +
          `• Email: support@kisu1bot.com\n` +
          `• Response time: 24-48 hours\n\n` +
          `💬 **Common Issues:**\n` +
          `• Profile not showing up\n` +
          `• Payment/VIP problems\n` +
          `• Technical difficulties\n` +
          `• Account recovery\n` +
          `• Report violations\n\n` +
          `📋 **Before contacting:**\n` +
          `• Check /help for common solutions\n` +
          `• Include your Telegram username\n` +
          `• Describe the issue clearly`;

        const supportOpts = {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '📧 Email Support', callback_data: 'email_support' }
              ],
              [
                { text: '🚨 Report Issue', callback_data: 'report_user' },
                { text: '❓ FAQ/Help', callback_data: 'show_help' }
              ],
              [
                { text: '💬 Send Feedback', callback_data: 'send_feedback' }
              ]
            ]
          }
        };

        // Try to edit first, if it fails, send new message
        try {
          bot.editMessageText(supportMsg, {
            chat_id: chatId,
            message_id: query.message.message_id,
            reply_markup: supportOpts.reply_markup
          });
        } catch (editErr) {
          bot.sendMessage(chatId, supportMsg, supportOpts);
        }
        break;

      case 'send_feedback':
        bot.editMessageText(
          `💬 **SEND FEEDBACK** 💬\n\n` +
          `We value your opinion and suggestions!\n\n` +
          `📝 **Feedback Types:**\n` +
          `• Feature requests\n` +
          `• User experience improvements\n` +
          `• Bug reports\n` +
          `• General suggestions\n` +
          `• Compliments or complaints\n\n` +
          `📧 **Send feedback to:**\n` +
          `feedback@kisu1bot.com\n\n` +
          `💡 **Please include:**\n` +
          `• Your Telegram username\n` +
          `• Detailed description\n` +
          `• Screenshots if relevant\n\n` +
          `🙏 Thank you for helping us improve!`,
          {
            chat_id: chatId,
            message_id: query.message.message_id,
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '📧 Send Feedback', callback_data: 'email_feedback' }
                ],
                [
                  { text: '🔙 Back to Support', callback_data: 'contact_support' }
                ]
              ]
            }
          }
        );
        break;

      case 'email_feedback':
        bot.sendMessage(chatId, `📧 **SEND FEEDBACK** 📧\n\n` +
          `Share your thoughts with us:\n` +
          `📮 **feedback@kisu1bot.com**\n\n` +
          `📋 **We'd love to hear about:**\n` +
          `• Feature suggestions\n` +
          `• User experience improvements\n` +
          `• What you like about the app\n` +
          `• What could be better\n\n` +
          `📝 **Include your username:** @${query.from.username || 'N/A'}\n\n` +
          `🙏 **Thank you for helping us improve Kisu1bot!**`);
        break;

      case 'cancel_delete':
        bot.sendMessage(chatId, `✅ **Profile Deletion Cancelled** ✅\n\n` +
          `Your profile is safe and remains active.\n\n` +
          `💡 **Need help instead?**\n` +
          `• Use /help for guidance\n` +
          `• Contact support with /contact\n` +
          `• Adjust settings with /settings\n\n` +
          `Thank you for staying with Kisu1bot! 💕`);
        break;

      case 'deactivate_profile':
        try {
          const res = await axios.post(`${API_BASE}/users/deactivate/${telegramId}`);
          
          const deactivateMsg = `⏸️ **Profile Deactivated** ⏸️\n\n` +
            `Your profile has been temporarily deactivated.\n\n` +
            `📋 **What this means:**\n` +
            `• Your profile is hidden from other users\n` +
            `• You won't receive new matches\n` +
            `• Your data is safely stored\n` +
            `• You can reactivate anytime\n\n` +
            `🔄 **To reactivate:** Use /start when you're ready to return\n\n` +
            `💡 **Need help?** Contact support anytime with /contact`;

          bot.sendMessage(chatId, deactivateMsg, {
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
          const res = await axios.post(`${API_BASE}/users/reactivate/${telegramId}`);
          
          bot.sendMessage(chatId, `🎉 **Welcome Back!** 🎉\n\n` +
            `Your profile has been reactivated successfully!\n\n` +
            `✅ **You're back in action:**\n` +
            `• Your profile is visible again\n` +
            `• You can receive new matches\n` +
            `• All your data is restored\n\n` +
            `🚀 **Ready to continue?**\n` +
            `• Use /browse to find matches\n` +
            `• Update your profile with /profile\n` +
            `• Check your settings with /settings\n\n` +
            `Happy dating! 💕`);
        } catch (err) {
          console.error('Reactivate profile error:', err.response?.data || err.message);
          bot.sendMessage(chatId, '❌ Failed to reactivate your profile. Please try again later or contact support.');
        }
        break;

      case 'confirm_delete_profile':
        // Show final warning before permanent deletion
        const finalWarningMsg = `🚨 **FINAL WARNING** 🚨\n\n` +
          `⚠️ **THIS WILL PERMANENTLY DELETE YOUR PROFILE**\n\n` +
          `🗑️ **What will be deleted:**\n` +
          `• All your profile information\n` +
          `• All your photos\n` +
          `• All your matches and conversations\n` +
          `• Your VIP status and coins\n` +
          `• All your activity history\n\n` +
          `❌ **This action CANNOT be undone!**\n\n` +
          `💔 Are you absolutely sure you want to delete everything?`;

        const finalOpts = {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🗑️ Yes, Delete Everything', callback_data: 'final_confirm_delete' }
              ],
              [
                { text: '❌ Cancel - Keep My Account', callback_data: 'cancel_delete' }
              ]
            ]
          }
        };

        bot.sendMessage(chatId, finalWarningMsg, finalOpts);
        break;

      case 'final_confirm_delete':
        try {
          const res = await axios.delete(`${API_BASE}/users/delete/${telegramId}`);
          
          bot.sendMessage(chatId, `💔 **Profile Deleted** 💔\n\n` +
            `Your profile has been permanently deleted from Kisu1bot.\n\n` +
            `🙏 **Thank you for using Kisu1bot**\n\n` +
            `If you ever want to return:\n` +
            `• Use /start to create a new profile\n` +
            `• Contact us if you need help\n\n` +
            `We're sorry to see you go. Take care! 💕`);
        } catch (err) {
          console.error('Delete profile error:', err.response?.data || err.message);
          bot.sendMessage(chatId, '❌ Failed to delete your profile. Please contact support for assistance.');
        }
        break;

    }
  }
});

// LIKESYOU (VIP Only)
bot.onText(/\/likesyou/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;

  try {
    const res = await axios.get(`${API_BASE}/matches/${telegramId}`);
    const matches = res.data;

    if (!matches.length) {
      return bot.sendMessage(
        chatId, 
        '💔 No matches yet.\nUse /browse to start matching with people!'
      );
    }

    // Send a summary message
    const summaryMsg = `💕 Your Matches (${matches.length})\n` +
      'Here are the people you\'ve matched with:';
    await bot.sendMessage(chatId, summaryMsg);

    // Send each match with interaction buttons
    for (const match of matches) {
      const matchTime = new Date(match.matchedAt).toLocaleDateString();
      const lastMessageTime = match.lastMessage?.sentAt ? 
        new Date(match.lastMessage.sentAt).toLocaleString() : null;

      const matchMsg = [
        `👤 ${match.name || 'No name'} ${match.isVip ? '👑' : ''}`,
        `📍 ${match.location || 'Location not set'}`,
        `🎂 ${match.age || 'Age not set'} years old`,
        `📝 ${match.bio || 'No bio'}`,
        `\n🤝 Matched on: ${matchTime}`,
        lastMessageTime ? `\n💬 Last message: ${match.lastMessage.text}\n⏰ ${lastMessageTime}` : '',
        match.unreadCount ? `\n📫 ${match.unreadCount} unread messages` : ''
      ].join('\n');

      const opts = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '💬 Chat', callback_data: `chat_${match.userId}` },
              { text: '❌ Unmatch', callback_data: `unmatch_${match.userId}` }
            ]
          ]
        }
      };

      await bot.sendMessage(chatId, matchMsg, opts);
    }

    // Add a helpful tip at the end
    const tipMsg = '\n💡 Tip: Keep the conversation going! Active chats lead to better matches.';
    await bot.sendMessage(chatId, tipMsg);

  } catch (err) {
    bot.sendMessage(chatId, 'Failed to retrieve matches.');
  }
});

// Profile command
bot.onText(/\/profile/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;

  try {
    const res = await axios.get(`${API_BASE}/profile/${telegramId}`);
    const profile = res.data;
    const profileText = `Your Profile:\nName: ${profile.name || 'Not set'}\nAge: ${profile.age || 'Not set'}\nLocation: ${profile.location || 'Not set'}\nBio: ${profile.bio || 'Not set'}`;
    
    const opts = {
      reply_markup: {
        inline_keyboard: [[
          { text: '✏️ Edit Profile', callback_data: 'edit_profile' }
        ]]
      }
    };
    
    bot.sendMessage(chatId, profileText, opts);
  } catch (err) {
    bot.sendMessage(chatId, 'Failed to fetch profile.');
  }
});

// Profile editing commands
bot.onText(/\/setname (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;
  const name = match[1];

  try {
    await axios.post(`${API_BASE}/profile/update/${telegramId}`, {
      field: 'name',
      value: name
    });
    bot.sendMessage(chatId, `Name updated to: ${name}`);
  } catch (err) {
    bot.sendMessage(chatId, 'Failed to update name.');
  }
});

bot.onText(/\/setage (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;
  const age = parseInt(match[1]);

  if (isNaN(age) || age < 18 || age > 100) {
    return bot.sendMessage(chatId, 'Please enter a valid age between 18 and 100.');
  }

  try {
    await axios.post(`${API_BASE}/profile/update/${telegramId}`, {
      field: 'age',
      value: age
    });
    bot.sendMessage(chatId, `Age updated to: ${age}`);
  } catch (err) {
    bot.sendMessage(chatId, 'Failed to update age.');
  }
});

bot.onText(/\/setlocation (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;
  const location = match[1];

  try {
    await axios.post(`${API_BASE}/profile/update/${telegramId}`, {
      field: 'location',
      value: location
    });
    bot.sendMessage(chatId, `Location updated to: ${location}`);
  } catch (err) {
    bot.sendMessage(chatId, 'Failed to update location.');
  }
});

bot.onText(/\/setbio (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;
  const bio = match[1];

  if (bio.length > 300) {
    return bot.sendMessage(chatId, 'Bio must be 300 characters or less.');
  }

  try {
    await axios.post(`${API_BASE}/profile/update/${telegramId}`, {
      field: 'bio',
      value: bio
    });
    bot.sendMessage(chatId, `Bio updated successfully! Use /profile to view your profile.`);
  } catch (err) {
    bot.sendMessage(chatId, 'Failed to update bio.');
  }
});

// Likes You command
bot.onText(/\/likesyou/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;

  try {
    const res = await axios.get(`${API_BASE}/likes/${telegramId}`);
    const { likes, totalLikes, visibleLikes, hasHiddenLikes, isVip } = res.data;

    if (totalLikes === 0) {
      return bot.sendMessage(
        chatId,
        '💔 No one has liked your profile yet.\n' +
        'Use /browse to find more people!'
      );
    }

    // Send summary message
    let summaryMsg = `❤️ People Who Like You (${totalLikes})\n`;
    if (hasHiddenLikes) {
      summaryMsg += `\n👀 Showing ${visibleLikes} of ${totalLikes} likes` +
        '\n💫 Get VIP to see all likes!';
    }
    await bot.sendMessage(chatId, summaryMsg);

    // Send each visible like with interaction buttons
    for (const user of likes) {
      const likeMsg = [
        `👤 ${user.name || 'Anonymous'} ${user.isVip ? '👑' : ''}`,
        `📍 ${user.location || 'Location not set'}`,
        `🎂 ${user.age || 'Age not set'} years old`,
        `📝 ${user.bio || 'No bio'}`
      ].join('\n');

      const opts = {
        reply_markup: {
          inline_keyboard: [[
            { text: '❤️ Like Back', callback_data: `like_${user.telegramId}` },
            { text: '👎 Pass', callback_data: `pass_like_${user.telegramId}` }
          ]]
        }
      };

      await bot.sendMessage(chatId, likeMsg, opts);
    }

    // If there are hidden likes, show VIP promotion
    if (hasHiddenLikes && !isVip) {
      const hiddenCount = totalLikes - visibleLikes;
      const vipMsg = `🔒 ${hiddenCount} more ${hiddenCount === 1 ? 'person likes' : 'people like'} you!\n` +
        '👑 Get VIP to:\n' +
        '• See all likes\n' +
        '• Get priority matching\n' +
        '• And more benefits!';

      const vipOpts = {
        reply_markup: {
          inline_keyboard: [[
            { text: '⭐️ Get VIP', callback_data: 'manage_vip' }
          ]]
        }
      };

      await bot.sendMessage(chatId, vipMsg, vipOpts);
    }

  } catch (err) {
    bot.sendMessage(chatId, 'Failed to fetch likes.');
  }
});

// Search Settings command
bot.onText(/\/search/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;

  try {
    const res = await axios.get(`${API_BASE}/search-settings/${telegramId}`);
    const settings = res.data || {};

    const settingsMsg = `🔍 **SEARCH SETTINGS** 🔍\n\n` +
      `📊 **Current Preferences:**\n` +
      `• Age Range: ${settings.ageMin || 18}-${settings.ageMax || 99} years\n` +
      `• Max Distance: ${settings.maxDistance ? settings.maxDistance + ' km' : 'Unlimited'}\n` +
      `• Gender: ${settings.genderPreference || 'Any'}\n` +
      `• Location: ${settings.locationPreference || 'Any'}\n\n` +
      `⚙️ **Customize your search to find better matches!**`;

    const opts = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '👥 Gender Preference', callback_data: 'search_gender' },
            { text: '🎂 Age Range', callback_data: 'search_age' }
          ],
          [
            { text: '📍 Distance', callback_data: 'search_distance' },
            { text: '🌍 Location', callback_data: 'search_location' }
          ],
          [
            { text: '🔄 Reset All', callback_data: 'search_reset' },
            { text: '✅ Done', callback_data: 'search_done' }
          ]
        ]
      }
    };

    bot.sendMessage(chatId, settingsMsg, opts);
  } catch (err) {
    // If user doesn't have settings yet, create default ones
    const defaultMsg = `🔍 **SEARCH SETTINGS** 🔍\n\n` +
      `📊 **Default Preferences:**\n` +
      `• Age Range: 18-35 years\n` +
      `• Max Distance: 50 km\n` +
      `• Gender: Any\n` +
      `• Location: Any\n\n` +
      `⚙️ **Customize your search to find better matches!**`;

    const opts = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '👥 Gender Preference', callback_data: 'search_gender' },
            { text: '🎂 Age Range', callback_data: 'search_age' }
          ],
          [
            { text: '📍 Distance', callback_data: 'search_distance' },
            { text: '🌍 Location', callback_data: 'search_location' }
          ],
          [
            { text: '🔄 Reset All', callback_data: 'search_reset' },
            { text: '✅ Done', callback_data: 'search_done' }
          ]
        ]
      }
    };

    bot.sendMessage(chatId, defaultMsg, opts);
  }
});

// Gifts command
bot.onText(/\/gifts/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;

  try {
    const res = await axios.get(`${API_BASE}/gifts/${telegramId}`);
    const { sentGifts, receivedGifts, giftStats, coinBalance } = res.data;

    const giftsMsg = `🎁 **GIFT CENTER** 🎁\n\n` +
      `💰 Your Coins: ${coinBalance || 0}\n\n` +
      `📊 **Gift Statistics:**\n` +
      `• Gifts Sent: ${giftStats?.totalSent || 0}\n` +
      `• Gifts Received: ${giftStats?.totalReceived || 0}\n` +
      `• Favorite Gift: ${giftStats?.favoriteGift || 'None'}\n\n` +
      `Choose what you'd like to do:`;

    const opts = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🎁 Send Gift', callback_data: 'gifts_send' },
            { text: '📥 Received Gifts', callback_data: 'gifts_received' }
          ],
          [
            { text: '📤 Sent Gifts', callback_data: 'gifts_sent' },
            { text: '🛍️ Gift Shop', callback_data: 'gifts_shop' }
          ],
          [
            { text: '📊 Gift Analytics', callback_data: 'gifts_analytics' },
            { text: '❓ Gift Guide', callback_data: 'gifts_help' }
          ]
        ]
      }
    };

    bot.sendMessage(chatId, giftsMsg, opts);

  } catch (err) {
    console.error('[/gifts] Error:', err.response?.data || err.message);
    
    // Show default gifts menu if API fails
    const defaultMsg = `🎁 **GIFT CENTER** 🎁\n\n` +
      `Send virtual gifts to show someone you care!\n\n` +
      `Choose what you'd like to do:`;

    const opts = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🎁 Send Gift', callback_data: 'gifts_send' },
            { text: '🛍️ Gift Shop', callback_data: 'gifts_shop' }
          ],
          [
            { text: '💰 Buy Coins', callback_data: 'buy_coins' },
            { text: '❓ Gift Guide', callback_data: 'gifts_help' }
          ]
        ]
      }
    };

    bot.sendMessage(chatId, defaultMsg, opts);
  }
});

// Stories command
bot.onText(/\/stories/, async (msg) => {
  const chatId = msg.chat.id;
  const opts = {
    reply_markup: {
      inline_keyboard: [[
        { text: '📱 View Stories', callback_data: 'view_stories' },
        { text: '📤 Post Story', callback_data: 'post_story' }
      ]]
    }
  };
  bot.sendMessage(chatId, 'Stories Menu:', opts);
});

// Coins command
bot.onText(/\/coins/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;

  try {
    const res = await axios.get(`${API_BASE}/coins/${telegramId}`);
    const { coins, packages } = res.data;

    // Create the main balance message
    const balanceMsg = `💰 Your Coin Balance: ${coins} 🪙\n\n` +
      '🎁 Available Packages:';

    // Create package buttons
    const packageButtons = Object.entries(packages).map(([id, pack]) => ({
      text: `${pack.name} (${pack.coins + pack.bonus} coins)`,
      callback_data: `buy_coins_${id}`
    }));

    // Group buttons into pairs
    const buttonRows = packageButtons.reduce((rows, button, index) => {
      if (index % 2 === 0) {
        rows.push([button]);
      } else {
        rows[rows.length - 1].push(button);
      }
      return rows;
    }, []);

    // Add package details to the message
    const packagesMsg = Object.values(packages).map(pack => 
      `\n\n${pack.name}:` +
      `\n• ${pack.coins} coins` +
      (pack.bonus ? `\n• +${pack.bonus} bonus coins` : '') +
      `\n• $${pack.price}`
    ).join('');

    const opts = {
      reply_markup: {
        inline_keyboard: buttonRows
      }
    };

    // Send the complete message
    bot.sendMessage(
      chatId,
      balanceMsg + packagesMsg + '\n\n💡 Coins can be used for VIP membership, gifts, and other premium features!',
      opts
    );
  } catch (err) {
    bot.sendMessage(chatId, 'Failed to fetch coin balance.');
  }
});
// VIP command
bot.onText(/\/vip/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;
  try {
    const res = await axios.get(`${API_BASE}/vip/${telegramId}`);
    const { isVip, vipDetails, availablePlans } = res.data;

    if (isVip) {
      const expiryDate = new Date(vipDetails.expiresAt).toLocaleDateString();
      const subscriptionType = vipDetails.subscriptionType.charAt(0).toUpperCase() + vipDetails.subscriptionType.slice(1);
      
      const benefitsText = `👑 **VIP STATUS** 👑

✅ **You are VIP!**

📅 Expires: ${vipDetails.subscriptionType === 'lifetime' ? 'Never' : expiryDate}

Your Benefits:

🔄 Extra Swipes: ${vipDetails.benefits.extraSwipes}

🚫 Ad-Free Experience

⚡️ Priority Matching

👀 See Profile Viewers

💫 Special Profile Badge`;
      
      const opts = {
        reply_markup: {
          inline_keyboard: [
            [{ text: '👑 Extend VIP', callback_data: 'extend_vip' }],
            [{ text: '❌ Cancel VIP', callback_data: 'cancel_vip' }]
          ]
        }
      };

      bot.sendMessage(chatId, benefitsText, opts);
    } else {
      const plansText = Object.entries(availablePlans).map(([plan, details]) => {
        return `\n${plan.toUpperCase()} PLAN - ${details.price} coins
• ${details.duration} days
• ${details.benefits.extraSwipes} extra swipes
• Ad-free experience
• Priority matching
• See who viewed you
• Special badge`;
      }).join('\n');

      const opts = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📅 Monthly', callback_data: 'vip_purchase_monthly' },
              { text: '📆 Yearly', callback_data: 'vip_purchase_yearly' }
            ],
            [{ text: '♾️ Lifetime', callback_data: 'vip_purchase_lifetime' }]
          ]
        }
      };

      bot.sendMessage(chatId, `🌟 VIP MEMBERSHIP PLANS ${plansText}`, opts);
    }
  } catch (err) {
    bot.sendMessage(chatId, 'Failed to fetch VIP status.');
  }
});

// Priority command
bot.onText(/\/priority/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;

  try {
    const res = await axios.get(`${API_BASE}/priority/${telegramId}`);
    const { hasPriority, expiresAt, availablePlans } = res.data;

    let statusMsg = '';
    if (hasPriority) {
      const expiryDate = new Date(expiresAt).toLocaleString();
      statusMsg = `⚡️ You have Priority Status!\n\n` +
        `Your profile will be shown first until ${expiryDate}\n` +
        `Remaining coins: ${res.data.remainingCoins} 🪙`;
    } else {
      statusMsg = '🌟 Priority Status\n\n' +
        'Get your profile shown first to potential matches!\n' +
        'Benefits:\n' +
        '• Appear at the top of browse results\n' +
        '• Get more profile views\n' +
        '• Increase your match chances';
    }

    // Add available plans
    const plansMsg = '\n\n📋 Available Boost Plans:\n\n' +
      Object.values(availablePlans).map(plan =>
        `${plan.name}\n` +
        `• ${plan.description}\n` +
        `• ${plan.price} coins\n` +
        `• ${plan.duration} ${plan.duration === 1 ? 'day' : 'days'}`
      ).join('');

    // Create buttons for each plan
    const buttons = [
      [
        { text: '⚡️ Daily (200)', callback_data: 'priority_daily' },
        { text: '🚀 Weekly (1000)', callback_data: 'priority_weekly' }
      ],
      [
        { text: '🌟 Monthly (3000)', callback_data: 'priority_monthly' }
      ]
    ];

    const opts = {
      reply_markup: {
        inline_keyboard: buttons
      }
    };

    await bot.sendMessage(chatId, statusMsg + plansMsg, opts);

  } catch (err) {
    bot.sendMessage(chatId, 'Failed to fetch priority status.');
  }
});

// Handle photo uploads for stories
bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;
  
  // Check if user is in story posting mode
  if (userStates[telegramId] && userStates[telegramId].awaitingStory) {
    try {
      // Get the highest resolution photo
      const photo = msg.photo[msg.photo.length - 1];
      const fileId = photo.file_id;
      
      // Get file info from Telegram
      const file = await bot.getFile(fileId);
      const photoUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
      
      // Get caption if provided
      const caption = msg.caption || '';
      
      // Post story to backend
      const response = await axios.post(`${API_BASE}/stories/post/${telegramId}`, {
        mediaUrl: photoUrl,
        mediaType: 'photo',
        caption: caption,
        duration: 5 // 5 seconds for photos
      });
      
      // Clear user state
      delete userStates[telegramId];
      
      // Send success message
      const successMsg = `📸 **STORY POSTED!** 📸\n\n` +
        `✨ Your story is now live for 24 hours!\n\n` +
        `📊 **What's next?**\n` +
        `• Share more stories to boost visibility\n` +
        `• Check your story views and analytics\n` +
        `• View stories from other users\n` +
        `• Use /stories to manage your stories!`;
      
      await bot.sendMessage(chatId, successMsg, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📱 View My Stories', callback_data: 'my_stories' },
              { text: '👀 View Others', callback_data: 'view_stories' }
            ],
            [
              { text: '📊 Story Analytics', callback_data: 'story_stats' }
            ]
          ]
        },
        parse_mode: 'Markdown'
      });
      
    } catch (err) {
      console.error('Error posting story:', err);
      delete userStates[telegramId];
      bot.sendMessage(chatId, '❌ Failed to post your story. Please try again later.');
    }
  }
});

// Handle video uploads for stories
bot.on('video', async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;
  
  // Check if user is in story posting mode
  if (userStates[telegramId] && userStates[telegramId].awaitingStory) {
    try {
      const video = msg.video;
      const fileId = video.file_id;
      const duration = Math.min(video.duration || 15, 30); // Max 30 seconds
      
      // Get file info from Telegram
      const file = await bot.getFile(fileId);
      const videoUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
      
      // Get caption if provided
      const caption = msg.caption || '';
      
      // Post story to backend
      const response = await axios.post(`${API_BASE}/stories/post/${telegramId}`, {
        mediaUrl: videoUrl,
        mediaType: 'video',
        caption: caption,
        duration: duration
      });
      
      // Clear user state
      delete userStates[telegramId];
      
      // Send success message
      const successMsg = `🎥 **VIDEO STORY POSTED!** 🎥\n\n` +
        `✨ Your video story is now live for 24 hours!\n` +
        `⏱️ Duration: ${duration} seconds\n\n` +
        `📊 **What's next?**\n` +
        `• Share more stories to boost visibility\n` +
        `• Check your story views and analytics\n` +
        `• View stories from other users\n` +
        `• Use /stories to manage your stories!`;
      
      await bot.sendMessage(chatId, successMsg, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📱 View My Stories', callback_data: 'my_stories' },
              { text: '👀 View Others', callback_data: 'view_stories' }
            ],
            [
              { text: '📊 Story Analytics', callback_data: 'story_stats' }
            ]
          ]
        },
        parse_mode: 'Markdown'
      });
      
    } catch (err) {
      console.error('Error posting video story:', err);
      delete userStates[telegramId];
      bot.sendMessage(chatId, '❌ Failed to post your video story. Please try again later.');
    }
  }
});

// Callback query handlers
bot.on('callback_query', async (callbackQuery) => {
  const message = callbackQuery.message;
  const chatId = message.chat.id;
  const telegramId = callbackQuery.from.id;
  const data = callbackQuery.data;

  try {
    // Like/Pass/SuperLike handlers
    if (data.startsWith('like_')) {
      const targetId = data.split('_')[1];
      await axios.post(`${API_BASE}/like`, { telegramId, targetId });
      
      bot.editMessageReplyMarkup({}, {
        chat_id: chatId,
        message_id: message.message_id
      });
      
      bot.sendMessage(chatId, '❤️ You liked this profile! Use /browse to see more.');
      
    } else if (data.startsWith('pass_')) {
      const targetId = data.split('_')[1];
      await axios.post(`${API_BASE}/pass`, { telegramId, targetId });
      
      bot.editMessageReplyMarkup({}, {
        chat_id: chatId,
        message_id: message.message_id
      });
      
      bot.sendMessage(chatId, '👎 You passed on this profile. Use /browse to see more.');
      
    } else if (data.startsWith('superlike_')) {
      const targetId = data.split('_')[1];
      await axios.post(`${API_BASE}/superlike`, { telegramId, targetId });
      
      bot.editMessageReplyMarkup({}, {
        chat_id: chatId,
        message_id: message.message_id
      });
      
      bot.sendMessage(chatId, '⭐ You super liked this profile! They\'ll be notified.');
      
    } else if (data.startsWith('gift_')) {
      const targetId = data.split('_')[1];
      // Show comprehensive gift selection menu
      const giftOpts = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🌹 Rose (10 coins)', callback_data: `send_gift_rose_${targetId}` },
              { text: '💎 Diamond (50 coins)', callback_data: `send_gift_diamond_${targetId}` }
            ],
            [
              { text: '🎁 Gift Box (25 coins)', callback_data: `send_gift_box_${targetId}` },
              { text: '🍫 Chocolate (15 coins)', callback_data: `send_gift_chocolate_${targetId}` }
            ],
            [
              { text: '🌺 Bouquet (30 coins)', callback_data: `send_gift_bouquet_${targetId}` },
              { text: '⭐ Star (40 coins)', callback_data: `send_gift_star_${targetId}` }
            ],
            [
              { text: '❌ Cancel', callback_data: 'cancel_gift' }
            ]
          ]
        }
      };
      
      bot.sendMessage(chatId, '🎁 Choose a gift to send:', giftOpts);
      
    } else if (data.startsWith('send_gift_')) {
      const parts = data.split('_');
      const giftType = parts[2];
      const targetId = parts[3];
      
      try {
        const res = await axios.post(`${API_BASE}/gifts/send`, { 
          telegramId, 
          targetId, 
          giftType 
        });
        
        const giftInfo = res.data;
        const successMsg = `🎁 **Gift Sent Successfully!** 🎁\n\n` +
          `${giftInfo.giftEmoji} You sent a **${giftInfo.giftName}** to ${giftInfo.recipientName || 'someone special'}!\n\n` +
          `💰 Cost: ${giftInfo.cost} coins\n` +
          `💰 Remaining Balance: ${giftInfo.remainingBalance} coins\n\n` +
          `They'll be notified about your thoughtful gift! 💕`;
        
        const opts = {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🎁 Send Another Gift', callback_data: 'gifts_send' },
                { text: '💬 Start Conversation', callback_data: `message_${targetId}` }
              ],
              [
                { text: '🔙 Back to Gifts', callback_data: 'gifts_back' }
              ]
            ]
          }
        };
        
        bot.sendMessage(chatId, successMsg, opts);
        
      } catch (err) {
        console.error('Gift sending error:', err.response?.data || err.message);
        
        if (err.response?.status === 400) {
          const errorMsg = err.response.data.message || 'Failed to send gift';
          bot.sendMessage(chatId, `❌ ${errorMsg}`);
        } else if (err.response?.status === 402) {
          bot.sendMessage(chatId, '💰 Insufficient coins! Use /coins to purchase more coins.');
        } else {
          bot.sendMessage(chatId, '❌ Failed to send gift. Please try again later.');
        }
      }
      
    } else if (data === 'cancel_gift' || data === 'gifts_cancel') {
      bot.sendMessage(chatId, '❌ Gift sending cancelled.');
      
    } else if (data === 'buy_coins') {
      // Show coin packages
      const coinOpts = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Starter Pack (1000 coins - $4.99)', callback_data: 'buy_coins_starter' }
            ],
            [
              { text: 'Popular Pack (5500 coins - $19.99)', callback_data: 'buy_coins_popular' }
            ],
            [
              { text: 'Premium Pack (14000 coins - $39.99)', callback_data: 'buy_coins_premium' }
            ],
            [
              { text: 'Ultimate Pack (38000 coins - $79.99)', callback_data: 'buy_coins_ultimate' }
            ]
          ]
        }
      };
      
      bot.sendMessage(chatId, '💰 Choose a coin package:', coinOpts);
      
    } else if (data === 'search_gender') {
      const genderOpts = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '👨 Men', callback_data: 'set_gender_male' },
              { text: '👩 Women', callback_data: 'set_gender_female' }
            ],
            [
              { text: '🌈 Everyone', callback_data: 'set_gender_any' },
              { text: '❌ Cancel', callback_data: 'search_cancel' }
            ]
          ]
        }
      };
      bot.sendMessage(chatId, '👥 Who would you like to see?', genderOpts);
      
    } else if (data.startsWith('set_gender_')) {
      const gender = data.split('_')[2];
      await axios.post(`${API_BASE}/search-settings/${telegramId}`, { genderPreference: gender });
      bot.sendMessage(chatId, `✅ Gender preference updated to: ${gender === 'any' ? 'Everyone' : gender}`);
      
    } else if (data === 'search_age') {
      const ageOpts = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '18-25', callback_data: 'set_age_18_25' },
              { text: '26-35', callback_data: 'set_age_26_35' }
            ],
            [
              { text: '36-45', callback_data: 'set_age_36_45' },
              { text: '46+', callback_data: 'set_age_46_99' }
            ],
            [
              { text: '🌐 Any Age', callback_data: 'set_age_18_99' },
              { text: '❌ Cancel', callback_data: 'search_cancel' }
            ]
          ]
        }
      };
      bot.sendMessage(chatId, '🎂 Select age range:', ageOpts);
      
    } else if (data.startsWith('set_age_')) {
      const parts = data.split('_');
      const minAge = parseInt(parts[2]);
      const maxAge = parseInt(parts[3]);
      await axios.post(`${API_BASE}/search-settings/${telegramId}`, { minAge, maxAge });
      bot.sendMessage(chatId, `✅ Age range updated to: ${minAge}-${maxAge}`);
      
    } else if (data === 'search_distance') {
      const distanceOpts = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '5 km', callback_data: 'set_distance_5' },
              { text: '10 km', callback_data: 'set_distance_10' }
            ],
            [
              { text: '25 km', callback_data: 'set_distance_25' },
              { text: '50 km', callback_data: 'set_distance_50' }
            ],
            [
              { text: '🌍 Unlimited', callback_data: 'set_distance_unlimited' },
              { text: '❌ Cancel', callback_data: 'search_cancel' }
            ]
          ]
        }
      };
      bot.sendMessage(chatId, '📍 Select maximum distance:', distanceOpts);
      
    } else if (data.startsWith('set_distance_')) {
      const distance = data.split('_')[2];
      const maxDistance = distance === 'unlimited' ? null : parseInt(distance);
      await axios.post(`${API_BASE}/search-settings/${telegramId}`, { maxDistance });
      bot.sendMessage(chatId, `✅ Distance updated to: ${distance === 'unlimited' ? 'Unlimited' : distance + ' km'}`);
      
    } else if (data === 'search_location') {
      const locationOpts = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🏠 Current City', callback_data: 'set_location_current' },
              { text: '🌆 Nearby Cities', callback_data: 'set_location_nearby' }
            ],
            [
              { text: '🌍 Anywhere', callback_data: 'set_location_anywhere' },
              { text: '❌ Cancel', callback_data: 'search_cancel' }
            ]
          ]
        }
      };
      bot.sendMessage(chatId, '🌍 Choose your location preference:', locationOpts);
      
    } else if (data.startsWith('set_location_')) {
      const locationType = data.split('_')[2];
      let locationPreference;
      
      switch(locationType) {
        case 'current': locationPreference = 'Current City'; break;
        case 'nearby': locationPreference = 'Nearby Cities'; break;
        case 'anywhere': locationPreference = 'Anywhere'; break;
        default: locationPreference = 'Any';
      }
      
      await axios.post(`${API_BASE}/search-settings/${telegramId}`, { locationPreference });
      bot.sendMessage(chatId, `✅ Location preference updated to: ${locationPreference}`);
      
    } else if (data === 'search_reset') {
      await axios.delete(`${API_BASE}/search-settings/${telegramId}`);
      bot.sendMessage(chatId, '🔄 Search settings reset to default!');
      
    } else if (data === 'search_done' || data === 'search_cancel') {
      bot.sendMessage(chatId, '✅ Search settings updated!');
      
    } else if (data === 'gifts_send') {
      // Show recent matches to send gifts to
      try {
        const res = await axios.get(`${API_BASE}/matches/${telegramId}`);
        const matches = res.data;
        
        if (!matches.length) {
          return bot.sendMessage(chatId, '💔 You need matches to send gifts!\n\nUse /browse to find people and match with them first.');
        }
        
        let matchButtons = matches.slice(0, 5).map(match => ([
          { text: `🎁 ${match.name || 'Anonymous'}`, callback_data: `gift_to_${match.telegramId}` }
        ]));
        
        matchButtons.push([{ text: '❌ Cancel', callback_data: 'gifts_cancel' }]);
        
        bot.sendMessage(chatId, '👥 Choose someone to send a gift to:', {
          reply_markup: { inline_keyboard: matchButtons }
        });
        
      } catch (err) {
        bot.sendMessage(chatId, '❌ Failed to load your matches. Please try again later.');
      }
      
    } else if (data.startsWith('gift_to_')) {
      const targetId = data.split('_')[2];
      
      const giftOpts = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🌹 Rose (10 coins)', callback_data: `send_gift_rose_${targetId}` },
              { text: '💎 Diamond (50 coins)', callback_data: `send_gift_diamond_${targetId}` }
            ],
            [
              { text: '🎁 Gift Box (25 coins)', callback_data: `send_gift_box_${targetId}` },
              { text: '🍫 Chocolate (15 coins)', callback_data: `send_gift_chocolate_${targetId}` }
            ],
            [
              { text: '🌺 Bouquet (30 coins)', callback_data: `send_gift_bouquet_${targetId}` },
              { text: '⭐ Star (40 coins)', callback_data: `send_gift_star_${targetId}` }
            ],
            [
              { text: '❌ Cancel', callback_data: 'gifts_cancel' }
            ]
          ]
        }
      };
      
      bot.sendMessage(chatId, '🎁 Choose a gift to send:', giftOpts);
      
    } else if (data === 'gifts_shop') {
      const shopMsg = `🛍️ **GIFT SHOP** 🛍️\n\n` +
        `Available gifts and their meanings:\n\n` +
        `🌹 **Rose** (10 coins)\n` +
        `• Classic romantic gesture\n` +
        `• Shows interest and appreciation\n\n` +
        `💎 **Diamond** (50 coins)\n` +
        `• Premium luxury gift\n` +
        `• Shows serious romantic interest\n\n` +
        `🎁 **Gift Box** (25 coins)\n` +
        `• Mystery surprise gift\n` +
        `• Fun and playful gesture\n\n` +
        `🍫 **Chocolate** (15 coins)\n` +
        `• Sweet and thoughtful\n` +
        `• Perfect for new connections\n\n` +
        `🌺 **Bouquet** (30 coins)\n` +
        `• Beautiful flower arrangement\n` +
        `• Shows deep appreciation\n\n` +
        `⭐ **Star** (40 coins)\n` +
        `• You're a star gift\n` +
        `• Shows admiration and respect`;
      
      const shopOpts = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🎁 Send Gift', callback_data: 'gifts_send' },
              { text: '💰 Buy Coins', callback_data: 'buy_coins' }
            ],
            [
              { text: '🔙 Back to Gifts', callback_data: 'gifts_back' }
            ]
          ]
        }
      };
      
      bot.sendMessage(chatId, shopMsg, shopOpts);
      
    } else if (data === 'gifts_received') {
      try {
        const res = await axios.get(`${API_BASE}/gifts/received/${telegramId}`);
        const receivedGifts = res.data;
        
        console.log('Received gifts response:', receivedGifts); // Debug log
        
        // Handle different response formats
        const gifts = Array.isArray(receivedGifts) ? receivedGifts : (receivedGifts.gifts || []);
        
        if (!gifts || gifts.length === 0) {
          return bot.sendMessage(chatId, '📥 No gifts received yet.\n\nWhen someone sends you a gift, it will appear here!');
        }
        
        let giftsText = `📥 **RECEIVED GIFTS** 📥\n\n`;
        gifts.slice(0, 10).forEach((gift, index) => {
          const timeAgo = gift.sentAt ? new Date(gift.sentAt).toLocaleDateString() : 'Unknown';
          const giftEmoji = gift.giftEmoji || gift.emoji || '🎁';
          const giftName = gift.giftName || gift.name || gift.type || 'Gift';
          const senderName = gift.senderName || gift.sender?.name || gift.fromName || 'Anonymous';
          
          giftsText += `${giftEmoji} **${giftName}**\n`;
          giftsText += `From: ${senderName}\n`;
          giftsText += `Date: ${timeAgo}\n`;
          if (gift.message || gift.note) giftsText += `Message: "${gift.message || gift.note}"\n`;
          giftsText += `\n`;
        });
        
        const opts = {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '💌 Send Thank You', callback_data: 'gifts_thank_you' },
                { text: '🔙 Back to Gifts', callback_data: 'gifts_back' }
              ]
            ]
          }
        };
        
        bot.sendMessage(chatId, giftsText, opts);
        
      } catch (err) {
        console.error('Received gifts error:', err.response?.data || err.message);
        const errorMsg = err.response?.status === 404 ? 
          '📥 No gifts received yet.\n\nWhen someone sends you a gift, it will appear here!' :
          '❌ Failed to load received gifts. Please try again later.';
        bot.sendMessage(chatId, errorMsg);
      }
      
    } else if (data === 'gifts_sent') {
      try {
        const res = await axios.get(`${API_BASE}/gifts/sent/${telegramId}`);
        const sentGifts = res.data;
        
        if (!sentGifts.length) {
          return bot.sendMessage(chatId, '📤 No gifts sent yet.\n\nUse "🎁 Send Gift" to send your first gift!');
        }
        
        let giftsText = `📤 **SENT GIFTS** 📤\n\n`;
        sentGifts.slice(0, 10).forEach((gift, index) => {
          const timeAgo = new Date(gift.sentAt).toLocaleDateString();
          giftsText += `${gift.giftEmoji} **${gift.giftName}**\n`;
          giftsText += `To: ${gift.recipientName || 'Anonymous'}\n`;
          giftsText += `Date: ${timeAgo}\n`;
          giftsText += `Cost: ${gift.cost} coins\n\n`;
        });
        
        const opts = {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🎁 Send Another Gift', callback_data: 'gifts_send' },
                { text: '🔙 Back to Gifts', callback_data: 'gifts_back' }
              ]
            ]
          }
        };
        
        bot.sendMessage(chatId, giftsText, opts);
        
      } catch (err) {
        bot.sendMessage(chatId, '❌ Failed to load sent gifts. Please try again later.');
      }
      
    } else if (data === 'gifts_analytics') {
      try {
        console.log(`Fetching gift analytics for user: ${telegramId}`);
        const res = await axios.get(`${API_BASE}/gifts/analytics/${telegramId}`);
        console.log('Gift analytics API response status:', res.status);
        console.log('Gift analytics response data:', JSON.stringify(res.data, null, 2));
        
        const analytics = res.data;
        
        // Handle different response formats
        const stats = analytics.stats || analytics.data || analytics || {};
        
        console.log('Processed stats object:', JSON.stringify(stats, null, 2));
        
        // Create analytics message with more robust data handling
        const totalSent = parseInt(stats.totalSent || stats.sent || stats.giftsSent || 0);
        const totalReceived = parseInt(stats.totalReceived || stats.received || stats.giftsReceived || 0);
        const coinsSpent = parseInt(stats.coinsSpent || stats.totalSpent || stats.spent || 0);
        const mostSentGift = stats.mostSentGift || stats.favoriteGift || stats.topSent || 'None';
        const mostReceivedGift = stats.mostReceivedGift || stats.topReceived || stats.favoriteReceived || 'None';
        const monthSent = parseInt(stats.monthSent || stats.thisMonthSent || stats.currentMonthSent || 0);
        const monthReceived = parseInt(stats.monthReceived || stats.thisMonthReceived || stats.currentMonthReceived || 0);
        const responseRate = parseFloat(stats.responseRate || stats.response || 0).toFixed(1);
        const thankYouRate = parseFloat(stats.thankYouRate || stats.thankYou || stats.thanks || 0).toFixed(1);
        
        const analyticsMsg = `📊 **GIFT ANALYTICS** 📊\n\n` +
          `📈 **Your Gift Statistics:**\n` +
          `• Total Gifts Sent: ${totalSent}\n` +
          `• Total Gifts Received: ${totalReceived}\n` +
          `• Coins Spent on Gifts: ${coinsSpent}\n` +
          `• Most Popular Gift Sent: ${mostSentGift}\n` +
          `• Most Received Gift: ${mostReceivedGift}\n\n` +
          `🎯 **This Month:**\n` +
          `• Gifts Sent: ${monthSent}\n` +
          `• Gifts Received: ${monthReceived}\n\n` +
          `💝 **Gift Success Rate:**\n` +
          `• Response Rate: ${responseRate}%\n` +
          `• Thank You Rate: ${thankYouRate}%`;
        
        const opts = {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🎁 Send More Gifts', callback_data: 'gifts_send' },
                { text: '🔙 Back to Gifts', callback_data: 'gifts_back' }
              ]
            ]
          }
        };
        
        console.log('Sending analytics message to user');
        bot.sendMessage(chatId, analyticsMsg, opts);
        
      } catch (err) {
        console.error('Gift analytics error details:');
        console.error('Error status:', err.response?.status);
        console.error('Error data:', err.response?.data);
        console.error('Error message:', err.message);
        console.error('Full error:', err);
        
        // Try to get basic analytics from other endpoints if main analytics fails
        let fallbackAnalytics = null;
        try {
          console.log('Attempting to get fallback analytics from other endpoints...');
          
          // Try to get sent and received gifts to calculate basic stats
          const [sentRes, receivedRes] = await Promise.allSettled([
            axios.get(`${API_BASE}/gifts/sent/${telegramId}`),
            axios.get(`${API_BASE}/gifts/received/${telegramId}`)
          ]);
          
          const sentGifts = sentRes.status === 'fulfilled' ? (sentRes.value.data || []) : [];
          const receivedGifts = receivedRes.status === 'fulfilled' ? (receivedRes.value.data || []) : [];
          
          console.log('Fallback data - Sent gifts:', sentGifts.length, 'Received gifts:', receivedGifts.length);
          
          // Calculate basic statistics
          const totalSent = Array.isArray(sentGifts) ? sentGifts.length : 0;
          const totalReceived = Array.isArray(receivedGifts) ? receivedGifts.length : 0;
          const coinsSpent = Array.isArray(sentGifts) ? sentGifts.reduce((sum, gift) => sum + (gift.cost || 0), 0) : 0;
          
          // Get most popular gift sent
          const giftCounts = {};
          if (Array.isArray(sentGifts)) {
            sentGifts.forEach(gift => {
              const giftName = gift.giftName || gift.type || 'Unknown';
              giftCounts[giftName] = (giftCounts[giftName] || 0) + 1;
            });
          }
          const mostSentGift = Object.keys(giftCounts).length > 0 ? 
            Object.keys(giftCounts).reduce((a, b) => giftCounts[a] > giftCounts[b] ? a : b) : 'None';
          
          fallbackAnalytics = `📊 **GIFT ANALYTICS** 📊\n\n` +
            `📈 **Your Gift Statistics:**\n` +
            `• Total Gifts Sent: ${totalSent}\n` +
            `• Total Gifts Received: ${totalReceived}\n` +
            `• Coins Spent on Gifts: ${coinsSpent}\n` +
            `• Most Popular Gift Sent: ${mostSentGift}\n` +
            `• Most Received Gift: N/A\n\n` +
            `🎯 **This Month:**\n` +
            `• Gifts Sent: ${totalSent}\n` +
            `• Gifts Received: ${totalReceived}\n\n` +
            `💝 **Gift Success Rate:**\n` +
            `• Response Rate: N/A\n` +
            `• Thank You Rate: N/A\n\n` +
            `📝 *Analytics calculated from available data*`;
            
        } catch (fallbackErr) {
          console.error('Fallback analytics also failed:', fallbackErr.message);
        }
        
        // Use fallback analytics or default message
        const defaultAnalytics = fallbackAnalytics || (
          `📊 **GIFT ANALYTICS** 📊\n\n` +
          `📈 **Your Gift Statistics:**\n` +
          `• Total Gifts Sent: 0\n` +
          `• Total Gifts Received: 0\n` +
          `• Coins Spent on Gifts: 0\n` +
          `• Most Popular Gift Sent: None\n` +
          `• Most Received Gift: None\n\n` +
          `🎯 **This Month:**\n` +
          `• Gifts Sent: 0\n` +
          `• Gifts Received: 0\n\n` +
          `💝 **Gift Success Rate:**\n` +
          `• Response Rate: 0%\n` +
          `• Thank You Rate: 0%\n\n` +
          `Start sending gifts to build your analytics! 🎁`
        );
        
        const opts = {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🎁 Start Sending Gifts', callback_data: 'gifts_send' },
                { text: '🔙 Back to Gifts', callback_data: 'gifts_back' }
              ]
            ]
          }
        };
        
        bot.sendMessage(chatId, defaultAnalytics, opts);
      }
      
    } else if (data === 'gifts_help') {
      const helpMsg = `❓ **GIFT GUIDE** ❓\n\n` +
        `🎁 **How Gifts Work:**\n` +
        `• Send virtual gifts to show interest\n` +
        `• Each gift costs coins\n` +
        `• Recipients get notified immediately\n` +
        `• Gifts can lead to conversations\n\n` +
        `💡 **Gift Tips:**\n` +
        `• Start with simple gifts like roses\n` +
        `• Premium gifts show serious interest\n` +
        `• Add personal messages when possible\n` +
        `• Timing matters - send when they're active\n\n` +
        `🌟 **Best Practices:**\n` +
        `• Don't spam gifts to the same person\n` +
        `• Choose gifts that match your relationship\n` +
        `• Be genuine and thoughtful\n` +
        `• Respond to gifts you receive`;
      
      const opts = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🎁 Start Sending Gifts', callback_data: 'gifts_send' },
              { text: '🔙 Back to Gifts', callback_data: 'gifts_back' }
            ]
          ]
        }
      };
      
      bot.sendMessage(chatId, helpMsg, opts);
      
    } else if (data === 'gifts_back') {
      // Re-trigger the gifts command by simulating the command
      try {
        const res = await axios.get(`${API_BASE}/gifts/${telegramId}`);
        const { sentGifts, receivedGifts, giftStats, coinBalance } = res.data;

        const giftsMsg = `🎁 **GIFT CENTER** 🎁\n\n` +
          `💰 Your Coins: ${coinBalance || 0}\n\n` +
          `📊 **Gift Statistics:**\n` +
          `• Gifts Sent: ${giftStats?.totalSent || 0}\n` +
          `• Gifts Received: ${giftStats?.totalReceived || 0}\n` +
          `• Favorite Gift: ${giftStats?.favoriteGift || 'None'}\n\n` +
          `Choose what you'd like to do:`;

        const opts = {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🎁 Send Gift', callback_data: 'gifts_send' },
                { text: '📥 Received Gifts', callback_data: 'gifts_received' }
              ],
              [
                { text: '📤 Sent Gifts', callback_data: 'gifts_sent' },
                { text: '🛍️ Gift Shop', callback_data: 'gifts_shop' }
              ],
              [
                { text: '📊 Gift Analytics', callback_data: 'gifts_analytics' },
                { text: '❓ Gift Guide', callback_data: 'gifts_help' }
              ]
            ]
          }
        };

        bot.sendMessage(chatId, giftsMsg, opts);

      } catch (err) {
        // Show default gifts menu if API fails
        const defaultMsg = `🎁 **GIFT CENTER** 🎁\n\n` +
          `Send virtual gifts to show someone you care!\n\n` +
          `Choose what you'd like to do:`;

        const opts = {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🎁 Send Gift', callback_data: 'gifts_send' },
                { text: '🛍️ Gift Shop', callback_data: 'gifts_shop' }
              ],
              [
                { text: '💰 Buy Coins', callback_data: 'buy_coins' },
                { text: '❓ Gift Guide', callback_data: 'gifts_help' }
              ]
            ]
          }
        };

        bot.sendMessage(chatId, defaultMsg, opts);
      }
      
    } else if (data === 'gifts_cancel') {
      bot.sendMessage(chatId, '❌ Gift sending cancelled.');
      
    } else if (data === 'gifts_thank_you') {
      const thankYouMsg = `💌 **SEND THANK YOU** 💌\n\n` +
        `Show appreciation for the gifts you've received!\n\n` +
        `Choose how you'd like to thank your admirers:`;
      
      const opts = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '💕 Send Heart', callback_data: 'send_thank_heart' },
              { text: '🌹 Send Rose Back', callback_data: 'send_thank_rose' }
            ],
            [
              { text: '💬 Send Message', callback_data: 'send_thank_message' },
              { text: '🎁 Send Gift Back', callback_data: 'gifts_send' }
            ],
            [
              { text: '🔙 Back to Gifts', callback_data: 'gifts_back' }
            ]
          ]
        }
      };
      
      bot.sendMessage(chatId, thankYouMsg, opts);
      
    } else if (data.startsWith('send_thank_')) {
      const thankType = data.split('_')[2];
      let message = '';
      
      switch(thankType) {
        case 'heart':
          message = '💕 Thank you hearts sent to recent gift senders!';
          break;
        case 'rose':
          message = '🌹 Thank you roses sent to recent gift senders!';
          break;
        case 'message':
          message = '💬 Thank you messages sent to recent gift senders!';
          break;
        default:
          message = '💌 Thank you sent!';
      }
      
      try {
        await axios.post(`${API_BASE}/gifts/thank-you/${telegramId}`, { thankType });
        bot.sendMessage(chatId, message);
      } catch (err) {
        bot.sendMessage(chatId, '❌ Failed to send thank you. Please try again later.');
      }
      
    } else if (data.startsWith('message_')) {
      const targetId = data.split('_')[1];
      
      const messageMsg = `💬 **START CONVERSATION** 💬\n\n` +
        `Great! You can now start a conversation with this person.\n\n` +
        `💡 **Conversation Tips:**\n` +
        `• Be genuine and friendly\n` +
        `• Ask about their interests\n` +
        `• Reference the gift you sent\n` +
        `• Keep it light and fun\n\n` +
        `Use the messaging feature in your Telegram to send them a direct message!`;
      
      const opts = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🎁 Send Another Gift', callback_data: `gift_${targetId}` },
              { text: '👀 View Profile', callback_data: `profile_${targetId}` }
            ],
            [
              { text: '🔙 Back to Gifts', callback_data: 'gifts_back' }
            ]
          ]
        }
      };
      
      bot.sendMessage(chatId, messageMsg, opts);
      
    } else if (data === 'send_gift') {
      // Redirect to gifts_send for sending gifts
      // This is triggered from coin purchase success buttons
      try {
        const res = await axios.get(`${API_BASE}/matches/${telegramId}`);
        const matches = res.data;
        
        if (!matches.length) {
          return bot.sendMessage(chatId, '💔 You need matches to send gifts!\n\nUse /browse to find people and match with them first.');
        }
        
        let matchButtons = matches.slice(0, 5).map(match => ([
          { text: `🎁 ${match.name || 'Anonymous'}`, callback_data: `gift_to_${match.telegramId}` }
        ]));
        
        matchButtons.push([{ text: '❌ Cancel', callback_data: 'gifts_cancel' }]);
        
        bot.sendMessage(chatId, '👥 Choose someone to send a gift to:', {
          reply_markup: { inline_keyboard: matchButtons }
        });
        
      } catch (err) {
        bot.sendMessage(chatId, '❌ Failed to load your matches. Please try again later.');
      }
      
    } else if (data === 'priority_boost') {
      // Handle priority boost purchase
      try {
        const res = await axios.post(`${API_BASE}/priority/purchase/${telegramId}`);
        const boostInfo = res.data;
        
        const successMsg = `🚀 **PRIORITY BOOST ACTIVATED!** 🚀\n\n` +
          `⭐ Your profile will appear first in search results!\n` +
          `⏰ Duration: ${boostInfo.duration || '24 hours'}\n` +
          `💰 Cost: ${boostInfo.cost || 50} coins\n\n` +
          `Get ready for more profile views and matches! 🔥`;
        
        bot.sendMessage(chatId, successMsg);
      } catch (err) {
        if (err.response?.status === 402) {
          bot.sendMessage(chatId, '💰 Insufficient coins for priority boost! Use /coins to purchase more.');
        } else {
          bot.sendMessage(chatId, '❌ Failed to activate priority boost. Please try again later.');
        }
      }
      
    } else if (data === 'settings_search') {
      try {
        const res = await axios.get(`${API_BASE}/search-settings/${telegramId}`);
        const settings = res.data;

        const searchMsg = `🔍 **SEARCH PREFERENCES** 🔍\n\n` +
          `📊 **Current Settings:**\n` +
          `• Age Range: ${settings.ageMin || 18}-${settings.ageMax || 35} years\n` +
          `• Max Distance: ${settings.maxDistance || 50} km\n` +
          `• Gender: ${settings.genderPreference || 'Any'}\n` +
          `• Location: ${settings.locationPreference || 'Any'}\n\n` +
          `⚙️ **Customize your search to find better matches!**`;

        const opts = {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🎂 Age Range', callback_data: 'search_age' },
                { text: '📏 Distance', callback_data: 'search_distance' }
              ],
              [
                { text: '👥 Gender', callback_data: 'search_gender' },
                { text: '📍 Location', callback_data: 'search_location' }
              ],
              [
                { text: '🔄 Reset to Default', callback_data: 'search_reset' }
              ],
              [
                { text: '🔙 Back to Settings', callback_data: 'main_settings' }
              ]
            ]
          }
        };

        bot.sendMessage(chatId, searchMsg, opts);
      } catch (err) {
        console.error('Search settings error:', err.response?.data || err.message);
        bot.sendMessage(chatId, '❌ Failed to load search settings. Please try again later.');
      }
      
    } else if (data === 'settings_premium') {
      const premiumMsg = `💎 **PREMIUM FEATURES** 💎\n\n` +
        `Unlock the full potential of Kisu1bot!\n\n` +
        `👑 **VIP Membership**\n` +
        `• Unlimited swipes\n` +
        `• See who liked you\n` +
        `• Priority matching\n` +
        `• Ad-free experience\n\n` +
        `💰 **Coins & Purchases**\n` +
        `• Buy coins for premium features\n` +
        `• Send virtual gifts\n` +
        `• Boost your profile\n\n` +
        `Choose what you'd like to manage:`;

      const opts = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '👑 VIP Membership', callback_data: 'manage_vip' },
              { text: '💰 Buy Coins', callback_data: 'buy_coins' }
            ],
            [
              { text: '⚡️ Priority Boost', callback_data: 'priority_boost' },
              { text: '🎁 Gift Center', callback_data: 'gifts_back' }
            ],
            [
              { text: '🔙 Back to Settings', callback_data: 'main_settings' }
            ]
          ]
        }
      };

      bot.sendMessage(chatId, premiumMsg, opts);
      
    } else if (data === 'settings_notifications') {
      const notifMsg = `🔔 **NOTIFICATION SETTINGS** 🔔\n\n` +
        `Manage your notification preferences:\n\n` +
        `📱 **Push Notifications**\n` +
        `• New matches\n` +
        `• New messages\n` +
        `• Profile likes\n` +
        `• Gifts received\n\n` +
        `📧 **Email Notifications**\n` +
        `• Weekly match summary\n` +
        `• Special offers\n` +
        `• Account updates\n\n` +
        `⚙️ Customize your notification experience:`;

      const opts = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📱 Push Settings', callback_data: 'notif_push' },
              { text: '📧 Email Settings', callback_data: 'notif_email' }
            ],
            [
              { text: '🔕 Disable All', callback_data: 'notif_disable' },
              { text: '🔔 Enable All', callback_data: 'notif_enable' }
            ],
            [
              { text: '🔙 Back to Settings', callback_data: 'main_settings' }
            ]
          ]
        }
      };

      bot.sendMessage(chatId, notifMsg, opts);
      
    } else if (data === 'settings_privacy') {
      const privacyMsg = `🔒 **PRIVACY & SAFETY** 🔒\n\n` +
        `Control your privacy and safety settings:\n\n` +
        `👀 **Profile Visibility**\n` +
        `• Who can see your profile\n` +
        `• Show online status\n` +
        `• Hide from specific users\n\n` +
        `🛡️ **Safety Features**\n` +
        `• Block and report users\n` +
        `• Content filtering\n` +
        `• Photo verification\n\n` +
        `Manage your privacy preferences:`;

      const opts = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '👀 Visibility Settings', callback_data: 'privacy_visibility' },
              { text: '🚫 Blocked Users', callback_data: 'privacy_blocked' }
            ],
            [
              { text: '📸 Photo Privacy', callback_data: 'privacy_photos' },
              { text: '🛡️ Safety Center', callback_data: 'safety_center' }
            ],
            [
              { text: '🔙 Back to Settings', callback_data: 'main_settings' }
            ]
          ]
        }
      };

      bot.sendMessage(chatId, privacyMsg, opts);
      
    } else if (data === 'settings_account') {
      const accountMsg = `🛠️ **ACCOUNT SETTINGS** 🛠️\n\n` +
        `Manage your account and data:\n\n` +
        `📊 **Account Information**\n` +
        `• View account details\n` +
        `• Download your data\n` +
        `• Account statistics\n\n` +
        `⚠️ **Account Actions**\n` +
        `• Deactivate account\n` +
        `• Delete account\n` +
        `• Data export\n\n` +
        `Choose an account action:`;

      const opts = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📊 Account Info', callback_data: 'account_info' },
              { text: '📥 Download Data', callback_data: 'download_data' }
            ],
            [
              { text: '⏸️ Deactivate', callback_data: 'deactivate_account' },
              { text: '🗑️ Delete Account', callback_data: 'delete_account' }
            ],
            [
              { text: '🔙 Back to Settings', callback_data: 'main_settings' }
            ]
          ]
        }
      };

      bot.sendMessage(chatId, accountMsg, opts);
      
    } else if (data === 'settings_help') {
      const helpMsg = `❓ **HELP & SUPPORT** ❓\n\n` +
        `Get help and support for Kisu1bot:\n\n` +
        `📚 **Help Resources**\n` +
        `• User guide\n` +
        `• FAQ\n` +
        `• Video tutorials\n\n` +
        `💬 **Contact Support**\n` +
        `• Report issues\n` +
        `• Feature requests\n` +
        `• General inquiries\n\n` +
        `How can we help you?`;

      const opts = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📚 User Guide', callback_data: 'help_guide' },
              { text: '❓ FAQ', callback_data: 'help_faq' }
            ],
            [
              { text: '🐛 Report Bug', callback_data: 'report_bug' },
              { text: '💡 Feature Request', callback_data: 'feature_request' }
            ],
            [
              { text: '📞 Contact Support', callback_data: 'contact_support' },
              { text: '🔙 Back to Settings', callback_data: 'main_settings' }
            ]
          ]
        }
      };

      bot.sendMessage(chatId, helpMsg, opts);
      
    } else if (data === 'edit_name') {
      // Set user state for name editing
      userStates[telegramId] = { editing: 'name' };
      bot.sendMessage(chatId, '✏️ EDIT NAME\n\nPlease send your new name as a message.\n\n📝 It will update immediately after you send it.\n\n❌ Send /cancel to abort.');
      
    } else if (data === 'edit_age') {
      // Set user state for age editing
      userStates[telegramId] = { editing: 'age' };
      bot.sendMessage(chatId, '🎂 EDIT AGE\n\nPlease send your new age as a number between 18 and 99.\n\n❌ Send /cancel to abort.');
      
    } else if (data === 'edit_location') {
      // Set user state for location editing
      userStates[telegramId] = { editing: 'location' };
      bot.sendMessage(chatId, '📍 EDIT LOCATION\n\nPlease send your new location (e.g., Lagos, Nigeria).\n\n❌ Send /cancel to abort.');
      
    } else if (data === 'edit_bio') {
      // Set user state for bio editing
      userStates[telegramId] = { editing: 'bio' };
      bot.sendMessage(chatId, '📝 EDIT BIO\n\nPlease send your new bio/description (max ~300 chars).\n\n💡 Make it interesting and authentic!\n\n❌ Send /cancel to abort.');
      
    } else if (data === 'manage_photos') {
      const photoMsg = `📸 **MANAGE PHOTOS** 📸\n\n` +
        `Upload and manage your profile photos:\n\n` +
        `📱 **Photo Tips:**\n` +
        `• Use high-quality, clear photos\n` +
        `• Show your face clearly\n` +
        `• Include variety (close-up, full body, activities)\n` +
        `• Avoid group photos as main photo\n\n` +
        `📤 **To add photos:** Send them directly to this chat\n` +
        `🗑️ **To delete photos:** Use the buttons below`;

      try {
        const profileRes = await axios.get(`${API_BASE}/profile/${telegramId}`);
        const user = profileRes.data;
        const photos = user.photos || [];

        let photoButtons = [];
        if (photos.length > 0) {
          photoButtons = photos.map((photo, index) => ([
            { text: `🗑️ Delete Photo ${index + 1}`, callback_data: `delete_photo_${index}` }
          ]));
        }
        
        photoButtons.push([
          { text: '📸 Upload New Photo', callback_data: 'upload_photo' },
          { text: '🔙 Back to Profile', callback_data: 'settings_profile' }
        ]);

        const opts = {
          reply_markup: {
            inline_keyboard: photoButtons
          }
        };

        bot.sendMessage(chatId, photoMsg, opts);
      } catch (err) {
        bot.sendMessage(chatId, '❌ Failed to load photo management. Please try again later.');
      }
      
    } else if (data === 'upload_photo') {
      bot.sendMessage(chatId, '📸 **UPLOAD PHOTO** 📸\n\nSend me a photo to add to your profile!\n\n📱 Make sure it\'s a clear, high-quality image.\n\n❌ Send /cancel to abort.');
      
    } else if (data.startsWith('delete_photo_')) {
      const photoIndex = parseInt(data.split('_')[2]);
      
      try {
        await axios.delete(`${API_BASE}/profile/${telegramId}/photo/${photoIndex}`);
        bot.sendMessage(chatId, '✅ Photo deleted successfully!');
        
        // Refresh photo management
        setTimeout(() => {
          // Trigger manage_photos again
          bot.sendMessage(chatId, 'Photo management updated. Use /settings to manage more photos.');
        }, 1000);
        
      } catch (err) {
        bot.sendMessage(chatId, '❌ Failed to delete photo. Please try again later.');
      }
      
    } else if (data === 'account_info') {
      try {
        const profileRes = await axios.get(`${API_BASE}/profile/${telegramId}`);
        const user = profileRes.data;
        
        const joinDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown';
        const lastActive = user.lastActive ? new Date(user.lastActive).toLocaleDateString() : 'Unknown';
        
        const accountMsg = `📊 **ACCOUNT INFORMATION** 📊\n\n` +
          `👤 **Profile Details:**\n` +
          `• Name: ${user.name || 'Not set'}\n` +
          `• Age: ${user.age || 'Not set'}\n` +
          `• Location: ${user.location || 'Not set'}\n` +
          `• Member since: ${joinDate}\n` +
          `• Last active: ${lastActive}\n\n` +
          `📈 **Statistics:**\n` +
          `• Profile views: ${user.stats?.views || 0}\n` +
          `• Likes given: ${user.stats?.likesGiven || 0}\n` +
          `• Likes received: ${user.stats?.likesReceived || 0}\n` +
          `• Matches: ${user.stats?.matches || 0}\n\n` +
          `💰 **Account Status:**\n` +
          `• VIP Status: ${user.isVip ? '👑 Active' : '❌ Not Active'}\n` +
          `• Coin Balance: ${user.coinBalance || 0}\n` +
          `• Account Status: ${user.isActive ? '✅ Active' : '⏸️ Inactive'}`;

        const opts = {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '📥 Download Data', callback_data: 'download_data' },
                { text: '🔙 Back to Account', callback_data: 'settings_account' }
              ]
            ]
          }
        };

        bot.sendMessage(chatId, accountMsg, opts);
      } catch (err) {
        bot.sendMessage(chatId, '❌ Failed to load account information. Please try again later.');
      }
      
    } else if (data === 'download_data') {
      bot.sendMessage(chatId, '📥 **DATA DOWNLOAD** 📥\n\nYour data download request has been received.\n\n📧 We will send your complete data export to your registered email within 24 hours.\n\n📋 The export will include:\n• Profile information\n• Match history\n• Message history\n• Account statistics\n• Settings preferences');
      
    } else if (data === 'deactivate_account') {
      const deactivateMsg = `⏸️ **DEACTIVATE ACCOUNT** ⏸️\n\n` +
        `⚠️ **This will temporarily hide your profile:**\n` +
        `• Your profile won't appear in search\n` +
        `• You won't receive new matches\n` +
        `• Your data will be preserved\n` +
        `• You can reactivate anytime\n\n` +
        `🔄 **This is reversible** - you can reactivate later.\n\n` +
        `Are you sure you want to deactivate your account?`;

      const opts = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '⏸️ Yes, Deactivate', callback_data: 'confirm_deactivate' },
              { text: '❌ Cancel', callback_data: 'settings_account' }
            ]
          ]
        }
      };

      bot.sendMessage(chatId, deactivateMsg, opts);
      
    } else if (data === 'confirm_deactivate') {
      try {
        await axios.post(`${API_BASE}/users/deactivate/${telegramId}`);
        bot.sendMessage(chatId, '⏸️ **Account Deactivated** ⏸️\n\nYour account has been temporarily deactivated.\n\n🔄 To reactivate, simply use any bot command or send /start.\n\n💙 We hope to see you back soon!');
      } catch (err) {
        bot.sendMessage(chatId, '❌ Failed to deactivate account. Please try again later.');
      }
      
    } else if (data === 'delete_account') {
      const deleteMsg = `🗑️ **DELETE ACCOUNT** 🗑️\n\n` +
        `⚠️ **PERMANENT ACTION WARNING:**\n` +
        `• All your data will be permanently deleted\n` +
        `• Your matches and conversations will be lost\n` +
        `• Your photos and profile will be removed\n` +
        `• This action CANNOT be undone\n\n` +
        `💡 **Alternative:** Consider deactivating instead\n\n` +
        `❓ **Need help?** Contact support first\n\n` +
        `Are you absolutely sure you want to delete your account?`;

      const opts = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '⏸️ Deactivate Instead', callback_data: 'deactivate_account' },
              { text: '📞 Contact Support', callback_data: 'contact_support' }
            ],
            [
              { text: '🗑️ Yes, Delete Forever', callback_data: 'confirm_delete' },
              { text: '❌ Cancel', callback_data: 'settings_account' }
            ]
          ]
        }
      };

      bot.sendMessage(chatId, deleteMsg, opts);
      
    } else if (data === 'confirm_delete') {
      const finalWarningMsg = `🚨 **FINAL WARNING** 🚨\n\n` +
        `This is your last chance to cancel.\n\n` +
        `Clicking "DELETE NOW" will:\n` +
        `• Permanently delete ALL your data\n` +
        `• Remove your profile forever\n` +
        `• Delete all matches and messages\n` +
        `• This CANNOT be undone\n\n` +
        `Type "DELETE MY ACCOUNT" to confirm:`;

      const opts = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '❌ Cancel - Keep My Account', callback_data: 'settings_account' }
            ]
          ]
        }
      };

      bot.sendMessage(chatId, finalWarningMsg, opts);
      
    } else if (data === 'report_user') {
      // Set user state for user reporting
      userStates[telegramId] = { reporting: 'user' };
      
      const reportUserMsg = `👤 **REPORT USER** 👤\n\n` +
        `Help us maintain a safe community by reporting inappropriate behavior.\n\n` +
        `📝 **To report a user, please provide:**\n` +
        `• User's name or username\n` +
        `• Description of inappropriate behavior\n` +
        `• Screenshots (if available)\n` +
        `• When the incident occurred\n\n` +
        `⚠️ **Report Types:**\n` +
        `• Harassment or bullying\n` +
        `• Fake profile or catfishing\n` +
        `• Inappropriate messages/photos\n` +
        `• Spam or scam attempts\n` +
        `• Other violations\n\n` +
        `Send your detailed report as a message now.`;

      const opts = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📞 Contact Support Instead', callback_data: 'contact_support' },
              { text: '❌ Cancel', callback_data: 'cancel_report' }
            ]
          ]
        }
      };

      bot.sendMessage(chatId, reportUserMsg, opts);
      
    } else if (data === 'report_content') {
      // Set user state for content reporting
      userStates[telegramId] = { reporting: 'content' };
      
      const reportContentMsg = `💬 **REPORT INAPPROPRIATE CONTENT** 💬\n\n` +
        `Help us keep Kisu1bot safe by reporting inappropriate content.\n\n` +
        `📝 **Content to report:**\n` +
        `• Inappropriate photos or videos\n` +
        `• Offensive messages or stories\n` +
        `• Adult content in public areas\n` +
        `• Spam or promotional content\n` +
        `• Hate speech or discrimination\n\n` +
        `📋 **Please include:**\n` +
        `• Where you saw the content\n` +
        `• Description of the issue\n` +
        `• Screenshots if possible\n\n` +
        `Send your content report as a message now.`;

      const opts = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📞 Contact Support Instead', callback_data: 'contact_support' },
              { text: '❌ Cancel', callback_data: 'cancel_report' }
            ]
          ]
        }
      };

      bot.sendMessage(chatId, reportContentMsg, opts);
      
    } else if (data === 'cancel_report') {
      // Clear any reporting state
      delete userStates[telegramId];
      bot.sendMessage(chatId, '❌ Report cancelled. Thank you for helping keep our community safe!\n\nIf you need help with something else, use /help or /contact.');
      
    } else if (data === 'report_bug') {
      // Set user state for bug reporting
      userStates[telegramId] = { reporting: 'bug' };
      bot.sendMessage(chatId, '🐛 **REPORT BUG** 🐛\n\nPlease describe the bug you encountered:\n\n📝 Include:\n• What you were trying to do\n• What happened instead\n• Steps to reproduce\n• Any error messages\n\nSend your bug report as a message, and we\'ll investigate it promptly!\n\n❌ Send /cancel to abort.');
      
    } else if (data === 'feature_request') {
      // Set user state for feature request
      userStates[telegramId] = { reporting: 'feature' };
      bot.sendMessage(chatId, '💡 **FEATURE REQUEST** 💡\n\nWe love hearing your ideas!\n\n📝 Please describe:\n• The feature you\'d like to see\n• How it would help you\n• Any specific details or examples\n\nSend your feature request as a message!\n\n❌ Send /cancel to abort.');
      
    } else if (data === 'help_guide') {
      const guideMsg = `📚 **USER GUIDE** 📚\n\n` +
        `Learn how to use Kisu1bot effectively:\n\n` +
        `🚀 **Getting Started:**\n` +
        `1. Complete your profile with /register\n` +
        `2. Add photos with /photo\n` +
        `3. Set preferences with /settings\n` +
        `4. Start browsing with /browse\n\n` +
        `💫 **Key Features:**\n` +
        `• Browse profiles and like/pass\n` +
        `• Send gifts to show interest\n` +
        `• Use coins for premium features\n` +
        `• Get VIP for unlimited swipes\n\n` +
        `🎯 **Pro Tips:**\n` +
        `• Complete your profile for better matches\n` +
        `• Be authentic in your bio\n` +
        `• Use high-quality photos\n` +
        `• Stay active for better visibility`;

      const opts = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '❓ FAQ', callback_data: 'help_faq' },
              { text: '🔙 Back', callback_data: 'settings_help' }
            ]
          ]
        }
      };

      bot.sendMessage(chatId, guideMsg, opts);
      
    } else if (data === 'help_faq') {
      const faqMsg = `❓ **FREQUENTLY ASKED QUESTIONS** ❓\n\n` +
        `**Q: How do I get more matches?**\n` +
        `A: Complete your profile, add quality photos, and stay active!\n\n` +
        `**Q: What are coins used for?**\n` +
        `A: Coins unlock premium features like gifts, boosts, and VIP.\n\n` +
        `**Q: How does VIP work?**\n` +
        `A: VIP gives unlimited swipes, priority matching, and special features.\n\n` +
        `**Q: Can I change my location?**\n` +
        `A: Yes! Use /settings → Profile Settings → Edit Location.\n\n` +
        `**Q: How do I report inappropriate behavior?**\n` +
        `A: Use /report or contact support immediately.\n\n` +
        `**Q: Can I delete my account?**\n` +
        `A: Yes, but consider deactivating first. Go to Settings → Account.`;

      const opts = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📚 User Guide', callback_data: 'help_guide' },
              { text: '🔙 Back', callback_data: 'settings_help' }
            ]
          ]
        }
      };

      bot.sendMessage(chatId, faqMsg, opts);
      
    } else if (data === 'show_help') {
      // Redirect to main help command
      const helpMsg = `🤖 **KISU1BOT HELP GUIDE** 🤖\n\n` +
        `📋 **Main Commands:**\n` +
        `• /start - Welcome message\n` +
        `• /register - Create your dating profile\n` +
        `• /browse - Browse and like profiles\n` +
        `• /profile - View/edit your profile\n` +
        `• /settings - Access all settings\n\n` +
        `💬 **Social Features:**\n` +
        `• /stories - Post and view stories\n` +
        `• /gifts - Send gifts to matches\n` +
        `• /matches - View your matches\n\n` +
        `💎 **Premium Features:**\n` +
        `• /coins - Buy coins for premium features\n` +
        `• /vip - Get VIP membership benefits\n\n` +
        `🛠️ **Support Commands:**\n` +
        `• /help - Show this help guide\n` +
        `• /report - Report users or issues\n` +
        `• /contact - Contact support team\n` +
        `• /delete - Delete your profile\n\n` +
        `💡 **Tips:**\n` +
        `• Complete your profile for better matches\n` +
        `• Be respectful and genuine\n` +
        `• Use stories to show your personality\n` +
        `• VIP membership unlocks premium features`;

      const buttons = [
        [
          { text: '👤 My Profile', callback_data: 'view_profile' },
          { text: '🔍 Browse Profiles', callback_data: 'browse_profiles' }
        ],
        [
          { text: '⚙️ Settings', callback_data: 'main_settings' },
          { text: '💎 Get VIP', callback_data: 'manage_vip' }
        ],
        [
          { text: '📞 Contact Support', callback_data: 'contact_support' }
        ]
      ];

      bot.sendMessage(chatId, helpMsg, {
        reply_markup: {
          inline_keyboard: buttons
        }
      });
    }

    // Answer the callback query to remove loading state
    try {
      bot.answerCallbackQuery(callbackQuery.id);
    } catch (answerErr) {
      console.error('Failed to answer callback query:', answerErr.message);
    }

  } catch (err) {
    console.error('Callback query error:', err);
    try {
      bot.answerCallbackQuery(callbackQuery.id, { text: 'Error occurred. Please try again.' });
    } catch (answerErr) {
      console.error('Failed to answer callback query with error:', answerErr.message);
    }
  }
});

// In production (detect by Render's PORT or explicit NODE_ENV), start the API server and use webhook mode
if (isProduction) {
  console.log('Production mode: Starting API server and using webhook...');
  const { spawn } = require('child_process');
  
  // Start the API server on port 3000
  const server = spawn('node', ['server.js'], {
    stdio: 'inherit',
    cwd: __dirname,
    env: { ...process.env, PORT: '3000' }
  });

  // Start Express server for webhook on Render's port
  app.listen(PORT, () => {
    console.log(`Webhook server running on port ${PORT}`);
  });

  server.on('close', (code) => {
    console.log(`API server process exited with code ${code}`);
  });

  // Handle process termination gracefully
  process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    server.kill();
    process.exit();
  });
} else {
  // Development mode: start Express server for local testing
  app.listen(PORT, () => {
    console.log(`Bot server running on port ${PORT} (development mode)`);
  });
}




