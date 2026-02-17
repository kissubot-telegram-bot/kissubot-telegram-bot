const { getCachedUserProfile } = require('./auth');

function setupBrowsingCommands(bot, User, Match, Like) {
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

        const fromUser = await User.findOne({ telegramId });
        const toUser = await User.findOne({ telegramId: targetId });

        if (!fromUser || !toUser) {
          return bot.sendMessage(chatId, 'User not found.');
        }

        // Create a new like
        const like = new Like({
          fromUserId: fromUser._id,
          toUserId: toUser._id,
        });
        await like.save();

        bot.editMessageReplyMarkup({}, {
          chat_id: chatId,
          message_id: message.message_id
        });

        // Check for a match
        const existingLike = await Like.findOne({ fromUserId: toUser._id, toUserId: fromUser._id });
        if (existingLike) {
          // Create a match
          const match = new Match({
            user1Id: fromUser._id,
            user2Id: toUser._id,
          });
          await match.save();

          // Send celebration message with conversation starters
          const conversationStarters = [
            `Ask about their favorite travel destination 🌍`,
            `Comment on something from their bio 💬`,
            `Ask what they're looking for 💕`,
            `Share a fun fact about yourself ✨`,
            `Ask about their weekend plans 🎉`
          ];
          const randomStarter = conversationStarters[Math.floor(Math.random() * conversationStarters.length)];

          bot.sendMessage(chatId,
            `🎉💖 **IT'S A MATCH!** 💖🎉\n\n` +
            `You and **${toUser.name}** liked each other!\n\n` +
            `💡 **Conversation Starter:**\n${randomStarter}\n\n` +
            `💬 Start chatting now or use /matches to see all your matches.`,
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '💬 Start Chat', url: `tg://user?id=${targetId}` }],
                  [{ text: '💌 View All Matches', callback_data: 'view_matches' }]
                ]
              }
            }
          );
        } else {
          bot.sendMessage(chatId, '❤️ You liked this profile! Use /browse to see more.');
        }

      } else if (data.startsWith('pass_')) {
        const targetId = data.split('_')[1];
        // In a direct DB model, a "pass" might not need to be stored.
        // If you want to prevent seeing the same profile again, you would add logic here.

        bot.editMessageReplyMarkup({}, {
          chat_id: chatId,
          message_id: message.message_id
        });

        bot.sendMessage(chatId, '👎 You passed on this profile. Use /browse to see more.');

      } else if (data.startsWith('superlike_')) {
        const targetId = data.split('_')[1];
        const fromUser = await User.findOne({ telegramId });

        if (fromUser.coins < 10) {
          return bot.sendMessage(chatId, '❌ You need 10 coins to send a super like. Use /coins to buy more!');
        }

        fromUser.coins -= 10;
        await fromUser.save();

        // Logic to notify the other user and boost profile would go here.

        bot.editMessageReplyMarkup({}, {
          chat_id: chatId,
          message_id: message.message_id
        });

        bot.sendMessage(chatId, '⭐ You super liked this profile! They\'ll be notified and you\'ll appear at the top of their queue.');

      } else if (data.startsWith('chat_')) {
        const targetId = data.split('_')[1];
        bot.sendMessage(chatId, '💬 **Chat Feature Coming Soon!**\n\nFor now, you can:\n• Continue browsing with /browse\n• View your matches with /matches\n• Send gifts to show interest');

      } else if (data.startsWith('unmatch_')) {
        const targetId = data.split('_')[1];
        const fromUser = await User.findOne({ telegramId });
        const toUser = await User.findOne({ telegramId: targetId });

        if (fromUser && toUser) {
          await Match.deleteOne({
            $or: [
              { user1Id: fromUser._id, user2Id: toUser._id },
              { user1Id: toUser._id, user2Id: fromUser._id },
            ],
          });
          bot.sendMessage(chatId, '💔 Successfully unmatched. Use /browse to find new matches!');
        } else {
          bot.sendMessage(chatId, '❌ Failed to unmatch. Please try again later.');
        }

      } else {
        switch (data) {
          case 'view_matches':
            try {
              const user = await User.findOne({ telegramId });
              if (!user) {
                return bot.sendMessage(chatId, 'User not found.');
              }
              const matches = await Match.find({ $or: [{ user1Id: user._id }, { user2Id: user._id }] }).populate('user1Id').populate('user2Id');

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
                const otherUser = match.user1Id.telegramId === telegramId ? match.user2Id : match.user1Id;
                matchMsg += `${index + 1}. **${otherUser.name}**, ${otherUser.age}\n`;
                matchMsg += `   📍 ${otherUser.location}\n`;
                if (otherUser.bio) {
                  matchMsg += `   💬 ${otherUser.bio.substring(0, 50)}${otherUser.bio.length > 50 ? '...' : ''}\n`;
                }
                matchMsg += `\n`;
              });

              if (matches.length > 10) {
                matchMsg += `\n... and ${matches.length - 10} more matches!`;
              }

              const matchButtons = matches.slice(0, 5).map(match => {
                const otherUser = match.user1Id.telegramId === telegramId ? match.user2Id : match.user1Id;
                return ([
                  { text: `💬 Chat with ${otherUser.name}`, callback_data: `chat_${otherUser.telegramId}` }
                ])
              });

              matchButtons.push([{ text: '🔙 Back to Menu', callback_data: 'main_menu' }]);

              bot.sendMessage(chatId, matchMsg, {
                reply_markup: {
                  inline_keyboard: matchButtons
                }
              });
            } catch (err) {
              console.error('Matches error:', err);
              bot.sendMessage(chatId, '❌ Failed to load matches. Please try again later.');
            }
            break;
        }
      }
    } catch (err) {
      console.error('Browsing callback error:', err);
      return bot.sendMessage(chatId, '❌ Something went wrong. Please try again.');
    }
  });
  // BROWSE command - Browse and like profiles
  bot.onText(/\/browse/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    try {
      // Check profile completion
      const user = await getCachedUserProfile(telegramId, User);

      if (!user) {
        return bot.sendMessage(chatId, '❌ User not found. Please use /start to begin.');
      }

      if (!user.termsAccepted) {
        return bot.sendMessage(chatId,
          '⚠️ **Terms Required** ⚠️\n\n' +
          'You must accept our Terms of Service and Privacy Policy to use KissuBot.\n\n' +
          'Use /start to begin.'
        );
      }

      if (!user.profileCompleted) {
        const missing = [];
        if (!user.name) missing.push('• Name - Use /setname');
        if (!user.age) missing.push('• Age - Use /setage');
        if (!user.location) missing.push('• Location - Use /setlocation');
        if (!user.bio) missing.push('• Bio - Use /setbio');
        if (!user.photos || user.photos.length === 0) missing.push('• Photo - Use /photos');

        return bot.sendMessage(chatId,
          '⚠️ **Complete Your Profile** ⚠️\n\n' +
          'Please complete your profile to access browsing:\n\n' +
          `${missing.join('\n')}\n\n` +
          'Once complete, you can start browsing! 💕'
        );
      }

      // Check if user has a complete profile
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
      const currentUser = await User.findOne({ telegramId });
      if (!currentUser) {
        return bot.sendMessage(chatId, 'User not found.');
      }

      let query = User.find({ telegramId: { $ne: telegramId } });
      if (!currentUser.isVip) {
        query = query.limit(5);
      }

      const profiles = await query;

      if (!profiles || profiles.length === 0) {
        return bot.sendMessage(chatId,
          '😔 **No More Profiles** 😔\n\n' +
          'You\'ve seen all available profiles in your area!\n\n' +
          '💡 **Try:**\n' +
          '• Expanding your search radius in /settings\n' +
          '• Checking back later for new users\n' +
          '• Inviting friends to join Kissubot!'
        );
      }

      // Show first profile
      const profile = profiles[0];
      const profileId = profile.telegramId || profile._id || profile.id || profile.userId;

      const profileMsg = `💕 **${profile.name}, ${profile.age}** 💕\n\n` +
        `📍 ${profile.location}\n\n` +
        `💬 ${profile.bio || 'No bio available'}\n\n` +
        `What do you think?`;

      const opts = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '💚 LIKE', callback_data: `like_${profileId}` },
              { text: '💔 PASS', callback_data: `pass_${profileId}` }
            ],
            [
              { text: '⭐ SUPER LIKE', callback_data: `superlike_${profileId}` }
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
      console.error('Browse error:', err);
      return bot.sendMessage(chatId, '❌ Failed to load profiles. Please try again later.');
    }
  });

  // MATCHES command - View matches
  bot.onText(/\/matches/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    try {
      // Check profile completion
      const user = await User.findOne({ telegramId });

      if (!user) {
        return bot.sendMessage(chatId, '❌ User not found. Please use /start to begin.');
      }

      if (!user.termsAccepted) {
        return bot.sendMessage(chatId,
          '⚠️ **Terms Required** ⚠️\n\n' +
          'You must accept our Terms of Service and Privacy Policy to use KissuBot.\n\n' +
          'Use /start to begin.'
        );
      }

      if (!user.profileCompleted) {
        const missing = [];
        if (!user.name) missing.push('• Name - Use /setname');
        if (!user.age) missing.push('• Age - Use /setage');
        if (!user.location) missing.push('• Location - Use /setlocation');
        if (!user.bio) missing.push('• Bio - Use /setbio');
        if (!user.photos || user.photos.length === 0) missing.push('• Photo - Use /photos');

        return bot.sendMessage(chatId,
          '⚠️ **Complete Your Profile** ⚠️\n\n' +
          'Please complete your profile to view matches:\n\n' +
          `${missing.join('\n')}\n\n` +
          'Once complete, you can see your matches! 💕'
        );
      }

      if (!user) {
        return bot.sendMessage(chatId, 'User not found.');
      }
      const matches = await Match.find({ $or: [{ user1Id: user._id }, { user2Id: user._id }] }).populate('user1Id').populate('user2Id');

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
        const otherUser = match.user1Id.telegramId === telegramId ? match.user2Id : match.user1Id;
        matchMsg += `${index + 1}. **${otherUser.name}, ${otherUser.age}**\n`;
        matchMsg += `   📍 ${otherUser.location}\n`;
        matchMsg += `   💬 Matched on ${new Date(match.createdAt).toLocaleDateString()}\n\n`;
      });

      matchMsg += `💕 **Start chatting with your matches!**\n`;
      matchMsg += `Use the buttons below to connect:`;

      const keyboard = matches.slice(0, 5).map(match => {
        const otherUser = match.user1Id.telegramId === telegramId ? match.user2Id : match.user1Id;
        return ([
          { text: `💬 Chat with ${otherUser.name}`, callback_data: `chat_${otherUser.telegramId}` }
        ])
      });

      keyboard.push([{ text: '🔙 Back to Menu', callback_data: 'main_menu' }]);

      bot.sendMessage(chatId, matchMsg, {
        reply_markup: { inline_keyboard: keyboard }
      });

    } catch (err) {
      console.error('Matches error:', err);
      return bot.sendMessage(chatId, '❌ Failed to load matches. Please try again later.');
    }
  });

  // LIKESYOU command - VIP feature
  bot.onText(/\/likesyou/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    try {
      const user = await getCachedUserProfile(telegramId, User);

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

      const currentUser = await User.findOne({ telegramId });
      const likes = await Like.find({ toUserId: currentUser._id }).populate('fromUserId');

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
        const otherUser = like.fromUserId;
        likesMsg += `${index + 1}. **${otherUser.name}, ${otherUser.age}**\n`;
        likesMsg += `   📍 ${otherUser.location}\n`;
        likesMsg += `   💕 Liked on ${new Date(like.createdAt).toLocaleDateString()}\n\n`;
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
      console.error('Likes You error:', err);
      return bot.sendMessage(chatId, '❌ Failed to load likes. Please try again later.');
    }
  });
}

module.exports = { setupBrowsingCommands };
