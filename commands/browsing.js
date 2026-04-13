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

const { MAIN_KEYBOARD, MAIN_KB_BUTTONS, VIP_KEYBOARD, COINS_STORE_KEYBOARD } = require('../keyboard');



// Try to load API_BASE from config (optional — stats calls are fire-and-forget)

let API_BASE = '';

try { API_BASE = require('../config').API_BASE; } catch (e) { }



function setupBrowsingCommands(bot, User, Match, Like, userStates) {



  // ─────────────────────────────────────────────────────────────────────

  // Reply Keyboard for browsing actions (profileId stored in userStates)

  // ─────────────────────────────────────────────────────────────────────

  const BROWSE_KEYBOARD = {

    keyboard: [

      [{ text: '💖 Like' }, { text: '⏭️ Skip' }],

      [{ text: '⭐ Super Like' }, { text: '🎁 Gift' }],

      [{ text: '🏠 Menu' }]

    ],

    resize_keyboard: true

  };



  function buildProfileKeyboard() {

    return BROWSE_KEYBOARD;

  }



  // ─────────────────────────────────────────────────────────────────────

  // Build the caption for a profile card

  // ─────────────────────────────────────────────────────────────────────

  const LIKE_LINES = [

    '💖 *Heartbeat!* Looking for your next match...',

    '💘 *A match made in heaven?* Finding someone new...',

    '🔥 *Ooh la la!* Fingers crossed for a match...',

    '✨ *Spark sent!* Who\'s next?',

    '💌 *They might just be the one!* Loading...',

  ];



  const PASS_LINES = [

    '👀 On to the next one...',

    '⏭️ Skipped! Finding someone better...',

    '🙈 Not this time! Loading next profile...',

    '➡️ Moving on...',

  ];



  function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }



  function buildProfileCaption(profile, viewerTelegramId) {

    const genderIcon = profile.gender === 'Male' ? '👔' : profile.gender === 'Female' ? '👗' : '🧒';

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

                [{ text: '✏️ Edit Profile', callback_data: 'edit_profile' }, { text: '🏠 Menu', callback_data: 'main_menu' }]

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

        User.findOneAndUpdate({ telegramId: String(telegramId) }, { lastActive: new Date() }).catch(() => { });

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



      // Gender filtering: use lookingFor to show profiles matching what user wants to see
      // If user is looking for "Male", show Male profiles
      // If user is looking for "Female", show Female profiles
      // If user is looking for "Both" or "Any", show all genders
      const lookingFor = currentUser.lookingFor || ss.genderPreference || 'Both';
      const genderFilter = (lookingFor === 'Both' || lookingFor === 'Any') 
        ? {} 
        : { gender: lookingFor };



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



      const limit = currentUser.isVip ? 0 : 10;

      const testFilter = currentUser.isDevMode ? {} : { isTestAccount: { $ne: true } };

      const baseExclude = { telegramId: { $ne: String(telegramId), $nin: excludeIds }, name: { $exists: true, $ne: null }, ...testFilter };



      const runQuery = (extra) => {

        let q = User.find({ ...baseExclude, ...extra });

        if (limit) q = q.limit(limit);

        return q;

      };



      let profiles;



      if (bypassSeen) {

        // After reset: skip ALL filters, show any other user ignoring blocked list too

        let q = User.find({ telegramId: { $ne: String(telegramId) }, name: { $exists: true, $ne: null }, ...testFilter });

        if (limit) q = q.limit(limit);

        profiles = await q;

      } else {

        // Normal browse: full filters with progressive fallback

        // 1st try: full filters including gender preference

        profiles = await runQuery({

          photos: { $exists: true, $not: { $size: 0 } },

          ...ageFilter, ...genderFilter, ...locationFilter, ...hideLikedFilter

        });



        // 3rd try: drop location filter, keep photos

        if (profiles.length === 0) {

          profiles = await runQuery({

            photos: { $exists: true, $not: { $size: 0 } },

            ...ageFilter, ...hideLikedFilter

          });

        }



        // 4th try: drop age filter, keep photos

        if (profiles.length === 0) {

          profiles = await runQuery({

            photos: { $exists: true, $not: { $size: 0 } }

          });

        }



        // 5th try: last resort — include profiles with profilePhoto even if photos array is missing

        if (profiles.length === 0) {

          let q = User.find({

            telegramId: { $ne: String(telegramId) },

            name: { $exists: true, $ne: null },

            $or: [

              { photos: { $exists: true, $not: { $size: 0 } } },

              { profilePhoto: { $exists: true, $ne: null } }

            ],

            ...testFilter

          });

          if (limit) q = q.limit(limit);

          profiles = await q;

        }

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

          bot.sendMessage(chatId, `🎁 *Monthly VIP Coins!*\n\n+${monthlyCoins} coins have been added to your balance! 🪙`, { parse_mode: 'Markdown' }).catch(() => { });

        }

      }



      if (!profiles || profiles.length === 0) {

        if (userStates) userStates.delete(String(telegramId));

        return bot.sendMessage(chatId,

          '🌙 *You\'ve seen everyone for now!*\n\n' +

          'New people join Kissubot every day — check back soon 💕\n\n' +

          '💡 *Tips to see more profiles:*\n' +

          '• Expand your age range or distance in Search Settings\n' +

          '• Reset your browse history to see past profiles again\n' +

          '• Update your profile to attract more matches',

          {

            parse_mode: 'Markdown',

            reply_markup: MAIN_KEYBOARD

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

      const keyboard = buildProfileKeyboard();



      // Store current profile so Reply Keyboard buttons know who to act on

      if (userStates) {

        userStates.set(String(telegramId), { browsing: { profileId: String(profile.telegramId) } });

      }



      // VIP viewers see all photos as media group; non-VIP sees only first photo

      if (currentUser.isVip && profile.photos && profile.photos.length > 1) {

        const mediaGroup = profile.photos.map((url, i) => ({

          type: 'photo', media: url,

          ...(i === 0 ? { caption, parse_mode: 'Markdown' } : {})

        }));

        await bot.sendMediaGroup(chatId, mediaGroup).catch(() => { });

        await bot.sendMessage(chatId, `📸 *${profile.name.split(' ')[0]}'s ${profile.photos.length} photos above* — like or skip?`, {

          parse_mode: 'Markdown',

          reply_markup: keyboard

        });

      } else {

        const photoId = (profile.photos && profile.photos.length > 0)

          ? profile.photos[0]

          : profile.profilePhoto;

        if (photoId) {

          await bot.sendPhoto(chatId, photoId, {

            caption,

            parse_mode: 'Markdown',

            reply_markup: keyboard

          }).catch(async () => {

            // File ID expired or invalid — show text card instead

            await bot.sendMessage(chatId, caption, { parse_mode: 'Markdown', reply_markup: keyboard });

          });

        } else {

          await bot.sendMessage(chatId, caption, {

            parse_mode: 'Markdown',

            reply_markup: keyboard

          });

        }

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

  // /devmode — toggle dev mode (allows seeing test accounts in browse)

  // ─────────────────────────────────────────────────────────────────────

  bot.onText(/\/devmode/, async (msg) => {

    const chatId = msg.chat.id;

    const telegramId = String(msg.from.id);

    try {

      const user = await User.findOne({ telegramId });

      if (!user) return bot.sendMessage(chatId, '❌ User not found.');

      const newState = !user.isDevMode;

      const vipUpdate = newState

        ? { isDevMode: true, isVip: true }

        : { isDevMode: false, isVip: false };

      await User.findOneAndUpdate({ telegramId }, { $set: vipUpdate });

      const { invalidateUserCache } = require('./auth');

      invalidateUserCache(telegramId);

      bot.sendMessage(chatId,

        `🛠 *Dev Mode ${newState ? 'ON' : 'OFF'}*\n\n` +

        (newState

          ? '✅ Test accounts visible in browse\n👑 VIP granted for free testing'

          : '🚫 Test accounts hidden\n👑 VIP removed'),

        { parse_mode: 'Markdown' }

      );

    } catch (err) {

      bot.sendMessage(chatId, `❌ Error: ${err.message}`);

    }

  });



  // ─────────────────────────────────────────────────────────────────────

  // /debugbrowse — shows DB state to diagnose browse issues

  // ─────────────────────────────────────────────────────────────────────

  bot.onText(/\/debugbrowse/, async (msg) => {

    const chatId = msg.chat.id;

    const telegramId = msg.from.id;

    try {

      const me = await User.findOne({ telegramId: String(telegramId) });

      const meNum = await User.findOne({ telegramId: telegramId });

      const totalUsers = await User.countDocuments({});

      const otherUsers = await User.countDocuments({ telegramId: { $ne: String(telegramId) } });

      const withName = await User.countDocuments({ telegramId: { $ne: String(telegramId) }, name: { $exists: true, $ne: null } });

      const withPhotos = await User.countDocuments({ telegramId: { $ne: String(telegramId) }, name: { $exists: true, $ne: null }, photos: { $exists: true, $not: { $size: 0 } } });

      const seenCount = me ? (me.seenProfiles || []).length : 'user not found';

      const blockedCount = me ? (me.blocked || []).length : 0;

      const lookingFor = me ? me.lookingFor : 'N/A';

      const gender = me ? me.gender : 'N/A';



      const withMale = await User.countDocuments({ telegramId: { $ne: String(telegramId) }, gender: 'Male', name: { $exists: true, $ne: null } });

      const withMalePhotos = await User.countDocuments({ telegramId: { $ne: String(telegramId) }, gender: 'Male', name: { $exists: true, $ne: null }, photos: { $exists: true, $not: { $size: 0 } } });

      const withMalePhotosAge = await User.countDocuments({ telegramId: { $ne: String(telegramId) }, gender: 'Male', name: { $exists: true, $ne: null }, photos: { $exists: true, $not: { $size: 0 } }, age: { $gte: 18, $lte: 99 } });

      const anyWithAge = await User.countDocuments({ telegramId: { $ne: String(telegramId) }, name: { $exists: true, $ne: null }, age: { $gte: 18, $lte: 99 } });



      const blockedMeDocs = await User.find({ 'blocked.userId': String(telegramId) }).select('telegramId');

      const blockedMeIds = blockedMeDocs.map(u => u.telegramId);

      const blockedMeCount = blockedMeIds.length;



      const fallback5 = await User.find({

        telegramId: { $ne: String(telegramId), $nin: blockedMeIds },

        name: { $exists: true, $ne: null }

      }).limit(3).select('name gender age');

      const fallback5Names = fallback5.map(p => `${p.name}(${p.gender},${p.age})`).join(', ') || 'NONE';



      bot.sendMessage(chatId,

        `🔍 *Browse Debug Info*\n\n` +

        `*Your account:*\n` +

        `• Found by string ID: ${me ? '✅' : '❌'}\n` +

        `• seenProfiles count: ${seenCount}\n` +

        `• You blocked: ${blockedCount} | Blocked you: ${blockedMeCount}\n` +

        `• Gender: ${gender} | lookingFor: ${lookingFor}\n\n` +

        `*DB counts:*\n` +

        `• Total users: ${totalUsers}\n` +

        `• Other users (excl. you): ${otherUsers}\n` +

        `• Others with name: ${withName}\n` +

        `• Others with name+photos: ${withPhotos}\n` +

        `• Others with name+age(18-99): ${anyWithAge}\n\n` +

        `*Male profiles (your target):*\n` +

        `• Males with name: ${withMale}\n` +

        `• Males with name+photos: ${withMalePhotos}\n` +

        `• Males with name+photos+age: ${withMalePhotosAge}\n\n` +

        `*Fallback query result (excl. blocked-you):*\n` +

        `• Would return: ${fallback5.length > 0 ? '✅ ' + fallback5Names : '❌ 0 profiles'}`,

        { parse_mode: 'Markdown' }

      );

    } catch (err) {

      bot.sendMessage(chatId, `❌ Debug error: ${err.message}`);

    }

  });



  async function showMatches(chatId, telegramId) {

    try {

      if (!(await requireMatchesAccess(bot, chatId, String(telegramId), User))) return;



      const user = await User.findOne({ telegramId });

      if (!user) return bot.sendMessage(chatId, '❌ User not found.');

      // Check if user is non-VIP male
      const gender = (user.gender || '').toLowerCase();
      const isNonVipMale = (gender === 'male' || gender === '') && !user.isVip;
      
      console.log('[MATCHES] User check:', {
        telegramId,
        gender: user.gender,
        isVip: user.isVip,
        isNonVipMale
      });


      const matches = user.matches || [];



      if (!matches || matches.length === 0) {

        return bot.sendMessage(chatId,

          '💞 *No Matches Yet*\n\nKeep browsing to find your perfect match! 💕',

          {

            parse_mode: 'Markdown',

            reply_markup: MAIN_KEYBOARD

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



      console.log('[Matches] Valid matches count:', valid.length);

      console.log('[Matches] Match details:', valid.map(v => ({ name: v.other?.name, hasPhotos: v.other?.photos?.length > 0 })));


      console.log('[Matches] Valid matches count:', valid.length);
      console.log('[Matches] Match details:', valid.map(v => ({ name: v.other?.name, hasPhotos: v.other?.photos?.length > 0 })));


      // Send header message with VIP prompt for non-VIP males
      if (isNonVipMale) {
        await bot.sendMessage(chatId, 
          `💕 *YOUR MATCHES (${valid.length})* 💕\n\n` +
          `🔒 *Upgrade to VIP to view photos and chat with your matches!*\n\n` +
          `👇 See who matched with you below:`, 
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[
                { text: '👑 Upgrade to VIP', callback_data: 'manage_vip' }
              ]]
            }
          }
        );
      } else {
        await bot.sendMessage(chatId, `💕 *YOUR MATCHES (${valid.length})* 💕\n\nSwipe through your matches below! 👇`, {
          parse_mode: 'Markdown'
        });
      }



      // Send each match as a card with photo

      for (const { match, other } of valid.slice(0, 10)) {

        console.log('[Matches] Processing card for:', other?.name);

        try {

          const genderIcon = other.gender === 'Male' ? '👔' : other.gender === 'Female' ? '👗' : '🧒';

          const vipBadge = other.isVip ? ' 👑' : '';

          

          let caption = `${genderIcon} *${other.name}*${vipBadge}, ${other.age}\n`;

          caption += `📍 ${other.location}\n`;

          

          if (other.bio) {

            const shortBio = other.bio.length > 100 ? other.bio.substring(0, 97) + '...' : other.bio;

            caption += `\n💬 ${shortBio}\n`;

          }

          

          // Check if chat is unlocked

          if (match.chatUnlocked) {

            caption += `\n🎉 *Private chat unlocked!*`;

          } else if (match.messageCount?.user1 > 0 || match.messageCount?.user2 > 0) {

            const myMsgs = match.messageCount?.user1 || 0;

            const theirMsgs = match.messageCount?.user2 || 0;

            caption += `\n📩 Messages: You ${myMsgs}/3 · Them ${theirMsgs}/3`;

          }



          // Buttons: non-VIP males get VIP upgrade prompt instead of chat
          const matchButtons = isNonVipMale ? {
            inline_keyboard: [
              [
                { text: '🔒 Unlock Chat (VIP)', callback_data: 'manage_vip' },
                { text: '👤 Profile', callback_data: `view_match_profile_${other.telegramId}` }
              ]
            ]
          } : {
            inline_keyboard: [
              [
                { text: '💬 Chat', callback_data: `chat_gate_${other.telegramId}` },
                { text: '👤 Profile', callback_data: `view_match_profile_${other.telegramId}` }
              ]
            ]
          };



          // Send with photo if available (blurred for non-VIP males)
          if (other.photos && other.photos.length > 0 && !isNonVipMale) {
            console.log('[Matches] Sending photo for:', other.name, 'URL:', other.photos[0]);
            try {
              await bot.sendPhoto(chatId, other.photos[0], {
                caption: caption,
                parse_mode: 'Markdown',
                reply_markup: matchButtons
              });
              console.log('[Matches] Photo sent successfully for:', other.name);
            } catch (photoError) {
              console.error('[Matches] Photo failed, sending text instead:', photoError.message);
              // Fallback to text if photo fails
              await bot.sendMessage(chatId, caption, {
                parse_mode: 'Markdown',
                reply_markup: matchButtons
              });
            }
          } else {
            console.log('[Matches] Sending text card for:', other.name, isNonVipMale ? '(non-VIP male - photo hidden)' : '(no photo)');
            // Send as text if no photo OR if non-VIP male (hide photos)
            const displayCaption = isNonVipMale 
              ? caption + '\n\n🔒 _Photo hidden - Upgrade to VIP to view_'
              : caption;
            await bot.sendMessage(chatId, displayCaption, {
              parse_mode: 'Markdown',
              reply_markup: matchButtons
            });
            console.log('[Matches] Text sent successfully for:', other.name);
          }

          
        } catch (cardError) {

          console.error('[Matches] Error sending match card:', cardError);

          console.error('[Matches] Error message:', cardError.message);

          console.error('[Matches] Failed for user:', other?.name, other?.telegramId);

          // Continue to next match even if one fails

        }

      }



      if (valid.length > 10) {

        await bot.sendMessage(chatId, `_...and ${valid.length - 10} more matches! Use /matches to see all._`, {

          parse_mode: 'Markdown'

        });

      }



      bot.sendMessage(chatId, '💡 Tap the buttons to chat or view full profiles!', { reply_markup: MAIN_KEYBOARD });



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

      // Send photos with red heart overlay
      if (myPhoto && theirPhoto) {
        await bot.sendMediaGroup(otherTelegramId, [
          { type: 'photo', media: theirPhoto, caption: '❤️', parse_mode: 'Markdown' },
          { type: 'photo', media: myPhoto, caption: '❤️', parse_mode: 'Markdown' }
        ]).catch(() => { });
      } else if (myPhoto) {
        await bot.sendPhoto(otherTelegramId, myPhoto, { caption: '❤️' }).catch(() => { });
      }

      // Send match notification with inline buttons
      await bot.sendMessage(

        String(otherTelegramId),

        `🎉💖 *IT'S A MATCH!* 💖🎉\n\n` +

        `*${myUser.name}* liked you back!\n\n` +

        `💡 *Conversation starter:*\n${starter}`,

        { 
          parse_mode: 'Markdown', 
          reply_markup: {
            inline_keyboard: [
              [{ text: '💬 Start Chatting', callback_data: `chat_gate_${myUser.telegramId}` }],
              [{ text: '💕 View All Matches', callback_data: 'view_matches' }]
            ]
          }
        }

      );

    } catch (e) {

      // User may have blocked the bot — ignore silently

    }

  }



  // ─────────────────────────────────────────────────────────────────────

  // Action helpers — called from both message handler and callback handler

  // ─────────────────────────────────────────────────────────────────────

  async function handleLike(chatId, telegramId, targetTelegramId) {

    if (!canLike(telegramId)) {

      return bot.sendMessage(chatId, '⏳ Slow down a bit! Wait a second before liking again.');

    }

    recordLike(telegramId);



    const [fromUser, toUser] = await Promise.all([

      User.findOne({ telegramId }),

      User.findOne({ telegramId: targetTelegramId })

    ]);

    if (!fromUser || !toUser) return bot.sendMessage(chatId, '❌ User not found.');



    if (userStates) userStates.delete(String(telegramId));



    if (!toUser.likes.includes(String(telegramId))) {

      toUser.likes.push(String(telegramId));

      await toUser.save();

    }

    if (!(fromUser.seenProfiles || []).includes(String(targetTelegramId))) {

      await User.findOneAndUpdate({ telegramId: String(telegramId) }, { $push: { seenProfiles: String(targetTelegramId) } });

    }

    trackLike(telegramId, targetTelegramId);



    const isMutualLike = Like

      ? !!(await Like.findOne({ fromUserId: toUser._id, toUserId: fromUser._id }))

      : (fromUser.likes || []).includes(String(targetTelegramId));



    if (isMutualLike) {

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

      const fromPhoto = (fromUser.photos || [])[0];
      const toPhoto = (toUser.photos || [])[0];

      // Send photos with red heart overlay
      if (fromPhoto && toPhoto) {
        await bot.sendMediaGroup(chatId, [
          { type: 'photo', media: fromPhoto, caption: '❤️', parse_mode: 'Markdown' },
          { type: 'photo', media: toPhoto, caption: '❤️', parse_mode: 'Markdown' }
        ]).catch(() => { });
      } else if (toPhoto) {
        await bot.sendPhoto(chatId, toPhoto, { caption: '❤️' }).catch(() => { });
      }

      // Send match notification with inline buttons
      await bot.sendMessage(chatId,

        `🎉💖 *IT'S A MATCH!* 💖🎉\n\nYou and *${toUser.name}* liked each other!\n\n💡 *Conversation starter:*\n${starter}`,

        {

          parse_mode: 'Markdown',

          reply_markup: {
            inline_keyboard: [
              [{ text: '💬 Start Chatting', callback_data: `chat_gate_${targetTelegramId}` }],
              [{ text: '💕 View All Matches', callback_data: 'view_matches' }]
            ]
          }

        }

      );

      notifyMatchedUser(targetTelegramId, fromUser, toUser);

    } else {

      await bot.sendMessage(chatId, randomFrom(LIKE_LINES), { reply_markup: MAIN_KEYBOARD });

      await browseProfiles(chatId, telegramId);

    }

  }



  async function handleSkip(chatId, telegramId, targetTelegramId) {

    if (userStates) userStates.delete(String(telegramId));

    const fromUser = await User.findOne({ telegramId });

    if (fromUser && !(fromUser.seenProfiles || []).includes(String(targetTelegramId))) {

      await User.findOneAndUpdate(

        { telegramId: String(telegramId) },

        { $push: { seenProfiles: String(targetTelegramId) }, lastSkippedProfile: String(targetTelegramId) }

      );

      invalidateUserCache(String(telegramId));

    }

    await bot.sendMessage(chatId, randomFrom(PASS_LINES), { reply_markup: MAIN_KEYBOARD });

    await browseProfiles(chatId, telegramId);

  }



  async function handleSuperLike(chatId, telegramId, targetTelegramId) {

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

        { parse_mode: 'Markdown', reply_markup: COINS_STORE_KEYBOARD }

      );

    }

    const toUser = await User.findOne({ telegramId: targetTelegramId });

    if (!toUser) return bot.sendMessage(chatId, '❌ User not found.');

    if (useFreeSuperLike) {

      await User.findOneAndUpdate({ telegramId: String(telegramId) }, { dailySuperLikesVip: { count: freeSLUsed + 1, date: today } });

    } else {

      fromUser.coins -= 10;

      await fromUser.save();

    }

    if (userStates) userStates.delete(String(telegramId));

    if (Like) {

      await Like.findOneAndUpdate(

        { fromUserId: fromUser._id, toUserId: toUser._id },

        { fromUserId: fromUser._id, toUserId: toUser._id, superLike: true },

        { upsert: true }

      );

    }

    try {

      await bot.sendMessage(String(targetTelegramId),

        `⭐ *Someone Super Liked You!*\n\n*${fromUser.name}* thinks you're special!\n\nBrowse their profile to see if you're interested! 💕`,

        { parse_mode: 'Markdown', reply_markup: MAIN_KEYBOARD }

      );

    } catch (e) { /* user may have blocked bot */ }

    await bot.sendMessage(chatId, `⭐ Super Like sent to *${toUser.name}*! They've been notified.`, { parse_mode: 'Markdown' });

    await browseProfiles(chatId, telegramId);

  }



  // ─────────────────────────────────────────────────────────────────────

  // Reply Keyboard handler — Like / Skip / Super Like / Gift

  // ─────────────────────────────────────────────────────────────────────

  const BROWSE_BUTTONS = ['💖 Like', '⏭️ Skip', '⭐ Super Like', '🎁 Gift'];



  bot.on('message', async (msg) => {

    const text = msg.text;

    if (!text || !BROWSE_BUTTONS.includes(text)) return;



    const chatId = msg.chat.id;

    const telegramId = String(msg.from.id);



    const state = userStates && userStates.get(telegramId);

    if (!state || !state.browsing || !state.browsing.profileId) {

      return browseProfiles(chatId, msg.from.id);

    }



    const targetTelegramId = state.browsing.profileId;



    try {

      if (text === '💖 Like') {

        await handleLike(chatId, telegramId, targetTelegramId);

      } else if (text === '⏭️ Skip') {

        await handleSkip(chatId, telegramId, targetTelegramId);

      } else if (text === '⭐ Super Like') {

        await handleSuperLike(chatId, telegramId, targetTelegramId);

      } else if (text === '🎁 Gift') {

        bot.emit('callback_query', {

          id: 'kb_gift',

          message: { chat: { id: chatId }, message_id: 0, from: msg.from },

          from: msg.from,

          data: `gift_to_${targetTelegramId}`

        });

      }

    } catch (err) {

      console.error('[Browse KB] Error:', err);

      bot.sendMessage(chatId, '❌ Something went wrong. Please try again.');

    }

  });



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

        await handleLike(chatId, telegramId, data.replace('like_', ''));



        // ── ❌ SKIP / PASS ────────────────────────────────────────────────

      } else if (data.startsWith('pass_')) {

        await handleSkip(chatId, telegramId, data.replace('pass_', ''));



        // ── ↩️ UNDO SKIP (VIP only) ───────────────────────────────────────

      } else if (data.startsWith('undo_skip_')) {

        const targetId = data.replace('undo_skip_', '');

        const userDoc = await User.findOne({ telegramId: String(telegramId) });

        if (!userDoc || !userDoc.isVip) {

          return bot.sendMessage(chatId,

            '🔒 *VIP Feature*\n\nUndo Skip is available for VIP members only.',

            { parse_mode: 'Markdown', reply_markup: VIP_KEYBOARD }

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

        const undoKeyboard = buildProfileKeyboard();

        if (userStates) userStates.set(String(telegramId), { browsing: { profileId: String(undoProfile.telegramId) } });

        await bot.sendMessage(chatId, '↩️ *Undone! Here they are again:*', { parse_mode: 'Markdown' });

        if (undoProfile.photos && undoProfile.photos.length > 0) {

          await bot.sendPhoto(chatId, undoProfile.photos[0], { caption: undoCaption, parse_mode: 'Markdown', reply_markup: undoKeyboard });

        } else {

          await bot.sendMessage(chatId, undoCaption, { parse_mode: 'Markdown', reply_markup: undoKeyboard });

        }



        // ── ⭐ SUPER LIKE ─────────────────────────────────────────────────

      } else if (data.startsWith('superlike_')) {

        await handleSuperLike(chatId, telegramId, data.replace('superlike_', ''));



        // ──  UNMATCH ────────────────────────────────────────────────────

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



          bot.sendMessage(chatId, '💔 *Unmatched.*\n\nYou can always find new matches!', { parse_mode: 'Markdown', reply_markup: MAIN_KEYBOARD });

        } else {

          bot.sendMessage(chatId, '❌ Failed to unmatch. Please try again.');

        }



        // ── 👀 VIEW MATCHES ───────────────────────────────────────────────

      } else if (data === 'view_matches') {

        await showMatches(chatId, telegramId);



        // ── 🔍 START BROWSE ───────────────────────────────────────────────

      } else if (data === 'start_browse' || data === 'browse_profiles') {

        return browseProfiles(chatId, telegramId);



        // ── 👤 VIEW MATCH PROFILE ─────────────────────────────────────────

      } else if (data.startsWith('view_match_profile_')) {

        const targetId = data.replace('view_match_profile_', '');

        console.log('[VIEW PROFILE] Triggered for targetId:', targetId);

        

        try {

          const targetUser = await User.findOne({ telegramId: String(targetId) });

          console.log('[VIEW PROFILE] User found:', targetUser ? targetUser.name : 'null');

          if (!targetUser) {

            return bot.sendMessage(chatId, '❌ User not found.');

          }



          // Send all photos if available

          if (targetUser.photos && targetUser.photos.length > 0) {

            try {

              if (targetUser.photos.length === 1) {

                await bot.sendPhoto(chatId, targetUser.photos[0], {

                  caption: `📸 ${targetUser.name}'s Photo`

                });

              } else {

                // Send as media group (up to 10 photos)

                const mediaGroup = targetUser.photos.slice(0, 10).map((photo, index) => ({

                  type: 'photo',

                  media: photo,

                  caption: index === 0 ? `📸 ${targetUser.name}'s Photos (${targetUser.photos.length} total)` : undefined

                }));

                await bot.sendMediaGroup(chatId, mediaGroup);

              }

            } catch (photoError) {

              console.error('Error sending photos:', photoError);

              // Continue to send profile text even if photos fail

              await bot.sendMessage(chatId, `⚠️ Could not load photos for this profile.`);

            }

          } else {

            await bot.sendMessage(chatId, `📷 *No photos available*\n\n`);

          }



          // Send profile details

          let profileMsg = `👤 *${targetUser.name}'s Profile*\n\n`;

          profileMsg += `🎂 Age: ${targetUser.age}\n`;

          profileMsg += `🎭 Gender: ${targetUser.gender}\n`;

          profileMsg += `💕 Looking for: ${targetUser.lookingFor}\n`;

          profileMsg += `📍 Location: ${targetUser.location}\n\n`;

          

          if (targetUser.bio) {

            profileMsg += `💬 *Bio:*\n${targetUser.bio}\n\n`;

          }



          profileMsg += `📸 Photos: ${targetUser.photos?.length || 0}\n`;

          

          if (targetUser.isVip) {

            profileMsg += `👑 VIP Member\n`;

          }



          const profileKeyboard = {

            inline_keyboard: [

              [

                { text: '💬 Start Chat', callback_data: `chat_gate_${targetId}` },

                { text: '🎁 Send Gift', callback_data: `gift_to_${targetId}` }

              ],

              [

                { text: '💔 Unmatch', callback_data: `unmatch_${targetId}` },

                { text: '🔙 Back to Matches', callback_data: 'view_matches' }

              ]

            ]

          };



          await bot.sendMessage(chatId, profileMsg, {

            parse_mode: 'Markdown',

            reply_markup: profileKeyboard

          });



        } catch (error) {

          console.error('Error viewing match profile:', error);

          console.error('Error details:', {

            message: error.message,

            stack: error.stack,

            targetId: targetId

          });

          bot.sendMessage(chatId, `❌ Failed to load profile. Error: ${error.message}`);

        }



        // ── �� CHAT GATE ──────────────────────────────────────────────────

      } else if (data.startsWith('chat_gate_') || data.startsWith('chat_')) {

        const targetId = data.startsWith('chat_gate_')

          ? data.replace('chat_gate_', '')

          : data.replace('chat_', '');

        console.log('[BROWSING] Chat button clicked - checking access for user:', telegramId);

        // Check if user has chat access (males need VIP)
        if (!(await requireMatchesAccess(bot, chatId, String(telegramId), User, 'chat'))) {
          console.log('[BROWSING] Chat access DENIED by requireMatchesAccess');
          return;

        }
        
        console.log('[BROWSING] Chat access GRANTED - entering chat room');

        // Use the new private chat room system
        if (global.enterChatRoom) {
          await global.enterChatRoom(chatId, telegramId, targetId);
        } else {
          bot.sendMessage(chatId, '❌ Chat system is initializing. Please try again in a moment.');
        }

      // ── CHAT ROOM CONTROLS ──────────────────────────────────────────────────
      } else if (data.startsWith('enter_chat_')) {
        const targetId = data.replace('enter_chat_', '');
        if (global.enterChatRoom) {
          await global.enterChatRoom(chatId, telegramId, targetId);
        }

      } else if (data === 'exit_chat_room') {
        if (global.exitChatRoom) {
          await global.exitChatRoom(chatId, telegramId);
        }

      } else if (data.startsWith('chat_history_')) {
        const targetId = data.replace('chat_history_', '');
        const { viewChatHistory } = require('./chatRoom').setupChatRoomCommands(bot, User, require('../server').ChatRoom, userStates);
        await viewChatHistory(chatId, telegramId, targetId);

      } else if (data.startsWith('mute_chat_')) {
        const targetId = data.replace('mute_chat_', '');
        const { muteChat } = require('./chatRoom').setupChatRoomCommands(bot, User, require('../server').ChatRoom, userStates);
        await muteChat(chatId, telegramId, targetId);

      } else if (data.startsWith('block_chat_')) {
        const targetId = data.replace('block_chat_', '');
        const { blockChat } = require('./chatRoom').setupChatRoomCommands(bot, User, require('../server').ChatRoom, userStates);
        await blockChat(chatId, telegramId, targetId);

      }



    } catch (err) {

      console.error('[Browsing callback] Error:', err);

      bot.sendMessage(chatId, '❌ Something went wrong. Please try again.');

    }

  });



  // Export so other modules can trigger browsing

  module.exports.browseProfiles = browseProfiles;

  module.exports.showMatches = showMatches;

}



module.exports = { setupBrowsingCommands };

