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
                [{ text: '🔄 Refresh', callback_data: 'likesyou_overview' }],
                [{ text: '🔙 Back to Main Menu', callback_data: 'back_to_main' }]
            ];

            bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: keyboard }
            });
        } else if (section === 'regular') {
            showLikerCard(bot, chatId, telegramId, User, regularLikes, 'regular', offset, isVip, isFemale);
        } else if (section === 'super') {
            showLikerCard(bot, chatId, telegramId, User, superLikes, 'super', offset, isVip, isFemale);
        } else if (section === 'gifts') {
            showGiftsList(bot, chatId, gifts);
        }
    } catch (error) {
        console.error('Error in likesyou hub:', error.message);
        bot.sendMessage(chatId, '❌ An error occurred. Please try again later.');
    }
}

async function showLikerCard(bot, chatId, viewerTelegramId, User, likes, type, offset, isVip, isFemale) {
    const canViewProfile = isVip || isFemale;
    const canSeeAll = isVip;
    const typeKey = type === 'super' ? 's' : 'r';
    const badge = type === 'super' ? '⭐' : '💕';

    const sortedLikes = [...likes].sort((a, b) => new Date(b.lastActive || 0) - new Date(a.lastActive || 0));
    const visibleLikes = canSeeAll ? sortedLikes : sortedLikes.slice(0, 10);

    if (visibleLikes.length === 0) {
        const emptyMsg = type === 'super'
            ? `⭐ *No Super Likes Yet*\n\nKeep your profile updated and someone special will super like you soon! 🚀`
            : `💕 *No Likes Yet*\n\nKeep browsing and update your profile to get noticed! 💪`;
        return bot.sendMessage(chatId, emptyMsg, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '🔙 Back to Hub', callback_data: 'likesyou_overview' }]] }
        });
    }

    if (offset >= visibleLikes.length) {
        const lockedCount = !canSeeAll ? Math.max(0, sortedLikes.length - 10) : 0;
        let doneText = `${badge} *All caught up!*\n\nYou've reviewed all ${visibleLikes.length} ${type === 'super' ? 'super ' : ''}like${visibleLikes.length !== 1 ? 's' : ''}. 🎉`;
        const doneRows = [];
        if (lockedCount > 0) {
            doneText += `\n\n🔒 *${lockedCount} more likes hidden* — Upgrade VIP to unlock!`;
            doneRows.push([{ text: '👑 Unlock All with VIP', callback_data: 'manage_vip' }]);
        }
        doneRows.push([{ text: `� Start Over`, callback_data: `lyc_${typeKey}_0` }]);
        doneRows.push([{ text: '� Back to Hub', callback_data: 'likesyou_overview' }]);
        return bot.sendMessage(chatId, doneText, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: doneRows }
        });
    }

    const liker = visibleLikes[offset];
    const name = liker.name || 'Unknown';
    const age = liker.age ? `, ${liker.age}` : '';
    const location = liker.location || 'Unknown location';
    const bio = liker.bio ? liker.bio.substring(0, 80) + (liker.bio.length > 80 ? '...' : '') : null;
    const onlineStatus = liker.isOnline ? '🟢 Online' : liker.lastActive ? `⏰ ${getTimeAgo(liker.lastActive)}` : '';
    const vipBadge = liker.isVip ? ' 👑' : '';
    const superBadge = type === 'super' ? '\n⭐ *Super Liked you!*' : '';
    const counter = `_${offset + 1} of ${visibleLikes.length}_`;

    let card = `${badge} ${counter}\n\n`;
    card += `*${name}${age}*${vipBadge}\n`;
    card += `📍 ${location}\n`;
    if (onlineStatus) card += `${onlineStatus}\n`;
    if (bio) card += `\n💬 _"${bio}"_\n`;
    card += superBadge;

    const nextOffset = offset + 1;
    const buttons = [];

    if (canViewProfile) {
        buttons.push([
            { text: '❤️ Like Back', callback_data: `lylb_${typeKey}_${nextOffset}_${liker.telegramId}` },
            { text: '❌ Pass',      callback_data: `lyps_${typeKey}_${nextOffset}` }
        ]);
        buttons.push([{ text: '� View Profile', callback_data: `lyvw_${typeKey}_${offset}_${liker.telegramId}` }]);
    } else {
        buttons.push([
            { text: '🔒 Like Back (VIP)', callback_data: 'manage_vip' },
            { text: '❌ Pass',            callback_data: `lyps_${typeKey}_${nextOffset}` }
        ]);
        buttons.push([{ text: '🔒 View Profile (VIP)', callback_data: 'manage_vip' }]);
    }

    if (nextOffset < visibleLikes.length) {
        buttons.push([{ text: `⏭ Skip to Next (${visibleLikes.length - offset - 1} left)`, callback_data: `lyps_${typeKey}_${nextOffset}` }]);
    }
    buttons.push([{ text: '🔙 Back to Hub', callback_data: 'likesyou_overview' }]);

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

