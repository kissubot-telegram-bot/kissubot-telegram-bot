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
  // START command - Simple welcome message
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, '🎉 Welcome to Kisu1bot! 🎉\n\n' +
      '💕 Your journey to find love starts here!\n\n' +
      '🚀 **Get Started:**\n' +
      '• Use /register to create your dating profile\n' +
      '• Use /help for guidance and support\n\n' +
      'Ready to meet someone special? Let\'s begin! 💖');
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

        const welcomeMsg = `🎉 Registration successful!

Let's set up your profile:
1️⃣ Use /setname to set your display name
2️⃣ Use /setage to set your age
3️⃣ Use /setbio to write about yourself

After setting up your profile, you can:
• Use /browse to find people
• Use /matches to see your matches`;

        bot.sendMessage(chatId, welcomeMsg);
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
        `✅ You're already registered!

You can:
• Use /profile to view your profile
• Use /browse to find people
• Use /matches to see your matches`
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
