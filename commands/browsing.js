const { getCachedUserProfile } = require('./auth');

function setupBrowsingCommands(bot, User, Match, Like) {

  // ─────────────────────────────────────────
  // Shared helper: check if user profile is ready to browse
  // ─────────────────────────────────────────
  function getProfileMissing(user) {
    const missing = [];
    if (!user.name) missing.push('📝 Add your name (/setname)');
    if (!user.age) missing.push('🎂 Add your age (/setage)');
    if (!user.location) missing.push('📍 Add your location (/setlocation)');
    if (!user.bio) missing.push('💬 Write a bio (/setbio)');
    if (!user.photos || user.photos.length === 0) missing.push('📸 Upload at least one photo');
    return missing;
  }

  // ─────────────────────────────────────────
  // Core browse function — shows next profile
  // ─────────────────────────────────────────
  async function browseProfiles(chatId, telegramId) {
    try {
      const user = await getCachedUserProfile(telegramId, User);

      if (!user) {
        return bot.sendMessage(chatId, '❌ User not found. Use /start to begin.');
      }

      if (!user.termsAccepted) {
        return bot.sendMessage(chatId,
          '⚠️ **Terms Required**\n\nAccept our Terms of Service to use KissuBot.',
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🏠 Main Menu', callback_data: 'main_menu' }]
              ]
            }
          }
        );
      }

      // Check completeness directly — don't trust the profileCompleted flag
      const missing = getProfileMissing(user);
      if (missing.length > 0) {
        return bot.sendMessage(chatId,
          '✨ **Almost Ready!**\n\n' +
          'Complete your profile to start browsing:\n\n' +
          `📋 **Missing:**\n${missing.join('\n')}`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '📸 Upload Photo', callback_data: 'manage_photos' }, { text: '✏️ Edit Profile', callback_data: 'edit_profile' }],
                [{ text: '🏠 Main Menu', callback_data: 'main_menu' }]
              ]
            }
          }
        );
      }

      // Get already liked/passed profile IDs to skip them
      const currentUser = await User.findOne({ telegramId });
      if (!currentUser) return bot.sendMessage(chatId, '❌ User not found.');

      const likedIds = await Like.find({ fromUserId: currentUser._id }).distinct('toUserId');

      // Build query: exclude self, already liked/passed, filter active users
      let profileQuery = User.find({
        telegramId: { $ne: telegramId },
        _id: { $nin: likedIds },
        name: { $exists: true, $ne: null },
        age: { $exists: true, $ne: null },
        photos: { $exists: true, $not: { $size: 0 } }
      });

      if (!currentUser.isVip) {
        profileQuery = profileQuery.limit(10);
      }

      const profiles = await profileQuery;

      if (!profiles || profiles.length === 0) {
        return bot.sendMessage(chatId,
          '😔 **No More Profiles**\n\n' +
          "You've seen everyone available right now!\n\n" +
          '💡 Check back later as new users join Kissubot.',
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '💕 View Matches', callback_data: 'view_matches' }, { text: '🏠 Main Menu', callback_data: 'main_menu' }]
              ]
            }
          }
        );
      }

      // Pick a random profile for variety
      const profile = profiles[Math.floor(Math.random() * profiles.length)];
      const profileId = profile.telegramId;

      const profileMsg =
        `💕 **${profile.name}, ${profile.age}**\n` +
        `📍 ${profile.location}\n\n` +
        `💬 ${profile.bio || 'No bio yet'}`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: '💚 LIKE', callback_data: `like_${profileId}` },
            { text: '💔 PASS', callback_data: `pass_${profileId}` }
          ],
          [
            { text: '⭐ SUPER LIKE', callback_data: `superlike_${profileId}` },
            { text: '🏠 Menu', callback_data: 'main_menu' }
          ]
        ]
      };

      if (profile.photos && profile.photos.length > 0) {
        await bot.sendPhoto(chatId, profile.photos[0], {
          caption: profileMsg,
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
      } else {
        await bot.sendMessage(chatId, profileMsg, {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
      }

    } catch (err) {
      console.error('[Browse] Error:', err);
      return bot.sendMessage(chatId, '❌ Failed to load profiles. Please try again.');
    }
  }

  // ─────────────────────────────────────────
  // /browse command
  // ─────────────────────────────────────────
  bot.onText(/\/browse/, async (msg) => {
    await browseProfiles(msg.chat.id, msg.from.id);
  });

  // ─────────────────────────────────────────
  // /matches command
  // ─────────────────────────────────────────
  bot.onText(/\/matches/, async (msg) => {
    await showMatches(msg.chat.id, msg.from.id);
  });

  async function showMatches(chatId, telegramId) {
    try {
      const user = await User.findOne({ telegramId });
      if (!user) return bot.sendMessage(chatId, '❌ User not found.');

      const matches = await Match.find({
        $or: [{ user1Id: user._id }, { user2Id: user._id }]
      }).populate('user1Id').populate('user2Id');

      if (!matches || matches.length === 0) {
        return bot.sendMessage(chatId,
          '💞 **No Matches Yet**\n\nKeep browsing to find your perfect match! 💕',
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔍 Start Browsing', callback_data: 'start_browse' }, { text: '✏️ Edit Profile', callback_data: 'edit_profile' }],
                [{ text: '🏠 Main Menu', callback_data: 'main_menu' }]
              ]
            }
          }
        );
      }

      let matchMsg = `💕 **YOUR MATCHES (${matches.length})** 💕\n\n`;
      matches.slice(0, 10).forEach((match, index) => {
        const other = match.user1Id.telegramId === telegramId ? match.user2Id : match.user1Id;
        matchMsg += `${index + 1}. **${other.name}**, ${other.age} · 📍 ${other.location}\n`;
        if (other.bio) matchMsg += `   💬 ${other.bio.substring(0, 60)}${other.bio.length > 60 ? '...' : ''}\n`;
        matchMsg += '\n';
      });

      if (matches.length > 10) matchMsg += `_...and ${matches.length - 10} more matches!_`;

      const matchButtons = matches.slice(0, 5).map(match => {
        const other = match.user1Id.telegramId === telegramId ? match.user2Id : match.user1Id;
        return [{ text: `💬 Chat with ${other.name}`, url: `tg://user?id=${other.telegramId}` }];
      });
      matchButtons.push([{ text: '🔍 Browse More', callback_data: 'start_browse' }, { text: '🏠 Menu', callback_data: 'main_menu' }]);

      bot.sendMessage(chatId, matchMsg, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: matchButtons }
      });

    } catch (err) {
      console.error('[Matches] Error:', err);
      bot.sendMessage(chatId, '❌ Failed to load matches. Please try again later.');
    }
  }

  // ─────────────────────────────────────────
  // Callback query handler
  // ─────────────────────────────────────────
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const telegramId = query.from.id;
    const data = query.data;
    const messageId = query.message.message_id;

    if (!data) return;

    try {
      // ── LIKE ──
      if (data.startsWith('like_')) {
        const targetTelegramId = data.replace('like_', '');

        const fromUser = await User.findOne({ telegramId });
        const toUser = await User.findOne({ telegramId: targetTelegramId });

        if (!fromUser || !toUser) return bot.sendMessage(chatId, '❌ User not found.');

        // Remove buttons from the liked profile card
        bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: messageId }).catch(() => { });

        // Save the like
        await Like.findOneAndUpdate(
          { fromUserId: fromUser._id, toUserId: toUser._id },
          { fromUserId: fromUser._id, toUserId: toUser._id },
          { upsert: true }
        );

        // Check for mutual like → match
        const mutualLike = await Like.findOne({ fromUserId: toUser._id, toUserId: fromUser._id });

        if (mutualLike) {
          // Create match (if not already exists)
          const existingMatch = await Match.findOne({
            $or: [
              { user1Id: fromUser._id, user2Id: toUser._id },
              { user1Id: toUser._id, user2Id: fromUser._id }
            ]
          });

          if (!existingMatch) {
            await Match.create({ user1Id: fromUser._id, user2Id: toUser._id });
          }

          const starters = [
            "Ask about their favourite travel destination 🌍",
            "Comment on something from their bio 💬",
            "Ask what they're looking for 💕",
            "Share a fun fact about yourself ✨",
            "Ask about their weekend plans 🎉"
          ];
          const starter = starters[Math.floor(Math.random() * starters.length)];

          await bot.sendMessage(chatId,
            `🎉💖 **IT'S A MATCH!** 💖🎉\n\n` +
            `You and **${toUser.name}** liked each other!\n\n` +
            `💡 **Conversation Starter:**\n${starter}`,
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: '💬 Open Chat', url: `tg://user?id=${targetTelegramId}` },
                    { text: '💌 All Matches', callback_data: 'view_matches' }
                  ],
                  [{ text: '🔍 Keep Browsing', callback_data: 'start_browse' }]
                ]
              }
            }
          );
        } else {
          // No match yet — show brief message then auto-load next profile
          await bot.sendMessage(chatId,
            `❤️ Liked! Keep swiping...`,
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '➡️ Next Profile', callback_data: 'start_browse' }, { text: '💌 Matches', callback_data: 'view_matches' }]
                ]
              }
            }
          );
        }

        // ── PASS ──
      } else if (data.startsWith('pass_')) {
        // Remove buttons
        bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: messageId }).catch(() => { });

        const targetTelegramId = data.replace('pass_', '');
        const fromUser = await User.findOne({ telegramId });
        const toUser = await User.findOne({ telegramId: targetTelegramId });

        // Store pass so we don't show this profile again
        if (fromUser && toUser) {
          await Like.findOneAndUpdate(
            { fromUserId: fromUser._id, toUserId: toUser._id },
            { fromUserId: fromUser._id, toUserId: toUser._id, passed: true },
            { upsert: true }
          );
        }

        // Auto-show next profile immediately
        await browseProfiles(chatId, telegramId);

        // ── SUPER LIKE ──
      } else if (data.startsWith('superlike_')) {
        const targetTelegramId = data.replace('superlike_', '');
        const fromUser = await User.findOne({ telegramId });

        if (!fromUser) return bot.sendMessage(chatId, '❌ User not found.');

        if (fromUser.coins < 10) {
          return bot.sendMessage(chatId,
            '❌ **Not Enough Coins**\n\nYou need 10 coins to send a Super Like.',
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '💰 Buy Coins', callback_data: 'buy_coins' }, { text: '🔍 Browse', callback_data: 'start_browse' }]
                ]
              }
            }
          );
        }

        const toUser = await User.findOne({ telegramId: targetTelegramId });
        if (!toUser) return bot.sendMessage(chatId, '❌ User not found.');

        fromUser.coins -= 10;
        await fromUser.save();

        bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: messageId }).catch(() => { });

        // Save super like
        await Like.findOneAndUpdate(
          { fromUserId: fromUser._id, toUserId: toUser._id },
          { fromUserId: fromUser._id, toUserId: toUser._id, superLike: true },
          { upsert: true }
        );

        // Notify the target user
        try {
          await bot.sendMessage(targetTelegramId,
            `⭐ **Someone Super Liked You!**\n\n` +
            `**${fromUser.name}** thinks you're special!\n\n` +
            `Browse their profile to see if you're interested! 💕`,
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🔍 Browse Profiles', callback_data: 'start_browse' }]
                ]
              }
            }
          );
        } catch (e) { /* user may have blocked bot */ }

        await bot.sendMessage(chatId, `⭐ Super Like sent to **${toUser.name}**! They've been notified.`, { parse_mode: 'Markdown' });

        // Auto-load next profile
        await browseProfiles(chatId, telegramId);

        // ── CHAT ──
      } else if (data.startsWith('chat_')) {
        const targetTelegramId = data.replace('chat_', '');
        bot.sendMessage(chatId,
          '💬 **Open a direct chat:**',
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '💬 Open Chat', url: `tg://user?id=${targetTelegramId}` }],
                [{ text: '🔙 Back to Matches', callback_data: 'view_matches' }]
              ]
            }
          }
        );

        // ── UNMATCH ──
      } else if (data.startsWith('unmatch_')) {
        const targetTelegramId = data.replace('unmatch_', '');
        const fromUser = await User.findOne({ telegramId });
        const toUser = await User.findOne({ telegramId: targetTelegramId });

        if (fromUser && toUser) {
          await Match.deleteOne({
            $or: [
              { user1Id: fromUser._id, user2Id: toUser._id },
              { user1Id: toUser._id, user2Id: fromUser._id }
            ]
          });
          bot.sendMessage(chatId, '💔 **Unmatched.**\n\nYou can always find new matches!', {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔍 Browse Profiles', callback_data: 'start_browse' }, { text: '🏠 Main Menu', callback_data: 'main_menu' }]
              ]
            }
          });
        } else {
          bot.sendMessage(chatId, '❌ Failed to unmatch. Please try again.');
        }

        // ── VIEW MATCHES (in-callback) ──
      } else if (data === 'view_matches') {
        await showMatches(chatId, telegramId);

        // ── START BROWSE (in-callback) ──
      } else if (data === 'start_browse') {
        await browseProfiles(chatId, telegramId);
      }

    } catch (err) {
      console.error('[Browsing callback] Error:', err);
      bot.sendMessage(chatId, '❌ Something went wrong. Please try again.');
    }
  });

  // Export browseProfiles so profile.js can call it directly
  module.exports.browseProfiles = browseProfiles;
}

module.exports = { setupBrowsingCommands };
