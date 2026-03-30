/**
 * keyboard.js — Shared Reply Keyboard definitions
 *
 * The MAIN_KEYBOARD is the persistent bottom navigation shown to all
 * registered users. It replaces the device keyboard with nav buttons.
 * Text-input steps (name, age, bio, location) must send { remove_keyboard: true }
 * to hide it so the user can type normally.
 */

const MAIN_KEYBOARD = {
  keyboard: [
    [{ text: '🔍 Discover' }],
    [{ text: '💕 Matches' }, { text: '👤 My Profile' }],
    [{ text: '⚙️ Settings' }, { text: '💎 VIP' }],
    [{ text: '🆘 Help' }]
  ],
  resize_keyboard: true,
  persistent: true
};

/** Texts that belong to the main nav keyboard — used to skip state handlers */
const MAIN_KB_BUTTONS = [
  '🔍 Discover',
  '💕 Matches',
  '👤 My Profile',
  '⚙️ Settings',
  '💎 VIP',
  '🆘 Help'
];

const PROFILE_KEYBOARD = {
  keyboard: [
    [{ text: '📝 Edit Name' }, { text: '🎂 Edit Age' }],
    [{ text: '👤 Edit Gender' }, { text: '👀 Looking For' }],
    [{ text: '📍 Edit Location' }, { text: '💬 Edit Bio' }],
    [{ text: '📞 Phone' }, { text: '📸 Photos' }],
    [{ text: '🔙 Back' }]
  ],
  resize_keyboard: true
};

const PROFILE_KB_BUTTONS = [
  '📝 Edit Name', '🎂 Edit Age',
  '👤 Edit Gender', '👀 Looking For',
  '📍 Edit Location', '💬 Edit Bio',
  '📞 Phone', '📸 Photos',
  '🔙 Back'
];

const SETTINGS_KEYBOARD = {
  keyboard: [
    [{ text: '👤 Profile Info' }, { text: '🔍 Search Preferences' }],
    [{ text: '🔔 Notifications' }, { text: '🔒 Privacy' }],
    [{ text: '❓ Help Center' }, { text: '🏠 Main Menu' }]
  ],
  resize_keyboard: true
};
const SETTINGS_KB_BUTTONS = ['👤 Profile Info', '🔍 Search Preferences', '🔔 Notifications', '🔒 Privacy', '❓ Help Center'];

const SEARCH_KEYBOARD = {
  keyboard: [
    [{ text: '🎂 Age Range' }, { text: '📍 Distance' }],
    [{ text: '👥 Gender Preference' }, { text: '🚫 Toggle Hide Liked' }],
    [{ text: '🔄 Reset Browse History' }, { text: '⚙️ Back to Settings' }]
  ],
  resize_keyboard: true
};
const SEARCH_KB_BUTTONS = ['🎂 Age Range', '📍 Distance', '👥 Gender Preference', '🚫 Toggle Hide Liked', '🔄 Reset Browse History', '⚙️ Back to Settings'];

const HELP_KEYBOARD = {
  keyboard: [
    [{ text: '👤 Profile Help' }, { text: '🔍 Browsing Help' }],
    [{ text: '👑 VIP & Coins' }, { text: '📱 Stories Help' }],
    [{ text: '📞 Contact Support' }, { text: '🚨 Report Center' }],
    [{ text: '🏠 Main Menu' }]
  ],
  resize_keyboard: true
};
const HELP_KB_BUTTONS = ['👤 Profile Help', '🔍 Browsing Help', '👑 VIP & Coins', '📱 Stories Help', '📞 Contact Support', '🚨 Report Center'];

const REPORT_KEYBOARD = {
  keyboard: [
    [{ text: '👤 Report a User' }, { text: '📸 Report Content' }],
    [{ text: '🐛 Report Bug' }, { text: '💡 Feature Request' }],
    [{ text: '🆘 Back to Help' }]
  ],
  resize_keyboard: true,
  one_time_keyboard: true
};
const REPORT_KB_BUTTONS = ['👤 Report a User', '📸 Report Content', '🐛 Report Bug', '💡 Feature Request', '🆘 Back to Help'];

