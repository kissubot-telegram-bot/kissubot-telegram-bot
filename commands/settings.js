const axios = require('axios');
const { getCachedUserProfile } = require('./auth');

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

function setupSettingsCommands(bot) {
  // SETTINGS command
  bot.onText(/\/settings/, (msg) => {
    const chatId = msg.chat.id;
    const settingsMsg = `⚙️ **SETTINGS MENU** ⚙️\n\n` +
      `Customize your Kisu1bot experience!\n\n` +
      `👤 **Profile Settings**\n` +
      `• Edit your profile information\n` +
      `• Manage your photos\n` +
      `• Privacy controls\n\n` +
      `🔍 **Search Settings**\n` +
      `• Age range preferences\n` +
      `• Distance radius\n` +
      `• Advanced filters (VIP)\n\n` +
      `🔔 **Notification Settings**\n` +
      `• Match notifications\n` +
      `• Message alerts\n` +
      `• Like notifications\n\n` +
      `❓ **Help & Support**\n` +
      `• Contact support\n` +
      `• Report issues\n` +
      `• Account management`;

    const buttons = [
      [
        { text: '👤 Profile Settings', callback_data: 'settings_profile' },
        { text: '🔍 Search Settings', callback_data: 'settings_search' }
      ],
      [
        { text: '🔔 Notifications', callback_data: 'settings_notifications' },
        { text: '🔒 Privacy', callback_data: 'settings_privacy' }
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

  // SEARCH settings command
  bot.onText(/\/search/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    try {
      const user = await getCachedUserProfile(telegramId);
      const preferences = user.searchPreferences || {};

      const searchMsg = `🔍 **SEARCH SETTINGS** 🔍\n\n` +
        `📊 **Current Preferences:**\n` +
        `• **Age Range:** ${preferences.minAge || 18} - ${preferences.maxAge || 35}\n` +
        `• **Distance:** ${preferences.maxDistance || 50} km\n` +
        `• **Gender:** ${preferences.gender || 'All'}\n\n` +
        `⚙️ **Adjust your search preferences:**`;

      const opts = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🎂 Age Range', callback_data: 'set_age_range' },
              { text: '📍 Distance', callback_data: 'set_distance' }
            ],
            [
              { text: '👥 Gender Preference', callback_data: 'set_gender_pref' }
            ],
            [
              { text: '⭐ Advanced Filters (VIP)', callback_data: 'vip_filters' }
            ],
            [
              { text: '🔙 Back to Settings', callback_data: 'main_settings' }
            ]
          ]
        }
      };

      bot.sendMessage(chatId, searchMsg, opts);
    } catch (err) {
      bot.sendMessage(chatId, '❌ Failed to load search settings. Please try again.');
    }
  });
}

module.exports = { setupSettingsCommands };
