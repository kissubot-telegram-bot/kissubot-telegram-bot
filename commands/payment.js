const { invalidateUserCache } = require('./auth');

const PAYMENT_TOKEN = process.env.TELEGRAM_PAYMENT_TOKEN || '';

// ── Product Catalog ──────────────────────────────────────────────────────────
// All amounts are in Telegram Stars (XTR). 1 Star ≈ $0.02 USD.
const PRODUCTS = {
  // Coin packages
  coins_100:  { title: '💰 100 Kissu Coins',    description: 'Top up 100 coins. Use them for super likes, gifts, and boosts.',              amount: 75,   type: 'coins', coins: 100,  bonus: 0    },
  coins_500:  { title: '💰 500 Kissu Coins',    description: 'Top up 500 coins + 50 bonus coins free (10% extra).',                         amount: 299,  type: 'coins', coins: 500,  bonus: 50   },
  coins_1000: { title: '💰 1,000 Kissu Coins',  description: 'Top up 1,000 coins + 150 bonus coins free (15% extra).',                      amount: 499,  type: 'coins', coins: 1000, bonus: 150  },
  coins_5000: { title: '💰 5,000 Kissu Coins',  description: 'Best value! 5,000 coins + 1,000 bonus coins free (20% extra).',               amount: 1999, type: 'coins', coins: 5000, bonus: 1000 },

  // VIP membership
  vip_monthly:  { title: '👑 VIP — 1 Month',   description: 'Unlimited likes · See who liked you · Priority browse · Advanced filters · VIP badge.', amount: 749,  type: 'vip', days: 30  },
  vip_6months:  { title: '👑 VIP — 6 Months',  description: 'All VIP perks for 6 months. Save 44% vs monthly!',                              amount: 2490, type: 'vip', days: 180 },
  vip_yearly:   { title: '👑 VIP — 1 Year',    description: 'All VIP perks for a full year. Best value — save 58% vs monthly!',              amount: 3490, type: 'vip', days: 365 },

  // Profile boosts
  boost_1:  { title: '🚀 1 Profile Boost',   description: 'Show your profile to 10× more people for 30 minutes.',            amount: 149, type: 'boost', count: 1  },
  boost_5:  { title: '🚀 5 Profile Boosts',  description: '5 boosts to use any time. Save 33% vs single boost.',             amount: 499, type: 'boost', count: 5  },
  boost_10: { title: '🚀 10 Profile Boosts', description: '10 boosts bundle. Best value — save 50% vs single boost.',        amount: 749, type: 'boost', count: 10 },
};

