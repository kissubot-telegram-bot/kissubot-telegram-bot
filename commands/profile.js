const { getCachedUserProfile, invalidateUserCache, getProfileMissing } = require('./auth');
const axios = require('axios');
const { API_BASE } = require('../config');
const browsingModule = require('./browsing');

// US States for location selection (USA only)
const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California',
  'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia',
  'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland',
  'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri',
  'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
  'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina',
  'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
  'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'
];


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
            '📞 *Add Your Phone Number*\n\n' +
            '📱 *On mobile:* Tap the *"📞 Share My Phone Number"* button that appears at the bottom of your screen.\n\n' +
            '💻 *On desktop:* Type your number with country code and send it here:\n`+12345678900`',
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
              reply_markup: { inline_keyboard: buttons }
            });

          } catch (err) {
            bot.sendMessage(chatId, '❌ Failed to load your profile. Please try /register first.');
          }
          break;

        case 'edit_name':
          userStates.set(telegramId, { editing: 'name' });
          bot.sendMessage(chatId, '📝 **Edit Name**\n\nPlease enter your new name:', {
            reply_markup: {
              inline_keyboard: [[
                { text: '🚫 Cancel', callback_data: 'cancel_edit' }
              ]]
            }
          });
          break;

        case 'edit_age':
          userStates.set(telegramId, { editing: 'age' });
          bot.sendMessage(chatId, '🎂 **Edit Age**\n\nPlease enter your age (18-100):', {
            reply_markup: {
              inline_keyboard: [[
                { text: '🚫 Cancel', callback_data: 'cancel_edit' }
              ]]
            }
          });
          break;

        case 'edit_gender':
          bot.sendMessage(chatId, '👤 **Edit Gender**\n\nHow do you identify?', {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '👨 Male', callback_data: 'set_gender_Male' },
                  { text: '👩 Female', callback_data: 'set_gender_Female' }
                ],
                [{ text: '🚫 Cancel', callback_data: 'cancel_edit' }]
              ]
            }
          });
          break;

        case 'edit_lookingFor':
          bot.sendMessage(chatId, '👀 **Edit Preferences**\n\nWho would you like to meet?', {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: 'Men', callback_data: 'set_lookingFor_Male' },
                  { text: 'Women', callback_data: 'set_lookingFor_Female' }
                ],
                [{ text: 'Everyone', callback_data: 'set_lookingFor_Both' }],
                [{ text: '🚫 Cancel', callback_data: 'cancel_edit' }]
              ]
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
          // Show US state selection
          const stateButtons = [];
          for (let i = 0; i < US_STATES.length; i += 3) {
            stateButtons.push(
              US_STATES.slice(i, i + 3).map(state => ({
                text: state,
                callback_data: `select_state_${state}`
              }))
            );
          }
          stateButtons.push([{ text: '🔙 Cancel', callback_data: 'edit_profile' }]);

          bot.sendMessage(chatId, '📍 **Select Your State** 📍\n\nKissuBot is currently available in the USA only.\n\nPlease select your state:', {
            reply_markup: {
              inline_keyboard: stateButtons
            }
          });
          break;

        case 'edit_bio':
          userStates.set(telegramId, { editing: 'bio' });
          bot.sendMessage(chatId, '💭 **Edit Bio**\n\nPlease enter your bio (max 500 characters):', {
            reply_markup: {
              inline_keyboard: [[
                { text: '🚫 Cancel', callback_data: 'cancel_edit' }
              ]]
            }
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

            profileButtons.push([{ text: '💕 Start Browsing', callback_data: 'start_browse' }, { text: '🏠 Main Menu', callback_data: 'main_menu' }]);

            const replyMarkup = { inline_keyboard: profileButtons };

            if (photos.length > 0) {
              await bot.sendPhoto(chatId, photos[0], {
                caption: profileMsg,
                parse_mode: 'Markdown',
                reply_markup: replyMarkup
              });
            } else {
              await bot.sendMessage(chatId, profileMsg, {
                parse_mode: 'Markdown',
                reply_markup: replyMarkup
              });
            }

          } catch (err) {
            console.error('View profile error:', err);
            bot.sendMessage(chatId, '❌ Failed to load profile.');
          }
          break;

        // ── ADD PHONE (handled above at top of switch) ──────────────────

        case 'start_browse':
          // Call browseProfiles directly (set on module.exports after setupBrowsingCommands runs)
          if (browsingModule.browseProfiles) {
            await browsingModule.browseProfiles(chatId, telegramId);
          } else {
            bot.emit('message', { chat: { id: chatId }, from: { id: telegramId, username: query.from.username, first_name: query.from.first_name }, text: '/browse' });
          }
          break;

        // main_menu is handled by bot.js showMainMenu()

        case 'cancel_edit':
          // Cancel editing and clear user state
          userStates.delete(telegramId);
          bot.sendMessage(chatId, '❌ **Edit Cancelled**\n\nNo changes were made.', {
            reply_markup: {
              inline_keyboard: [
                [{ text: '✏️ Edit Profile', callback_data: 'edit_profile' }],
                [{ text: '🏠 Main Menu', callback_data: 'main_menu' }]
              ]
            }
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
                '📸 **Upload Your First Photo** 📸\n\n' +
                'You have no photos yet. Send me a photo to add to your profile!\n\n' +
                '💡 **Tips:**\n' +
                '• Use high-quality, clear photos\n' +
                '• Show your face clearly\n' +
                '• Maximum 6 photos allowed\n\n' +
                '📤 Send a photo now!',
                { reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'view_my_profile' }]] } }
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
                `📸 **Your Photos** \u2014 ${photoCount}/6 slots used${slotsLeft === 0 ? '\n\n⚠️ Photo limit reached. Delete one to add a new photo.' : `\n\n✨ You can add ${slotsLeft} more photo${slotsLeft > 1 ? 's' : ''}.`}`,
                { reply_markup: { inline_keyboard: keyboard } }
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
            '📤 **Send Your Photo** 📤\n\nSend me a photo and I\'ll add it to your profile!\n\n💡 Tips: clear face, good lighting\n\n❌ /cancel to stop',
            { reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'manage_photos' }]] } }
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
              bot.sendMessage(chatId, `✅ Gender updated to ${gender}.`, {
                reply_markup: {
                  inline_keyboard: [
                    [{ text: '👤 Back to Profile', callback_data: 'edit_profile' }]
                  ]
                }
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
              bot.sendMessage(chatId, `✅ Preferences updated to ${lookingFor === 'Both' ? 'Everyone' : lookingFor}.`, {
                reply_markup: {
                  inline_keyboard: [
                    [{ text: '👤 Back to Profile', callback_data: 'edit_profile' }]
                  ]
                }
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
                reply_markup: {
                  inline_keyboard: buttons
                }
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

              bot.sendMessage(chatId, `✅ **Photo Deleted!**\n\nYou now have ${user.photos.length} photo${user.photos.length === 1 ? '' : 's'}.`, {
                reply_markup: {
                  inline_keyboard: [
                    [{ text: '📸 View My Photos', callback_data: 'manage_photos' }],
                    [{ text: '🏠 Main Menu', callback_data: 'main_menu' }]
                  ]
                }
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

    // Skip if it's a command or callback
    if (!text || text.startsWith('/') || !userStates.get(telegramId)) return;

    const userState = userStates.get(telegramId);

    if (userState.editing) {
      try {
        const field = userState.editing;
        let value = text.trim();

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
              `✅ *${fieldNames[field] || field} saved!*\n\n🎉 *Profile complete!*\nClick the button below to start browsing.`,
              {
                parse_mode: 'Markdown',
                reply_markup: {
                  remove_keyboard: field === 'phone'
                }
              }
            ).then(() => {
              bot.sendMessage(chatId, 'Start your journey below 👇', {
                reply_markup: { inline_keyboard: [[{ text: '🔍 Start Browsing', callback_data: 'start_browse' }]] }
              });
            });
          }
        }

        if (field === 'phone') {
          // Remove keyboard for contact share
          await bot.sendMessage(chatId, '✅ *Phone saved!*', { parse_mode: 'Markdown', reply_markup: { remove_keyboard: true } });
          const dynamicButtons = missing.slice(0, 2).map(m => [{ text: m.btnText, callback_data: m.callback }]);
          return bot.sendMessage(chatId,
            `Your profile is still incomplete. Complete it to start browsing:\n\n📋 *Missing:*\n${missing.map(m => m.msgText).join('\n')}`,
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  ...dynamicButtons,
                  [{ text: '👤 View My Profile', callback_data: 'view_my_profile' }]
                ]
              }
            }
          );
        }

        bot.sendMessage(chatId, `✅ **${fieldNames[field] || field} Updated!**\n\nYour ${field} has been saved.`, {
          reply_markup: {
            inline_keyboard: [[
              { text: '👤 View Profile', callback_data: 'edit_profile' },
              { text: '🏠 Main Menu', callback_data: 'main_menu' }
            ]]
          }
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
      const photos = user.photos || [];
      const photoCount = photos.length;

      const profileMsg =
        `� *Your Dating Profile* �\n\n` +
        `📝 *Name:* ${user.name || 'Not set'}\n` +
        `👤 *Gender:* ${user.gender || 'Not set'}\n` +
        `👀 *Looking For:* ${user.lookingFor || 'Not set'}\n` +
        `🎂 *Age:* ${user.age || 'Not set'}\n` +
        `📍 *Location:* ${user.location || 'Not set'}\n` +
        `📞 *Phone:* ${user.phone ? '✅ Added' : '❌ Not added — required'}\n` +
        `💭 *Bio:* ${user.bio || '_(not set)_'}\n` +
        `📸 *Photos:* ${photoCount}/6\n` +
        `✨ *Status:* ${user.profileCompleted ? '✅ Complete' : '⚠️ Incomplete'}`;

      const phoneButtonLabel = user.phone
        ? '📞 Update Phone'
        : '📞 Add Phone Number ⭐ Required';

      const replyMarkup = {
        inline_keyboard: [
          [{ text: '✏️ Edit Name', callback_data: 'edit_name' }, { text: '🎂 Edit Age', callback_data: 'edit_age' }],
          [{ text: '👤 Edit Gender', callback_data: 'edit_gender' }, { text: '👀 Looking For', callback_data: 'edit_lookingFor' }],
          [{ text: '📍 Edit Location', callback_data: 'edit_location' }, { text: '💬 Edit Bio', callback_data: 'edit_bio' }],
          [{ text: phoneButtonLabel, callback_data: 'add_phone_number' }],
          [{ text: '📸 Manage Photos', callback_data: 'manage_photos' }],
          [{ text: '🔙 Back to Main Menu', callback_data: 'main_menu' }]
        ]
      };

      if (photos.length > 0) {
        await bot.sendPhoto(chatId, photos[0], {
          caption: profileMsg,
          parse_mode: 'Markdown',
          reply_markup: replyMarkup
        });
      } else {
        await bot.sendMessage(chatId, profileMsg, {
          parse_mode: 'Markdown',
          reply_markup: replyMarkup
        });
      }

    } catch (err) {
      bot.sendMessage(chatId, '❌ Failed to load your profile. Please try /register first.');
    }
  });

  // Handle Telegram contact share (phone number)
  bot.on('contact', async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const contact = msg.contact;

    // Only accept if the contact is the user themselves
    if (String(contact.user_id) !== String(telegramId)) {
      return bot.sendMessage(chatId, '❌ Please share your own phone number, not someone else\'s.');
    }

    try {
      const phone = contact.phone_number;
      await User.findOneAndUpdate({ telegramId: String(telegramId) }, { phone });
      invalidateUserCache(telegramId);

      await bot.sendMessage(chatId,
        `✅ **Phone number saved!**\n\nYour number has been added to your profile.`,
        {
          reply_markup: { remove_keyboard: true }
        }
      );

      // Check if profile is now complete
      const updatedUser = await getCachedUserProfile(telegramId, User);
      const missing = [];
      if (!updatedUser.name) missing.push('name');
      if (!updatedUser.age) missing.push('age');
      if (!updatedUser.location) missing.push('location');
      if (!updatedUser.phone) missing.push('phone');
      if (!updatedUser.photos || updatedUser.photos.length === 0) missing.push('photo');

      if (missing.length === 0) {
        await User.findOneAndUpdate({ telegramId: String(telegramId) }, { profileCompleted: true });
        invalidateUserCache(telegramId);
        bot.sendMessage(chatId,
          '🎉 **Profile Complete!** You can now browse and match with others.',
          { reply_markup: { inline_keyboard: [[{ text: '🔍 Start Browsing', callback_data: 'start_browse' }]] } }
        );
      } else {
        bot.sendMessage(chatId,
          `📋 Still missing: ${missing.join(', ')}. Use /profile to complete your profile.`,
          { reply_markup: { inline_keyboard: [[{ text: '👤 Edit Profile', callback_data: 'edit_profile' }]] } }
        );
      }
    } catch (err) {
      console.error('Contact handler error:', err);
      bot.sendMessage(chatId, '❌ Failed to save phone number. Please try again.');
    }
  });

  // PHOTOS command - Show existing photos and offer upload
  bot.onText(/\/photos/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    try {
      const user = await getCachedUserProfile(telegramId, User);
      const photos = user.photos || [];
      const photoCount = photos.length;
      const slotsLeft = 6 - photoCount;

      if (photoCount === 0) {
        // No photos — go straight to upload
        userStates.set(telegramId, { action: 'uploading_photo' });
        return bot.sendMessage(chatId,
          '📸 **Upload Your First Photo** 📸\n\n' +
          'You have no photos yet. Send me a photo to get started!\n\n' +
          '💡 **Tips:**\n• High-quality, clear photos\n• Show your face clearly\n• Max 6 photos\n\n' +
          '📤 Send a photo now!',
          { reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'view_my_profile' }]] } }
        );
      }

      // Show existing photos first
      if (photoCount === 1) {
        await bot.sendPhoto(chatId, photos[0], { caption: '📸 Photo 1 — your profile photo' });
      } else {
        const mediaGroup = photos.slice(0, 10).map((fileId, idx) => ({
          type: 'photo',
          media: fileId,
          ...(idx === 0 ? { caption: `📸 Your ${photoCount} profile photos` } : {})
        }));
        await bot.sendMediaGroup(chatId, mediaGroup);
      }

      // Options below the photos
      const keyboard = [];
      if (slotsLeft > 0) {
        keyboard.push([{ text: `📤 Add More Photos (${photoCount}/6)`, callback_data: 'upload_more_photos' }]);
      } else {
        keyboard.push([{ text: '⚠️ Limit reached — Delete a photo first', callback_data: 'delete_photo_menu' }]);
      }
      keyboard.push([{ text: '🗑️ Delete a Photo', callback_data: 'delete_photo_menu' }]);
      keyboard.push([{ text: '👤 View Profile', callback_data: 'view_my_profile' }]);

      bot.sendMessage(chatId,
        `📸 **Photos** — ${photoCount}/6 slots used${slotsLeft > 0 ? `\n✨ Add up to ${slotsLeft} more.` : '\n⚠️ All slots used.'}`,
        { reply_markup: { inline_keyboard: keyboard } }
      );

    } catch (err) {
      bot.sendMessage(chatId, '❌ Failed to load your photos. Please try again.');
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

    bot.sendMessage(chatId, helpMsg, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '✏️ Edit Profile', callback_data: 'edit_profile' }],
          [{ text: '🔙 Back to Menu', callback_data: 'main_menu' }]
        ]
      }
    });
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
      bot.sendMessage(chatId, `✅ **Name Updated Successfully!**\n\n👤 Your name is now: **${name}**`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '👤 View Profile', callback_data: 'view_my_profile' }],
            [{ text: '✏️ Edit More', callback_data: 'edit_profile' }]
          ]
        }
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

    bot.sendMessage(chatId, helpMsg, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '✏️ Edit Profile', callback_data: 'edit_profile' }],
          [{ text: '🔙 Back to Menu', callback_data: 'main_menu' }]
        ]
      }
    });
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
      bot.sendMessage(chatId, `✅ **Age Updated Successfully!**\n\n🎂 Your age is now: **${age}**`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '👤 View Profile', callback_data: 'view_my_profile' }],
            [{ text: '✏️ Edit More', callback_data: 'edit_profile' }]
          ]
        }
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

    bot.sendMessage(chatId, helpMsg, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '✏️ Edit Profile', callback_data: 'edit_profile' }],
          [{ text: '🔙 Back to Menu', callback_data: 'main_menu' }]
        ]
      }
    });
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
      bot.sendMessage(chatId, `✅ **Location Updated Successfully!**\n\n📍 Your location is now: **${location}**`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '👤 View Profile', callback_data: 'view_my_profile' }],
            [{ text: '✏️ Edit More', callback_data: 'edit_profile' }]
          ]
        }
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

    bot.sendMessage(chatId, helpMsg, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '✏️ Edit Profile', callback_data: 'edit_profile' }],
          [{ text: '🔙 Back to Menu', callback_data: 'main_menu' }]
        ]
      }
    });
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
      bot.sendMessage(chatId, `✅ **Bio Updated Successfully!**\n\n💬 Your bio has been updated with your new description.`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '👤 View Profile', callback_data: 'view_my_profile' }],
            [{ text: '✏️ Edit More', callback_data: 'edit_profile' }]
          ]
        }
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
  bot.onText(/\/photo/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    // Set state so photo handler will process the next photo
    userStates.set(telegramId, { action: 'uploading_photo' });

    bot.sendMessage(chatId, '📸 **PHOTO UPLOAD** 📸\n\n' +
      'Send me a photo to add to your profile!\n\n' +
      '📋 **Tips:**\n' +
      '• Use high-quality photos\n' +
      '• Show your face clearly\n' +
      '• Maximum 6 photos allowed\n\n' +
      '📤 Just send the photo as your next message!', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '❌ Cancel', callback_data: 'cancel_edit' }],
          [{ text: '🔙 Back to Menu', callback_data: 'main_menu' }]
        ]
      }
    });
  });
  // ── Handle Telegram contact share (phone auto-fill button) ──────────
  bot.on('contact', async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const contact = msg.contact;

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
          '✅ *Phone saved!* 🎉 *Profile complete!*\n\nClick the button below to start browsing matches.',
          {
            parse_mode: 'Markdown',
            reply_markup: { remove_keyboard: true }
          }
        ).then(() => {
          bot.sendMessage(chatId, 'Start your journey below 👇', {
            reply_markup: { inline_keyboard: [[{ text: '🔍 Start Browsing', callback_data: 'start_browse' }]] }
          });
        });
      }

      await bot.sendMessage(chatId, '✅ *Phone saved!*', { parse_mode: 'Markdown', reply_markup: { remove_keyboard: true } });
      const dynamicButtons = missing.slice(0, 2).map(m => [{ text: m.btnText, callback_data: m.callback }]);
      return bot.sendMessage(chatId,
        `Your profile is still incomplete. Complete it to start browsing:\n\n📋 *Missing:*\n${missing.map(m => m.msgText).join('\n')}`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              ...dynamicButtons,
              [{ text: '👤 View My Profile', callback_data: 'view_my_profile' }]
            ]
          }
        }
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
              `✅ **Photo Uploaded Successfully!** ✅\n\n🎉 *Profile complete!*\nClick the button below to start browsing.`,
              {
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [[{ text: '🔍 Start Browsing', callback_data: 'start_browse' }]] }
              }
            );
          }
        }

        const successMsg = `✅ **Photo Uploaded Successfully!** ✅\n\n` +
          `Your new photo has been added to your profile.\n\n` +
          `📸 **Want to add more photos?**`;

        const opts = {
          reply_markup: {
            inline_keyboard: [
              [{ text: '📸 Add Another Photo', callback_data: 'add_another_photo' }],
              [{ text: '👤 View Profile', callback_data: 'view_profile' }],
              [{ text: '🔍 Start Browsing', callback_data: 'start_browse' }],
              [{ text: '🔙 Back to Menu', callback_data: 'main_menu' }]
            ]
          }
        };

        bot.sendMessage(chatId, successMsg, opts);
      } catch (err) {
        console.error('Photo upload error:', err.response?.data || err.message);
        userStates.delete(telegramId);
        bot.sendMessage(chatId, '❌ Failed to upload photo. Please try again later.');
      }
    }
  });
}

module.exports = { setupProfileCommands };
