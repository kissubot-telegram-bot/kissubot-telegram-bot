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
}

module.exports = { setupMatchesCommands };