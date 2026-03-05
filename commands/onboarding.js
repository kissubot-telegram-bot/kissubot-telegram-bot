/**
 * onboarding.js — Guided step-by-step profile setup
 * 
 * Flow (triggered after terms accepted):
 *   Step 1: Welcome → ask name
 *   Step 2: Got name → ask age
 *   Step 3: Got age  → ask location
 *   Step 4: Got location → ask bio
 *   Step 5: Got bio → ask for photo
 *   Step 6: Got photo → mark complete, show main menu 🎉
 */

const { invalidateUserCache } = require('./auth');

const STEPS = ['name', 'age', 'location', 'bio', 'photo'];

const PROMPTS = {
    name: {
        text: `📝 **Step 1 of 5 — Your Name**\n\nWhat should we call you?\n_Enter your first name or nickname:_`,
        placeholder: '✏️ Type your name...',
    },
    age: {
        text: `🎂 **Step 2 of 5 — Your Age**\n\nHow old are you?\n_Enter your age (18–99):_`,
    },
    location: {
        text: `📍 **Step 3 of 5 — Your Location**\n\nWhere are you based?\n_Enter your city or state (e.g. New York, Lagos, London):_`,
    },
    bio: {
        text: `💬 **Step 4 of 5 — Your Bio** _(Optional)_

Tell potential matches a little about yourself!
_Max 200 characters. Tap \"Skip\" to leave this blank for now._`,
    },
    photo: {
        text: `📸 **Step 5 of 5 — Your Photo**\n\nTime to look your best! 📸\n\nSend a clear photo of yourself.\n_This will be the first thing matches see._`,
    },
};

