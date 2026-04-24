const axios = require('axios');
const API_BASE = process.env.API_BASE || 'http://localhost:3002';
const { requireLikesAccess } = require('./genderGate');
const { MAIN_KEYBOARD } = require('../keyboard');

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutes ago";
    return Math.floor(seconds) + " seconds ago";
}

async function showLikesYouHub(bot, chatId, telegramId, User, section = 'overview') {
    try {
        if (!(await requireLikesAccess(bot, chatId, String(telegramId), User))) return;
        
        const [likesRes, giftsRes] = await Promise.all([
            axios.get(`${API_BASE}/likes/${telegramId}`),
            axios.get(`${API_BASE}/gifts/received/${telegramId}`).catch(() => ({ data: { gifts: [] } }))
        ]);
        
        const likes = likesRes.data.likes || [];
        const superLikes = likes.filter(l => l.superLike);
        const regularLikes = likes.filter(l => !l.superLike);
        const gifts = giftsRes.data.gifts || [];
        
        if (section === 'overview') {
            const totalLikes = regularLikes.length + superLikes.length;
            let message = `💖 *Likes You Hub*\n\n`;
            message += `� *${totalLikes} people liked your profile!*\n\n`;
            message += `💕 Regular Likes · *${regularLikes.length}*\n`;
            message += `⭐ Super Likes · *${superLikes.length}*\n`;
            message += `🎁 Gifts Received · *${gifts.length}*\n\n`;
            message += `_Tap a section to see who liked you_`;

            const keyboard = [
                [
                    { text: `💕 Likes (${regularLikes.length})`, callback_data: 'likesyou_regular' },
                    { text: `⭐ Super Likes (${superLikes.length})`, callback_data: 'likesyou_super' }
                ],
                [{ text: `🎁 Gifts (${gifts.length})`, callback_data: 'likesyou_gifts' }],
                [{ text: '🔄 Refresh', callback_data: 'likesyou_overview' }]
            ];

            bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: keyboard }
            });
        } else if (section === 'regular') {
            showLikesList(bot, chatId, regularLikes, '💕 Regular Likes', false);
        } else if (section === 'super') {
            showLikesList(bot, chatId, superLikes, '⭐ Super Likes', true);
        } else if (section === 'gifts') {
            showGiftsList(bot, chatId, gifts);
        }
    } catch (error) {
        console.error('Error in likesyou hub:', error.message);
        bot.sendMessage(chatId, '❌ An error occurred. Please try again later.');
    }
}

async function showLikesList(bot, chatId, likes, title, isSuperLike) {
    if (likes.length === 0) {
        const emptyMsg = isSuperLike
            ? `⭐ *No Super Likes Yet*\n\nKeep your profile updated and someone special will super like you soon! 🚀`
            : `💕 *No Likes Yet*\n\nKeep browsing and update your profile to get noticed! 💪`;

        bot.sendMessage(chatId, emptyMsg, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'likesyou_overview' }]] }
        });
        return;
    }

    const badge = isSuperLike ? '⭐' : '💕';
    await bot.sendMessage(chatId,
        `${badge} *${title}*\n_${likes.length} total — showing up to 10_`,
        { parse_mode: 'Markdown' }
    );

    const sortedLikes = [...likes].sort((a, b) => new Date(b.lastActive || 0) - new Date(a.lastActive || 0));

    for (const liker of sortedLikes.slice(0, 10)) {
        const name = liker.name || 'Unknown';
        const age = liker.age ? `, ${liker.age}` : '';
        const location = liker.location || 'Unknown location';
        const bio = liker.bio ? liker.bio.substring(0, 60) + (liker.bio.length > 60 ? '...' : '') : null;
        const onlineStatus = liker.isOnline ? '🟢 Online' : liker.lastActive ? `⏰ ${getTimeAgo(liker.lastActive)}` : '';
        const vipBadge = liker.isVip ? ' 👑' : '';
        const superBadge = isSuperLike ? '\n⭐ *Super Liked you!*' : '';

        let card = `*${name}${age}*${vipBadge}\n`;
        card += `📍 ${location}\n`;
        if (onlineStatus) card += `${onlineStatus}\n`;
        if (bio) card += `💬 _"${bio}"_\n`;
        card += superBadge;

        const buttons = [
            [{ text: `👤 View ${name}'s Profile`, callback_data: `view_liker_${liker.telegramId}` }]
        ];

        try {
            if (liker.photos && liker.photos.length > 0) {
                await bot.sendPhoto(chatId, liker.photos[0], {
                    caption: card,
                    parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: buttons }
                });
            } else {
                await bot.sendMessage(chatId, card, {
                    parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: buttons }
                });
            }
        } catch (e) {
            await bot.sendMessage(chatId, card, {
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: buttons }
            });
        }
    }

    const extra = likes.length > 10 ? `\n_...and ${likes.length - 10} more_` : '';
    bot.sendMessage(chatId, `${extra ? extra + '\n\n' : ''}🔙 Back to hub`, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '🔙 Back to Hub', callback_data: 'likesyou_overview' }]] }
    });
}

