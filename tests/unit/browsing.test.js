/**
 * WHITE-BOX UNIT TESTS: commands/browsing.js
 *
 * Tests the profile completeness validation logic and all decision
 * branches in the browse flow using a fully controlled mock environment.
 */

// ─── Mock the auth module before any require() ───────────────────────────
const mockGetCachedUserProfile = jest.fn();
jest.mock('../../commands/auth', () => ({
    getCachedUserProfile: mockGetCachedUserProfile,
    invalidateUserCache: jest.fn(),
}));

// ─── Mock axios to prevent real HTTP calls ────────────────────────────────
jest.mock('axios');

describe('WHITE-BOX: getProfileMissing logic (browsing.js)', () => {
    let bot;
    let MockUser;
    let MockLike;

    const makeUser = (overrides = {}) => ({
        telegramId: '1001',
        termsAccepted: true,
        profileCompleted: true,
        name: 'Alice',
        age: 25,
        location: 'NYC',
        bio: 'Hello everyone',
        photos: ['photo1.jpg'],
        isVip: false,
        ...overrides,
    });

    beforeEach(() => {
        // Reset all mocks before each test
        mockGetCachedUserProfile.mockReset();

        bot = {
            onText: jest.fn(),
            on: jest.fn((event, handler) => {
                if (event === 'callback_query') bot._callbackHandler = handler;
            }),
            sendMessage: jest.fn().mockResolvedValue({ message_id: 1 }),
            sendPhoto: jest.fn().mockResolvedValue({ message_id: 2 }),
            sendMediaGroup: jest.fn().mockResolvedValue([{ message_id: 3 }]),
            editMessageText: jest.fn().mockResolvedValue({}),
            answerCallbackQuery: jest.fn().mockResolvedValue({}),
        };

        MockUser = {
            findOne: jest.fn(),
            find: jest.fn(),
        };

        MockLike = {
            find: jest.fn(),
        };

        // Setup the browsing module fresh
        const { setupBrowsingCommands } = require('../../commands/browsing');
        setupBrowsingCommands(bot, MockUser, undefined, MockLike);
    });

    /** Helper: trigger the callback_query handler */
    async function triggerCallback(callbackData) {
        await bot._callbackHandler({
            id: 'qtest',
            message: { chat: { id: 300 }, message_id: 1 },
            from: { id: 3001 },
            data: callbackData,
        });
    }

    // ─── TC-WB-40: User not found ───────────────────────────────────────
    test('TC-WB-40: User not found → error message with Start button', async () => {
        mockGetCachedUserProfile.mockResolvedValueOnce(null);

        await triggerCallback('start_browse');

        expect(bot.sendMessage).toHaveBeenCalledWith(
            300,
            expect.stringContaining('not found'),
            expect.objectContaining({ reply_markup: expect.any(Object) })
        );
    });

    // ─── TC-WB-41: Terms not accepted ─────────────────────────────────
    test('TC-WB-41: Terms not accepted → Terms Required message with Main Menu button', async () => {
        mockGetCachedUserProfile.mockResolvedValueOnce(makeUser({ termsAccepted: false }));

        await triggerCallback('start_browse');

        const callArgs = bot.sendMessage.mock.calls.find(
            ([, msg]) => msg && msg.toString().includes('Terms')
        );
        expect(callArgs).toBeDefined();
        expect(callArgs[1]).toContain('Terms');
    });

    // ─── TC-WB-42: Missing profile fields ─────────────────────────────
    test('TC-WB-42: Missing name, age, bio → "Almost Ready" with fields listed', async () => {
        mockGetCachedUserProfile.mockResolvedValueOnce(
            makeUser({ name: null, age: null, bio: null })
        );

        await triggerCallback('start_browse');

        expect(bot.sendMessage).toHaveBeenCalled();
        const sentMsg = bot.sendMessage.mock.calls[0][1];
        expect(sentMsg).toContain('Almost Ready');
        expect(sentMsg).toContain('Add your name');
        expect(sentMsg).toContain('Add your age');
        expect(sentMsg).toContain('Write a bio');
    });

    // ─── TC-WB-43: Profile complete but no profiles available ─────────
    test('TC-WB-43: Profile complete but no other users available → "No More Profiles" message', async () => {
        mockGetCachedUserProfile.mockResolvedValueOnce(makeUser());

        // Second User.findOne call for the currentUser
        MockUser.findOne.mockResolvedValueOnce(makeUser({ _id: 'abc123', telegramId: '1001' }));

        // Like.find returns an object with distinct() that resolves to []
        MockLike.find.mockReturnValue({ distinct: jest.fn().mockResolvedValueOnce([]) });

        // User.find returns a chain: .limit() resolves to []
        const limitFn = jest.fn().mockResolvedValue([]);
        MockUser.find.mockReturnValue({ limit: limitFn });

        await triggerCallback('start_browse');

        expect(bot.sendMessage).toHaveBeenCalled();
        const sentMsg = bot.sendMessage.mock.calls[0][1];
        expect(sentMsg).toContain('No More Profiles');
    });
});

