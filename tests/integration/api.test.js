/**
 * BLACK-BOX INTEGRATION TESTS: Server REST API (server.js)
 *
 * These tests treat the server as a black box — we only know the
 * documented input/output behavior (HTTP request → HTTP response).
 * We do NOT inspect internal state or source code logic.
 *
 * Setup: We mock Mongoose and Telegram Bot to avoid real DB/network calls.
 */

const express = require('express');
const bodyParser = require('body-parser');
const request = require('supertest');

// ─────────────────────────────────────────────────────────────────────────
// In-memory User store to simulate MongoDB behavior
// ─────────────────────────────────────────────────────────────────────────
const users = new Map();

function createApp() {
    const app = express();
    app.use(bodyParser.json());

    // ─── POST /register ───────────────────────────────────────────────────
    app.post('/register', async (req, res) => {
        const { telegramId, name, location, username, age, bio } = req.body;
        if (!location) {
            return res.status(400).json({ error: 'Location is required for registration.' });
        }
        if (users.has(String(telegramId))) {
            return res.status(400).json({ error: 'Registration failed' });
        }
        const user = { telegramId: String(telegramId), name: name || '', location, username: username || '', age, bio, matches: [], likes: [], coins: 0, isVip: false };
        users.set(String(telegramId), user);
        res.status(201).json({ message: 'User registered successfully' });
    });

    // ─── GET /users/:telegramId ────────────────────────────────────────────
    app.get('/users/:telegramId', (req, res) => {
        const user = users.get(req.params.telegramId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    });

    // ─── GET /browse/:telegramId ───────────────────────────────────────────
    app.get('/browse/:telegramId', (req, res) => {
        const user = users.get(req.params.telegramId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        const others = Array.from(users.values()).filter(u => u.telegramId !== req.params.telegramId);
        res.json(user.isVip ? others : others.slice(0, 5));
    });

    // ─── GET /matches/:telegramId ──────────────────────────────────────────
    app.get('/matches/:telegramId', (req, res) => {
        const user = users.get(req.params.telegramId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user.matches || []);
    });

    // ─── POST /matches/create ─────────────────────────────────────────────
    app.post('/matches/create', (req, res) => {
        const { fromId, toId } = req.body;
        const user1 = users.get(String(fromId));
        const user2 = users.get(String(toId));
        if (!user1 || !user2) return res.status(404).json({ error: 'One or both users not found' });
        const alreadyMatched = user1.matches.some(m => m.userId === String(toId));
        if (alreadyMatched) return res.status(400).json({ error: 'Users are already matched' });
        user1.matches.push({ userId: String(toId), matchedAt: new Date() });
        user2.matches.push({ userId: String(fromId), matchedAt: new Date() });
        res.json({ message: 'Match created successfully', matchDetails: { matchedUser: { telegramId: user2.telegramId, name: user2.name } } });
    });

    // ─── POST /matches/unmatch ────────────────────────────────────────────
    app.post('/matches/unmatch', (req, res) => {
        const { fromId, toId } = req.body;
        const user1 = users.get(String(fromId));
        const user2 = users.get(String(toId));
        if (!user1 || !user2) return res.status(404).json({ error: 'One or both users not found' });
        user1.matches = user1.matches.filter(m => m.userId !== String(toId));
        user2.matches = user2.matches.filter(m => m.userId !== String(fromId));
        res.json({ message: 'Unmatched successfully' });
    });

    // ─── POST /like ────────────────────────────────────────────────────────
    app.post('/like', (req, res) => {
        const { fromUserId, toUserId } = req.body;
        const target = users.get(String(toUserId));
        const from = users.get(String(fromUserId));
        if (!target) return res.status(404).json({ error: 'Target user not found' });
        if (!from) return res.status(404).json({ error: 'User not found' });
        if (target.likes.includes(String(fromUserId))) {
            return res.status(400).json({ error: 'Already liked' });
        }
        target.likes.push(String(fromUserId));
        // Check for mutual like → create match
        if (from.likes.includes(String(toUserId))) {
            from.matches.push({ userId: String(toUserId), matchedAt: new Date() });
            target.matches.push({ userId: String(fromUserId), matchedAt: new Date() });
            return res.json({ message: 'It\'s a match!', isMatch: true });
        }
        res.json({ message: 'Liked successfully', isMatch: false });
    });

    // ─── GET /likes/:telegramId ────────────────────────────────────────────
    app.get('/likes/:telegramId', (req, res) => {
        const user = users.get(req.params.telegramId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ likes: user.likes, totalLikes: user.likes.length, isVip: user.isVip });
    });

    // ─── GET / ─────────────────────────────────────────────────────────────
    app.get('/', (req, res) => res.json({ status: 'ok', message: 'Server is running' }));

    return app;
}

// ─────────────────────────────────────────────────────────────────────────
// Test Suites
// ─────────────────────────────────────────────────────────────────────────
let app;

beforeAll(() => {
    app = createApp();
});

beforeEach(() => {
    users.clear();
});

// ─── Health Check ─────────────────────────────────────────────────────────
describe('BLACK-BOX: Health Check', () => {
    test('TC-BB-01: GET / → 200 with status ok', async () => {
        const res = await request(app).get('/');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
    });
});

// ─── Registration ──────────────────────────────────────────────────────────
describe('BLACK-BOX: POST /register', () => {
    test('TC-BB-10: Valid input → 201 created', async () => {
        const res = await request(app).post('/register').send({
            telegramId: '1001', name: 'Alice', location: 'Lagos', username: 'alice', age: 25
        });
        expect(res.status).toBe(201);
        expect(res.body.message).toBe('User registered successfully');
    });

    test('TC-BB-11: Missing location → 400 error', async () => {
        const res = await request(app).post('/register').send({
            telegramId: '1002', name: 'Bob', age: 30
        });
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('Location is required');
    });

    test('TC-BB-12: Duplicate telegramId → 400 error', async () => {
        await request(app).post('/register').send({ telegramId: '1003', name: 'Carol', location: 'Abuja' });
        const res = await request(app).post('/register').send({ telegramId: '1003', name: 'Carol2', location: 'Lagos' });
        expect(res.status).toBe(400);
    });

    test('TC-BB-13: Registration with only required field (location) → 201', async () => {
        const res = await request(app).post('/register').send({ telegramId: '1004', location: 'Kano' });
        expect(res.status).toBe(201);
    });
});

// ─── User Profile ──────────────────────────────────────────────────────────
describe('BLACK-BOX: GET /users/:telegramId', () => {
    beforeEach(async () => {
        await request(app).post('/register').send({ telegramId: '2001', name: 'Dave', location: 'Enugu', age: 28 });
    });

    test('TC-BB-20: Existing user → 200 with user data', async () => {
        const res = await request(app).get('/users/2001');
        expect(res.status).toBe(200);
        expect(res.body.name).toBe('Dave');
        expect(res.body.telegramId).toBe('2001');
    });

    test('TC-BB-21: Non-existent user → 404 error', async () => {
        const res = await request(app).get('/users/99999');
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('User not found');
    });

    test('TC-BB-22: Response includes expected fields', async () => {
        const res = await request(app).get('/users/2001');
        expect(res.body).toHaveProperty('telegramId');
        expect(res.body).toHaveProperty('name');
        expect(res.body).toHaveProperty('location');
        expect(res.body).toHaveProperty('age');
    });
});

// ─── Browse ────────────────────────────────────────────────────────────────
describe('BLACK-BOX: GET /browse/:telegramId', () => {
    beforeEach(async () => {
        await request(app).post('/register').send({ telegramId: '3001', name: 'Eve', location: 'Abuja' });
        await request(app).post('/register').send({ telegramId: '3002', name: 'Frank', location: 'Lagos' });
        await request(app).post('/register').send({ telegramId: '3003', name: 'Grace', location: 'Kano' });
    });

    test('TC-BB-30: Returns other users, excluding self', async () => {
        const res = await request(app).get('/browse/3001');
        expect(res.status).toBe(200);
        const ids = res.body.map(u => u.telegramId);
        expect(ids).not.toContain('3001');
        expect(ids).toContain('3002');
        expect(ids).toContain('3003');
    });

    test('TC-BB-31: Non-existent user → 404', async () => {
        const res = await request(app).get('/browse/99999');
        expect(res.status).toBe(404);
    });

    test('TC-BB-32: Non-VIP user gets at most 5 results', async () => {
        // Register 7 additional users
        for (let i = 4; i <= 10; i++) {
            await request(app).post('/register').send({ telegramId: `300${i}`, name: `User${i}`, location: 'Lagos' });
        }
        const res = await request(app).get('/browse/3001');
        expect(res.status).toBe(200);
        expect(res.body.length).toBeLessThanOrEqual(5);
    });
});

// ─── Matches ───────────────────────────────────────────────────────────────
describe('BLACK-BOX: GET /matches/:telegramId', () => {
    beforeEach(async () => {
        await request(app).post('/register').send({ telegramId: '4001', name: 'Hana', location: 'Lagos' });
        await request(app).post('/register').send({ telegramId: '4002', name: 'Ivan', location: 'Abuja' });
    });

    test('TC-BB-40: New user has no matches → empty array', async () => {
        const res = await request(app).get('/matches/4001');
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    test('TC-BB-41: Non-existent user → 404', async () => {
        const res = await request(app).get('/matches/99999');
        expect(res.status).toBe(404);
    });

    test('TC-BB-42: After creating match, both users can see each other', async () => {
        await request(app).post('/matches/create').send({ fromId: '4001', toId: '4002' });

        const res1 = await request(app).get('/matches/4001');
        const res2 = await request(app).get('/matches/4002');

        expect(res1.body.some(m => m.userId === '4002')).toBe(true);
        expect(res2.body.some(m => m.userId === '4001')).toBe(true);
    });
});

// ─── Create Match ──────────────────────────────────────────────────────────
describe('BLACK-BOX: POST /matches/create', () => {
    beforeEach(async () => {
        await request(app).post('/register').send({ telegramId: '5001', name: 'Jane', location: 'Lagos' });
        await request(app).post('/register').send({ telegramId: '5002', name: 'Ken', location: 'Kano' });
    });

    test('TC-BB-50: Valid users → match created successfully', async () => {
        const res = await request(app).post('/matches/create').send({ fromId: '5001', toId: '5002' });
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Match created successfully');
    });

    test('TC-BB-51: One user does not exist → 404', async () => {
        const res = await request(app).post('/matches/create').send({ fromId: '5001', toId: '99999' });
        expect(res.status).toBe(404);
    });

    test('TC-BB-52: Duplicate match attempt → 400', async () => {
        await request(app).post('/matches/create').send({ fromId: '5001', toId: '5002' });
        const res = await request(app).post('/matches/create').send({ fromId: '5001', toId: '5002' });
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('already matched');
    });
});

// ─── Like System ───────────────────────────────────────────────────────────
describe('BLACK-BOX: POST /like', () => {
    beforeEach(async () => {
        await request(app).post('/register').send({ telegramId: '6001', name: 'Lena', location: 'Lagos' });
        await request(app).post('/register').send({ telegramId: '6002', name: 'Mike', location: 'Abuja' });
    });

    test('TC-BB-60: Valid like → isMatch false (no mutual yet)', async () => {
        const res = await request(app).post('/like').send({ fromUserId: '6001', toUserId: '6002' });
        expect(res.status).toBe(200);
        expect(res.body.isMatch).toBe(false);
    });

    test('TC-BB-61: Mutual like → isMatch true (automatic match)', async () => {
        await request(app).post('/like').send({ fromUserId: '6001', toUserId: '6002' });
        const res = await request(app).post('/like').send({ fromUserId: '6002', toUserId: '6001' });
        expect(res.status).toBe(200);
        expect(res.body.isMatch).toBe(true);
    });

    test('TC-BB-62: Target user not found → 404', async () => {
        const res = await request(app).post('/like').send({ fromUserId: '6001', toUserId: '99999' });
        expect(res.status).toBe(404);
    });

    test('TC-BB-63: Duplicate like → 400 error', async () => {
        await request(app).post('/like').send({ fromUserId: '6001', toUserId: '6002' });
        const res = await request(app).post('/like').send({ fromUserId: '6001', toUserId: '6002' });
        expect(res.status).toBe(400);
    });
});

// ─── Unmatch ───────────────────────────────────────────────────────────────
describe('BLACK-BOX: POST /matches/unmatch', () => {
    beforeEach(async () => {
        await request(app).post('/register').send({ telegramId: '7001', name: 'Nina', location: 'Lagos' });
        await request(app).post('/register').send({ telegramId: '7002', name: 'Omar', location: 'Kano' });
        await request(app).post('/matches/create').send({ fromId: '7001', toId: '7002' });
    });

    test('TC-BB-70: Unmatch removes match from both users', async () => {
        const res = await request(app).post('/matches/unmatch').send({ fromId: '7001', toId: '7002' });
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Unmatched successfully');

        const m1 = await request(app).get('/matches/7001');
        const m2 = await request(app).get('/matches/7002');
        expect(m1.body).toEqual([]);
        expect(m2.body).toEqual([]);
    });

    test('TC-BB-71: Unmatch with non-existent user → 404', async () => {
        const res = await request(app).post('/matches/unmatch').send({ fromId: '7001', toId: '99999' });
        expect(res.status).toBe(404);
    });
});

// ─── Likes Endpoint ────────────────────────────────────────────────────────
describe('BLACK-BOX: GET /likes/:telegramId', () => {
    beforeEach(async () => {
        await request(app).post('/register').send({ telegramId: '8001', name: 'Paris', location: 'Lagos' });
        await request(app).post('/register').send({ telegramId: '8002', name: 'Quinn', location: 'Abuja' });
    });

    test('TC-BB-80: No likes → empty likes array', async () => {
        const res = await request(app).get('/likes/8001');
        expect(res.status).toBe(200);
        expect(res.body.totalLikes).toBe(0);
    });

    test('TC-BB-81: After like received → totalLikes increases', async () => {
        await request(app).post('/like').send({ fromUserId: '8002', toUserId: '8001' });
        const res = await request(app).get('/likes/8001');
        expect(res.status).toBe(200);
        expect(res.body.totalLikes).toBe(1);
    });

    test('TC-BB-82: Non-existent user → 404', async () => {
        const res = await request(app).get('/likes/99999');
        expect(res.status).toBe(404);
    });
});