function setupPaymentCommands(bot, User) {

  // ── Step 1: Send invoice when user taps a pay_* button ──────────────────
  bot.on('callback_query', async (query) => {
    const data = query.data;
    if (!data.startsWith('pay_')) return;

    const chatId = query.message.chat.id;
    const telegramId = query.from.id;
    const productKey = data.replace('pay_', '');
    const product = PRODUCTS[productKey];

    if (!product) {
      return bot.answerCallbackQuery(query.id, { text: '❌ Unknown product.' });
    }

    await bot.answerCallbackQuery(query.id).catch(() => {});

    try {
      await bot.sendInvoice(
        chatId,
        product.title,
        product.description,
        `kissubot_${productKey}_${telegramId}`,
        PAYMENT_TOKEN,
        'XTR',
        [{ label: product.title, amount: product.amount }]
      );
    } catch (err) {
      console.error('[Payment] sendInvoice error:', err.message);
      bot.sendMessage(chatId, '❌ Failed to create invoice. Please try again later.');
    }
  });

  // ── Step 2: Answer pre-checkout query within 10 seconds ─────────────────
  bot.on('pre_checkout_query', async (query) => {
    try {
      await bot.answerPreCheckoutQuery(query.id, true);
    } catch (err) {
      console.error('[Payment] pre_checkout_query error:', err.message);
      try {
        await bot.answerPreCheckoutQuery(query.id, false, { error_message: 'Something went wrong. Please try again.' });
      } catch (_) {}
    }
  });

  // ── Step 3: Fulfill order on successful payment ──────────────────────────
  bot.on('message', async (msg) => {
    if (!msg.successful_payment) return;

    const chatId = msg.chat.id;
    const payload = msg.successful_payment.invoice_payload;
    const stars = msg.successful_payment.total_amount;

    // Payload format: kissubot_<productKey>_<telegramId>
    // e.g. kissubot_coins_100_123456789 → productKey=coins_100
    const parts = payload.split('_');
    if (parts[0] !== 'kissubot' || parts.length < 3) {
      console.error('[Payment] Unexpected payload:', payload);
      return;
    }

    const buyerTelegramId = parts[parts.length - 1];
    const productKey = parts.slice(1, -1).join('_');
    const product = PRODUCTS[productKey];

    if (!product) {
      console.error('[Payment] Unknown product key in payload:', productKey);
      return bot.sendMessage(chatId, '⚠️ Payment received but product not recognized. Please contact support.');
    }

    try {
      const user = await User.findOne({ telegramId: String(buyerTelegramId) });
      if (!user) {
        return bot.sendMessage(chatId, '❌ Account not found. Please contact support and mention your payment.');
      }

      if (product.type === 'coins') {
        const total = product.coins + product.bonus;
        user.coins = (user.coins || 0) + total;
        await user.save();
        invalidateUserCache(String(buyerTelegramId));

        await bot.sendMessage(chatId,
          `✅ *Payment Successful!*\n\n` +
          `💰 *${product.coins} coins* added to your wallet` +
          (product.bonus ? ` + *${product.bonus} bonus coins* free` : '') + `!\n` +
          `🪙 *New balance:* ${user.coins} coins\n\n` +
          `💡 Use coins for VIP, super likes, gifts & boosts.`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '👑 Get VIP', callback_data: 'manage_vip' }, { text: '🔍 Browse', callback_data: 'start_browse' }],
                [{ text: '🏠 Main Menu', callback_data: 'main_menu' }]
              ]
            }
          }
        );

      } else if (product.type === 'vip') {
        const now = new Date();
        const base = user.vipExpiresAt && user.vipExpiresAt > now ? user.vipExpiresAt : now;
        const newExpiry = new Date(base.getTime() + product.days * 24 * 60 * 60 * 1000);
        user.isVip = true;
        user.vipExpiresAt = newExpiry;
        await user.save();
        invalidateUserCache(String(buyerTelegramId));

        const expiryStr = newExpiry.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
        await bot.sendMessage(chatId,
          `✅ *VIP Activated!* 👑\n\n` +
          `You're now a *VIP member* until *${expiryStr}*!\n\n` +
          `*Your perks:*\n` +
          `• ♾️ Unlimited likes\n` +
          `• 👀 See who liked you\n` +
          `• 🚀 Priority in browse queue\n` +
          `• 🔍 Advanced search filters\n` +
          `• ⭐ VIP badge on your profile`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔍 Start Browsing', callback_data: 'start_browse' }],
                [{ text: '🏠 Main Menu', callback_data: 'main_menu' }]
              ]
            }
          }
        );

      } else if (product.type === 'boost') {
        user.boosts = (user.boosts || 0) + product.count;
        await user.save();
        invalidateUserCache(String(buyerTelegramId));

        await bot.sendMessage(chatId,
          `✅ *${product.count} Boost${product.count > 1 ? 's' : ''} Added!* 🚀\n\n` +
          `You now have *${user.boosts} boost${user.boosts !== 1 ? 's' : ''}* ready to use.\n\n` +
          `Each boost makes your profile *10× more visible* for 30 minutes!`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🚀 Use a Boost', callback_data: 'boost_profile' }],
                [{ text: '🏠 Main Menu', callback_data: 'main_menu' }]
              ]
            }
          }
        );
      }

      console.log(`[Payment] ✅ Fulfilled ${productKey} for user ${buyerTelegramId} (${stars} Stars)`);

    } catch (err) {
      console.error('[Payment] Fulfill error:', err);
      bot.sendMessage(chatId, '❌ Payment received but something went wrong with fulfillment. Please contact support.');
    }
  });
}

module.exports = { setupPaymentCommands, PRODUCTS };