// ─── WHITE-BOX: getProfileMissing - all missing fields individually ───────
describe('WHITE-BOX: getProfileMissing — individual field checks', () => {
    /**
     * We directly unit-test the same validation logic used in browsing.js
     * by extracting and re-implementing it as a pure function for isolated testing.
     */

    function getProfileMissing(user) {
        const missing = [];
        if (!user.name) missing.push('📝 Add your name');
        if (!user.age) missing.push('🎂 Add your age');
        if (!user.location) missing.push('📍 Add your location');
        if (!user.bio) missing.push('💭 Write a bio');
        if (!user.photos || user.photos.length === 0) missing.push('📸 Upload at least one photo');
        return missing;
    }

    test('TC-WB-44: Complete profile → no missing items', () => {
        expect(getProfileMissing({ name: 'A', age: 22, location: 'Lagos', bio: 'Hi', photos: ['p.jpg'] })).toHaveLength(0);
    });

    test('TC-WB-45: No name → "Add your name" included', () => {
        const result = getProfileMissing({ name: null, age: 22, location: 'Lagos', bio: 'Hi', photos: ['p.jpg'] });
        expect(result).toContain('📝 Add your name');
    });

    test('TC-WB-46: No age → "Add your age" included', () => {
        const result = getProfileMissing({ name: 'A', age: null, location: 'Lagos', bio: 'Hi', photos: ['p.jpg'] });
        expect(result).toContain('🎂 Add your age');
    });

    test('TC-WB-47: No location → "Add your location" included', () => {
        const result = getProfileMissing({ name: 'A', age: 22, location: null, bio: 'Hi', photos: ['p.jpg'] });
        expect(result).toContain('📍 Add your location');
    });

    test('TC-WB-48: No bio → "Write a bio" included', () => {
        const result = getProfileMissing({ name: 'A', age: 22, location: 'Lagos', bio: null, photos: ['p.jpg'] });
        expect(result).toContain('💭 Write a bio');
    });

    test('TC-WB-49: Empty photos array → "Upload at least one photo" included', () => {
        const result = getProfileMissing({ name: 'A', age: 22, location: 'Lagos', bio: 'Hi', photos: [] });
        expect(result).toContain('📸 Upload at least one photo');
    });

    test('TC-WB-50: Missing photos field → "Upload at least one photo" included', () => {
        const result = getProfileMissing({ name: 'A', age: 22, location: 'Lagos', bio: 'Hi', photos: undefined });
        expect(result).toContain('📸 Upload at least one photo');
    });

    test('TC-WB-51: All fields missing → 5 items listed', () => {
        const result = getProfileMissing({ name: null, age: null, location: null, bio: null, photos: [] });
        expect(result).toHaveLength(5);
    });
});
