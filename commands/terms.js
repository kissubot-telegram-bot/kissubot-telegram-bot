const { getCachedUserProfile, invalidateUserCache } = require('./auth');
const path = require('path');

const TERMS_PDF = path.join(__dirname, '..', 'docs', 'terms-of-service.pdf');
const PRIVACY_PDF = path.join(__dirname, '..', 'docs', 'privacy-policy.pdf');

function setupTermsCommands(bot, User) {
    // TERMS command - Send Terms of Service PDF
    bot.onText(/\/terms/, async (msg) => {
        const chatId = msg.chat.id;
        try {
            await bot.sendDocument(chatId, TERMS_PDF, {
                caption: '📜 **KissuBot Terms of Service**\n\nPlease read before using the platform.',
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔒 Privacy Policy', callback_data: 'view_privacy_inline' }, { text: '🏠 Main Menu', callback_data: 'main_menu' }]
                    ]
                }
            });
        } catch (err) {
            console.error('Terms PDF error:', err);
            bot.sendMessage(chatId, '❌ Could not load Terms of Service. Please try again later.');
        }
    });

    // PRIVACY command - Send Privacy Policy PDF
    bot.onText(/\/privacy/, async (msg) => {
        const chatId = msg.chat.id;
        try {
            await bot.sendDocument(chatId, PRIVACY_PDF, {
                caption: '🔒 **KissuBot Privacy Policy**\n\nYour data is safe with us.',
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '📜 Terms of Service', callback_data: 'view_terms_inline' }, { text: '🏠 Main Menu', callback_data: 'main_menu' }]
                    ]
                }
            });
        } catch (err) {
            console.error('Privacy PDF error:', err);
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
                let user = await User.findOne({ telegramId });

                if (!user) {
                    user = new User({
                        telegramId,
                        username: query.from.username || '',
                        location: 'Unknown', // required field, will be updated in onboarding
                        termsAccepted: true,
                        termsAcceptedAt: new Date(),
                        onboardingStep: 'registration'
                    });
                    await user.save();
                } else {
                    user.termsAccepted = true;
                    user.termsAcceptedAt = new Date();
                    user.onboardingStep = 'registration';
                    await user.save();
                }

                invalidateUserCache(telegramId);
                await bot.answerCallbackQuery(query.id).catch(() => { });

                // Check if profile is already complete (returning user re-accepted)
                const profileComplete = user.name && user.age && user.location && user.location !== 'Unknown' && user.photos && user.photos.length > 0;

                if (profileComplete) {
                    return bot.sendMessage(chatId,
                        `✅ *Terms Accepted!*\n\nWelcome back to KissuBot! 💕`,
                        {
                            parse_mode: 'Markdown',
                            reply_markup: { inline_keyboard: [[{ text: '🏠 Main Menu', callback_data: 'main_menu' }]] }
                        }
                    );
                }

                // New user or incomplete profile → start guided onboarding
                const onboardingModule = require('./onboarding');
                if (onboardingModule.startOnboarding) {
                    await onboardingModule.startOnboarding(chatId, telegramId);
                } else {
                    bot.sendMessage(chatId,
                        `✅ *Terms Accepted!* 🎉\n\nLet's create your profile to start connecting!`,
                        {
                            parse_mode: 'Markdown',
                            reply_markup: {
                                inline_keyboard: [
                                    [{ text: '🚀 Set Up Profile', callback_data: 'edit_profile' }]
                                ]
                            }
                        }
                    );
                }
            } catch (err) {
                console.error('Accept terms error:', err);
                bot.sendMessage(chatId, '❌ Something went wrong. Please try /start again.');
            }

        } else if (data === 'view_terms_inline') {
            try {
                await bot.sendDocument(chatId, TERMS_PDF, {
                    caption: '📜 **KissuBot Terms of Service**',
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🔒 Privacy Policy', callback_data: 'view_privacy_inline' }, { text: '🏠 Main Menu', callback_data: 'main_menu' }]
                        ]
                    }
                });
            } catch (err) {
                bot.sendMessage(chatId, '❌ Could not load Terms of Service. Please try again later.');
            }
        } else if (data === 'view_privacy_inline') {
            try {
                await bot.sendDocument(chatId, PRIVACY_PDF, {
                    caption: '🔒 **KissuBot Privacy Policy**',
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '📜 Terms of Service', callback_data: 'view_terms_inline' }, { text: '🏠 Main Menu', callback_data: 'main_menu' }]
                        ]
                    }
                });
            } catch (err) {
                bot.sendMessage(chatId, '❌ Could not load Privacy Policy. Please try again later.');
            }
        } else if (data === 'decline_terms') {
            `❌ **Terms Declined**\n\n` +
                `You must accept our Terms of Service and Privacy Policy to use KissuBot.\n\n` +
                `If you change your mind, you can click Start again. Goodbye! 👋`,
            {
                reply_markup: {
                    inline_keyboard: [[{ text: '🚀 Trial Again', callback_data: 'main_menu' }]]
                }
            }
        }
    });
}

module.exports = { setupTermsCommands };
