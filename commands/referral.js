/**
 * referral.js — Referral system
 *
 * /refer → shows invite link + stats
 * callback_data: refer_stats → same view inline
 *
 * Rewards (on profile completion of referred user):
 *   Each referral  → +3 VIP days
 *   3 referrals    → +4 bonus days  (milestone)
 *   7 referrals    → +7 bonus days  (milestone)
 *   15 referrals   → +14 bonus days (milestone)
 */

const MILESTONES = [
  { count: 3,  bonus: 4,  label: '+4 days' },
  { count: 7,  bonus: 7,  label: '+7 days' },
  { count: 15, bonus: 14, label: '+14 days' }
];

const REFER_KEYBOARD = {
  keyboard: [
    [{ text: '📤 Share My Invite Link' }, { text: '📊 My Referral Stats' }],
    [{ text: '🏠 Menu' }]
  ],
  resize_keyboard: true
};

function getBotUsername() {
  return process.env.BOT_USERNAME || global.BOT_USERNAME_RESOLVED || 'kissuMatch_bot';
}

async function ensureReferralCode(user, User) {
  if (user.referralCode) return user.referralCode;
  const code = 'ref_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  await User.findOneAndUpdate({ telegramId: user.telegramId }, { referralCode: code });
  return code;
}

function buildReferralMessage(user, referralCode, botUsername) {
  const link = `https://t.me/${botUsername}?start=${referralCode}`;
  const count = user.referralCount || 0;
  const totalDays = count * 3 + MILESTONES.filter(m => count >= m.count).reduce((s, m) => s + m.bonus, 0);

  const milestoneLines = MILESTONES.map(m => {
    const done = count >= m.count;
    return `${done ? '✅' : '⬜'} ${m.count} friends → +${m.bonus} days (${m.label})`;
  }).join('\n');

  return (
    `👥 *Invite Friends & Earn Free VIP!*\n\n` +
    `Share your link and earn *+3 VIP days* every time a friend completes their profile!\n\n` +
    `🔗 *Your invite link:*\n\`${link}\`\n\n` +
    `📊 *Your stats:*\n` +
    `✅ Successful referrals: *${count}*\n` +
    `🗓 VIP days earned: *${totalDays} days*\n\n` +
    `🏆 *Milestones:*\n${milestoneLines}`
  );
}

function setupReferralCommands(bot, User) {
  // /refer command
  bot.onText(/\/refer/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    try {
      const user = await User.findOne({ telegramId });
      if (!user) return bot.sendMessage(chatId, '❌ Please start the bot first with /start');
      const code = await ensureReferralCode(user, User);
      const text = buildReferralMessage(user, code, getBotUsername());
      bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: REFER_KEYBOARD
      });
    } catch (err) {
      bot.sendMessage(chatId, '❌ Failed to load referral info. Please try again.');
    }
  });

  // "👥 Refer a Friend" keyboard button + "📊 My Referral Stats" + "📤 Share My Invite Link"
  bot.on('message', async (msg) => {
    const text = msg.text;
    if (!text) return;
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    if (text === '👥 Refer a Friend' || text === '📊 My Referral Stats') {
      try {
        const user = await User.findOne({ telegramId });
        if (!user) return;
        const code = await ensureReferralCode(user, User);
        const msgText = buildReferralMessage(user, code, getBotUsername());
        bot.sendMessage(chatId, msgText, { parse_mode: 'Markdown', reply_markup: REFER_KEYBOARD });
      } catch (_) {}
      return;
    }

    if (text === '📤 Share My Invite Link') {
      try {
        const user = await User.findOne({ telegramId });
        if (!user) return;
        const code = await ensureReferralCode(user, User);
        const link = `https://t.me/${getBotUsername()}?start=${code}`;
        bot.sendMessage(chatId,
          `📤 *Your Invite Link*\n\n\`${link}\`\n\nForward this to your friends! When they complete their profile you get *+3 VIP days* instantly. 🎉`,
          { parse_mode: 'Markdown', reply_markup: REFER_KEYBOARD }
        );
      } catch (_) {}
      return;
    }
  });

  // callback_data: refer_stats — inline refresh
  bot.on('callback_query', async (query) => {
    if (query.data !== 'refer_stats') return;
    const telegramId = query.from.id;
    try {
      const user = await User.findOne({ telegramId });
      if (!user) return bot.answerCallbackQuery(query.id, { text: 'User not found' });
      const code = await ensureReferralCode(user, User);
      const botUsername = getBotUsername();
      const text = buildReferralMessage(user, code, botUsername);
      bot.editMessageText(text, {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📤 Share Invite Link', switch_inline_query: `Join @${botUsername}! https://t.me/${botUsername}?start=${code}` }],
            [{ text: '🔄 Refresh Stats', callback_data: 'refer_stats' }]
          ]
        }
      }).catch(() => {});
      bot.answerCallbackQuery(query.id, { text: '✅ Stats refreshed!' });
    } catch (_) {
      bot.answerCallbackQuery(query.id, { text: 'Error loading stats' });
    }
  });
}

module.exports = { setupReferralCommands };