const VIP_KEYBOARD = {
  keyboard: [
    [{ text: '👑 Get VIP' }, { text: '📊 My Subscription' }],
    [{ text: '💎 VIP Features' }, { text: '🎁 Gift VIP' }],
    [{ text: '🏠 Main Menu' }]
  ],
  resize_keyboard: true
};
const VIP_KB_BUTTONS = ['👑 Get VIP', '📊 My Subscription', '💎 VIP Features', '🎁 Gift VIP'];

const GIFTS_KEYBOARD = {
  keyboard: [
    [{ text: '🎁 Send a Gift' }, { text: '📨 My Sent Gifts' }],
    [{ text: '📬 My Received Gifts' }, { text: '🏠 Main Menu' }]
  ],
  resize_keyboard: true
};
const GIFTS_KB_BUTTONS = ['🎁 Send a Gift', '📨 My Sent Gifts', '📬 My Received Gifts'];

// ── VIP Plan Selection (Stars payment) ──────────────────────────────────────
const VIP_PLANS_KEYBOARD = {
  keyboard: [
    [{ text: '📆 1 Month — 749 ⭐' }],
    [{ text: '📅 6 Months — 2,490 ⭐  (save 44%)' }],
    [{ text: '🎯 1 Year — 3,490 ⭐  (save 58%)' }],
    [{ text: '🪙 Pay with Coins Instead' }],
    [{ text: '💎 VIP' }]
  ],
  resize_keyboard: true
};
const VIP_PLANS_KB_BUTTONS = [
  '📆 1 Month — 749 ⭐',
  '📅 6 Months — 2,490 ⭐  (save 44%)',
  '🎯 1 Year — 3,490 ⭐  (save 58%)',
  '🪙 Pay with Coins Instead'
];

// ── VIP Plan Selection (Coins payment) ──────────────────────────────────────
const COIN_VIP_PLANS_KEYBOARD = {
  keyboard: [
    [{ text: '🪙 1 Month VIP — 1,000 coins' }],
    [{ text: '🪙 6 Months VIP — 4,500 coins  (save 25%)' }],
    [{ text: '🪙 1 Year VIP — 8,000 coins  (save 33%)' }],
    [{ text: '⭐ Pay with Stars Instead' }],
    [{ text: '💎 VIP' }]
  ],
  resize_keyboard: true
};
const COIN_VIP_PLANS_KB_BUTTONS = [
  '🪙 1 Month VIP — 1,000 coins',
  '🪙 6 Months VIP — 4,500 coins  (save 25%)',
  '🪙 1 Year VIP — 8,000 coins  (save 33%)',
  '⭐ Pay with Stars Instead'
];

// ── Gift VIP Plans ───────────────────────────────────────────────────────────
const GIFT_VIP_PLANS_KEYBOARD = {
  keyboard: [
    [{ text: '🎀 Gift 1 Month — 749 ⭐' }],
    [{ text: '🎀 Gift 6 Months — 2,490 ⭐' }],
    [{ text: '🎀 Gift 1 Year — 3,490 ⭐' }],
    [{ text: '💎 VIP' }]
  ],
  resize_keyboard: true
};
const GIFT_VIP_PLANS_KB_BUTTONS = [
  '🎀 Gift 1 Month — 749 ⭐',
  '🎀 Gift 6 Months — 2,490 ⭐',
  '🎀 Gift 1 Year — 3,490 ⭐'
];

// ── Coins Store ──────────────────────────────────────────────────────────────
const COINS_STORE_KEYBOARD = {
  keyboard: [
    [{ text: '🪙 100 Coins — 75 ⭐' }, { text: '🪙 500 Coins — 299 ⭐' }],
    [{ text: '💰 1,000 Coins — 499 ⭐' }, { text: '🏆 5,000 Coins — 1,999 ⭐' }],
    [{ text: '💎 VIP' }]
  ],
  resize_keyboard: true
};
const COINS_STORE_KB_BUTTONS = [
  '🪙 100 Coins — 75 ⭐',
  '🪙 500 Coins — 299 ⭐',
  '💰 1,000 Coins — 499 ⭐',
  '🏆 5,000 Coins — 1,999 ⭐'
];

