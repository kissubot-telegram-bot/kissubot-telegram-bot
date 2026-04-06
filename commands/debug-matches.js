// Temporary debug command to check match data
function setupDebugMatchesCommand(bot, User) {
  bot.onText(/\/debugmatches/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = String(msg.from.id);

    try {
      const user = await User.findOne({ telegramId });
      
      if (!user) {
        return bot.sendMessage(chatId, '❌ User not found in database.');
      }

      let debugMsg = `🔍 *Debug Info for ${user.name || 'User'}*\n\n`;
      debugMsg += `📱 Telegram ID: \`${telegramId}\`\n`;
      debugMsg += `👤 Name: ${user.name || 'Not set'}\n`;
      debugMsg += `✅ Profile Completed: ${user.profileCompleted ? 'Yes' : 'No'}\n`;
      debugMsg += `👑 VIP: ${user.isVip ? 'Yes' : 'No'}\n\n`;
      
      debugMsg += `💕 *Matches Data:*\n`;
      debugMsg += `Total matches: ${user.matches?.length || 0}\n\n`;

      if (user.matches && user.matches.length > 0) {
        debugMsg += `*Match Details:*\n`;
        for (let i = 0; i < Math.min(user.matches.length, 5); i++) {
          const match = user.matches[i];
          const matchedUser = await User.findOne({ telegramId: match.userId });
          debugMsg += `${i + 1}. User ID: \`${match.userId}\`\n`;
          debugMsg += `   Name: ${matchedUser ? matchedUser.name : 'User not found'}\n`;
          debugMsg += `   Matched: ${new Date(match.matchedAt).toLocaleString()}\n`;
          debugMsg += `   In-bot messages: ${match.inBotMessages?.length || 0}\n`;
          debugMsg += `   Chat unlocked: ${match.chatUnlocked ? 'Yes' : 'No'}\n\n`;
        }
        if (user.matches.length > 5) {
          debugMsg += `_...and ${user.matches.length - 5} more matches_\n`;
        }
      } else {
        debugMsg += `No matches found.\n`;
      }

      debugMsg += `\n💚 *Likes:*\n`;
      debugMsg += `People who liked you: ${user.likes?.length || 0}\n`;
      
      debugMsg += `\n👀 *Seen Profiles:*\n`;
      debugMsg += `Profiles seen: ${user.seenProfiles?.length || 0}\n`;

      await bot.sendMessage(chatId, debugMsg, { parse_mode: 'Markdown' });

    } catch (error) {
      console.error('Debug matches error:', error);
      bot.sendMessage(chatId, `❌ Error: ${error.message}`);
    }
  });
}

module.exports = { setupDebugMatchesCommand };
