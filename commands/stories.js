const axios = require('axios');
const https = require('https');
const FormData = require('form-data');
const { API_BASE } = require('../config');
const { MAIN_KEYBOARD } = require('../keyboard');

const REACTIONS = ['❤️', '😍', '😂', '😮', '👏'];

// ── Stories menu ──────────────────────────────────────────────────────────────
async function sendStoriesMenu(bot, chatId, telegramId, User) {
    const user = await User.findOne({ telegramId: String(telegramId) }).lean();
    if (!user) return;

    const now = new Date();
    const activeCount = (user.stories || []).filter(s => new Date(s.expiresAt) > now).length;

    await bot.sendMessage(chatId,
        `📱 *Stories*\n\nShare moments with everyone on KissuBot! Stories expire after *24 hours*.\n\n` +
        `📊 You have *${activeCount}* active stor${activeCount === 1 ? 'y' : 'ies'}.`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📸 Post a Story', callback_data: 'stories_post' }],
                    [{ text: '🌍 Browse Stories', callback_data: 'stories_browse_0' }],
                    [{ text: '📋 My Stories', callback_data: 'stories_mine' }],
                    [{ text: '📊 Analytics', callback_data: 'stories_analytics' }]
                ]
            }
        }
    );
}

// ── Browse stories ────────────────────────────────────────────────────────────
async function browseSingleStory(bot, chatId, telegramId, stories, index) {
    if (!stories.length) {
        return bot.sendMessage(chatId, '😴 No active stories right now. Check back later!', {
            reply_markup: { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'stories_menu' }]] }
        });
    }

    const story = stories[index];
    const caption =
        `👤 *${story.userName || 'Someone'}*\n` +
        (story.caption ? `💬 ${story.caption}\n` : '') +
        `👁 ${(story.views || []).length} views  •  Story ${index + 1}/${stories.length}`;

    const navRow = [];
    if (index > 0) navRow.push({ text: '⬅️ Prev', callback_data: `stories_browse_${index - 1}` });
    if (index < stories.length - 1) navRow.push({ text: 'Next ➡️', callback_data: `stories_browse_${index + 1}` });

    const keyboard = {
        inline_keyboard: [
            REACTIONS.map(r => ({ text: r, callback_data: `story_react_${story._id}_${story.userId}_${encodeURIComponent(r)}` })),
            [{ text: '💬 Message', callback_data: `story_msg_${story._id}_${story.userId}` }],
            navRow.length ? navRow : [],
            [{ text: '🔙 Back', callback_data: 'stories_menu' }]
        ].filter(row => row.length)
    };

    try {
        await bot.sendPhoto(chatId, story.mediaUrl, { caption, parse_mode: 'Markdown', reply_markup: keyboard });
    } catch {
        await bot.sendMessage(chatId, caption, { parse_mode: 'Markdown', reply_markup: keyboard });
    }

    // Mark as viewed
    await axios.post(`${API_BASE}/stories/view/${story._id}`, { viewerId: String(telegramId) }).catch(() => {});
}

// ── My stories ────────────────────────────────────────────────────────────────
async function sendMyStories(bot, chatId, telegramId, User) {
    const user = await User.findOne({ telegramId: String(telegramId) }).lean();
    const now = new Date();
    const active = (user.stories || []).filter(s => new Date(s.expiresAt) > now);

    if (!active.length) {
        return bot.sendMessage(chatId,
            '📋 You have no active stories.\n\nPost one and let people see what you\'re up to! 📸',
            { reply_markup: { inline_keyboard: [[{ text: '📸 Post a Story', callback_data: 'stories_post' }, { text: '🔙 Back', callback_data: 'stories_menu' }]] } }
        );
    }

    for (const story of active) {
        const expiresIn = Math.max(0, Math.round((new Date(story.expiresAt) - now) / 3600000));
        const cap = `${story.caption ? `💬 ${story.caption}\n` : ''}👁 ${(story.views || []).length} views  •  ⏰ Expires in ~${expiresIn}h`;
        try {
            await bot.sendPhoto(chatId, story.mediaUrl, {
                caption: cap,
                reply_markup: { inline_keyboard: [[{ text: '🗑️ Delete', callback_data: `story_delete_${story._id}` }]] }
            });
        } catch {
            await bot.sendMessage(chatId, cap, {
                reply_markup: { inline_keyboard: [[{ text: '🗑️ Delete', callback_data: `story_delete_${story._id}` }]] }
            });
        }
    }

    await bot.sendMessage(chatId, `You have *${active.length}* active stor${active.length === 1 ? 'y' : 'ies'}.`, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'stories_menu' }]] }
    });
}

