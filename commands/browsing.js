/**
 * browsing.js — Swipe-style profile browsing
 *
 * Card format:
 *   📸 Photo (or text card with name/age/city/bio)
 *   [ ❤️ Like ]  [ ❌ Skip ]
 *   [ 🚩 Report ][ ⭐ Super Like ]
 *
 * Flow:
 *   Like  → anti-spam check → save like → check mutual → match OR liked+next
 *   Skip  → remove buttons → load next immediately
 *   Report→ hands off to report.js callback
 *   Super Like → costs 10 coins, notifies target user
 *
 * Match event → notify BOTH users simultaneously
 */

const { getCachedUserProfile, invalidateUserCache, getProfileMissing } = require('./auth');
const { canLike, recordLike } = require('./antiSpam');
const { requireBrowseAccess, requireMatchesAccess, incrementMaleSwipeCount, getMaleSwipeCount } = require('./genderGate');
const axios = require('axios');

// Try to load API_BASE from config (optional — stats calls are fire-and-forget)
let API_BASE = '';
try { API_BASE = require('../config').API_BASE; } catch (e) { }

function setupBrowsingCommands(bot, User, Match, Like) {

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
          { text: '⭐ Super Like (10🪙)', callback_data: `superlike_${profileId}` }
        ]
      ]
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // Build the caption for a profile card
  // ─────────────────────────────────────────────────────────────────────
  const LIKE_LINES = [
    '❤️ Liked! Looking for your next match...',
    '💘 Nice choice! Finding someone new...',
    '🔥 You liked them! Fingers crossed for a match...',
    '✨ Like sent! Who\'s next?',
    '💌 They might just like you back! Loading...',
  ];

  const PASS_LINES = [
    '👀 On to the next one...',
    '⏭️ Skipped! Finding someone better...',
    '🙈 Not this time! Loading next profile...',
    '➡️ Moving on...',
  ];

  function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function buildProfileCaption(profile, viewerTelegramId) {
    const genderIcon = profile.gender === 'Male' ? '👨' : profile.gender === 'Female' ? '👩' : '🧑';
    const vipBadge = profile.isVip ? ' 👑' : '';
    const lookingFor = profile.lookingFor
      ? `\n🔍 Looking for: *${profile.lookingFor}*`
      : '';
    const bio = profile.bio
      ? (profile.bio.length > 120 ? profile.bio.substring(0, 117) + '...' : profile.bio)
      : '_No bio yet_ 🤷';
    const photoCount = profile.photos && profile.photos.length > 1
      ? `  📸 *${profile.photos.length} photos*`
      : '';
    const mutualHint = viewerTelegramId && (profile.likes || []).includes(String(viewerTelegramId))
      ? `\n\n💡 *Psst! This person may already like you...*`
      : '';
    return (
      `${genderIcon} *${profile.name}*${vipBadge}, ${profile.age}${photoCount}\n` +
      `📍 ${profile.location}${lookingFor}\n\n` +
      `💬 ${bio}` +
      mutualHint
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
  async function browseProfiles(chatId, telegramId, bypassSeen = false) {
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
        const dynamicButtons = missing.slice(0, 2).map(m => [{ text: m.btnText, callback_data: m.callback }]);

        return bot.sendMessage(chatId,
          '✨ *Almost Ready!*\n\n' +
          'Complete your profile to start browsing:\n\n' +
          `📋 *Missing:*\n${missing.map(m => m.msgText).join('\n')}`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                ...dynamicButtons,
                [{ text: '✏️ Edit Profile', callback_data: 'edit_profile' }, { text: '🏠 Main Menu', callback_data: 'main_menu' }]
              ]
            }
          }
        );
      }

      const currentUser = await User.findOne({ telegramId });
      if (!currentUser) return bot.sendMessage(chatId, '❌ User not found.');

      const gender = (currentUser.gender || '').toLowerCase();
      const isMaleNonVip = (gender === 'male' || gender === '') && !currentUser.isVip;

      // Invisible mode: don't update lastActive while browsing
      if (!currentUser.invisibleMode) {
        User.findOneAndUpdate({ telegramId: String(telegramId) }, { lastActive: new Date() }).catch(() => {});
      }

      if (!(await requireBrowseAccess(bot, chatId, String(telegramId), User))) {
        return;
      }

      // Build list of IDs to exclude: self + seen (liked/passed) + blocked + users who blocked them
      const blockedByMe = (currentUser.blocked || []).map(b => b.userId);
      const seenIds = bypassSeen ? [] : (currentUser.seenProfiles || []);

      let excludeIds = [...blockedByMe, ...seenIds];

      // Also exclude users who have blocked the current user
      const usersWhoBlockedMe = await User.find({
        'blocked.userId': String(telegramId)
      }).select('telegramId');
      const blockedMeIds = usersWhoBlockedMe.map(u => u.telegramId);
      excludeIds = [...excludeIds, ...blockedMeIds];

      // ── Read search preferences ────────────────────────────────────────
      const ss = currentUser.searchSettings || {};
      const ageMin = ss.ageMin || 18;
      const ageMax = ss.ageMax || 99;
      const maxDistance = ss.maxDistance || 100000;
      const hideLiked = ss.hideLiked === true; // default false; seenProfiles already handles exclusion

      // Gender: searchSettings.genderPreference takes precedence over lookingFor
      const genderPref = (ss.genderPreference && ss.genderPreference !== 'Any')
        ? ss.genderPreference
        : (currentUser.lookingFor === 'Both' ? null : currentUser.lookingFor);
      const genderFilter = genderPref ? { gender: genderPref } : {};

      // Age filter
      const ageFilter = { age: { $gte: ageMin, $lte: ageMax } };

      // Location filter — approximate text match when distance is not unlimited
      let locationFilter = {};
      if (maxDistance < 100000 && currentUser.location) {
        const city = currentUser.location.split(',')[0].trim();
        if (city) locationFilter = { location: { $regex: new RegExp(city, 'i') } };
      }

      // Hide already-liked filter — exclude profiles where this user's ID is in their likes[]
      const hideLikedFilter = hideLiked
        ? { likes: { $not: { $elemMatch: { $eq: String(telegramId) } } } }
        : {};

      // Query with progressive fallback if strict filters return nothing
      const baseExclude = { telegramId: { $ne: String(telegramId), $nin: excludeIds }, name: { $exists: true, $ne: null } };
      const limit = currentUser.isVip ? 0 : 10;

      const runQuery = (extra) => {
        let q = User.find({ ...baseExclude, ...extra });
        if (limit) q = q.limit(limit);
        return q;
      };

      // 1st try: full filters
      let profiles = await runQuery({
        photos: { $exists: true, $not: { $size: 0 } },
        ...ageFilter, ...genderFilter, ...locationFilter, ...hideLikedFilter
      });

      // 2nd try: drop gender preference
      if (profiles.length === 0 && Object.keys(genderFilter).length > 0) {
        profiles = await runQuery({
          photos: { $exists: true, $not: { $size: 0 } },
          ...ageFilter, ...locationFilter, ...hideLikedFilter
        });
      }

      // 3rd try: drop photos requirement too
      if (profiles.length === 0) {
        profiles = await runQuery({ ...ageFilter, ...locationFilter });
      }


      // Increment swipe count for non-VIP male users after a profile is found
      if (isMaleNonVip && profiles.length > 0) {
        incrementMaleSwipeCount(String(telegramId));
      }

      // Monthly VIP coins grant
      if (currentUser.isVip) {
        const now = new Date();
        const lastGrant = currentUser.vipDetails && currentUser.vipDetails.lastCoinGrantDate;
        const monthlyCoins = (currentUser.vipDetails && currentUser.vipDetails.benefits && currentUser.vipDetails.benefits.monthlyCoins) || 500;
        if (!lastGrant || (now - new Date(lastGrant)) > 30 * 24 * 60 * 60 * 1000) {
          await User.findOneAndUpdate(
            { telegramId: String(telegramId) },
            { $inc: { coins: monthlyCoins }, $set: { 'vipDetails.lastCoinGrantDate': now } }
          );
          bot.sendMessage(chatId, `🎁 *Monthly VIP Coins!*\n\n+${monthlyCoins} coins have been added to your balance! 🪙`, { parse_mode: 'Markdown' }).catch(() => {});
        }
      }

      if (!profiles || profiles.length === 0) {
        return bot.sendMessage(chatId,
          '🌙 *You\'ve seen everyone for now!*\n\n' +
          'New people join Kissubot every day — check back soon 💕\n\n' +
          '💡 *Tips to see more profiles:*\n' +
          '• Expand your age range or distance in Search Settings\n' +
          '• Reset your browse history to see past profiles again\n' +
          '• Update your profile to attract more matches',
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '⚙️ Search Settings', callback_data: 'settings_search' }, { text: '🔄 Reset History', callback_data: 'reset_seen_profiles' }],
                [{ text: '💕 View Matches', callback_data: 'view_matches' }, { text: '🏠 Main Menu', callback_data: 'main_menu' }]
              ]
            }
          }
        );
      }

      // Prioritize boosted profiles; otherwise pick at random
      const now = new Date();
      const boostedProfiles = profiles.filter(p => p.boostExpiresAt && p.boostExpiresAt > now);
      const profile = boostedProfiles.length > 0
        ? boostedProfiles[Math.floor(Math.random() * boostedProfiles.length)]
        : profiles[Math.floor(Math.random() * profiles.length)];
      const caption = buildProfileCaption(profile, telegramId);
      const keyboard = buildProfileKeyboard(profile.telegramId);

      // VIP viewers see all photos as media group; non-VIP sees only first photo
      if (currentUser.isVip && profile.photos && profile.photos.length > 1) {
        const mediaGroup = profile.photos.map((url, i) => ({
          type: 'photo', media: url,
          ...(i === 0 ? { caption, parse_mode: 'Markdown' } : {})
        }));
        await bot.sendMediaGroup(chatId, mediaGroup).catch(() => {});
        await bot.sendMessage(chatId, `📸 *${profile.name.split(' ')[0]}'s ${profile.photos.length} photos above* — like or skip?`, {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
      } else if (profile.photos && profile.photos.length > 0) {
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

  async function showMatches(chatId, telegramId) {
    try {
      if (!(await requireMatchesAccess(bot, chatId, String(telegramId), User))) return;

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
        callback_data: `chat_gate_${other.telegramId}`
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
  async function notifyMatchedUser(otherTelegramId, myUser, otherUser) {
    try {
      const starters = [
        "Ask about their favourite travel destination 🌍",
        "Comment on something from their bio 💬",
        "Ask what they're looking for 💕",
        "Share a fun fact about yourself ✨",
        "Ask about their weekend plans 🎉"
      ];
      const starter = starters[Math.floor(Math.random() * starters.length)];

      const myPhoto = (myUser.photos || [])[0];
      const theirPhoto = otherUser && (otherUser.photos || [])[0];

      if (myPhoto && theirPhoto) {
        await bot.sendMediaGroup(otherTelegramId, [
          { type: 'photo', media: theirPhoto, caption: '💖', parse_mode: 'Markdown' },
          { type: 'photo', media: myPhoto, caption: '💖', parse_mode: 'Markdown' }
        ]).catch(() => {});
      } else if (myPhoto) {
        await bot.sendPhoto(otherTelegramId, myPhoto).catch(() => {});
      }

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
                { text: '💬 Open Chat', callback_data: `chat_gate_${myUser.telegramId}` },
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
    if (data.startsWith('report_') || data.startsWith('block_') || data.startsWith('onboard_') || data === 'reset_seen_profiles') return;

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

        // Record the like and mark profile as seen
        if (!toUser.likes.includes(String(telegramId))) {
          toUser.likes.push(String(telegramId));
          await toUser.save();
        }
        if (!(fromUser.seenProfiles || []).includes(String(targetTelegramId))) {
          await User.findOneAndUpdate(
            { telegramId: String(telegramId) },
            { $push: { seenProfiles: String(targetTelegramId) } }
          );
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
          const fromPhoto = (fromUser.photos || [])[0];
          const toPhoto = (toUser.photos || [])[0];

          if (fromPhoto && toPhoto) {
            await bot.sendMediaGroup(chatId, [
              { type: 'photo', media: fromPhoto, caption: '💖', parse_mode: 'Markdown' },
              { type: 'photo', media: toPhoto, caption: '💖', parse_mode: 'Markdown' }
            ]).catch(() => {});
          } else if (toPhoto) {
            await bot.sendPhoto(chatId, toPhoto).catch(() => {});
          }

          await bot.sendMessage(chatId,
            `🎉💖 *IT'S A MATCH!* 💖🎉\n\n` +
            `You and *${toUser.name}* liked each other!\n\n` +
            `💡 *Conversation starter:*\n${starter}`,
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: '💬 Open Chat', callback_data: `chat_gate_${targetTelegramId}` },
                    { text: '🔍 Keep Swiping', callback_data: 'start_browse' }
                  ],
                  [{ text: '💌 All Matches', callback_data: 'view_matches' }]
                ]
              }
            }
          );

          // ── Notify the OTHER user too (background) ─────────────────
          notifyMatchedUser(targetTelegramId, fromUser, toUser);

        } else {
          // No match yet — quick feedback then next profile
          await bot.sendMessage(chatId,
            randomFrom(LIKE_LINES),
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
        if (fromUser && !(fromUser.seenProfiles || []).includes(String(targetTelegramId))) {
          await User.findOneAndUpdate(
            { telegramId: String(telegramId) },
            { $push: { seenProfiles: String(targetTelegramId) }, lastSkippedProfile: String(targetTelegramId) }
          );
          invalidateUserCache(String(telegramId));
        }

        const skipKeyboard = fromUser && fromUser.isVip
          ? { reply_markup: { inline_keyboard: [[{ text: '↩️ Undo Skip', callback_data: `undo_skip_${targetTelegramId}` }]] } }
          : {};
        await bot.sendMessage(chatId, randomFrom(PASS_LINES), skipKeyboard);
        // Instantly show next profile
        await browseProfiles(chatId, telegramId);

        // ── ↩️ UNDO SKIP (VIP only) ───────────────────────────────────────
      } else if (data.startsWith('undo_skip_')) {
        const targetId = data.replace('undo_skip_', '');
        const userDoc = await User.findOne({ telegramId: String(telegramId) });
        if (!userDoc || !userDoc.isVip) {
          return bot.sendMessage(chatId,
            '🔒 *VIP Feature*\n\nUndo Skip is available for VIP members only.',
            { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '👑 Subscribe', callback_data: 'manage_vip' }]] } }
          );
        }
        await User.findOneAndUpdate(
          { telegramId: String(telegramId) },
          { $pull: { seenProfiles: String(targetId) } }
        );
        invalidateUserCache(String(telegramId));
        const undoProfile = await User.findOne({ telegramId: String(targetId) });
        if (!undoProfile) return bot.sendMessage(chatId, '❌ Profile no longer available.');
        const undoCaption = buildProfileCaption(undoProfile, telegramId);
        const undoKeyboard = buildProfileKeyboard(undoProfile.telegramId);
        await bot.sendMessage(chatId, '↩️ *Undone! Here they are again:*', { parse_mode: 'Markdown' });
        if (undoProfile.photos && undoProfile.photos.length > 0) {
          await bot.sendPhoto(chatId, undoProfile.photos[0], { caption: undoCaption, parse_mode: 'Markdown', reply_markup: undoKeyboard });
        } else {
          await bot.sendMessage(chatId, undoCaption, { parse_mode: 'Markdown', reply_markup: undoKeyboard });
        }

        // ── ⭐ SUPER LIKE ─────────────────────────────────────────────────
      } else if (data.startsWith('superlike_')) {
        const targetTelegramId = data.replace('superlike_', '');
        const fromUser = await User.findOne({ telegramId });

        if (!fromUser) return bot.sendMessage(chatId, '❌ User not found.');

        const today = new Date().toDateString();
        const vipDaily = fromUser.dailySuperLikesVip || {};
        const freeSLUsed = vipDaily.date === today ? (vipDaily.count || 0) : 0;
        const FREE_SL_LIMIT = 5;
        const useFreeSuperLike = fromUser.isVip && freeSLUsed < FREE_SL_LIMIT;

        if (!useFreeSuperLike && (fromUser.coins || 0) < 10) {
          return bot.sendMessage(chatId,
            `❌ *Not Enough Coins*\n\nYou need 10 coins to send a Super Like.${fromUser.isVip ? `\n_VIP free super likes today: ${freeSLUsed}/${FREE_SL_LIMIT}_` : ''}`,
            {
              parse_mode: 'Markdown',
              reply_markup: { inline_keyboard: [[{ text: '💰 Buy Coins', callback_data: 'buy_coins' }, { text: '🔍 Browse', callback_data: 'start_browse' }]] }
            }
          );
        }

        const toUser = await User.findOne({ telegramId: targetTelegramId });
        if (!toUser) return bot.sendMessage(chatId, '❌ User not found.');

        if (useFreeSuperLike) {
          await User.findOneAndUpdate(
            { telegramId: String(telegramId) },
            { dailySuperLikesVip: { count: freeSLUsed + 1, date: today } }
          );
        } else {
          fromUser.coins -= 10;
          await fromUser.save();
        }
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
      } else if (data.startsWith('chat_') && !data.startsWith('chat_gate_')) {
        const targetTelegramId = data.replace('chat_', '');
        bot.sendMessage(chatId,
          '💬 *Open a direct chat:*',
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '💬 Open Chat', callback_data: `chat_gate_${targetTelegramId}` }],
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
      } else if (data === 'start_browse' || data === 'browse_profiles') {
        return browseProfiles(chatId, telegramId);

      }
      // ── 🔒 CHAT GATE ──────────────────────────────────────────────────
      else if (data.startsWith('chat_gate_')) {
        const targetId = data.replace('chat_gate_', '');
        if (!(await requireMatchesAccess(bot, chatId, String(telegramId), User))) {
          return;
        }

        const targetUser = await User.findOne({ telegramId: String(targetId) });
        const chatUrl = targetUser && targetUser.username
          ? `https://t.me/${targetUser.username}`
          : `tg://user?id=${targetId}`;

        const noUsernameNote = targetUser && !targetUser.username
          ? `\n\n⚠️ *${targetUser.name || 'This user'}* hasn't set a Telegram username yet — the link may not open. Ask them to set one in Telegram Settings.`
          : '';

        bot.sendMessage(chatId,
          `💬 *It's a match!* Start your conversation below.${noUsernameNote}`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: `💬 Message ${targetUser ? targetUser.name : 'Match'}`, url: chatUrl }],
                [{ text: '🔙 Back to Matches', callback_data: 'view_matches' }]
              ]
            }
          }
        );
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
