// bot.js
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

const BOT_TOKEN = process.env.BOT_TOKEN;
const API_BASE = process.env.API_BASE;
// Bot configuration
const bot = new TelegramBot(BOT_TOKEN, {
  polling: {
    interval: 300, // Poll interval in milliseconds
    autoStart: true, // Start polling automatically
    params: {
      timeout: 10 // Long polling timeout in seconds
    }
  }
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

// Webhook setup (commented out for local development)
const PORT = process.env.PORT || 3001;
// app.post(`/bot${BOT_TOKEN}`, (req, res) => {
//   bot.processUpdate(req.body);
//   res.sendStatus(200);
// });

// Start webhook (commented out for local development)
// bot.setWebHook(`${process.env.RENDER_EXTERNAL_URL}/bot${BOT_TOKEN}`);

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

<<<<<<< HEAD
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
      { text: '📧 Email Support', url: 'mailto:support@kisu1bot.com' }
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

bot.onText(/\/register/, async (msg) => {
=======
// START
bot.onText(/\/start/, (msg) => {
>>>>>>> ff43d510c11cf0653eb0d2732ef93d481c60ec27
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `👋 Welcome to KissuBot!

<<<<<<< HEAD
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
=======
Meet new people, find love, or just have fun 💘
Use /profile to set up your profile and start browsing!`);
>>>>>>> ff43d510c11cf0653eb0d2732ef93d481c60ec27
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

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const telegramId = query.from.id;
  const data = query.data;

  if (data.startsWith('like_')) {
    const toId = data.split('_')[1];
    try {
      const res = await axios.post(${API_BASE}/like, {
        fromId: telegramId,
        toId,
      });

      if (res.data.matched) {
        bot.sendMessage(chatId, You matched with @${res.data.username || 'someone'}!);
      } else {
        bot.sendMessage(chatId, res.data.message || 'Liked!');
      }
    } catch (err) {
      bot.sendMessage(chatId, 'Error while liking.');
    }
  } else {
    switch(data) {
      case 'edit_profile':
        bot.sendMessage(chatId, 'To edit your profile, use these commands:\n/setname - Set your name\n/setage - Set your age\n/setlocation - Set your location\n/setbio - Set your bio');
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

<<<<<<< HEAD
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

      // Continue showing next profile for browse command
      if (data === 'pass') {
        sendNextProfile(chatId, telegramId);
      }

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

          bot.editMessageText(vipMsg, {
            chat_id: chatId,
            message_id: query.message.message_id,
            reply_markup: {
              inline_keyboard: buttons
            }
          });

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

      case 'settings_profile':
        try {
          const profileRes = await axios.get(`${API_BASE}/profile/${telegramId}`);
          const user = profileRes.data;

          const profileMsg = `👤 **PROFILE SETTINGS** 👤\n\n` +
            `📝 **Current Profile:**\n` +
            `• Name: ${user.name}\n` +
            `• Age: ${user.age}\n` +
            `• Location: ${user.location || 'Not set'}\n` +
            `• Bio: ${user.bio || 'Not set'}\n\n` +
            `📸 **Photos:** ${user.photos?.length || 0} uploaded\n\n` +
            `🔧 **What would you like to edit?**`;

          bot.editMessageText(profileMsg, {
            chat_id: chatId,
            message_id: query.message.message_id,
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '✏️ Edit Name', callback_data: 'edit_name' },
                  { text: '🎂 Edit Age', callback_data: 'edit_age' }
                ],
                [
                  { text: '📍 Edit Location', callback_data: 'edit_location' },
                  { text: '📝 Edit Bio', callback_data: 'edit_bio' }
                ],
                [
                  { text: '📸 Manage Photos', callback_data: 'manage_photos' }
                ],
                [
                  { text: '🔙 Back to Settings', callback_data: 'main_settings' }
                ]
              ]
            }
          });
        } catch (err) {
          bot.sendMessage(chatId, '❌ Failed to load profile settings.');
        }
        break;

      case 'settings_search':
        try {
          const profileRes = await axios.get(`${API_BASE}/profile/${telegramId}`);
          const user = profileRes.data;
          const prefs = user.preferences || {};

          const searchMsg = `🔍 **SEARCH PREFERENCES** 🔍\n\n` +
            `📊 **Current Settings:**\n` +
            `• Age Range: ${prefs.ageMin || 18} - ${prefs.ageMax || 35} years\n` +
            `• Max Distance: ${prefs.maxDistance || 50} km\n` +
            `• Gender: ${prefs.genderPreference || 'Any'}\n` +
            `• Location: ${prefs.locationPreference || 'Anywhere'}\n\n` +
            `🎯 **Customize your search to find better matches!**`;

          bot.editMessageText(searchMsg, {
            chat_id: chatId,
            message_id: query.message.message_id,
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '🎂 Age Range', callback_data: 'set_age_range' },
                  { text: '📏 Distance', callback_data: 'set_distance' }
                ],
                [
                  { text: '👥 Gender Preference', callback_data: 'set_gender_pref' },
                  { text: '📍 Location', callback_data: 'set_location_pref' }
                ],
                [
                  { text: '🔄 Reset to Default', callback_data: 'reset_preferences' }
                ],
                [
                  { text: '🔙 Back to Settings', callback_data: 'main_settings' }
                ]
              ]
            }
          });
        } catch (err) {
          bot.sendMessage(chatId, '❌ Failed to load search preferences.');
        }
        break;

      case 'contact_support':
        bot.editMessageText(
          `📞 **CONTACT SUPPORT** 📞\n\n` +
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
          `• Describe the issue clearly`,
          {
            chat_id: chatId,
            message_id: query.message.message_id,
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '📧 Email Support', url: 'mailto:support@kisu1bot.com' }
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
          }
        );
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
                  { text: '📧 Send Feedback', url: 'mailto:feedback@kisu1bot.com' }
                ],
                [
                  { text: '🔙 Back to Support', callback_data: 'contact_support' }
                ]
              ]
            }
          }
        );
        break;

    }
  }
});

