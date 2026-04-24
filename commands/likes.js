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

async function showLikesYouHub(bot, chatId, telegramId, User, section = 'overview', offset = 0) {
    try {
        if (!(await requireLikesAccess(bot, chatId, String(telegramId), User))) return;

        // Get current user's VIP status and gender
        const currentUser = await User.findOne({ telegramId: String(telegramId) });
        const isVip = currentUser?.isVip || false;
        const isFemale = (currentUser?.gender || '').toLowerCase() === 'female';

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
            message += `👀 *${totalLikes} people liked your profile!*\n\n`;
            message += `💕 Regular Likes · *${regularLikes.length}*\n`;
            message += `⭐ Super Likes · *${superLikes.length}*\n`;
            message += `🎁 Gifts Received · *${gifts.length}*\n\n`;

            if (isVip) {
                message += `👑 *VIP* · Full access to all likes, profiles & chat`;
            } else if (isFemale) {
                message += `👧 You can view profiles · 🔒 _First 10 visible · Upgrade VIP for all_`;
            } else {
                message += `🔒 _Free users see first 10 likes · Upgrade to VIP for full access_`;
            }

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
            showLikesList(bot, chatId, regularLikes, '💕 Regular Likes', false, offset, isVip, isFemale);
        } else if (section === 'super') {
            showLikesList(bot, chatId, superLikes, '⭐ Super Likes', true, offset, isVip, isFemale);
        } else if (section === 'gifts') {
            showGiftsList(bot, chatId, gifts);
        }
    } catch (error) {
        console.error('Error in likesyou hub:', error.message);
        bot.sendMessage(chatId, '❌ An error occurred. Please try again later.');
    }
}

