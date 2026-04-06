const axios = require('axios');
const { getCachedUserProfile } = require('./auth');

const { API_BASE } = require('../config');
const userStates = {};

function setupSocialDebugCommands(bot, User, Match, Like, userStates) {

  // Create a test user for matching
  bot.onText(/\/createtestuser/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    try {
      // Generate random test user ID
      const testUserId = String(Math.floor(Math.random() * 900000000) + 100000000);
      
      const testUser = new User({
        telegramId: testUserId,
        username: `testuser_${testUserId.slice(-4)}`,
        name: `Test User ${testUserId.slice(-4)}`,
        gender: Math.random() > 0.5 ? 'Male' : 'Female',
        lookingFor: Math.random() > 0.5 ? 'Male' : 'Female',
        age: Math.floor(Math.random() * 20) + 20,
        location: 'Test City',
        bio: 'This is a test user for testing chat functionality',
        photos: ['https://via.placeholder.com/400x400.png?text=Test+User'],
        profileCompleted: true,
        termsAccepted: true,
        isTestAccount: true,
        coins: 1000,
        isVip: true
      });

      await testUser.save();

      bot.sendMessage(chatId,
        `✅ *Test user created!*\n\n` +
        `📱 Telegram ID: \`${testUserId}\`\n` +
        `👤 Name: ${testUser.name}\n` +
        `🎭 Gender: ${testUser.gender}\n` +
        `📍 Location: ${testUser.location}\n\n` +
        `💡 *To match with this user, use:*\n` +
        `/forcematch ${testUserId}`,
        { parse_mode: 'Markdown' }
      );

    } catch (err) {
      console.error('[createtestuser] Error:', err);
      bot.sendMessage(chatId, '❌ Failed to create test user. Check server logs.');
    }
  });

  bot.onText(/\/forcematch(?:\s+(\d+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const targetId = match && match[1];

    if (!targetId) {
      return bot.sendMessage(chatId, '⚙️ Usage: `/forcematch <telegramId>`\n\nExample: `/forcematch 123456789`', { parse_mode: 'Markdown' });
    }

    try {
      const [fromUser, toUser] = await Promise.all([
        User.findOne({ telegramId: String(telegramId) }),
        User.findOne({ telegramId: String(targetId) })
      ]);

      if (!fromUser) return bot.sendMessage(chatId, '❌ Your account not found. Please /register first.');
      if (!toUser) return bot.sendMessage(chatId, `❌ No user found with Telegram ID \`${targetId}\`.`, { parse_mode: 'Markdown' });

      // Add mutual likes
      if (!fromUser.likes.includes(String(targetId))) fromUser.likes.push(String(targetId));
      if (!toUser.likes.includes(String(telegramId))) toUser.likes.push(String(telegramId));

      // Add mutual matches if not already matched
      const alreadyMatched = (fromUser.matches || []).some(m => String(m.userId) === String(targetId));
      if (!alreadyMatched) {
        fromUser.matches = fromUser.matches || [];
        toUser.matches = toUser.matches || [];
        fromUser.matches.push({ userId: String(targetId), matchedAt: new Date() });
        toUser.matches.push({ userId: String(telegramId), matchedAt: new Date() });
      }

      await Promise.all([fromUser.save(), toUser.save()]);

      const starters = [
        "Ask about their favourite travel destination 🌍",
        "Comment on something from their bio 💬",
        "Ask what they're looking for 💕",
        "Share a fun fact about yourself ✨",
        "Ask about their weekend plans 🎉"
      ];
      const starter = starters[Math.floor(Math.random() * starters.length)];

      // Notify both users with photos
      const fromPhoto = (fromUser.photos || [])[0];
      const toPhoto = (toUser.photos || [])[0];

      // Notify the sender
      if (fromPhoto && toPhoto) {
        await bot.sendMediaGroup(chatId, [
          { type: 'photo', media: fromPhoto, caption: '💖', parse_mode: 'Markdown' },
          { type: 'photo', media: toPhoto, caption: '💖', parse_mode: 'Markdown' }
        ]).catch(() => {});
      } else if (toPhoto) {
        await bot.sendPhoto(chatId, toPhoto).catch(() => {});
      }

      await bot.sendMessage(chatId,
        `🎉💖 *IT'S A MATCH!* 💖🎉\n\nYou and *${toUser.name}* liked each other!\n\n💡 *Conversation starter:*\n${starter}`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '💬 Open Chat', callback_data: `chat_gate_${targetId}` }, { text: '🔍 Keep Swiping', callback_data: 'start_browse' }],
              [{ text: '💌 All Matches', callback_data: 'view_matches' }]
            ]
          }
        }
      );

      // Notify the target user
      try {
        if (fromPhoto && toPhoto) {
          await bot.sendMediaGroup(String(targetId), [
            { type: 'photo', media: toPhoto, caption: '💖', parse_mode: 'Markdown' },
            { type: 'photo', media: fromPhoto, caption: '💖', parse_mode: 'Markdown' }
          ]).catch(() => {});
        } else if (fromPhoto) {
          await bot.sendPhoto(String(targetId), fromPhoto).catch(() => {});
        }

        await bot.sendMessage(String(targetId),
          `🎉💖 *IT'S A MATCH!* 💖🎉\n\n*${fromUser.name}* liked you back!\n\n💡 *Conversation starter:*\n${starter}`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '💬 Open Chat', callback_data: `chat_gate_${telegramId}` }, { text: '🔍 Keep Swiping', callback_data: 'start_browse' }],
                [{ text: '💌 All Matches', callback_data: 'view_matches' }]
              ]
            }
          }
        );
      } catch (e) { /* target may not have started the bot */ }

    } catch (err) {
      console.error('[forcematch] Error:', err);
      bot.sendMessage(chatId, '❌ Force match failed. Check the server logs.');
    }
  });

  // ── 🛠️ DEV MODE — toggle full VIP for testing ──────────────────────
  bot.onText(/\/devmode(?:\s+(on|off))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const telegramId = String(msg.from.id);
    const arg = match && match[1];

    try {
      const user = await User.findOne({ telegramId });
      if (!user) return bot.sendMessage(chatId, '❌ Register first with /start');

      if (!arg) {
        // Show current status
        const status = user.isVip ? '✅ ON' : '❌ OFF';
        return bot.sendMessage(chatId,
          `🛠️ *Dev Mode*\n\nCurrent VIP status: ${status}\n\nUsage:\n\`/devmode on\` — enable full VIP\n\`/devmode off\` — revert to normal`,
          { parse_mode: 'Markdown' }
        );
      }

      if (arg === 'on') {
        await User.findOneAndUpdate({ telegramId }, {
          isVip: true,
          coins: 9999,
          invisibleMode: false,
          'dailySuperLikesVip': { count: 0, date: '' },
          'vipDetails.lastCoinGrantDate': null,
          boostExpiresAt: null,
          lastBoostAt: null
        });
        return bot.sendMessage(chatId,
          `🛠️ *Dev Mode ON*\n\n` +
          `✅ You now have full VIP access:\n` +
          `• 👑 VIP badge active\n` +
          `• 📸 See all photos on browse\n` +
          `• ⭐ 5 free super likes/day\n` +
          `• ↩️ Undo skip after passing\n` +
          `• 🚀 Boost via /vip → My VIP Perks\n` +
          `• 👻 Invisible mode toggle\n` +
          `• 🪙 9999 coins added\n` +
          `• 💌 Matches & chat unlocked\n\n` +
          `Run \`/devmode off\` to revert.`,
          { parse_mode: 'Markdown' }
        );
      }

      if (arg === 'off') {
        await User.findOneAndUpdate({ telegramId }, {
          isVip: false,
          coins: 0,
          invisibleMode: false,
          boostExpiresAt: null
        });
        return bot.sendMessage(chatId,
          `🛠️ *Dev Mode OFF*\n\nReverted to normal user. Run \`/devmode on\` to re-enable.`,
          { parse_mode: 'Markdown' }
        );
      }

    } catch (err) {
      console.error('[devmode] Error:', err);
      bot.sendMessage(chatId, '❌ Dev mode error. Check server logs.');
    }
  });

  bot.onText(/\/stories/, async (msg) => {
    const chatId = msg.chat.id;
    const user = await getCachedUserProfile(chatId);

    if (!user) {
      bot.sendMessage(chatId, 'You need to be registered to use this feature. Please use /start.');
      return;
    }

    const storiesMenu = {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'View Stories', callback_data: 'view_stories' }],
          [{ text: 'Post a Story', callback_data: 'post_story' }],
          [{ text: 'My Stories', callback_data: 'my_stories' }],
          [{ text: 'Help', callback_data: 'stories_help' }]
        ]
      }
    };

    bot.sendMessage(chatId, 'Welcome to Stories! What would you like to do?', storiesMenu);
  });

  bot.on('callback_query', async (callbackQuery) => {
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;
    const data = callbackQuery.data;

    if (data === 'post_story') {
      bot.sendMessage(chatId, 'Please send the photo or video for your story.');
    }

    if (data.startsWith('delete_story_')) {
      const storyId = data.split('_')[2];
      try {
        await axios.delete(`${API_BASE}/stories/${storyId}`);
        bot.editMessageText("Story deleted successfully.", {
          chat_id: msg.chat.id,
          message_id: msg.message_id
        });
      } catch (error) {
        console.error('Error deleting story:', error);
        bot.sendMessage(msg.chat.id, "There was an error deleting your story. Please try again later.");
      }
    }
  });

  const handleStory = async (msg) => {
    const chatId = msg.chat.id;
    const storyType = msg.photo ? 'photo' : 'video';
    const fileId = storyType === 'photo' ? msg.photo[msg.photo.length - 1].file_id : msg.video.file_id;

    try {
      await axios.post(`${API_BASE}/stories`, {
        telegramId: chatId,
        story: fileId,
        storyType: storyType
      });
      bot.sendMessage(chatId, "Your story has been posted successfully!");
    } catch (error) {
      console.error('Error posting story:', error);
      bot.sendMessage(chatId, "There was an error posting your story. Please try again later.");
    }
  };

  // Only handle photos when user is posting a story
  bot.on('photo', (msg) => {
    const userState = userStates.get(msg.from.id);
    if (userState?.action === 'uploading_story') {
      handleStory(msg);
    }
  });
  bot.on('video', handleStory);
}

module.exports = { setupSocialDebugCommands };