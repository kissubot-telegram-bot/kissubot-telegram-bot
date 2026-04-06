const { MAIN_KEYBOARD } = require('../keyboard');

function setupChatCommands(bot, User, userStates) {
  
  // Start in-bot chat with a match
  async function startInBotChat(chatId, telegramId, targetTelegramId) {
    try {
      const [currentUser, targetUser] = await Promise.all([
        User.findOne({ telegramId: String(telegramId) }),
        User.findOne({ telegramId: String(targetTelegramId) })
      ]);

      if (!currentUser || !targetUser) {
        return bot.sendMessage(chatId, '❌ User not found.');
      }

      // Check if they are matched
      const match = currentUser.matches.find(m => String(m.userId) === String(targetTelegramId));
      if (!match) {
        return bot.sendMessage(chatId, '❌ You need to match with this user first.');
      }

      // Set user state to in-bot chat mode
      userStates.set(String(telegramId), {
        action: 'in_bot_chat',
        targetUserId: String(targetTelegramId),
        matchId: match._id
      });

      // Get message counts
      const myMessages = match.messageCount?.user1 || 0;
      const theirMessages = match.messageCount?.user2 || 0;
      const messagesLeft = Math.max(0, 3 - myMessages);
      const chatUnlocked = match.chatUnlocked || false;

      let statusMsg = `💬 *Chat with ${targetUser.name}*\n\n`;
      
      if (chatUnlocked) {
        statusMsg += `✅ *Private chat unlocked!*\n\nYou can now open a direct Telegram chat.\n\n`;
        statusMsg += `📝 Messages sent: ${myMessages}/3\n`;
        statusMsg += `📩 Messages received: ${theirMessages}/3\n\n`;
        statusMsg += `Type your message below or tap the button to open private chat.`;
      } else {
        statusMsg += `📝 You have *${messagesLeft} messages* left to send.\n`;
        statusMsg += `📩 ${targetUser.name} has sent ${theirMessages} message(s).\n\n`;
        
        if (myMessages === 0 && theirMessages === 0) {
          statusMsg += `💡 *Start the conversation!*\nBoth of you need to send at least 1 message to unlock private chat.\n\n`;
        } else if (myMessages > 0 && theirMessages === 0) {
          statusMsg += `⏳ Waiting for ${targetUser.name} to reply...\n\n`;
        } else if (myMessages === 0 && theirMessages > 0) {
          statusMsg += `💬 ${targetUser.name} sent you a message! Reply to unlock private chat.\n\n`;
        } else {
          statusMsg += `🎉 Almost there! Keep chatting to unlock private chat.\n\n`;
        }
        
        statusMsg += `Type your message below to continue.`;
      }

      const keyboard = {
        inline_keyboard: []
      };

      // Show chat history button if there are messages
      if (match.inBotMessages && match.inBotMessages.length > 0) {
        keyboard.inline_keyboard.push([
          { text: '📜 View Chat History', callback_data: `view_chat_history_${targetTelegramId}` }
        ]);
      }

      // Show private chat button if unlocked
      if (chatUnlocked) {
        const chatUrl = targetUser.username
          ? `https://t.me/${targetUser.username}`
          : `tg://user?id=${targetTelegramId}`;
        keyboard.inline_keyboard.push([
          { text: `💬 Open Private Chat with ${targetUser.name}`, url: chatUrl }
        ]);
      }

      keyboard.inline_keyboard.push([
        { text: '🔙 Back to Matches', callback_data: 'view_matches' }
      ]);

      await bot.sendMessage(chatId, statusMsg, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

    } catch (error) {
      console.error('Error starting in-bot chat:', error);
      bot.sendMessage(chatId, '❌ Failed to start chat. Please try again.');
    }
  }

  // Handle incoming messages in chat mode
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = String(msg.from.id);
    const text = msg.text;

    if (!text) return;

    const state = userStates.get(telegramId);
    if (!state || state.action !== 'in_bot_chat') return;

    const targetUserId = state.targetUserId;

    try {
      const [currentUser, targetUser] = await Promise.all([
        User.findOne({ telegramId }),
        User.findOne({ telegramId: targetUserId })
      ]);

      if (!currentUser || !targetUser) {
        userStates.delete(telegramId);
        return bot.sendMessage(chatId, '❌ User not found.');
      }

      // Find the match in current user's matches
      const myMatch = currentUser.matches.find(m => String(m.userId) === targetUserId);
      if (!myMatch) {
        userStates.delete(telegramId);
        return bot.sendMessage(chatId, '❌ Match not found.');
      }

      // Initialize message counts if not present
      if (!myMatch.messageCount) {
        myMatch.messageCount = { user1: 0, user2: 0 };
      }

      // Check if user has reached message limit
      if (myMatch.messageCount.user1 >= 3) {
        return bot.sendMessage(chatId, 
          `⚠️ You've reached your message limit (3/3).\n\n` +
          (myMatch.chatUnlocked 
            ? `Use the "Open Private Chat" button to continue your conversation.`
            : `Wait for ${targetUser.name} to reply to unlock private chat.`),
          { parse_mode: 'Markdown' }
        );
      }

      // Add message to current user's match
      if (!myMatch.inBotMessages) {
        myMatch.inBotMessages = [];
      }
      myMatch.inBotMessages.push({
        from: telegramId,
        text: text,
        sentAt: new Date()
      });
      myMatch.messageCount.user1 += 1;
      myMatch.lastMessage = { text: text, sentAt: new Date() };

      // Find and update the match in target user's matches
      const theirMatch = targetUser.matches.find(m => String(m.userId) === telegramId);
      if (theirMatch) {
        if (!theirMatch.inBotMessages) {
          theirMatch.inBotMessages = [];
        }
        theirMatch.inBotMessages.push({
          from: telegramId,
          text: text,
          sentAt: new Date()
        });
        if (!theirMatch.messageCount) {
          theirMatch.messageCount = { user1: 0, user2: 0 };
        }
        theirMatch.messageCount.user2 += 1;
        theirMatch.lastMessage = { text: text, sentAt: new Date() };
        theirMatch.unreadCount = (theirMatch.unreadCount || 0) + 1;

        // Check if chat should be unlocked (both users sent at least 1 message)
        if (myMatch.messageCount.user1 >= 1 && myMatch.messageCount.user2 >= 1 && !myMatch.chatUnlocked) {
          myMatch.chatUnlocked = true;
          theirMatch.chatUnlocked = true;
        }
      }

      await Promise.all([currentUser.save(), targetUser.save()]);

      // Send confirmation to sender
      const messagesLeft = 3 - myMatch.messageCount.user1;
      let confirmMsg = `✅ Message sent to *${targetUser.name}*!\n\n`;
      confirmMsg += `📝 Messages left: ${messagesLeft}/3\n\n`;

      if (myMatch.chatUnlocked) {
        confirmMsg += `🎉 *Private chat unlocked!* You can now open direct chat.\n\n`;
      } else if (myMatch.messageCount.user1 >= 1 && myMatch.messageCount.user2 >= 1) {
        confirmMsg += `🎉 *Chat unlocked!* Both of you have sent messages.\n\n`;
      } else if (myMatch.messageCount.user2 === 0) {
        confirmMsg += `⏳ Waiting for ${targetUser.name} to reply...\n\n`;
      }

      confirmMsg += `Type another message or use the buttons below.`;

      const keyboard = {
        inline_keyboard: []
      };

      if (myMatch.chatUnlocked) {
        const chatUrl = targetUser.username
          ? `https://t.me/${targetUser.username}`
          : `tg://user?id=${targetUserId}`;
        keyboard.inline_keyboard.push([
          { text: `💬 Open Private Chat with ${targetUser.name}`, url: chatUrl }
        ]);
      }

      keyboard.inline_keyboard.push([
        { text: '🔙 Back to Matches', callback_data: 'view_matches' }
      ]);

      await bot.sendMessage(chatId, confirmMsg, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

      // Notify the target user
      try {
        let notifyMsg = `💬 *New message from ${currentUser.name}!*\n\n`;
        notifyMsg += `"${text}"\n\n`;
        
        if (theirMatch.chatUnlocked) {
          notifyMsg += `✅ Private chat is unlocked! Tap below to reply.`;
        } else {
          const theirMessagesLeft = 3 - (theirMatch.messageCount?.user1 || 0);
          notifyMsg += `📝 You have ${theirMessagesLeft} messages left to send.\n`;
          notifyMsg += `💡 Reply to unlock private chat!`;
        }

        const notifyKeyboard = {
          inline_keyboard: [
            [{ text: `💬 Reply to ${currentUser.name}`, callback_data: `chat_gate_${telegramId}` }]
          ]
        };

        if (theirMatch.chatUnlocked) {
          const chatUrl = currentUser.username
            ? `https://t.me/${currentUser.username}`
            : `tg://user?id=${telegramId}`;
          notifyKeyboard.inline_keyboard.unshift([
            { text: `💬 Open Private Chat with ${currentUser.name}`, url: chatUrl }
          ]);
        }

        await bot.sendMessage(targetUserId, notifyMsg, {
          parse_mode: 'Markdown',
          reply_markup: notifyKeyboard
        });
      } catch (notifyError) {
        // Target user may have blocked the bot
        console.log('Could not notify target user:', notifyError.message);
      }

    } catch (error) {
      console.error('Error handling in-bot chat message:', error);
      bot.sendMessage(chatId, '❌ Failed to send message. Please try again.');
    }
  });

  // View chat history callback
  bot.on('callback_query', async (query) => {
    const data = query.data;
    if (!data || !data.startsWith('view_chat_history_')) return;

    const chatId = query.message.chat.id;
    const telegramId = String(query.from.id);
    const targetUserId = data.replace('view_chat_history_', '');

    try {
      await bot.answerCallbackQuery(query.id);

      const [currentUser, targetUser] = await Promise.all([
        User.findOne({ telegramId }),
        User.findOne({ telegramId: targetUserId })
      ]);

      if (!currentUser || !targetUser) {
        return bot.sendMessage(chatId, '❌ User not found.');
      }

      const match = currentUser.matches.find(m => String(m.userId) === targetUserId);
      if (!match || !match.inBotMessages || match.inBotMessages.length === 0) {
        return bot.sendMessage(chatId, '📭 No messages yet. Start the conversation!');
      }

      let historyMsg = `💬 *Chat History with ${targetUser.name}*\n\n`;
      
      match.inBotMessages.forEach((msg, index) => {
        const sender = String(msg.from) === telegramId ? 'You' : targetUser.name;
        const time = new Date(msg.sentAt).toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        historyMsg += `*${sender}* (${time}):\n${msg.text}\n\n`;
      });

      historyMsg += `───────────────\n`;
      historyMsg += `📝 Your messages: ${match.messageCount?.user1 || 0}/3\n`;
      historyMsg += `📩 Their messages: ${match.messageCount?.user2 || 0}/3\n`;

      if (match.chatUnlocked) {
        historyMsg += `\n✅ Private chat unlocked!`;
      }

      const keyboard = {
        inline_keyboard: [
          [{ text: '💬 Continue Chat', callback_data: `chat_gate_${targetUserId}` }],
          [{ text: '🔙 Back to Matches', callback_data: 'view_matches' }]
        ]
      };

      if (match.chatUnlocked) {
        const chatUrl = targetUser.username
          ? `https://t.me/${targetUser.username}`
          : `tg://user?id=${targetUserId}`;
        keyboard.inline_keyboard.unshift([
          { text: `💬 Open Private Chat with ${targetUser.name}`, url: chatUrl }
        ]);
      }

      await bot.sendMessage(chatId, historyMsg, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

    } catch (error) {
      console.error('Error viewing chat history:', error);
      bot.sendMessage(chatId, '❌ Failed to load chat history.');
    }
  });

  return { startInBotChat };
}

module.exports = { setupChatCommands };
