const { MAIN_KEYBOARD, MAIN_KB_BUTTONS, PROFILE_KEYBOARD, DELETE_CONFIRM_KEYBOARD, DELETE_CONFIRM_KB_BUTTONS } = require('../keyboard');
const userProfileCache = new Map();

async function getCachedUserProfile(telegramId, User) {
  if (userProfileCache.has(telegramId)) {
    return userProfileCache.get(telegramId);
  }

  const user = await User.findOne({ telegramId });
  if (user) {
    userProfileCache.set(telegramId, user);
  }
  return user;
}

// Function to invalidate cache after profile updates
function invalidateUserCache(telegramId) {
  userProfileCache.delete(telegramId);
}

const userRegistrationData = {};

function setupAuthCommands(bot, userStates, User) {
  // START command - Check terms acceptance and profile completion
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    try {
      let user = await User.findOne({ telegramId });

      // 1. If user doesn't exist, create an empty skeleton and start onboarding immediately
      if (!user) {
        user = new User({
          telegramId,
          username: msg.from.username || '',
          location: 'Unknown',
          onboardingStep: 'registration'
        });
        await user.save();
        invalidateUserCache(telegramId);

        // Show Terms of Service first before onboarding begins
        return bot.sendMessage(chatId,
          `📜 *Welcome to KissuBot!*\n\nBefore we get started, please review and accept our Terms of Service and Privacy Policy.\n\n_By tapping "Accept", you agree to our terms._`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '✅ Accept & Continue', callback_data: 'accept_terms' },
                  { text: '❌ Decline', callback_data: 'decline_terms' }
                ],
                [
                  { text: '📖 Read Terms', url: 'https://kissubot-telegram-bot.github.io/kissubot-telegram-bot/terms.html' },
                  { text: '🔒 Read Privacy', url: 'https://kissubot-telegram-bot.github.io/kissubot-telegram-bot/privacy.html' }
                ]
              ]
            }
          }
        );
      }

      // 2. Compute profile completeness from actual fields
      const missing = getProfileMissing(user);

      // Profile still incomplete — show what's missing
      if (missing.length > 0) {
        const incompleteMsg = `✨ **Almost Ready!** ✨\n\n` +
          `You're just one step away from finding your perfect match!\n\n` +
          `📋 **What's Missing:**\n` +
          `${missing.map(m => m.msgText).join('\n')}\n\n` +
          `💡 Complete your profile to start browsing and matching! 💕`;

        // Create dynamic buttons for missing fields (max 2 to avoid clutter)
        const dynamicButtons = missing.slice(0, 2).map(m => [{ text: m.btnText, callback_data: m.callback }]);

        return bot.sendMessage(chatId, incompleteMsg, {
          parse_mode: 'Markdown',
          reply_markup: PROFILE_KEYBOARD
        });
      }

      // All fields are present → mark profile as complete if flag is stale
      if (!user.profileCompleted) {
        User.findOneAndUpdate({ telegramId }, { profileCompleted: true }).catch(() => { });
      }

      // Profile complete - show main menu
      const firstName = msg.from.first_name;
      bot.sendMessage(chatId,
        `💘 **KISSUBOT** 💘\n\n${firstName ? `Hey ${firstName}! 👋` : 'Welcome back! 👋'}\n\nWhat would you like to do today?`,
        { parse_mode: 'Markdown', reply_markup: MAIN_KEYBOARD }
      );

    } catch (err) {
      console.error('Start command error:', err);
      bot.sendMessage(chatId, '❌ Something went wrong. Please try again.');
    }
  });

  // REGISTER command - Create new profile
  bot.onText(/\/register/, (msg) => {
    handleRegister(bot, msg, User);
  });

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (msg.text && MAIN_KB_BUTTONS.includes(msg.text)) return;

    if (userRegistrationData[userId] && userRegistrationData[userId].promptingForLocation) {
      const location = msg.text;
      if (!location) {
        bot.sendMessage(chatId, 'Please provide a valid location.');
        return;
      }

      const { telegramId, username, name } = userRegistrationData[userId];

      try {
        const newUser = new User({
          telegramId,
          username,
          name,
          location,
        });
        await newUser.save();

        const welcomeMsg = `🎉 **Registration Successful!** 🎉\n\n` +
          `Welcome to KissuBot! Let's set up your profile to help you find the perfect match. 💖\n\n` +
          `**Steps to complete your profile:**\n` +
          `1️⃣ Add your name\n` +
          `2️⃣ Add your age\n` +
          `3️⃣ Add a bio\n` +
          `4️⃣ Upload photos`;

        bot.sendMessage(chatId, welcomeMsg, {
          reply_markup: MAIN_KEYBOARD
        });
      } catch (err) {
        console.error('[/register] Full Error:', err);
        bot.sendMessage(
          chatId,
          '❌ Registration failed. Please try again later.\n' +
          'If the problem persists, contact support.'
        );
      } finally {
        delete userRegistrationData[userId];
      }
    }
  });

  // DEACTIVATE command - Deactivate user profile
  bot.onText(/\/deactivate/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    try {
      await User.findOneAndUpdate({ telegramId }, { isActive: false, deactivatedAt: new Date() });
      bot.sendMessage(chatId, '⏸️ Your profile has been deactivated. You can reactivate it anytime by using /start.');
    } catch (err) {
      console.error('Deactivate error:', err);
      bot.sendMessage(chatId, '❌ Failed to deactivate profile. Please try again.');
    }
  });

  // DELETE command - Delete user profile
  bot.onText(/\/delete/, (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    userStates.set(String(telegramId), { awaitingDeleteConfirm: true });
    bot.sendMessage(chatId,
      '🚨 *Are you sure you want to delete your profile?* 🚨\n\n' +
      '⚠️ This will permanently erase *all your matches, messages, and data*.\n\n' +
      '*This action CANNOT be undone.*',
      { parse_mode: 'Markdown', reply_markup: DELETE_CONFIRM_KEYBOARD }
    );
  });

  // Delete confirmation message handler
  bot.on('message', async (msg) => {
    const text = msg.text;
    if (!text || !DELETE_CONFIRM_KB_BUTTONS.includes(text)) return;
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const state = userStates.get(String(telegramId));
    if (!state || !state.awaitingDeleteConfirm) return;

    userStates.delete(String(telegramId));

    if (text === '🗑️ Yes, Delete Forever') {
      try {
        await User.findOneAndDelete({ telegramId });
        invalidateUserCache(telegramId);
        bot.sendMessage(chatId,
          '💔 *Profile Deleted*\n\nYour profile has been permanently deleted. We\'re sorry to see you go.\n\nTap /start anytime to create a new account.',
          { parse_mode: 'Markdown', reply_markup: { remove_keyboard: true } }
        );
      } catch (err) {
        console.error('Delete profile error:', err);
        bot.sendMessage(chatId, '❌ Failed to delete profile. Please try again or contact support.', { reply_markup: MAIN_KEYBOARD });
      }
    } else if (text === '💚 No, Keep My Account') {
      bot.sendMessage(chatId, '✅ *Phew!* Your profile is safe! 😊', { parse_mode: 'Markdown', reply_markup: MAIN_KEYBOARD });
    }
  });

  // Callback query handler for deletion (legacy support)
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const telegramId = query.from.id;
    const data = query.data;

    if (data === 'confirm_delete') {
      try {
        await User.findOneAndDelete({ telegramId });
        invalidateUserCache(telegramId);
        bot.sendMessage(chatId, '💔 Your profile has been permanently deleted.');
      } catch (err) {
        console.error('Delete profile error:', err);
        bot.sendMessage(chatId, '❌ Failed to delete profile. Please try again or contact support.');
      }
    } else if (data === 'cancel_delete') {
      bot.sendMessage(chatId, '✅ Deletion cancelled. Your profile is safe!', { reply_markup: MAIN_KEYBOARD });
    }
  });
}

