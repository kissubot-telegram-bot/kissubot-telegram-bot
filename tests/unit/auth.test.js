/**
 * WHITE-BOX UNIT TESTS: commands/auth.js
 *
 * Tests the internal logic of user profile caching and the /start
 * command flow without needing a real Telegram connection or database.
 */

// Reset modules between tests to get a clean cache state
jest.resetModules();

// ────────────────────────────────────────────────────────────────────────────
// Module-level helpers (extracted for unit testing)
// ────────────────────────────────────────────────────────────────────────────

// We test the exported functions: getCachedUserProfile and invalidateUserCache
// by mocking the User model (mongoose model)

describe('WHITE-BOX: getCachedUserProfile (auth.js)', () => {
    let getCachedUserProfile;
    let invalidateUserCache;

    // Stub User model
    const mockUser = { telegramId: '111', name: 'Alice', age: 25 };
    const MockUser = {
        findOne: jest.fn(),
    };

    beforeEach(() => {
        jest.resetModules();
        // Re-require fresh module so cache is empty
        const auth = require('../../commands/auth');
        getCachedUserProfile = auth.getCachedUserProfile;
        invalidateUserCache = auth.invalidateUserCache;
        MockUser.findOne.mockReset();
    });

    test('TC-WB-01: Returns user from DB on first call and caches it', async () => {
        MockUser.findOne.mockResolvedValueOnce(mockUser);

        const result = await getCachedUserProfile('111', MockUser);

        expect(result).toEqual(mockUser);
        expect(MockUser.findOne).toHaveBeenCalledTimes(1);
        expect(MockUser.findOne).toHaveBeenCalledWith({ telegramId: '111' });
    });

    test('TC-WB-02: Returns cached user on second call (no extra DB hit)', async () => {
        MockUser.findOne.mockResolvedValueOnce(mockUser);

        await getCachedUserProfile('111', MockUser); // First call — DB hit
        const result = await getCachedUserProfile('111', MockUser); // Second call — cache

        expect(result).toEqual(mockUser);
        expect(MockUser.findOne).toHaveBeenCalledTimes(1); // Only ONE DB call
    });

    test('TC-WB-03: Returns null when user does not exist in DB', async () => {
        MockUser.findOne.mockResolvedValueOnce(null);

        const result = await getCachedUserProfile('999', MockUser);

        expect(result).toBeNull();
    });

    test('TC-WB-04: invalidateUserCache clears cache, next call hits DB again', async () => {
        MockUser.findOne
            .mockResolvedValueOnce(mockUser) // First call
            .mockResolvedValueOnce({ ...mockUser, name: 'AliceUpdated' }); // After invalidation

        await getCachedUserProfile('111', MockUser);
        invalidateUserCache('111');
        const result = await getCachedUserProfile('111', MockUser);

        expect(result.name).toBe('AliceUpdated');
        expect(MockUser.findOne).toHaveBeenCalledTimes(2);
    });

    test('TC-WB-05: Multiple different users are cached independently', async () => {
        const userA = { telegramId: '111', name: 'Alice' };
        const userB = { telegramId: '222', name: 'Bob' };
        MockUser.findOne
            .mockResolvedValueOnce(userA)
            .mockResolvedValueOnce(userB);

        const resultA = await getCachedUserProfile('111', MockUser);
        const resultB = await getCachedUserProfile('222', MockUser);

        expect(resultA.name).toBe('Alice');
        expect(resultB.name).toBe('Bob');
        expect(MockUser.findOne).toHaveBeenCalledTimes(2);
    });

    test('TC-WB-06: DB error is propagated correctly', async () => {
        MockUser.findOne.mockRejectedValueOnce(new Error('DB connection failed'));

        await expect(getCachedUserProfile('111', MockUser))
            .rejects.toThrow('DB connection failed');
    });
});

// ────────────────────────────────────────────────────────────────────────────
// Testing /start command bot message flow via mock bot
// ────────────────────────────────────────────────────────────────────────────

describe('WHITE-BOX: setupAuthCommands /start flow', () => {
    let setupAuthCommands;
    let bot;
    let MockUser;

    beforeEach(() => {
        jest.resetModules();

        // Create a mock bot that records sent messages
        bot = {
            onText: jest.fn((pattern, handler) => {
                // Store handlers for manual invocation
                if (!bot._handlers) bot._handlers = [];
                bot._handlers.push({ pattern, handler });
            }),
            on: jest.fn(),
            sendMessage: jest.fn().mockResolvedValue({}),
            emit: jest.fn(),
        };

        MockUser = { findOne: jest.fn() };

        const auth = require('../../commands/auth');
        setupAuthCommands = auth.setupAuthCommands;
        setupAuthCommands(bot, new Map(), MockUser);
    });

    /**
     * Helper: find and call the /start handler with a mock message
     */
    async function callStartHandler(msg) {
        const startEntry = bot._handlers.find(h => h.pattern.toString().includes('start'));
        expect(startEntry).toBeDefined();
        await startEntry.handler(msg);
    }

    const makeMsg = (chatId, telegramId) => ({
        chat: { id: chatId },
        from: { id: telegramId, first_name: 'TestUser', username: 'testuser' },
        text: '/start',
    });

    test('TC-WB-10: New user (no record) → Terms message shown', async () => {
        MockUser.findOne.mockResolvedValueOnce(null);

        await callStartHandler(makeMsg(100, 1001));

        expect(bot.sendMessage).toHaveBeenCalledWith(
            100,
            expect.stringContaining('Terms of Service'),
            expect.objectContaining({ reply_markup: expect.any(Object) })
        );
    });

    test('TC-WB-11: User exists but has not accepted terms → Terms message shown', async () => {
        MockUser.findOne.mockResolvedValueOnce({ termsAccepted: false, profileCompleted: false });

        await callStartHandler(makeMsg(100, 1001));

        expect(bot.sendMessage).toHaveBeenCalledWith(
            100,
            expect.stringContaining('Terms of Service'),
            expect.any(Object)
        );
    });

    test('TC-WB-12: User accepted terms but profile incomplete → Incomplete profile message', async () => {
        MockUser.findOne.mockResolvedValueOnce({
            termsAccepted: true,
            profileCompleted: false,
            name: null,
            age: null,
            location: null,
            bio: null,
            photos: [],
        });

        await callStartHandler(makeMsg(100, 1001));

        expect(bot.sendMessage).toHaveBeenCalledWith(
            100,
            expect.stringContaining('Missing'),
            expect.objectContaining({ reply_markup: expect.any(Object) })
        );
    });

    test('TC-WB-13: User is fully onboarded → Main menu is shown (sendMessage called)', async () => {
        MockUser.findOne.mockResolvedValueOnce({
            termsAccepted: true,
            profileCompleted: true,
        });

        await callStartHandler(makeMsg(100, 1001));

        expect(bot.sendMessage).toHaveBeenCalled();
        // Main menu should include browse/discover buttons
        const callArgs = bot.sendMessage.mock.calls[0];
        expect(callArgs[0]).toBe(100);
    });

    test('TC-WB-14: DB error during /start → Error message sent to user', async () => {
        MockUser.findOne.mockRejectedValueOnce(new Error('Connection timeout'));

        await callStartHandler(makeMsg(100, 1001));

        expect(bot.sendMessage).toHaveBeenCalledWith(
            100,
            expect.stringContaining('wrong')
        );
    });
});
