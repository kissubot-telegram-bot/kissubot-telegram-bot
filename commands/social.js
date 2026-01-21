const axios = require('axios');
const { getCachedUserProfile } = require('./auth');

const API_BASE = process.env.API_BASE || 'http://localhost:3000';
const userStates = {};

function setupSocialCommands(bot) {
  // STORIES command
  bot.onText(/\/stories/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    
    try {
      const [userStoriesRes, recentStoriesRes] = await Promise.all([
        axios.get(`${API_BASE}/stories/user/${telegramId}`).catch(() => ({ data: { stories: [] } })),
        axios.get(`${API_BASE}/stories/recent/${telegramId}`).catch(() => ({ data: { stories: [] } }))
      ]);

      const userStories = userStoriesRes.data.stories || [];
      const recentStories = recentStoriesRes.data.stories || [];

      const storiesMsg = `📸 **STORIES CENTER** 📸\n\n` +
        `📱 Your Stories: **${userStories.length}** active\n` +
        `👀 New Stories: **${recentStories.length}** to view\n\n` +
        `🎯 What would you like to do?`;

      bot.sendMessage(chatId, storiesMsg, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📸 Post Story', callback_data: 'post_story' },
              { text: '👀 View Stories', callback_data: 'view_stories' }
            ],
            [
              { text: '📱 My Stories', callback_data: 'my_stories' },
              { text: '📊 Story Stats', callback_data: 'story_stats' }
            ],
            [
              { text: '📩 View Story Messages', callback_data: 'view_story_messages' },
              { text: '⚙️ Story Settings', callback_data: 'story_settings' }
            ],
            [
              { text: '❓ Story Help', callback_data: 'story_help' },
              { text: '🔙 Back to Menu', callback_data: 'main_menu' }
            ]
          ]
        }
      });
    } catch (err) {
      bot.sendMessage(chatId, '❌ Unable to load stories menu. Please try again.');
    }
  });

  // Story callback handlers
  function setupStoryCallbacks() {
    bot.on('callback_query', async (query) => {
      const chatId = query.message.chat.id;
      const telegramId = query.from.id;
      const data = query.data;

      switch(data) {
        case 'view_stories':
          try {
            const storiesRes = await axios.get(`${API_BASE}/stories/recent/${telegramId}`);
            const stories = storiesRes.data.stories || [];
            
            if (stories.length === 0) {
              return bot.sendMessage(chatId, 
                '📸 **NO NEW STORIES** 📸\n\n' +
                '😔 No new stories to view right now.\n\n' +
                '💡 **Tips:**\n' +
                '• Follow more people to see their stories\n' +
                '• Post your own story to get more followers\n' +
                '• Use /browse to find interesting people'
              );
            }

            const viewMsg = `👀 **VIEWING STORIES** 👀\n\n` +
              `📱 Found **${stories.length}** new stories\n\n` +
              `Tap to view each story:`;

            const storyButtons = stories.slice(0, 6).map((story, index) => [
              { text: `📸 ${story.userName} ${story.isVip ? '👑' : ''}`, callback_data: `view_story_${story._id}` }
            ]);

            storyButtons.push([
              { text: '🔙 Back to Stories', callback_data: 'stories_main_menu' }
            ]);

            bot.editMessageText(viewMsg, {
              chat_id: chatId,
              message_id: query.message.message_id,
              reply_markup: { inline_keyboard: storyButtons },
              parse_mode: 'Markdown'
            });
          } catch (err) {
            bot.sendMessage(chatId, '❌ Unable to load stories. Please try again.');
          }
          break;

        case 'post_story':
          userStates[telegramId] = { awaitingStory: true };
          
          const postMsg = `📸 **POST YOUR STORY** 📸\n\n` +
            `📱 Send me a photo or video for your story!\n\n` +
            `✨ **Story Features:**\n` +
            `• Visible for 24 hours\n` +
            `• Add text caption\n` +
            `• See who viewed it\n` +
            `• Boost your profile visibility\n\n` +
            `📷 Just send your photo/video now!`;

          bot.editMessageText(postMsg, {
            chat_id: chatId,
            message_id: query.message.message_id,
            reply_markup: {
              inline_keyboard: [
                [{ text: '❌ Cancel', callback_data: 'stories_main_menu' }]
              ]
            },
            parse_mode: 'Markdown'
          });
          break;

        case 'my_stories':
          try {
            const userStoriesRes = await axios.get(`${API_BASE}/stories/user/${telegramId}`);
            const userStories = userStoriesRes.data.stories || [];
            
            if (userStories.length === 0) {
              const noStoriesMsg = `📱 **YOUR STORIES** 📱\n\n` +
                `📸 You haven't posted any stories yet.\n\n` +
                `💡 **Why post stories?**\n` +
                `• Get more profile views\n` +
                `• Show your personality\n` +
                `• Connect with more people\n` +
                `• Increase your matches\n\n` +
                `Ready to share your first story?`;

              bot.editMessageText(noStoriesMsg, {
                chat_id: chatId,
                message_id: query.message.message_id,
                reply_markup: {
                  inline_keyboard: [
                    [{ text: '📸 Post First Story', callback_data: 'post_story' }],
                    [{ text: '🔙 Back to Stories', callback_data: 'stories_main_menu' }]
                  ]
                },
                parse_mode: 'Markdown'
              });
            } else {
              const storiesMsg = `📱 **YOUR STORIES** 📱\n\n` +
                `📸 Active Stories: **${userStories.length}**\n\n` +
                userStories.slice(0, 5).map((story, index) => {
                  const timeAgo = Math.floor((Date.now() - new Date(story.createdAt)) / (1000 * 60 * 60));
                  const views = story.views ? story.views.length : 0;
                  return `${index + 1}. ${story.type === 'photo' ? '📷' : '🎥'} Posted ${timeAgo}h ago\n` +
                         `   👀 ${views} views`;
                }).join('\n\n');

              const myStoriesButtons = [
                [
                  { text: '📸 Post New Story', callback_data: 'post_story' },
                  { text: '👀 View Analytics', callback_data: 'story_stats' }
                ],
                [{ text: '🔙 Back to Stories', callback_data: 'stories_main_menu' }]
              ];

              bot.editMessageText(storiesMsg, {
                chat_id: chatId,
                message_id: query.message.message_id,
                reply_markup: { inline_keyboard: myStoriesButtons },
                parse_mode: 'Markdown'
              });
            }
          } catch (err) {
            bot.sendMessage(chatId, '❌ Unable to load your stories. Please try again.');
          }
          break;

        case 'story_stats':
          try {
            const [userStoriesRes, analyticsRes] = await Promise.all([
              axios.get(`${API_BASE}/stories/user/${telegramId}`),
              axios.get(`${API_BASE}/stories/analytics/${telegramId}`)
            ]);
            
            const stories = userStoriesRes.data.stories || [];
            const analytics = analyticsRes.data || {};
            
            const statsMsg = `📊 **STORY ANALYTICS** 📊\n\n` +
              `📸 **Your Stories:**\n` +
              `   Total Posted: **${analytics.totalStories || 0}**\n` +
              `   Currently Active: **${stories.length}**\n\n` +
              `👀 **Views & Engagement:**\n` +
              `   Total Views: **${analytics.totalViews || 0}**\n` +
              `   Average Views: **${analytics.avgViews || 0}**\n` +
              `   Profile Visits: **${analytics.profileVisits || 0}**\n\n` +
              `🔥 **Performance:**\n` +
              `   Best Story: **${analytics.bestStoryViews || 0}** views\n` +
              `   Engagement Rate: **${analytics.engagementRate || 0}%**\n\n` +
              `💡 Post more stories to boost your visibility!`;

            bot.editMessageText(statsMsg, {
              chat_id: chatId,
              message_id: query.message.message_id,
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: '📸 Post Story', callback_data: 'post_story' },
                    { text: '📱 My Stories', callback_data: 'my_stories' }
                  ],
                  [{ text: '🔙 Back to Stories', callback_data: 'stories_main_menu' }]
                ]
              },
              parse_mode: 'Markdown'
            });
          } catch (err) {
            bot.sendMessage(chatId, '❌ Unable to load story analytics. Please try again.');
          }
          break;

        case 'story_settings':
          const settingsMsg = `⚙️ **STORY SETTINGS** ⚙️\n\n` +
            `🔒 **Privacy Settings:**\n` +
            `• Who can view your stories\n` +
            `• Story visibility duration\n` +
            `• Auto-delete settings\n\n` +
            `📱 **Notification Settings:**\n` +
            `• New story alerts\n` +
            `• View notifications\n` +
            `• Story interaction alerts`;

          bot.editMessageText(settingsMsg, {
            chat_id: chatId,
            message_id: query.message.message_id,
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '🔒 Privacy Settings', callback_data: 'story_privacy' },
                  { text: '🔔 Notifications', callback_data: 'story_notifications' }
                ],
                [{ text: '🔙 Back to Stories', callback_data: 'stories_main_menu' }]
              ]
            },
            parse_mode: 'Markdown'
          });
          break;

        case 'story_help':
          const helpMsg = `❓ **STORY HELP GUIDE** ❓\n\n` +
            `📸 **What are Stories?**\n` +
            `Stories are photos/videos that disappear after 24 hours. They're perfect for sharing moments and connecting with others!\n\n` +
            `🎯 **How to Use Stories:**\n` +
            `1. Tap "📸 Post Story"\n` +
            `2. Send a photo or video\n` +
            `3. Add a caption (optional)\n` +
            `4. Your story goes live!\n\n` +
            `✨ **Story Benefits:**\n` +
            `• Increase profile visibility\n` +
            `• Show your personality\n` +
            `• Get more matches\n` +
            `• See who's interested in you\n\n` +
            `💡 **Pro Tips:**\n` +
            `• Post regularly for best results\n` +
            `• Use good lighting for photos\n` +
            `• Add engaging captions\n` +
            `• Check your story analytics`;

          bot.editMessageText(helpMsg, {
            chat_id: chatId,
            message_id: query.message.message_id,
            reply_markup: {
              inline_keyboard: [
                [{ text: '📸 Post Your First Story', callback_data: 'post_story' }],
                [{ text: '🔙 Back to Stories', callback_data: 'stories_main_menu' }]
              ]
            },
            parse_mode: 'Markdown'
          });
          break;

        case 'stories_main_menu':
          try {
            const [userStoriesRes, recentStoriesRes] = await Promise.all([
              axios.get(`${API_BASE}/stories/user/${telegramId}`).catch(() => ({ data: { stories: [] } })),
              axios.get(`${API_BASE}/stories/recent/${telegramId}`).catch(() => ({ data: { stories: [] } }))
            ]);

            const userStories = userStoriesRes.data.stories || [];
            const recentStories = recentStoriesRes.data.stories || [];

            const mainMenuMsg = `📸 **STORIES CENTER** 📸\n\n` +
              `📱 Your Stories: **${userStories.length}** active\n` +
              `👀 New Stories: **${recentStories.length}** to view\n\n` +
              `🎯 What would you like to do?`;

            bot.editMessageText(mainMenuMsg, {
              chat_id: chatId,
              message_id: query.message.message_id,
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: '📸 Post Story', callback_data: 'post_story' },
                    { text: '👀 View Stories', callback_data: 'view_stories' }
                  ],
                  [
                    { text: '📱 My Stories', callback_data: 'my_stories' },
                    { text: '📊 Story Stats', callback_data: 'story_stats' }
                  ],
                  [
                    { text: '📩 View Story Messages', callback_data: 'view_story_messages' },
                    { text: '⚙️ Story Settings', callback_data: 'story_settings' }
                  ],
                  [
                    { text: '❓ Story Help', callback_data: 'story_help' },
                    { text: '🔙 Back to Menu', callback_data: 'main_menu' }
                  ]
                ]
              },
              parse_mode: 'Markdown'
            });
          } catch (err) {
            bot.sendMessage(chatId, '❌ Unable to load stories menu. Please try again.');
          }
          break;

        case 'view_story_messages':
          try {
            const messagesRes = await axios.get(`${API_BASE}/stories/messages/${telegramId}`);
            const messages = messagesRes.data.messages || [];

            if (messages.length === 0) {
              return bot.sendMessage(chatId, '📩 **STORY MESSAGES** 📩\n\n' +
                '😔 You have no new story messages.\n\n' +
                '💡 **Tips:**\n' +
                '• Post engaging stories to receive more messages\n' +
                '• Check your story analytics to see what works');
            }

            const messageButtons = messages.map(message => {
              const senderInfo = message.isRevealed ? `👤 ${message.senderName}` : '👻 Anonymous';
              return [{ text: `${senderInfo}: ${message.message.substring(0, 20)}...`, callback_data: `view_story_message_${message._id}` }];
            });

            messageButtons.push([{ text: '🔙 Back to Stories', callback_data: 'stories_main_menu' }]);

            bot.editMessageText('📩 **YOUR STORY MESSAGES** 📩\n\n' +
              `You have **${messages.length}** new messages.`, {
              chat_id: chatId,
              message_id: query.message.message_id,
              reply_markup: { inline_keyboard: messageButtons },
              parse_mode: 'Markdown'
            });
          } catch (err) {
            bot.sendMessage(chatId, '❌ Unable to load story messages. Please try again.');
          }
          break;
      }

      // Handle view_story_message_ callbacks
      if (data.startsWith('view_story_message_')) {
        const messageId = data.split('_')[3];
        try {
          const messageRes = await axios.get(`${API_BASE}/stories/message/${messageId}`);
          const message = messageRes.data;

          const senderInfo = message.isRevealed ? `👤 ${message.senderName}` : '👻 Anonymous';
          const messageText = `📩 **STORY MESSAGE** 📩\n\n` +
            `From: ${senderInfo}\n` +
            `Message: ${message.message}\n\n` +
            `Story: ${message.storyCaption || 'No caption'}`;

          const inlineKeyboard = [];
          if (!message.isRevealed) {
            inlineKeyboard.push([{ text: 'Reveal Identity (50 Coins)', callback_data: `reveal_identity_${message._id}` }]);
          }
          inlineKeyboard.push([{ text: '🔙 Back to Messages', callback_data: 'view_story_messages' }]);

          bot.editMessageText(messageText, {
            chat_id: chatId,
            message_id: query.message.message_id,
            reply_markup: { inline_keyboard: inlineKeyboard },
            parse_mode: 'Markdown'
          });
        } catch (err) {
          bot.sendMessage(chatId, '❌ Unable to load message. Please try again.');
        }
      } else if (data.startsWith('reveal_identity_')) {
        const messageId = data.split('_')[2];
        try {
          // Check user's coin balance first
          const userProfile = await getCachedUserProfile(telegramId);
          if (!userProfile || userProfile.coins < 50) {
            return bot.sendMessage(chatId, '❌ You need 50 coins to reveal identity. Buy more coins with /coins.');
          }

          await axios.post(`${API_BASE}/stories/reveal/${messageId}`, { userId: telegramId });
          bot.sendMessage(chatId, '✅ Identity revealed! You can now see who sent the message.');
          // Refresh the message view
          // This is a bit hacky, ideally we'd update the current message
          // For now, just send them back to the messages list
          bot.answerCallbackQuery(query.id);
          // Trigger view_story_messages again to refresh the list
          bot.emit('callback_query', { id: query.id, from: query.from, message: query.message, data: 'view_story_messages' });
        } catch (err) {
          bot.sendMessage(chatId, '❌ Failed to reveal identity. Please try again.');
        }
      }

      // Handle reply_story_ callbacks
      if (data.startsWith('reply_story_')) {
        const storyId = data.split('_')[2];
        userStates[telegramId] = { awaitingStoryReply: true, storyId: storyId };
        bot.sendMessage(chatId, '💬 **REPLY TO STORY** 💬

' +
          'Type your message to the story owner. Would you like to send it anonymously or reveal your identity?', {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '👻 Send Anonymously', callback_data: `send_story_reply_anonymous_${storyId}` }
              ],
              [
                { text: '👤 Send (Reveal Identity)', callback_data: `send_story_reply_revealed_${storyId}` }
              ],
              [
                { text: '🔙 Cancel', callback_data: 'cancel_story_reply' }
              ]
            ]
          }
        });
      } else if (data.startsWith('send_story_reply_')) {
        const parts = data.split('_');
        const isAnonymous = parts[3] === 'anonymous';
        const storyId = parts[4];

        // This part will be handled by the bot.on('message') listener
        // We just set the state here
        userStates[telegramId].isAnonymous = isAnonymous;
        bot.sendMessage(chatId, `Okay, please type your message now.`);
      } else if (data === 'cancel_story_reply') {
        delete userStates[telegramId];
        bot.sendMessage(chatId, '❌ Story reply cancelled.');
      }

      // Handle view_story_ callbacks
      if (data.startsWith('view_story_')) {
        const storyId = data.split('_')[2];
        try {
          const storyRes = await axios.get(`${API_BASE}/stories/${storyId}`);
          const story = storyRes.data;
          
          // Mark story as viewed
          await axios.post(`${API_BASE}/stories/view/${storyId}`, {
            viewerId: telegramId
          });
          
          const storyMsg = `📸 **${story.userName}'s Story** ${story.isVip ? '👑' : ''}\n\n` +
            `${story.caption || 'No caption'}\n\n` +
            `👀 ${story.views ? story.views.length : 0} views • ` +
            `${Math.floor((Date.now() - new Date(story.createdAt)) / (1000 * 60 * 60))}h ago`;
          
          if (story.mediaUrl) {
            if (story.type === 'photo') {
              bot.sendPhoto(chatId, story.mediaUrl, {
                caption: storyMsg,
                reply_markup: {
                  inline_keyboard: [
                    [
                      { text: '💬 Reply', callback_data: `reply_story_${storyId}` },
                      { text: '❤️ React', callback_data: `react_story_${storyId}` }
                    ],
                    [{ text: '🔙 Back to Stories', callback_data: 'view_stories' }]
                  ]
                }
              });
            } else {
              bot.sendVideo(chatId, story.mediaUrl, {
                caption: storyMsg,
                reply_markup: {
                  inline_keyboard: [
                    [
                      { text: '💬 Reply', callback_data: `reply_story_${storyId}` },
                      { text: '❤️ React', callback_data: `react_story_${storyId}` }
                    ],
                    [{ text: '🔙 Back to Stories', callback_data: 'view_stories' }]
                  ]
                }
              });
            }
          } else {
            bot.sendMessage(chatId, storyMsg, {
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: '💬 Reply', callback_data: `reply_story_${storyId}` },
                    { text: '❤️ React', callback_data: `react_story_${storyId}` }
                  ],
                  [{ text: '🔙 Back to Stories', callback_data: 'view_stories' }]
                ]
              }
            });
          }
        } catch (err) {
          bot.sendMessage(chatId, '❌ Unable to load this story. It may have expired.');
        }
      }
    });
  }

  setupStoryCallbacks();

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const text = msg.text;

    if (!text || text.startsWith('/')) return;

    const userState = userStates[telegramId];

    if (userState && userState.awaitingStory) {
      // ... existing code for awaitingStory ...
    } else if (userState && userState.awaitingStoryReply) {
      try {
        const { storyId, isAnonymous } = userState;
        const storyOwnerId = (await axios.get(`${API_BASE}/stories/${storyId}`)).data.userId;

        await axios.post(`${API_BASE}/stories/message`, {
          storyId,
          storyOwnerId,
          fromUserId: telegramId,
          message: text,
          isAnonymous: isAnonymous
        });

        bot.sendMessage(chatId, `✅ Your message has been sent ${isAnonymous ? 'anonymously' : 'with your identity revealed'}!`);
        delete userStates[telegramId];
      } catch (err) {
        console.error('Error sending story reply:', err);
        bot.sendMessage(chatId, '❌ Failed to send story reply. Please try again.');
      }
    }
  });
}

module.exports = { setupSocialCommands };
