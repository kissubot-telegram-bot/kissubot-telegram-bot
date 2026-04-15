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

async function showLikesYouHub(bot, chatId, telegramId, section = 'overview') {
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
            // Main hub with stats and navigation
            let message = `� **LIKES YOU HUB** 💖\n\n`;
            message += `📊 **Your Stats:**\n`;
            message += `• 💕 Regular Likes: ${regularLikes.length}\n`;
            message += `• ⭐ Super Likes: ${superLikes.length}\n`;
            message += `• 🎁 Gifts Received: ${gifts.length}\n\n`;
            message += `👇 **Choose a section to explore:**`;
            
            const keyboard = [
                [{ text: `💕 Regular Likes (${regularLikes.length})`, callback_data: 'likesyou_regular' }],
                [{ text: `⭐ Super Likes (${superLikes.length})`, callback_data: 'likesyou_super' }],
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

function showLikesList(bot, chatId, likes, title, isSuperLike) {
    if (likes.length === 0) {
        const emptyMsg = isSuperLike 
            ? '⭐ **No Super Likes Yet**\n\nKeep your profile amazing and someone special will super like you soon! 🚀'
            : '💕 **No Regular Likes Yet**\n\nKeep browsing and updating your profile to get noticed! 💪';
        
        bot.sendMessage(chatId, emptyMsg, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔙 Back to Hub', callback_data: 'likesyou_overview' }]
                ]
            }
        });
        return;
    }
    
    let message = `${title}\n\n`;
    message += `Total: ${likes.length}\n\n`;
    
    const keyboard = [];
    const sortedLikes = likes.sort((a, b) => new Date(b.likedAt) - new Date(a.likedAt));
    
    sortedLikes.slice(0, 10).forEach(liker => {
        const onlineStatus = liker.isOnline ? '🟢 Online' : getTimeAgo(liker.lastActive || liker.likedAt);
        const badge = isSuperLike ? '⭐ ' : '';
        
        message += `${badge}**${liker.name}** (${liker.age})\n` +
            `  ${onlineStatus}\n` +
            `  *Liked ${getTimeAgo(liker.likedAt)}*\n` +
            `  📍 ${liker.location}\n` +
            `  💬 "${liker.bio ? liker.bio.substring(0, 50) + '...' : 'No bio'}"\n\n`;
        
        const buttonText = isSuperLike ? `⭐ View ${liker.name}` : `View ${liker.name}`;
        keyboard.push([{ text: buttonText, callback_data: `view_liker_${liker.telegramId}` }]);
    });
    
    if (likes.length > 10) {
        message += `_...and ${likes.length - 10} more!_\n\n`;
    }
    
    keyboard.push([{ text: '� Back to Hub', callback_data: 'likesyou_overview' }]);
    
    bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
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
        await showLikesYouHub(bot, chatId, telegramId, 'overview');
    });
    
    // Callback handlers for navigation
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const telegramId = query.from.id;
        const data = query.data;
        
        if (data === 'likesyou_overview') {
            await bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
            await showLikesYouHub(bot, chatId, telegramId, 'overview');
            bot.answerCallbackQuery(query.id);
        } else if (data === 'likesyou_regular') {
            await bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
            await showLikesYouHub(bot, chatId, telegramId, 'regular');
            bot.answerCallbackQuery(query.id);
        } else if (data === 'likesyou_super') {
            await bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
            await showLikesYouHub(bot, chatId, telegramId, 'super');
            bot.answerCallbackQuery(query.id);
        } else if (data === 'likesyou_gifts') {
            await bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
            await showLikesYouHub(bot, chatId, telegramId, 'gifts');
            bot.answerCallbackQuery(query.id);
        } else if (data === 'view_likes') {
            // From superlike notification
            await showLikesYouHub(bot, chatId, telegramId, 'overview');
            bot.answerCallbackQuery(query.id);
        }
    });
}

module.exports = { setupLikesCommands };