function setupOnboardingCommands(bot, userStates, User) {

    /**
     * Start the onboarding flow for a user.
     * Called externally (from terms.js) after accept_terms.
     */
    async function startOnboarding(chatId, telegramId) {
        userStates.set(telegramId, { onboarding: { step: 'name' } });

        await bot.sendMessage(chatId,
            `🎉 **Welcome to KissuBot!**\n\n` +
            `Let's set up your profile in just 5 quick steps so you can start meeting people! 💕\n\n` +
            `You can always edit this later in your profile settings.`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[{ text: "Let's Go! 🚀", callback_data: 'onboard_next_name' }]]
                }
            }
        );
    }

    // ── Callback: advance to each step ──────────────────────────────────
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const telegramId = query.from.id;
        const data = query.data;

        if (!data.startsWith('onboard_next_')) return;
        const step = data.replace('onboard_next_', '');

        if (!PROMPTS[step]) return;

        userStates.set(telegramId, { onboarding: { step } });
        await bot.answerCallbackQuery(query.id).catch(() => { });

        const opts = { parse_mode: 'Markdown' };
        if (step !== 'photo') {
            opts.reply_markup = {
                inline_keyboard: [[{ text: '🚫 Cancel Setup', callback_data: 'onboard_cancel' }]]
            };
        } else {
            opts.reply_markup = { remove_keyboard: true };
        }

        await bot.sendMessage(chatId, PROMPTS[step].text, opts);
    });

    // ── Cancel onboarding ─────────────────────────────────────────────
    bot.on('callback_query', async (query) => {
        if (query.data !== 'onboard_cancel') return;
        const chatId = query.message.chat.id;
        const telegramId = query.from.id;

        userStates.delete(telegramId);
        await bot.answerCallbackQuery(query.id).catch(() => { });
        await bot.sendMessage(chatId,
            `⏭️ Setup paused. You can complete it anytime from your profile settings.`,
            {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '👤 Complete Profile', callback_data: 'edit_profile' }],
                        [{ text: '🏠 Main Menu', callback_data: 'main_menu' }]
                    ]
                }
            }
        );
    });

    // ── Handle text input for each onboarding step ────────────────────
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from.id;
        const state = userStates.get(telegramId);

        if (!state || !state.onboarding) return;

        const step = state.onboarding.step;

        try {
            // ── PHOTO step ─────────────────────────────────────────────────
            if (step === 'photo') {
                if (!msg.photo) {
                    return bot.sendMessage(chatId,
                        '📸 Please send a **photo** (not a file or link).',
                        { parse_mode: 'Markdown' }
                    );
                }

                const photoFileId = msg.photo[msg.photo.length - 1].file_id;
                const user = await User.findOne({ telegramId });
                if (!user) return;

                user.photos = [photoFileId];
                user.profilePhoto = photoFileId;
                user.profileCompleted = true;
                user.onboardingStep = 'completed';
                await user.save();

                userStates.delete(telegramId);
                invalidateUserCache(telegramId);

                return bot.sendMessage(chatId,
                    `🎉 **Profile Complete!** 🎉\n\n` +
                    `You're all set, **${user.name}**!\n\n` +
                    `Your profile is live and you can start browsing matches 💕`,
                    {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '🔍 Start Browsing', callback_data: 'start_browse' }],
                                [{ text: '👤 View My Profile', callback_data: 'view_my_profile' }]
                            ]
                        }
                    }
                );
            }

            // ── TEXT steps ─────────────────────────────────────────────────
            if (!msg.text) return;
            const input = msg.text.trim();

            if (step === 'name') {
                if (input.length < 2 || input.length > 50) {
                    return bot.sendMessage(chatId, '❌ Name must be 2–50 characters. Try again:');
                }
                await User.findOneAndUpdate({ telegramId }, { name: input });
                invalidateUserCache(telegramId);

                userStates.set(telegramId, { onboarding: { step: 'age' } });
                return bot.sendMessage(chatId,
                    `✅ Nice to meet you, **${input}**!\n\n${PROMPTS.age.text}`,
                    {
                        parse_mode: 'Markdown',
                        reply_markup: { inline_keyboard: [[{ text: '🚫 Cancel Setup', callback_data: 'onboard_cancel' }]] }
                    }
                );
            }

            if (step === 'age') {
                const age = parseInt(input, 10);
                if (isNaN(age) || age < 18 || age > 99) {
                    return bot.sendMessage(chatId, '❌ Please enter a valid age between 18 and 99:');
                }
                await User.findOneAndUpdate({ telegramId }, { age });
                invalidateUserCache(telegramId);

                userStates.set(telegramId, { onboarding: { step: 'location' } });
                return bot.sendMessage(chatId,
                    `✅ Got it!\n\n${PROMPTS.location.text}`,
                    {
                        parse_mode: 'Markdown',
                        reply_markup: { inline_keyboard: [[{ text: '🚫 Cancel Setup', callback_data: 'onboard_cancel' }]] }
                    }
                );
            }

            if (step === 'location') {
                if (input.length < 2 || input.length > 100) {
                    return bot.sendMessage(chatId, '❌ Location must be 2–100 characters. Try again:');
                }
                await User.findOneAndUpdate({ telegramId }, { location: input });
                invalidateUserCache(telegramId);

                userStates.set(telegramId, { onboarding: { step: 'bio' } });
                return bot.sendMessage(chatId,
                    `✅ ${input} — great!\n\n${PROMPTS.bio.text}`,
                    {
                        parse_mode: 'Markdown',
                        reply_markup: { inline_keyboard: [[{ text: '🚫 Cancel Setup', callback_data: 'onboard_cancel' }]] }
                    }
                );
            }

            if (step === 'bio') {
                // Bio is optional — allow skipping with empty/short input or a specific keyword
                const skip = input === '' || input.toLowerCase() === 'skip';
                if (!skip && input.length > 200) {
                    return bot.sendMessage(chatId, '❌ Bio must be under 200 characters. Try again (or type Skip):');
                }
                if (!skip) {
                    await User.findOneAndUpdate({ telegramId }, { bio: input });
                    invalidateUserCache(telegramId);
                }

                userStates.set(telegramId, { onboarding: { step: 'photo' } });
                return bot.sendMessage(chatId,
                    `✅ ${skip ? 'Skipped!' : 'Great bio!'}

${PROMPTS.photo.text}`,
                    { parse_mode: 'Markdown' }
                );
            }

        } catch (err) {
            console.error('[Onboarding] Error:', err);
            bot.sendMessage(chatId, '❌ Something went wrong. Please try again.');
        }
    });

    module.exports.startOnboarding = startOnboarding;
}

module.exports = { setupOnboardingCommands };
