const axios = require('axios');
const API_BASE = process.env.API_BASE || 'http://localhost:3002';

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

function setupLikesCommands(bot) {
    bot.onText(/\/likesyou/, async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from.id;

        try {
            const res = await axios.get(`${API_BASE}/likes/for/${telegramId}`);
            const likers = res.data.likers;
            const isVip = res.data.isVip;

            if (!likers || likers.length === 0) {
                bot.sendMessage(chatId, '💔 **No one has liked you yet.** Keep your profile updated and browse more to get noticed!');
            } else {
                if (isVip) {
                    let likersMessage = `💖 **Here's Who Liked You** 💖\n\n`;
                    const keyboard = [];
                    likers.forEach(liker => {
                        likersMessage += `• **${liker.name}** (${liker.age}) - ${liker.onlineStatus}\n` +
                            `  *Liked ${getTimeAgo(liker.likedAt)}*\n` +
                            `  📍 ${liker.location}\n` +
                            `  💬 "${liker.bio.substring(0, 50)}..."\n\n`;
                        keyboard.push([{ text: `View ${liker.name}'s Profile`, callback_data: `view_liker_${liker.telegramId}` }]);
                    });
                    keyboard.push([{ text: '🔄 Refresh Likes', callback_data: 'refresh_likes' }]);
                    bot.sendMessage(chatId, likersMessage, {
                        parse_mode: 'Markdown',
                        reply_markup: { inline_keyboard: keyboard }
                    });
                } else {
                    const message = `💖 **You have ${likers.length} new like${likers.length > 1 ? 's' : ''}!**\n\n` +
                        `Upgrade to VIP to see everyone who liked you, including their full profiles and photos.\n\n` +
                        `Here's a sneak peek:\n` +
                        `• You have a like from someone nearby!\n` +
                        `• One of your likers is online right now.\n\n` +
                        `Don't miss out on a potential match!`;
                    bot.sendMessage(chatId, message, {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '💎 Upgrade to VIP to See All Likes', callback_data: 'upgrade_vip_likes' }],
                                [{ text: '🔍 Browse Profiles', callback_data: 'browse_profiles' }]
                            ]
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Error fetching likers:', error.message);
            bot.sendMessage(chatId, '❌ An error occurred while fetching your likes. Please try again later.');
        }
    });
}

module.exports = { setupLikesCommands };