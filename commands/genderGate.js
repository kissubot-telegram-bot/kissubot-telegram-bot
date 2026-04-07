const { getCachedUserProfile } = require('./auth');

const FREE_SWIPES_LIMIT = 5;

// In-memory daily swipe counter for male non-VIP users
const maleSwipeCounts = new Map();

function getMaleSwipeCount(telegramId) {
    const today = new Date().toDateString();
    const entry = maleSwipeCounts.get(String(telegramId));
    if (!entry || entry.date !== today) return 0;
    return entry.count;
}

function incrementMaleSwipeCount(telegramId) {
    const today = new Date().toDateString();
    const key = String(telegramId);
    const entry = maleSwipeCounts.get(key);
    if (!entry || entry.date !== today) {
        maleSwipeCounts.set(key, { count: 1, date: today });
        return 1;
    }
    entry.count += 1;
    return entry.count;
}

// Browse gate: women unlimited free, men 5 free daily swipes then paywall
async function requireBrowseAccess(bot, chatId, telegramId, User) {
    const user = await getCachedUserProfile(telegramId, User);
    if (!user) return false;

    const gender = (user.gender || '').toLowerCase();

    // Women & others: unlimited free browse
    if (gender === 'female' || gender === 'other' || gender === 'non-binary') return true;

    // VIP men: unlimited
    if (user.isVip) return true;

    // Non-VIP men: check daily free swipe count
    const count = getMaleSwipeCount(String(telegramId));
    if (count < FREE_SWIPES_LIMIT) return true;

    // Out of free swipes
    await bot.sendMessage(chatId,
        `🔒 *Daily Limit Reached*\n\n` +
        `You've used your *${FREE_SWIPES_LIMIT} free swipes* for today!\n\n` +
        `Subscribe to get *unlimited swipes*, see who liked you, and unlock your matches 💕`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '👑 Subscribe Now', callback_data: 'manage_vip' }],
                    [{ text: '🏠 Menu', callback_data: 'main_menu' }]
                ]
            }
        }
    );
    return false;
}

// Matches gate: everyone can view matches, but males need VIP to chat
async function requireMatchesAccess(bot, chatId, telegramId, User, action = 'view') {
    const user = await getCachedUserProfile(telegramId, User);
    if (!user) return false;

    // Everyone can view matches
    if (action === 'view') return true;

    // For chat action, check gender and VIP status
    if (action === 'chat') {
        const gender = (user.gender || '').toLowerCase();
        
        // Women & others: free chat access
        if (gender === 'female' || gender === 'other' || gender === 'non-binary') return true;
        
        // VIP men: allowed to chat
        if (user.isVip) return true;
        
        // Non-VIP men: show subtle VIP prompt
        await bot.sendMessage(chatId,
            `💬 *Start Chatting with Your Matches!*\n\n` +
            `You've got great matches waiting! Upgrade to unlock unlimited conversations and stand out.\n\n` +
            `✨ *VIP Benefits:*\n` +
            `• Unlimited chat with all matches\n` +
            `• Priority profile visibility\n` +
            `• See who liked you\n` +
            `• Exclusive badges & features`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '✨ Upgrade to VIP', callback_data: 'manage_vip' }],
                        [{ text: '💕 Back to Matches', callback_data: 'view_matches' }]
                    ]
                }
            }
        );
        return false;
    }

    return true;
}

// Likes gate: everyone needs VIP to see who liked them
async function requireLikesAccess(bot, chatId, telegramId, User) {
    const user = await getCachedUserProfile(telegramId, User);
    if (!user) return false;

    if (user.isVip) return true;

    const gender = (user.gender || '').toLowerCase();
    const msg = gender === 'female'
        ? `� *Someone liked you!*\n\nSubscribe to see exactly who liked your profile and match with them instantly 💕`
        : `💘 *You have admirers!*\n\nSubscribe to see who liked you and get more matches 💕`;

    await bot.sendMessage(chatId, msg, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: '👑 Subscribe Now', callback_data: 'manage_vip' }],
                [{ text: '🏠 Menu', callback_data: 'main_menu' }]
            ]
        }
    });
    return false;
}

// Legacy alias kept for modules that still import requireSubscription
async function requireSubscription(bot, chatId, telegramId, User) {
    return requireBrowseAccess(bot, chatId, telegramId, User);
}

module.exports = {
    requireSubscription,
    requireBrowseAccess,
    requireMatchesAccess,
    requireLikesAccess,
    getMaleSwipeCount,
    incrementMaleSwipeCount,
    FREE_SWIPES_LIMIT
};
