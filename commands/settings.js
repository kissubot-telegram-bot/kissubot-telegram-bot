const axios = require('axios');
const { getCachedUserProfile } = require('./auth');
const {
  MAIN_KEYBOARD, SETTINGS_KEYBOARD, SETTINGS_KB_BUTTONS,
  SEARCH_KEYBOARD, SEARCH_KB_BUTTONS
} = require('../keyboard');
const { searchCities, buildCityKeyboard, formatCityList } = require('./citySearch');

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

function sendSettingsMenu(bot, chatId) {
  bot.sendMessage(chatId,
    `⚙️ *Settings*\n\n` +
    `Customise your KissuBot experience!\n\n` +
    `👤 Profile Info — view & edit your details\n` +
    `🔍 Search Preferences — control who you see\n` +
    `🔔 Notifications — manage alerts\n` +
    `🔒 Privacy — control your visibility`,
    { parse_mode: 'Markdown', reply_markup: SETTINGS_KEYBOARD }
  );
}

async function sendSearchMenu(bot, chatId, telegramId, User) {
  try {
    // Fetch fresh data from database to ensure latest settings are shown
    const user = await User.findOne({ telegramId: String(telegramId) });
    if (!user) {
      return bot.sendMessage(chatId, '❌ User not found.');
    }
    
    const p = user.searchSettings || {};
    const ageMin = p.ageMin || 18;
    const ageMax = p.ageMax || 99;
    const locationPref = p.locationPreference || 'Nearby';
    const customLoc = p.customLocation;
    const locationDisplay = locationPref === 'Custom' && customLoc ? customLoc : locationPref;
    const gender = p.genderPreference || 'Any';
    const hideLiked = p.hideLiked === true;
    
    bot.sendMessage(chatId,
      `🔍 *Search Preferences*\n\n` +
      `🎂 *Age Range:* ${ageMin}–${ageMax}\n` +
      `📍 *Location:* ${locationDisplay}\n` +
      `👥 *Gender:* ${gender}\n` +
      `🚫 *Hide Already Liked:* ${hideLiked ? '✅ On' : '❌ Off'}\n\n` +
      `Tap a button to change a setting:`,
      { parse_mode: 'Markdown', reply_markup: SEARCH_KEYBOARD }
    );
  } catch (err) {
    console.error('[Settings] Error loading search menu:', err);
    bot.sendMessage(chatId, '❌ Failed to load search settings. Please try again.');
  }
}

