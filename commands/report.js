/**
 * report.js — Trust & Safety: Report + Block system
 *
 * Report flow:
 *   1. User taps 🚩 Report on a profile card → reason picker appears
 *   2. User selects reason → asked for optional screenshot
 *   3. User sends photo OR taps "Skip Screenshot" → Report saved → next profile loads
 *
 * Block flow:
 *   1. User taps ⛔ Block → user added to blocked[] on both sides
 *   2. Mutual like/match data removed
 *   3. Confirmation shown → next profile loads immediately
 */

const { invalidateUserCache } = require('./auth');
const { MAIN_KEYBOARD, REPORT_REASONS_KEYBOARD, SKIP_SCREENSHOT_KEYBOARD } = require('../keyboard');

const GENERAL_REPORT_CALLBACKS = ['report_user', 'report_content', 'report_bug'];

const REPORT_REASONS = [
    { label: '🔞 Inappropriate', key: 'inappropriate' },
    { label: '🤖 Spam / Bot', key: 'spam' },
    { label: '🎭 Fake Profile', key: 'fake' },
    { label: '😡 Harassment', key: 'harassment' },
    { label: '📝 Other Reason', key: 'other' },
];

const REASON_KEY_MAP = {
    '🔞 Inappropriate': 'inappropriate',
    '🤖 Spam / Bot':    'spam',
    '🎭 Fake Profile':  'fake',
    '😡 Harassment':    'harassment',
    '📝 Other Reason':  'other',
};

function setupReportCommands(bot, userStates, User, Report, browseNext) {

    // ── 🚩 REPORT: Show reason picker ───────────────────────────────────
    bot.on('callback_query', async (query) => {
        const data = query.data;
        if (!data.startsWith('report_')) return;
        if (data.startsWith('report_reason_') || data.startsWith('report_skip_')) return;
        if (GENERAL_REPORT_CALLBACKS.includes(data)) return;

        const chatId = query.message.chat.id;
        const telegramId = query.from.id;
        const targetId = data.replace('report_', '');

        await bot.answerCallbackQuery(query.id).catch(() => { });

        userStates.set(telegramId, { awaitingReportReason: true, reportTargetId: targetId });

        await bot.sendMessage(chatId,
            `🚩 *Report Profile*\n\nWhy are you reporting this user?\nYou can also block them without reporting.`,
            { parse_mode: 'Markdown', reply_markup: REPORT_REASONS_KEYBOARD }
        );
    });

    // ── 🚩 REPORT: Reason via legacy callback (still supported) ─────────
    bot.on('callback_query', async (query) => {
        const data = query.data;
        if (!data.startsWith('report_reason_')) return;

        const chatId = query.message.chat.id;
        const telegramId = query.from.id;
        const withoutPrefix = data.replace('report_reason_', '');
        const firstUnderscore = withoutPrefix.indexOf('_');
        const reason = withoutPrefix.substring(0, firstUnderscore);
        const targetId = withoutPrefix.substring(firstUnderscore + 1);

        await bot.answerCallbackQuery(query.id).catch(() => { });
        userStates.set(telegramId, { awaitingReportScreenshot: true, pendingReport: { targetId, reason } });

        await bot.sendMessage(chatId,
            `📸 *Optional Screenshot*\n\nSend a screenshot as evidence, or tap *⏭️ Skip Screenshot* to submit now.`,
            { parse_mode: 'Markdown', reply_markup: SKIP_SCREENSHOT_KEYBOARD }
        );
    });

    // ── 🚩 REPORT: Skip screenshot via legacy callback ──────────────────
    bot.on('callback_query', async (query) => {
        const data = query.data;
        if (!data.startsWith('report_skip_')) return;

        const chatId = query.message.chat.id;
        const telegramId = query.from.id;
        await bot.answerCallbackQuery(query.id).catch(() => { });
        const state = userStates.get(telegramId);
        const reason = state?.pendingReport?.reason || 'other';
        const targetId = state?.pendingReport?.targetId || data.replace('report_skip_', '');
        userStates.delete(telegramId);
        await saveReport(bot, chatId, telegramId, targetId, reason, null, User, Report, browseNext);
    });

    // ── 🚩 REPORT: Reply keyboard reason selection & skip ────────────────
    bot.on('message', async (msg) => {
        const text = msg.text;
        if (!text) return;
        const chatId = msg.chat.id;
        const telegramId = msg.from.id;
        const state = userStates.get(telegramId);
        if (!state) return;

        // Handle reason selection
        if (state.awaitingReportReason) {
            if (text === '🔙 Cancel Report') {
                userStates.delete(telegramId);
                bot.sendMessage(chatId, '✅ Report cancelled.', { reply_markup: MAIN_KEYBOARD });
                return;
            }
            if (text === '⛔ Block User') {
                const targetId = state.reportTargetId;
                userStates.delete(telegramId);
                if (targetId) await performBlock(bot, chatId, telegramId, targetId, User, browseNext);
                return;
            }
            const reason = REASON_KEY_MAP[text];
            if (!reason) return;
            const targetId = state.reportTargetId;
            userStates.set(telegramId, { awaitingReportScreenshot: true, pendingReport: { targetId, reason } });
            await bot.sendMessage(chatId,
                `📸 *Optional Screenshot*\n\nSend a screenshot as evidence, or tap *⏭️ Skip Screenshot* to submit now.`,
                { parse_mode: 'Markdown', reply_markup: SKIP_SCREENSHOT_KEYBOARD }
            );
            return;
        }

        // Handle skip screenshot
        if (state.awaitingReportScreenshot && text === '⏭️ Skip Screenshot') {
            const { targetId, reason } = state.pendingReport;
            userStates.delete(telegramId);
            await saveReport(bot, chatId, telegramId, targetId, reason, null, User, Report, browseNext);
            return;
        }

        // Handle cancel during screenshot wait
        if (state.awaitingReportScreenshot && text === '🔙 Cancel Report') {
            userStates.delete(telegramId);
            bot.sendMessage(chatId, '✅ Report cancelled.', { reply_markup: MAIN_KEYBOARD });
            return;
        }
    });

    // ── 🚩 REPORT: Photo received as screenshot ─────────────────────────
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from.id;
        const state = userStates.get(telegramId);

        if (!state || !state.awaitingReportScreenshot) return;
        if (!msg.photo) return; // not a photo — ignore, they'll skip or send one

        const screenshotFileId = msg.photo[msg.photo.length - 1].file_id;
        const { targetId, reason } = state.pendingReport;
        userStates.delete(telegramId);

        await saveReport(bot, chatId, telegramId, targetId, reason, screenshotFileId, User, Report, browseNext);
    });

    // ── ⛔ BLOCK FROM REPORT MENU ────────────────────────────────────
    bot.on('callback_query', async (query) => {
        const data = query.data;
        if (!data.startsWith('block_from_report_')) return;

        const chatId = query.message.chat.id;
        const telegramId = query.from.id;
        const targetId = data.replace('block_from_report_', '');

        await bot.answerCallbackQuery(query.id).catch(() => { });
        await performBlock(bot, chatId, telegramId, targetId, User, browseNext);
    });

    // ── ⛔ BLOCK: Add to blocked list, remove mutual data ─────────────
    bot.on('callback_query', async (query) => {
        const data = query.data;
        if (!data.startsWith('block_')) return;
        if (data.startsWith('block_from_report_')) return;

        const chatId = query.message.chat.id;
        const telegramId = query.from.id;
        const targetId = data.replace('block_', '');

        await bot.answerCallbackQuery(query.id).catch(() => { });
        await performBlock(bot, chatId, telegramId, targetId, User, browseNext);
    });

    // ── 🛡️ ADMIN: /reports command ───────────────────────────────────────
    bot.onText(/\/reports/, async (msg) => {
        const chatId = msg.chat.id;
        const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',').map(s => s.trim());

        if (!ADMIN_IDS.includes(String(msg.from.id))) {
            return bot.sendMessage(chatId, '❌ You do not have permission to view reports.');
        }

        try {
            if (!Report) return bot.sendMessage(chatId, '⚠️ Report tracking not set up yet.');

            const recent = await Report.find({ status: 'pending' })
                .sort({ createdAt: -1 })
                .limit(10);

            if (recent.length === 0) {
                return bot.sendMessage(chatId, '✅ No pending reports!');
            }

            let text = `🚩 **Pending Reports (${recent.length})**\n\n`;
            recent.forEach((r, i) => {
                text += `${i + 1}. Reporter: ${r.reporterId} → Target: ${r.reportedId}\n`;
                text += `   Reason: ${r.reason} | ${new Date(r.createdAt).toLocaleDateString()}\n\n`;
            });

            bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
        } catch (err) {
            bot.sendMessage(chatId, '❌ Failed to load reports.');
        }
    });
}

