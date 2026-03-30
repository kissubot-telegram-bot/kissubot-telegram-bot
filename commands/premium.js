const axios = require('axios');
const { getCachedUserProfile } = require('./auth');
const {
  MAIN_KEYBOARD, MAIN_KB_BUTTONS,
  VIP_KEYBOARD, VIP_KB_BUTTONS,
  VIP_PLANS_KEYBOARD, VIP_PLANS_KB_BUTTONS,
  COIN_VIP_PLANS_KEYBOARD, COIN_VIP_PLANS_KB_BUTTONS,
  GIFT_VIP_PLANS_KEYBOARD, GIFT_VIP_PLANS_KB_BUTTONS,
  COINS_STORE_KEYBOARD, COINS_STORE_KB_BUTTONS,
  BOOSTS_STORE_KEYBOARD, BOOSTS_STORE_KB_BUTTONS,
  PRIORITY_CONFIRM_KEYBOARD, PRIORITY_CONFIRM_KB_BUTTONS
} = require('../keyboard');

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

const PAYMENT_TOKEN = process.env.TELEGRAM_PAYMENT_TOKEN || '';

const GIFT_VIP_PLANS = {
  gift_vip_monthly:  { name: '1 Month VIP',  days: 30,  amount: 749  },
  gift_vip_6months:  { name: '6 Months VIP', days: 180, amount: 2490 },
  gift_vip_yearly:   { name: '1 Year VIP',   days: 365, amount: 3490 },
};

