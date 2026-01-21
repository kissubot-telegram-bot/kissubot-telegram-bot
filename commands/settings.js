const axios = require('axios');
const { getCachedUserProfile } = require('./auth');

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

function setupSettingsCommands(bot) {
  // Callback query handlers
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const telegramId = query.from.id;
    const data = query.data;

    try {
      switch (data) {
        case 'main_settings':
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
          break;

        case 'settings_search':
        case 'back_to_search':
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
          break;

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

        // Age range selections
        case 'age_range_18_25':
        case 'age_range_26_35':
        case 'age_range_36_45':
        case 'age_range_46_55':
        case 'age_range_18_35':
        case 'age_range_25_45':
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
            await bot.sendMessage(chatId, `✅ Age range updated to ${ageMin}-${ageMax} years!`, {
              reply_markup: { inline_keyboard: [[{ text: '🔙 Back to Search', callback_data: 'back_to_search' }]] },
              parse_mode: 'Markdown'
            });
          } catch (err) {
            console.error('Set age range error:', err.response?.data || err.message);
            bot.sendMessage(chatId, '❌ Failed to update age range. Please try again.');
          }
          break;

        // Distance selections
        case 'distance_10':
        case 'distance_25':
        case 'distance_50':
        case 'distance_100':
        case 'distance_250':
        case 'distance_unlimited':
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
            await bot.sendMessage(chatId, `✅ Max distance updated to ${label}!`, {
              reply_markup: { inline_keyboard: [[{ text: '🔙 Back to Search', callback_data: 'back_to_search' }]] },
              parse_mode: 'Markdown'
            });
          } catch (err) {
            console.error('Set distance error:', err.response?.data || err.message);
            bot.sendMessage(chatId, '❌ Failed to update distance. Please try again.');
          }
          break;

        // Gender preference selections
        case 'gender_male':
        case 'gender_female':
        case 'gender_any':
          try {
            let genderPreference;
            if (data === 'gender_male') genderPreference = 'Male';
            else if (data === 'gender_female') genderPreference = 'Female';
            else genderPreference = 'Any';
            await axios.post(`${API_BASE}/search-settings/${telegramId}`, { genderPreference });
            await bot.sendMessage(chatId, `✅ Gender preference set to ${genderPreference}!`, {
              reply_markup: { inline_keyboard: [[{ text: '🔙 Back to Search', callback_data: 'back_to_search' }]] },
              parse_mode: 'Markdown'
            });
          } catch (err) {
            console.error('Set gender preference error:', err.response?.data || err.message);
            bot.sendMessage(chatId, '❌ Failed to update gender preference. Please try again.');
          }
          break;

        case 'settings_notifications':
          bot.sendMessage(chatId, '🔔 **NOTIFICATION SETTINGS** 🔔\n\nNotification features coming soon!\n\nYou\'ll be able to control:\n• Match notifications\n• Message alerts\n• Like notifications\n• Story updates');
          break;

        case 'settings_privacy':
          bot.sendMessage(chatId, '🔒 **PRIVACY SETTINGS** 🔒\n\nPrivacy features coming soon!\n\nYou\'ll be able to control:\n• Profile visibility\n• Last seen status\n• Story privacy\n• Block/unblock users');
          break;

        case 'settings_help':
          bot.sendMessage(chatId, '❓ **HELP & SUPPORT** ❓\n\nNeed assistance? Here are your options:\n\n• Use /help for command guide\n• Contact support: @support\n• Report bugs: /report\n• FAQ: /faq\n\nWe\'re here to help! 💙');
          break;

        case 'premium_filters':
        case 'vip_filters':
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
      }
    } catch (err) {
      console.error('Settings callback error:', err);
      bot.sendMessage(chatId, '❌ Something went wrong. Please try again.');
    }
  });
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
