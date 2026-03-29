const axios = require('axios');
const API_BASE = process.env.API_BASE || 'http://localhost:3002';
const { requireLikesAccess } = require('./genderGate');

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

function setupLikesCommands(bot, User) {
    bot.onText(/\/likesyou/, async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from.id;

        try {
            if (!(await requireLikesAccess(bot, chatId, String(telegramId), User))) return;
            const res = await axios.get(`${API_BASE}/likes/for/${telegramId}`);
            const likers = res.data.likers;
            const isVip = res.data.isVip;

            if (!likers || likers.length === 0) {
                bot.sendMessage(chatId, '💔 **No one has liked you yet.** Keep your profile updated and browse more to get noticed!');
            } else {
                let likersMessage = `💖 **Here's Who Liked You** 💖\n\n`;
                const keyboard = [];
                likers.forEach(liker => {
                    likersMessage += `• **${liker.name}** (${liker.age}) - ${liker.onlineStatus}\n` +
                        `  *Liked ${getTimeAgo(liker.likedAt)}*\n` +
                        `  📍 ${liker.location}\n` +
                        `  💬 "${liker.bio ? liker.bio.substring(0, 50) + '...' : 'No bio'}"\n\n`;
                    keyboard.push([{ text: `View ${liker.name}'s Profile`, callback_data: `view_liker_${liker.telegramId}` }]);
                });
                keyboard.push([{ text: '🔄 Refresh Likes', callback_data: 'refresh_likes' }]);
                bot.sendMessage(chatId, likersMessage, {
                    parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: keyboard }
                });
            }
        } catch (error) {
            console.error('Error fetching likers:', error.message);
            bot.sendMessage(chatId, '❌ An error occurred while fetching your likes. Please try again later.');
        }
    });
}

module.exports = { setupLikesCommands };