/**
 * BLACK-BOX UNIT TESTS: commands/onboarding.js
 *
 * Strategy: Feed the module mock messages / callback queries and assert
 * ONLY on what the bot sends back (outputs). We never inspect internals.
 *
 * The current implementation is a 9-step reply-keyboard flow:
 *   name → gender → age → location → lookingFor → phone → terms → bio → photo
 *
 * Naming:  TC-BB-XX  (Black Box)
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a minimal mock bot that records every call made on it.
 * Handlers registered via bot.on() and bot.onText() are stored so
 * individual tests can fire them directly.
 */
function makeMockBot() {
    const bot = {
        _textHandlers: [],   // { pattern, handler }
        _onHandlers: {},     // { event: [handler, ...] }

        onText(pattern, handler) {
            this._textHandlers.push({ pattern, handler });
        },

        on(event, handler) {
            if (!this._onHandlers[event]) this._onHandlers[event] = [];
            this._onHandlers[event].push(handler);
        },

        emit(event, ...args) {
            const handlers = this._onHandlers[event] || [];
            for (const h of handlers) h(...args);
        },

        sendMessage: jest.fn().mockResolvedValue({}),
        answerCallbackQuery: jest.fn().mockResolvedValue({}),
    };
    return bot;
}

/**
 * Build a minimal mock User model.
 * `savedDocs` tracks every document object that had .save() called on it.
 */
function makeMockUser(existingUser = null) {
    const savedDocs = [];

    class MockUser {
        constructor(data) {
            Object.assign(this, data);
            this.save = jest.fn().mockImplementation(async () => {
                savedDocs.push(this);
                return this;
            });
        }

        static findOne = jest.fn().mockResolvedValue(existingUser);
        static findOneAndUpdate = jest.fn().mockResolvedValue({});
    }

    MockUser._savedDocs = savedDocs;
    return MockUser;
}

/**
 * Build a callback_query object.
 */
function makeQuery(chatId, telegramId, data, queryId = 'qid-1') {
    return {
        id: queryId,
        message: { chat: { id: chatId } },
        from: { id: telegramId, username: 'testuser' },
        data,
    };
}

/**
 * Build a text message object.
 */
function makeTextMsg(chatId, telegramId, text) {
    return {
        chat: { id: chatId },
        from: { id: telegramId, first_name: 'Test' },
        text,
    };
}

/**
 * Build a photo message object (photo array mimics Telegram API).
 */
function makePhotoMsg(chatId, telegramId, fileId = 'photo_file_id_123') {
    return {
        chat: { id: chatId },
        from: { id: telegramId },
        photo: [{ file_id: `${fileId}_small` }, { file_id: fileId }],
    };
}

/**
 * Build a contact message object (for phone step).
 */
function makeContactMsg(chatId, telegramId, phone = '+12345678900') {
    return {
        chat: { id: chatId },
        from: { id: telegramId },
        contact: { user_id: telegramId, phone_number: phone },
    };
}

/**
 * Fire all registered 'callback_query' handlers for a given query.
 * (onboarding.js registers two separate bot.on('callback_query', ...) calls)
 */
async function fireCallbackQuery(bot, query) {
    const handlers = bot._onHandlers['callback_query'] || [];
    for (const h of handlers) await h(query);
}

/**
 * Fire all registered 'message' handlers for a given message.
 */
