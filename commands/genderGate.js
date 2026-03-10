const { getCachedUserProfile } = require('./auth');

async function requireSubscription(bot, chatId, telegramId, User) {
    const user = await getCachedUserProfile(telegramId, User);
    if (!user) return false;

    // Women and others get free access to core features
    if (user.gender === 'Female' || user.gender === 'Other') return true;

    // Men must be VIP
    if (user.isVip) return true;

    // If we reach here, it's a non-VIP Male. Block access.
    await bot.sendMessage(chatId,
        `🔒 **Subscription Required**\n\n` +
        `To keep KissuBot safe and high-quality, men must be subscribed to browse profiles, view matches, and start chats.\n\n` +
        `*(Women use these features for free!)*\n\n` +
        `👑 **Subscribe now to unlock everything:**`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '👑 View Subscriptions', callback_data: 'manage_vip' }],
                    [{ text: '🏠 Main Menu', callback_data: 'main_menu' }]
                ]
            }
        }
    );
    return false;
}

module.exports = { requireSubscription };
