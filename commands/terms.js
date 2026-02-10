const { getCachedUserProfile, invalidateUserCache } = require('./auth');

function setupTermsCommands(bot, User) {
    // TERMS command - Display Terms of Service
    bot.onText(/\/terms/, async (msg) => {
        const chatId = msg.chat.id;

        const termsMsg = `📜 **KISSUBOT TERMS OF SERVICE** 📜\n\n` +
            `**Effective Date:** February 2026\n\n` +
            `KissuBot is a Telegram-based dating platform that helps users meet and connect.\n\n` +
            `**By using KissuBot, you agree to the following:**\n\n` +
            `• You must be 18 years or older\n` +
            `• You are responsible for your interactions with other users\n` +
            `• Harassment, scams, impersonation, or illegal activity are prohibited\n` +
            `• KissuBot may suspend accounts that violate rules\n` +
            `• KissuBot does not guarantee matches or relationships\n` +
            `• The service is provided "as is"\n\n` +
            `**For support:**\n` +
            `Telegram: @Kissu03bot`;

        bot.sendMessage(chatId, termsMsg);
    });

    // PRIVACY command - Display Privacy Policy
    bot.onText(/\/privacy/, async (msg) => {
        const chatId = msg.chat.id;

        const privacyMsg = `🔒 **KISSUBOT PRIVACY POLICY** 🔒\n\n` +
            `**Effective Date:** February 2026\n\n` +
            `KissuBot collects limited information to operate the service, including:\n\n` +
            `• Telegram ID\n` +
            `• Username\n` +
            `• Profile information\n` +
            `• Matching activity\n\n` +
            `**We use this information to:**\n\n` +
            `• Provide matching services\n` +
            `• Improve the platform\n` +
            `• Maintain safety\n\n` +
            `**We do not sell user data.**\n\n` +
            `Users can delete their account at any time.\n\n` +
            `**For support:**\n` +
            `Telegram: @Kissu03bot`;

        bot.sendMessage(chatId, privacyMsg);
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
                    // Create new user with terms accepted
                    const newUser = new User({
                        telegramId,
                        username: query.from.username,
                        termsAccepted: true,
                        termsAcceptedAt: new Date(),
                        onboardingStep: 'registration'
                    });
                    await newUser.save();
                } else {
                    // Update existing user
                    user.termsAccepted = true;
                    user.termsAcceptedAt = new Date();
                    user.onboardingStep = 'registration';
                    await user.save();
                }

                invalidateUserCache(telegramId);

                bot.sendMessage(chatId,
                    `✅ **Terms Accepted!**\n\n` +
                    `Welcome to KissuBot! Let's set up your profile.\n\n` +
                    `Use /register to start creating your profile.`
                );
            } catch (err) {
                console.error('Accept terms error:', err);
                bot.sendMessage(chatId, '❌ Something went wrong. Please try /start again.');
            }
        } else if (data === 'view_terms_inline') {
            const termsMsg = `📜 **KISSUBOT TERMS OF SERVICE** 📜\n\n` +
                `**Effective Date:** February 2026\n\n` +
                `KissuBot is a Telegram-based dating platform that helps users meet and connect.\n\n` +
                `**By using KissuBot, you agree to the following:**\n\n` +
                `• You must be 18 years or older\n` +
                `• You are responsible for your interactions with other users\n` +
                `• Harassment, scams, impersonation, or illegal activity are prohibited\n` +
                `• KissuBot may suspend accounts that violate rules\n` +
                `• KissuBot does not guarantee matches or relationships\n` +
                `• The service is provided "as is"\n\n` +
                `**For support:**\n` +
                `Telegram: @Kissu03bot`;

            bot.sendMessage(chatId, termsMsg);
        } else if (data === 'view_privacy_inline') {
            const privacyMsg = `🔒 **KISSUBOT PRIVACY POLICY** 🔒\n\n` +
                `**Effective Date:** February 2026\n\n` +
                `KissuBot collects limited information to operate the service, including:\n\n` +
                `• Telegram ID\n` +
                `• Username\n` +
                `• Profile information\n` +
                `• Matching activity\n\n` +
                `**We use this information to:**\n\n` +
                `• Provide matching services\n` +
                `• Improve the platform\n` +
                `• Maintain safety\n\n` +
                `**We do not sell user data.**\n\n` +
                `Users can delete their account at any time.\n\n` +
                `**For support:**\n` +
                `Telegram: @Kissu03bot`;

            bot.sendMessage(chatId, privacyMsg);
        } else if (data === 'decline_terms') {
            bot.sendMessage(chatId,
                `❌ **Terms Declined**\n\n` +
                `You must accept our Terms of Service and Privacy Policy to use KissuBot.\n\n` +
                `If you change your mind, use /start to try again.\n\n` +
                `Goodbye! 👋`
            );
        }
    });
}

module.exports = { setupTermsCommands };