async function sendVipMenu(bot, chatId, telegramId, User) {
  try {
    const user = await getCachedUserProfile(telegramId, User);
    if (user.isVip) {
      const expiry = user.vipExpiresAt ? new Date(user.vipExpiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Lifetime';
      return bot.sendMessage(chatId,
        `👑 *VIP Active!* ✨\n\n` +
        `🎉 You're a VIP member until *${expiry}*!\n\n` +
        `*Your benefits:*\n` +
        `• 👀 See who likes you\n` +
        `• ♾️ Unlimited likes\n` +
        `• 🚀 Priority in browse\n` +
        `• 🔍 Advanced filters\n` +
        `• ⭐ VIP badge on profile`,
        { parse_mode: 'Markdown', reply_markup: VIP_KEYBOARD }
      );
    } else {
      return bot.sendMessage(chatId,
        `👑 *Upgrade to VIP* 💎\n\n` +
        `*Unlock exclusive perks:*\n` +
        `• 👀 See who liked you\n` +
        `• ♾️ Unlimited likes\n` +
        `• 🚀 Priority browse placement\n` +
        `• 🔍 Advanced search filters\n` +
        `• 🚫 No ads\n` +
        `• ⭐ VIP badge\n\n` +
        `_Tap_ *👑 Get VIP* _to subscribe!_`,
        { parse_mode: 'Markdown', reply_markup: VIP_KEYBOARD }
      );
    }
  } catch (err) {
    console.error('VIP menu error:', err.message);
    bot.sendMessage(chatId, '❌ Failed to load VIP status. Please try again.');
  }
}

function setupPremiumCommands(bot, User, userStates) {
  const axios = require('axios');
  const API_BASE = process.env.API_BASE || 'http://localhost:3000';

  bot.onText(/\/priority/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    try {
      const user = await getCachedUserProfile(telegramId, User);

      if (user.isVip) {
        bot.sendMessage(chatId, '🚀 **As a VIP, you already have priority in the browse queue!** Your profile is shown to more users.');
        return;
      }

      const priorityMsg = `**🚀 Get Your Profile Noticed with Priority Boost!**\n\n` +
        `A Priority Boost places your profile at the top of the browsing queue for 30 minutes, making you visible to more users.\n\n` +
        `**Cost:** 100 Coins\n` +
        `**Your Balance:** ${user.coins || 0} 🪙\n\n` +
        `Are you sure you want to activate a Priority Boost?`;

      userStates && userStates.set(String(telegramId), { awaitingPriorityConfirm: true });
      bot.sendMessage(chatId, priorityMsg, {
        parse_mode: 'Markdown',
        reply_markup: PRIORITY_CONFIRM_KEYBOARD
      });
    } catch (err) {
      bot.sendMessage(chatId, '❌ Failed to fetch your status. Please try again later.');
    }
  });

  // Callback query handlers
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const telegramId = query.from.id;
    const data = query.data;

    try {
      switch (data) {
        case 'extend_vip':
          bot.sendMessage(chatId, '🔄 **Extend VIP Membership**\n\nChoose a plan to extend — paid with Telegram Stars (⭐):', {
            parse_mode: 'Markdown',
            reply_markup: VIP_PLANS_KEYBOARD
          });
          break;

        case 'cancel_vip':
          try {
            await axios.post(`${API_BASE}/vip/cancel/${telegramId}`);
            bot.sendMessage(chatId, 'Your VIP subscription has been cancelled. You will retain benefits until the current period ends.');
          } catch (err) {
            bot.sendMessage(chatId, 'Failed to cancel VIP subscription.');
          }
          break;

        case 'manage_vip':
          // Redirect to VIP command functionality
          try {
            const user = await getCachedUserProfile(telegramId, User);

            if (user.isVip) {
              const vipMsg = `⭐ **VIP STATUS ACTIVE** ⭐\n\n` +
                `🎉 You're already a VIP member!\n\n` +
                `💎 **Your VIP Benefits:**\n` +
                `• 👀 See who likes you\n` +
                `• ♾️ Unlimited likes\n` +
                `• 🚀 Priority in browse queue\n` +
                `• 🔍 Advanced search filters\n` +
                `• 🚫 No ads\n` +
                `• ⭐ VIP badge on profile\n\n` +
                `⏰ **VIP Expires:** ${user.vipExpiresAt || 'Never'}\n\n` +
                `🔄 **Want to extend your VIP?**`;

              bot.sendMessage(chatId, vipMsg, {
                reply_markup: VIP_KEYBOARD
              });
            } else {
              const vipMsg = `⭐ *UPGRADE TO VIP* ⭐\n\n` +
                `💎 *VIP Benefits:*\n` +
                `• 👀 See who likes you\n` +
                `• ♾️ Unlimited likes\n` +
                `• 🚀 Priority in browse queue\n` +
                `• 🔍 Advanced search filters\n` +
                `• 🚫 No ads\n` +
                `• ⭐ VIP badge on profile`;

              bot.sendMessage(chatId, vipMsg, { parse_mode: 'Markdown', reply_markup: VIP_PLANS_KEYBOARD });
            }
          } catch (err) {
            console.error('Manage VIP error:', err.response?.data || err.message);
            bot.sendMessage(chatId, '❌ Failed to load VIP status. Please try again.');
          }
          break;

        case 'gift_vip':
          bot.sendMessage(chatId,
            '🎁 *Gift VIP to Someone Special* 🎁\n\nChoose a plan to gift — paid with Telegram Stars (⭐):',
            { parse_mode: 'Markdown', reply_markup: GIFT_VIP_PLANS_KEYBOARD }
          );
          break;

        case 'gift_vip_monthly':
        case 'gift_vip_6months':
        case 'gift_vip_yearly': {
          const plan = GIFT_VIP_PLANS[data];
          if (userStates) {
            userStates.set(telegramId, { awaitingGiftVipRecipient: true, giftPlan: plan });
          }
          bot.sendMessage(chatId,
            `🎁 *Gift ${plan.name}*\n\n` +
            `Send the *@username* or *Telegram ID* of the person you want to gift VIP to:\n\n` +
            `📝 Example: \`@username\` or \`123456789\`\n\n` +
            `⚠️ They must have started this bot before you can gift them.\n\n` +
            `_Type their username/ID below, or tap_ *💎 VIP* _to cancel._`,
            { parse_mode: 'Markdown', reply_markup: { remove_keyboard: true } }
          );
          break;
        }

        case 'buy_vip_1':
        case 'buy_vip_3':
        case 'buy_vip_6':
        case 'vip_purchase_weekly':
        case 'vip_purchase_monthly':
        case 'vip_purchase_6months':
        case 'vip_purchase_yearly':
        case 'vip_purchase_lifetime':
          // Check if user is registered
          try {
            const checkUser = await getCachedUserProfile(telegramId, User);
            if (!checkUser || !checkUser.profileCompleted) {
              return bot.sendMessage(chatId,
                '⚠️ **Registration Required** ⚠️\n\n' +
                'You need to register before purchasing VIP.\n\n' +
                'Register now to unlock all KissuBot features!',
                {
                  reply_markup: {
                    inline_keyboard: [
                      [{ text: '🚀 Register Now', callback_data: 'start_registration' }],
                      [{ text: '🔙 Back to Store', callback_data: 'back_to_store' }]
                    ]
                  }
                }
              );
            }
          } catch (err) {
            return bot.sendMessage(chatId,
              '⚠️ **Registration Required** ⚠️\n\n' +
              'You need to register before purchasing VIP.',
              {
                reply_markup: {
                  inline_keyboard: [
                    [{ text: '🚀 Register Now', callback_data: 'start_registration' }],
                    [{ text: '🔙 Back to Store', callback_data: 'back_to_store' }]
                  ]
                }
              }
            );
          }

          let planType;

          // Map buy_vip callbacks to plan types
          if (data === 'buy_vip_1') {
            planType = 'monthly';
          } else if (data === 'buy_vip_3') {
            planType = 'quarterly'; // 3 months
          } else if (data === 'buy_vip_6' || data === 'vip_purchase_6months') {
            planType = 'biannual'; // 6 months
          } else {
            planType = data.split('_')[2]; // monthly, yearly, or lifetime
          }

          try {
            const res = await axios.post(`${API_BASE}/vip/purchase/${telegramId}`, {
              planType
            });

            const planNames = {
              weekly: '1 Week',
              monthly: '1 Month',
              quarterly: '3 Months',
              biannual: '6 Months',
              yearly: 'Yearly',
              lifetime: 'Lifetime'
            };

            const successMessage = `🎉 **Congratulations!** 🎉\n\nYour ${planNames[planType] || planType} VIP subscription is now active!\n\n` +
              `🪙 **Remaining coins:** ${res.data.remainingCoins}`;

            bot.sendMessage(chatId, successMessage, { reply_markup: MAIN_KEYBOARD });
          } catch (err) {
            if (err.response?.data?.error === 'Insufficient coins') {
              const required = err.response.data.required;
              const current = err.response.data.current;
              bot.sendMessage(chatId,
                `❌ Not enough coins! You need *${required}* but only have *${current}* 🪙\n\nBuy more coins below:`,
                { parse_mode: 'Markdown', reply_markup: COINS_STORE_KEYBOARD }
              );
            } else {
              bot.sendMessage(chatId, 'Failed to purchase VIP subscription. Please try again later.');
            }
          }
          break;

        case 'boost_profile':
        case 'boost_superlike':
        case 'boost_message':
        case 'boost_smart':
          const boostType = data.split('_')[1];
          let boostCost, boostDuration, boostDescription;

          switch (boostType) {
            case 'profile':
              boostCost = 20;
              boostDuration = 30;
              boostDescription = '10x more profile views for 30 minutes';
              break;
            case 'superlike':
              boostCost = 10;
              boostDuration = 60;
              boostDescription = 'Super likes get priority attention for 1 hour';
              break;
            case 'message':
              boostCost = 15;
              boostDuration = 120;
              boostDescription = 'Messages appear first for 2 hours';
              break;
            case 'smart':
              boostCost = 30;
              boostDuration = 60;
              boostDescription = 'Profile shown to most compatible users for 1 hour';
              break;
          }

          try {
            const res = await axios.post(`${API_BASE}/boost/purchase/${telegramId}`, {
              boostType,
              cost: boostCost,
              duration: boostDuration
            });

            const expiryDate = new Date(res.data.expiresAt).toLocaleString();
            const successMsg = `🚀 ${boostType.charAt(0).toUpperCase() + boostType.slice(1)} Boost Activated!\n\n` +
              `${boostDescription}\n` +
              `Active until: ${expiryDate}\n` +
              `Remaining coins: ${res.data.remainingCoins} 🪙`;

            bot.sendMessage(chatId, successMsg);
          } catch (err) {
            if (err.response?.data?.error === 'Insufficient coins') {
              const required = err.response.data.required;
              const current = err.response.data.current;
              bot.sendMessage(chatId,
                `❌ Not enough coins! You need *${required}* but only have *${current}* 🪙\n\nBuy more coins below:`,
                { parse_mode: 'Markdown', reply_markup: COINS_STORE_KEYBOARD }
              );
            } else {
              bot.sendMessage(chatId, 'Failed to activate boost. Please try again later.');
            }
          }
          break;

        case 'buy_coins':
        case 'buy_coins_menu':
          try {
            const user = await getCachedUserProfile(telegramId, User);
            const coins = user.coins || 0;
            bot.sendMessage(chatId,
              `🪙 *Kissu Coins*\n\n` +
              `💰 *Your Balance:* ${coins} coins\n\n` +
              `*Coin uses:*\n` +
              `• ⭐ Super Like — 10 coins\n` +
              `• 🎁 Send a gift — 5–50 coins\n` +
              `• 👑 VIP membership — from 1,000 coins\n\n` +
              `*Buy with Telegram Stars (⭐):*`,
              { parse_mode: 'Markdown', reply_markup: COINS_STORE_KEYBOARD }
            );
          } catch (err) {
            bot.sendMessage(chatId, 'Failed to fetch coin balance.');
          }
          break;

        // Handle coin package purchases
        case 'buy_coins_starter':
        case 'buy_coins_popular':
        case 'buy_coins_premium':
        case 'buy_coins_ultimate':
          const packageId = data.split('_')[2];
          try {
            const res = await axios.post(`${API_BASE}/coins/purchase/${telegramId}`, {
              packageId
            });

            const { coinsAdded, newBalance } = res.data;

            // Get package details for confirmation message
            const packageDetails = {
              starter: { name: 'Starter Pack', coins: 1000, bonus: 0, price: 4.99 },
              popular: { name: 'Popular Pack', coins: 5000, bonus: 500, price: 19.99 },
              premium: { name: 'Premium Pack', coins: 12000, bonus: 2000, price: 39.99 },
              ultimate: { name: 'Ultimate Pack', coins: 30000, bonus: 8000, price: 79.99 }
            };

            const pack = packageDetails[packageId];
            const successMsg = `🎉 **PURCHASE SUCCESSFUL!** 🎉\n\n` +
              `📦 **${pack.name}** purchased!\n` +
              `💰 **${coinsAdded} coins** added to your account\n` +
              `🪙 **New Balance:** ${newBalance} coins\n\n` +
              `✨ **What you can do with coins:**\n` +
              `• 👑 Purchase VIP membership\n` +
              `• 🎁 Send premium gifts\n` +
              `• ⚡️ Boost your profile priority\n` +
              `• 🌟 Unlock special features\n\n` +
              `Thank you for your purchase! 💙`;

            await bot.sendMessage(chatId, successMsg, { parse_mode: 'Markdown', reply_markup: MAIN_KEYBOARD });

          } catch (err) {
            console.error('Coin purchase error:', err);
            if (err.response?.status === 400) {
              bot.sendMessage(chatId, '❌ Invalid package selected. Please try again.');
            } else if (err.response?.status === 404) {
              bot.sendMessage(chatId, '❌ User not found. Please register first using /start.');
            } else {
              bot.sendMessage(chatId, '❌ Failed to purchase coins. Please try again later.');
            }
          }
          break;

        case 'store_vip':
        case 'vip_pay_stars':
          bot.sendMessage(chatId,
            `👑 *VIP Membership* 👑\n\n` +
            `✨ *VIP Benefits:*\n` +
            `• 👀 See who liked you\n` +
            `• ♾️ Unlimited daily likes\n` +
            `• 🔍 Advanced search filters\n` +
            `• 🚀 Priority profile visibility\n` +
            `• 🚫 No advertisements\n` +
            `• ⭐ VIP badge on profile\n\n` +
            `💳 *Pay with Telegram Stars (⭐):*`,
            { parse_mode: 'Markdown', reply_markup: VIP_PLANS_KEYBOARD }
          );
          break;

        case 'vip_pay_coins':
          bot.sendMessage(chatId,
            `👑 *VIP Membership* 👑\n\n` +
            `🪙 *Pay with Coins:*`,
            { parse_mode: 'Markdown', reply_markup: COIN_VIP_PLANS_KEYBOARD }
          );
          break;

        case 'store_boosts':
          const boostsStoreMsg = `⚡ **Profile Boosts** ⚡\n\n` +
            `Get 10x more profile views for 30 minutes!\n\n` +
            `💫 **What you get:**\n` +
            `• 10× profile visibility\n` +
            `• Appear first in browse\n` +
            `• 30 minutes duration\n` +
            `• Instant activation\n\n` +
            `💳 **Pay with Telegram Stars (⭐):**`;

          bot.sendMessage(chatId, boostsStoreMsg, {
            reply_markup: BOOSTS_STORE_KEYBOARD
          });
          break;

        case 'store_coins':
          const coinsStoreMsg = `💰 **Kissu Coins** 💰\n\n` +
            `Use coins for Super Likes, VIP, gifts & more!\n\n` +
            `🪙 **Coin Uses:**\n` +
            `• ⭐ Super Like — 10 coins\n` +
            `• 🎁 Send a gift — 5–50 coins\n` +
            `• 👑 VIP membership — from 300 coins\n\n` +
            `💳 **Buy with Telegram Stars (⭐):**`;

          bot.sendMessage(chatId, coinsStoreMsg, {
            reply_markup: COINS_STORE_KEYBOARD
          });
          break;

        case 'coin_vip_monthly':
        case 'coin_vip_6months':
        case 'coin_vip_yearly': {
          const coinVipPlans = {
            coin_vip_monthly: { name: '1 Month VIP',  coins: 1000, days: 30  },
            coin_vip_6months: { name: '6 Months VIP', coins: 4500, days: 180 },
            coin_vip_yearly:  { name: '1 Year VIP',   coins: 8000, days: 365 },
          };
          const cvp = coinVipPlans[data];
          try {
            const user = await User.findOne({ telegramId: String(telegramId) });
            if (!user) return bot.sendMessage(chatId, '❌ User not found.');
            if ((user.coins || 0) < cvp.coins) {
              return bot.sendMessage(chatId,
                `❌ *Not enough coins!*\n\nYou need *${cvp.coins} coins* for ${cvp.name} but only have *${user.coins || 0}*.`,
                { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [
                  [{ text: '💰 Buy Coins', callback_data: 'store_coins' }],
                  [{ text: '🔙 Back', callback_data: 'vip_pay_coins' }]
                ]}}
              );
            }
            const now = new Date();
            const base = user.vipExpiresAt && user.vipExpiresAt > now ? user.vipExpiresAt : now;
            const newExpiry = new Date(base.getTime() + cvp.days * 24 * 60 * 60 * 1000);
            user.coins -= cvp.coins;
            user.isVip = true;
            user.vipExpiresAt = newExpiry;
            await user.save();
            const { invalidateUserCache } = require('./auth');
            invalidateUserCache(String(telegramId));
            const expiryStr = newExpiry.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
            await bot.sendMessage(chatId,
              `✅ *VIP Activated!* 👑\n\nYou're now a *VIP member* until *${expiryStr}*!\n🪙 Remaining coins: *${user.coins}*`,
              { parse_mode: 'Markdown', reply_markup: MAIN_KEYBOARD }
            );
          } catch (err) {
            console.error('Coin VIP purchase error:', err);
            bot.sendMessage(chatId, '❌ Failed to process purchase. Please try again.');
          }
          break;
        }

        case 'back_to_store':
          bot.sendMessage(chatId,
            `💎 *Kissu Store* 💎\n\nUnlock premium features and boost your dating experience!`,
            { parse_mode: 'Markdown', reply_markup: VIP_KEYBOARD }
          );
          break;
      }
    } catch (err) {
      console.error('Premium callback error:', err);
      bot.sendMessage(chatId, '❌ Something went wrong. Please try again.');
    }
  });
  // VIP command
  bot.onText(/\/vip/, async (msg) => {
    await sendVipMenu(bot, msg.chat.id, msg.from.id, User);
  });

  // ── VIP Reply Keyboard handler ────────────────────────────────────────
  bot.on('message', async (msg) => {
    const text = msg.text;
    if (!text || !VIP_KB_BUTTONS.includes(text)) return;
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    switch (text) {
      case '👑 Get VIP':
        bot.sendMessage(chatId,
          `👑 *Get VIP* 💎\n\n` +
          `✨ *VIP Benefits:*\n` +
          `• 👀 See who likes you\n• ♾️ Unlimited likes\n• 🚀 Priority placement\n• 🔍 Advanced filters\n• 🚫 No ads\n• ⭐ VIP badge\n\n` +
          `💳 *Pay with Telegram Stars (⭐):*`,
          { parse_mode: 'Markdown', reply_markup: VIP_PLANS_KEYBOARD }
        );
        break;

      case '📊 My Subscription':
        try {
          const user = await getCachedUserProfile(telegramId, User);
          if (user.isVip) {
            const expiry = user.vipExpiresAt ? new Date(user.vipExpiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Lifetime';
            bot.sendMessage(chatId,
              `📊 *My VIP Subscription*\n\n` +
              `✅ *Status:* Active\n` +
              `⏰ *Expires:* ${expiry}\n` +
              `🪙 *Coins:* ${user.coins || 0}\n\n` +
              `_Tap_ *👑 Get VIP* _to extend your subscription!_`,
              { parse_mode: 'Markdown', reply_markup: VIP_KEYBOARD }
            );
          } else {
            bot.sendMessage(chatId,
              `📊 *My Subscription*\n\n❌ *Status:* No active VIP\n\n_Tap_ *👑 Get VIP* _to subscribe!_`,
              { parse_mode: 'Markdown', reply_markup: VIP_KEYBOARD }
            );
          }
        } catch (err) {
          bot.sendMessage(chatId, '❌ Failed to load subscription status.');
        }
        break;

      case '💎 VIP Features':
        bot.sendMessage(chatId,
          `💎 *VIP Features* 👑\n\n` +
          `• 👀 *See who likes you* — know your admirers\n` +
          `• ♾️ *Unlimited likes* — never run out\n` +
          `• 🚀 *Priority placement* — appear at the top\n` +
          `• 🔍 *Advanced filters* — education, profession, more\n` +
          `• 🚫 *No ads* — clean experience\n` +
          `• ⭐ *VIP badge* — stand out on profiles\n` +
          `• 📊 *Profile analytics* — see your stats\n` +
          `• 🎁 *Gift perks* — special gift discounts`,
          { parse_mode: 'Markdown', reply_markup: VIP_KEYBOARD }
        );
        break;

      case '🎁 Gift VIP':
        bot.sendMessage(chatId,
          `🎁 *Gift VIP to Someone Special!*\n\nChoose a plan — paid with Telegram Stars (⭐):`,
          {
            parse_mode: 'Markdown',
            reply_markup: GIFT_VIP_PLANS_KEYBOARD
          }
        );
        break;

      case '🚀 My VIP Perks':
        bot.emit('message', { chat: { id: chatId }, from: msg.from, text: '/perks' });
        break;
    }
  });

  // COINS command
  bot.onText(/\/coins/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    try {
      const user = await getCachedUserProfile(telegramId, User);
      const coins = user.coins || 0;

      const coinsMsg = `🪙 **YOUR COINS** 🪙\n\n` +
        `💰 **Current Balance:** ${coins} coins\n\n` +
        `✨ **What can you do with coins?**\n` +
        `• 💝 Send virtual gifts (5-50 coins)\n` +
        `• ⭐ Super Like (10 coins)\n` +
        `• 🚀 Profile boost (20 coins)\n` +
        `• 👑 VIP membership (from 1,000 coins)\n\n` +
        `💳 **Buy More Coins:**\n` +
        `• 100 coins - $2.99\n` +
        `• 500 coins - $9.99 (Save 33%)\n` +
        `• 1000 coins - $16.99 (Save 43%)\n\n` +
        `🎁 **Need more coins?**`;

      bot.sendMessage(chatId, coinsMsg, {
        reply_markup: COINS_STORE_KEYBOARD
      });
    } catch (err) {
      console.error('Coins command error:', err.response?.data || err.message);
      bot.sendMessage(chatId, '❌ Failed to load coin balance. Please try again.');
    }
  });

  // Gift VIP: capture recipient input
  bot.on('message', async (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return;
    if (MAIN_KB_BUTTONS.includes(msg.text)) return;
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    if (!userStates) return;

    const state = userStates.get(telegramId);
    if (!state || !state.awaitingGiftVipRecipient) return;

    userStates.delete(telegramId);
    const { giftPlan } = state;
    const input = msg.text.trim();

    try {
      let recipient;
      if (input.startsWith('@')) {
        recipient = await User.findOne({ username: input.replace('@', '') });
      } else if (/^\d+$/.test(input)) {
        recipient = await User.findOne({ telegramId: input });
      }

      if (!recipient) {
        return bot.sendMessage(chatId,
          `❌ *User not found.*\n\nMake sure they have started the bot and check the username or ID.\nTap *💎 VIP* to go back.`,
          { parse_mode: 'Markdown', reply_markup: MAIN_KEYBOARD }
        );
      }

      if (String(recipient.telegramId) === String(telegramId)) {
        return bot.sendMessage(chatId,
          `❌ You can't gift VIP to yourself! Use /vip to upgrade your own account.`,
          { reply_markup: MAIN_KEYBOARD }
        );
      }

      await bot.sendInvoice(
        chatId,
        `🎁 Gift ${giftPlan.name} to ${recipient.name}`,
        `Grant ${giftPlan.name} to ${recipient.name}. They'll get all VIP perks immediately!`,
        `kissubot_giftvip_${giftPlan.days}_${recipient.telegramId}`,
        PAYMENT_TOKEN,
        'XTR',
        [{ label: `Gift ${giftPlan.name}`, amount: giftPlan.amount }]
      );
    } catch (err) {
      console.error('[GiftVIP] recipient lookup error:', err);
      bot.sendMessage(chatId, '❌ Something went wrong. Please try again.');
    }
  });

  // STORE command
  bot.onText(/\/(store|shop|premium|buy)$/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId,
      `💎 *Kissu Store* 💎\n\nUnlock premium features and boost your dating experience!\n\n` +
      `Choose from the menu below:`,
      { parse_mode: 'Markdown', reply_markup: VIP_KEYBOARD }
    );
  });

  // ── New reply keyboard button handlers ────────────────────────────────────
  bot.on('message', async (msg) => {
    const text = msg.text;
    if (!text) return;
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    // ── VIP Stars plans ──────────────────────────────────────────────────
    const vipStarsMap = {
      '📆 1 Month — 749 ⭐':               'pay_vip_monthly',
      '📅 6 Months — 2,490 ⭐  (save 44%)': 'pay_vip_6months',
      '🎯 1 Year — 3,490 ⭐  (save 58%)':  'pay_vip_yearly'
    };
    if (vipStarsMap[text]) {
      bot.emit('callback_query', { id: 'kb', message: { chat: { id: chatId }, message_id: 0 }, from: msg.from, data: vipStarsMap[text] });
      return;
    }

    // ── Switch payment method ────────────────────────────────────────────
    if (text === '🪙 Pay with Coins Instead') {
      bot.sendMessage(chatId, `👑 *VIP with Coins* 🪙\n\nChoose a plan:`, { parse_mode: 'Markdown', reply_markup: COIN_VIP_PLANS_KEYBOARD });
      return;
    }
    if (text === '⭐ Pay with Stars Instead') {
      bot.sendMessage(chatId, `👑 *VIP with Stars* ⭐\n\nChoose a plan:`, { parse_mode: 'Markdown', reply_markup: VIP_PLANS_KEYBOARD });
      return;
    }

    // ── VIP Coins plans ──────────────────────────────────────────────────
    const vipCoinsMap = {
      '🪙 1 Month VIP — 1,000 coins':          'coin_vip_monthly',
      '🪙 6 Months VIP — 4,500 coins  (save 25%)': 'coin_vip_6months',
      '🪙 1 Year VIP — 8,000 coins  (save 33%)':   'coin_vip_yearly'
    };
    if (vipCoinsMap[text]) {
      bot.emit('callback_query', { id: 'kb', message: { chat: { id: chatId }, message_id: 0 }, from: msg.from, data: vipCoinsMap[text] });
      return;
    }

    // ── Gift VIP plans ───────────────────────────────────────────────────
    const giftVipMap = {
      '🎀 Gift 1 Month — 749 ⭐':   { name: '1 Month VIP',  days: 30,  amount: 749  },
      '🎀 Gift 6 Months — 2,490 ⭐': { name: '6 Months VIP', days: 180, amount: 2490 },
      '🎀 Gift 1 Year — 3,490 ⭐':   { name: '1 Year VIP',   days: 365, amount: 3490 }
    };
    if (giftVipMap[text]) {
      const plan = giftVipMap[text];
      if (userStates) userStates.set(String(telegramId), { awaitingGiftVipRecipient: true, giftPlan: plan });
      bot.sendMessage(chatId,
        `🎁 *Gift ${plan.name}*\n\n` +
        `Send the *@username* or *Telegram ID* of the recipient:\n\n` +
        `📝 Example: \`@username\` or \`123456789\`\n\n` +
        `_Tap_ *💎 VIP* _to cancel._`,
        { parse_mode: 'Markdown', reply_markup: { remove_keyboard: true } }
      );
      return;
    }

    // ── Coins packages ───────────────────────────────────────────────────
    const coinsMap = {
      '🪙 100 Coins — 75 ⭐':        'pay_coins_100',
      '🪙 500 Coins — 299 ⭐':       'pay_coins_500',
      '💰 1,000 Coins — 499 ⭐':    'pay_coins_1000',
      '🏆 5,000 Coins — 1,999 ⭐':  'pay_coins_5000'
    };
    if (coinsMap[text]) {
      bot.emit('callback_query', { id: 'kb', message: { chat: { id: chatId }, message_id: 0 }, from: msg.from, data: coinsMap[text] });
      return;
    }

    // ── Boost packages ───────────────────────────────────────────────────
    const boostsMap = {
      '🚀 1 Boost — 149 ⭐':            'pay_boost_1',
      '⚡ 5 Boosts — 499 ⭐  (save 33%)': 'pay_boost_5',
      '💥 10 Boosts — 749 ⭐  (save 50%)': 'pay_boost_10'
    };
    if (boostsMap[text]) {
      bot.emit('callback_query', { id: 'kb', message: { chat: { id: chatId }, message_id: 0 }, from: msg.from, data: boostsMap[text] });
      return;
    }

    // ── Priority boost confirm ────────────────────────────────────────────
    if (text === '🚀 Yes, Boost Me!') {
      const state = userStates && userStates.get(String(telegramId));
      if (!state || !state.awaitingPriorityConfirm) return;
      userStates.delete(String(telegramId));
      bot.emit('callback_query', { id: 'kb', message: { chat: { id: chatId }, message_id: 0 }, from: msg.from, data: 'activate_priority_boost' });
      return;
    }
    if (text === '🔙 No Thanks') {
      const state = userStates && userStates.get(String(telegramId));
      if (state && state.awaitingPriorityConfirm) {
        userStates.delete(String(telegramId));
        bot.sendMessage(chatId, '👍 No worries! Come back anytime.', { reply_markup: MAIN_KEYBOARD });
      }
      return;
    }
    if (text === '💰 Buy Coins') {
      const state = userStates && userStates.get(String(telegramId));
      if (state && state.awaitingPriorityConfirm) {
        userStates.delete(String(telegramId));
        try {
          const user = await getCachedUserProfile(telegramId, User);
          bot.sendMessage(chatId,
            `🪙 *Buy Coins*\n\n💰 *Balance:* ${user.coins || 0} coins\n\n*Buy with Telegram Stars (⭐):*`,
            { parse_mode: 'Markdown', reply_markup: COINS_STORE_KEYBOARD }
          );
        } catch (e) {
          bot.sendMessage(chatId, '❌ Failed to load coins.', { reply_markup: MAIN_KEYBOARD });
        }
      }
      return;
    }
  });
}

module.exports = { setupPremiumCommands, sendVipMenu };