async function showLikesList(bot, chatId, likes, title, isSuperLike, offset = 0, isVip = false, isFemale = false) {
    // Access rules
    const canViewProfile = isVip || isFemale;  // VIP or female can view profiles
    const canSeeAll = isVip;                    // Only VIP gets pagination beyond 10
    const sectionKey = isSuperLike ? 'super' : 'regular';
    const badge = isSuperLike ? '⭐' : '💕';
    const PAGE = 10;

    if (likes.length === 0) {
        const emptyMsg = isSuperLike
            ? `⭐ *No Super Likes Yet*\n\nKeep your profile updated and someone special will super like you soon! 🚀`
            : `💕 *No Likes Yet*\n\nKeep browsing and update your profile to get noticed! 💪`;
        return bot.sendMessage(chatId, emptyMsg, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '🔙 Back to Hub', callback_data: 'likesyou_overview' }]] }
        });
    }

    const sortedLikes = [...likes].sort((a, b) => new Date(b.lastActive || 0) - new Date(a.lastActive || 0));

    // Non-VIP always starts at 0; VIP uses passed offset
    const effectiveOffset = canSeeAll ? offset : 0;
    const pageItems = sortedLikes.slice(effectiveOffset, effectiveOffset + PAGE);
    const lockedCount = !canSeeAll ? Math.max(0, likes.length - PAGE) : 0;
    const remaining = canSeeAll ? Math.max(0, likes.length - (effectiveOffset + PAGE)) : 0;

    // Header — only on first page
    if (effectiveOffset === 0) {
        let hint = '';
        if (isVip) hint = `👑 Full access`;
        else if (isFemale) hint = `👧 Profile viewing enabled · 🔒 Upgrade VIP to see all`;
        else hint = `🔒 Non-VIP · First 10 only · No profile access`;
        await bot.sendMessage(chatId,
            `${badge} *${title}*\n_${likes.length} total · ${hint}_`,
            { parse_mode: 'Markdown' }
        );
    }

    // Render visible cards
    for (const liker of pageItems) {
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

        let buttons;
        if (canViewProfile) {
            buttons = [[{ text: `👤 View ${name}'s Profile`, callback_data: `view_liker_${liker.telegramId}` }]];
        } else {
            buttons = [[{ text: `🔒 View Profile — VIP Only`, callback_data: 'manage_vip' }]];
        }

        try {
            if (liker.photos && liker.photos.length > 0) {
                await bot.sendPhoto(chatId, liker.photos[0], {
                    caption: card, parse_mode: 'Markdown',
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

    // Footer nav message
    let footerText, footerRows;

    if (lockedCount > 0) {
        // Non-VIP: show locked remaining count
        footerText = `🔒 *${lockedCount} more likes are hidden*\n_Upgrade to VIP to unlock all your likes_`;
        footerRows = [
            [{ text: '👑 Upgrade to VIP', callback_data: 'manage_vip' }],
            [{ text: '🔙 Back to Hub', callback_data: 'likesyou_overview' }]
        ];
    } else if (remaining > 0) {
        // VIP: show more button
        footerText = `_Showing ${effectiveOffset + 1}–${effectiveOffset + pageItems.length} of ${likes.length}_`;
        footerRows = [
            [{ text: `📋 Show More (${remaining} left)`, callback_data: `likesyou_more_${sectionKey}_${effectiveOffset + PAGE}` }],
            [{ text: '🔙 Back to Hub', callback_data: 'likesyou_overview' }]
        ];
    } else {
        // All shown
        footerText = `✓ _All ${likes.length} shown_`;
        footerRows = [[{ text: '🔙 Back to Hub', callback_data: 'likesyou_overview' }]];
    }

    bot.sendMessage(chatId, footerText, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: footerRows }
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
            await showLikesYouHub(bot, chatId, telegramId, User, 'overview');
            bot.answerCallbackQuery(query.id);
        } else if (data.startsWith('likesyou_more_')) {
            // Format: likesyou_more_{regular|super}_{offset}
            const parts = data.replace('likesyou_more_', '').split('_');
            const sectionType = parts[0]; // 'regular' or 'super'
            const moreOffset = parseInt(parts[1]) || 0;
            await showLikesYouHub(bot, chatId, telegramId, User, sectionType, moreOffset);
            bot.answerCallbackQuery(query.id);
        } else if (data.startsWith('view_liker_')) {
            const targetId = data.replace('view_liker_', '');
            bot.answerCallbackQuery(query.id);
            try {
                // Re-check viewer's access before showing profile
                const [viewerUser, targetUser] = await Promise.all([
                    User.findOne({ telegramId: String(telegramId) }),
                    User.findOne({ telegramId: String(targetId) })
                ]);
                if (!targetUser) return bot.sendMessage(chatId, '❌ User not found.');

                const viewerIsVip = viewerUser?.isVip || false;
                const viewerIsFemale = (viewerUser?.gender || '').toLowerCase() === 'female';
                const canViewProfile = viewerIsVip || viewerIsFemale;

                if (!canViewProfile) {
                    return bot.sendMessage(chatId,
                        `🔒 *Profile Locked*\n\nUpgrade to VIP to view full profiles of people who liked you.`,
                        { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [
                            [{ text: '👑 Upgrade to VIP', callback_data: 'manage_vip' }],
                            [{ text: '🔙 Back to Hub', callback_data: 'likesyou_overview' }]
                        ]}}
                    );
                }

                const genderIcon = targetUser.gender === 'Male' ? '👔' : targetUser.gender === 'Female' ? '👗' : '🧒';
                const vipBadge = targetUser.isVip ? ' 👑' : '';
                let profile = `${genderIcon} *${targetUser.name}${vipBadge}*, ${targetUser.age || '?'}\n`;
                profile += `📍 ${targetUser.location || 'Unknown'}\n`;
                profile += `💘 Looking for: ${targetUser.lookingFor || 'Everyone'}\n`;
                if (targetUser.bio) profile += `\n💬 ${targetUser.bio}\n`;

                // VIP viewers also get a Chat button
                const actionRow = viewerIsVip
                    ? [
                        { text: '❤️ Like Back', callback_data: `like_${targetId}` },
                        { text: '💬 Chat', callback_data: `chat_gate_${targetId}` }
                      ]
                    : [
                        { text: '❤️ Like Back', callback_data: `like_${targetId}` }
                      ];

                const buttons = [
                    actionRow,
                    [{ text: '🔙 Back to Hub', callback_data: 'likesyou_overview' }]
                ];

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
                bot.sendMessage(chatId, '❌ Failed to load profile.', {
                    reply_markup: { inline_keyboard: [[{ text: '🔙 Back to Hub', callback_data: 'likesyou_overview' }]] }
                });
            }
        }
    });
}

module.exports = { setupLikesCommands };