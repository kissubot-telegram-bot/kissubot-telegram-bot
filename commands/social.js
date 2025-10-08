const axios = require('axios');
const { getCachedUserProfile } = require('./auth');

const API_BASE = process.env.API_BASE || 'http://localhost:3000/api';

function setupSocialCommands(bot) {
  // STORIES command
  bot.onText(/\/stories/, async (msg) => {
    const chatId = msg.chat.id;
    const storiesMsg = `📸 **STORIES** 📸\n\n` +
      `Share moments from your day!\n\n` +
      `✨ **Stories Features:**\n` +
      `• Share photos that disappear in 24 hours\n` +
      `• See stories from your matches\n` +
      `• React to stories with emojis\n` +
      `• Start conversations from stories\n\n` +
      `🎯 **Stories help you:**\n` +
      `• Show your personality\n` +
      `• Stay connected with matches\n` +
      `• Get more profile views\n` +
      `• Break the ice naturally\n\n` +
      `📱 **Coming Soon!** Stories feature is in development.`;

    bot.sendMessage(chatId, storiesMsg, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📸 Add Story (Coming Soon)', callback_data: 'add_story_soon' }
          ],
          [
            { text: '👀 View Stories (Coming Soon)', callback_data: 'view_stories_soon' }
          ],
          [
            { text: '🔙 Back to Menu', callback_data: 'main_menu' }
          ]
        ]
      }
    });
  });
}

module.exports = { setupSocialCommands };
