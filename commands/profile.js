const { getCachedUserProfile, invalidateUserCache, getProfileMissing } = require('./auth');
const axios = require('axios');
const { API_BASE } = require('../config');
const browsingModule = require('./browsing');
const { searchCities, buildCityKeyboard, formatCityList } = require('./citySearch');
const { MAIN_KEYBOARD, MAIN_KB_BUTTONS, PROFILE_KEYBOARD, PROFILE_KB_BUTTONS, ALL_KB_BUTTONS } = require('../keyboard');


function setupProfileCommands(bot, userStates, User) {
  // Callback query handlers
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const telegramId = query.from.id;
    const data = query.data;

    // Acknowledge the button tap immediately
    await bot.answerCallbackQuery(query.id).catch(() => { });

    try {
      switch (data) {
        // ── PHONE NUMBER ────────────────────────────────────────────
        case 'add_phone_number':
          userStates.set(telegramId, { editing: 'phone' });
          await bot.sendMessage(chatId,
            '📞 *Add Your Phone Number*\n\nTap the *"📞 Share My Phone Number"* button that appears at the bottom of your screen.',
            {
              parse_mode: 'Markdown',
              reply_markup: {
                keyboard: [[{ text: '📞 Share My Phone Number', request_contact: true }]],
                one_time_keyboard: true,
                resize_keyboard: true
              }
            }
          );
          return;

        case 'edit_profile':
        case 'settings_profile':
          try {
            const user = await getCachedUserProfile(telegramId, User);
            if (!user) {
              return bot.sendMessage(chatId, '❌ User not found. Please /register first.');
            }

            const profileMsg = `👤 **PROFILE SETTINGS** 👤\n\n` +
              `📝 **Current Information:**\n` +
              `• Name: ${user.name || 'Not set'}\n` +
              `• Gender: ${user.gender || 'Not set'}\n` +
              `• Looking For: ${user.lookingFor || 'Not set'}\n` +
              `• Age: ${user.age || 'Not set'}\n` +
              `• Location: ${user.location || 'Not set'}\n` +
              `• Phone: ${user.phone ? '✅ Added' : '❌ Not added — required'}\n` +
              `• Bio: ${user.bio || '(optional)'}\n\n` +
              `✏️ **What would you like to edit?**`;

            const phoneRow = !user.phone
              ? [{ text: '📞 Add Phone Number ⭐', callback_data: 'add_phone_number' }]
              : [{ text: '📞 Update Phone', callback_data: 'add_phone_number' }];

            const buttons = [
              [
                { text: '📝 Edit Name', callback_data: 'edit_name' },
                { text: '🎂 Edit Age', callback_data: 'edit_age' }
              ],
              [
                { text: '👤 Edit Gender', callback_data: 'edit_gender' },
                { text: '👀 Looking For', callback_data: 'edit_lookingFor' }
              ],
              [
                { text: '📍 Edit Location', callback_data: 'edit_location' },
                { text: '💭 Edit Bio', callback_data: 'edit_bio' }
              ],
              [phoneRow[0]],
              [
                { text: '📸 Manage Photos', callback_data: 'manage_photos' }
              ],
              [
                { text: '🏠 Main Menu', callback_data: 'main_menu' }
              ]
            ];

            bot.sendMessage(chatId, profileMsg, {
              reply_markup: PROFILE_KEYBOARD
            });

          } catch (err) {
            bot.sendMessage(chatId, '❌ Failed to load your profile. Please try /register first.');
          }
          break;

        case 'edit_name':
          userStates.set(telegramId, { editing: 'name' });
          bot.sendMessage(chatId, '📝 **Edit Name**\n\nPlease enter your new name:', {
            reply_markup: { remove_keyboard: true }
          });
          break;

        case 'edit_age':
          userStates.set(telegramId, { editing: 'age' });
          bot.sendMessage(chatId, '🎂 **Edit Age**\n\nPlease enter your age (18-100):', {
            reply_markup: { remove_keyboard: true }
          });
          break;

        case 'edit_gender':
          userStates.set(telegramId, { editing: 'gender' });
          bot.sendMessage(chatId, '👤 **Edit Gender**\n\nHow do you identify?', {
            reply_markup: {
              keyboard: [
                [{ text: '👨 Male' }, { text: '👩 Female' }],
                [{ text: '� Cancel' }]
              ],
              resize_keyboard: true,
              one_time_keyboard: true
            }
          });
          break;

        case 'edit_lookingFor':
          userStates.set(telegramId, { editing: 'lookingFor' });
          bot.sendMessage(chatId, '👀 **Edit Preferences**\n\nWho would you like to meet?', {
            reply_markup: {
              keyboard: [
                [{ text: 'Men' }, { text: 'Women' }],
                [{ text: 'Everyone' }],
                [{ text: '🚫 Cancel' }]
              ],
              resize_keyboard: true,
              one_time_keyboard: true
            }
          });
          break;

        case 'start_registration':
          // Redirect to /start for registration
          bot.sendMessage(chatId,
            '🚀 **Welcome to KissuBot!** 🚀\n\n' +
            'Let\'s get you registered and ready to find your perfect match!\n\n' +
            'Click the button below or type /start to begin:',
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '✨ Start Registration', url: `https://t.me/${bot.options.username}?start=register` }]
                ]
              }
            }
          );
          break;

        case 'edit_location':
          userStates.set(telegramId, { editing: 'location_search' });
          bot.sendMessage(chatId,
            '📍 *Edit Location*\n\nType your city name and I\'ll find it for you:\n_e.g. London, New York, Paris_',
            {
              parse_mode: 'Markdown',
              reply_markup: { remove_keyboard: true }
            }
          );
          break;

        case 'edit_bio':
          userStates.set(telegramId, { editing: 'bio' });
          bot.sendMessage(chatId, '💭 **Edit Bio**\n\nPlease enter your bio (max 500 characters):', {
            reply_markup: { remove_keyboard: true }
          });
          break;

        case 'view_profile':
        case 'view_my_profile':
          try {
            const user = await getCachedUserProfile(telegramId, User);
            if (!user) {
              return bot.sendMessage(chatId, '❌ User not found. Please /register first.');
            }

            const photos = user.photos || [];
            const photoCount = photos.length;

            let profileMsg = `💖 *Your Dating Profile* 💖\n\n`;
            profileMsg += `📝 *Name:* ${user.name || 'Not set'}\n`;
            profileMsg += `👤 *Gender:* ${user.gender || 'Not set'}\n`;
            profileMsg += `👀 *Looking For:* ${user.lookingFor || 'Not set'}\n`;
            profileMsg += `🎂 *Age:* ${user.age || 'Not set'}\n`;
            profileMsg += `📍 *Location:* ${user.location || 'Not set'}\n`;
            profileMsg += `📞 *Phone:* ${user.phone ? '✅ Added' : '❌ Not added — required'}\n`;
            profileMsg += `💭 *Bio:* ${user.bio || '_(not set)_'}\n`;
            profileMsg += `📸 *Photos:* ${photoCount}/6\n`;
            profileMsg += `✨ *Status:* ${user.profileCompleted ? '✅ Complete' : '⚠️ Incomplete'}`;

            const profileButtons = [
              [{ text: '✏️ Edit Profile', callback_data: 'edit_profile' }, { text: '📸 Manage Photos', callback_data: 'manage_photos' }]
            ];

            // Show Add Phone button prominently if missing
            if (!user.phone) {
              profileButtons.unshift([{ text: '📞 Add Phone Number ⭐ Required', callback_data: 'add_phone_number' }]);
            }

            if (photos.length > 0) {
              await bot.sendPhoto(chatId, photos[0], {
                caption: profileMsg,
                parse_mode: 'Markdown',
                reply_markup: PROFILE_KEYBOARD
              });
            } else {
              await bot.sendMessage(chatId, profileMsg, {
                parse_mode: 'Markdown',
                reply_markup: PROFILE_KEYBOARD
              });
            }

          } catch (err) {
            console.error('View profile error:', err);
            bot.sendMessage(chatId, '❌ Failed to load profile.');
          }
          break;

        // ── ADD PHONE (handled above at top of switch) ──────────────────

        // main_menu is handled by bot.js showMainMenu()

        case 'cancel_edit':
          // Cancel editing and clear user state
          userStates.delete(telegramId);
          bot.sendMessage(chatId, '❌ **Edit Cancelled**\n\nNo changes were made.', {
            reply_markup: MAIN_KEYBOARD
          });
          break;

        case 'manage_photos': {
          try {
            const user = await getCachedUserProfile(telegramId, User);
            const photos = user.photos || [];
            const photoCount = photos.length;
            const slotsLeft = 6 - photoCount;

            if (photoCount === 0) {
              // No photos yet — go straight to upload
              userStates.set(telegramId, { action: 'uploading_photo' });
              await bot.sendMessage(chatId,
                '📸 *Upload Your First Photo*\n\nYou have no photos yet. Send me a photo to add to your profile!\n\n💡 *Tips:* clear face, good lighting, max 6 photos.\n\n📤 Send a photo now, or tap *👤 My Profile* to cancel.',
                { parse_mode: 'Markdown', reply_markup: PROFILE_KEYBOARD }
              );
            } else {
              // Show existing photos first
              if (photoCount === 1) {
                await bot.sendPhoto(chatId, photos[0], { caption: '📸 Photo 1 of 1 (Profile photo)' });
              } else {
                const mediaGroup = photos.slice(0, 10).map((fileId, idx) => ({
                  type: 'photo',
                  media: fileId,
                  ...(idx === 0 ? { caption: `📸 Your ${photoCount} profile photos` } : {})
                }));
                await bot.sendMediaGroup(chatId, mediaGroup);
              }

              // Summary + options
              const keyboard = [];
              if (slotsLeft > 0) {
                keyboard.push([{ text: `📤 Add Photo (${photoCount}/6 used)`, callback_data: 'upload_more_photos' }]);
              }
              keyboard.push([{ text: '🗑️ Delete a Photo', callback_data: 'delete_photo_menu' }]);
              keyboard.push([{ text: '👤 Back to Profile', callback_data: 'view_my_profile' }]);

              await bot.sendMessage(chatId,
                `📸 *Your Photos* — ${photoCount}/6 slots used${slotsLeft === 0 ? '\n\n⚠️ Photo limit reached. Delete one to add a new photo.' : `\n\n✨ You can add ${slotsLeft} more photo${slotsLeft > 1 ? 's' : ''}.`}`,
                { parse_mode: 'Markdown', reply_markup: PROFILE_KEYBOARD }
              );
            }
          } catch (err) {
            console.error('Manage photos error:', err);
            bot.sendMessage(chatId, '❌ Failed to load photos. Please try again.');
          }
          break;
        }

        case 'upload_more_photos':
          userStates.set(telegramId, { action: 'uploading_photo' });
          bot.sendMessage(chatId,
            '📤 *Send Your Photo*\n\nSend me a photo to add to your profile!\n\n💡 Tips: clear face, good lighting.\n\nTap *👤 My Profile* to cancel.',
            { parse_mode: 'Markdown', reply_markup: PROFILE_KEYBOARD }
          );
          break;

        default:
          // Handle gender / lookingFor selection callbacks
          if (data.startsWith('set_gender_')) {
            const gender = data.replace('set_gender_', '');
            try {
              await User.findOneAndUpdate({ telegramId }, { gender });
              invalidateUserCache(telegramId);
              bot.answerCallbackQuery(query.id).catch(() => { });
              userStates.delete(telegramId);
              bot.sendMessage(chatId, `✅ Gender updated to ${gender}.`, {
                reply_markup: MAIN_KEYBOARD
              });
            } catch (err) {
              bot.sendMessage(chatId, '❌ Failed to save. Please try again.');
            }
            return;
          }

          if (data.startsWith('set_lookingFor_')) {
            const lookingFor = data.replace('set_lookingFor_', '');
            try {
              await User.findOneAndUpdate({ telegramId }, { lookingFor });
              invalidateUserCache(telegramId);
              bot.answerCallbackQuery(query.id).catch(() => { });
              userStates.delete(telegramId);
              bot.sendMessage(chatId, `✅ Preferences updated to ${lookingFor === 'Both' ? 'Everyone' : lookingFor}.`, {
                reply_markup: MAIN_KEYBOARD
              });
            } catch (err) {
              bot.sendMessage(chatId, '❌ Failed to save. Please try again.');
            }
            return;
          }

          // Check if it's a state selection callback
          if (data.startsWith('select_state_')) {
            const state = data.replace('select_state_', '');

            try {
              const user = await User.findOne({ telegramId });
              if (!user) {
                return bot.sendMessage(chatId, '❌ User not found. Please /register first.');
              }

              user.location = state;
              await user.save();
              invalidateUserCache(telegramId);

              // Auto-show updated profile
              const updatedUser = await User.findOne({ telegramId });
              const profileMsg = `✅ **Location Updated!**\n\n` +
                `👤 **Your Profile**\n\n` +
                `📝 Name: ${updatedUser.name || 'Not set'}\n` +
                `🎂 Age: ${updatedUser.age || 'Not set'}\n` +
                `📍 Location: ${updatedUser.location || 'Not set'}\n` +
                `💭 Bio: ${updatedUser.bio || 'Not set'}\n` +
                `📸 Photos: ${updatedUser.photos?.length || 0}/6\n\n` +
                `What would you like to do next?`;

              const buttons = [
                [
                  { text: '✏️ Edit Again', callback_data: 'edit_profile' },
                  { text: '👀 View Full Profile', callback_data: 'view_my_profile' }
                ],
                [
                  { text: '💕 Start Browsing', callback_data: 'start_browse' },
                  { text: '🏠 Main Menu', callback_data: 'main_menu' }
                ]
              ];

              bot.sendMessage(chatId, profileMsg, {
                reply_markup: PROFILE_KEYBOARD
              });
            } catch (err) {
              console.error('Update location error:', err);
              bot.sendMessage(chatId, '❌ Failed to update location. Please try again.');
            }
            return;
          }

          // Check if it's a delete_photo callback
          if (data.startsWith('delete_photo_')) {
            const photoIndex = parseInt(data.replace('delete_photo_', ''));

            try {
              const user = await User.findOne({ telegramId });
              if (!user || !user.photos || photoIndex >= user.photos.length) {
                return bot.sendMessage(chatId, '❌ Photo not found.');
              }

              // Remove photo from array
              user.photos.splice(photoIndex, 1);

              // Update profilePhoto if we deleted the first photo
              if (photoIndex === 0) {
                user.profilePhoto = user.photos.length > 0 ? user.photos[0] : null;
              }

              await user.save();
              invalidateUserCache(telegramId);

              bot.sendMessage(chatId, `✅ *Photo Deleted!*\n\nYou now have ${user.photos.length} photo${user.photos.length === 1 ? '' : 's'}.`, {
                parse_mode: 'Markdown', reply_markup: PROFILE_KEYBOARD
              });
            } catch (err) {
              console.error('Delete photo error:', err);
              bot.sendMessage(chatId, '❌ Failed to delete photo. Please try again.');
            }
            return;
          }

          // Not a profile callback, let other handlers process it
          return;
      }
      // Profile callback was handled, don't let other handlers process it
      return;
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

    // Skip commands, non-text, no state, and nav keyboard buttons
    if (!text || text.startsWith('/') || !userStates.get(telegramId)) return;
    if (ALL_KB_BUTTONS.includes(text)) return;

    const userState = userStates.get(telegramId);

    if (userState.editing) {
      try {
        const field = userState.editing;
        let value = text.trim();

        // ── LOCATION SEARCH: show city list with Reply Keyboard ──────────
        if (field === 'location_search') {
          if (value.length < 2 || value.length > 100) {
            return bot.sendMessage(chatId, '❌ Please enter a city name (2–100 characters):');
          }
          const cities = await searchCities(value);
          if (cities.length === 0) {
            await User.findOneAndUpdate({ telegramId }, { location: value });
            invalidateUserCache(telegramId);
            userStates.delete(telegramId);
            return bot.sendMessage(chatId,
              `✅ *${value}* saved as your location!`,
              { parse_mode: 'Markdown', reply_markup: MAIN_KEYBOARD }
            );
          }
          userStates.set(telegramId, { editing: 'location_pick', cities });
          return bot.sendMessage(chatId,
            `📍 *Select your city from the list:*\n\n${formatCityList(cities)}\n\n👇👇👇 Press the number button`,
            {
              parse_mode: 'Markdown',
              reply_markup: buildCityKeyboard(cities)
            }
          );
        }

        // ── LOCATION PICK: handle number or Back from Reply Keyboard ─────
        if (field === 'location_pick') {
          const cities = userState.cities || [];
          if (value === '⬅️ Back') {
            userStates.set(telegramId, { editing: 'location_search' });
            return bot.sendMessage(chatId,
              '📍 *Edit Location*\n\nType your city name and I\'ll find it for you:\n_e.g. London, New York, Paris_',
              { parse_mode: 'Markdown', reply_markup: { remove_keyboard: true } }
            );
          }
          const idx = parseInt(value, 10) - 1;
          if (isNaN(idx) || idx < 0 || idx >= cities.length) {
            return bot.sendMessage(chatId, `❌ Please press one of the numbered buttons (1–${cities.length}):`);
          }
          const chosen = cities[idx].label;
          await User.findOneAndUpdate({ telegramId }, { location: chosen });
          invalidateUserCache(telegramId);
          userStates.delete(telegramId);
          return bot.sendMessage(chatId,
            `✅ *${chosen}* saved as your location!`,
            { parse_mode: 'Markdown', reply_markup: MAIN_KEYBOARD }
          );
        }

        // ── GENDER edit via Reply Keyboard ──────────────────────────────
        if (field === 'gender') {
          if (value === '🚫 Cancel') {
            userStates.delete(telegramId);
            return bot.sendMessage(chatId, '❌ Edit cancelled.', { reply_markup: MAIN_KEYBOARD });
          }
          const genderMap = { '👨 Male': 'Male', '👩 Female': 'Female' };
          const gender = genderMap[value];
          if (!gender) {
            return bot.sendMessage(chatId, '❌ Please press one of the buttons:', {
              reply_markup: {
                keyboard: [[{ text: '👨 Male' }, { text: '👩 Female' }], [{ text: '🚫 Cancel' }]],
                resize_keyboard: true, one_time_keyboard: true
              }
            });
          }
          await User.findOneAndUpdate({ telegramId }, { gender });
          invalidateUserCache(telegramId);
          userStates.delete(telegramId);
          return bot.sendMessage(chatId, `✅ *Gender updated to ${gender}!*`, {
            parse_mode: 'Markdown', reply_markup: MAIN_KEYBOARD
          });
        }

        // ── LOOKING FOR edit via Reply Keyboard ──────────────────────────
        if (field === 'lookingFor') {
          if (value === '🚫 Cancel') {
            userStates.delete(telegramId);
            return bot.sendMessage(chatId, '❌ Edit cancelled.', { reply_markup: MAIN_KEYBOARD });
          }
          const lookingForMap = { 'Men': 'Male', 'Women': 'Female', 'Everyone': 'Both' };
          const lookingFor = lookingForMap[value];
          if (!lookingFor) {
            return bot.sendMessage(chatId, '❌ Please press one of the buttons:', {
              reply_markup: {
                keyboard: [[{ text: 'Men' }, { text: 'Women' }], [{ text: 'Everyone' }], [{ text: '🚫 Cancel' }]],
                resize_keyboard: true, one_time_keyboard: true
              }
            });
          }
          await User.findOneAndUpdate({ telegramId }, { lookingFor });
          invalidateUserCache(telegramId);
          userStates.delete(telegramId);
          return bot.sendMessage(chatId, `✅ *Preferences updated!*`, {
            parse_mode: 'Markdown', reply_markup: MAIN_KEYBOARD
          });
        }

        // Validate input based on field
        if (field === 'age') {
          const age = parseInt(value);
          if (isNaN(age) || age < 18 || age > 100) {
            return bot.sendMessage(chatId, '❌ Please enter a valid age between 18 and 100.');
          }
          value = age;
        } else if (field === 'bio' && value.length > 500) {
          return bot.sendMessage(chatId, '❌ Bio must be 500 characters or less.');
        } else if (field === 'name' && (value.length < 1 || value.length > 50)) {
          return bot.sendMessage(chatId, '❌ Name must be between 1 and 50 characters.');
        } else if (field === 'phone') {
          const digits = value.replace(/[\s\-().]/g, '');
          if (!/^\+?\d{7,15}$/.test(digits)) {
            return bot.sendMessage(chatId,
              '❌ Invalid number. Please include your country code, e.g. `+1234567890`',
              { parse_mode: 'Markdown' }
            );
          }
          value = digits.startsWith('+') ? digits : `+${digits}`;
        }

        // Update profile
        await User.findOneAndUpdate({ telegramId }, { [field]: value });

        // Clear user state
        userStates.delete(telegramId);

        // Invalidate cache
        invalidateUserCache(telegramId);

        // Send success message
        const fieldNames = {
          name: 'Name',
          age: 'Age',
          location: 'Location',
          bio: 'Bio',
          phone: 'Phone Number'
        };

        const updatedUser = await getCachedUserProfile(telegramId, User);
        const missing = getProfileMissing(updatedUser);

        // ALWAYS evaluate completion when any missing information is uploaded
        if (missing.length === 0) {
          if (!updatedUser.profileCompleted) {
            await User.findOneAndUpdate({ telegramId }, { profileCompleted: true });
            invalidateUserCache(telegramId);
            return bot.sendMessage(chatId,
              `✅ *${fieldNames[field] || field} saved!*\n\n🎉 *Profile complete!* Tap *🔍 Browse* to find your match!`,
              { parse_mode: 'Markdown', reply_markup: MAIN_KEYBOARD }
            );
          }
        }

        if (field === 'phone') {
          // Remove keyboard for contact share
          await bot.sendMessage(chatId, '✅ *Phone saved!*', { parse_mode: 'Markdown', reply_markup: { remove_keyboard: true } });
          return bot.sendMessage(chatId,
            `Your profile is still incomplete. Complete it to start browsing:\n\n📋 *Missing:*\n${missing.map(m => m.msgText).join('\n')}`,
            { parse_mode: 'Markdown', reply_markup: PROFILE_KEYBOARD }
          );
        }

        bot.sendMessage(chatId, `✅ *${fieldNames[field] || field} Updated!*\n\nYour ${field} has been saved.`, {
          parse_mode: 'Markdown', reply_markup: PROFILE_KEYBOARD
        });
      } catch (err) {
        console.error('Profile update error:', err);
        userStates.delete(telegramId);
        bot.sendMessage(chatId, '❌ Failed to update profile. Please try again.');
      }
    }
  });
  // PROFILE command - View/edit profile
  bot.onText(/\/profile/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    try {
      const user = await getCachedUserProfile(telegramId, User);
      if (!user) return bot.sendMessage(chatId, '❌ User not found. Please use /start to register.');
      const photos = user.photos || [];
      const photoCount = photos.length;

      const profileMsg =
        `💖 *Your Profile*\n\n` +
        `📝 *Name:* ${user.name || 'Not set'}\n` +
        `👤 *Gender:* ${user.gender || 'Not set'}\n` +
        `👀 *Looking For:* ${user.lookingFor || 'Not set'}\n` +
        `🎂 *Age:* ${user.age || 'Not set'}\n` +
        `📍 *Location:* ${user.location || 'Not set'}\n` +
        `📞 *Phone:* ${user.phone ? '✅ Added' : '❌ Required'}\n` +
        `💭 *Bio:* ${user.bio || '_(not set)_'}\n` +
        `📸 *Photos:* ${photoCount}/6\n` +
        `✨ *Status:* ${user.profileCompleted ? '✅ Complete' : '⚠️ Incomplete'}\n` +
        `👑 *VIP:* ${user.isVip ? '✅ Active' : '❌ Not subscribed'}`;

      if (photos.length > 0) {
        await bot.sendPhoto(chatId, photos[0], {
          caption: profileMsg,
          parse_mode: 'Markdown',
          reply_markup: PROFILE_KEYBOARD
        });
      } else {
        await bot.sendMessage(chatId, profileMsg, {
          parse_mode: 'Markdown',
          reply_markup: PROFILE_KEYBOARD
        });
      }

    } catch (err) {
      bot.sendMessage(chatId, '❌ Failed to load your profile. Please try /start first.');
    }
  });

  // ── Profile Reply Keyboard button handler ──────────────────────────────
  bot.on('message', async (msg) => {
    const text = msg.text;
    if (!text || !PROFILE_KB_BUTTONS.includes(text)) return;
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    if (text === '🔙 Back') {
      userStates.delete(telegramId);
      return bot.sendMessage(chatId, '🏠 Main menu', { reply_markup: MAIN_KEYBOARD });
    }
    if (text === '📝 Edit Name') {
      userStates.set(telegramId, { editing: 'name' });
      return bot.sendMessage(chatId, '📝 *Edit Name*\n\nEnter your new name:',
        { parse_mode: 'Markdown', reply_markup: { remove_keyboard: true } });
    }
    if (text === '🎂 Edit Age') {
      userStates.set(telegramId, { editing: 'age' });
      return bot.sendMessage(chatId, '🎂 *Edit Age*\n\nEnter your age (18–100):',
        { parse_mode: 'Markdown', reply_markup: { remove_keyboard: true } });
    }
    if (text === '👤 Edit Gender') {
      userStates.set(telegramId, { editing: 'gender' });
      return bot.sendMessage(chatId, '👤 *Edit Gender*\n\nHow do you identify?', {
        parse_mode: 'Markdown',
        reply_markup: {
          keyboard: [[{ text: '👨 Male' }, { text: '👩 Female' }], [{ text: '🚫 Cancel' }]],
          resize_keyboard: true, one_time_keyboard: true
        }
      });
    }
    if (text === '👀 Looking For') {
      userStates.set(telegramId, { editing: 'lookingFor' });
      return bot.sendMessage(chatId, '👀 *Looking For*\n\nWho would you like to meet?', {
        parse_mode: 'Markdown',
        reply_markup: {
          keyboard: [[{ text: 'Men' }, { text: 'Women' }], [{ text: 'Everyone' }], [{ text: '🚫 Cancel' }]],
          resize_keyboard: true, one_time_keyboard: true
        }
      });
    }
    if (text === '📍 Edit Location') {
      userStates.set(telegramId, { editing: 'location_search' });
      return bot.sendMessage(chatId, '📍 *Edit Location*\n\nType your city name:\n_e.g. London, New York_',
        { parse_mode: 'Markdown', reply_markup: { remove_keyboard: true } });
    }
    if (text === '💬 Edit Bio') {
      userStates.set(telegramId, { editing: 'bio' });
      return bot.sendMessage(chatId, '💬 *Edit Bio*\n\nEnter your bio (max 500 chars):',
        { parse_mode: 'Markdown', reply_markup: { remove_keyboard: true } });
    }
    if (text === '📞 Phone') {
      userStates.set(telegramId, { editing: 'phone' });
      return bot.sendMessage(chatId,
        '📞 *Phone Number*\n\nTap the Share button below.',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            keyboard: [[{ text: '📞 Share My Phone Number', request_contact: true }]],
            one_time_keyboard: true, resize_keyboard: true
          }
        }
      );
    }
    if (text === '📸 Photos') {
      try {
        const user = await getCachedUserProfile(telegramId, User);
        const photos = user ? (user.photos || []) : [];
        if (photos.length === 0) {
          userStates.set(telegramId, { action: 'uploading_photo' });
          return bot.sendMessage(chatId, '📸 *Upload Your First Photo*\n\nSend me a photo to add to your profile!\n\nTap *👤 My Profile* to cancel.', {
            parse_mode: 'Markdown',
            reply_markup: PROFILE_KEYBOARD
          });
        }
        if (photos.length === 1) {
          await bot.sendPhoto(chatId, photos[0], { caption: '📸 Photo 1 of 1 (Profile photo)' });
        } else {
          await bot.sendMediaGroup(chatId, photos.slice(0, 10).map((f, i) => ({
            type: 'photo', media: f,
            ...(i === 0 ? { caption: `📸 Your ${photos.length} profile photos` } : {})
          })));
        }
        const slotsLeft = 6 - photos.length;
        const kb = [];
        if (slotsLeft > 0) kb.push([{ text: `📤 Add Photo (${photos.length}/6)`, callback_data: 'upload_more_photos' }]);
        kb.push([{ text: '🗑️ Delete a Photo', callback_data: 'delete_photo_menu' }]);
        return bot.sendMessage(chatId, `📸 *Photos* — ${photos.length}/6 used`,
          { parse_mode: 'Markdown', reply_markup: PROFILE_KEYBOARD });
      } catch (err) {
        return bot.sendMessage(chatId, '❌ Failed to load photos. Please try again.');
      }
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

    bot.sendMessage(chatId, helpMsg, { parse_mode: 'Markdown', reply_markup: PROFILE_KEYBOARD });
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
      bot.sendMessage(chatId, `✅ *Name Updated!*\n\n👤 Your name is now: *${name}*`, {
        parse_mode: 'Markdown', reply_markup: PROFILE_KEYBOARD
      });
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

    bot.sendMessage(chatId, helpMsg, { parse_mode: 'Markdown', reply_markup: PROFILE_KEYBOARD });
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
      bot.sendMessage(chatId, `✅ *Age Updated!*\n\n🎂 Your age is now: *${age}*`, {
        parse_mode: 'Markdown', reply_markup: PROFILE_KEYBOARD
      });
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

    bot.sendMessage(chatId, helpMsg, { parse_mode: 'Markdown', reply_markup: PROFILE_KEYBOARD });
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
      bot.sendMessage(chatId, `✅ *Location Updated!*\n\n📍 Your location is now: *${location}*`, {
        parse_mode: 'Markdown', reply_markup: PROFILE_KEYBOARD
      });
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

    bot.sendMessage(chatId, helpMsg, { parse_mode: 'Markdown', reply_markup: PROFILE_KEYBOARD });
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
      bot.sendMessage(chatId, `✅ *Bio Updated!*\n\n💬 Your bio has been updated.`, {
        parse_mode: 'Markdown', reply_markup: PROFILE_KEYBOARD
      });
    } catch (err) {
      console.error(`[/setbio] Error for user ${telegramId}:`, err.response?.data || err.message);
      if (err.code === 'ECONNREFUSED' || err.response?.status >= 500) {
        bot.sendMessage(chatId, '❌ Server connection issue. Please try again in a moment.');
      } else {
        bot.sendMessage(chatId, '❌ Failed to update bio. Please try again.');
      }
    }
  });

  // MYPHOTOS command - View all uploaded photos
  bot.onText(/\/myphotos/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    try {
      const user = await getCachedUserProfile(telegramId, User);

      if (!user) {
        return bot.sendMessage(chatId, '❌ User not found. Please /register first.');
      }

      const photos = user.photos || [];

      if (photos.length === 0) {
        return bot.sendMessage(chatId, '📸 **No Photos Yet** 📸\n\nYou haven\'t uploaded any photos yet.\n\nUse /photos to add your first photo!');
      }

      // Send header message
      bot.sendMessage(chatId, `📸 **Your Photos** (${photos.length}/6) 📸\n\nHere are all your uploaded photos:`);

      // Send each photo with its number
      for (let i = 0; i < photos.length; i++) {
        const photoUrl = photos[i];
        const photoNumber = i + 1;

        const caption = `Photo ${photoNumber}/${photos.length}${i === 0 ? ' (Profile Photo)' : ''}`;

        const buttons = {
          reply_markup: {
            inline_keyboard: [[
              { text: '🗑️ Delete This Photo', callback_data: `delete_photo_${i}` }
            ]]
          }
        };

        // Send photo from URL
        await bot.sendPhoto(chatId, photoUrl, { caption, ...buttons });
      }

      bot.sendMessage(chatId, '💡 **Tip:** You can upload up to 6 photos. Use /photos to add more!');
    } catch (err) {
      console.error('View photos error:', err);
      bot.sendMessage(chatId, '❌ Failed to load your photos. Please try again.');
    }
  });

  // Photo upload command
  bot.onText(/^\/photo(@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    // Set state so photo handler will process the next photo
    userStates.set(telegramId, { action: 'uploading_photo' });

    bot.sendMessage(chatId, '📸 *Photo Upload*\n\nSend me a photo to add to your profile!\n\n� *Tips:* clear face, good lighting, max 6 photos.\n\nTap *� My Profile* to cancel.', {
      parse_mode: 'Markdown', reply_markup: PROFILE_KEYBOARD
    });
  });
  // ── Handle Telegram contact share (phone auto-fill button) ──────────
  bot.on('contact', async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const contact = msg.contact;

    // Let onboarding.js handle contact shares during onboarding
    const currentState = userStates.get(telegramId);
    if (currentState && currentState.onboarding) return;

    // Only accept the user sharing their OWN number
    if (String(contact.user_id) !== String(telegramId)) {
      return bot.sendMessage(chatId, '❌ Please share your own phone number, not someone else\'s.');
    }

    try {
      const phone = contact.phone_number.startsWith('+')
        ? contact.phone_number
        : `+${contact.phone_number}`;

      await User.findOneAndUpdate({ telegramId: String(telegramId) }, { phone });
      userStates.delete(telegramId);
      invalidateUserCache(telegramId);

      const updatedUser = await getCachedUserProfile(telegramId, User);
      const missing = getProfileMissing(updatedUser);

      if (missing.length === 0) {
        await User.findOneAndUpdate({ telegramId: String(telegramId) }, { profileCompleted: true });
        invalidateUserCache(telegramId);
        return bot.sendMessage(chatId,
          '✅ *Phone saved!* 🎉 *Profile complete!* Tap *🔍 Browse* to find your match!',
          { parse_mode: 'Markdown', reply_markup: MAIN_KEYBOARD }
        );
      }

      await bot.sendMessage(chatId, '✅ *Phone saved!*', { parse_mode: 'Markdown', reply_markup: { remove_keyboard: true } });
      return bot.sendMessage(chatId,
        `Your profile is still incomplete. Complete it to start browsing:\n\n📋 *Missing:*\n${missing.map(m => m.msgText).join('\n')}`,
        { parse_mode: 'Markdown', reply_markup: PROFILE_KEYBOARD }
      );
    } catch (err) {
      console.error('Contact handler error:', err);
      bot.sendMessage(chatId, '❌ Failed to save phone number. Please try again.');
    }
  });

  // Media handler for photos
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

        // Get file info from Telegram
        const file = await bot.getFile(fileId);
        const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

        // Upload photo to profile using multipart form
        const FormData = require('form-data');
        const https = require('https');
        const form = new FormData();

        // Fetch the photo from Telegram
        const photoBuffer = await new Promise((resolve, reject) => {
          https.get(fileUrl, (res) => {
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
          });
        });

        form.append('image', photoBuffer, 'photo.jpg');

        const uploadRes = await axios.post(`${API_BASE}/upload-photo/${telegramId}`, form, {
          headers: form.getHeaders()
        });

        userStates.delete(telegramId);

        // Invalidate cache so profile shows updated photo count
        invalidateUserCache(telegramId);

        // Check completion universally
        const updatedUser = await getCachedUserProfile(telegramId, User);
        const missing = getProfileMissing(updatedUser);

        if (missing.length === 0) {
          if (!updatedUser.profileCompleted) {
            await User.findOneAndUpdate({ telegramId }, { profileCompleted: true });
            invalidateUserCache(telegramId);
            return bot.sendMessage(chatId,
              `✅ *Photo Uploaded!* 🎉 *Profile complete!* Tap *🔍 Browse* to start!`,
              { parse_mode: 'Markdown', reply_markup: MAIN_KEYBOARD }
            );
          }
        }

        bot.sendMessage(chatId,
          `✅ *Photo Uploaded!*\n\nYour new photo has been added to your profile.`,
          { parse_mode: 'Markdown', reply_markup: PROFILE_KEYBOARD }
        );
      } catch (err) {
        console.error('Photo upload error:', err.response?.data || err.message);
        userStates.delete(telegramId);
        const serverError = err.response?.data?.error;
        const userMsg = serverError
          ? `❌ *Photo rejected:* ${serverError}\n\nPlease try a different photo.`
          : '❌ Failed to upload photo. Please try again later.';
        bot.sendMessage(chatId, userMsg, { parse_mode: 'Markdown' });
      }
    }
  });
}

module.exports = { setupProfileCommands };