// ── Helper: block a user ─────────────────────────────────────────────────
async function performBlock(bot, chatId, telegramId, targetId, User, browseNext) {
    try {
        const [blocker, blocked] = await Promise.all([
            User.findOne({ telegramId }),
            User.findOne({ telegramId: targetId })
        ]);

        if (!blocker) return bot.sendMessage(chatId, '❌ Error: user not found.');

        const alreadyBlocked = blocker.blocked && blocker.blocked.some(b => b.userId === String(targetId));
        if (!alreadyBlocked) {
            if (!blocker.blocked) blocker.blocked = [];
            blocker.blocked.push({ userId: String(targetId), blockedAt: new Date() });
        }

        blocker.likes = (blocker.likes || []).filter(id => String(id) !== String(targetId));
        blocker.matches = (blocker.matches || []).filter(m => String(m.userId) !== String(targetId));

        if (blocked) {
            blocked.likes = (blocked.likes || []).filter(id => String(id) !== String(telegramId));
            blocked.matches = (blocked.matches || []).filter(m => String(m.userId) !== String(telegramId));
            await blocked.save().catch(() => { });
        }

        await blocker.save();
        invalidateUserCache(String(telegramId));

        await bot.sendMessage(chatId,
            `⛔ *Blocked.*\n\nYou won't see this person again.`,
            { parse_mode: 'Markdown', reply_markup: MAIN_KEYBOARD }
        );
    } catch (err) {
        console.error('[Block] Error:', err);
        bot.sendMessage(chatId, '❌ Failed to block. Please try again.');
    }
}

// ── Helper: save a report to DB and confirm ─────────────────────────────
async function saveReport(bot, chatId, reporterId, reportedId, reason, screenshotFileId, User, Report, browseNext) {
    try {
        if (Report) {
            await Report.create({
                reporterId: String(reporterId),
                reportedId: String(reportedId),
                reason,
                screenshotFileId: screenshotFileId || null,
                createdAt: new Date(),
                status: 'pending'
            });
        }

        // Increment reportCount on the reported user
        await User.findOneAndUpdate(
            { telegramId: String(reportedId) },
            { $inc: { 'stats.reportCount': 1 } }
        ).catch(() => { });

        await bot.sendMessage(chatId,
            `✅ *Report Submitted*\n\nThank you for keeping KissuBot safe.\nOur team will review this report shortly.`,
            { parse_mode: 'Markdown', reply_markup: MAIN_KEYBOARD }
        );
    } catch (err) {
        console.error('[Report] Save error:', err);
        await bot.sendMessage(chatId, '❌ Failed to submit report. Please try again.');
    }
}

module.exports = { setupReportCommands };
