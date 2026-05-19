/**
 * notifications.js — Smart notification engine
 *
 * Segments users by activity level and sends personalized
 * social-proof + urgency notifications at adaptive frequency.
 */

// ── Message Pools ───────────────────────────────────────────────────────────

const MESSAGES = {
  active: [
    { text: '✨ *{X} new {lookingFor} members* joined today who match your preferences!', btn: '🔍 Browse New Members', action: 'browse_profiles' },
    { text: '💬 Your match *{name}* was active recently — say hello before they match with someone else!', btn: '💬 Message Now', action: 'view_matches' },
    { text: '🆕 A new member in *{city}* just joined — check them out before everyone else', btn: '👀 See Profile', action: 'browse_profiles' },
    { text: '🎯 You have *{X} matches* waiting for your first message', btn: '💬 Start Chatting', action: 'view_matches' },
    { text: '📊 You\'re in the *top 10%* most active members this week — keep going! 🚀', btn: '✨ Keep Browsing', action: 'browse_profiles' }
  ],

  new_drifting: [
    { text: '👋 *Welcome back!* Your first match is just a swipe away', btn: '✨ Start Browsing', action: 'browse_profiles' },
    { text: '⚡ Profiles browsed in the first week get *5× more likes*', btn: '🔥 Browse Now', action: 'browse_profiles' },
    { text: '🌟 Complete your profile to be seen by *more people!*', btn: '✏️ Edit Profile', action: 'edit_profile' },
    { text: '💕 New members are getting matched *right now* — join them!', btn: '✨ Find Matches', action: 'browse_profiles' },
    { text: '🎁 You have a *streak reward* waiting — browse today to claim it', btn: '🔥 Claim Reward', action: 'browse_profiles' }
  ],

  cooling: [
    { text: '🔥 *{X} new people* joined near you today — don\'t miss out!', btn: '👀 See Who Joined', action: 'browse_profiles' },
    { text: '📈 Your profile views are *up this week!* Come see who\'s looking', btn: '👀 Check Views', action: 'browse_profiles' },
    { text: '💕 People in *{city}* are matching right now — you could be next', btn: '✨ Start Matching', action: 'browse_profiles' },
    { text: '💌 Someone liked you while you were away… tap to reveal', btn: '❤️ See Who', action: 'likes_you_hub' },
    { text: '🚀 Members who browse daily get *3× more matches*. Come back!', btn: '🔥 Browse Now', action: 'browse_profiles' },
    { text: '👀 *{X} people* have viewed profiles like yours today', btn: '✨ Get Discovered', action: 'browse_profiles' }
  ],

  cold: [
    { text: '⚠️ Your profile is *losing visibility* — browse today to stay on top', btn: '🔥 Boost Visibility', action: 'browse_profiles' },
    { text: '💌 *Someone liked your profile* while you were away — open to see!', btn: '❤️ Reveal', action: 'likes_you_hub' },
    { text: '🎯 Someone with *95% compatibility* just joined. Tap to see', btn: '👀 View Match', action: 'browse_profiles' },
    { text: '📉 You dropped from the top profiles. *One browse* brings you back!', btn: '🚀 Come Back', action: 'browse_profiles' },
    { text: '✨ *{X} people swiped right* today — are you missing your match?', btn: '💕 Find Out', action: 'browse_profiles' },
    { text: '💬 Your matches are *waiting for a reply*…', btn: '💬 Reply Now', action: 'view_matches' },
    { text: '👀 Someone just viewed your profile *3 times*…', btn: '🤔 See Who', action: 'likes_you_hub' }
  ],

  dormant: [
    { text: '📸 Lots has changed! *{X} new members* joined since you left', btn: '🆕 See New Faces', action: 'browse_profiles' },
    { text: '🎉 We miss you! Here\'s what you\'re missing…', btn: '💕 Come Back', action: 'browse_profiles' },
    { text: '💥 Your profile is *still getting views* — come say hello', btn: '👋 Return Now', action: 'browse_profiles' },
    { text: '🔓 You have *unseen likes* that expire soon — don\'t lose them!', btn: '❤️ See Likes', action: 'likes_you_hub' }
  ]
};

// ── Segment Classification ──────────────────────────────────────────────────

function classifyUser(user) {
  const now = Date.now();
  const lastActive = user.lastActive ? new Date(user.lastActive).getTime() : 0;
  const created = user.createdAt ? new Date(user.createdAt).getTime() : 0;
  const hoursSinceActive = (now - lastActive) / (1000 * 60 * 60);
  const daysSinceJoined = (now - created) / (1000 * 60 * 60 * 24);

  if (daysSinceJoined < 7 && hoursSinceActive > 24 && hoursSinceActive <= 48) return 'new_drifting';
  if (hoursSinceActive <= 48) return 'active';          // browsed today or yesterday
  if (hoursSinceActive <= 168) return 'cooling';        // 2-7 days inactive
  if (hoursSinceActive <= 720) return 'cold';           // 7-30 days inactive
  return 'dormant';                                      // 30+ days
}