// ── Like-back helper: records like, checks mutual, creates match if so ──────
async function performLikeBack(bot, chatId, viewerTelegramId, targetTelegramId, User) {
    try {
        const [viewer, target] = await Promise.all([
            User.findOne({ telegramId: String(viewerTelegramId) }),
            User.findOne({ telegramId: String(targetTelegramId) })
        ]);
        if (!viewer || !target) return false;

        // Record the like (viewer → target)
        const isNewLike = !(target.likes || []).includes(String(viewerTelegramId));
        if (isNewLike) {
            await User.findOneAndUpdate(
                { telegramId: String(targetTelegramId) },
                { $push: { likes: String(viewerTelegramId) } }
            );
        }

        // Check mutual — target already liked viewer?
        const isMutual = (viewer.likes || []).includes(String(targetTelegramId));
        if (isMutual) {
            const alreadyMatched = (viewer.matches || []).some(m => String(m.userId) === String(targetTelegramId));
            if (!alreadyMatched) {
                const now = new Date();
                await Promise.all([
                    User.findOneAndUpdate(
                        { telegramId: String(viewerTelegramId) },
                        { $push: { matches: { userId: String(targetTelegramId), matchedAt: now } } }
                    ),
                    User.findOneAndUpdate(
                        { telegramId: String(targetTelegramId) },
                        { $push: { matches: { userId: String(viewerTelegramId), matchedAt: now } } }
                    )
                ]);

                // Notify the target
                const starters = [
                    'Ask about their favourite travel destination 🌍',
                    'Comment on something from their bio 💬',
                    'Ask what they’re looking for 💕',
                    'Share a fun fact about yourself ✨',
                    'Ask about their weekend plans 🎉'
                ];
                const starter = starters[Math.floor(Math.random() * starters.length)];
                bot.sendMessage(String(targetTelegramId),
                    `🎉💖 *IT\'S A MATCH!* 💖🎉\n\n*${viewer.name}* liked you back!\n\n💡 *Starter:* ${starter}`,
                    { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [
                        [{ text: '💬 Start Chatting', callback_data: `chat_gate_${viewerTelegramId}` }]
                    ]}}
                ).catch(() => {});
            }
            return 'match';
        }
        return 'liked';
    } catch (err) {
        console.error('[LIKE BACK]', err);
        return false;
    }
}

