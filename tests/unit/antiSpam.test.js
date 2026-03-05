/**
 * WHITE-BOX UNIT TESTS: commands/antiSpam.js
 */

const { canLike, recordLike, canMessage, recordMessage, likeWaitSeconds } = require('../../commands/antiSpam');

// Use unique IDs per test to avoid state bleed between test cases
let id = 10000;
function uid() { return String(id++); }

describe('antiSpam — canLike / recordLike', () => {

    test('TC-AS-01: New user can like immediately', () => {
        expect(canLike(uid())).toBe(true);
    });

    test('TC-AS-02: After recordLike, canLike returns false within window', () => {
        const user = uid();
        expect(canLike(user)).toBe(true);
        recordLike(user);
        expect(canLike(user)).toBe(false);
    });

    test('TC-AS-03: Different users have independent rate limits', () => {
        const a = uid();
        const b = uid();
        recordLike(a);
        expect(canLike(a)).toBe(false);
        expect(canLike(b)).toBe(true);
    });

    test('TC-AS-04: likeWaitSeconds returns 0 for fresh user', () => {
        expect(likeWaitSeconds(uid())).toBe(0);
    });

    test('TC-AS-05: likeWaitSeconds > 0 immediately after recordLike', () => {
        const user = uid();
        recordLike(user);
        expect(likeWaitSeconds(user)).toBeGreaterThan(0);
    });

    test('TC-AS-06: likeWaitSeconds is at most 2 seconds after recordLike', () => {
        const user = uid();
        recordLike(user);
        expect(likeWaitSeconds(user)).toBeLessThanOrEqual(2);
    });
});

describe('antiSpam — canMessage / recordMessage', () => {

    test('TC-AS-10: New user can message', () => {
        expect(canMessage(uid())).toBe(true);
    });

    test('TC-AS-11: After 10 messages, canMessage returns false', () => {
        const user = uid();
        for (let i = 0; i < 10; i++) recordMessage(user);
        expect(canMessage(user)).toBe(false);
    });

    test('TC-AS-12: After 9 messages, canMessage still returns true', () => {
        const user = uid();
        for (let i = 0; i < 9; i++) recordMessage(user);
        expect(canMessage(user)).toBe(true);
    });

    test('TC-AS-13: Message limit is per-user (different users not affected)', () => {
        const a = uid();
        const b = uid();
        for (let i = 0; i < 10; i++) recordMessage(a);
        expect(canMessage(a)).toBe(false);
        expect(canMessage(b)).toBe(true);
    });
});