// Cooldown hours per segment
const COOLDOWN_HOURS = {
  active: 20,       // max 1x/day
  new_drifting: 20, // max 1x/day
  cooling: 10,      // max 2x/day
  cold: 10,         // max 2x/day
  dormant: 72       // max 1x every 3 days
};

// ── Should Notify ───────────────────────────────────────────────────────────

function shouldNotify(user, segment) {
  const cooldown = COOLDOWN_HOURS[segment] || 24;
  if (user.lastNotificationSentAt) {
    const hoursSinceLast = (Date.now() - new Date(user.lastNotificationSentAt).getTime()) / (1000 * 60 * 60);
    if (hoursSinceLast < cooldown) return false;
  }
  return true;
}

// ── Pick Message ────────────────────────────────────────────────────────────

function pickMessage(segment, user, stats) {
  const pool = MESSAGES[segment] || MESSAGES.cooling;
  const msg = pool[Math.floor(Math.random() * pool.length)];

  // Fill dynamic values
  let text = msg.text
    .replace(/\{city\}/g, user.location || 'your area')
    .replace(/\{name\}/g, getMatchName(user))
    .replace(/\{lookingFor\}/g, user.lookingFor || 'new');

  // Replace {X} with contextual numbers
  if (segment === 'active') {
    const unreadMatches = (user.matches || []).filter(m =>
      (m.messageCount?.user1 || 0) === 0 && (m.messageCount?.user2 || 0) === 0
    ).length;
    text = text.replace(/\{X\}/g, String(unreadMatches || stats.newUsersToday || 5));
  } else if (segment === 'dormant') {
    text = text.replace(/\{X\}/g, String(stats.newUsersSinceLeft || stats.newUsersToday || 20));
  } else {
    text = text.replace(/\{X\}/g, String(stats.newUsersToday || Math.floor(Math.random() * 15) + 5));
  }

  return { text, btn: msg.btn, action: msg.action };
}

function getMatchName(user) {
  const matches = user.matches || [];
  if (matches.length === 0) return 'someone';
  // Return the most recent match name placeholder (will be resolved at send time)
  return user._recentMatchName || 'your match';
}

// ── Main Runner ─────────────────────────────────────────────────────────────

async function runSmartNotifications(bot, User) {
  try {
    const hour = new Date().getUTCHours();
    // Only send between 7 AM and 10 PM UTC
    if (hour < 7 || hour > 21) {
      console.log('[NOTIF] Outside sending window (7AM-10PM UTC). Skipping.');
      return;
    }

    // Fetch global stats once
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const newUsersToday = await User.countDocuments({ createdAt: { $gte: todayStart } });
    const stats = { newUsersToday: Math.max(newUsersToday, 5) }; // min 5 for messaging

    // Find all eligible users (completed profile, not banned)
    const users = await User.find({
      profileCompleted: true,
      isBanned: { $ne: true }
    }).select('telegramId name gender lookingFor location lastActive createdAt lastNotificationSentAt matches').lean();

    let sent = 0, skipped = 0;

    for (const user of users) {
      const segment = classifyUser(user);
      if (!shouldNotify(user, segment)) { skipped++; continue; }

      // For dormant users, calculate new users since they left
      if (segment === 'dormant' && user.lastActive) {
        stats.newUsersSinceLeft = await User.countDocuments({
          createdAt: { $gte: new Date(user.lastActive) }
        });
      }

      // Resolve recent match name for active segment
      if (segment === 'active' && user.matches && user.matches.length > 0) {
        const recentMatch = user.matches[user.matches.length - 1];
        if (recentMatch && recentMatch.userId) {
          const matchUser = await User.findOne({ telegramId: recentMatch.userId }).select('name').lean();
          user._recentMatchName = matchUser ? matchUser.name : 'your match';
        }
      }

      const { text, btn, action } = pickMessage(segment, user, stats);

      try {
        await bot.sendMessage(String(user.telegramId), text, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: btn, callback_data: action }]] }
        });

        // Update last notification time
        await User.findOneAndUpdate(
          { telegramId: String(user.telegramId) },
          { lastNotificationSentAt: new Date() }
        );
        sent++;
        await new Promise(r => setTimeout(r, 60)); // rate limit: ~16/sec
      } catch (_) {
        // User blocked bot or chat unavailable — skip silently
      }
    }

    console.log(`[NOTIF] Smart notifications complete: ${sent} sent, ${skipped} skipped (cooldown)`);
  } catch (err) {
    console.error('[NOTIF] Error running smart notifications:', err.message);
  }
}

module.exports = { runSmartNotifications, classifyUser, MESSAGES };
