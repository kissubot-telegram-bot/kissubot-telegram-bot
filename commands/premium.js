const axios = require('axios');
const { getCachedUserProfile } = require('./auth');

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

function setupPremiumCommands(bot) {
  const axios = require('axios');
  const API_BASE = process.env.API_BASE || 'http://localhost:3000';

  // Callback query handlers
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const telegramId = query.from.id;
    const data = query.data;

    try {
      switch (data) {
        case 'extend_vip':
          bot.sendMessage(chatId, 'Choose a plan to extend your VIP membership:', {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '📅 Weekly', callback_data: 'vip_purchase_weekly' },
                  { text: '📅 Monthly', callback_data: 'vip_purchase_monthly' }
                ],
                [
                  { text: '📆 Yearly', callback_data: 'vip_purchase_yearly' },
                  { text: '♾️ Lifetime', callback_data: 'vip_purchase_lifetime' }
                ]
              ]
            }
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
                `• 1 Week - 300 coins\n` +
                `• 1 Month - 1000 coins\n` +
                `• 3 Months - 2500 coins (Save 17%)\n` +
                `• 6 Months - 4500 coins (Save 25%)\n\n` +
                `🚀 **Ready to upgrade?**`;

              bot.sendMessage(chatId, vipMsg, {
                  reply_markup: {
                    inline_keyboard: [
                      [
                        { text: '📅 1 Week VIP', callback_data: 'vip_purchase_weekly' },
                        { text: '1️⃣ 1 Month VIP', callback_data: 'buy_vip_1' }
                      ],
                      [
                        { text: '3️⃣ 3 Months VIP', callback_data: 'buy_vip_3' },
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
            console.error('Manage VIP error:', err.response?.data || err.message);
            bot.sendMessage(chatId, '❌ Failed to load VIP status. Please try again.');
          }
          break;

        case 'gift_vip':
          bot.sendMessage(chatId, '🎁 **GIFT VIP TO SOMEONE SPECIAL** 🎁\n\n' +
            'Choose a VIP plan to gift:', {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '1️⃣ Gift 1 Month VIP', callback_data: 'gift_vip_1' },
                  { text: '3️⃣ Gift 3 Months VIP', callback_data: 'gift_vip_3' }
                ],
                [
                  { text: '6️⃣ Gift 6 Months VIP', callback_data: 'gift_vip_6' }
                ],
                [
                  { text: '🔙 Back', callback_data: 'manage_vip' }
                ]
              ]
            }
          });
          break;

        case 'gift_vip_1':
        case 'gift_vip_3':
        case 'gift_vip_6':
          const giftPlanMap = {
            'gift_vip_1': { type: 'monthly', name: '1 Month VIP' },
            'gift_vip_3': { type: 'quarterly', name: '3 Months VIP' },
            'gift_vip_6': { type: 'biannual', name: '6 Months VIP' }
          };
          const giftPlan = giftPlanMap[data];
          
          bot.sendMessage(chatId, `🎁 **GIFT ${giftPlan.name.toUpperCase()}** 🎁\n\n` +
            'Please send the Telegram username or ID of the person you want to gift VIP to:\n\n' +
            '📝 Example: @username or 123456789\n\n' +
            '⚠️ Make sure the person has started the bot before gifting!');
          
          // Store gift plan type for next message
          // This would need a proper state management system in production
          break;

        case 'buy_vip_1':
        case 'buy_vip_3':
        case 'buy_vip_6':
        case 'vip_purchase_weekly':
        case 'vip_purchase_monthly':
        case 'vip_purchase_yearly':
        case 'vip_purchase_lifetime':
          let planType;
          
          // Map buy_vip callbacks to plan types
          if (data === 'buy_vip_1') {
            planType = 'monthly';
          } else if (data === 'buy_vip_3') {
            planType = 'quarterly'; // 3 months
          } else if (data === 'buy_vip_6') {
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
            
            const successMessage = `🎉 Congratulations! Your ${planNames[planType]} VIP subscription is now active!\n\n` +
              `Remaining coins: ${res.data.remainingCoins} 🪙\n` +
              'Use /vip to see your benefits and status.';
            
            bot.sendMessage(chatId, successMessage);
          } catch (err) {
            if (err.response?.data?.error === 'Insufficient coins') {
              const required = err.response.data.required;
              const current = err.response.data.current;
              bot.sendMessage(chatId, 
                `You need ${required} coins for this plan, but you only have ${current} coins.\n` +
                'Use /coins to purchase more coins!'
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
                `You need ${required} coins for this boost, but you only have ${current} coins.\n` +
                'Use /coins to get more coins!'
              );
            } else {
              bot.sendMessage(chatId, 'Failed to activate boost. Please try again later.');
            }
          }
          break;

        case 'buy_coins':
          try {
            const res = await axios.get(`${API_BASE}/coins/${telegramId}`);
            const { coins, packages } = res.data;

            const balanceMsg = `💰 Your Coin Balance: ${coins} 🪙\n\n` +
              '🎁 Available Packages:';

            const packageButtons = Object.entries(packages).map(([id, pack]) => ({
              text: `${pack.name} (${pack.coins + pack.bonus} coins)`,
              callback_data: `buy_coins_${id}`
            }));

            const buttonRows = packageButtons.reduce((rows, button, index) => {
              if (index % 2 === 0) {
                rows.push([button]);
              } else {
                rows[rows.length - 1].push(button);
              }
              return rows;
            }, []);

            const packagesMsg = Object.values(packages).map(pack => 
              `\n\n${pack.name}:` +
              `\n• ${pack.coins} coins` +
              (pack.bonus ? `\n• +${pack.bonus} bonus coins` : '') +
              `\n• $${pack.price}`
            ).join('');

            const opts = {
              reply_markup: {
                inline_keyboard: buttonRows
              }
            };

            bot.sendMessage(
              chatId,
              balanceMsg + packagesMsg + '\n\n💡 Coins can be used for VIP membership, gifts, and other premium features!',
              opts
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
            
            await bot.sendMessage(chatId, successMsg, {
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: '👑 Get VIP', callback_data: 'manage_vip' },
                    { text: '🎁 Send Gifts', callback_data: 'send_gift' }
                  ],
                  [
                    { text: '⚡️ Priority Boost', callback_data: 'priority_boost' },
                    { text: '💰 Buy More Coins', callback_data: 'buy_coins' }
                  ]
                ]
              },
              parse_mode: 'Markdown'
            });
            
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
      }
    } catch (err) {
      console.error('Premium callback error:', err);
      bot.sendMessage(chatId, '❌ Something went wrong. Please try again.');
    }
  });
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
          `• 1 Week - 300 coins\n` +
          `• 1 Month - 1000 coins\n` +
          `• 3 Months - 2500 coins (Save 17%)\n` +
          `• 6 Months - 4500 coins (Save 25%)\n\n` +
          `🚀 **Ready to upgrade?**`;

        bot.sendMessage(chatId, vipMsg, {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '📅 1 Week VIP', callback_data: 'vip_purchase_weekly' },
                { text: '1️⃣ 1 Month VIP', callback_data: 'buy_vip_1' }
              ],
              [
                { text: '3️⃣ 3 Months VIP', callback_data: 'buy_vip_3' },
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
