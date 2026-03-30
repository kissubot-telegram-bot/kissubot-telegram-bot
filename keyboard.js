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
    [{ text: '🔍 Discover' }, { text: '💕 Matches' }],
    [{ text: '👤 My Profile' }, { text: '⚙️ Settings' }],
    [{ text: '💎 VIP' }, { text: '🆘 Help' }]
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
  '🏠 Main Menu',
  '⚙️ Back to Settings',
  '🆘 Back to Help'
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
  ALL_KB_BUTTONS
};
