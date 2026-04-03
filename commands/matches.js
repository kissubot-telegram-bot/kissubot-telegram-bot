const axios = require('axios');
const API_BASE = process.env.API_BASE || 'http://localhost:3002';
const { requireMatchesAccess } = require('./genderGate');
const { MAIN_KEYBOARD } = require('../keyboard');

function setupMatchesCommands(bot, User) {
    bot.onText(/\/matches/, async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from.id;

        try {
            // Dynamically import showMatches so it captures the updated browsing module exports
            const browsingModule = require('./browsing');
            if (browsingModule.showMatches) {
                await browsingModule.showMatches(chatId, telegramId);
            } else {
                bot.sendMessage(chatId, '❌ Matches module is currently initializing. Please try again.');
            }
        } catch (error) {
            console.error('Error in /matches command:', error.message);
            bot.sendMessage(chatId, '❌ An error occurred while fetching your matches. Please try again later.');
        }
    });

    // Also catch the specific text "💕 Matches" just in case the UI routing missed it
    bot.on('message', async (msg) => {
        if (!msg.text) return;
        const text = msg.text.trim();
        if (text === '💕 Matches' || text === '💘 Matches') {
            const chatId = msg.chat.id;
            const telegramId = msg.from.id;
            try {
                const browsingModule = require('./browsing');
                if (browsingModule.showMatches) {
                    await browsingModule.showMatches(chatId, telegramId);
                }
            } catch (err) {
                console.error(err);
            }
        }
    });
}

module.exports = { setupMatchesCommands };