function setupLikesCommands(bot, User) {
    bot.onText(/\/likesyou/, async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from.id;
        await showLikesYouHub(bot, chatId, telegramId, User, 'overview');
    });

    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const telegramId = query.from.id;
        const data = query.data;

        // ── Hub navigation ────────────────────────────────────────────────
        if (data === 'back_to_main') {
            bot.answerCallbackQuery(query.id);
            return bot.sendMessage(chatId, '🏠 Main Menu', { reply_markup: MAIN_KEYBOARD });

        } else if (data === 'likesyou_overview' || data === 'view_likes' || data === 'likes_you_hub') {
            bot.answerCallbackQuery(query.id);
            await bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
            await showLikesYouHub(bot, chatId, telegramId, User, 'overview');

        } else if (data === 'likesyou_regular') {
            bot.answerCallbackQuery(query.id);
            await bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
            await showLikesYouHub(bot, chatId, telegramId, User, 'regular', 0);

        } else if (data === 'likesyou_super') {
            bot.answerCallbackQuery(query.id);
            await bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
            await showLikesYouHub(bot, chatId, telegramId, User, 'super', 0);

        } else if (data === 'likesyou_gifts') {
            bot.answerCallbackQuery(query.id);
            await bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
            await showLikesYouHub(bot, chatId, telegramId, User, 'gifts');

        // ── Card navigation: lyc_{r|s}_{offset} ──────────────────────────
        } else if (data.startsWith('lyc_')) {
            bot.answerCallbackQuery(query.id);
            const parts = data.split('_'); // ['lyc', 'r'|'s', offset]
            const type = parts[1] === 's' ? 'super' : 'regular';
            const offset = parseInt(parts[2]) || 0;
            await showLikesYouHub(bot, chatId, telegramId, User, type, offset);

        // ── Pass: lyps_{r|s}_{nextOffset} ────────────────────────────────
        } else if (data.startsWith('lyps_')) {
            bot.answerCallbackQuery(query.id, { text: '⏭ Skipped' });
            const parts = data.split('_'); // ['lyps', 'r'|'s', nextOffset]
            const type = parts[1] === 's' ? 'super' : 'regular';
            const offset = parseInt(parts[2]) || 0;
            await bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
            await showLikesYouHub(bot, chatId, telegramId, User, type, offset);

        // ── Like back: lylb_{r|s}_{nextOffset}_{targetId} ────────────────
        } else if (data.startsWith('lylb_')) {
            const parts = data.split('_'); // ['lylb', 'r'|'s', nextOffset, targetId]
            const type = parts[1] === 's' ? 'super' : 'regular';
            const nextOffset = parseInt(parts[2]) || 0;
            const targetId = parts[3];

            const result = await performLikeBack(bot, chatId, telegramId, targetId, User);
            if (result === 'match') {
                bot.answerCallbackQuery(query.id, { text: '🎉 It\'s a match!' });
                await bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
                const target = await User.findOne({ telegramId: String(targetId) });
                const viewerUser = await User.findOne({ telegramId: String(telegramId) });
                const starters = ['Ask about their favourite travel destination 🌍','Comment on their bio 💬','Ask what they’re looking for 💕','Share a fun fact about yourself ✨','Ask about their weekend plans 🎉'];
                const starter = starters[Math.floor(Math.random() * starters.length)];
                const fromPhoto = (viewerUser?.photos || [])[0];
                const toPhoto = (target?.photos || [])[0];
                if (fromPhoto && toPhoto) {
                    await bot.sendMediaGroup(chatId, [
                        { type: 'photo', media: fromPhoto, caption: '❤️' },
                        { type: 'photo', media: toPhoto, caption: '❤️' }
                    ]).catch(() => {});
                }
                await bot.sendMessage(chatId,
                    `🎉💖 *IT'S A MATCH!* 💖🎉\n\nYou and *${target?.name || 'them'}* liked each other!\n\n💡 *Starter:* ${starter}`,
                    { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [
                        [{ text: '💬 Start Chatting', callback_data: `chat_gate_${targetId}` }],
                        [{ text: '➡️ Next Profile', callback_data: `lyc_${type === 'super' ? 's' : 'r'}_${nextOffset}` }],
                        [{ text: '🔙 Back to Hub', callback_data: 'likesyou_overview' }]
                    ]}}
                );
            } else if (result === 'liked') {
                bot.answerCallbackQuery(query.id, { text: '❤️ Liked back!' });
                await bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
                await showLikesYouHub(bot, chatId, telegramId, User, type, nextOffset);
            } else {
                bot.answerCallbackQuery(query.id, { text: '❌ Error, try again' });
            }

        // ── View full profile: lyvw_{r|s}_{offset}_{targetId} ────────────
        } else if (data.startsWith('lyvw_')) {
            bot.answerCallbackQuery(query.id);
            const parts = data.split('_'); // ['lyvw', 'r'|'s', offset, targetId]
            const type = parts[1] === 's' ? 'super' : 'regular';
            const offset = parseInt(parts[2]) || 0;
            const targetId = parts[3];
            try {
                const [viewerUser, targetUser] = await Promise.all([
                    User.findOne({ telegramId: String(telegramId) }),
                    User.findOne({ telegramId: String(targetId) })
                ]);
                if (!targetUser) return bot.sendMessage(chatId, '❌ User not found.');

                const viewerIsVip = viewerUser?.isVip || false;
                const viewerIsFemale = (viewerUser?.gender || '').toLowerCase() === 'female';
                if (!viewerIsVip && !viewerIsFemale) {
                    return bot.sendMessage(chatId,
                        `🔒 *VIP Required*\n\nUpgrade to view full profiles.`,
                        { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [
                            [{ text: '👑 Upgrade to VIP', callback_data: 'manage_vip' }],
                            [{ text: '🔙 Back', callback_data: `lyc_${type === 'super' ? 's' : 'r'}_${offset}` }]
                        ]}}
                    );
                }

                const genderIcon = targetUser.gender === 'Male' ? '👔' : targetUser.gender === 'Female' ? '👗' : '🧒';
                const vipBadge = targetUser.isVip ? ' 👑' : '';
                let profile = `${genderIcon} *${targetUser.name}${vipBadge}*, ${targetUser.age || '?'}\n`;
                profile += `📍 ${targetUser.location || 'Unknown'}\n`;
                profile += `💘 Looking for: ${targetUser.lookingFor || 'Everyone'}\n`;
                if (targetUser.bio) profile += `\n💬 ${targetUser.bio}\n`;

                const nextOffset = offset + 1;
                const typeKey = type === 'super' ? 's' : 'r';
                const actionButtons = [
                    [{ text: '❤️ Like Back', callback_data: `lylb_${typeKey}_${nextOffset}_${targetId}` },
                     { text: '❌ Pass',      callback_data: `lyps_${typeKey}_${nextOffset}` }]
                ];
                if (viewerIsVip) {
                    actionButtons.push([{ text: '💬 Chat', callback_data: `chat_gate_${targetId}` }]);
                }
                actionButtons.push([{ text: '⬅️ Back to Card', callback_data: `lyc_${typeKey}_${offset}` }]);

                if (targetUser.photos && targetUser.photos.length > 0) {
                    await bot.sendPhoto(chatId, targetUser.photos[0], {
                        caption: profile, parse_mode: 'Markdown',
                        reply_markup: { inline_keyboard: actionButtons }
                    }).catch(() => bot.sendMessage(chatId, profile, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: actionButtons } }));
                } else {
                    await bot.sendMessage(chatId, profile, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: actionButtons } });
                }
            } catch (err) {
                console.error('[LYVW]', err);
                bot.sendMessage(chatId, '❌ Failed to load profile.');
            }

        // ── Legacy view_liker_ ────────────────────────────────────────────
        } else if (data.startsWith('view_liker_')) {
            bot.answerCallbackQuery(query.id);
            const targetId = data.replace('view_liker_', '');
            try {
                const [viewerUser, targetUser] = await Promise.all([
                    User.findOne({ telegramId: String(telegramId) }),
                    User.findOne({ telegramId: String(targetId) })
                ]);
                if (!targetUser) return bot.sendMessage(chatId, '❌ User not found.');
                const viewerIsVip = viewerUser?.isVip || false;
                const viewerIsFemale = (viewerUser?.gender || '').toLowerCase() === 'female';
                if (!viewerIsVip && !viewerIsFemale) {
                    return bot.sendMessage(chatId,
                        `🔒 *Profile Locked*\n\nUpgrade to VIP to view full profiles.`,
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
                const actionRow = viewerIsVip
                    ? [{ text: '❤️ Like Back', callback_data: `lylb_r_0_${targetId}` }, { text: '💬 Chat', callback_data: `chat_gate_${targetId}` }]
                    : [{ text: '❤️ Like Back', callback_data: `lylb_r_0_${targetId}` }];
                const buttons = [actionRow, [{ text: '🔙 Back to Hub', callback_data: 'likesyou_overview' }]];
                if (targetUser.photos && targetUser.photos.length > 0) {
                    await bot.sendPhoto(chatId, targetUser.photos[0], {
                        caption: profile, parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons }
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