function showGiftsList(bot, chatId, gifts) {
    if (gifts.length === 0) {
        bot.sendMessage(chatId, '🎁 **No Gifts Yet**\n\nSomeone will send you a gift soon! Keep being awesome! ✨', {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔙 Back to Hub', callback_data: 'likesyou_overview' }]
                ]
            }
        });
        return;
    }
    
    let message = `🎁 **GIFTS RECEIVED** 🎁\n\n`;
    message += `Total: ${gifts.length}\n\n`;
    
    const keyboard = [];
    const sortedGifts = gifts.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));
    
    sortedGifts.slice(0, 10).forEach(gift => {
        message += `🎁 **${gift.senderName}** sent you:\n` +
            `  ${gift.giftEmoji} *${gift.giftName}*\n` +
            `  *${getTimeAgo(gift.sentAt)}*\n`;
        
        if (gift.message) {
            message += `  💬 "${gift.message}"\n`;
        }
        message += `\n`;
        
        keyboard.push([{ text: `👤 View ${gift.senderName}`, callback_data: `view_liker_${gift.senderId}` }]);
    });
    
    if (gifts.length > 10) {
        message += `_...and ${gifts.length - 10} more gifts!_\n\n`;
    }
    
    keyboard.push([{ text: '🔙 Back to Hub', callback_data: 'likesyou_overview' }]);
    
    bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
    });
}

function setupLikesCommands(bot, User) {
    bot.onText(/\/likesyou/, async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from.id;
        await showLikesYouHub(bot, chatId, telegramId, User, 'overview');
    });
    
    // Callback handlers for navigation
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const telegramId = query.from.id;
        const data = query.data;
        
        if (data === 'likesyou_overview') {
            await bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
            await showLikesYouHub(bot, chatId, telegramId, User, 'overview');
            bot.answerCallbackQuery(query.id);
        } else if (data === 'likesyou_regular') {
            await bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
            await showLikesYouHub(bot, chatId, telegramId, User, 'regular');
            bot.answerCallbackQuery(query.id);
        } else if (data === 'likesyou_super') {
            await bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
            await showLikesYouHub(bot, chatId, telegramId, User, 'super');
            bot.answerCallbackQuery(query.id);
        } else if (data === 'likesyou_gifts') {
            await bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
            await showLikesYouHub(bot, chatId, telegramId, User, 'gifts');
            bot.answerCallbackQuery(query.id);
        } else if (data === 'view_likes') {
            // From superlike notification
            await showLikesYouHub(bot, chatId, telegramId, User, 'overview');
            bot.answerCallbackQuery(query.id);
        } else if (data.startsWith('view_liker_')) {
            const targetId = data.replace('view_liker_', '');
            bot.answerCallbackQuery(query.id);
            try {
                const targetUser = await User.findOne({ telegramId: String(targetId) });
                if (!targetUser) return bot.sendMessage(chatId, '❌ User not found.');

                const genderIcon = targetUser.gender === 'Male' ? '👔' : targetUser.gender === 'Female' ? '👗' : '🧒';
                const vipBadge = targetUser.isVip ? ' 👑' : '';
                let profile = `${genderIcon} *${targetUser.name}${vipBadge}*, ${targetUser.age}\n`;
                profile += `📍 ${targetUser.location}\n`;
                profile += `💘 Looking for: ${targetUser.lookingFor || 'Everyone'}\n`;
                if (targetUser.bio) profile += `\n💬 ${targetUser.bio}\n`;

                const buttons = [[
                    { text: '❤️ Like Back', callback_data: `like_${targetId}` },
                    { text: '🔙 Back', callback_data: 'likesyou_overview' }
                ]];

                if (targetUser.photos && targetUser.photos.length > 0) {
                    await bot.sendPhoto(chatId, targetUser.photos[0], {
                        caption: profile, parse_mode: 'Markdown',
                        reply_markup: { inline_keyboard: buttons }
                    }).catch(() => bot.sendMessage(chatId, profile, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } }));
                } else {
                    await bot.sendMessage(chatId, profile, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } });
                }
            } catch (err) {
                console.error('[VIEW LIKER]', err);
                bot.sendMessage(chatId, '❌ Failed to load profile.');
            }
        }
    });
}

module.exports = { setupLikesCommands };