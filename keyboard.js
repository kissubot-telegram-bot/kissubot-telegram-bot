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

module.exports = { MAIN_KEYBOARD, MAIN_KB_BUTTONS };
