const { getCachedUserProfile, invalidateUserCache } = require('./auth');

const BOOST_COST_COINS = 50;        // coins to activate a boost
const BOOST_DURATION_HOURS = 24;    // hours a boost lasts
const FREE_BOOST_INTERVAL_DAYS = 7; // VIPs get 1 free boost per week

function setupVipPerksCommands(bot, User) {

  // ─────────────────────────────────────────────────────────────────────
  // /perks — show VIP perks panel
  // ─────────────────────────────────────────────────────────────────────
  bot.onText(/\/perks/, async (msg) => {
    await showPerksPanel(msg.chat.id, msg.from.id);
  });

  async function showPerksPanel(chatId, telegramId) {
    const user = await User.findOne({ telegramId: String(telegramId) });
    if (!user) return bot.sendMessage(chatId, '❌ User not found.');

    if (!user.isVip) {
      return bot.sendMessage(chatId,
        `👑 *VIP Perks*\n\n` +
        `Subscribe to unlock all perks:\n\n` +
        `♾️ Unlimited daily swipes\n` +
        `📸 See all profile photos\n` +
        `⭐ 5 free super likes/day\n` +
        `↩️ Undo skip\n` +
        `🚀 Profile boost (appear first)\n` +
        `👻 Invisible browsing mode\n` +
        `🪙 500 coins/month\n` +
        `💌 View & chat with matches\n` +
        `👑 VIP badge on your profile`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '👑 Subscribe Now', callback_data: 'manage_vip' }],
              [{ text: '🏠 Main Menu', callback_data: 'main_menu' }]
            ]
          }
        }
      );
    }

    const now = new Date();
    const isBoostActive = user.boostExpiresAt && user.boostExpiresAt > now;
    const boostStatus = isBoostActive
      ? `🔥 *Active* — expires ${formatTimeLeft(user.boostExpiresAt)}`
      : `⬛ Inactive`;

    const invisStatus = user.invisibleMode ? '👻 *ON* — browsing invisibly' : '⬛ OFF';

    const lastBoost = user.lastBoostAt ? new Date(user.lastBoostAt) : null;
    const freeBoostAvailable = !lastBoost || (now - lastBoost) > FREE_BOOST_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
    const boostBtnLabel = isBoostActive
      ? '🚀 Boost Active'
      : freeBoostAvailable
        ? '🚀 Activate Free Boost (1/week)'
        : `🚀 Boost Profile (${BOOST_COST_COINS} coins)`;

    const today = now.toDateString();
    const vipDaily = user.dailySuperLikesVip || {};
    const freeSLUsed = vipDaily.date === today ? (vipDaily.count || 0) : 0;

    const perksMsg =
      `👑 *Your VIP Perks* 👑\n\n` +
      `🚀 *Profile Boost:* ${boostStatus}\n` +
      `👻 *Invisible Mode:* ${invisStatus}\n` +
      `⭐ *Free Super Likes:* ${freeSLUsed}/5 used today\n` +
      `🪙 *Coins:* ${user.coins || 0}\n` +
      `📸 *All Photos:* ✅ You see full galleries\n` +
      `↩️ *Undo Skip:* ✅ Available\n` +
      `💌 *Matches & Chat:* ✅ Unlocked`;

    bot.sendMessage(chatId, perksMsg, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: boostBtnLabel, callback_data: 'activate_boost' }],
          [{ text: user.invisibleMode ? '👁️ Turn Off Invisible Mode' : '👻 Turn On Invisible Mode', callback_data: 'toggle_invisible' }],
          [{ text: '🏠 Main Menu', callback_data: 'main_menu' }]
        ]
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  // Callback handler
  // ─────────────────────────────────────────────────────────────────────
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const telegramId = query.from.id;
    const data = query.data;

    if (!data) return;

    try {
      // ── 🚀 ACTIVATE BOOST ───────────────────────────────────────────
      if (data === 'activate_boost') {
        await bot.answerCallbackQuery(query.id).catch(() => {});
        const user = await User.findOne({ telegramId: String(telegramId) });
        if (!user) return;

        if (!user.isVip) {
          return bot.sendMessage(chatId,
            '🔒 *VIP Feature*\n\nProfile boost is available for VIP members only.',
            { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '👑 Subscribe', callback_data: 'manage_vip' }]] } }
          );
        }

        const now = new Date();
        if (user.boostExpiresAt && user.boostExpiresAt > now) {
          return bot.sendMessage(chatId,
            `🚀 *Boost Already Active*\n\nYour boost expires ${formatTimeLeft(user.boostExpiresAt)}.`,
            { parse_mode: 'Markdown' }
          );
        }

        const lastBoost = user.lastBoostAt ? new Date(user.lastBoostAt) : null;
        const freeBoostAvailable = !lastBoost || (now - lastBoost) > FREE_BOOST_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
        const boostExpiry = new Date(now.getTime() + BOOST_DURATION_HOURS * 60 * 60 * 1000);

        if (freeBoostAvailable) {
          await User.findOneAndUpdate(
            { telegramId: String(telegramId) },
            { boostExpiresAt: boostExpiry, lastBoostAt: now }
          );
          invalidateUserCache(String(telegramId));
          return bot.sendMessage(chatId,
            `🚀 *Boost Activated!*\n\nYour profile will appear first for the next *${BOOST_DURATION_HOURS} hours*!\n\n_Next free boost available in ${FREE_BOOST_INTERVAL_DAYS} days._`,
            { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🔍 Start Browsing', callback_data: 'start_browse' }]] } }
          );
        }

        if ((user.coins || 0) < BOOST_COST_COINS) {
          return bot.sendMessage(chatId,
            `❌ *Not Enough Coins*\n\nYou need *${BOOST_COST_COINS} coins* to activate a boost.\n\nYour balance: ${user.coins || 0} coins`,
            { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '💰 Buy Coins', callback_data: 'buy_coins' }]] } }
          );
        }

        await User.findOneAndUpdate(
          { telegramId: String(telegramId) },
          { $inc: { coins: -BOOST_COST_COINS }, boostExpiresAt: boostExpiry, lastBoostAt: now }
        );
        invalidateUserCache(String(telegramId));
        bot.sendMessage(chatId,
          `🚀 *Boost Activated!*\n\n-${BOOST_COST_COINS} coins\n\nYour profile will appear first for the next *${BOOST_DURATION_HOURS} hours*! 🔥`,
          { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🔍 Start Browsing', callback_data: 'start_browse' }]] } }
        );

      // ── 👻 TOGGLE INVISIBLE MODE ─────────────────────────────────────
      } else if (data === 'toggle_invisible') {
        await bot.answerCallbackQuery(query.id).catch(() => {});
        const user = await User.findOne({ telegramId: String(telegramId) });
        if (!user) return;

        if (!user.isVip) {
          return bot.sendMessage(chatId,
            '🔒 *VIP Feature*\n\nInvisible mode is available for VIP members only.',
            { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '👑 Subscribe', callback_data: 'manage_vip' }]] } }
          );
        }

        const newMode = !user.invisibleMode;
        await User.findOneAndUpdate(
          { telegramId: String(telegramId) },
          { invisibleMode: newMode }
        );
        invalidateUserCache(String(telegramId));

        const statusMsg = newMode
          ? `👻 *Invisible Mode ON*\n\nYou can now browse profiles without updating your "last active" status. Others won't see when you're online.`
          : `👁️ *Invisible Mode OFF*\n\nYour activity status is now visible again.`;

        bot.sendMessage(chatId, statusMsg, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: newMode ? '👁️ Turn Off Invisible Mode' : '👻 Turn On Invisible Mode', callback_data: 'toggle_invisible' }],
              [{ text: '👑 My VIP Perks', callback_data: 'show_vip_perks' }]
            ]
          }
        });

      // ── 👑 SHOW VIP PERKS PANEL ──────────────────────────────────────
      } else if (data === 'show_vip_perks') {
        await bot.answerCallbackQuery(query.id).catch(() => {});
        await showPerksPanel(chatId, telegramId);
      }

    } catch (err) {
      console.error('[VIP Perks] Error:', err);
    }
  });
}

function formatTimeLeft(expiresAt) {
  const ms = new Date(expiresAt) - new Date();
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `in ${hours}h ${mins}m`;
  return `in ${mins} minutes`;
}

module.exports = { setupVipPerksCommands };
