const axios = require('axios');
const { getCachedUserProfile } = require('./auth');

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

function setupBrowsingCommands(bot) {
  // Callback query handlers
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const telegramId = query.from.id;
    const data = query.data;
    const message = query.message;

    // Check if data exists
    if (!data) {
      console.log('No callback data found');
      return;
    }

    try {
      // Like/Pass/SuperLike handlers
      if (data.startsWith('like_')) {
        const targetId = data.split('_')[1];
        const res = await axios.post(`${API_BASE}/like`, {
          fromUserId: telegramId,
          toUserId: targetId
        });
        
        bot.editMessageReplyMarkup({}, {
          chat_id: chatId,
          message_id: message.message_id
        });
        
        if (res.data.matched) {
          bot.sendMessage(chatId, `🎉 **IT'S A MATCH!** 🎉\n\nYou and ${res.data.matchedUser?.name || 'this person'} liked each other!\n\n💬 Start chatting now or use /matches to see all your matches.`);
        } else {
          bot.sendMessage(chatId, '❤️ You liked this profile! Use /browse to see more.');
        }
        
      } else if (data.startsWith('pass_')) {
        const targetId = data.split('_')[1];
        await axios.post(`${API_BASE}/pass`, {
          fromUserId: telegramId,
          toUserId: targetId
        });
        
        bot.editMessageReplyMarkup({}, {
          chat_id: chatId,
          message_id: message.message_id
        });
        
        bot.sendMessage(chatId, '👎 You passed on this profile. Use /browse to see more.');
        
      } else if (data.startsWith('superlike_')) {
        const targetId = data.split('_')[1];
        try {
          await axios.post(`${API_BASE}/superlike`, {
            fromUserId: telegramId,
            toUserId: targetId
          });
          
          bot.editMessageReplyMarkup({}, {
            chat_id: chatId,
            message_id: message.message_id
          });
          
          bot.sendMessage(chatId, '⭐ You super liked this profile! They\'ll be notified and you\'ll appear at the top of their queue.');
        } catch (err) {
          if (err.response?.data?.error === 'Insufficient coins') {
            bot.sendMessage(chatId, '❌ You need 10 coins to send a super like. Use /coins to buy more!');
          } else {
            bot.sendMessage(chatId, '❌ Failed to send super like. Please try again.');
          }
        }
        
      } else if (data.startsWith('chat_')) {
        const targetId = data.split('_')[1];
        bot.sendMessage(chatId, '💬 **Chat Feature Coming Soon!**\n\nFor now, you can:\n• Continue browsing with /browse\n• View your matches with /matches\n• Send gifts to show interest');
        
      } else if (data.startsWith('unmatch_')) {
        const targetId = data.split('_')[1];
        try {
          await axios.post(`${API_BASE}/matches/unmatch`, {
            fromId: telegramId,
            toId: targetId
          });
          bot.sendMessage(chatId, '💔 Successfully unmatched. Use /browse to find new matches!');
        } catch (err) {
          bot.sendMessage(chatId, '❌ Failed to unmatch. Please try again later.');
        }
        
      } else {
        switch (data) {
          case 'view_matches':
            try {
              const res = await axios.get(`${API_BASE}/matches/${telegramId}`);
              const matches = res.data;
        
              if (!matches || matches.length === 0) {
                return bot.sendMessage(chatId, 
                  '💞 **No Matches Yet** 💞\n\n' +
                  'Keep browsing to find your perfect match!\n\n' +
                  '💡 **Tips:**\n' +
                  '• Use /browse to see more profiles\n' +
                  '• Complete your profile to attract more likes\n' +
                  '• Add more photos to stand out\n\n' +
                  'Your special someone is out there! 💕'
                );
              }
        
              let matchMsg = `💕 **YOUR MATCHES (${matches.length})** 💕\n\n`;
              
              matches.slice(0, 10).forEach((match, index) => {
                matchMsg += `${index + 1}. **${match.name}**, ${match.age}\n`;
                matchMsg += `   📍 ${match.location}\n`;
                if (match.bio) {
                  matchMsg += `   💬 ${match.bio.substring(0, 50)}${match.bio.length > 50 ? '...' : ''}\n`;
                }
                matchMsg += `\n`;
              });
        
              if (matches.length > 10) {
                matchMsg += `\n... and ${matches.length - 10} more matches!`;
              }
        
              const matchButtons = matches.slice(0, 5).map(match => ([
                { text: `💬 Chat with ${match.name}`, callback_data: `chat_${match.telegramId}` }
              ]));
        
              matchButtons.push([{ text: '🔙 Back to Menu', callback_data: 'main_menu' }]);
        
              bot.sendMessage(chatId, matchMsg, {
                reply_markup: {
                  inline_keyboard: matchButtons
                }
              });
            } catch (err) {
              console.error('Matches error:', err.response?.data || err.message);
              bot.sendMessage(chatId, '❌ Failed to load matches. Please try again later.');
            }
            break;
        }
      }
    } catch (err) {
      console.error('Browsing callback error:', err);
      bot.sendMessage(chatId, '❌ Something went wrong. Please try again.');
    }
  });
  // BROWSE command - Browse and like profiles
  bot.onText(/\/browse/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    try {
      // Check if user has a complete profile
      const user = await getCachedUserProfile(telegramId);
      if (!user.name || !user.age || !user.location) {
        return bot.sendMessage(chatId, 
          '⚠️ **Complete Your Profile First** ⚠️\n\n' +
          'Please complete your profile before browsing:\n' +
          '• Use /setname to set your name\n' +
          '• Use /setage to set your age\n' +
          '• Use /setlocation to set your location\n\n' +
          'Then come back and start browsing! 💕'
        );
      }

      // Get potential matches
      const res = await axios.get(`${API_BASE}/browse/${telegramId}`);
      const profiles = res.data;

      if (!profiles || profiles.length === 0) {
        return bot.sendMessage(chatId, 
          '😔 **No More Profiles** 😔\n\n' +
          'You\'ve seen all available profiles in your area!\n\n' +
          '💡 **Try:**\n' +
          '• Expanding your search radius in /settings\n' +
          '• Checking back later for new users\n' +
          '• Inviting friends to join Kisu1bot!'
        );
      }

      // Show first profile
      const profile = profiles[0];
      const profileMsg = `💕 **${profile.name}, ${profile.age}** 💕\n\n` +
        `📍 ${profile.location}\n\n` +
        `💬 ${profile.bio || 'No bio available'}\n\n` +
        `What do you think?`;

      const opts = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '💚 LIKE', callback_data: `like_${profile.telegramId}` },
              { text: '💔 PASS', callback_data: `pass_${profile.telegramId}` }
            ],
            [
              { text: '⭐ SUPER LIKE', callback_data: `superlike_${profile.telegramId}` }
            ],
            [
              { text: '🔙 Back to Menu', callback_data: 'main_menu' }
            ]
          ]
        }
      };

      if (profile.photos && profile.photos.length > 0) {
        // Send photo with caption
        bot.sendPhoto(chatId, profile.photos[0], {
          caption: profileMsg,
          reply_markup: opts.reply_markup
        });
      } else {
        // Send text message
        bot.sendMessage(chatId, profileMsg, opts);
      }

    } catch (err) {
      console.error('Browse error:', err.response?.data || err.message);
      bot.sendMessage(chatId, '❌ Failed to load profiles. Please try again later.');
    }
  });

  // MATCHES command - View matches
  bot.onText(/\/matches/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    try {
      const res = await axios.get(`${API_BASE}/matches/${telegramId}`);
      const matches = res.data;

      if (!matches || matches.length === 0) {
        return bot.sendMessage(chatId, 
          '💞 **No Matches Yet** 💞\n\n' +
          'Keep browsing to find your perfect match!\n\n' +
          '💡 **Tips:**\n' +
          '• Use /browse to see more profiles\n' +
          '• Complete your profile to attract more likes\n' +
          '• Add more photos to stand out\n\n' +
          'Your special someone is out there! 💕'
        );
      }

      let matchMsg = `💞 **YOUR MATCHES (${matches.length})** 💞\n\n`;
      
      matches.forEach((match, index) => {
        matchMsg += `${index + 1}. **${match.name}, ${match.age}**\n`;
        matchMsg += `   📍 ${match.location}\n`;
        matchMsg += `   💬 Matched ${match.matchedAt}\n\n`;
      });

      matchMsg += `💕 **Start chatting with your matches!**\n`;
      matchMsg += `Use the buttons below to connect:`;

      const keyboard = matches.slice(0, 5).map(match => ([
        { text: `💬 Chat with ${match.name}`, callback_data: `chat_${match.telegramId}` }
      ]));

      keyboard.push([{ text: '🔙 Back to Menu', callback_data: 'main_menu' }]);

      bot.sendMessage(chatId, matchMsg, {
        reply_markup: { inline_keyboard: keyboard }
      });

    } catch (err) {
      console.error('Matches error:', err.response?.data || err.message);
      bot.sendMessage(chatId, '❌ Failed to load matches. Please try again later.');
    }
  });

  // LIKESYOU command - VIP feature
  bot.onText(/\/likesyou/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    try {
      const user = await getCachedUserProfile(telegramId);
      
      if (!user.isVip) {
        return bot.sendMessage(chatId,
          '⭐ **VIP FEATURE** ⭐\n\n' +
          '👀 **See Who Likes You** is a VIP feature!\n\n' +
          '💎 **With VIP you get:**\n' +
          '• See who liked your profile\n' +
          '• Unlimited likes\n' +
          '• Priority in browse queue\n' +
          '• Advanced search filters\n\n' +
          '🚀 **Upgrade to VIP now!**',
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '⭐ Get VIP', callback_data: 'manage_vip' }],
                [{ text: '🔙 Back', callback_data: 'main_menu' }]
              ]
            }
          }
        );
      }

      const res = await axios.get(`${API_BASE}/likes/${telegramId}`);
      const likes = res.data;

      if (!likes || likes.length === 0) {
        return bot.sendMessage(chatId, 
          '👀 **WHO LIKES YOU** 👀\n\n' +
          'No one has liked your profile yet.\n\n' +
          '💡 **Tips to get more likes:**\n' +
          '• Add more photos\n' +
          '• Write an interesting bio\n' +
          '• Stay active on the app\n\n' +
          'Keep browsing and your likes will come! 💕'
        );
      }

      let likesMsg = `👀 **${likes.length} PEOPLE LIKE YOU** 👀\n\n`;
      
      likes.forEach((like, index) => {
        likesMsg += `${index + 1}. **${like.name}, ${like.age}**\n`;
        likesMsg += `   📍 ${like.location}\n`;
        likesMsg += `   💕 Liked ${like.likedAt}\n\n`;
      });

      likesMsg += `💚 **Like them back to match!**`;

      bot.sendMessage(chatId, likesMsg, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '💚 Browse & Like Back', callback_data: 'browse' }],
            [{ text: '🔙 Back to Menu', callback_data: 'main_menu' }]
          ]
        }
      });

    } catch (err) {
      console.error('Likes You error:', err.response?.data || err.message);
      bot.sendMessage(chatId, '❌ Failed to load likes. Please try again later.');
    }
  });
}

module.exports = { setupBrowsingCommands };
