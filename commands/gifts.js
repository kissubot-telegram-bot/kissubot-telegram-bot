const { invalidateUserCache } = require('./auth');
const { GIFTS_KEYBOARD, GIFTS_KB_BUTTONS, MAIN_KEYBOARD, GIFT_TYPE_KEYBOARD, GIFT_TYPE_KB_BUTTONS, COINS_STORE_KEYBOARD } = require('../keyboard');

const GIFT_KEY_MAP = {
  '🌹 Rose — 5 coins':       { key: 'rose',      coins: 5  },
  '💖 Heart — 10 coins':      { key: 'heart',     coins: 10 },
  '🍫 Chocolate — 15 coins': { key: 'chocolate', coins: 15 },
  '🌺 Flowers — 20 coins':    { key: 'flowers',   coins: 20 },
  '💎 Diamond — 50 coins':    { key: 'diamond',   coins: 50 },
};

const GIFTS = {
  rose:      { name: '🌹 Rose',      coins: 5  },
  heart:     { name: '💖 Heart',     coins: 10 },
  chocolate: { name: '🍫 Chocolate', coins: 15 },
  flowers:   { name: '🌺 Flowers',   coins: 20 },
  diamond:   { name: '💎 Diamond',   coins: 50 },
};

function giftCenterMenu(chatId, bot) {
    bot.sendMessage(chatId,
        `🎁 *Gift Center* ✨\n\n` +
        `Send virtual gifts to your matches and make their day special!\n\n` +
        `🌹 *Rose* — 5 coins\n` +
        `💖 *Heart* — 10 coins\n` +
        `🍫 *Chocolate* — 15 coins\n` +
        `🌺 *Flowers* — 20 coins\n` +
        `💎 *Diamond* — 50 coins\n\n` +
        `_Tap a button below to get started!_`,
        { parse_mode: 'Markdown', reply_markup: GIFTS_KEYBOARD }
    );
}

