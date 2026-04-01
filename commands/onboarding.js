/**
 * onboarding.js — Guided step-by-step profile setup
 *
 * Flow:
 *   Step 1: Welcome → ask name
 *   Step 2: Got name → ask gender
 *   Step 3: Got gender → ask age
 *   Step 4: Got age  → ask location
 *   Step 5: Got location → ask interested in (lookingFor)
 *   Step 6: Got lookingFor → ask phone number
 *   Step 7: Got phone → ask to accept terms
 *   Step 8: Got terms → ask bio (optional)
 *   Step 9: Got bio → ask for photo
 *   Done: Got photo → mark complete, show main menu 🎉
 */

const { invalidateUserCache } = require('./auth');
const { searchCities, buildCityKeyboard, formatCityList } = require('./citySearch');
const { MAIN_KEYBOARD, MAIN_KB_BUTTONS, ALL_KB_BUTTONS } = require('../keyboard');

const PROMPTS = {
    name: {
        text: `✨ *Step 1 of 9 — Your Name*\n\nWhat should we call you?\n_Enter your first name or nickname:_`,
    },
    gender: {
        text: `👫 *Step 2 of 9 — Your Gender*\n\nHow do you identify?`,
    },
    age: {
        text: `🎂 *Step 3 of 9 — Your Age*\n\nHow old are you?\n_Enter your age (18–99):_`,
    },
    location: {
        text: `📍 *Step 4 of 9 — Your Location*\n\nWhere are you based?\n_Enter your city (e.g. London, New York):_`,
    },
    lookingFor: {
        text: `� *Step 5 of 9 — Your Preferences*\n\nWho would you like to meet?`,
    },
    phone: {
        text: `� *Step 6 of 9 — Your Phone Number*\n\nTap the button below to share your number.\n\n🔒 Your number is private and never shown publicly.`,
    },
    terms: {
        text: `📜 *Step 7 of 9 — Terms & Privacy*\n\nBefore we continue, please review and accept our Terms of Service.\n\n_By tapping "Accept", you agree to our terms._`,
    },
    bio: {
        text: `� *Step 8 of 9 — Your Bio* _(Optional)_\n\nTell potential matches a little about yourself!\n_Max 200 characters. Type "Skip" to leave blank._`,
    },
    photo: {
        text: `📸 *Step 9 of 9 — Your Photo*\n\nTime to look your best! ✨\n\nSend a clear photo of yourself.\n_This will be the first thing matches see._`,
    },
};

// Module-level reference so startOnboarding can be exported from module.exports
let _startOnboarding;