// ── Boosts Store ─────────────────────────────────────────────────────────────
const BOOSTS_STORE_KEYBOARD = {
  keyboard: [
    [{ text: '🚀 1 Boost — 149 ⭐' }],
    [{ text: '⚡ 5 Boosts — 499 ⭐  (save 33%)' }],
    [{ text: '💥 10 Boosts — 749 ⭐  (save 50%)' }],
    [{ text: '💎 VIP' }]
  ],
  resize_keyboard: true
};
const BOOSTS_STORE_KB_BUTTONS = [
  '🚀 1 Boost — 149 ⭐',
  '⚡ 5 Boosts — 499 ⭐  (save 33%)',
  '💥 10 Boosts — 749 ⭐  (save 50%)'
];

// ── VIP Perks Panel ──────────────────────────────────────────────────────────
const PERKS_KEYBOARD = {
  keyboard: [
    [{ text: '🚀 Activate Boost' }, { text: '👻 Toggle Invisible' }],
    [{ text: '💎 VIP' }]
  ],
  resize_keyboard: true
};
const PERKS_KB_BUTTONS = ['🚀 Activate Boost', '👻 Toggle Invisible'];

// ── Gift Type Picker ─────────────────────────────────────────────────────────
const GIFT_TYPE_KEYBOARD = {
  keyboard: [
    [{ text: '🌹 Rose — 5 coins' }, { text: '💖 Heart — 10 coins' }],
    [{ text: '🍫 Chocolate — 15 coins' }, { text: '🌺 Flowers — 20 coins' }],
    [{ text: '💎 Diamond — 50 coins' }],
    [{ text: '🔙 Back to Gifts' }]
  ],
  resize_keyboard: true
};
const GIFT_TYPE_KB_BUTTONS = [
  '🌹 Rose — 5 coins', '💖 Heart — 10 coins',
  '🍫 Chocolate — 15 coins', '🌺 Flowers — 20 coins',
  '💎 Diamond — 50 coins', '🔙 Back to Gifts'
];

// ── Report Reasons (during browse) ───────────────────────────────────────────
const REPORT_REASONS_KEYBOARD = {
  keyboard: [
    [{ text: '🔞 Inappropriate' }, { text: '🤖 Spam / Bot' }],
    [{ text: '🎭 Fake Profile' }, { text: '😡 Harassment' }],
    [{ text: '📝 Other Reason' }, { text: '⛔ Block User' }],
    [{ text: '🔙 Cancel Report' }]
  ],
  resize_keyboard: true,
  one_time_keyboard: true
};
const REPORT_REASONS_KB_BUTTONS = [
  '🔞 Inappropriate', '🤖 Spam / Bot',
  '🎭 Fake Profile', '😡 Harassment',
  '📝 Other Reason', '⛔ Block User',
  '🔙 Cancel Report'
];

// ── Delete Profile Confirmation ───────────────────────────────────────────────
const DELETE_CONFIRM_KEYBOARD = {
  keyboard: [
    [{ text: '🗑️ Yes, Delete Forever' }],
    [{ text: '💚 No, Keep My Account' }]
  ],
  resize_keyboard: true,
  one_time_keyboard: true
};
const DELETE_CONFIRM_KB_BUTTONS = ['🗑️ Yes, Delete Forever', '💚 No, Keep My Account'];

// ── Photos Management ─────────────────────────────────────────────────────────
const PHOTOS_KEYBOARD = {
  keyboard: [
    [{ text: '📤 Add a Photo' }, { text: '🗑️ Delete a Photo' }],
    [{ text: '👤 My Profile' }]
  ],
  resize_keyboard: true
};
const PHOTOS_KB_BUTTONS = ['📤 Add a Photo', '🗑️ Delete a Photo'];

// ── Priority Boost Confirmation ───────────────────────────────────────────────
const PRIORITY_CONFIRM_KEYBOARD = {
  keyboard: [
    [{ text: '🚀 Yes, Boost Me!' }],
    [{ text: '💰 Buy Coins' }, { text: '🔙 No Thanks' }]
  ],
  resize_keyboard: true,
  one_time_keyboard: true
};
const PRIORITY_CONFIRM_KB_BUTTONS = ['🚀 Yes, Boost Me!', '💰 Buy Coins', '🔙 No Thanks'];

