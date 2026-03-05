/**
 * antiSpam.js — In-memory sliding-window rate limiter
 * 
 * Limits:
 *   Likes    → max 1 per 1.5 seconds per user
 *   Messages → max 10 per 60 seconds per user (prevents mass-messaging)
 */

const likeTimestamps = new Map();    // telegramId → [timestamps]
const messageTimestamps = new Map(); // telegramId → [timestamps]

const LIKE_WINDOW_MS = 1500;       // 1.5 seconds between likes
const MESSAGE_WINDOW_MS = 60000;   // 60 second window
const MESSAGE_LIMIT = 10;          // max messages in window

/**
 * Returns true if the user is allowed to like (not rate-limited).
 */
function canLike(telegramId) {
    const id = String(telegramId);
    const now = Date.now();
    const timestamps = likeTimestamps.get(id) || [];
    const recent = timestamps.filter(t => now - t < LIKE_WINDOW_MS);
    return recent.length === 0;
}

/**
 * Records a like action for the user.
 */
function recordLike(telegramId) {
    const id = String(telegramId);
    const now = Date.now();
    const timestamps = likeTimestamps.get(id) || [];
    // Keep only recent timestamps to avoid memory leak
    const recent = timestamps.filter(t => now - t < LIKE_WINDOW_MS * 10);
    recent.push(now);
    likeTimestamps.set(id, recent);
}

/**
 * Returns true if the user is allowed to send a bot-mediated message event
 * (e.g. super like notification). Prevents spamming many users.
 */
function canMessage(telegramId) {
    const id = String(telegramId);
    const now = Date.now();
    const timestamps = messageTimestamps.get(id) || [];
    const recent = timestamps.filter(t => now - t < MESSAGE_WINDOW_MS);
    return recent.length < MESSAGE_LIMIT;
}

/**
 * Records a message action for the user.
 */
function recordMessage(telegramId) {
    const id = String(telegramId);
    const now = Date.now();
    const timestamps = messageTimestamps.get(id) || [];
    const recent = timestamps.filter(t => now - t < MESSAGE_WINDOW_MS);
    recent.push(now);
    messageTimestamps.set(id, recent);
}

/**
 * How many seconds until the user can like again.
 * Returns 0 if they can like now.
 */
function likeWaitSeconds(telegramId) {
    const id = String(telegramId);
    const now = Date.now();
    const timestamps = likeTimestamps.get(id) || [];
    const recent = timestamps.filter(t => now - t < LIKE_WINDOW_MS);
    if (recent.length === 0) return 0;
    const oldest = Math.min(...recent);
    return Math.ceil((LIKE_WINDOW_MS - (now - oldest)) / 1000);
}

module.exports = { canLike, recordLike, canMessage, recordMessage, likeWaitSeconds };