async function fireMessage(bot, msg) {
    const handlers = bot._onHandlers['message'] || [];
    for (const h of handlers) await h(msg);
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite 1: startOnboarding function
// ─────────────────────────────────────────────────────────────────────────────

describe('BLACK-BOX: startOnboarding', () => {
    let bot;
    let userStates;
    let startOnboarding;

    beforeEach(() => {
        jest.resetModules();
        bot = makeMockBot();
        userStates = new Map();
        const MockUser = makeMockUser();

        const { setupOnboardingCommands } = require('../../commands/onboarding');
        // setupOnboardingCommands returns { startOnboarding } and also sets it on module.exports
        const handlers = setupOnboardingCommands(bot, userStates, MockUser);
        startOnboarding = handlers.startOnboarding;
    });

    test('TC-BB-01: startOnboarding sends welcome message with "Let\'s Go" reply button', async () => {
        await startOnboarding(100, 1001);

        expect(bot.sendMessage).toHaveBeenCalledWith(
            100,
            expect.stringContaining('Welcome to KissuBot'),
            expect.objectContaining({
                reply_markup: expect.objectContaining({
                    keyboard: expect.arrayContaining([
                        expect.arrayContaining([
                            expect.objectContaining({ text: "Let's Go! 🚀" })
                        ])
                    ])
                })
            })
        );
    });

    test('TC-BB-01b: startOnboarding sets onboarding state to "name" step', async () => {
        await startOnboarding(100, 1001);
        expect(userStates.get(1001)).toEqual({ onboarding: { step: 'name' } });
    });

    test('TC-BB-01c: startOnboarding for already-complete user sends "already complete" message', async () => {
        jest.resetModules();
        const completeUser = {
            name: 'Alice', gender: 'Female', age: 25, location: 'Lagos',
            lookingFor: 'Male', phone: '+1234', termsAccepted: true,
            profileCompleted: true, photos: ['photo1'],
            save: jest.fn()
        };
        bot = makeMockBot();
        userStates = new Map();
        const MockUser = makeMockUser(completeUser);
        const { setupOnboardingCommands } = require('../../commands/onboarding');
        const handlers = setupOnboardingCommands(bot, userStates, MockUser);
        startOnboarding = handlers.startOnboarding;

        await startOnboarding(100, 1001);

        const call = bot.sendMessage.mock.calls[0];
        expect(call[1]).toContain('already complete');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 2: Callback queries (step navigation + cancel)
// ─────────────────────────────────────────────────────────────────────────────

describe('BLACK-BOX: onboard_next_* callbacks', () => {
    let bot;
    let userStates;

    beforeEach(() => {
        jest.resetModules();
        bot = makeMockBot();
        userStates = new Map();
        const MockUser = makeMockUser();

        const { setupOnboardingCommands } = require('../../commands/onboarding');
        setupOnboardingCommands(bot, userStates, MockUser);
    });

    test('TC-BB-02: onboard_next_name → sends name prompt (Step 1 of 9)', async () => {
        await fireCallbackQuery(bot, makeQuery(100, 1001, 'onboard_next_name'));

        const call = bot.sendMessage.mock.calls.find(c => c[1].includes('Step 1 of 9'));
        expect(call).toBeDefined();
        expect(call[0]).toBe(100);
    });

    test('TC-BB-02b: onboard_next_name sets state to name step', async () => {
        await fireCallbackQuery(bot, makeQuery(100, 1001, 'onboard_next_name'));
        expect(userStates.get(1001)).toEqual({ onboarding: { step: 'name' } });
    });

    test('TC-BB-02c: onboard_next_photo sends photo prompt and removes keyboard', async () => {
        await fireCallbackQuery(bot, makeQuery(100, 1001, 'onboard_next_photo'));

        const call = bot.sendMessage.mock.calls.find(c => c[1].includes('Step 9 of 9'));
        expect(call).toBeDefined();
        expect(call[2]).toMatchObject({ reply_markup: { remove_keyboard: true } });
    });

    test('TC-BB-02d: unknown onboard_next_* step is silently ignored', async () => {
        await fireCallbackQuery(bot, makeQuery(100, 1001, 'onboard_next_unknown_step'));
        expect(bot.sendMessage).not.toHaveBeenCalled();
    });

    test('TC-BB-02e: onboard_next_gender sends reply keyboard with Male/Female options', async () => {
        await fireCallbackQuery(bot, makeQuery(100, 1001, 'onboard_next_gender'));

        const call = bot.sendMessage.mock.calls[0];
        const markup = JSON.stringify(call[2]?.reply_markup || {});
        expect(markup).toContain('👨 Male');
        expect(markup).toContain('👩 Female');
    });

    test('TC-BB-02f: onboard_next_lookingFor sends reply keyboard with Men/Women/Everyone', async () => {
        await fireCallbackQuery(bot, makeQuery(100, 1001, 'onboard_next_lookingFor'));

        const call = bot.sendMessage.mock.calls[0];
        const markup = JSON.stringify(call[2]?.reply_markup || {});
        expect(markup).toContain('Men');
        expect(markup).toContain('Women');
        expect(markup).toContain('Everyone');
    });

    test('TC-BB-02g: onboard_next_phone sends reply keyboard with share-number button', async () => {
        await fireCallbackQuery(bot, makeQuery(100, 1001, 'onboard_next_phone'));

        const call = bot.sendMessage.mock.calls[0];
        const markup = JSON.stringify(call[2]?.reply_markup || {});
        expect(markup).toContain('Share My Number');
    });
});

describe('BLACK-BOX: onboard_cancel callback', () => {
    let bot;
    let userStates;

    beforeEach(() => {
        jest.resetModules();
        bot = makeMockBot();
        userStates = new Map();
        userStates.set(1001, { onboarding: { step: 'name' } });
        const MockUser = makeMockUser();

        const { setupOnboardingCommands } = require('../../commands/onboarding');
        setupOnboardingCommands(bot, userStates, MockUser);
    });

    test('TC-BB-03: onboard_cancel → sends "Setup paused" message', async () => {
        await fireCallbackQuery(bot, makeQuery(100, 1001, 'onboard_cancel'));

        expect(bot.sendMessage).toHaveBeenCalledWith(
            100,
            expect.stringContaining('paused'),
            expect.any(Object)
        );
    });

    test('TC-BB-03b: onboard_cancel → clears user state', async () => {
        await fireCallbackQuery(bot, makeQuery(100, 1001, 'onboard_cancel'));
        expect(userStates.has(1001)).toBe(false);
    });

    test('TC-BB-03c: onboard_cancel message sends MAIN_KEYBOARD (persistent nav)', async () => {
        await fireCallbackQuery(bot, makeQuery(100, 1001, 'onboard_cancel'));

        const call = bot.sendMessage.mock.calls[0];
        const markup = call[2]?.reply_markup;
        // MAIN_KEYBOARD has keyboard array with nav buttons
        expect(markup).toHaveProperty('keyboard');
        const flat = markup.keyboard.flat().map(b => b.text);
        expect(flat).toContain('🔍 Discover');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 3: onboard_accept/decline_terms callbacks
// ─────────────────────────────────────────────────────────────────────────────

describe('BLACK-BOX: Terms callbacks (onboard_accept_terms / onboard_decline_terms)', () => {
    let bot;
    let userStates;
    let MockUser;

    beforeEach(() => {
        jest.resetModules();
        bot = makeMockBot();
        userStates = new Map();
        userStates.set(1001, { onboarding: { step: 'terms' } });
        MockUser = makeMockUser();

        const { setupOnboardingCommands } = require('../../commands/onboarding');
        setupOnboardingCommands(bot, userStates, MockUser);
    });

    test('TC-BB-T1: accept_terms → saves termsAccepted, advances to bio step', async () => {
        await fireCallbackQuery(bot, makeQuery(100, 1001, 'onboard_accept_terms'));

        expect(MockUser.findOneAndUpdate).toHaveBeenCalledWith(
            { telegramId: 1001 },
            expect.objectContaining({ termsAccepted: true })
        );
        expect(userStates.get(1001)).toEqual({ onboarding: { step: 'bio' } });
    });

    test('TC-BB-T2: accept_terms → sends bio prompt with Skip button', async () => {
        await fireCallbackQuery(bot, makeQuery(100, 1001, 'onboard_accept_terms'));

        const call = bot.sendMessage.mock.calls[0];
        // The message contains 'Bio' (capital B in Markdown: *Bio*)
        expect(call[1]).toContain('Bio');
        const markup = JSON.stringify(call[2]?.reply_markup || {});
        expect(markup).toContain('Skip Bio');
    });

    test('TC-BB-T3: decline_terms → sends "must accept" message', async () => {
        await fireCallbackQuery(bot, makeQuery(100, 1001, 'onboard_decline_terms'));

        const call = bot.sendMessage.mock.calls[0];
        expect(call[1]).toContain('must accept');
        // Note: the decline handler just informs the user — it does not modify state
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 4: Name step
// ─────────────────────────────────────────────────────────────────────────────

describe('BLACK-BOX: Name step', () => {
    let bot;
    let userStates;
    let MockUser;

    beforeEach(() => {
        jest.resetModules();
        bot = makeMockBot();
        userStates = new Map();
        userStates.set(1001, { onboarding: { step: 'name' } });
        MockUser = makeMockUser();

        const { setupOnboardingCommands } = require('../../commands/onboarding');
        setupOnboardingCommands(bot, userStates, MockUser);
    });

    test('TC-BB-04: Valid name → greeting uses name, state advances to gender', async () => {
        await fireMessage(bot, makeTextMsg(100, 1001, 'Alice'));

        const msg = bot.sendMessage.mock.calls[0][1];
        expect(msg).toContain('Alice');
        expect(userStates.get(1001)).toEqual({ onboarding: { step: 'gender' } });
    });

    test('TC-BB-05: Name too short (1 char) → error, state remains on name', async () => {
        await fireMessage(bot, makeTextMsg(100, 1001, 'A'));

        expect(bot.sendMessage).toHaveBeenCalledWith(
            100,
            expect.stringContaining('2–50'),
        );
        expect(userStates.get(1001)).toEqual({ onboarding: { step: 'name' } });
    });

    test('TC-BB-06: Name too long (51 chars) → error, state remains on name', async () => {
        await fireMessage(bot, makeTextMsg(100, 1001, 'B'.repeat(51)));

        expect(bot.sendMessage).toHaveBeenCalledWith(
            100,
            expect.stringContaining('2–50'),
        );
        expect(userStates.get(1001)).toEqual({ onboarding: { step: 'name' } });
    });

    test('TC-BB-04b: Valid name at boundary (2 chars) → accepted, shows gender keyboard', async () => {
        await fireMessage(bot, makeTextMsg(100, 1001, 'Jo'));

        expect(userStates.get(1001)).toEqual({ onboarding: { step: 'gender' } });
        const call = bot.sendMessage.mock.calls[0];
        const markup = JSON.stringify(call[2]?.reply_markup || {});
        expect(markup).toContain('👨 Male');
    });

    test('TC-BB-04c: Valid name at max boundary (50 chars) → accepted', async () => {
        await fireMessage(bot, makeTextMsg(100, 1001, 'C'.repeat(50)));

        expect(userStates.get(1001)).toEqual({ onboarding: { step: 'gender' } });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 5: Gender step
// ─────────────────────────────────────────────────────────────────────────────

describe('BLACK-BOX: Gender step', () => {
    let bot;
    let userStates;
    let MockUser;

    beforeEach(() => {
        jest.resetModules();
        bot = makeMockBot();
        userStates = new Map();
        userStates.set(1001, { onboarding: { step: 'gender' } });
        MockUser = makeMockUser();

        const { setupOnboardingCommands } = require('../../commands/onboarding');
        setupOnboardingCommands(bot, userStates, MockUser);
    });

    test('TC-BB-G1: "👨 Male" → saves gender Male, advances to age', async () => {
        await fireMessage(bot, makeTextMsg(100, 1001, '👨 Male'));

        expect(MockUser.findOneAndUpdate).toHaveBeenCalledWith(
            { telegramId: 1001 }, { gender: 'Male' }
        );
        expect(userStates.get(1001)).toEqual({ onboarding: { step: 'age' } });
    });

    test('TC-BB-G2: "👩 Female" → saves gender Female, advances to age', async () => {
        await fireMessage(bot, makeTextMsg(100, 1001, '👩 Female'));

        expect(MockUser.findOneAndUpdate).toHaveBeenCalledWith(
            { telegramId: 1001 }, { gender: 'Female' }
        );
        expect(userStates.get(1001)).toEqual({ onboarding: { step: 'age' } });
    });

    test('TC-BB-G3: Invalid text → error, shows gender keyboard again', async () => {
        await fireMessage(bot, makeTextMsg(100, 1001, 'Apache helicopter'));

        expect(bot.sendMessage).toHaveBeenCalledWith(
            100,
            expect.stringContaining('buttons below'),
            expect.objectContaining({ reply_markup: expect.objectContaining({ keyboard: expect.any(Array) }) })
        );
        expect(userStates.get(1001)).toEqual({ onboarding: { step: 'gender' } });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 6: Age step
// ─────────────────────────────────────────────────────────────────────────────

describe('BLACK-BOX: Age step', () => {
    let bot;
    let userStates;
    let MockUser;

    beforeEach(() => {
        jest.resetModules();
        bot = makeMockBot();
        userStates = new Map();
        userStates.set(1001, { onboarding: { step: 'age' } });
        MockUser = makeMockUser();

        const { setupOnboardingCommands } = require('../../commands/onboarding');
        setupOnboardingCommands(bot, userStates, MockUser);
    });

    test('TC-BB-07: Valid age (25) → state advances to location', async () => {
        await fireMessage(bot, makeTextMsg(100, 1001, '25'));

        expect(userStates.get(1001)).toEqual({ onboarding: { step: 'location' } });
    });

    test('TC-BB-07b: Valid age at min boundary (18) → accepted', async () => {
        await fireMessage(bot, makeTextMsg(100, 1001, '18'));
        expect(userStates.get(1001)).toEqual({ onboarding: { step: 'location' } });
    });

    test('TC-BB-07c: Valid age at max boundary (99) → accepted', async () => {
        await fireMessage(bot, makeTextMsg(100, 1001, '99'));
        expect(userStates.get(1001)).toEqual({ onboarding: { step: 'location' } });
    });

    test('TC-BB-08: Age below 18 → error sent, state remains age', async () => {
        await fireMessage(bot, makeTextMsg(100, 1001, '17'));

        expect(bot.sendMessage).toHaveBeenCalledWith(
            100,
            expect.stringContaining('18 and 99'),
        );
        expect(userStates.get(1001)).toEqual({ onboarding: { step: 'age' } });
    });

    test('TC-BB-09: Age above 99 → error sent', async () => {
        await fireMessage(bot, makeTextMsg(100, 1001, '100'));

        expect(bot.sendMessage).toHaveBeenCalledWith(
            100,
            expect.stringContaining('18 and 99'),
        );
    });

    test('TC-BB-10: Non-numeric age → error sent', async () => {
        await fireMessage(bot, makeTextMsg(100, 1001, 'old'));

        expect(bot.sendMessage).toHaveBeenCalledWith(
            100,
            expect.stringContaining('18 and 99'),
        );
    });

    test('TC-BB-10b: Float age (e.g. "25.5") → treated as 25, accepted', async () => {
        // parseInt('25.5') === 25, which is valid
        await fireMessage(bot, makeTextMsg(100, 1001, '25.5'));
        expect(userStates.get(1001)).toEqual({ onboarding: { step: 'location' } });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 7: Location step
// ─────────────────────────────────────────────────────────────────────────────

describe('BLACK-BOX: Location step', () => {
    let bot;
    let userStates;
    let MockUser;

    beforeEach(() => {
        jest.resetModules();
        bot = makeMockBot();
        userStates = new Map();
        userStates.set(1001, { onboarding: { step: 'location' } });
        MockUser = makeMockUser();

        const { setupOnboardingCommands } = require('../../commands/onboarding');
        setupOnboardingCommands(bot, userStates, MockUser);
    });

    test('TC-BB-11: Valid location → state advances to lookingFor', async () => {
        await fireMessage(bot, makeTextMsg(100, 1001, 'Lagos'));

        // After location, next step is lookingFor (no cities found in mock)
        expect(userStates.get(1001)).toEqual({ onboarding: { step: 'lookingFor' } });
    });

    test('TC-BB-11b: Success reply echoes the location name entered', async () => {
        await fireMessage(bot, makeTextMsg(100, 1001, 'Lagos'));

        const msg = bot.sendMessage.mock.calls[0][1];
        expect(msg).toContain('Lagos');
    });

    test('TC-BB-12: Location too short (1 char) → error, state stays on location', async () => {
        await fireMessage(bot, makeTextMsg(100, 1001, 'A'));

        expect(bot.sendMessage).toHaveBeenCalledWith(
            100,
            expect.stringContaining('2–100'),
        );
        expect(userStates.get(1001)).toEqual({ onboarding: { step: 'location' } });
    });

    test('TC-BB-13: Location too long (101 chars) → error', async () => {
        await fireMessage(bot, makeTextMsg(100, 1001, 'A'.repeat(101)));

        expect(bot.sendMessage).toHaveBeenCalledWith(
            100,
            expect.stringContaining('2–100'),
        );
    });

    test('TC-BB-11c: Location at max boundary (100 chars) → accepted', async () => {
        await fireMessage(bot, makeTextMsg(100, 1001, 'A'.repeat(100)));
        expect(userStates.get(1001)).toEqual({ onboarding: { step: 'lookingFor' } });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 8: LookingFor step
// ─────────────────────────────────────────────────────────────────────────────

describe('BLACK-BOX: LookingFor step', () => {
    let bot;
    let userStates;
    let MockUser;

    beforeEach(() => {
        jest.resetModules();
        bot = makeMockBot();
        userStates = new Map();
        userStates.set(1001, { onboarding: { step: 'lookingFor' } });
        MockUser = makeMockUser();

        const { setupOnboardingCommands } = require('../../commands/onboarding');
        setupOnboardingCommands(bot, userStates, MockUser);
    });

    test('TC-BB-LF1: "Men" → saves lookingFor Male, advances to phone', async () => {
        await fireMessage(bot, makeTextMsg(100, 1001, 'Men'));

        expect(MockUser.findOneAndUpdate).toHaveBeenCalledWith(
            { telegramId: 1001 }, { lookingFor: 'Male' }
        );
        expect(userStates.get(1001)).toEqual({ onboarding: { step: 'phone' } });
    });

    test('TC-BB-LF2: "Women" → saves lookingFor Female, advances to phone', async () => {
        await fireMessage(bot, makeTextMsg(100, 1001, 'Women'));

        expect(MockUser.findOneAndUpdate).toHaveBeenCalledWith(
            { telegramId: 1001 }, { lookingFor: 'Female' }
        );
        expect(userStates.get(1001)).toEqual({ onboarding: { step: 'phone' } });
    });

    test('TC-BB-LF3: "Everyone" → saves lookingFor Both, advances to phone', async () => {
        await fireMessage(bot, makeTextMsg(100, 1001, 'Everyone'));

        expect(MockUser.findOneAndUpdate).toHaveBeenCalledWith(
            { telegramId: 1001 }, { lookingFor: 'Both' }
        );
        expect(userStates.get(1001)).toEqual({ onboarding: { step: 'phone' } });
    });

    test('TC-BB-LF4: Invalid text → error, shows lookingFor keyboard again', async () => {
        await fireMessage(bot, makeTextMsg(100, 1001, 'just friends'));

        expect(bot.sendMessage).toHaveBeenCalledWith(
            100,
            expect.stringContaining('buttons below'),
            expect.objectContaining({ reply_markup: expect.objectContaining({ keyboard: expect.any(Array) }) })
        );
        expect(userStates.get(1001)).toEqual({ onboarding: { step: 'lookingFor' } });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 9: Phone step
// ─────────────────────────────────────────────────────────────────────────────

describe('BLACK-BOX: Phone step', () => {
    let bot;
    let userStates;
    let MockUser;

    beforeEach(() => {
        jest.resetModules();
        bot = makeMockBot();
        userStates = new Map();
        userStates.set(1001, { onboarding: { step: 'phone' } });
        MockUser = makeMockUser();

        const { setupOnboardingCommands } = require('../../commands/onboarding');
        setupOnboardingCommands(bot, userStates, MockUser);
    });

    test('TC-BB-PH1: Contact message (mobile share) → saves phone, advances to terms', async () => {
        await fireMessage(bot, makeContactMsg(100, 1001, '+12345678900'));

        expect(MockUser.findOneAndUpdate).toHaveBeenCalledWith(
            { telegramId: 1001 }, { phone: '+12345678900' }
        );
        expect(userStates.get(1001)).toEqual({ onboarding: { step: 'terms' } });
    });

    test('TC-BB-PH2: Typed number with country code → accepted, advances to terms', async () => {
        await fireMessage(bot, makeTextMsg(100, 1001, '+12345678900'));

        expect(userStates.get(1001)).toEqual({ onboarding: { step: 'terms' } });
    });

    test('TC-BB-PH3: Typed number without + → prefixed with +, accepted', async () => {
        await fireMessage(bot, makeTextMsg(100, 1001, '12345678900'));

        expect(MockUser.findOneAndUpdate).toHaveBeenCalledWith(
            { telegramId: 1001 }, { phone: '+12345678900' }
        );
    });

    test('TC-BB-PH4: Invalid number (too short) → error sent', async () => {
        await fireMessage(bot, makeTextMsg(100, 1001, '123'));

        expect(bot.sendMessage).toHaveBeenCalledWith(
            100,
            expect.stringContaining('Invalid number'),
            expect.any(Object)
        );
        expect(userStates.get(1001)).toEqual({ onboarding: { step: 'phone' } });
    });

    test('TC-BB-PH5: Phone step sends terms as inline keyboard after accepting', async () => {
        await fireMessage(bot, makeContactMsg(100, 1001));

        const call = bot.sendMessage.mock.calls[0];
        const markup = JSON.stringify(call[2]?.reply_markup || {});
        expect(markup).toContain('onboard_accept_terms');
    });

    test('TC-BB-PH6: Contact from another user is rejected', async () => {
        const wrongContactMsg = {
            chat: { id: 100 },
            from: { id: 1001 },
            contact: { user_id: 9999, phone_number: '+12345678900' }, // different user
        };
        await fireMessage(bot, wrongContactMsg);

        expect(bot.sendMessage).toHaveBeenCalledWith(
            100,
            expect.stringContaining("your own number")
        );
        expect(userStates.get(1001)).toEqual({ onboarding: { step: 'phone' } });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 10: Bio step
// ─────────────────────────────────────────────────────────────────────────────

describe('BLACK-BOX: Bio step', () => {
    let bot;
    let userStates;
    let MockUser;

    beforeEach(() => {
        jest.resetModules();
        bot = makeMockBot();
        userStates = new Map();
        userStates.set(1001, { onboarding: { step: 'bio' } });
        MockUser = makeMockUser();

        const { setupOnboardingCommands } = require('../../commands/onboarding');
        setupOnboardingCommands(bot, userStates, MockUser);
    });

    test('TC-BB-14: Valid bio (≤200 chars) → state advances to photo', async () => {
        await fireMessage(bot, makeTextMsg(100, 1001, 'I love hiking and cooking!'));

        expect(userStates.get(1001)).toEqual({ onboarding: { step: 'photo' } });
    });

    test('TC-BB-14b: Valid bio confirmation message contains "Great bio"', async () => {
        await fireMessage(bot, makeTextMsg(100, 1001, 'I love hiking and cooking!'));

        const msg = bot.sendMessage.mock.calls[0][1];
        expect(msg).toContain('Great bio');
    });

    test('TC-BB-15: Bio "skip" keyword → state advances to photo, no DB update', async () => {
        await fireMessage(bot, makeTextMsg(100, 1001, 'skip'));

        expect(userStates.get(1001)).toEqual({ onboarding: { step: 'photo' } });
        expect(MockUser.findOneAndUpdate).not.toHaveBeenCalled();
    });

    test('TC-BB-15b: Bio "Skip" (mixed case) → treated as skip', async () => {
        await fireMessage(bot, makeTextMsg(100, 1001, 'Skip'));

        expect(userStates.get(1001)).toEqual({ onboarding: { step: 'photo' } });
        expect(MockUser.findOneAndUpdate).not.toHaveBeenCalled();
    });

    test('TC-BB-15c: "⏭️ Skip Bio" button text → treated as skip', async () => {
        await fireMessage(bot, makeTextMsg(100, 1001, '⏭️ Skip Bio'));

        expect(userStates.get(1001)).toEqual({ onboarding: { step: 'photo' } });
        expect(MockUser.findOneAndUpdate).not.toHaveBeenCalled();
    });

    test('TC-BB-15d: Skipped bio reply contains "Skipped!"', async () => {
        await fireMessage(bot, makeTextMsg(100, 1001, 'skip'));

        const msg = bot.sendMessage.mock.calls[0][1];
        expect(msg).toContain('Skipped!');
    });

    test('TC-BB-16: Bio >200 chars → error, state remains on bio', async () => {
        await fireMessage(bot, makeTextMsg(100, 1001, 'A'.repeat(201)));

        expect(bot.sendMessage).toHaveBeenCalledWith(
            100,
            expect.stringContaining('200 characters'),
        );
        expect(userStates.get(1001)).toEqual({ onboarding: { step: 'bio' } });
    });

    test('TC-BB-14c: Bio at max boundary (200 chars) → accepted', async () => {
        await fireMessage(bot, makeTextMsg(100, 1001, 'A'.repeat(200)));
        expect(userStates.get(1001)).toEqual({ onboarding: { step: 'photo' } });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 11: Photo step
// ─────────────────────────────────────────────────────────────────────────────

describe('BLACK-BOX: Photo step', () => {
    let bot;
    let userStates;
    let MockUser;
    let mockUserDoc;

    beforeEach(() => {
        jest.resetModules();
        bot = makeMockBot();
        userStates = new Map();
        userStates.set(1001, { onboarding: { step: 'photo' } });

        // Provide an existing user document with a save() spy
        mockUserDoc = {
            telegramId: 1001,
            name: 'Alice',
            photos: [],
            profilePhoto: null,
            profileCompleted: false,
            onboardingStep: 'bio',
            save: jest.fn().mockResolvedValue({}),
        };
        MockUser = makeMockUser(mockUserDoc);

        const { setupOnboardingCommands } = require('../../commands/onboarding');
        setupOnboardingCommands(bot, userStates, MockUser);
    });

    test('TC-BB-17: Valid photo sent → "Profile Complete" message sent', async () => {
        await fireMessage(bot, makePhotoMsg(100, 1001));

        expect(bot.sendMessage).toHaveBeenCalledWith(
            100,
            expect.stringContaining('Profile Complete'),
            expect.any(Object)
        );
    });

    test('TC-BB-17b: After valid photo → profileCompleted is set to true on doc', async () => {
        await fireMessage(bot, makePhotoMsg(100, 1001));

        expect(MockUser.findOneAndUpdate).toHaveBeenCalledWith(
            { telegramId: 1001 },
            expect.objectContaining({ profileCompleted: true, onboardingStep: 'completed' })
        );
    });

    test('TC-BB-17c: After valid photo → user state is cleared', async () => {
        await fireMessage(bot, makePhotoMsg(100, 1001));

        expect(userStates.has(1001)).toBe(false);
    });

    test('TC-BB-17d: Completion message sends MAIN_KEYBOARD (persistent nav)', async () => {
        await fireMessage(bot, makePhotoMsg(100, 1001));

        const call = bot.sendMessage.mock.calls[0];
        const markup = call[2]?.reply_markup;
        // MAIN_KEYBOARD has a keyboard array with nav buttons
        expect(markup).toHaveProperty('keyboard');
        const flat = markup.keyboard.flat().map(b => b.text);
        expect(flat).toContain('🔍 Discover');
    });

    test('TC-BB-17e: Largest photo variant (last in array) is saved as profilePhoto', async () => {
        await fireMessage(bot, makePhotoMsg(100, 1001, 'bestphoto_id'));

        expect(mockUserDoc.profilePhoto).toBe('bestphoto_id');
    });

    test('TC-BB-18: Text sent instead of photo → error message asking for a photo', async () => {
        await fireMessage(bot, makeTextMsg(100, 1001, 'here is my selfie lol'));

        expect(bot.sendMessage).toHaveBeenCalledWith(
            100,
            expect.stringContaining('photo'),
            expect.any(Object)
        );
    });

    test('TC-BB-18b: Text instead of photo → user state is NOT cleared', async () => {
        await fireMessage(bot, makeTextMsg(100, 1001, 'here is my selfie lol'));

        expect(userStates.get(1001)).toEqual({ onboarding: { step: 'photo' } });
    });

    test('TC-BB-19: DB error during photo save → error message sent to user', async () => {
        mockUserDoc.save.mockRejectedValueOnce(new Error('DB write failed'));

        await fireMessage(bot, makePhotoMsg(100, 1001));

        expect(bot.sendMessage).toHaveBeenCalledWith(
            100,
            expect.stringContaining('wrong'),
        );
    });

    test('TC-BB-19b: findOne returns null (ghost user) → no crash, no completion message', async () => {
        MockUser.findOne.mockResolvedValueOnce(null);

        await fireMessage(bot, makePhotoMsg(100, 1001));

        // sendMessage should NOT have been called with "Profile Complete"
        const completionCall = bot.sendMessage.mock.calls.find(c =>
            typeof c[1] === 'string' && c[1].includes('Profile Complete')
        );
        expect(completionCall).toBeUndefined();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 12: Cancel Setup (reply keyboard button, any step)
// ─────────────────────────────────────────────────────────────────────────────

describe('BLACK-BOX: "🚫 Cancel Setup" reply button', () => {
    let bot;
    let userStates;

    beforeEach(() => {
        jest.resetModules();
        bot = makeMockBot();
        userStates = new Map();
        userStates.set(1001, { onboarding: { step: 'age' } });
        const MockUser = makeMockUser();

        const { setupOnboardingCommands } = require('../../commands/onboarding');
        setupOnboardingCommands(bot, userStates, MockUser);
    });

    test('TC-BB-CS1: "🚫 Cancel Setup" text → clears state', async () => {
        await fireMessage(bot, makeTextMsg(100, 1001, '🚫 Cancel Setup'));

        expect(userStates.has(1001)).toBe(false);
    });

    test('TC-BB-CS2: "🚫 Cancel Setup" → sends "paused" message with MAIN_KEYBOARD', async () => {
        await fireMessage(bot, makeTextMsg(100, 1001, '🚫 Cancel Setup'));

        const call = bot.sendMessage.mock.calls[0];
        expect(call[1]).toContain('paused');
        const markup = call[2]?.reply_markup;
        expect(markup).toHaveProperty('keyboard');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 13: State guard — messages outside onboarding are ignored
// ─────────────────────────────────────────────────────────────────────────────

describe('BLACK-BOX: State guard', () => {
    let bot;
    let userStates;

    beforeEach(() => {
        jest.resetModules();
        bot = makeMockBot();
        userStates = new Map();   // empty — no onboarding state
        const MockUser = makeMockUser();

        const { setupOnboardingCommands } = require('../../commands/onboarding');
        setupOnboardingCommands(bot, userStates, MockUser);
    });

    test('TC-BB-20: Message with no state → completely ignored (no reply sent)', async () => {
        await fireMessage(bot, makeTextMsg(100, 9999, 'Hello!'));

        expect(bot.sendMessage).not.toHaveBeenCalled();
    });

    test('TC-BB-20b: Message for user with non-onboarding state → ignored', async () => {
        userStates.set(9999, { browsing: { page: 1 } }); // wrong state key
        await fireMessage(bot, makeTextMsg(100, 9999, 'Hello!'));

        expect(bot.sendMessage).not.toHaveBeenCalled();
    });

    test('TC-BB-20c: /command text → ignored by onboarding handler', async () => {
        userStates.set(1001, { onboarding: { step: 'name' } });
        await fireMessage(bot, makeTextMsg(100, 1001, '/profile'));

        expect(bot.sendMessage).not.toHaveBeenCalled();
    });
});