// ── Skip Screenshot (report flow) ─────────────────────────────────────────────
const SKIP_SCREENSHOT_KEYBOARD = {
  keyboard: [
    [{ text: '⏭️ Skip Screenshot' }],
    [{ text: '🔙 Cancel Report' }]
  ],
  resize_keyboard: true,
  one_time_keyboard: true
};
const SKIP_SCREENSHOT_KB_BUTTONS = ['⏭️ Skip Screenshot'];

// ── Story Success ─────────────────────────────────────────────────────────────
const STORY_KEYBOARD = {
  keyboard: [
    [{ text: '📸 Add Another Story' }, { text: '👀 View My Stories' }],
    [{ text: '🏠 Main Menu' }]
  ],
  resize_keyboard: true
};
const STORY_KB_BUTTONS = ['📸 Add Another Story', '👀 View My Stories'];

/** All Reply Keyboard button texts across every menu — used as a guard in field-saving handlers */
const ALL_KB_BUTTONS = [
  ...MAIN_KB_BUTTONS,
  ...PROFILE_KB_BUTTONS,
  ...SETTINGS_KB_BUTTONS,
  ...SEARCH_KB_BUTTONS,
  ...HELP_KB_BUTTONS,
  ...REPORT_KB_BUTTONS,
  ...VIP_KB_BUTTONS,
  ...GIFTS_KB_BUTTONS,
  ...VIP_PLANS_KB_BUTTONS,
  ...COIN_VIP_PLANS_KB_BUTTONS,
  ...GIFT_VIP_PLANS_KB_BUTTONS,
  ...COINS_STORE_KB_BUTTONS,
  ...BOOSTS_STORE_KB_BUTTONS,
  ...PERKS_KB_BUTTONS,
  ...GIFT_TYPE_KB_BUTTONS,
  ...REPORT_REASONS_KB_BUTTONS,
  ...DELETE_CONFIRM_KB_BUTTONS,
  ...PHOTOS_KB_BUTTONS,
  ...PRIORITY_CONFIRM_KB_BUTTONS,
  ...SKIP_SCREENSHOT_KB_BUTTONS,
  ...STORY_KB_BUTTONS,
  '🏠 Main Menu',
  '⚙️ Back to Settings',
  '🆘 Back to Help',
  '🔙 Back',
  "Let's Go! 🚀"
];

module.exports = {
  MAIN_KEYBOARD, MAIN_KB_BUTTONS,
  PROFILE_KEYBOARD, PROFILE_KB_BUTTONS,
  SETTINGS_KEYBOARD, SETTINGS_KB_BUTTONS,
  SEARCH_KEYBOARD, SEARCH_KB_BUTTONS,
  HELP_KEYBOARD, HELP_KB_BUTTONS,
  REPORT_KEYBOARD, REPORT_KB_BUTTONS,
  VIP_KEYBOARD, VIP_KB_BUTTONS,
  GIFTS_KEYBOARD, GIFTS_KB_BUTTONS,
  VIP_PLANS_KEYBOARD, VIP_PLANS_KB_BUTTONS,
  COIN_VIP_PLANS_KEYBOARD, COIN_VIP_PLANS_KB_BUTTONS,
  GIFT_VIP_PLANS_KEYBOARD, GIFT_VIP_PLANS_KB_BUTTONS,
  COINS_STORE_KEYBOARD, COINS_STORE_KB_BUTTONS,
  BOOSTS_STORE_KEYBOARD, BOOSTS_STORE_KB_BUTTONS,
  PERKS_KEYBOARD, PERKS_KB_BUTTONS,
  GIFT_TYPE_KEYBOARD, GIFT_TYPE_KB_BUTTONS,
  REPORT_REASONS_KEYBOARD, REPORT_REASONS_KB_BUTTONS,
  DELETE_CONFIRM_KEYBOARD, DELETE_CONFIRM_KB_BUTTONS,
  PHOTOS_KEYBOARD, PHOTOS_KB_BUTTONS,
  PRIORITY_CONFIRM_KEYBOARD, PRIORITY_CONFIRM_KB_BUTTONS,
  SKIP_SCREENSHOT_KEYBOARD, SKIP_SCREENSHOT_KB_BUTTONS,
  STORY_KEYBOARD, STORY_KB_BUTTONS,
  ALL_KB_BUTTONS
};