function setupGiftCommands(bot, User, userStates) {

    // ── /gifts command ────────────────────────────────────────────────────
    bot.onText(/\/gifts/, (msg) => giftCenterMenu(msg.chat.id, bot));

    // ── Gifts Reply Keyboard handler ────────────────────────────────
    bot.on('message', async (msg) => {
        const text = msg.text;
        if (!text || !GIFTS_KB_BUTTONS.includes(text)) return;
        const chatId = msg.chat.id;
        const telegramId = msg.from.id;

        if (text === '🎁 Send a Gift') {
            try {
                const sender = await User.findOne({ telegramId: String(telegramId) });
                if (!sender) return bot.sendMessage(chatId, '❌ User not found.');
                const matchIds = (sender.matches || []).map(m => m.userId);
                if (matchIds.length === 0) {
                    return bot.sendMessage(chatId,
                        '💔 *No matches yet!*\n\nMatch with someone first before sending a gift.',
                        { parse_mode: 'Markdown', reply_markup: MAIN_KEYBOARD }
                    );
                }
                const matchUsers = await User.find({ telegramId: { $in: matchIds } }).select('telegramId name');
                const rows = matchUsers.map((u, i) => [{ text: `${i + 1}. 👤 ${u.name}` }]);
                rows.push([{ text: '🔙 Back to Gifts' }]);
                userStates.set(String(telegramId), { giftFlow: { step: 'pick_recipient', matches: matchUsers.map(u => ({ id: u.telegramId, name: u.name })) } });
                bot.sendMessage(chatId,
                    `🎁 *Send a Gift*\n\n👥 Choose your match:\n\n${matchUsers.map((u, i) => `${i + 1}. *${u.name}*`).join('\n')}`,
                    { parse_mode: 'Markdown', reply_markup: { keyboard: rows, resize_keyboard: true, one_time_keyboard: true } }
                );
            } catch (err) {
                console.error('[Gifts] pick match error:', err);
                bot.sendMessage(chatId, '❌ Failed to load matches. Please try again.');
            }
        } else if (text === '📨 My Sent Gifts') {
            try {
                const allGifts = await User.aggregate([
                    { $unwind: '$gifts' },
                    { $match: { 'gifts.fromUserId': String(telegramId) } },
                    { $sort: { 'gifts.sentAt': -1 } },
                    { $limit: 10 },
                    { $project: { 'gifts': 1, 'name': 1 } }
                ]);
                if (!allGifts || allGifts.length === 0) {
                    return bot.sendMessage(chatId,
                        `📨 *Sent Gifts*\n\nYou haven't sent any gifts yet.\n\n🎁 _Send your first gift to a match!_`,
                        { parse_mode: 'Markdown', reply_markup: GIFTS_KEYBOARD }
                    );
                }
                const list = allGifts.map(u => `${u.gifts.giftType} → *${u.name}* (${u.gifts.value} coins)`).join('\n');
                bot.sendMessage(chatId, `📨 *Sent Gifts*\n\n${list}`, { parse_mode: 'Markdown', reply_markup: GIFTS_KEYBOARD });
            } catch (err) {
                bot.sendMessage(chatId, '❌ Failed to load sent gifts.');
            }
        } else if (text === '📬 My Received Gifts') {
            try {
                const user = await User.findOne({ telegramId: String(telegramId) });
                const received = (user?.gifts || []).slice(-10).reverse();
                if (received.length === 0) {
                    return bot.sendMessage(chatId,
                        `📬 *Received Gifts*\n\nYou haven't received any gifts yet.\n\n🌟 _A great profile attracts more gifts!_`,
                        { parse_mode: 'Markdown', reply_markup: GIFTS_KEYBOARD }
                    );
                }
                const list = received.map(g => `${g.giftType} — *${g.value} coins*`).join('\n');
                bot.sendMessage(chatId, `📬 *Received Gifts (${received.length})*\n\n${list}`, { parse_mode: 'Markdown', reply_markup: GIFTS_KEYBOARD });
            } catch (err) {
                bot.sendMessage(chatId, '❌ Failed to load received gifts.');
            }
        }
    });

    bot.on('callback_query', async (query) => {
        const { data, message } = query;
        const chatId = message.chat.id;
        const telegramId = query.from.id;

        // ── Gift Center home ───────────────────────────────────────
        if (data === 'gift_shop' || data === 'gift_center') {
            await bot.answerCallbackQuery(query.id).catch(() => {});
            return bot.sendMessage(chatId, `🎁 *Gift Center* ✨`, { parse_mode: 'Markdown', reply_markup: GIFTS_KEYBOARD });
        }

        // ── Step 1: Pick a match to gift ──────────────────────────────────
        if (data === 'gift_pick_match') {
            await bot.answerCallbackQuery(query.id).catch(() => {});
            try {
                const sender = await User.findOne({ telegramId: String(telegramId) });
                if (!sender) return bot.sendMessage(chatId, '❌ User not found.');

                const matchIds = (sender.matches || []).map(m => m.userId);
                if (matchIds.length === 0) {
                    return bot.sendMessage(chatId,
                        '💔 *No matches yet!*\n\nYou need to match with someone before sending a gift.',
                        {
                            parse_mode: 'Markdown',
                            reply_markup: {
                                inline_keyboard: [
                                    [{ text: '🔍 Browse Profiles', callback_data: 'start_browse' }],
                                    [{ text: '🔙 Back', callback_data: 'gift_center' }]
                                ]
                            }
                        }
                    );
                }

                const matchUsers = await User.find({ telegramId: { $in: matchIds } }).select('telegramId name');
                const rows = matchUsers.map((u, i) => [{ text: `${i + 1}. 👤 ${u.name}` }]);
                rows.push([{ text: '🔙 Back to Gifts' }]);
                userStates.set(String(telegramId), { giftFlow: { step: 'pick_recipient', matches: matchUsers.map(u => ({ id: u.telegramId, name: u.name })) } });
                await bot.sendMessage(chatId,
                    `🎁 *Send a Gift*\n\n👥 Choose who to send a gift to:\n\n${matchUsers.map((u, i) => `${i + 1}. *${u.name}*`).join('\n')}`,
                    { parse_mode: 'Markdown', reply_markup: { keyboard: rows, resize_keyboard: true, one_time_keyboard: true } }
                );
            } catch (err) {
                console.error('[Gifts] pick match error:', err);
                bot.sendMessage(chatId, '❌ Failed to load matches. Please try again.');
            }
            return;
        }

        // ── Step 2: Pick gift type for a recipient (via callback, legacy support) ──
        if (data.startsWith('gift_to_')) {
            console.log('[GIFT] gift_to_ triggered for recipient:', data);
            await bot.answerCallbackQuery(query.id).catch(() => {});
            const recipientId = data.replace('gift_to_', '');
            try {
                const recipient = await User.findOne({ telegramId: String(recipientId) }).select('name');
                const sender = await User.findOne({ telegramId: String(telegramId) }).select('coins');
                const balance = sender?.coins || 0;
                
                // Create inline keyboard for gift selection
                const giftInlineKeyboard = {
                    inline_keyboard: [
                        [{ text: '🌹 Rose — 5 coins', callback_data: `gift_type_rose_${recipientId}` }],
                        [{ text: '💖 Heart — 10 coins', callback_data: `gift_type_heart_${recipientId}` }],
                        [{ text: '🍫 Chocolate — 15 coins', callback_data: `gift_type_chocolate_${recipientId}` }],
                        [{ text: '🌺 Flowers — 20 coins', callback_data: `gift_type_flowers_${recipientId}` }],
                        [{ text: '💎 Diamond — 50 coins', callback_data: `gift_type_diamond_${recipientId}` }],
                        [{ text: '🔙 Cancel', callback_data: 'view_matches' }]
                    ]
                };
                
                await bot.sendMessage(chatId,
                    `🎁 *Send a gift to ${recipient?.name || 'your match'}*\n\n` +
                    `🪙 Your balance: *${balance} coins*\n\n` +
                    `Choose a gift to send:`,
                    { parse_mode: 'Markdown', reply_markup: giftInlineKeyboard }
                );
            } catch (err) {
                console.error('[Gifts] pick gift error:', err);
                bot.sendMessage(chatId, '❌ Failed to load gift picker. Please try again.');
            }
            return;
        }

        // ── Step 2b: Pick gift type via inline callback (for view profile flow) ──
        if (data.startsWith('gift_type_')) {
            console.log('[GIFT] gift_type_ triggered:', data);
            await bot.answerCallbackQuery(query.id).catch(() => {});
            const parts = data.replace('gift_type_', '').split('_');
            const recipientId = parts[parts.length - 1];
            const giftKey = parts.slice(0, -1).join('_');
            console.log('[GIFT] Parsed - giftKey:', giftKey, 'recipientId:', recipientId);
            const gift = GIFTS[giftKey];

            if (!gift) {
                console.log('[GIFT] Unknown gift type:', giftKey);
                return bot.sendMessage(chatId, '❌ Unknown gift type.');
            }

            try {
                const [sender, recipient] = await Promise.all([
                    User.findOne({ telegramId: String(telegramId) }),
                    User.findOne({ telegramId: String(recipientId) })
                ]);

                if (!sender) return bot.sendMessage(chatId, '❌ User not found.');
                if (!recipient) return bot.sendMessage(chatId, '❌ Recipient not found.');

                if ((sender.coins || 0) < gift.coins) {
                    return bot.sendMessage(chatId,
                        `❌ *Not enough coins!*\n\nYou need *${gift.coins} coins* for ${gift.name} but only have *${sender.coins || 0}*.\n\nBuy more coins to send gifts!`,
                        { parse_mode: 'Markdown', reply_markup: COINS_STORE_KEYBOARD }
                    );
                }

                sender.coins -= gift.coins;
                recipient.gifts = recipient.gifts || [];
                recipient.gifts.push({
                    from: String(telegramId),
                    giftType: gift.name,
                    sentAt: new Date()
                });

                await Promise.all([sender.save(), recipient.save()]);
                invalidateUserCache(String(telegramId));
                invalidateUserCache(String(recipientId));

                await bot.sendMessage(chatId,
                    `✅ *Gift Sent!*\n\nYou sent ${gift.name} to *${recipient.name}*!\n🪙 Remaining balance: *${sender.coins} coins*`,
                    { parse_mode: 'Markdown', reply_markup: MAIN_KEYBOARD }
                );

                // Notify the recipient
                bot.sendMessage(String(recipientId),
                    `🎁 *You received a gift!*\n\n*${sender.name}* sent you ${gift.name}!\n\n💬 Tap *💕 Matches* to start a conversation!`,
                    { parse_mode: 'Markdown', reply_markup: MAIN_KEYBOARD }
                ).catch(() => {});

            } catch (err) {
                console.error('[Gifts] inline send error:', err);
                bot.sendMessage(chatId, '❌ Failed to send gift. Please try again.');
            }
            return;
        }

        // ── Step 3: Confirm and send the gift ────────────────────────────
        if (data.startsWith('gift_send_')) {
            await bot.answerCallbackQuery(query.id).catch(() => {});
            const parts = data.replace('gift_send_', '').split('_');
            const recipientId = parts[parts.length - 1];
            const giftKey = parts.slice(0, -1).join('_');
            const gift = GIFTS[giftKey];

            if (!gift) return bot.sendMessage(chatId, '❌ Unknown gift type.');

            try {
                const [sender, recipient] = await Promise.all([
                    User.findOne({ telegramId: String(telegramId) }),
                    User.findOne({ telegramId: String(recipientId) })
                ]);

                if (!sender) return bot.sendMessage(chatId, '❌ User not found.');
                if (!recipient) return bot.sendMessage(chatId, '❌ Recipient not found.');

                if ((sender.coins || 0) < gift.coins) {
                    return bot.sendMessage(chatId,
                        `❌ *Not enough coins!*\n\nYou need *${gift.coins} coins* for ${gift.name} but only have *${sender.coins || 0}*.\n\nBuy more coins to send gifts!`,
                        { parse_mode: 'Markdown', reply_markup: COINS_STORE_KEYBOARD }
                    );
                }

                sender.coins -= gift.coins;
                recipient.gifts = recipient.gifts || [];
                recipient.gifts.push({
                    fromUserId: String(telegramId),
                    giftType: gift.name,
                    value: gift.coins,
                    sentAt: new Date()
                });

                await Promise.all([sender.save(), recipient.save()]);
                invalidateUserCache(String(telegramId));
                invalidateUserCache(String(recipientId));

                await bot.sendMessage(chatId,
                    `✅ *Gift Sent!*\n\nYou sent ${gift.name} to *${recipient.name}*!\n🪙 Remaining balance: *${sender.coins} coins*`,
                    { parse_mode: 'Markdown', reply_markup: GIFTS_KEYBOARD }
                );

                // Notify the recipient
                bot.sendMessage(String(recipientId),
                    `🎁 *You received a gift!*\n\n*${sender.name}* sent you ${gift.name}!\n\n💬 Tap *💕 Matches* to start a conversation!`,
                    { parse_mode: 'Markdown', reply_markup: MAIN_KEYBOARD }
                ).catch(() => {});

            } catch (err) {
                console.error('[Gifts] send error:', err);
                bot.sendMessage(chatId, '❌ Failed to send gift. Please try again.');
            }
            return;
        }

        // ── Sent gifts history ────────────────────────────────────────────
        if (data === 'sent_gifts') {
            await bot.answerCallbackQuery(query.id).catch(() => {});
            try {
                const allGifts = await User.aggregate([
                    { $unwind: '$gifts' },
                    { $match: { 'gifts.fromUserId': String(telegramId) } },
                    { $sort: { 'gifts.sentAt': -1 } },
                    { $limit: 10 },
                    { $project: { 'gifts': 1, 'name': 1 } }
                ]);
                if (!allGifts || allGifts.length === 0) {
                    return bot.sendMessage(chatId, `📨 *Sent Gifts*\n\nYou haven't sent any gifts yet.\n🎁 _Send your first gift to a match!_`, { parse_mode: 'Markdown', reply_markup: GIFTS_KEYBOARD });
                }
                const list = allGifts.map(u => `${u.gifts.giftType} → ${u.name} (${u.gifts.value} coins)`).join('\n');
                bot.sendMessage(chatId, `📨 *Sent Gifts*\n\n${list}`, { parse_mode: 'Markdown', reply_markup: GIFTS_KEYBOARD });
            } catch (err) {
                console.error('[Gifts] sent history error:', err);
                bot.sendMessage(chatId, '❌ Failed to load sent gifts.');
            }
            return;
        }

        // ── Received gifts history ────────────────────────────────────────
        if (data === 'received_gifts') {
            await bot.answerCallbackQuery(query.id).catch(() => {});
            try {
                const user = await User.findOne({ telegramId: String(telegramId) });
                const received = (user?.gifts || []).slice(-10).reverse();
                if (received.length === 0) {
                    return bot.sendMessage(chatId, `📬 *Received Gifts*\n\nYou haven't received any gifts yet.\n🌟 _A great profile attracts more gifts!_`, { parse_mode: 'Markdown', reply_markup: GIFTS_KEYBOARD });
                }
                const list = received.map(g => `${g.giftType} — ${g.value} coins`).join('\n');
                bot.sendMessage(chatId, `📬 *Received Gifts (${received.length})*\n\n${list}`, { parse_mode: 'Markdown', reply_markup: GIFTS_KEYBOARD });
            } catch (err) {
                console.error('[Gifts] received history error:', err);
                bot.sendMessage(chatId, '❌ Failed to load received gifts.');
            }
            return;
        }
    });

    // ── Gift flow: match selection + gift type message handlers ───────────────
    bot.on('message', async (msg) => {
        const text = msg.text;
        if (!text || text.startsWith('/')) return;
        const chatId = msg.chat.id;
        const telegramId = String(msg.from.id);
        const state = userStates.get(telegramId);
        if (!state || !state.giftFlow) return;

        const flow = state.giftFlow;

        // ── Cancel / back ───────────────────────────────────────────────────
        if (text === '🔙 Back to Gifts') {
            userStates.delete(telegramId);
            return giftCenterMenu(chatId, bot);
        }

        // ── Step 1: pick recipient from numbered list ───────────────────────────
        if (flow.step === 'pick_recipient') {
            const matches = flow.matches || [];
            const idx = parseInt(text.split('.')[0], 10) - 1;
            if (isNaN(idx) || idx < 0 || idx >= matches.length) {
                return bot.sendMessage(chatId, `❌ Please tap one of the numbered buttons to choose your match.`);
            }
            const chosen = matches[idx];
            try {
                const sender = await User.findOne({ telegramId }).select('coins');
                const balance = sender?.coins || 0;
                userStates.set(telegramId, { giftFlow: { step: 'pick_type', recipientId: String(chosen.id), recipientName: chosen.name } });
                await bot.sendMessage(chatId,
                    `🎁 *Send a gift to ${chosen.name}*\n\n🪙 Your balance: *${balance} coins*\n\nChoose a gift:`,
                    { parse_mode: 'Markdown', reply_markup: GIFT_TYPE_KEYBOARD }
                );
            } catch (err) {
                console.error('[Gifts] recipient select error:', err);
                bot.sendMessage(chatId, '❌ Failed to load gift picker. Please try again.');
            }
            return;
        }

        // ── Step 2: pick gift type ───────────────────────────────────────────
        if (flow.step === 'pick_type') {
            const picked = GIFT_KEY_MAP[text];
            if (!picked) return;
            const { key: giftKey, coins: giftCoins } = picked;
            const gift = GIFTS[giftKey];
            if (!gift) return;
            const { recipientId, recipientName } = flow;
            userStates.delete(telegramId);
            try {
                const [sender, recipient] = await Promise.all([
                    User.findOne({ telegramId }),
                    User.findOne({ telegramId: String(recipientId) })
                ]);
                if (!sender) return bot.sendMessage(chatId, '❌ User not found.');
                if (!recipient) return bot.sendMessage(chatId, '❌ Recipient not found.');
                if ((sender.coins || 0) < gift.coins) {
                    return bot.sendMessage(chatId,
                        `❌ *Not enough coins!*\n\nYou need *${gift.coins} coins* for ${gift.name} but only have *${sender.coins || 0}*.`,
                        { parse_mode: 'Markdown', reply_markup: COINS_STORE_KEYBOARD }
                    );
                }
                sender.coins -= gift.coins;
                recipient.gifts = recipient.gifts || [];
                recipient.gifts.push({ fromUserId: String(telegramId), giftType: gift.name, value: gift.coins, sentAt: new Date() });
                await Promise.all([sender.save(), recipient.save()]);
                invalidateUserCache(telegramId);
                invalidateUserCache(String(recipientId));
                await bot.sendMessage(chatId,
                    `✅ *Gift Sent!*\n\nYou sent ${gift.name} to *${recipient.name}*!\n🪙 Remaining balance: *${sender.coins} coins*`,
                    { parse_mode: 'Markdown', reply_markup: GIFTS_KEYBOARD }
                );
                bot.sendMessage(String(recipientId),
                    `🎁 *You received a gift!*\n\n*${sender.name}* sent you ${gift.name}!\n💬 Tap *💕 Matches* to start a conversation!`,
                    { parse_mode: 'Markdown', reply_markup: MAIN_KEYBOARD }
                ).catch(() => {});
            } catch (err) {
                console.error('[Gifts] send error:', err);
                bot.sendMessage(chatId, '❌ Failed to send gift. Please try again.');
            }
            return;
        }
    });
}

module.exports = { setupGiftCommands };