const { getCachedUserProfile, invalidateUserCache } = require('./auth');
const path = require('path');
const { MAIN_KEYBOARD } = require('../keyboard');

const TERMS_PDF = path.join(__dirname, '..', 'docs', 'terms-of-service.pdf');
const PRIVACY_PDF = path.join(__dirname, '..', 'docs', 'privacy-policy.pdf');

function setupTermsCommands(bot, User) {
    bot.onText(/\/terms/, async (msg) => {
        const chatId = msg.chat.id;
        try {
            await bot.sendMessage(chatId, '📜 **KissuBot Terms of Service**\n\nPlease read before using the platform.', {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '📖 Read Terms', url: 'https://kissubot-telegram-bot.github.io/kissubot-telegram-bot/terms.html' }],
                        [{ text: '🔒 Privacy Policy', url: 'https://kissubot-telegram-bot.github.io/kissubot-telegram-bot/privacy.html' }],
                        [{ text: '🏠 Menu', callback_data: 'main_menu' }]
                    ]
                }
            });
        } catch (err) {
            console.error('Terms error:', err);
            bot.sendMessage(chatId, '❌ Could not load Terms of Service. Please try again later.');
        }
    });

    bot.onText(/\/privacy/, async (msg) => {
        const chatId = msg.chat.id;
        try {
            await bot.sendMessage(chatId, '🔒 **KissuBot Privacy Policy**\n\nYour data is safe with us.', {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '📖 Read Privacy', url: 'https://kissubot-telegram-bot.github.io/kissubot-telegram-bot/privacy.html' }],
                        [{ text: '📜 Terms of Service', url: 'https://kissubot-telegram-bot.github.io/kissubot-telegram-bot/terms.html' }],
                        [{ text: '🏠 Menu', callback_data: 'main_menu' }]
                    ]
                }
            });
        } catch (err) {
            console.error('Privacy error:', err);
            bot.sendMessage(chatId, '❌ Could not load Privacy Policy. Please try again later.');
        }
    });

    // Terms view callbacks
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const telegramId = query.from.id;
        const data = query.data;

        if (data === 'view_terms_inline') {
            try {
                await bot.sendMessage(chatId, '📜 **KissuBot Terms of Service**', {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '📖 Read Terms', url: 'https://kissubot-telegram-bot.github.io/kissubot-telegram-bot/terms.html' }],
                            [{ text: '🔒 Privacy Policy', url: 'https://kissubot-telegram-bot.github.io/kissubot-telegram-bot/privacy.html' }],
                            [{ text: '🏠 Menu', callback_data: 'main_menu' }]
                        ]
                    }
                });
            } catch (err) {
                bot.sendMessage(chatId, '❌ Could not load Terms of Service. Please try again later.');
            }
        } else if (data === 'view_privacy_inline') {
            try {
                await bot.sendMessage(chatId, '🔒 **KissuBot Privacy Policy**', {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '📖 Read Privacy', url: 'https://kissubot-telegram-bot.github.io/kissubot-telegram-bot/privacy.html' }],
                            [{ text: '📜 Terms of Service', url: 'https://kissubot-telegram-bot.github.io/kissubot-telegram-bot/terms.html' }],
                            [{ text: '🏠 Menu', callback_data: 'main_menu' }]
                        ]
                    }
                });
            } catch (err) {
                bot.sendMessage(chatId, '❌ Could not load Privacy Policy. Please try again later.');
            }
        }
    });
}

module.exports = { setupTermsCommands };
