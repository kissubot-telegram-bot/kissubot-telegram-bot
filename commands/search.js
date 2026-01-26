const axios = require('axios');
const API_BASE = process.env.API_BASE || 'http://localhost:3002';

function setupSearchCommands(bot) {
    bot.onText(/\/search/, async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from.id;

        try {
            // Fetch user's current search preferences to display
            const res = await axios.get(`${API_BASE}/search/preferences/${telegramId}`);
            const prefs = res.data;

            const message = `🔍 **Advanced Search** 🔍\n\n` +
                `Customize your search to find the perfect match. Your current settings are:\n` +
                `• **Age:** ${prefs.age.min}-${prefs.age.max}\n` +
                `• **Distance:** Up to ${prefs.distance} km\n` +
                `• **Gender:** ${prefs.gender}\n` +
                `• **Location:** ${prefs.location}\n\n` +
                `Use the buttons below to refine your search. VIP members get access to exclusive filters!`;

            const keyboard = [
                [{ text: '✏️ Set Age Range', callback_data: 'search_age_range' }, { text: '📍 Set Distance', callback_data: 'search_distance' }],
                [{ text: '🚻 Set Gender', callback_data: 'search_gender' }, { text: '🌍 Set Location', callback_data: 'search_location' }],
                [{ text: '💎 VIP Filters', callback_data: 'search_vip_filters' }],
                [{ text: '🚀 Start Search', callback_data: 'start_advanced_search' }]
            ];

            bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: keyboard
                }
            });
        } catch (error) {
            console.error('Error fetching search preferences:', error.message);
            bot.sendMessage(chatId, '❌ An error occurred while setting up your search. Please try again.');
        }
    });
}

module.exports = { setupSearchCommands };