bot.onText(/\/matches/, async (msg) => {
=======
  sendNextProfile(chatId, telegramId);
// LIKESYOU (VIP Only)
bot.onText(/\/likesyou/, (msg) => {
>>>>>>> ff43d510c11cf0653eb0d2732ef93d481c60ec27
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `🔐 This feature is for VIP users only!

<<<<<<< HEAD
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
            { text: '👥 Set Age Range', callback_data: 'set_age_range' },
            { text: '📍 Set Distance', callback_data: 'set_distance' }
          ],
          [
            { text: '⚧️ Gender Preference', callback_data: 'set_gender_pref' },
            { text: '🌍 Location Filter', callback_data: 'set_location_pref' }
          ],
          [
            { text: '💎 Premium Filters', callback_data: 'premium_filters' }
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
      
      const benefitsText = `
        👑 **VIP STATUS** 👑
        \n\n
        ✅ **You are VIP!**
        \n
        📅 Expires: ${vipDetails.subscriptionType === 'lifetime' ? 'Never' : expiryDate}
        \n
        Your Benefits:
        \n
        🔄 Extra Swipes: ${vipDetails.benefits.extraSwipes}
        \n
        🚫 Ad-Free Experience
        \n
        ⚡️ Priority Matching
        \n
        👀 See Profile Viewers
        \n
        💫 Special Profile Badge
      `;
      
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

app.listen(PORT, () => {
  console.log(`Bot server running on port ${PORT}`);
});
=======
Upgrade to VIP to see who already liked your profile 💖`);
});

// STORIES
bot.onText(/\/stories/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `📸 Stories feature coming soon!

You'll be able to watch anonymous photo stories and reply.`);
});

// GIFTS
bot.onText(/\/gifts/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `🎁 Send virtual gifts to impress someone special!

Feature in development... stay tuned!`);
});

// COINS
bot.onText(/\/coins/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `💰 You currently have 0 KissuCoins.

Earn more by staying active or upgrade to VIP for bonuses.`);
});

// VIP
bot.onText(/\/vip/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `🌟 VIP Features:

• See who liked you
• Appear first in searches
• Unlimited likes
• Access to hidden profiles
• Reply to stories

Upgrade coming soon! 💎`);
});

// PRIORITY
bot.onText(/\/priority/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `🚀 Boost your profile visibility!

Stay on top of everyone's search results.

Priority Boosts launching soon.`);
});

// SEARCH SETTINGS
bot.onText(/\/search_settings/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `🔍 Match Filters:

Currently showing all users.

Soon you'll be able to filter by:
• Age range
• Gender
• Location
• Interests`);
});

// SETTINGS
bot.onText(/\/settings/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `⚙️ Settings Menu:

Coming soon — you'll be able to:
• Change language
• Adjust notifications
• Privacy settings`);
});

// HELP
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `🆘 Help Menu:

Use the following commands:
• /start – Begin your journey
• /profile – Edit your profile
• /matches – View your matches
• /likesyou – VIP feature
• /vip – Learn about VIP
• /delete_profile – Remove your account
• /contact_support – Get help`);
});

// REPORT
bot.onText(/\/report/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `🚨 To report a user, send us their @username and issue.

Our team will take immediate action if needed.`);
});

// DELETE PROFILE
bot.onText(/\/delete_profile/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `⚠️ Are you sure you want to delete your profile?

Send /confirm_delete to proceed (this action is irreversible).`);
});

// CONTACT SUPPORT
bot.onText(/\/contact_support/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `💬 You can reach us at @KissuSupport

We’ll reply within 24 hours.`);
});







>>>>>>> ff43d510c11cf0653eb0d2732ef93d481c60ec27
