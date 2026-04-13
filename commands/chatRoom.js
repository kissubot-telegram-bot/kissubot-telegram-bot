const { MAIN_KEYBOARD } = require('../keyboard');

function setupChatRoomCommands(bot, User, ChatRoom, userStates) {
  
  // Generate unique room ID for two users
  function generateRoomId(userId1, userId2) {
    const sorted = [userId1, userId2].sort();
    return `room_${sorted[0]}_${sorted[1]}`;
  }

  // Enter private chat room with a match
  async function enterChatRoom(chatId, telegramId, targetTelegramId) {
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

      // Generate or get existing room
      const roomId = generateRoomId(String(telegramId), String(targetTelegramId));
      
      let chatRoom = await ChatRoom.findOne({ roomId });
      if (!chatRoom) {
        // Create new chat room
        chatRoom = new ChatRoom({
          roomId,
          participants: [String(telegramId), String(targetTelegramId)],
          messages: [],
          settings: {
            muted: new Map(),
            blocked: false
          }
        });
        await chatRoom.save();
        console.log('[CHAT ROOM] Created new room:', roomId);
      }

      // Check if room is blocked
      if (chatRoom.settings.blocked) {
        return bot.sendMessage(chatId, '❌ This chat has been blocked.');
      }

      // Set user state to chat room mode
      userStates.set(String(telegramId), {
        mode: 'chat_room',
        roomId: roomId,
        targetUserId: String(targetTelegramId),
        targetName: targetUser.name
      });

      // Mark unread messages as read
      let unreadCount = 0;
      chatRoom.messages.forEach(msg => {
        if (msg.from === String(targetTelegramId) && !msg.read && !msg.deleted) {
          msg.read = true;
          unreadCount++;
        }
      });
      if (unreadCount > 0) {
        await chatRoom.save();
      }

      // Get recent messages for display
      const recentMessages = chatRoom.messages
        .filter(msg => !msg.deleted)
        .slice(-5)
        .map(msg => {
          const sender = msg.from === String(telegramId) ? 'You' : targetUser.name;
          const time = new Date(msg.timestamp).toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
          });
          return `${time} - ${sender}: ${msg.text}`;
        })
        .join('\n');

      const totalMessages = chatRoom.messages.filter(msg => !msg.deleted).length;

      let welcomeMsg = `╔════════════════════════════╗\n`;
      welcomeMsg += `║  💬 Private Chat with ${targetUser.name}  ║\n`;
      welcomeMsg += `╚════════════════════════════╝\n\n`;
      welcomeMsg += `🔒 *This is your private space*\n`;
      welcomeMsg += `Only you and ${targetUser.name} can see this\n\n`;
      
      if (totalMessages > 0) {
        welcomeMsg += `📜 *Recent Messages:*\n${recentMessages}\n\n`;
      } else {
        welcomeMsg += `💡 *Start the conversation!*\nBe the first to say hi!\n\n`;
      }
      
      welcomeMsg += `Type your message below to send it to ${targetUser.name}`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: '📜 View Full History', callback_data: `chat_history_${targetTelegramId}` },
            { text: '🚪 Exit Chat', callback_data: 'exit_chat_room' }
          ],
          [
            { text: '🔇 Mute', callback_data: `mute_chat_${targetTelegramId}` },
            { text: '🚫 Block', callback_data: `block_chat_${targetTelegramId}` }
          ]
        ]
      };

      await bot.sendMessage(chatId, welcomeMsg, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

      console.log(`[CHAT ROOM] User ${telegramId} entered room ${roomId}`);

    } catch (error) {
      console.error('[CHAT ROOM] Error entering room:', error);
      bot.sendMessage(chatId, '❌ Failed to enter chat room. Please try again.');
    }
  }

  // Exit chat room
  async function exitChatRoom(chatId, telegramId) {
    const state = userStates.get(String(telegramId));
    if (state && state.mode === 'chat_room') {
      userStates.delete(String(telegramId));
      await bot.sendMessage(chatId, 
        '✅ You left the chat room.\n\nUse /matches to view your matches.',
        { reply_markup: MAIN_KEYBOARD }
      );
      console.log(`[CHAT ROOM] User ${telegramId} exited chat room`);
    }
  }

  // Send message in chat room
  async function sendChatMessage(chatId, telegramId, messageText) {
    try {
      const state = userStates.get(String(telegramId));
      if (!state || state.mode !== 'chat_room') {
        return; // Not in chat room mode
      }

      const { roomId, targetUserId, targetName } = state;

      const chatRoom = await ChatRoom.findOne({ roomId });
      if (!chatRoom) {
        await bot.sendMessage(chatId, '❌ Chat room not found.');
        return exitChatRoom(chatId, telegramId);
      }

      if (chatRoom.settings.blocked) {
        await bot.sendMessage(chatId, '❌ This chat has been blocked.');
        return exitChatRoom(chatId, telegramId);
      }

      // Add message to room
      chatRoom.messages.push({
        from: String(telegramId),
        text: messageText,
        timestamp: new Date(),
        read: false,
        deleted: false
      });
      chatRoom.lastActivity = new Date();
      await chatRoom.save();

      // Confirm message sent
      await bot.sendMessage(chatId, 
        `✅ Message sent to ${targetName}\n\n_Continue typing to send more messages_`,
        { parse_mode: 'Markdown' }
      );

      // Notify the other user
      await notifyNewMessage(targetUserId, telegramId, messageText);

      console.log(`[CHAT ROOM] Message sent in ${roomId} from ${telegramId}`);

    } catch (error) {
      console.error('[CHAT ROOM] Error sending message:', error);
      bot.sendMessage(chatId, '❌ Failed to send message. Please try again.');
    }
  }

  // Notify user of new message
  async function notifyNewMessage(targetUserId, fromUserId, messageText) {
    try {
      const fromUser = await User.findOne({ telegramId: String(fromUserId) });
      if (!fromUser) return;

      const preview = messageText.length > 50 ? messageText.substring(0, 50) + '...' : messageText;

      await bot.sendMessage(String(targetUserId),
        `💬 *New message from ${fromUser.name}*\n\n"${preview}"\n\n_Tap below to reply_`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '💬 Open Chat', callback_data: `enter_chat_${fromUserId}` }
            ]]
          }
        }
      );

      console.log(`[CHAT ROOM] Notification sent to ${targetUserId}`);
    } catch (error) {
      console.error('[CHAT ROOM] Error sending notification:', error);
    }
  }

  // View full chat history
  async function viewChatHistory(chatId, telegramId, targetUserId) {
    try {
      const roomId = generateRoomId(String(telegramId), String(targetUserId));
      const chatRoom = await ChatRoom.findOne({ roomId });

      if (!chatRoom || chatRoom.messages.length === 0) {
        return bot.sendMessage(chatId, '📭 No messages yet in this chat.');
      }

      const targetUser = await User.findOne({ telegramId: String(targetUserId) });
      const targetName = targetUser?.name || 'User';

      const messages = chatRoom.messages
        .filter(msg => !msg.deleted)
        .slice(-20) // Last 20 messages
        .map(msg => {
          const sender = msg.from === String(telegramId) ? 'You' : targetName;
          const time = new Date(msg.timestamp).toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            month: 'short',
            day: 'numeric'
          });
          const readStatus = msg.read ? '✓✓' : '✓';
          return `${time} - *${sender}*: ${msg.text} ${msg.from === String(telegramId) ? readStatus : ''}`;
        })
        .join('\n\n');

      let historyMsg = `📜 *Chat History with ${targetName}*\n\n`;
      historyMsg += `${messages}\n\n`;
      historyMsg += `_Showing last 20 messages_`;

      await bot.sendMessage(chatId, historyMsg, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '🔙 Back to Chat', callback_data: `enter_chat_${targetUserId}` }
          ]]
        }
      });

    } catch (error) {
      console.error('[CHAT ROOM] Error viewing history:', error);
      bot.sendMessage(chatId, '❌ Failed to load chat history.');
    }
  }

  // Mute chat
  async function muteChat(chatId, telegramId, targetUserId) {
    try {
      const roomId = generateRoomId(String(telegramId), String(targetUserId));
      const chatRoom = await ChatRoom.findOne({ roomId });

      if (!chatRoom) {
        return bot.sendMessage(chatId, '❌ Chat room not found.');
      }

      const currentMuted = chatRoom.settings.muted.get(String(telegramId)) || false;
      chatRoom.settings.muted.set(String(telegramId), !currentMuted);
      await chatRoom.save();

      const status = !currentMuted ? 'muted' : 'unmuted';
      await bot.sendMessage(chatId, `🔇 Chat ${status}. You won't receive notifications.`);

    } catch (error) {
      console.error('[CHAT ROOM] Error muting chat:', error);
      bot.sendMessage(chatId, '❌ Failed to mute chat.');
    }
  }

  // Block chat
  async function blockChat(chatId, telegramId, targetUserId) {
    try {
      const roomId = generateRoomId(String(telegramId), String(targetUserId));
      const chatRoom = await ChatRoom.findOne({ roomId });

      if (!chatRoom) {
        return bot.sendMessage(chatId, '❌ Chat room not found.');
      }

      chatRoom.settings.blocked = true;
      await chatRoom.save();

      await bot.sendMessage(chatId, '🚫 Chat blocked. This conversation has been closed.');
      exitChatRoom(chatId, telegramId);

    } catch (error) {
      console.error('[CHAT ROOM] Error blocking chat:', error);
      bot.sendMessage(chatId, '❌ Failed to block chat.');
    }
  }

  return {
    enterChatRoom,
    exitChatRoom,
    sendChatMessage,
    viewChatHistory,
    muteChat,
    blockChat
  };
}

module.exports = { setupChatRoomCommands };