// ── Analytics ─────────────────────────────────────────────────────────────────
async function sendAnalytics(bot, chatId, telegramId) {
    try {
        const res = await axios.get(`${API_BASE}/stories/analytics/${telegramId}`);
        const d = res.data;
        await bot.sendMessage(chatId,
            `📊 *Stories Analytics*\n\n` +
            `📱 Total stories: *${d.totalStories || 0}*\n` +
            `👁 Total views: *${d.totalViews || 0}*\n` +
            `📈 Avg views/story: *${d.avgViews || 0}*\n` +
            `🏆 Best story: *${d.bestStoryViews || 0} views*\n` +
            `💡 Engagement rate: *${d.engagementRate || 0}%*`,
            {
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'stories_menu' }]] }
            }
        );
    } catch {
        bot.sendMessage(chatId, '❌ Could not load analytics right now.', {
            reply_markup: { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'stories_menu' }]] }
        });
    }
}

// ── Setup ─────────────────────────────────────────────────────────────────────
function setupStoriesCommands(bot, User, userStates) {

    // /stories command
    bot.onText(/\/stories/, async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from.id;
        const user = await User.findOne({ telegramId: String(telegramId) }).lean();
        if (!user || !user.profileCompleted) {
            return bot.sendMessage(chatId, '❌ Complete your profile first before posting stories.', { reply_markup: MAIN_KEYBOARD });
        }
        await sendStoriesMenu(bot, chatId, telegramId, User);
    });

    // Photo handler — catch story photos from users in awaitingStory state
    bot.on('photo', async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = String(msg.from.id);
        const state = userStates.get(telegramId);
        if (!state || !state.awaitingStory) return;

        userStates.delete(telegramId);

        const processingMsg = await bot.sendMessage(chatId, '⏳ Uploading your story...');

        try {
            const fileId = msg.photo[msg.photo.length - 1].file_id;
            const caption = state.storyCaption || '';

            // Upload to Cloudinary
            const file = await bot.getFile(fileId);
            const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

            const photoBuffer = await new Promise((resolve, reject) => {
                https.get(fileUrl, (res) => {
                    const chunks = [];
                    res.on('data', chunk => chunks.push(chunk));
                    res.on('end', () => resolve(Buffer.concat(chunks)));
                    res.on('error', reject);
                });
            });

            const form = new FormData();
            form.append('image', photoBuffer, { filename: 'story.jpg', contentType: 'image/jpeg' });

            const uploadRes = await axios.post(`${API_BASE}/stories/upload/${telegramId}`, form, {
                headers: form.getHeaders()
            });

            if (!uploadRes.data || !uploadRes.data.imageUrl) throw new Error('Upload failed');
            const imageUrl = uploadRes.data.imageUrl;

            // Post to stories API
            await axios.post(`${API_BASE}/stories/post/${telegramId}`, {
                mediaUrl: imageUrl,
                mediaType: 'photo',
                caption
            });

            await bot.deleteMessage(chatId, processingMsg.message_id).catch(() => {});
            await bot.sendMessage(chatId,
                `✅ *Story posted!* 📸\n\nYour story is live for the next 24 hours. Everyone on KissuBot can see it!`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: [[{ text: '📋 My Stories', callback_data: 'stories_mine' }, { text: '🔙 Menu', callback_data: 'stories_menu' }]] }
                }
            );
        } catch (err) {
            console.error('[STORIES] Upload error:', err.message);
            await bot.deleteMessage(chatId, processingMsg.message_id).catch(() => {});
            bot.sendMessage(chatId, '❌ Failed to post story. Please try again.', { reply_markup: MAIN_KEYBOARD });
        }
    });

    // Caption handler — optional text before sending photo
    bot.on('message', async (msg) => {
        if (!msg.text || msg.text.startsWith('/')) return;
        const telegramId = String(msg.from.id);
        const state = userStates.get(telegramId);
        if (!state || state.awaitingStoryCaption !== true) return;

        userStates.set(telegramId, { awaitingStory: true, storyCaption: msg.text.slice(0, 200) });
        bot.sendMessage(msg.chat.id, `✏️ Caption saved: *"${msg.text.slice(0, 60)}${msg.text.length > 60 ? '…' : ''}"*\n\nNow send your photo! 📸`, {
            parse_mode: 'Markdown'
        });
    });

    // Callback queries
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const telegramId = String(query.from.id);
        const data = query.data;

        // Stories menu
        if (data === 'stories_menu') {
            bot.answerCallbackQuery(query.id);
            return sendStoriesMenu(bot, chatId, telegramId, User);
        }

        // Post story
        if (data === 'stories_post') {
            bot.answerCallbackQuery(query.id);
            userStates.set(telegramId, { awaitingStoryCaption: true });
            return bot.sendMessage(chatId,
                `📸 *Post a Story*\n\nOptionally send a caption first (or skip by sending your photo directly).\n\n💡 Type a caption or just send a photo now:`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: [[{ text: '⏭️ Skip caption', callback_data: 'stories_skip_caption' }]] }
                }
            );
        }

        // Skip caption
        if (data === 'stories_skip_caption') {
            bot.answerCallbackQuery(query.id);
            userStates.set(telegramId, { awaitingStory: true, storyCaption: '' });
            return bot.sendMessage(chatId, '📸 Send your photo now!');
        }

        // Browse stories
        if (data.startsWith('stories_browse_')) {
            bot.answerCallbackQuery(query.id);
            const index = parseInt(data.split('_')[2]) || 0;
            try {
                const res = await axios.get(`${API_BASE}/stories/recent/${telegramId}`);
                const stories = res.data.stories || [];
                return browseSingleStory(bot, chatId, telegramId, stories, Math.min(index, stories.length - 1));
            } catch {
                return bot.sendMessage(chatId, '❌ Could not load stories. Try again later.');
            }
        }

        // My stories
        if (data === 'stories_mine') {
            bot.answerCallbackQuery(query.id);
            return sendMyStories(bot, chatId, telegramId, User);
        }

        // Analytics
        if (data === 'stories_analytics') {
            bot.answerCallbackQuery(query.id);
            return sendAnalytics(bot, chatId, telegramId);
        }

        // React to story
        if (data.startsWith('story_react_')) {
            bot.answerCallbackQuery(query.id, { text: 'Reaction sent! ✨' });
            const parts = data.split('_');
            const storyId = parts[2];
            const ownerId = parts[3];
            const reaction = decodeURIComponent(parts[4]);
            await axios.post(`${API_BASE}/stories/react`, {
                storyId, storyOwnerId: ownerId, fromUserId: telegramId, reaction
            }).catch(() => {});
            return;
        }

        // Message story owner
        if (data.startsWith('story_msg_')) {
            bot.answerCallbackQuery(query.id);
            const parts = data.split('_');
            const storyId = parts[2];
            const ownerId = parts[3];
            userStates.set(telegramId, { awaitingStoryMessage: true, storyId, storyOwnerId: ownerId });
            return bot.sendMessage(chatId, '💬 Type your anonymous message for this story:');
        }

        // Delete story
        if (data.startsWith('story_delete_')) {
            bot.answerCallbackQuery(query.id);
            const storyId = data.replace('story_delete_', '');
            try {
                await axios.delete(`${API_BASE}/stories/${telegramId}/${storyId}`);
                bot.sendMessage(chatId, '🗑️ Story deleted.', {
                    reply_markup: { inline_keyboard: [[{ text: '📋 My Stories', callback_data: 'stories_mine' }]] }
                });
            } catch {
                bot.sendMessage(chatId, '❌ Could not delete story.');
            }
            return;
        }
    });

    // Anonymous story message handler
    bot.on('message', async (msg) => {
        if (!msg.text) return;
        const telegramId = String(msg.from.id);
        const state = userStates.get(telegramId);
        if (!state || !state.awaitingStoryMessage) return;

        userStates.delete(telegramId);
        const { storyId, storyOwnerId } = state;

        try {
            await axios.post(`${API_BASE}/stories/message`, {
                storyId, storyOwnerId, fromUserId: telegramId,
                message: msg.text.slice(0, 500), isAnonymous: true
            });
            bot.sendMessage(msg.chat.id, '✅ Anonymous message sent!', {
                reply_markup: { inline_keyboard: [[{ text: '🌍 Browse More', callback_data: 'stories_browse_0' }]] }
            });
        } catch {
            bot.sendMessage(msg.chat.id, '❌ Could not send message. Try again.');
        }
    });
}

module.exports = { setupStoriesCommands };
