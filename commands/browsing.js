/**
 * browsing.js — Swipe-style profile browsing
 *
 * Card format:
 *   📸 Photo (or text card with name/age/city/bio)
 *   [ ❤️ Like ]  [ ❌ Skip ]
 *   [ 🚩 Report ][ ⛔ Block ]
 *
 * Flow:
 *   Like  → anti-spam check → save like → check mutual → match OR liked+next
 *   Skip  → remove buttons → load next immediately
 *   Report→ hands off to report.js callback
 *   Block → hands off to report.js callback
 *
 * Match event → notify BOTH users simultaneously
 */

const { getCachedUserProfile, invalidateUserCache } = require('./auth');
const { canLike, recordLike } = require('./antiSpam');
const axios = require('axios');

// Try to load API_BASE from config (optional — stats calls are fire-and-forget)
let API_BASE = '';
try { API_BASE = require('../config').API_BASE; } catch (e) { }

function setupBrowsingCommands(bot, User, Match, Like) {

  // ─────────────────────────────────────────────────────────────────────
  // Profile completeness check
  // ─────────────────────────────────────────────────────────────────────
  function getProfileMissing(user) {
    const missing = [];
    if (!user.name) missing.push('📝 Add your name');
    if (!user.gender) missing.push('👤 Add your gender');
    if (!user.lookingFor) missing.push('👀 Add who you are looking for');
    if (!user.age) missing.push('🎂 Add your age');
    if (!user.location) missing.push('📍 Add your location');
    if (!user.phone) missing.push('📞 Add your phone number');
    if (!user.photos || user.photos.length === 0) missing.push('📸 Upload at least one photo');
    return missing;
  }

  // ─────────────────────────────────────────────────────────────────────
  // Build the 4-button inline keyboard for a profile card
  // ─────────────────────────────────────────────────────────────────────
  function buildProfileKeyboard(profileId) {
    return {
      inline_keyboard: [
        [
          { text: '❤️ Like', callback_data: `like_${profileId}` },
          { text: '❌ Skip', callback_data: `pass_${profileId}` }
        ],
        [
          { text: '🚩 Report', callback_data: `report_${profileId}` },
          { text: '⛔ Block', callback_data: `block_${profileId}` }
        ]
      ]
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // Build the caption for a profile card
  // ─────────────────────────────────────────────────────────────────────
  function buildProfileCaption(profile) {
    const bio = profile.bio
      ? (profile.bio.length > 100 ? profile.bio.substring(0, 97) + '...' : profile.bio)
      : 'No bio yet 🤷';
    return (
      `💕 *${profile.name}*, ${profile.age}\n` +
      `📍 ${profile.location}\n\n` +
      `💬 ${bio}`
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // Fire-and-forget stats call (doesn't block the flow on error)
  // ─────────────────────────────────────────────────────────────────────
  function trackLike(fromId, toId) {
    if (!API_BASE) return;
    axios.post(`${API_BASE}/stats/like`, { fromId: String(fromId), toId: String(toId) }).catch(() => { });
  }

  function trackMatch(user1Id, user2Id) {
    if (!API_BASE) return;
    axios.post(`${API_BASE}/stats/match`, { user1Id: String(user1Id), user2Id: String(user2Id) }).catch(() => { });
  }

  // ─────────────────────────────────────────────────────────────────────
  // Core browse function — shows next profile card
  // ─────────────────────────────────────────────────────────────────────
  async function browseProfiles(chatId, telegramId) {
    try {
      const user = await getCachedUserProfile(telegramId, User);

      if (!user) {
        return bot.sendMessage(chatId,
          '❌ User not found. Please click Start to begin.',
          { reply_markup: { inline_keyboard: [[{ text: '🚀 Start', callback_data: 'main_menu' }]] } }
        );
      }

      if (!user.termsAccepted) {
        return bot.sendMessage(chatId,
          '⚠️ *Terms Required*\n\nAccept our Terms of Service to use KissuBot.',
          {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '🏠 Main Menu', callback_data: 'main_menu' }]] }
          }
        );
      }

      // Check real completeness — don't trust the flag alone
      const missing = getProfileMissing(user);
      if (missing.length > 0) {
        return bot.sendMessage(chatId,
          '✨ *Almost Ready!*\n\n' +
          'Complete your profile to start browsing:\n\n' +
          `📋 *Missing:*\n${missing.join('\n')}`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '📸 Upload Photo', callback_data: 'manage_photos' }, { text: '✏️ Edit Profile', callback_data: 'edit_profile' }],
                [{ text: '🏠 Main Menu', callback_data: 'main_menu' }]
              ]
            }
          }
        );
      }

      const currentUser = await User.findOne({ telegramId });
      if (!currentUser) return bot.sendMessage(chatId, '❌ User not found.');

      // Build list of IDs to exclude: self + anyone they've liked/passed + anyone they've blocked + anyone who blocked them
      const blockedByMe = (currentUser.blocked || []).map(b => b.userId);

      let excludeIds = [...blockedByMe];
      if (Like) {
        const likedIds = await Like.find({ fromUserId: currentUser._id }).distinct('toUserId');
        excludeIds = [...excludeIds, ...likedIds.map(String)];
      } else {
        // Fallback: exclude users already in matches array
        excludeIds = [...excludeIds, ...(currentUser.matches || []).map(m => m.userId)];
      }

      // Also exclude users who have blocked the current user
      const usersWhoBlockedMe = await User.find({
        'blocked.userId': String(telegramId)
      }).select('telegramId');
      const blockedMeIds = usersWhoBlockedMe.map(u => u.telegramId);
      excludeIds = [...excludeIds, ...blockedMeIds];

      // Query: exclude self, all excluded IDs, require complete profiles
      let profileQuery = User.find({
        telegramId: { $ne: String(telegramId), $nin: excludeIds },
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
          '😔 *No More Profiles*\n\n' +
          "You've seen everyone available right now!\n\n" +
          '💡 Check back later as new users join Kissubot.',
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '💕 View Matches', callback_data: 'view_matches' }, { text: '🏠 Main Menu', callback_data: 'main_menu' }]
              ]
            }
          }
        );
      }

      // Pick one profile at random for variety
      const profile = profiles[Math.floor(Math.random() * profiles.length)];
      const caption = buildProfileCaption(profile);
      const keyboard = buildProfileKeyboard(profile.telegramId);

      if (profile.photos && profile.photos.length > 0) {
        await bot.sendPhoto(chatId, profile.photos[0], {
          caption,
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
      } else {
        await bot.sendMessage(chatId, caption, {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
      }

    } catch (err) {
      console.error('[Browse] Error:', err);
      return bot.sendMessage(chatId, '❌ Failed to load profiles. Please try again.');
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // /browse command
  // ─────────────────────────────────────────────────────────────────────
  bot.onText(/\/browse/, async (msg) => {
    await browseProfiles(msg.chat.id, msg.from.id);
  });

  // ─────────────────────────────────────────────────────────────────────
  // /matches command
  // ─────────────────────────────────────────────────────────────────────
  bot.onText(/\/matches/, async (msg) => {
    await showMatches(msg.chat.id, msg.from.id);
  });

  async function showMatches(chatId, telegramId) {
    try {
      const user = await User.findOne({ telegramId });
      if (!user) return bot.sendMessage(chatId, '❌ User not found.');

      const matches = user.matches || [];

      if (!matches || matches.length === 0) {
        return bot.sendMessage(chatId,
          '💞 *No Matches Yet*\n\nKeep browsing to find your perfect match! 💕',
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔍 Start Browsing', callback_data: 'start_browse' }, { text: '✏️ Edit Profile', callback_data: 'edit_profile' }],
                [{ text: '🏠 Main Menu', callback_data: 'main_menu' }]
              ]
            }
          }
        );
      }

      // Fetch details for each match
      const matchDetails = await Promise.all(
        matches.map(async (match) => {
          const other = await User.findOne({ telegramId: match.userId });
          if (!other) return null;
          return { match, other };
        })
      );

      const valid = matchDetails.filter(Boolean);

      let matchMsg = `💕 *YOUR MATCHES (${valid.length})* 💕\n\n`;
      valid.slice(0, 10).forEach(({ match, other }, index) => {
        matchMsg += `${index + 1}. *${other.name}*, ${other.age} · 📍 ${other.location}\n`;
        if (other.bio) matchMsg += `   💬 ${other.bio.substring(0, 60)}${other.bio.length > 60 ? '...' : ''}\n`;
        matchMsg += '\n';
      });

      if (valid.length > 10) matchMsg += `_...and ${valid.length - 10} more matches!_`;

      const matchButtons = valid.slice(0, 5).map(({ match, other }) => ([{
        text: `💬 Chat with ${other.name}`,
        url: `tg://user?id=${other.telegramId}`
      }]));
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

  // ─────────────────────────────────────────────────────────────────────
  // Notify the OTHER user about a match (background, non-blocking)
  // ─────────────────────────────────────────────────────────────────────
  async function notifyMatchedUser(otherTelegramId, myUser) {
    try {
      const starters = [
        "Ask about their favourite travel destination 🌍",
        "Comment on something from their bio 💬",
        "Ask what they're looking for 💕",
        "Share a fun fact about yourself ✨",
        "Ask about their weekend plans 🎉"
      ];
      const starter = starters[Math.floor(Math.random() * starters.length)];

      await bot.sendMessage(
        otherTelegramId,
        `🎉💖 *IT'S A MATCH!* 💖🎉\n\n` +
        `*${myUser.name}* liked you back!\n\n` +
        `💡 *Conversation starter:*\n${starter}`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '💬 Open Chat', url: `tg://user?id=${myUser.telegramId}` },
                { text: '🔍 Keep Swiping', callback_data: 'start_browse' }
              ],
              [{ text: '💌 All Matches', callback_data: 'view_matches' }]
            ]
          }
        }
      );
    } catch (e) {
      // User may have blocked the bot — ignore silently
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // Callback query handler
  // ─────────────────────────────────────────────────────────────────────
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const telegramId = query.from.id;
    const data = query.data;
    const messageId = query.message.message_id;

    if (!data) return;

    // Skip callbacks handled by other modules
    if (data.startsWith('report_') || data.startsWith('block_') || data.startsWith('onboard_')) return;

    try {
      await bot.answerCallbackQuery(query.id).catch(() => { });

      // ── ❤️ LIKE ──────────────────────────────────────────────────────
      if (data.startsWith('like_')) {
        const targetTelegramId = data.replace('like_', '');

        // Rate limit check
        if (!canLike(telegramId)) {
          await bot.sendMessage(chatId, '⏳ Slow down a bit! Wait a second before liking again.');
          return;
        }
        recordLike(telegramId);

        const [fromUser, toUser] = await Promise.all([
          User.findOne({ telegramId }),
          User.findOne({ telegramId: targetTelegramId })
        ]);

        if (!fromUser || !toUser) return bot.sendMessage(chatId, '❌ User not found.');

        // Remove buttons immediately (fast UX)
        bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: messageId }).catch(() => { });

        // Record the like
        if (Like) {
          await Like.findOneAndUpdate(
            { fromUserId: fromUser._id, toUserId: toUser._id },
            { fromUserId: fromUser._id, toUserId: toUser._id },
            { upsert: true }
          );
        } else {
          // Fallback: store in user.likes array
          if (!toUser.likes.includes(String(telegramId))) {
            toUser.likes.push(String(telegramId));
            await toUser.save();
          }
        }

        // Track stats (fire-and-forget)
        trackLike(telegramId, targetTelegramId);

        // Check for mutual like → MATCH
        const isMutualLike = Like
          ? !!(await Like.findOne({ fromUserId: toUser._id, toUserId: fromUser._id }))
          : (fromUser.likes || []).includes(String(targetTelegramId));

        if (isMutualLike) {
          // Save match for both users (if not already matched)
          const alreadyMatched = (fromUser.matches || []).some(m => String(m.userId) === String(targetTelegramId));

          if (!alreadyMatched) {
            fromUser.matches = fromUser.matches || [];
            toUser.matches = toUser.matches || [];
            fromUser.matches.push({ userId: String(targetTelegramId), matchedAt: new Date() });
            toUser.matches.push({ userId: String(telegramId), matchedAt: new Date() });
            await Promise.all([fromUser.save(), toUser.save()]);
            invalidateUserCache(telegramId);
            invalidateUserCache(targetTelegramId);
            trackMatch(telegramId, targetTelegramId);
          }

          const starters = [
            "Ask about their favourite travel destination 🌍",
            "Comment on something from their bio 💬",
            "Ask what they're looking for 💕",
            "Share a fun fact about yourself ✨",
            "Ask about their weekend plans 🎉"
          ];
          const starter = starters[Math.floor(Math.random() * starters.length)];

          // ── Show "It's a Match!" to the liker ──────────────────────
          await bot.sendMessage(chatId,
            `🎉💖 *IT'S A MATCH!* 💖🎉\n\n` +
            `You and *${toUser.name}* liked each other!\n\n` +
            `💡 *Conversation starter:*\n${starter}`,
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: '💬 Open Chat', url: `tg://user?id=${targetTelegramId}` },
                    { text: '🔍 Keep Swiping', callback_data: 'start_browse' }
                  ],
                  [{ text: '💌 All Matches', callback_data: 'view_matches' }]
                ]
              }
            }
          );

          // ── Notify the OTHER user too (background) ─────────────────
          notifyMatchedUser(targetTelegramId, fromUser);

        } else {
          // No match yet — quick feedback then next profile
          await bot.sendMessage(chatId,
            '❤️ Liked! Loading next profile...',
            { reply_markup: { inline_keyboard: [[{ text: '💌 Matches', callback_data: 'view_matches' }]] } }
          );
          await browseProfiles(chatId, telegramId);
        }

        // ── ❌ SKIP / PASS ────────────────────────────────────────────────
      } else if (data.startsWith('pass_')) {
        const targetTelegramId = data.replace('pass_', '');

        // Remove buttons instantly
        bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: messageId }).catch(() => { });

        // Record pass so we don't show this profile again
        const fromUser = await User.findOne({ telegramId });
        const toUser = await User.findOne({ telegramId: targetTelegramId });

        if (fromUser && toUser) {
          if (Like) {
            await Like.findOneAndUpdate(
              { fromUserId: fromUser._id, toUserId: toUser._id },
              { fromUserId: fromUser._id, toUserId: toUser._id, passed: true },
              { upsert: true }
            );
          }
        }

        // Instantly show next profile
        await browseProfiles(chatId, telegramId);

        // ── ⭐ SUPER LIKE ─────────────────────────────────────────────────
      } else if (data.startsWith('superlike_')) {
        const targetTelegramId = data.replace('superlike_', '');
        const fromUser = await User.findOne({ telegramId });

        if (!fromUser) return bot.sendMessage(chatId, '❌ User not found.');

        if ((fromUser.coins || 0) < 10) {
          return bot.sendMessage(chatId,
            '❌ *Not Enough Coins*\n\nYou need 10 coins to send a Super Like.',
            {
              parse_mode: 'Markdown',
              reply_markup: { inline_keyboard: [[{ text: '💰 Buy Coins', callback_data: 'buy_coins' }, { text: '🔍 Browse', callback_data: 'start_browse' }]] }
            }
          );
        }

        const toUser = await User.findOne({ telegramId: targetTelegramId });
        if (!toUser) return bot.sendMessage(chatId, '❌ User not found.');

        fromUser.coins -= 10;
        await fromUser.save();
        bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: messageId }).catch(() => { });

        if (Like) {
          await Like.findOneAndUpdate(
            { fromUserId: fromUser._id, toUserId: toUser._id },
            { fromUserId: fromUser._id, toUserId: toUser._id, superLike: true },
            { upsert: true }
          );
        }

        // Notify target user
        try {
          await bot.sendMessage(targetTelegramId,
            `⭐ *Someone Super Liked You!*\n\n` +
            `*${fromUser.name}* thinks you're special!\n\n` +
            `Browse their profile to see if you're interested! 💕`,
            {
              parse_mode: 'Markdown',
              reply_markup: { inline_keyboard: [[{ text: '🔍 Browse Profiles', callback_data: 'start_browse' }]] }
            }
          );
        } catch (e) { /* user may have blocked bot */ }

        await bot.sendMessage(chatId,
          `⭐ Super Like sent to *${toUser.name}*! They've been notified.`,
          { parse_mode: 'Markdown' }
        );

        await browseProfiles(chatId, telegramId);

        // ── 💬 CHAT ───────────────────────────────────────────────────────
      } else if (data.startsWith('chat_')) {
        const targetTelegramId = data.replace('chat_', '');
        bot.sendMessage(chatId,
          '💬 *Open a direct chat:*',
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '💬 Open Chat', url: `tg://user?id=${targetTelegramId}` }],
                [{ text: '🔙 Back to Matches', callback_data: 'view_matches' }]
              ]
            }
          }
        );

        // ── 💔 UNMATCH ────────────────────────────────────────────────────
      } else if (data.startsWith('unmatch_')) {
        const targetTelegramId = data.replace('unmatch_', '');
        const fromUser = await User.findOne({ telegramId });
        const toUser = await User.findOne({ telegramId: targetTelegramId });

        if (fromUser && toUser) {
          fromUser.matches = (fromUser.matches || []).filter(m => String(m.userId) !== String(targetTelegramId));
          toUser.matches = (toUser.matches || []).filter(m => String(m.userId) !== String(telegramId));
          await Promise.all([fromUser.save(), toUser.save()]);
          invalidateUserCache(telegramId);
          invalidateUserCache(targetTelegramId);

          bot.sendMessage(chatId, '💔 *Unmatched.*\n\nYou can always find new matches!', {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '🔍 Browse Profiles', callback_data: 'start_browse' }, { text: '🏠 Main Menu', callback_data: 'main_menu' }]] }
          });
        } else {
          bot.sendMessage(chatId, '❌ Failed to unmatch. Please try again.');
        }

        // ── 👀 VIEW MATCHES ───────────────────────────────────────────────
      } else if (data === 'view_matches') {
        await showMatches(chatId, telegramId);

        // ── 🔍 START BROWSE ───────────────────────────────────────────────
      } else if (data === 'start_browse') {
        await browseProfiles(chatId, telegramId);
      }

    } catch (err) {
      console.error('[Browsing callback] Error:', err);
      bot.sendMessage(chatId, '❌ Something went wrong. Please try again.');
    }
  });

  // Export so other modules can trigger browsing
  module.exports.browseProfiles = browseProfiles;
}

module.exports = { setupBrowsingCommands };
