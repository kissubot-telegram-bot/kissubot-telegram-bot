const { getCachedUserProfile, invalidateUserCache } = require('./auth');
const path = require('path');

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
                        [{ text: '📖 Read Terms', web_app: { url: `${process.env.WEBHOOK_URL}/docs/terms` } }],
                        [{ text: '🔒 Privacy Policy', web_app: { url: `${process.env.WEBHOOK_URL}/docs/privacy` } }],
                        [{ text: '🏠 Main Menu', callback_data: 'main_menu' }]
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
                        [{ text: '📖 Read Privacy', web_app: { url: `${process.env.WEBHOOK_URL}/docs/privacy` } }],
                        [{ text: '📜 Terms of Service', web_app: { url: `${process.env.WEBHOOK_URL}/docs/terms` } }],
                        [{ text: '🏠 Main Menu', callback_data: 'main_menu' }]
                    ]
                }
            });
        } catch (err) {
            console.error('Privacy error:', err);
            bot.sendMessage(chatId, '❌ Could not load Privacy Policy. Please try again later.');
        }
    });

    // Accept Terms callback
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const telegramId = query.from.id;
        const data = query.data;

        if (data === 'accept_terms') {
            try {
                // We now accept terms at the END of onboarding
                let user = await User.findOne({ telegramId });

                if (!user) {
                    // Fallback just in case they manage to hit this without a profile
                    user = new User({
                        telegramId,
                        username: query.from.username || '',
                        location: 'Unknown',
                        termsAccepted: true,
                        termsAcceptedAt: new Date(),
                        onboardingStep: 'registration'
                    });
                    await user.save();
                } else {
                    user.termsAccepted = true;
                    user.termsAcceptedAt = new Date();

                    // Mark profile complete
                    user.profileCompleted = true;
                    user.onboardingStep = 'completed';
                    await user.save();
                }

                invalidateUserCache(telegramId);
                await bot.answerCallbackQuery(query.id).catch(() => { });

                return bot.sendMessage(chatId,
                    `🎉 **Profile Complete!** 🎉\n\n` +
                    `You're all set, **${user.name || 'friend'}**!\n\n` +
                    `Your profile is live and you can start browsing matches 💕`,
                    {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '🔍 Start Browsing', callback_data: 'start_browse' }],
                                [{ text: '👤 View My Profile', callback_data: 'view_my_profile' }]
                            ]
                        }
                    }
                );
            } catch (err) {
                console.error('Accept terms error:', err);
                bot.sendMessage(chatId, '❌ Something went wrong. Please try /start again.');
            }

        } else if (data === 'view_terms_inline') {
            try {
                await bot.sendMessage(chatId, '📜 **KissuBot Terms of Service**', {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '📖 Read Terms', web_app: { url: `${process.env.WEBHOOK_URL}/docs/terms` } }],
                            [{ text: '🔒 Privacy Policy', web_app: { url: `${process.env.WEBHOOK_URL}/docs/privacy` } }],
                            [{ text: '🏠 Main Menu', callback_data: 'main_menu' }]
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
                            [{ text: '📖 Read Privacy', web_app: { url: `${process.env.WEBHOOK_URL}/docs/privacy` } }],
                            [{ text: '📜 Terms of Service', web_app: { url: `${process.env.WEBHOOK_URL}/docs/terms` } }],
                            [{ text: '🏠 Main Menu', callback_data: 'main_menu' }]
                        ]
                    }
                });
            } catch (err) {
                bot.sendMessage(chatId, '❌ Could not load Privacy Policy. Please try again later.');
            }
        } else if (data === 'decline_terms' || data === 'decline_privacy') {
            await bot.answerCallbackQuery(query.id).catch(() => { });
            await bot.sendMessage(chatId,
                `❌ *Terms Declined*\n\nYou must accept our Terms of Service to use KissuBot.\n\nIf you change your mind, tap below. �`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '� Read Terms Again', web_app: { url: `${process.env.WEBHOOK_URL}/docs/terms` } }],
                            [{ text: '🔙 Try Again', callback_data: 'main_menu' }]
                        ]
                    }
                }
            );
        }
    });
}

module.exports = { setupTermsCommands };
