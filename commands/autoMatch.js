const { invalidateUserCache } = require('./auth');
const { getSeedLikers, isSeedId, sendSeedOpener } = require('./seedAccounts');

const MATCH_DELAY_MS = 3 * 60 * 1000; // 3 minutes after onboarding completes

const STARTERS = [
  "Ask about their favourite travel destination 🌍",
  "Comment on something from their bio 💬",
  "Ask what they're looking for 💕",
  "Share a fun fact about yourself ✨",
  "Ask about their weekend plans 🎉"
];

/**
 * Fired at end of onboarding. After 3 minutes:
 *   1. Silently add 3–5 likers (real users first, seeds fill the gap) to new user's likes[].
 *   2. Notify new user: "N people liked your profile!"
 *   3. Create a full auto-match with one of those likers and notify both parties.
 *
 * Guarded by autoMatched flag — safe to call multiple times.
 */
async function autoMatchNewUser(bot, telegramId, User, Like) {
  try {
    const newUser = await User.findOne({ telegramId: String(telegramId) });
    if (!newUser) return;
    if (newUser.autoMatched) return;
    if (!newUser.photos || newUser.photos.length === 0) return;

    const { gender, lookingFor } = newUser;
    if (!gender || !lookingFor) return;

    // Mark as auto-matched BEFORE scheduling to prevent duplicate setTimeout calls
    await User.findOneAndUpdate({ telegramId: String(telegramId) }, { $set: { autoMatched: true } });

    setTimeout(async () => {
      try {
        // Re-fetch in case profile changed during the 3-min window
        const user = await User.findOne({ telegramId: String(telegramId) });
        if (!user) return;

        // ── 1. Find real compatible users for silent likes ───────────────
        const alreadyLikedIds = (user.likes || []);
        const realQuery = {
          telegramId: { $ne: String(telegramId), $nin: alreadyLikedIds },
          profileCompleted: true,
          'photos.0': { $exists: true },
          isSeedAccount: { $ne: true },
          $or: [{ lookingFor: gender }, { lookingFor: 'Both' }, { lookingFor: 'Any' }]
        };
        if (lookingFor !== 'Both' && lookingFor !== 'Any') realQuery.gender = lookingFor;

        const realCandidates = await User.find(realQuery).sort({ lastActive: -1 }).limit(10);
        const realLikers = realCandidates.sort(() => Math.random() - 0.5).slice(0, 5);

        // ── 2. Pad with seeds if fewer than 3 real likers found ──────────
        const seedsNeeded = Math.max(0, 5 - realLikers.length);
        const seedLikers = seedsNeeded > 0 ? getSeedLikers(user, seedsNeeded) : [];

        const allLikers = [
          ...realLikers.map(u => ({ telegramId: u.telegramId, name: u.name, isSeed: false, doc: u })),
          ...seedLikers.map(s => ({ telegramId: s.telegramId, name: s.name, isSeed: true, doc: s }))
        ];

        if (allLikers.length === 0) {
          console.log(`[AUTO-LIKE] No likers available for ${telegramId}`);
          return;
        }

        // ── 3. Add all liker IDs to new user's likes[] ───────────────────
        const likerIds = allLikers.map(l => String(l.telegramId));
        await User.findOneAndUpdate(
          { telegramId: String(telegramId) },
          { $addToSet: { likes: { $each: likerIds } } }
        );
        console.log(`[AUTO-LIKE] ✅ ${allLikers.length} likes added for new user ${telegramId} (${likerIds.join(', ')})`);

        // ── 4. Notify new user of likes ──────────────────────────────────
        const likeCount = allLikers.length;
        await bot.sendMessage(String(telegramId),
          `💕 *${likeCount} ${likeCount === 1 ? 'person has' : 'people have'} already liked your profile!*\n\n` +
          `Tap below to see who likes you and like them back to create a match! 🎉`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: `💕 See Who Liked You (${likeCount})`, callback_data: 'likesyou_overview' }]
              ]
            }
          }
        ).catch(() => {});

        // ── 5. Pick 1 for auto-match (prefer real user) ──────────────────
        const matchTarget = allLikers.find(l => !l.isSeed) || allLikers[0];
        const matchUser = matchTarget.doc
          ? matchTarget.doc
          : await User.findOne({ telegramId: String(matchTarget.telegramId) });
        if (!matchUser) return;

        const matchedAt = new Date();
        const boostUntil = new Date(Date.now() + 30 * 60 * 1000);

        // Add new user to match target's likes[] for mutual consistency
        await User.findOneAndUpdate(
          { telegramId: String(matchTarget.telegramId) },
          { $addToSet: { likes: String(telegramId) } }
        );

        // Create match records on both users + set boost
        await Promise.all([
          User.findOneAndUpdate(
            { telegramId: String(telegramId), 'matches.userId': { $ne: matchTarget.telegramId } },
            {
              $push: { matches: { userId: matchTarget.telegramId, matchedAt } },
              $set: { newUserBoostUntil: boostUntil }
            }
          ),
          User.findOneAndUpdate(
            { telegramId: String(matchTarget.telegramId), 'matches.userId': { $ne: String(telegramId) } },
            { $push: { matches: { userId: String(telegramId), matchedAt } } }
          )
        ]);

        if (Like) {
          await Promise.all([
            Like.findOneAndUpdate(
              { fromUserId: String(telegramId), toUserId: String(matchTarget.telegramId) },
              { fromUserId: String(telegramId), toUserId: String(matchTarget.telegramId), superLike: false },
              { upsert: true }
            ).catch(() => {}),
            Like.findOneAndUpdate(
              { fromUserId: String(matchTarget.telegramId), toUserId: String(telegramId) },
              { fromUserId: String(matchTarget.telegramId), toUserId: String(telegramId), superLike: false },
              { upsert: true }
            ).catch(() => {})
          ]);
        }

        invalidateUserCache(String(telegramId));
        invalidateUserCache(String(matchTarget.telegramId));
        console.log(`[AUTO-MATCH] ✅ Matched new user ${telegramId} with ${matchTarget.telegramId} (${matchTarget.name})`);

        // ── 6. Notify new user of match ──────────────────────────────────
        const starter = STARTERS[Math.floor(Math.random() * STARTERS.length)];
        const newUserPhoto = (user.photos || [])[0];
        const matchPhoto = (matchUser.photos || [])[0];

        if (newUserPhoto && matchPhoto) {
          await bot.sendMediaGroup(String(telegramId), [
            { type: 'photo', media: newUserPhoto, caption: '❤️' },
            { type: 'photo', media: matchPhoto, caption: '❤️' }
          ]).catch(() => {});
        } else if (matchPhoto) {
          await bot.sendPhoto(String(telegramId), matchPhoto, { caption: '❤️' }).catch(() => {});
        }

        await bot.sendMessage(String(telegramId),
          `🎉💖 *IT'S A MATCH!* 💖🎉\n\n` +
          `You matched with *${matchUser.name}*!\n\n` +
          `💡 *Conversation starter:*\n${starter}`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '💬 Start Chatting', callback_data: `chat_gate_${matchUser.telegramId}` }],
                [{ text: '💕 View All Matches', callback_data: 'view_matches' }]
              ]
            }
          }
        ).catch(() => {});

        // ── 7. Notify real match partner / seed sends opener ─────────────
        if (!matchTarget.isSeed) {
          await bot.sendMessage(String(matchTarget.telegramId),
            `🎉💖 *IT'S A MATCH!* 💖🎉\n\n` +
            `*${user.name}* just joined and you matched!\n\n` +
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
          ).catch(() => {});
        } else {
          // Seed match: fire scripted opener to the new user after a short delay
          sendSeedOpener(bot, matchUser.name, String(telegramId));
        }

      } catch (err) {
        console.error('[AUTO-MATCH] Error in delayed job:', err.message);
      }
    }, MATCH_DELAY_MS);

  } catch (err) {
    console.error('[AUTO-MATCH] Error:', err.message);
  }
}

module.exports = { autoMatchNewUser };
