const axios = require('axios');
const API_BASE = process.env.API_BASE || 'http://localhost:3002';

function setupMatchesCommands(bot) {
    bot.onText(/\/matches/, async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from.id;

        try {
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

                bot.sendMessage(chatId, noMatchesMsg, {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🔍 Browse Profiles', callback_data: 'browse_profiles' }],
                            [{ text: '✏️ Edit My Profile', callback_data: 'edit_profile' }],
                            [{ text: '⚙️ Edit Search Settings', callback_data: 'main_settings' }]
                        ]
                    }
                });
            } else {
                let matchesMessage = `💕 **Your Matches** 💕\n\nHere are the people you've matched with:\n`;
                const keyboard = [];

                matches.forEach(match => {
                    matchesMessage += `\n• ${match.name} (@${match.username}) - Matched on ${new Date(match.matchedAt).toLocaleDateString()}`;
                    keyboard.push([{ text: `View ${match.name}'s Profile`, callback_data: `view_match_${match.telegramId}` }]);
                });

                matchesMessage += `\n\nSelect a profile to view more details or continue browsing.`;

                keyboard.push(
                    [{ text: '🔍 Browse More Profiles', callback_data: 'browse_profiles' }],
                    [{ text: '🏠 Back to Main Menu', callback_data: 'main_menu' }]
                );

                bot.sendMessage(chatId, matchesMessage, {
                    reply_markup: {
                        inline_keyboard: keyboard
                    }
                });
            }
        } catch (error) {
            console.error('Error fetching matches:', error.message);
            bot.sendMessage(chatId, '❌ An error occurred while fetching your matches. Please try again later.');
        }
    });
}

module.exports = { setupMatchesCommands };