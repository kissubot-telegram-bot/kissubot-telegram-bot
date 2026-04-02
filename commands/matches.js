const axios = require('axios');
const API_BASE = process.env.API_BASE || 'http://localhost:3002';
const { requireMatchesAccess } = require('./genderGate');
const { MAIN_KEYBOARD } = require('../keyboard');

function setupMatchesCommands(bot, User) {
    bot.onText(/\/matches/, async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from.id;

        try {
            // Everyone must be VIP to view matches
            if (!(await requireMatchesAccess(bot, chatId, String(telegramId), User))) {
                return;
            }

            const res = await axios.get(`${API_BASE}/matches/${telegramId}`);
            const matches = res.data;

            if (!matches || matches.length === 0) {
                const noMatchesMsg = `💔 **No Matches Yet** 💔\n\n` +
                    `Don't worry! Your perfect match is out there.\n\n` +
                    `💡 **Tips to get more matches:**\n` +
                    `• Complete your profile (add a bio and photos)\n` +
                    `• Be active and browse profiles daily\n` +
                    `• Try adjusting your search filters\n\n` +
                    `Keep swiping and you'll find someone soon!`;

                bot.sendMessage(chatId, noMatchesMsg, { parse_mode: 'Markdown', reply_markup: MAIN_KEYBOARD });
            } else {
                let matchesMessage = `💕 *Your Matches (${matches.length})* 💕\n\nHere are the people you've matched with:\n`;
                const keyboard = [];

                matches.forEach(match => {
                    matchesMessage += `\n• *${match.name}* — ${new Date(match.matchedAt).toLocaleDateString()}`;
                    const chatUrl = match.username
                        ? `https://t.me/${match.username}`
                        : `tg://user?id=${match.telegramId}`;
                    keyboard.push([
                        { text: `💬 ${match.name}`, url: chatUrl },
                        { text: `🎁 Gift`, callback_data: `gift_to_${match.telegramId}` }
                    ]);
                });

                bot.sendMessage(chatId, matchesMessage, {
                    parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: keyboard }
                });
            }
        } catch (error) {
            console.error('Error fetching matches:', error.message);
            bot.sendMessage(chatId, '❌ An error occurred while fetching your matches. Please try again later.');
        }
    });
}

module.exports = { setupMatchesCommands };