function setupOnboardingCommands(bot, userStates, User) {

    /**
     * Start the onboarding flow for a user.
     * Called externally (from terms.js) after accept_terms.
     */
    async function startOnboarding(chatId, telegramId) {
        const user = await User.findOne({ telegramId });
        let nextStep = 'name';

        if (user) {
            if (user.name) nextStep = 'gender';
            if (user.name && user.gender) nextStep = 'age';
            if (user.name && user.gender && user.age) nextStep = 'location';
            if (user.name && user.gender && user.age && user.location) nextStep = 'lookingFor';
            if (user.name && user.gender && user.age && user.location && user.lookingFor) nextStep = 'phone';
            if (user.name && user.gender && user.age && user.location && user.lookingFor && user.phone) nextStep = 'terms';
            if (user.name && user.gender && user.age && user.location && user.lookingFor && user.phone && user.termsAccepted) nextStep = 'bio';
            if (user.name && user.gender && user.age && user.location && user.lookingFor && user.phone && user.termsAccepted && user.bio) nextStep = 'photo';

            // If already complete (ignoring optional bio)
            if (user.name && user.gender && user.age && user.location && user.lookingFor && user.phone && user.termsAccepted && user.photos && user.photos.length > 0) {
                if (!user.profileCompleted) {
                    await User.findOneAndUpdate({ telegramId }, { profileCompleted: true });
                }
                return bot.sendMessage(chatId,
                    `🎉 *Your profile is already complete!*\n\nYou're all set and ready to find your perfect match. 💕\n\nUse the menu below or /browse to start matching!`,
                    { parse_mode: 'Markdown', reply_markup: MAIN_KEYBOARD }
                );
            }
        }

        userStates.set(telegramId, { onboarding: { step: nextStep } });

        await bot.sendMessage(chatId,
            `🎉 *Welcome to KissuBot!*\n\n` +
            `Let's set up your profile in a few quick steps so you can start meeting people! 💕\n\n` +
            `You can always edit this later in your profile settings.`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    keyboard: [[{ text: "Let's Go! 🚀" }]],
                    resize_keyboard: true,
                    one_time_keyboard: true
                }
            }
        );
    }

    // ── Callback: advance to each step ──────────────────────────────────
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const telegramId = query.from.id;
        const data = query.data;

        // --- Handle Gender Selection (inline fallback for old messages) ---
        if (data.startsWith('onboard_sel_gender_')) {
            const gender = data.replace('onboard_sel_gender_', '');
            await User.findOneAndUpdate({ telegramId }, { gender });
            invalidateUserCache(telegramId);

            userStates.set(telegramId, { onboarding: { step: 'age' } });
            await bot.answerCallbackQuery(query.id).catch(() => { });

            return bot.sendMessage(chatId,
                `✅ Got it!\n\n${PROMPTS.age.text}`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: { remove_keyboard: true }
                }
            );
        }

        // --- Handle LookingFor Selection (inline fallback for old messages) ---
        if (data.startsWith('onboard_sel_looking_')) {
            let lookingFor = data.replace('onboard_sel_looking_', '');
            if (lookingFor === 'Everyone') lookingFor = 'Both';

            await User.findOneAndUpdate({ telegramId }, { lookingFor });
            invalidateUserCache(telegramId);

            userStates.set(telegramId, { onboarding: { step: 'phone' } });
            await bot.answerCallbackQuery(query.id).catch(() => { });

            return bot.sendMessage(chatId,
                `✅ Preferences saved!\n\n${PROMPTS.phone.text}`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        keyboard: [[{ text: '📞 Share My Number', request_contact: true }]],
                        one_time_keyboard: true,
                        resize_keyboard: true
                    }
                }
            );
        }

        // --- Handle Terms Acceptance during onboarding ---
        if (data === 'onboard_accept_terms') {
            await User.findOneAndUpdate(
                { telegramId },
                { termsAccepted: true, termsAcceptedAt: new Date() }
            );
            invalidateUserCache(telegramId);

            userStates.set(telegramId, { onboarding: { step: 'bio' } });
            await bot.answerCallbackQuery(query.id).catch(() => { });

            return bot.sendMessage(chatId,
                `✅ Terms accepted!\n\n${PROMPTS.bio.text}`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        keyboard: [
                            [{ text: '⏭️ Skip Bio' }],
                            [{ text: '🚫 Cancel Setup' }]
                        ],
                        resize_keyboard: true,
                        one_time_keyboard: true
                    }
                }
            );
        }

        if (data === 'onboard_decline_terms') {
            await bot.answerCallbackQuery(query.id).catch(() => { });
            return bot.sendMessage(chatId,
                `❌ *Terms Declined*\n\nYou must accept our Terms of Service to use KissuBot.\n\nIf you change your mind, type /start to try again.`,
                { parse_mode: 'Markdown', reply_markup: { remove_keyboard: true } }
            );
        }

        if (!data.startsWith('onboard_next_')) return;
        const step = data.replace('onboard_next_', '');

        if (!PROMPTS[step]) return;

        userStates.set(telegramId, { onboarding: { step } });
        await bot.answerCallbackQuery(query.id).catch(() => { });

        // Phone step: show contact-share keyboard
        if (step === 'phone') {
            return bot.sendMessage(chatId, PROMPTS.phone.text, {
                parse_mode: 'Markdown',
                reply_markup: {
                    keyboard: [[{ text: '📞 Share My Number', request_contact: true }]],
                    one_time_keyboard: true,
                    resize_keyboard: true
                }
            });
        }

        // Photo step: remove keyboard
        if (step === 'photo') {
            return bot.sendMessage(chatId, PROMPTS.photo.text, {
                parse_mode: 'Markdown',
                reply_markup: { remove_keyboard: true }
            });
        }

        // Gender step: show Reply Keyboard for selection
        if (step === 'gender') {
            return bot.sendMessage(chatId, PROMPTS.gender.text, {
                parse_mode: 'Markdown',
                reply_markup: {
                    keyboard: [
                        [{ text: '� Male' }, { text: '� Female' }],
                        [{ text: '❌ Stop Setup' }]
                    ],
                    resize_keyboard: true,
                    one_time_keyboard: true
                }
            });
        }

        // lookingFor step: show Reply Keyboard for selection
        if (step === 'lookingFor') {
            return bot.sendMessage(chatId, PROMPTS.lookingFor.text, {
                parse_mode: 'Markdown',
                reply_markup: {
                    keyboard: [
                        [{ text: '👔 Men' }, { text: '👗 Women' }],
                        [{ text: '💘 Everyone' }],
                        [{ text: '❌ Stop Setup' }]
                    ],
                    resize_keyboard: true,
                    one_time_keyboard: true
                }
            });
        }

        // All other text-input steps — remove keyboard so user can type
        return bot.sendMessage(chatId, PROMPTS[step].text, {
            parse_mode: 'Markdown',
            reply_markup: { remove_keyboard: true }
        });
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
            { reply_markup: MAIN_KEYBOARD }
        );
    });

    // ── Handle text + contact input for each onboarding step ──────────
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from.id;
        const state = userStates.get(telegramId);

        // Skip commands and all nav keyboard buttons — let other handlers deal with them
        if (msg.text && msg.text.startsWith('/')) return;
        if (msg.text && ALL_KB_BUTTONS.includes(msg.text)) return;

        if (!state || !state.onboarding) {
            // Handle "Let's Go!" when onboarding state was set but user just sees the welcome
            return;
        }

        const step = state.onboarding.step;

        try {
            // ── "Let's Go! 🚀" press — re-trigger the current step keyboard ──
            if (msg.text && msg.text.trim() === "Let's Go! 🚀") {
                bot.emit('callback_query', {
                    id: 'replay',
                    message: { chat: { id: chatId } },
                    from: { id: telegramId, first_name: msg.from.first_name }
                    , data: `onboard_next_${step}`
                });
                return;
            }

            // ── 🚫 Cancel Setup (Reply Keyboard button, any step) ──────────
            if (msg.text && (msg.text.trim() === '🚫 Cancel Setup' || msg.text.trim() === '❌ Stop Setup')) {
                userStates.delete(telegramId);
                await bot.sendMessage(chatId,
                    `⏭️ Setup paused. You can complete it anytime from your profile settings.`,
                    { reply_markup: MAIN_KEYBOARD }
                );
                return;
            }

            // ── GENDER step ────────────────────────────────────────────────
            if (step === 'gender') {
                const genderMap = { '� Male': 'Male', '� Female': 'Female' };
                const gender = genderMap[msg.text && msg.text.trim()];
                if (!gender) {
                    return bot.sendMessage(chatId, '❌ Please press one of the buttons below:', {
                        reply_markup: {
                            keyboard: [
                                [{ text: '� Male' }, { text: '� Female' }],
                                [{ text: '❌ Stop Setup' }]
                            ],
                            resize_keyboard: true,
                            one_time_keyboard: true
                        }
                    });
                }
                await User.findOneAndUpdate({ telegramId }, { gender });
                invalidateUserCache(telegramId);
                userStates.set(telegramId, { onboarding: { step: 'age' } });
                return bot.sendMessage(chatId,
                    `✅ Got it!\n\n${PROMPTS.age.text}`,
                    { parse_mode: 'Markdown', reply_markup: { remove_keyboard: true } }
                );
            }

            // ── LOOKING FOR step ───────────────────────────────────────────
            if (step === 'lookingFor') {
                const lookingForMap = { '👔 Men': 'Male', '👗 Women': 'Female', '💘 Everyone': 'Both' };
                const lookingFor = lookingForMap[msg.text && msg.text.trim()];
                if (!lookingFor) {
                    return bot.sendMessage(chatId, '❌ Please press one of the buttons below:', {
                        reply_markup: {
                            keyboard: [
                                [{ text: '👔 Men' }, { text: '👗 Women' }],
                                [{ text: '💘 Everyone' }],
                                [{ text: '❌ Stop Setup' }]
                            ],
                            resize_keyboard: true,
                            one_time_keyboard: true
                        }
                    });
                }
                await User.findOneAndUpdate({ telegramId }, { lookingFor });
                invalidateUserCache(telegramId);
                userStates.set(telegramId, { onboarding: { step: 'phone' } });
                return bot.sendMessage(chatId,
                    `✅ Preferences saved!\n\n${PROMPTS.phone.text}`,
                    {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            keyboard: [[{ text: '📞 Share My Number', request_contact: true }]],
                            one_time_keyboard: true,
                            resize_keyboard: true
                        }
                    }
                );
            }

            // ── PHONE step: accepts contact share (mobile) OR typed number (desktop)
            if (step === 'phone') {
                let phoneNumber = null;

                if (msg.contact) {
                    // Mobile: user tapped "Share My Number"
                    if (String(msg.contact.user_id) !== String(telegramId)) {
                        return bot.sendMessage(chatId, '❌ Please share your own number, not someone else\'s.');
                    }
                    phoneNumber = msg.contact.phone_number;
                } else if (msg.text) {
                    // Desktop: user typed the number
                    const digits = msg.text.trim().replace(/[\s\-().]/g, '');
                    if (!/^\+?\d{7,15}$/.test(digits)) {
                        return bot.sendMessage(chatId,
                            '❌ Invalid number. Please include your country code, e.g. `+12345678900`',
                            { parse_mode: 'Markdown' }
                        );
                    }
                    phoneNumber = digits;
                } else {
                    return; // Not a contact or text — ignore
                }

                if (!phoneNumber.startsWith('+')) phoneNumber = `+${phoneNumber}`;

                await User.findOneAndUpdate({ telegramId }, { phone: phoneNumber });
                invalidateUserCache(telegramId);

                userStates.set(telegramId, { onboarding: { step: 'terms' } });
                return bot.sendMessage(chatId,
                    `✅ Phone saved!\n\n${PROMPTS.terms.text}`,
                    {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: '✅ Accept & Continue', callback_data: 'onboard_accept_terms' },
                                    { text: '❌ Decline', callback_data: 'onboard_decline_terms' }
                                ],
                                [
                                    { text: '📖 Read Terms', url: 'https://kissubot-telegram-bot.github.io/kissubot-telegram-bot/terms.html' },
                                    { text: '🔒 Read Privacy', url: 'https://kissubot-telegram-bot.github.io/kissubot-telegram-bot/privacy.html' }
                                ]
                            ]
                        }
                    }
                );
            }

            // ── PHOTO step ─────────────────────────────────────────────────
            if (step === 'photo') {
                if (!msg.photo) {
                    return bot.sendMessage(chatId,
                        '📸 Please send a *photo* (not a file or link).',
                        { parse_mode: 'Markdown' }
                    );
                }

                const photoFileId = msg.photo[msg.photo.length - 1].file_id;
                const user = await User.findOne({ telegramId });
                if (!user) return;

                user.photos = [photoFileId];
                user.profilePhoto = photoFileId;
                await user.save();

                // Mark profile complete
                await User.findOneAndUpdate(
                    { telegramId },
                    { profileCompleted: true, onboardingStep: 'completed' }
                );
                userStates.delete(telegramId);
                invalidateUserCache(telegramId);

                return bot.sendMessage(chatId,
                    `🎉 *Profile Complete!*\n\nWelcome to KissuBot! You're all set and ready to find your perfect match. 💕\n\nTap the ✨ Discover button below to start browsing!`,
                    { parse_mode: 'Markdown', reply_markup: MAIN_KEYBOARD }
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

                userStates.set(telegramId, { onboarding: { step: 'gender' } });
                return bot.sendMessage(chatId,
                    `✅ Nice to meet you, *${input}*!\n\n${PROMPTS.gender.text}`,
                    {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            keyboard: [
                                [{ text: '👨 Male' }, { text: '👩 Female' }],
                                [{ text: '🌈 Non-Binary' }, { text: '🚫 Cancel Setup' }]
                            ],
                            resize_keyboard: true,
                            one_time_keyboard: true
                        }
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
                    { parse_mode: 'Markdown', reply_markup: { remove_keyboard: true } }
                );
            }

            if (step === 'location') {
                if (input.length < 2 || input.length > 100) {
                    return bot.sendMessage(chatId, '❌ Location must be 2–100 characters. Try again:');
                }
                const cities = await searchCities(input);
                if (cities.length === 0) {
                    await User.findOneAndUpdate({ telegramId }, { location: input });
                    invalidateUserCache(telegramId);
                    userStates.set(telegramId, { onboarding: { step: 'lookingFor' } });
                    return bot.sendMessage(chatId,
                        `✅ ${input} — noted!\n\n${PROMPTS.lookingFor.text}`,
                        {
                            parse_mode: 'Markdown',
                            reply_markup: {
                                keyboard: [
                                    [{ text: 'Men' }, { text: 'Women' }],
                                    [{ text: 'Everyone' }],
                                    [{ text: '🚫 Cancel Setup' }]
                                ],
                                resize_keyboard: true,
                                one_time_keyboard: true
                            }
                        }
                    );
                }
                userStates.set(telegramId, { onboarding: { step: 'location_pick', cities } });
                return bot.sendMessage(chatId,
                    `📍 *Select your city from the list:*\n\n${formatCityList(cities)}\n\n👇 Press the number button below`,
                    { parse_mode: 'Markdown', reply_markup: buildCityKeyboard(cities) }
                );
            }

            if (step === 'location_pick') {
                const cities = state.onboarding.cities || [];
                if (input === '⬅️ Back') {
                    userStates.set(telegramId, { onboarding: { step: 'location' } });
                    return bot.sendMessage(chatId, PROMPTS.location.text,
                        { parse_mode: 'Markdown', reply_markup: { remove_keyboard: true } }
                    );
                }
                const idx = parseInt(input, 10) - 1;
                if (isNaN(idx) || idx < 0 || idx >= cities.length) {
                    return bot.sendMessage(chatId, `❌ Please press one of the numbered buttons (1–${cities.length}):`);
                }
                const chosen = cities[idx].label;
                await User.findOneAndUpdate({ telegramId }, { location: chosen });
                invalidateUserCache(telegramId);
                userStates.set(telegramId, { onboarding: { step: 'lookingFor' } });
                return bot.sendMessage(chatId,
                    `✅ *${chosen}* — great!\n\n${PROMPTS.lookingFor.text}`,
                    {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            keyboard: [
                                [{ text: 'Men' }, { text: 'Women' }],
                                [{ text: 'Everyone' }],
                                [{ text: '🚫 Cancel Setup' }]
                            ],
                            resize_keyboard: true,
                            one_time_keyboard: true
                        }
                    }
                );
            }

            if (step === 'bio') {
                const skip = input.toLowerCase() === 'skip' || input === '⏭️ Skip Bio';
                if (!skip && input.length > 200) {
                    return bot.sendMessage(chatId, '❌ Bio must be under 200 characters. Try again (or type Skip):');
                }
                if (!skip) {
                    await User.findOneAndUpdate({ telegramId }, { bio: input });
                    invalidateUserCache(telegramId);
                }
                userStates.set(telegramId, { onboarding: { step: 'photo' } });
                return bot.sendMessage(chatId,
                    `✅ ${skip ? 'Skipped!' : 'Great bio!'}\n\n${PROMPTS.photo.text}`,
                    { parse_mode: 'Markdown', reply_markup: { remove_keyboard: true } }
                );
            }

        } catch (err) {
            console.error('[Onboarding] Error:', err);
            bot.sendMessage(chatId, '❌ Something went wrong. Please try again.');
        }
    });

    _startOnboarding = startOnboarding;
    return { startOnboarding };
}

module.exports = { setupOnboardingCommands, get startOnboarding() { return _startOnboarding; } };
