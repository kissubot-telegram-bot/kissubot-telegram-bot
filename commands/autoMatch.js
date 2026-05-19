const { invalidateUserCache } = require('./auth');

const MATCH_DELAY_MS = 4000; // wait 4s so onboarding completion message shows first

const STARTERS = [
  "Ask about their favourite travel destination 🌍",
  "Comment on something from their bio 💬",
  "Ask what they're looking for 💕",
  "Share a fun fact about yourself ✨",
  "Ask about their weekend plans 🎉"
];

/**
 * Auto-matches a newly onboarded user with a compatible active user.
 * Creates mutual likes + match records and notifies both parties.
 * Safe to call multiple times — guarded by autoMatched flag.
 */
async function autoMatchNewUser(bot, telegramId, User, Like) {
  try {
    const newUser = await User.findOne({ telegramId: String(telegramId) });
    if (!newUser) return;
    if (newUser.autoMatched) return;
    if (!newUser.photos || newUser.photos.length === 0) return;

    const { gender, lookingFor } = newUser;
    if (!gender || !lookingFor) return;

    const alreadyMatchedIds = (newUser.matches || []).map(m => m.userId);

    // Build query: find compatible, active, profile-complete users
    const query = {
      telegramId: { $ne: String(telegramId), $nin: alreadyMatchedIds },
      profileCompleted: true,
      'photos.0': { $exists: true },
      $or: [
        { lookingFor: gender },
        { lookingFor: 'Both' },
        { lookingFor: 'Any' }
      ]
    };
    if (lookingFor !== 'Both' && lookingFor !== 'Any') {
      query.gender = lookingFor;
    }

    const candidates = await User.find(query).sort({ lastActive: -1 }).limit(20);
    if (!candidates.length) {
      console.log(`[AUTO-MATCH] No compatible candidates for user ${telegramId}`);
      return;
    }

    // Pick randomly from top 10 most-recently-active
    const pool = candidates.slice(0, Math.min(candidates.length, 10));
    const target = pool[Math.floor(Math.random() * pool.length)];

    // Create mutual Like records (upsert to avoid duplicates)
    if (Like) {
      await Promise.all([
        Like.findOneAndUpdate(
          { fromUserId: String(newUser._id), toUserId: String(target._id) },
          { fromUserId: String(newUser._id), toUserId: String(target._id), superLike: false },
          { upsert: true }
        ).catch(() => {}),
        Like.findOneAndUpdate(
          { fromUserId: String(target._id), toUserId: String(newUser._id) },
          { fromUserId: String(target._id), toUserId: String(newUser._id), superLike: false },
          { upsert: true }
        ).catch(() => {})
      ]);
    }

    // Push likes arrays on both users
    await Promise.all([
      User.findOneAndUpdate({ telegramId: String(telegramId) }, { $addToSet: { likes: target.telegramId } }),
      User.findOneAndUpdate({ telegramId: target.telegramId }, { $addToSet: { likes: String(telegramId) } })
    ]);

    const matchedAt = new Date();

    // Create match records on both users + mark new user as auto-matched + set boost
    const boostUntil = new Date(Date.now() + 30 * 60 * 1000); // 30-min visibility boost
    await Promise.all([
      User.findOneAndUpdate(
        { telegramId: String(telegramId), 'matches.userId': { $ne: target.telegramId } },
        {
          $push: { matches: { userId: target.telegramId, matchedAt } },
          $set: { autoMatched: true, newUserBoostUntil: boostUntil }
        }
      ),
      User.findOneAndUpdate(
        { telegramId: target.telegramId, 'matches.userId': { $ne: String(telegramId) } },
        { $push: { matches: { userId: String(telegramId), matchedAt } } }
      )
    ]);

    invalidateUserCache(String(telegramId));
    invalidateUserCache(target.telegramId);

    console.log(`[AUTO-MATCH] ✅ Matched new user ${telegramId} with ${target.telegramId} (${target.name})`);

    // Notify both users after a short delay
    const starter = STARTERS[Math.floor(Math.random() * STARTERS.length)];

    setTimeout(async () => {
      try {
        const newUserPhoto = (newUser.photos || [])[0];
        const targetPhoto = (target.photos || [])[0];

        // Notify the new user
        if (newUserPhoto && targetPhoto) {
          await bot.sendMediaGroup(String(telegramId), [
            { type: 'photo', media: newUserPhoto, caption: '❤️' },
            { type: 'photo', media: targetPhoto, caption: '❤️' }
          ]).catch(() => {});
        } else if (targetPhoto) {
          await bot.sendPhoto(String(telegramId), targetPhoto, { caption: '❤️' }).catch(() => {});
        }

        await bot.sendMessage(String(telegramId),
          `🎉💖 *IT'S A MATCH!* 💖🎉\n\n` +
          `You matched with *${target.name}*!\n\n` +
          `💡 *Conversation starter:*\n${starter}`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '💬 Start Chatting', callback_data: `chat_gate_${target.telegramId}` }],
                [{ text: '💕 View All Matches', callback_data: 'view_matches' }]
              ]
            }
          }
        );

        // Notify the matched user
        if (newUserPhoto && targetPhoto) {
          await bot.sendMediaGroup(String(target.telegramId), [
            { type: 'photo', media: targetPhoto, caption: '❤️' },
            { type: 'photo', media: newUserPhoto, caption: '❤️' }
          ]).catch(() => {});
        } else if (newUserPhoto) {
          await bot.sendPhoto(String(target.telegramId), newUserPhoto, { caption: '❤️' }).catch(() => {});
        }

        await bot.sendMessage(String(target.telegramId),
          `🎉💖 *IT'S A MATCH!* 💖🎉\n\n` +
          `*${newUser.name}* just joined and you matched!\n\n` +
          `💡 *Conversation starter:*\n${starter}`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '💬 Start Chatting', callback_data: `chat_gate_${String(telegramId)}` }],
                [{ text: '💕 View All Matches', callback_data: 'view_matches' }]
              ]
            }
          }
        );
      } catch (err) {
        console.error('[AUTO-MATCH] Notification error:', err.message);
      }
    }, MATCH_DELAY_MS);

  } catch (err) {
    console.error('[AUTO-MATCH] Error:', err.message);
  }
}

module.exports = { autoMatchNewUser };