function setupSettingsCommands(bot, userStates, User) {
  // Callback query handlers (kept for backward compatibility with inline flows)
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const telegramId = query.from.id;
    const data = query.data;

    try {
      switch (data) {
        case 'main_settings':
          sendSettingsMenu(bot, chatId);
          break;

        case 'settings_search':
        case 'back_to_search':
        case 'search_settings':
          await sendSearchMenu(bot, chatId, telegramId, User);
          break;

        case 'set_age_range':
          bot.sendMessage(chatId, '🎂 *Set Age Range*\n\nChoose your preferred age range:', {
            parse_mode: 'Markdown',
            reply_markup: {
              keyboard: [
                [{ text: '18–25' }, { text: '26–35' }],
                [{ text: '36–45' }, { text: '46–55' }],
                [{ text: '18–35' }, { text: '25–45' }],
                [{ text: '➡️ Any Age' }]
              ],
              resize_keyboard: true, one_time_keyboard: true
            }
          });
          userStates.set(telegramId, { settingPicker: 'age_range' });
          break;

        case 'set_distance':
          bot.sendMessage(chatId, '📍 *Set Distance*\n\nChoose maximum distance:', {
            parse_mode: 'Markdown',
            reply_markup: {
              keyboard: [
                [{ text: '10 km' }, { text: '25 km' }],
                [{ text: '50 km' }, { text: '100 km' }],
                [{ text: '250 km' }, { text: '🌍 Unlimited' }]
              ],
              resize_keyboard: true, one_time_keyboard: true
            }
          });
          userStates.set(telegramId, { settingPicker: 'distance' });
          break;

        case 'set_location':
          bot.sendMessage(chatId, '📍 *Set Location Preference*\n\nWhere would you like to find matches?', {
            parse_mode: 'Markdown',
            reply_markup: {
              keyboard: [
                [{ text: '🏙️ Same City' }],
                [{ text: '📍 Nearby' }],
                [{ text: '🌍 Anywhere' }],
                [{ text: '📝 Enter Specific Location' }]
              ],
              resize_keyboard: true, one_time_keyboard: true
            }
          });
          userStates.set(telegramId, { settingPicker: 'location' });
          break;

        case 'set_gender_pref':
          bot.sendMessage(chatId, '👥 *Gender Preference*\n\nWho would you like to see?', {
            parse_mode: 'Markdown',
            reply_markup: {
              keyboard: [
                [{ text: '👨 Men' }, { text: '👩 Women' }],
                [{ text: '👥 Everyone' }]
              ],
              resize_keyboard: true, one_time_keyboard: true
            }
          });
          userStates.set(telegramId, { settingPicker: 'gender' });
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
            const { invalidateUserCache } = require('./auth');
            await User.findOneAndUpdate(
              { telegramId: String(telegramId) },
              { $set: { 'searchSettings.ageMin': ageMin, 'searchSettings.ageMax': ageMax } }
            );
            invalidateUserCache(String(telegramId));
            await sendSearchMenu(bot, chatId, telegramId, User);
            await bot.sendMessage(chatId, `✅ *Age range set to ${ageMin}–${ageMax}.*`, { parse_mode: 'Markdown' });
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
            const { invalidateUserCache } = require('./auth');
            await User.findOneAndUpdate(
              { telegramId: String(telegramId) },
              { $set: { 'searchSettings.maxDistance': maxDistance } }
            );
            invalidateUserCache(String(telegramId));
            const label = data === 'distance_unlimited' ? 'Unlimited' : `${maxDistance} km`;
            await sendSearchMenu(bot, chatId, telegramId, User);
            await bot.sendMessage(chatId, `✅ *Distance set to ${label}.*`, { parse_mode: 'Markdown' });
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
            
            const lookingForValue = genderPreference === 'Any' ? 'Both' : genderPreference;
            console.log(`[SETTINGS] Updating gender preference for ${telegramId}:`, {
              genderPreference,
              lookingFor: lookingForValue
            });
            
            const { invalidateUserCache } = require('./auth');
            const result = await User.findOneAndUpdate(
              { telegramId: String(telegramId) },
              { $set: { 'searchSettings.genderPreference': genderPreference, lookingFor: lookingForValue } },
              { new: true }
            );
            
            console.log(`[SETTINGS] After update - lookingFor:`, result?.lookingFor, 'genderPreference:', result?.searchSettings?.genderPreference);
            
            invalidateUserCache(String(telegramId));
            await bot.sendMessage(chatId, `✅ *Gender preference set to ${genderPreference}.*`, { parse_mode: 'Markdown' });
            await sendSearchMenu(bot, chatId, telegramId, User);
          } catch (err) {
            console.error('Set gender preference error:', err.response?.data || err.message);
            bot.sendMessage(chatId, '❌ Failed to update gender preference. Please try again.');
          }
          break;

        case 'toggle_hide_liked': {
          try {
            const { invalidateUserCache } = require('./auth');
            const user = await User.findOne({ telegramId: String(telegramId) });
            const current = user?.searchSettings?.hideLiked !== false;
            await User.findOneAndUpdate(
              { telegramId: String(telegramId) },
              { $set: { 'searchSettings.hideLiked': !current } }
            );
            invalidateUserCache(String(telegramId));
            await bot.sendMessage(chatId,
              `✅ *Hide Already Liked* is now *${!current ? '✅ On' : '❌ Off'}*.
${!current ? 'Liked profiles won’t appear in browse.' : 'Liked profiles may appear again.'}`,
              { parse_mode: 'Markdown' }
            );
          } catch (err) {
            bot.sendMessage(chatId, '❌ Failed to update. Please try again.');
          }
          break;
        }

        case 'reset_seen_profiles': {
          try {
            const { invalidateUserCache } = require('./auth');
            const { browseProfiles } = require('./browsing');
            await User.findOneAndUpdate(
              { telegramId: String(telegramId) },
              { $set: { seenProfiles: [] } }
            );
            invalidateUserCache(String(telegramId));
            invalidateUserCache(telegramId);
            await bot.sendMessage(chatId,
              `🔄 *Browse history cleared!*\n\nLoading profiles for you now...`,
              { parse_mode: 'Markdown' }
            );
            await browseProfiles(chatId, telegramId, true);
          } catch (err) {
            console.error('[reset_seen_profiles] Error:', err);
            bot.sendMessage(chatId, '❌ Failed to reset. Please try again.');
          }
          break;
        }

        case 'settings_notifications':
          bot.sendMessage(chatId,
            `🔔 *Notifications*\n\nNotification controls are coming soon!\n\n_You'll be able to manage match alerts, message notifications, and more._`,
            { parse_mode: 'Markdown', reply_markup: SETTINGS_KEYBOARD }
          );
          break;

        case 'settings_privacy':
          bot.sendMessage(chatId,
            `🔒 *Privacy Settings*\n\nPrivacy controls are coming soon!\n\n_You'll be able to manage profile visibility, last seen, and blocked users._`,
            { parse_mode: 'Markdown', reply_markup: SETTINGS_KEYBOARD }
          );
          break;

        case 'settings_help':
          bot.sendMessage(chatId, '🤖 Loading Help Center...', { reply_markup: { remove_keyboard: true } });
          break;

        case 'premium_filters':
        case 'vip_filters':
          bot.sendMessage(chatId,
            `💎 *VIP Filters*\n\n👑 Upgrade to unlock:\n• Education filter\n• Profession filter\n• Verified profiles only\n• Recent activity filter`,
            { parse_mode: 'Markdown', reply_markup: SETTINGS_KEYBOARD }
          );
          break;

        case 'set_location_pref':
          bot.sendMessage(chatId, `🌍 *Location Preferences*\n\nChoose your preferred search area:`, {
            parse_mode: 'Markdown',
            reply_markup: {
              keyboard: [
                [{ text: '📍 Current City' }, { text: '🏙️ Nearby Cities' }],
                [{ text: '🌆 Specific City' }, { text: '🌍 Anywhere' }],
                [{ text: '🔙 Back to Search' }]
              ],
              resize_keyboard: true, one_time_keyboard: true
            }
          });
          userStates.set(telegramId, { settingPicker: 'location' });
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
  bot.onText(/\/settings/, (msg) => sendSettingsMenu(bot, msg.chat.id));

  // SEARCH settings command
  bot.onText(/\/(search|searchsettings)/, (msg) => sendSearchMenu(bot, msg.chat.id, msg.from.id, User));

  // ── Settings Reply Keyboard handler ──────────────────────────────────
  bot.on('message', async (msg) => {
    const text = msg.text;
    if (!text || !SETTINGS_KB_BUTTONS.includes(text)) return;
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    switch (text) {
      case '👤 Profile Info':
        bot.processUpdate({
          update_id: 0,
          message: {
            message_id: msg.message_id || 0, from: msg.from, chat: msg.chat,
            date: msg.date || Math.floor(Date.now() / 1000),
            text: '/profile',
            entities: [{ offset: 0, length: 8, type: 'bot_command' }]
          }
        });
        break;

      case '🔍 Search Preferences':
        await sendSearchMenu(bot, chatId, telegramId, User);
        break;

      case '🔔 Notifications':
        bot.sendMessage(chatId,
          `🔔 *Notifications*\n\nControls are coming soon! You’ll be able to manage:\n• Match alerts • Message notifications • Like alerts`,
          { parse_mode: 'Markdown', reply_markup: SETTINGS_KEYBOARD }
        );
        break;

      case '🔒 Privacy':
        bot.sendMessage(chatId,
          `🔒 *Privacy Settings*\n\nComing soon! You’ll control:\n• Profile visibility • Last seen status • Blocked users`,
          { parse_mode: 'Markdown', reply_markup: SETTINGS_KEYBOARD }
        );
        break;

      case '❓ Help Center':
        bot.processUpdate({
          update_id: 0,
          message: {
            message_id: msg.message_id || 0, from: msg.from, chat: msg.chat,
            date: msg.date || Math.floor(Date.now() / 1000),
            text: '/help',
            entities: [{ offset: 0, length: 5, type: 'bot_command' }]
          }
        });
        break;
    }
  });

  // ── Search Settings Reply Keyboard handler ───────────────────────────
  bot.on('message', async (msg) => {
    const text = msg.text;
    if (!text || !SEARCH_KB_BUTTONS.includes(text)) return;
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    if (text === '⚙️ Back to Settings') {
      return sendSettingsMenu(bot, chatId);
    }

    switch (text) {
      case '🎂 Age Range':
        return bot.sendMessage(chatId, '🎂 *Set Age Range*\n\nChoose your preferred age range:', {
          parse_mode: 'Markdown',
          reply_markup: {
            keyboard: [
              [{ text: '18–25' }, { text: '26–35' }],
              [{ text: '36–45' }, { text: '46–55' }],
              [{ text: '18–35' }, { text: '25–45' }],
              [{ text: '➡️ Any Age' }]
            ],
            resize_keyboard: true, one_time_keyboard: true
          }
        }).then(() => userStates.set(telegramId, { settingPicker: 'age_range' }));

      case '📍 Distance':
        return bot.sendMessage(chatId, '📍 *Set Distance*\n\nChoose maximum match distance:', {
          parse_mode: 'Markdown',
          reply_markup: {
            keyboard: [
              [{ text: '10 km' }, { text: '25 km' }],
              [{ text: '50 km' }, { text: '100 km' }],
              [{ text: '250 km' }, { text: '🌍 Unlimited' }]
            ],
            resize_keyboard: true, one_time_keyboard: true
          }
        }).then(() => userStates.set(telegramId, { settingPicker: 'distance' }));

      case '👥 Gender Preference':
        return bot.sendMessage(chatId, '👥 *Gender Preference*\n\nWho would you like to see?', {
          parse_mode: 'Markdown',
          reply_markup: {
            keyboard: [
              [{ text: '👨 Men' }, { text: '👩 Women' }],
              [{ text: '👥 Everyone' }]
            ],
            resize_keyboard: true, one_time_keyboard: true
          }
        }).then(() => userStates.set(telegramId, { settingPicker: 'gender' }));

      case '🚫 Toggle Hide Liked':
        try {
          const { invalidateUserCache } = require('./auth');
          const user = await User.findOne({ telegramId: String(telegramId) });
          const current = user?.searchSettings?.hideLiked !== false;
          await User.findOneAndUpdate(
            { telegramId: String(telegramId) },
            { $set: { 'searchSettings.hideLiked': !current } }
          );
          invalidateUserCache(String(telegramId));
          await bot.sendMessage(chatId,
            `✅ *Hide Already Liked* is now *${!current ? '✅ On' : '❌ Off'}*.`,
            { parse_mode: 'Markdown' }
          );
          return sendSearchMenu(bot, chatId, telegramId, User);
        } catch (err) {
          bot.sendMessage(chatId, '❌ Failed to update. Please try again.');
        }
        break;

      case '🔄 Reset Browse History':
        try {
          const { invalidateUserCache } = require('./auth');
          const { browseProfiles } = require('./browsing');
          await User.findOneAndUpdate({ telegramId: String(telegramId) }, { $set: { seenProfiles: [] } });
          invalidateUserCache(String(telegramId));
          await bot.sendMessage(chatId, `🔄 *Browse history cleared!* Loading fresh profiles...`, { parse_mode: 'Markdown' });
          await browseProfiles(chatId, telegramId, true);
        } catch (err) {
          bot.sendMessage(chatId, '❌ Failed to reset. Please try again.');
        }
        break;
    }
  });

  // ── Settings picker handler (age range, distance, gender selection) ─────
  bot.on('message', async (msg) => {
    const text = msg.text;
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    if (!text) return;
    const state = userStates.get(telegramId);
    if (!state || !state.settingPicker) return;
    const picker = state.settingPicker;
    userStates.delete(telegramId);
    const { invalidateUserCache } = require('./auth');

    try {
      if (picker === 'age_range') {
        const rangeMap = { '18–25': [18,25], '26–35': [26,35], '36–45': [36,45], '46–55': [46,55], '18–35': [18,35], '25–45': [25,45], '➡️ Any Age': [18,99] };
        const range = rangeMap[text];
        if (!range) return;
        await User.findOneAndUpdate({ telegramId: String(telegramId) }, { $set: { 'searchSettings.ageMin': range[0], 'searchSettings.ageMax': range[1] } });
        invalidateUserCache(String(telegramId));
        await bot.sendMessage(chatId, `✅ *Age range set to ${range[0]}–${range[1]}.*`, { parse_mode: 'Markdown' });
        return sendSearchMenu(bot, chatId, telegramId, User);
      }
      if (picker === 'distance') {
        const distMap = { '10 km': 10, '25 km': 25, '50 km': 50, '100 km': 100, '250 km': 250, '🌍 Unlimited': 100000 };
        const dist = distMap[text];
        if (!dist) return;
        await User.findOneAndUpdate({ telegramId: String(telegramId) }, { $set: { 'searchSettings.maxDistance': dist } });
        invalidateUserCache(String(telegramId));
        const label = dist >= 100000 ? 'Unlimited' : `${dist} km`;
        await bot.sendMessage(chatId, `✅ *Distance set to ${label}.*`, { parse_mode: 'Markdown' });
        return sendSearchMenu(bot, chatId, telegramId, User);
      }
      if (picker === 'gender') {
        const genderMap = { '👨 Men': 'Male', '👩 Women': 'Female', '👥 Everyone': 'Any' };
        const gender = genderMap[text];
        if (!gender) return;
        
        const lookingForValue = gender === 'Any' ? 'Both' : gender;
        console.log(`[SETTINGS KB] Updating gender preference for ${telegramId}:`, {
          genderPreference: gender,
          lookingFor: lookingForValue
        });
        
        const result = await User.findOneAndUpdate(
          { telegramId: String(telegramId) }, 
          { $set: { 'searchSettings.genderPreference': gender, lookingFor: lookingForValue } },
          { new: true }
        );
        
        console.log(`[SETTINGS KB] After update - lookingFor:`, result?.lookingFor, 'genderPreference:', result?.searchSettings?.genderPreference);
        
        invalidateUserCache(String(telegramId));
        await bot.sendMessage(chatId, `✅ *Gender preference set to ${gender}.*`, { parse_mode: 'Markdown' });
        return sendSearchMenu(bot, chatId, telegramId, User);
      }
      if (picker === 'location') {
        // Handle manual location input
        if (text === '📝 Enter Specific Location') {
          userStates.set(telegramId, { settingPicker: 'manual_location' });
          await bot.sendMessage(chatId, 
            '📍 *Enter Specific Location*\n\n' +
            'Type the city or location you want to search in.\n\n' +
            '_Example: Lagos, Nigeria or New York, USA_',
            { 
              parse_mode: 'Markdown',
              reply_markup: { remove_keyboard: true }
            }
          );
          return;
        }

        const locationMap = { '🏙️ Same City': 'Same City', '📍 Nearby': 'Nearby', '🌍 Anywhere': 'Anywhere' };
        const locationPreference = locationMap[text];
        if (!locationPreference) return;
        await User.findOneAndUpdate({ telegramId: String(telegramId) }, { $set: { 'searchSettings.locationPreference': locationPreference } });
        invalidateUserCache(String(telegramId));
        await bot.sendMessage(chatId, `✅ *Location preference set to ${locationPreference}.*`, { parse_mode: 'Markdown' });
        return sendSearchMenu(bot, chatId, telegramId, User);
      }
      if (picker === 'manual_location') {
        // Search for cities matching the input
        if (text.length < 2 || text.length > 100) {
          return bot.sendMessage(chatId, '❌ Please enter a city name (2–100 characters):');
        }
        
        const cities = await searchCities(text);
        if (cities.length === 0) {
          return bot.sendMessage(chatId,
            '❌ *No cities found.*\n\nPlease try:\n' +
            '• A different spelling\n' +
            '• A larger city nearby\n' +
            '• Just the city name (e.g. "London" instead of "Greater London")',
            { parse_mode: 'Markdown' }
          );
        }
        
        // Store cities and wait for selection
        userStates.set(telegramId, { settingPicker: 'location_pick', cities });
        return bot.sendMessage(chatId,
          `📍 *Select your preferred location:*\n\n${formatCityList(cities)}\n\n👇👇👇 Press the number button`,
          {
            parse_mode: 'Markdown',
            reply_markup: buildCityKeyboard(cities)
          }
        );
      }
      
      if (picker === 'location_pick') {
        const cities = userState.cities || [];
        
        // Handle back button
        if (text === '⬅️ Back') {
          userStates.set(telegramId, { settingPicker: 'manual_location' });
          return bot.sendMessage(chatId, 
            '📍 *Enter Specific Location*\n\n' +
            'Type the city or location you want to search in.\n\n' +
            '_Example: Lagos, Nigeria or New York, USA_',
            { 
              parse_mode: 'Markdown',
              reply_markup: { remove_keyboard: true }
            }
          );
        }
        
        // Handle number selection
        const idx = parseInt(text, 10) - 1;
        if (isNaN(idx) || idx < 0 || idx >= cities.length) {
          return bot.sendMessage(chatId, '❌ Invalid selection. Please tap a number button.');
        }
        
        const selectedCity = cities[idx];
        
        // Save the selected location
        await User.findOneAndUpdate({ 
          telegramId: String(telegramId) 
        }, { 
          $set: { 
            'searchSettings.locationPreference': 'Custom',
            'searchSettings.customLocation': selectedCity.label
          } 
        });
        invalidateUserCache(String(telegramId));
        await bot.sendMessage(chatId, `✅ *Location preference set to: ${selectedCity.label}*`, { parse_mode: 'Markdown' });
        userStates.delete(telegramId);
        return sendSearchMenu(bot, chatId, telegramId, User);
      }
    } catch (err) {
      console.error('[SettingsPicker] Error:', err);
      bot.sendMessage(chatId, '❌ Failed to save setting. Please try again.');
    }
  });
}

module.exports = { setupSettingsCommands };
