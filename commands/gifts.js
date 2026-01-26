const axios = require('axios');
const { API_BASE } = require('../config');

function setupGiftCommands(bot) {
    bot.on('callback_query', async (query) => {
        const { data, message } = query;
        const chatId = message.chat.id;
        const telegramId = query.from.id;

        if (data === 'gift_shop') {
            const giftShopMsg = `🎁 **GIFT SHOP** 🎁\n\n` +
                `Choose a gift to send to your matches:\n\n` +
                `🌹 **Rose** - 5 coins\n` +
                `💖 **Heart** - 10 coins\n` +
                `🍫 **Chocolate** - 15 coins\n` +
                `🌺 **Flowers** - 20 coins\n` +
                `💎 **Diamond** - 50 coins\n\n` +
                `💡 **To send a gift:**\n` +
                `1. Go to /matches\n` +
                `2. Select someone special\n` +
                `3. Choose "Send Gift"\n` +
                `4. Pick your perfect gift!`;

            bot.sendMessage(chatId, giftShopMsg, {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '💕 View Matches', callback_data: 'view_matches' },
                            { text: '🪙 Buy Coins', callback_data: 'buy_coins_menu' }
                        ],
                        [
                            { text: '🔙 Back', callback_data: 'main_menu' }
                        ]
                    ]
                }
            });
        } else if (data === 'sent_gifts') {
            try {
                const response = await axios.get(`${API_BASE}/gifts/sent/${telegramId}`);
                const sentGifts = response.data.gifts;

                if (sentGifts.length === 0) {
                    bot.sendMessage(chatId, '📨 **SENT GIFTS** 📨\n\n' +
                        'You haven\'t sent any gifts yet.\n\n' +
                        '💡 **Send your first gift:**\n' +
                        '• Go to /matches\n' +
                        '• Select someone special\n' +
                        '• Choose "Send Gift"\n\n' +
                        '🎁 Gifts help you stand out and show you care!', {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: '💕 View Matches', callback_data: 'view_matches' },
                                    { text: '🎁 Gift Shop', callback_data: 'gift_shop' }
                                ],
                                [
                                    { text: '🔙 Back', callback_data: 'main_menu' }
                                ]
                            ]
                        }
                    });
                } else {
                    const giftsList = sentGifts.slice(0, 10).map(gift =>
                        `🎁 ${gift.giftType} → ${gift.recipientName} (${gift.value} coins)`
                    ).join('\n');

                    bot.sendMessage(chatId, `📨 **SENT GIFTS (${sentGifts.length})** 📨\n\n` +
                        `${giftsList}\n\n` +
                        `💰 **Total Value:** ${sentGifts.reduce((sum, gift) => sum + gift.value, 0)} coins`, {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: '🎁 Send More Gifts', callback_data: 'gift_shop' },
                                    { text: '💕 View Matches', callback_data: 'view_matches' }
                                ],
                                [
                                    { text: '🔙 Back', callback_data: 'main_menu' }
                                ]
                            ]
                        }
                    });
                }
            } catch (err) {
                console.error('Sent gifts error:', err);
                bot.sendMessage(chatId, '❌ Failed to load sent gifts. Please try again later.');
            }
        } else if (data === 'received_gifts') {
            try {
                const response = await axios.get(`${API_BASE}/gifts/received/${telegramId}`);
                const receivedGifts = response.data.gifts;

                if (receivedGifts.length === 0) {
                    bot.sendMessage(chatId, '📬 **RECEIVED GIFTS** 📬\n\n' +
                        'You haven\'t received any gifts yet.\n\n' +
                        '💡 **Get more gifts by:**\n' +
                        '• Adding great photos to your profile\n' +
                        '• Writing an interesting bio\n' +
                        '• Being active and engaging\n\n' +
                        '🌟 Great profiles attract more attention!', {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: '👤 Edit Profile', callback_data: 'edit_profile' },
                                    { text: '🔍 Browse Profiles', callback_data: 'browse_profiles' }
                                ],
                                [
                                    { text: '🔙 Back', callback_data: 'main_menu' }
                                ]
                            ]
                        }
                    });
                } else {
                    const giftsList = receivedGifts.slice(0, 10).map(gift =>
                        `🎁 ${gift.giftType} from ${gift.senderName}${gift.senderIsVip ? ' 👑' : ''}`
                    ).join('\n');

                    bot.sendMessage(chatId, `📬 **RECEIVED GIFTS (${receivedGifts.length})** 📬\n\n` +
                        `${giftsList}\n\n` +
                        `💰 **Total Value:** ${receivedGifts.reduce((sum, gift) => sum + gift.value, 0)} coins\n\n` +
                        `💕 **You're popular! Keep being awesome!**`, {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: '💕 View Matches', callback_data: 'view_matches' },
                                    { text: '🎁 Send Gifts', callback_data: 'gift_shop' }
                                ],
                                [
                                    { text: '🔙 Back', callback_data: 'main_menu' }
                                ]
                            ]
                        }
                    });
                }
            } catch (err) {
                console.error('Received gifts error:', err);
                bot.sendMessage(chatId, '❌ Failed to load received gifts. Please try again later.');
            }
        }
    });
}

module.exports = { setupGiftCommands };