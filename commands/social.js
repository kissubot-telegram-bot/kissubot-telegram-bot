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
}

module.exports = { setupSocialCommands };
