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
      const user = await User.findOne({ telegramId });

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

        const onboardingModule = require('./onboarding');
        if (onboardingModule.startOnboarding) {
          return await onboardingModule.startOnboarding(chatId, telegramId);
        }
      }

      // 2. Compute profile completeness from actual fields
      const missing = [];
      if (!user.name) missing.push('📝 Add your name');
      if (!user.age) missing.push('🎂 Add your age');
      if (!user.location) missing.push('📍 Add your location');
      if (!user.phone) missing.push('📞 Add your phone number');
      if (!user.photos || user.photos.length === 0) missing.push('📸 Upload at least one photo');

      // Profile still incomplete — show what's missing
      if (missing.length > 0) {
        const incompleteMsg = `✨ **Almost Ready!** ✨\n\n` +
          `You're just one step away from finding your perfect match!\n\n` +
          `📋 **What's Missing:**\n` +
          `${missing.join('\n')}\n\n` +
          `💡 Complete your profile to start browsing and matching! 💕`;

        return bot.sendMessage(chatId, incompleteMsg, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '📸 Upload Photo', callback_data: 'manage_photos' }],
              [{ text: '👤 View My Profile', callback_data: 'view_my_profile' }]
            ]
          }
        });
      }

      // All fields are present → mark profile as complete if flag is stale
      if (!user.profileCompleted) {
        User.findOneAndUpdate({ telegramId }, { profileCompleted: true }).catch(() => { });
      }

      // Profile complete - show main menu
      showMainMenu(chatId, msg.from.first_name);

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
          reply_markup: {
            inline_keyboard: [
              [{ text: '✏️ Setup Profile', callback_data: 'edit_profile' }],
              [{ text: '🏠 Main Menu', callback_data: 'main_menu' }]
            ]
          }
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

    const deleteWarningMsg = '🚨 **ARE YOU SURE?** 🚨\n\n' +
      'This will permanently delete your profile, including all matches and data.\n\n' +
      'This action CANNOT be undone.';

    const opts = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🗑️ Yes, Delete My Profile', callback_data: 'confirm_delete' },
            { text: '❌ No, Keep My Profile', callback_data: 'cancel_delete' }
          ]
        ]
      }
    };

    bot.sendMessage(chatId, deleteWarningMsg, opts);
  });

  // Callback query handler for deletion
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const telegramId = query.from.id;
    const data = query.data;

    if (data === 'confirm_delete') {
      try {
        await User.findOneAndDelete({ telegramId });
        invalidateUserCache(telegramId);
        bot.sendMessage(chatId, '💔 Your profile has been permanently deleted. We\'re sorry to see you go.');
      } catch (err) {
        console.error('Delete profile error:', err);
        bot.sendMessage(chatId, '❌ Failed to delete profile. Please try again or contact support.');
      }
    } else if (data === 'cancel_delete') {
      bot.sendMessage(chatId, '✅ Deletion cancelled. Your profile is safe!');
    }
  });
}

module.exports = { setupAuthCommands, invalidateUserCache, handleRegister, getCachedUserProfile };

async function handleRegister(bot, msg, User) {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;

  try {
    // Check if user is already registered
    const existingUser = await getCachedUserProfile(telegramId, User);
    if (existingUser) {
      return bot.sendMessage(
        chatId,
        `✅ **You're already registered!**\n\n` +
        `Ready to find your match? Choose an action below:`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔍 Start Browsing', callback_data: 'browse_profiles' }],
              [{ text: '👤 My Profile', callback_data: 'view_profile' }],
              [{ text: '🏠 Main Menu', callback_data: 'main_menu' }]
            ]
          }
        }
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
