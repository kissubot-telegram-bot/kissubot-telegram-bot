const { getCachedUserProfile, invalidateUserCache } = require('./auth');
const axios = require('axios');
const { API_BASE } = require('../config');

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

    try {
      switch (data) {
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
          // Show full detailed profile
          try {
            const user = await getCachedUserProfile(telegramId, User);
            if (!user) {
              return bot.sendMessage(chatId, '❌ User not found. Please /register first.');
            }

            let profileMsg = `💖 **Your Dating Profile** 💖\n\n`;
            profileMsg += `📝 **Name:** ${user.name || 'Not set'}\n`;
            profileMsg += `🎂 **Age:** ${user.age || 'Not set'}\n`;
            profileMsg += `📍 **Location:** ${user.location || 'Not set'}\n`;
            profileMsg += `💭 **Bio:** ${user.bio || 'Not set'}\n`;
            profileMsg += `📸 **Photos:** ${user.photos?.length || 0}/6\n\n`;

            if (user.photos && user.photos.length > 0) {
              profileMsg += `👀 Use /myphotos to view your photos\n\n`;
            }

            profileMsg += `✨ **Profile Completion:** ${user.profileCompleted ? '✅ Complete' : '⚠️ Incomplete'}\n`;

            const buttons = [
              [{ text: '✏️ Edit Profile', callback_data: 'edit_profile' }],
              [{ text: '💕 Start Browsing', callback_data: 'start_browse' }],
              [{ text: '🏠 Main Menu', callback_data: 'main_menu' }]
            ];

            bot.sendMessage(chatId, profileMsg, {
              reply_markup: {
                inline_keyboard: buttons
              }
            });
          } catch (err) {
            console.error('View profile error:', err);
            bot.sendMessage(chatId, '❌ Failed to load profile.');
          }
          break;

        case 'start_browse':
          // Redirect to browse command
          bot.sendMessage(chatId, '💕 **Let\'s find your match!**\n\nYour profile is complete and ready!', {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔍 Start Browsing', callback_data: 'start_browse' }],
                [{ text: '👤 View My Profile', callback_data: 'view_my_profile' }]
              ]
            }
          });
          break;

        case 'main_menu':
          // Show main menu
          const menuMsg = `🏠 **Main Menu** 🏠\n\n` +
            `What would you like to do?`;

          const menuButtons = [
            [
              { text: '💕 Browse', callback_data: 'start_browse' },
              { text: '💌 Matches', callback_data: 'view_matches' }
            ],
            [
              { text: '👤 My Profile', callback_data: 'view_my_profile' },
              { text: '⚙️ Settings', callback_data: 'main_settings' }
            ]
          ];

          bot.sendMessage(chatId, menuMsg, {
            reply_markup: {
              inline_keyboard: menuButtons
            }
          });
          break;

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

        case 'manage_photos':
          userStates.set(telegramId, { action: 'uploading_photo' });
          bot.sendMessage(chatId, '📸 **Upload Photos** 📸\n\nJust send me a photo and I\'ll add it to your profile!\n\n💡 **Tips:**\n• Use high-quality, clear photos\n• Show your face clearly\n• Maximum 6 photos allowed\n• Recent photos appear first\n\n📤 Ready to upload?');
          break;

        default:
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

              bot.sendMessage(chatId, `✅ **Photo Deleted!**\n\nYou now have ${user.photos.length} photo${user.photos.length === 1 ? '' : 's'}.\n\n💡 Use /myphotos to view your remaining photos.`);
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
          bio: 'Bio'
        };

        bot.sendMessage(chatId, `✅ **${fieldNames[field]} Updated!**\n\n` +
          `Your ${field} has been updated successfully.`, {
          reply_markup: {
            inline_keyboard: [[
              { text: '👤 View Profile', callback_data: 'edit_profile' },
              { text: '🔙 Back to Settings', callback_data: 'main_settings' }
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

      const profileMsg = `👤 **YOUR PROFILE** 👤\n\n` +
        `📝 **Name:** ${user.name || 'Not set'}\n` +
        `🎂 **Age:** ${user.age || 'Not set'}\n` +
        `📍 **Location:** ${user.location || 'Not set'}\n` +
        `💬 **Bio:** ${user.bio || 'Not set'}\n\n` +
        `📸 **Photos:** ${user.photos?.length || 0} uploaded\n\n` +
        `✨ Choose what to edit:`;

      const opts = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✏️ Edit Name', callback_data: 'edit_name' },
              { text: '🎂 Edit Age', callback_data: 'edit_age' }
            ],
            [
              { text: '📍 Edit Location', callback_data: 'edit_location' },
              { text: '💬 Edit Bio', callback_data: 'edit_bio' }
            ],
            [
              { text: '📸 Manage Photos', callback_data: 'manage_photos' }
            ],
            [
              { text: '🔙 Back to Main Menu', callback_data: 'main_menu' }
            ]
          ]
        }
      };

      bot.sendMessage(chatId, profileMsg, opts);
    } catch (err) {
      bot.sendMessage(chatId, '❌ Failed to load your profile. Please try /register first.');
    }
  });

  // PHOTOS command - Upload photos to profile
  bot.onText(/\/photos/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    try {
      const user = await getCachedUserProfile(telegramId, User);

      // Set state so photo handler will process the next photo
      userStates.set(telegramId, { action: 'uploading_photo' });

      const photoMsg = `📸 **Photo Upload** 📸\n\n` +
        `You currently have **${user.photos?.length || 0} photo${user.photos?.length === 1 ? '' : 's'}** on your profile.\n\n` +
        `✨ **Add a New Photo:**\n` +
        `Just send me a photo and I'll add it to your profile!\n\n` +
        `📋 **Tips:**\n` +
        `• Use high-quality, clear photos\n` +
        `• Show your face clearly\n` +
        `• Maximum 6 photos allowed\n` +
        `• Recent photos appear first\n\n` +
        `📤 Just send the photo as your next message!`;

      bot.sendMessage(chatId, photoMsg, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '👤 View Profile', callback_data: 'view_profile' }],
            [{ text: '🔙 Back', callback_data: 'main_menu' }]
          ]
        }
      });
    } catch (err) {
      bot.sendMessage(chatId, '❌ Failed to load your profile. Please try /register first.');
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

    bot.sendMessage(chatId, helpMsg, { parse_mode: 'Markdown' });
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

    bot.sendMessage(chatId, helpMsg, { parse_mode: 'Markdown' });
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

    bot.sendMessage(chatId, helpMsg, { parse_mode: 'Markdown' });
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

    bot.sendMessage(chatId, helpMsg, { parse_mode: 'Markdown' });
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
      '📤 Just send the photo as your next message!');
  });
}

module.exports = { setupProfileCommands };
