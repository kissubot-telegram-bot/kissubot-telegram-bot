const axios = require('axios');
const { getCachedUserProfile } = require('./auth');

const { API_BASE } = require('../config');
const userStates = {};

function setupSocialDebugCommands(bot, User, Match, Like, userStates) {
  bot.onText(/\/stories/, async (msg) => {
    const chatId = msg.chat.id;
    const user = await getCachedUserProfile(chatId);

    if (!user) {
      bot.sendMessage(chatId, 'You need to be registered to use this feature. Please use /start.');
      return;
    }

    const storiesMenu = {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'View Stories', callback_data: 'view_stories' }],
          [{ text: 'Post a Story', callback_data: 'post_story' }],
          [{ text: 'My Stories', callback_data: 'my_stories' }],
          [{ text: 'Help', callback_data: 'stories_help' }]
        ]
      }
    };

    bot.sendMessage(chatId, 'Welcome to Stories! What would you like to do?', storiesMenu);
  });

  bot.on('callback_query', async (callbackQuery) => {
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;
    const data = callbackQuery.data;

    if (data === 'post_story') {
      bot.sendMessage(chatId, 'Please send the photo or video for your story.');
    }

    if (data.startsWith('delete_story_')) {
      const storyId = data.split('_')[2];
      try {
        await axios.delete(`${API_BASE}/stories/${storyId}`);
        bot.editMessageText("Story deleted successfully.", {
          chat_id: msg.chat.id,
          message_id: msg.message_id
        });
      } catch (error) {
        console.error('Error deleting story:', error);
        bot.sendMessage(msg.chat.id, "There was an error deleting your story. Please try again later.");
      }
    }
  });

  const handleStory = async (msg) => {
    const chatId = msg.chat.id;
    const storyType = msg.photo ? 'photo' : 'video';
    const fileId = storyType === 'photo' ? msg.photo[msg.photo.length - 1].file_id : msg.video.file_id;

    try {
      await axios.post(`${API_BASE}/stories`, {
        telegramId: chatId,
        story: fileId,
        storyType: storyType
      });
      bot.sendMessage(chatId, "Your story has been posted successfully!");
    } catch (error) {
      console.error('Error posting story:', error);
      bot.sendMessage(chatId, "There was an error posting your story. Please try again later.");
    }
  };

  // Only handle photos when user is posting a story
  bot.on('photo', (msg) => {
    const userState = userStates.get(msg.from.id);
    if (userState?.action === 'uploading_story') {
      handleStory(msg);
    }
  });
  bot.on('video', handleStory);
}

module.exports = { setupSocialDebugCommands };