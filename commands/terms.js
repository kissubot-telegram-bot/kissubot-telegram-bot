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
                const user = await User.findOne({ telegramId });

                if (!user) {
                    const newUser = new User({
                        telegramId,
                        username: query.from.username,
                        termsAccepted: true,
                        termsAcceptedAt: new Date(),
                        onboardingStep: 'registration'
                    });
                    await newUser.save();
                } else {
                    user.termsAccepted = true;
                    user.termsAcceptedAt = new Date();
                    user.onboardingStep = 'registration';
                    await user.save();
                }

                invalidateUserCache(telegramId);

                bot.sendMessage(chatId,
                    `✅ **Terms Accepted!**\n\n` +
                    `🎉 Welcome to KissuBot! You're all set to begin your journey.\n\n` +
                    `Let's create your profile and start connecting with amazing people!\n\n` +
                    `👇 Click the button below to get started:`,
                    {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '🚀 Create My Profile', callback_data: 'start_registration' }, { text: '❓ How It Works', callback_data: 'show_help' }]
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
            bot.sendMessage(chatId,
                `❌ **Terms Declined**\n\n` +
                `You must accept our Terms of Service and Privacy Policy to use KissuBot.\n\n` +
                `If you change your mind, use /start to try again.\n\nGoodbye! 👋`
            );
        }
    });
}

module.exports = { setupTermsCommands };
