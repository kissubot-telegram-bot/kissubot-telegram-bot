const { MAIN_KEYBOARD, HELP_KEYBOARD, HELP_KB_BUTTONS, REPORT_KEYBOARD, REPORT_KB_BUTTONS } = require('../keyboard');

function sendHelpMenu(bot, chatId) {
  bot.sendMessage(chatId,
    `🤖 *Help Center* 🤖\n\n` +
    `Choose a topic below — I'm here to help! 💬\n\n` +
    `💡 *Tip:* Add more photos to get 3× more matches!`,
    { parse_mode: 'Markdown', reply_markup: HELP_KEYBOARD }
  );
}

function sendReportMenu(bot, chatId) {
  bot.sendMessage(chatId,
    `🚨 *Report Center* 🚨\n\n` +
    `Help us keep KissuBot safe for everyone.\n\n` +
    `🔒 All reports are *confidential* and reviewed within 24 hours.`,
    { parse_mode: 'Markdown', reply_markup: REPORT_KEYBOARD }
  );
}

function setupHelpCommands(bot) {

  // ── /help command ──────────────────────────────────────────────────────
  bot.onText(/\/help/, (msg) => sendHelpMenu(bot, msg.chat.id));

  // ── /report command ────────────────────────────────────────────────────
  bot.onText(/\/report/, (msg) => sendReportMenu(bot, msg.chat.id));

  // ── /contact command ───────────────────────────────────────────────────
  bot.onText(/\/contact/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId,
      `🆘 *Support Center*\n\n` +
      `Our team is ready to help you! 🙌\n\n` +
      `🤖 *Support Bot:* @KissuSupportBot\n` +
      `📧 *Email:* spprtksbt@gmail.com\n` +
      `⏰ *Response time:* 24–48 hours\n\n` +
      `📋 *Please include:*\n` +
      `• Your username: @${msg.from.username || 'N/A'}\n` +
      `• A clear description of the issue\n` +
      `• Screenshots if possible`,
      { parse_mode: 'Markdown', reply_markup: HELP_KEYBOARD }
    );
  });

  // ── Help Reply Keyboard handler ────────────────────────────────────────
  bot.on('message', (msg) => {
    const text = msg.text;
    if (!text || !HELP_KB_BUTTONS.includes(text)) return;
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    switch (text) {
      case '👤 Profile Help':
        return bot.sendMessage(chatId,
          `👤 *Profile Help*\n\n` +
          `*How to set up a great profile:*\n\n` +
          `📝 Use /profile → tap *📝 Edit Name* to set your name\n` +
          `🎂 Set your age via *🎂 Edit Age*\n` +
          `📍 Add your city via *📍 Edit Location*\n` +
          `💬 Write a fun bio via *💬 Edit Bio*\n` +
          `📸 Upload up to 6 photos via *📸 Photos*\n` +
          `📞 Add your phone via *📞 Phone* (required)\n\n` +
          `💡 *Profiles with photos get 5× more matches!*`,
          { parse_mode: 'Markdown', reply_markup: HELP_KEYBOARD }
        );

      case '🔍 Browsing Help':
        return bot.sendMessage(chatId,
          `🔍 *Browsing Help*\n\n` +
          `*How browsing works:*\n\n` +
          `❤️ *Like* — you like this person\n` +
          `❌ *Skip* — pass on this profile\n` +
          `⭐ *Super Like* — stand out! Uses 1 coin\n` +
          `🚩 *Report* — flag inappropriate behaviour\n\n` +
          `💘 *When both of you like each other → It's a Match!*\n\n` +
          `⚙️ Adjust who you see via *⚙️ Settings → 🔍 Search Preferences*`,
          { parse_mode: 'Markdown', reply_markup: HELP_KEYBOARD }
        );

      case '👑 VIP & Coins':
        return bot.sendMessage(chatId,
          `👑 *VIP & Coins*\n\n` +
          `*VIP benefits:*\n` +
          `• 👀 See who liked you\n` +
          `• 🔝 Priority in browse queue\n` +
          `• 💌 Unlimited matches\n` +
          `• 🎭 Advanced filters\n` +
          `• 📊 Profile analytics\n\n` +
          `*Coins are used for:*\n` +
          `• ⭐ Super Likes\n` +
          `• 🚀 Priority Boosts\n` +
          `• 🎁 Sending gifts to matches\n\n` +
          `Tap *💎 VIP* on the main menu to get started!`,
          { parse_mode: 'Markdown', reply_markup: HELP_KEYBOARD }
        );

      case '📱 Stories Help':
        return bot.sendMessage(chatId,
          `📱 *Stories Help*\n\n` +
          `*What are Stories?*\n` +
          `Share moments with your matches! Photos & videos that expire in 24 hours.\n\n` +
          `*How to post:*\n` +
          `1️⃣ Type /stories\n` +
          `2️⃣ Tap *Post a Story*\n` +
          `3️⃣ Send a photo or video\n` +
          `4️⃣ Add a caption (optional)\n\n` +
          `📊 *Track views & engagement* in your story analytics!`,
          { parse_mode: 'Markdown', reply_markup: HELP_KEYBOARD }
        );

      case '📞 Contact Support':
        return bot.sendMessage(chatId,
          `🆘 *Contact Support*\n\n` +
          `Our team responds within 24–48 hours.\n\n` +
          `🤖 *Support Bot:* @KissuSupportBot\n` +
          `📧 *Email:* spprtksbt@gmail.com\n\n` +
          `📋 *When contacting us, please include:*\n` +
          `• Your Telegram username\n` +
          `• A description of the problem\n` +
          `• Screenshots if available`,
          { parse_mode: 'Markdown', reply_markup: HELP_KEYBOARD }
        );

      case '🚨 Report Center':
        return sendReportMenu(bot, chatId);
    }
  });

  // ── Report Reply Keyboard handler ──────────────────────────────────────
  bot.on('message', (msg) => {
    const text = msg.text;
    if (!text || !REPORT_KB_BUTTONS.includes(text)) return;
    const chatId = msg.chat.id;

    if (text === '🆘 Back to Help') {
      return sendHelpMenu(bot, chatId);
    }

    const topics = {
      '👤 Report a User':  { emoji: '👤', title: 'Report a User',     detail: 'Please describe the user\'s behaviour and include their Telegram username if possible.' },
      '📸 Report Content': { emoji: '📸', title: 'Inappropriate Content', detail: 'Describe the content and which profile it appeared on.' },
      '🐛 Report Bug':     { emoji: '🐛', title: 'Bug Report',         detail: 'Describe what happened, what you expected, and the steps to reproduce it.' },
      '💡 Feature Request':{ emoji: '💡', title: 'Feature Request',    detail: 'Tell us your idea — we read every suggestion!' },
    };

    const t = topics[text];
    if (!t) return;

    bot.sendMessage(chatId,
      `${t.emoji} *${t.title}*\n\n${t.detail}\n\n` +
      `🤖 *Contact:* @KissuSupportBot\n` +
      `� *Email:* spprtksbt@gmail.com\n\n` +
      `Please include your Telegram username so we can follow up.\n` +
      `⏰ We review all reports within 24 hours.`,
      { parse_mode: 'Markdown', reply_markup: REPORT_KEYBOARD }
    );
  });
}

module.exports = { setupHelpCommands, sendHelpMenu };
