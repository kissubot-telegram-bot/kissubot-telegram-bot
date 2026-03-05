/**
 * BLACK-BOX UNIT TESTS: commands/onboarding.js + commands/terms.js (accept_terms)
 *
 * Strategy: Feed the module mock messages / callback queries and assert
 * ONLY on what the bot sends back (outputs). We never inspect internals.
 *
 * Naming:  TC-BB-XX  (Black Box)
 * Numbering follows the implementation plan exactly.
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
        from: { id: telegramId },
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
        setupOnboardingCommands(bot, userStates, MockUser);

        // startOnboarding is exported via module.exports.startOnboarding inside
        // the setup function — grab it from the module after setup.
        startOnboarding = require('../../commands/onboarding').startOnboarding;
    });

    test('TC-BB-01: startOnboarding sends welcome message with "Let\'s Go" button', async () => {
        await startOnboarding(100, 1001);

        expect(bot.sendMessage).toHaveBeenCalledWith(
            100,
            expect.stringContaining('Welcome to KissuBot'),
            expect.objectContaining({
                reply_markup: expect.objectContaining({
                    inline_keyboard: expect.arrayContaining([
                        expect.arrayContaining([
                            expect.objectContaining({ callback_data: 'onboard_next_name' })
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

    test('TC-BB-02: onboard_next_name → sends name prompt (Step 1 of 5)', async () => {
        await fireCallbackQuery(bot, makeQuery(100, 1001, 'onboard_next_name'));

        const call = bot.sendMessage.mock.calls.find(c => c[1].includes('Step 1 of 5'));
        expect(call).toBeDefined();
        expect(call[0]).toBe(100);
    });

    test('TC-BB-02b: onboard_next_name callback includes Cancel button', async () => {
        await fireCallbackQuery(bot, makeQuery(100, 1001, 'onboard_next_name'));

        const call = bot.sendMessage.mock.calls.find(c => c[1].includes('Step 1 of 5'));
        expect(call[2]).toMatchObject({
            reply_markup: {
                inline_keyboard: expect.arrayContaining([
                    expect.arrayContaining([
                        expect.objectContaining({ callback_data: 'onboard_cancel' })
                    ])
                ])
            }
        });
    });

    test('TC-BB-02c: onboard_next_photo callback does NOT include Cancel button', async () => {
        await fireCallbackQuery(bot, makeQuery(100, 1001, 'onboard_next_photo'));

        const call = bot.sendMessage.mock.calls.find(c => c[1].includes('Step 5 of 5'));
        expect(call).toBeDefined();
        // Should NOT have an inline_keyboard with cancel
        const markup = call[2]?.reply_markup;
        const hasCancel = JSON.stringify(markup || {}).includes('onboard_cancel');
        expect(hasCancel).toBe(false);
    });

    test('TC-BB-02d: unknown onboard_next_* step is silently ignored', async () => {
        await fireCallbackQuery(bot, makeQuery(100, 1001, 'onboard_next_unknown_step'));
        expect(bot.sendMessage).not.toHaveBeenCalled();
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

    test('TC-BB-03c: onboard_cancel message includes "Complete Profile" and "Main Menu" buttons', async () => {
        await fireCallbackQuery(bot, makeQuery(100, 1001, 'onboard_cancel'));

        const call = bot.sendMessage.mock.calls[0];
        const markup = JSON.stringify(call[2]?.reply_markup || {});
        expect(markup).toContain('edit_profile');
        expect(markup).toContain('main_menu');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 3: Name step
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

    test('TC-BB-04: Valid name → greeting uses name, state advances to age', async () => {
        await fireMessage(bot, makeTextMsg(100, 1001, 'Alice'));

        const msg = bot.sendMessage.mock.calls[0][1];
        expect(msg).toContain('Alice');
        expect(userStates.get(1001)).toEqual({ onboarding: { step: 'age' } });
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

    test('TC-BB-04b: Valid name at boundary (2 chars) → accepted', async () => {
        await fireMessage(bot, makeTextMsg(100, 1001, 'Jo'));

        expect(userStates.get(1001)).toEqual({ onboarding: { step: 'age' } });
    });

    test('TC-BB-04c: Valid name at max boundary (50 chars) → accepted', async () => {
        await fireMessage(bot, makeTextMsg(100, 1001, 'C'.repeat(50)));

        expect(userStates.get(1001)).toEqual({ onboarding: { step: 'age' } });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 4: Age step
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
// Suite 5: Location step
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

    test('TC-BB-11: Valid location → state advances to bio', async () => {
        await fireMessage(bot, makeTextMsg(100, 1001, 'Lagos'));

        expect(userStates.get(1001)).toEqual({ onboarding: { step: 'bio' } });
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
        expect(userStates.get(1001)).toEqual({ onboarding: { step: 'bio' } });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 6: Bio step
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

    test('TC-BB-15c: Skipped bio reply contains "Skipped!"', async () => {
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
// Suite 7: Photo step
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

    test('TC-BB-17b: After valid photo → profileCompleted is set to true on saved doc', async () => {
        await fireMessage(bot, makePhotoMsg(100, 1001));

        expect(mockUserDoc.profileCompleted).toBe(true);
        expect(mockUserDoc.save).toHaveBeenCalled();
    });

    test('TC-BB-17c: After valid photo → user state is cleared', async () => {
        await fireMessage(bot, makePhotoMsg(100, 1001));

        expect(userStates.has(1001)).toBe(false);
    });

    test('TC-BB-17d: Completion message includes Start Browsing button', async () => {
        await fireMessage(bot, makePhotoMsg(100, 1001));

        const call = bot.sendMessage.mock.calls[0];
        const markup = JSON.stringify(call[2]?.reply_markup || {});
        expect(markup).toContain('start_browse');
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
// Suite 8: State guard — messages outside onboarding are ignored
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
});
