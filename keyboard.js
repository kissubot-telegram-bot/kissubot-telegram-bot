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

module.exports = { MAIN_KEYBOARD, MAIN_KB_BUTTONS, PROFILE_KEYBOARD, PROFILE_KB_BUTTONS };
