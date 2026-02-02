const axios = require('axios');
const { API_BASE } = require('../config');

function setupSocialCommands(bot) {
    bot.onText(/\/gifts/, async (msg) => {
        const chatId = msg.chat.id;
        const giftsMsg = `🎁 **GIFT CENTER** 🎁\n\n` +
            `Send virtual gifts to your matches and show you care!\n\n` +
            `💝 **Available Gifts:**\n` +
            `• 🌹 Rose (5 coins)\n` +
            `• 💖 Heart (10 coins)\n` +
            `• 🍫 Chocolate (15 coins)\n` +
            `• 🌺 Flowers (20 coins)\n` +
            `• 💎 Diamond (50 coins)\n\n` +
            `✨ **Gifts help you:**\n` +
            `• Stand out from other matches\n` +
            `• Show genuine interest\n` +
            `• Start meaningful conversations\n` +
            `• Express your feelings`;

        const opts = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🎁 Browse Gift Shop', callback_data: 'gift_shop' }],
                    [{ text: '📨 Sent Gifts', callback_data: 'sent_gifts' }, { text: '📬 Received Gifts', callback_data: 'received_gifts' }],
                    [{ text: '🪙 Buy Coins', callback_data: 'buy_coins_menu' }, { text: '🔙 Back', callback_data: 'main_menu' }]
                ]
            }
        };

        bot.sendMessage(chatId, giftsMsg, opts);
    });

    bot.onText(/\/matches/, async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from.id;

        try {
            const response = await axios.get(`${API_BASE}/matches/${telegramId}`);
            const matches = response.data.matches || response.data || [];

            if (!matches || matches.length === 0) {
                bot.sendMessage(chatId, '💔 **NO MATCHES YET** 💔\n\n' +
                    'You don\'t have any matches right now.\n\n' +
                    '💡 **How to get matches:**\n' +
                    '• Keep browsing and liking profiles\n' +
                    '• Make your profile more attractive\n' +
                    '• Be patient! Good things take time.\n\n' +
                    'Someone special is waiting for you! ✨', {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🔍 Browse Profiles', callback_data: 'browse_profiles' }],
                            [{ text: '👤 Edit Your Profile', callback_data: 'edit_profile' }]
                        ]
                    }
                });
            } else {
                const matchList = matches.map(match =>
                    `💕 ${match.name} (${match.age}) - @${match.username}`
                ).join('\n');

                bot.sendMessage(chatId, `💖 **YOUR MATCHES (${matches.length})** 💖\n\n` +
                    `${matchList}\n\n` +
                    '💡 **What to do next:**\n' +
                    '• Start a conversation!\n' +
                    '• Send a thoughtful gift\n' +
                    '• Plan a virtual date\n\n' +
                    'Don\'t be shy! Reach out and connect. 💌', {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🎁 Send a Gift', callback_data: 'send_gift' }],
                            [{ text: '💬 Start Chatting', url: `https://t.me/${matches[0].username}` }]
                        ]
                    }
                });
            }
        } catch (error) {
            console.error('Matches error:', error);
            bot.sendMessage(chatId, '❌ Failed to load your matches. Please try again later.');
        }
    });
}

module.exports = { setupSocialCommands };
