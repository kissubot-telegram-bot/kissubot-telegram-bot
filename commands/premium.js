const axios = require('axios');
const { getCachedUserProfile } = require('./auth');

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

function setupPremiumCommands(bot) {
  // VIP command
  bot.onText(/\/vip/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    
    try {
      const user = await getCachedUserProfile(telegramId);
      
      if (user.isVip) {
        const vipMsg = `⭐ **VIP STATUS ACTIVE** ⭐\n\n` +
          `🎉 You're already a VIP member!\n\n` +
          `💎 **Your VIP Benefits:**\n` +
          `• See who likes you\n` +
          `• Unlimited likes\n` +
          `• Priority in browse queue\n` +
          `• Advanced search filters\n` +
          `• No ads\n` +
          `• VIP badge on profile\n\n` +
          `⏰ **VIP Expires:** ${user.vipExpiresAt || 'Never'}\n\n` +
          `🔄 **Want to extend your VIP?**`;

        bot.sendMessage(chatId, vipMsg, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔄 Extend VIP', callback_data: 'extend_vip' }],
              [{ text: '🎁 Gift VIP', callback_data: 'gift_vip' }],
              [{ text: '🔙 Back', callback_data: 'main_menu' }]
            ]
          }
        });
      } else {
        const vipMsg = `⭐ **UPGRADE TO VIP** ⭐\n\n` +
          `💎 **VIP Benefits:**\n` +
          `• 👀 See who likes you\n` +
          `• ♾️ Unlimited likes\n` +
          `• 🚀 Priority in browse queue\n` +
          `• 🔍 Advanced search filters\n` +
          `• 🚫 No advertisements\n` +
          `• ⭐ VIP badge on your profile\n\n` +
          `💰 **VIP Pricing:**\n` +
          `• 1 Month - $9.99\n` +
          `• 3 Months - $24.99 (Save 17%)\n` +
          `• 6 Months - $44.99 (Save 25%)\n\n` +
          `🚀 **Ready to upgrade?**`;

        bot.sendMessage(chatId, vipMsg, {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '1️⃣ 1 Month VIP', callback_data: 'buy_vip_1' },
                { text: '3️⃣ 3 Months VIP', callback_data: 'buy_vip_3' }
              ],
              [
                { text: '6️⃣ 6 Months VIP', callback_data: 'buy_vip_6' }
              ],
              [
                { text: '🔙 Back', callback_data: 'main_menu' }
              ]
            ]
          }
        });
      }
    } catch (err) {
      console.error('VIP command error:', err.response?.data || err.message);
      bot.sendMessage(chatId, '❌ Failed to load VIP status. Please try again.');
    }
  });

  // COINS command
  bot.onText(/\/coins/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    try {
      const user = await getCachedUserProfile(telegramId);
      const coins = user.coins || 0;

      const coinsMsg = `🪙 **YOUR COINS** 🪙\n\n` +
        `💰 **Current Balance:** ${coins} coins\n\n` +
        `✨ **What can you do with coins?**\n` +
        `• 💝 Send virtual gifts (5-50 coins)\n` +
        `• ⭐ Send super likes (10 coins)\n` +
        `• 🚀 Boost your profile (20 coins)\n` +
        `• 💌 Send priority messages (15 coins)\n\n` +
        `💳 **Buy More Coins:**\n` +
        `• 100 coins - $2.99\n` +
        `• 500 coins - $9.99 (Save 33%)\n` +
        `• 1000 coins - $16.99 (Save 43%)\n\n` +
        `🎁 **Need more coins?**`;

      bot.sendMessage(chatId, coinsMsg, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '💳 Buy 100 Coins', callback_data: 'buy_coins_100' },
              { text: '💳 Buy 500 Coins', callback_data: 'buy_coins_500' }
            ],
            [
              { text: '💳 Buy 1000 Coins', callback_data: 'buy_coins_1000' }
            ],
            [
              { text: '🎁 Free Coins', callback_data: 'free_coins' }
            ],
            [
              { text: '🔙 Back', callback_data: 'main_menu' }
            ]
          ]
        }
      });
    } catch (err) {
      console.error('Coins command error:', err.response?.data || err.message);
      bot.sendMessage(chatId, '❌ Failed to load coin balance. Please try again.');
    }
  });

  // GIFTS command
  bot.onText(/\/gifts/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    const giftsMsg = `🎁 **VIRTUAL GIFTS** 🎁\n\n` +
      `💝 **Send special gifts to your matches!**\n\n` +
      `🌹 **Available Gifts:**\n` +
      `• 🌹 Rose - 5 coins\n` +
      `• 💐 Bouquet - 15 coins\n` +
      `• 🍫 Chocolate - 10 coins\n` +
      `• 🧸 Teddy Bear - 25 coins\n` +
      `• 💎 Diamond Ring - 50 coins\n\n` +
      `✨ **Gifts show you really care and help you stand out!**\n\n` +
      `💡 **To send a gift:**\n` +
      `1. Go to your matches with /matches\n` +
      `2. Select someone special\n` +
      `3. Choose "Send Gift"\n` +
      `4. Pick your perfect gift!\n\n` +
      `🪙 **Need more coins? Use /coins**`;

    bot.sendMessage(chatId, giftsMsg, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '💞 View Matches', callback_data: 'view_matches' },
            { text: '🪙 Buy Coins', callback_data: 'buy_coins_menu' }
          ],
          [
            { text: '🔙 Back', callback_data: 'main_menu' }
          ]
        ]
      }
    });
  });

  // PRIORITY command
  bot.onText(/\/priority/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    const priorityMsg = `🚀 **PRIORITY FEATURES** 🚀\n\n` +
      `⚡ **Boost Your Dating Success!**\n\n` +
      `🔥 **Available Boosts:**\n` +
      `• 🚀 Profile Boost - 20 coins\n` +
      `  └ 10x more profile views for 30 minutes\n\n` +
      `• ⭐ Super Like Boost - 10 coins\n` +
      `  └ Your super likes get priority attention\n\n` +
      `• 💌 Priority Message - 15 coins\n` +
      `  └ Your messages appear first\n\n` +
      `• 🎯 Smart Boost - 30 coins\n` +
      `  └ Show your profile to most compatible users\n\n` +
      `💡 **Pro Tip:** Combine boosts for maximum impact!\n\n` +
      `🪙 **Need coins? Use /coins to buy more!**`;

    bot.sendMessage(chatId, priorityMsg, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🚀 Profile Boost', callback_data: 'boost_profile' },
            { text: '⭐ Super Like Boost', callback_data: 'boost_superlike' }
          ],
          [
            { text: '💌 Priority Message', callback_data: 'boost_message' },
            { text: '🎯 Smart Boost', callback_data: 'boost_smart' }
          ],
          [
            { text: '🪙 Buy Coins', callback_data: 'buy_coins_menu' }
          ],
          [
            { text: '🔙 Back', callback_data: 'main_menu' }
          ]
        ]
      }
    });
  });
}

module.exports = { setupPremiumCommands };
