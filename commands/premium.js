const axios = require('axios');
const { getCachedUserProfile } = require('./auth');

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

function setupPremiumCommands(bot, User) {
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

      bot.sendMessage(chatId, priorityMsg, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Yes, Boost My Profile!', callback_data: 'activate_priority_boost' }
            ],
            [
              { text: '💰 Buy Coins', callback_data: 'buy_coins_menu' },
              { text: '🔙 No, Thanks', callback_data: 'main_menu' }
            ]
          ]
        }
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
            const user = await getCachedUserProfile(telegramId, User);

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

            bot.sendMessage(chatId, successMessage, {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🔍 Start Browsing', callback_data: 'browse_profiles' }],
                  [{ text: '🏠 Main Menu', callback_data: 'main_menu' }]
                ]
              }
            });
          } catch (err) {
            if (err.response?.data?.error === 'Insufficient coins') {
              const required = err.response.data.required;
              const current = err.response.data.current;
              bot.sendMessage(chatId,
                `You need ${required} coins for this plan, but you only have ${current} coins.`,
                {
                  reply_markup: {
                    inline_keyboard: [
                      [{ text: '💰 Buy Coins', callback_data: 'buy_coins' }],
                      [{ text: '🔙 Back', callback_data: 'back_to_store' }]
                    ]
                  }
                }
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
                `You need ${required} coins for this boost, but you only have ${current} coins.`,
                {
                  reply_markup: {
                    inline_keyboard: [
                      [{ text: '💰 Buy Coins', callback_data: 'buy_coins' }],
                      [{ text: '🔙 Back', callback_data: 'back_to_store' }]
                    ]
                  }
                }
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

        case 'store_vip':
          // VIP Membership section
          const vipStoreMsg = `👑 **VIP Membership** 👑\n\n` +
            `Get unlimited likes, advanced filters, and more!\n\n` +
            `✨ **VIP Benefits:**\n` +
            `• 👀 See who liked you\n` +
            `• ♾️ Unlimited daily likes\n` +
            `• 🔍 Advanced search filters\n` +
            `• 🚀 Priority profile visibility\n` +
            `• 🚫 No advertisements\n` +
            `• ↩️ Rewind last swipe\n` +
            `• ⭐ VIP badge on profile\n\n` +
            `💰 **Pricing:**`;

          bot.sendMessage(chatId, vipStoreMsg, {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '📆 1 Month - $15 (749 ⭐)', callback_data: 'vip_purchase_monthly' }
                ],
                [
                  { text: '📅 6 Months - $50 (2490 ⭐)', callback_data: 'vip_purchase_6months' }
                ],
                [
                  { text: '🎯 1 Year - $70 (3490 ⭐)', callback_data: 'vip_purchase_yearly' }
                ],
                [
                  { text: '🔙 Back to Store', callback_data: 'back_to_store' }
                ]
              ]
            }
          });
          break;

        case 'store_boosts':
          // Boosts section
          const boostsStoreMsg = `⚡ **Profile Boosts** ⚡\n\n` +
            `Get 10x more profile views for 30 minutes!\n\n` +
            `💫 **What you get:**\n` +
            `• 10x profile visibility\n` +
            `• Appear first in browse\n` +
            `• 30 minutes duration\n` +
            `• Instant activation\n\n` +
            `💰 **Pricing:**`;

          bot.sendMessage(chatId, boostsStoreMsg, {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '🚀 1 Boost - $2.99', callback_data: 'buy_boost_1' }
                ],
                [
                  { text: '⚡ 5 Boosts - $9.99', callback_data: 'buy_boost_5' }
                ],
                [
                  { text: '💥 10 Boosts - $14.99', callback_data: 'buy_boost_10' }
                ],
                [
                  { text: '🔙 Back to Store', callback_data: 'back_to_store' }
                ]
              ]
            }
          });
          break;

        case 'store_coins':
          // Coins section
          const coinsStoreMsg = `💰 **Kissu Coins** 💰\n\n` +
            `Use coins for Super Likes, Rewinds, and more!\n\n` +
            `🪙 **Coin Uses:**\n` +
            `• Super Like - 5 coins\n` +
            `• Rewind - 3 coins\n` +
            `• Boost - 10 coins\n` +
            `• Gift VIP - 50 coins\n\n` +
            `💰 **Pricing:**`;

          bot.sendMessage(chatId, coinsStoreMsg, {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '💵 100 Coins - $0.99', callback_data: 'buy_coins_100' }
                ],
                [
                  { text: '💵 500 Coins - $3.99', callback_data: 'buy_coins_500' }
                ],
                [
                  { text: '💵 1000 Coins - $6.99', callback_data: 'buy_coins_1000' }
                ],
                [
                  { text: '💵 5000 Coins - $24.99', callback_data: 'buy_coins_5000' }
                ],
                [
                  { text: '🔙 Back to Store', callback_data: 'back_to_store' }
                ]
              ]
            }
          });
          break;

        case 'back_to_store':
          // Return to main store menu
          const backStoreMsg = `💎 **Kissu Store** 💎\n\n` +
            `Unlock premium features and boost your dating experience!\n\n` +
            `Choose a category to explore:`;

          bot.sendMessage(chatId, backStoreMsg, {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '👑 VIP Membership', callback_data: 'store_vip' }
                ],
                [
                  { text: '⚡ Boosts', callback_data: 'store_boosts' }
                ],
                [
                  { text: '💰 Coins', callback_data: 'store_coins' }
                ],
                [
                  { text: '🔙 Main Menu', callback_data: 'main_menu' }
                ]
              ]
            }
          });
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
      const user = await getCachedUserProfile(telegramId, User);

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
      const user = await getCachedUserProfile(telegramId, User);
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

  // STORE command (main premium store - accessible before registration)
  bot.onText(/\/(store|shop|premium|buy)$/, async (msg) => {
    const chatId = msg.chat.id;

    const storeMsg = `💎 **Kissu Store** 💎\n\n` +
      `Unlock premium features and boost your dating experience!\n\n` +
      `Choose a category to explore:`;

    bot.sendMessage(chatId, storeMsg, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '👑 VIP Membership', callback_data: 'store_vip' }
          ],
          [
            { text: '⚡ Boosts', callback_data: 'store_boosts' }
          ],
          [
            { text: '💰 Coins', callback_data: 'store_coins' }
          ],
          [
            { text: '🔙 Main Menu', callback_data: 'main_menu' }
          ]
        ]
      }
    });
  });
}

module.exports = { setupPremiumCommands };
