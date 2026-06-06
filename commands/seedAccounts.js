/**
 * seedAccounts.js — Fake seed profiles for new-user engagement
 *
 * Seeds appear in new users' "Likes You" section.
 * If a new user likes a seed back, the seed sends a scripted opener.
 */

const SEED_IDS = ['seed_001', 'seed_002', 'seed_003', 'seed_004'];

const SEED_PROFILES = [
  {
    telegramId: 'seed_001',
    name: 'Sofia',
    gender: 'Female',
    age: 24,
    lookingFor: 'Male',
    bio: 'Coffee lover ☕ | Travel addict ✈️ | Looking for genuine connections',
    photos: [process.env.SEED_PHOTO_F1 || 'https://i.pravatar.cc/400?img=47'],
    location: 'London',
    profileCompleted: true,
    isSeedAccount: true,
    isVip: false,
    lastActive: new Date()
  },
  {
    telegramId: 'seed_002',
    name: 'James',
    gender: 'Male',
    age: 27,
    lookingFor: 'Female',
    bio: 'Gym & good vibes 💪 | Movie nights | Keeping it real',
    photos: [process.env.SEED_PHOTO_M1 || 'https://i.pravatar.cc/400?img=11'],
    location: 'Manchester',
    profileCompleted: true,
    isSeedAccount: true,
    isVip: false,
    lastActive: new Date()
  },
  {
    telegramId: 'seed_003',
    name: 'Amara',
    gender: 'Female',
    age: 26,
    lookingFor: 'Both',
    bio: 'Artist 🎨 | Dog mum 🐶 | Lover of all things creative',
    photos: [process.env.SEED_PHOTO_F2 || 'https://i.pravatar.cc/400?img=48'],
    location: 'Birmingham',
    profileCompleted: true,
    isSeedAccount: true,
    isVip: false,
    lastActive: new Date()
  },
  {
    telegramId: 'seed_004',
    name: 'Leo',
    gender: 'Male',
    age: 29,
    lookingFor: 'Both',
    bio: 'Chef by day, gamer by night 🎮 | Looking for someone fun to share life with',
    photos: [process.env.SEED_PHOTO_M2 || 'https://i.pravatar.cc/400?img=15'],
    location: 'Leeds',
    profileCompleted: true,
    isSeedAccount: true,
    isVip: false,
    lastActive: new Date()
  }
];

const SEED_OPENERS = [
  "Hey! 😊 I saw your profile and thought you seemed really interesting. What are you up to?",
  "Hi there! 👋 So glad we matched! How's your day going?",
  "Hey 😍 I really liked your profile! What kind of things do you enjoy doing?",
  "Oh wow, we matched! 🎉 I was hoping you'd like me back. Tell me something fun about yourself!",
  "Hey! So happy we matched 💕 I love your vibe. What's your favourite way to spend a weekend?",
  "Hi! 🌟 I love that we connected — what made you join KissuBot?",
  "Hey, so glad you liked me back! 😊 What are you looking for here?"
];

/**
 * Returns true if the given telegramId belongs to a seed account.
 */
function isSeedId(telegramId) {
  return SEED_IDS.includes(String(telegramId));
}

/**
 * Returns seed profiles compatible with a given user's gender/preference.
 */
function getCompatibleSeeds(newUser) {
  return SEED_PROFILES.filter(seed => {
    const seedGenderMatch =
      !newUser.lookingFor ||
      newUser.lookingFor === 'Both' ||
      newUser.lookingFor === 'Any' ||
      seed.gender === newUser.lookingFor;
    const seedInterested =
      seed.lookingFor === 'Both' ||
      seed.lookingFor === 'Any' ||
      seed.lookingFor === newUser.gender;
    return seedGenderMatch && seedInterested;
  });
}

/**
 * Returns up to `count` seed profiles compatible with the new user.
 */
function getSeedLikers(newUser, count) {
  const compatible = getCompatibleSeeds(newUser);
  return compatible.slice(0, count);
}

/**
 * Upserts all seed profiles into the DB. Safe to call on every startup.
 */
async function ensureSeedAccounts(User) {
  try {
    for (const profile of SEED_PROFILES) {
      await User.findOneAndUpdate(
        { telegramId: profile.telegramId },
        { $set: { ...profile, lastActive: new Date() } },
        { upsert: true, new: true }
      );
    }
    console.log('[SEEDS] ✅ Seed accounts ensured');
  } catch (err) {
    console.error('[SEEDS] Error ensuring seed accounts:', err.message);
  }
}

/**
 * Sends a random scripted opener from the seed to the target user
 * after a random 5–15 second delay (feels natural).
 */
function sendSeedOpener(bot, seedName, targetTelegramId) {
  const delayMs = 5000 + Math.floor(Math.random() * 10000);
  const opener = SEED_OPENERS[Math.floor(Math.random() * SEED_OPENERS.length)];
  setTimeout(() => {
    bot.sendMessage(
      String(targetTelegramId),
      `💬 *Message from ${seedName}:*\n\n_"${opener}"_`,
      { parse_mode: 'Markdown' }
    ).catch(() => {});
  }, delayMs);
}

module.exports = { SEED_IDS, ensureSeedAccounts, getSeedLikers, isSeedId, sendSeedOpener };