function getProfileMissing(user) {
  const missing = [];
  if (!user.name) missing.push({ label: 'name', msgText: '📝 Add your name', btnText: '📝 Add Name', callback: 'edit_name' });
  if (!user.gender) missing.push({ label: 'gender', msgText: '👤 Add your gender', btnText: '👤 Add Gender', callback: 'edit_gender' });
  if (!user.lookingFor) missing.push({ label: "what's your preference", msgText: '👀 Add who you are looking for', btnText: '👀 Preferences', callback: 'edit_lookingFor' });
  if (!user.age) missing.push({ label: 'age', msgText: '🎂 Add your age', btnText: '🎂 Add Age', callback: 'edit_age' });
  if (!user.location) missing.push({ label: 'location', msgText: '📍 Add your location', btnText: '📍 Add Location', callback: 'edit_location' });
  if (!user.phone) missing.push({ label: 'phone number', msgText: '📞 Add your phone number', btnText: '📞 Add Phone', callback: 'add_phone_number' });
  if (!user.photos || user.photos.length === 0) missing.push({ label: 'photo', msgText: '📸 Upload at least one photo', btnText: '📸 Upload Photo', callback: 'manage_photos' });
  return missing;
}

module.exports = { setupAuthCommands, invalidateUserCache, handleRegister, getCachedUserProfile, getProfileMissing };

async function handleRegister(bot, msg, User) {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;

  try {
    // Check if user is already registered
    const existingUser = await getCachedUserProfile(telegramId, User);
    if (existingUser) {
      return bot.sendMessage(
        chatId,
        `✅ *You're already registered!*\n\nWelcome back! Choose an action from the menu below.`,
        { parse_mode: 'Markdown', reply_markup: MAIN_KEYBOARD }
      );
    }

    // Start the registration conversation
    userRegistrationData[telegramId] = {
      telegramId,
      username: msg.from.username || '',
      name: msg.from.first_name || '',
      promptingForLocation: true,
    };

    bot.sendMessage(chatId, 'Please enter your location to complete registration:');
  } catch (err) {
    console.error('[/register] Full Error:', err);
    bot.sendMessage(
      chatId,
      '❌ Registration failed. Please try again later.\\n' +
      'If the problem persists, contact support.'
    );
  }
}
