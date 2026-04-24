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

      // Get recent messages for display with chat-like formatting
      const recentMessages = chatRoom.messages
        .filter(msg => !msg.deleted)
        .slice(-5)
        .map(msg => {
          const isMe = msg.from === String(telegramId);
          const time = new Date(msg.timestamp).toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
          });
          
          if (isMe) {
            // Right-aligned for user's messages
            return `                    _${time}_\n                    *You:* ${msg.text} ✓`;
          } else {
            // Left-aligned for match's messages
            return `_${time}_\n*${targetUser.name}:* ${msg.text}`;
          }
        })
        .join('\n\n');

      const totalMessages = chatRoom.messages.filter(msg => !msg.deleted).length;

      let welcomeMsg = `┌─────────────────────────┐\n`;
      welcomeMsg += `│   💬 Chat with ${targetUser.name}   │\n`;
      welcomeMsg += `└─────────────────────────┘\n\n`;
      
      if (totalMessages > 0) {
        welcomeMsg += `${recentMessages}\n\n`;
        welcomeMsg += `─────────────────────────\n`;
        welcomeMsg += `� _Type your message below..._`;
      } else {
        welcomeMsg += `� *Private conversation*\n`;
        welcomeMsg += `Only you and ${targetUser.name} can see this\n\n`;
        welcomeMsg += `💡 Say hi to start chatting!\n\n`;
        welcomeMsg += `─────────────────────────\n`;
        welcomeMsg += `💬 _Type your message below..._`;
      }

      const dmUrl = targetUser.username
        ? `https://t.me/${targetUser.username}`
        : `tg://user?id=${targetTelegramId}`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: '💬 Private DM', url: dmUrl },
            { text: '📜 View Full History', callback_data: `chat_history_${targetTelegramId}` }
          ],
          [
            { text: '🚪 Exit Chat', callback_data: 'exit_chat_room' },
            { text: '🚫 Block User', callback_data: `block_chat_${targetTelegramId}` }
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

      // Show message in chat-like format
      const time = new Date().toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      await bot.sendMessage(chatId, 
        `                    _${time}_\n                    *You:* ${messageText} ✓\n\n─────────────────────────\n💬 _Continue typing..._`,
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
      if (!targetUser) {
        return bot.sendMessage(chatId, '❌ User not found.');
      }
      const targetName = targetUser?.name || 'User';

      const messages = chatRoom.messages
        .filter(msg => !msg.deleted)
        .slice(-20) // Last 20 messages
        .map(msg => {
          const isMe = msg.from === String(telegramId);
          const time = new Date(msg.timestamp).toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            month: 'short',
            day: 'numeric'
          });
          const readStatus = msg.read ? '✓✓' : '✓';
          
          if (isMe) {
            return `                    _${time}_\n                    *You:* ${msg.text} ${readStatus}`;
          } else {
            return `_${time}_\n*${targetName}:* ${msg.text}`;
          }
        })
        .join('\n\n');

      let historyMsg = `┌─────────────────────────┐\n`;
      historyMsg += `│   📜 Chat History   │\n`;
      historyMsg += `└─────────────────────────┘\n\n`;
      historyMsg += `${messages}\n\n`;
      historyMsg += `─────────────────────────\n`;
      historyMsg += `_Last 20 messages_`;

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

  // Block/Unblock chat
  async function blockChat(chatId, telegramId, targetUserId) {
    try {
      const roomId = generateRoomId(String(telegramId), String(targetUserId));
      const chatRoom = await ChatRoom.findOne({ roomId });

      if (!chatRoom) {
        return bot.sendMessage(chatId, '❌ Chat room not found.');
      }

      const isBlocked = chatRoom.settings.blocked || false;
      chatRoom.settings.blocked = !isBlocked;
      await chatRoom.save();

      if (!isBlocked) {
        await bot.sendMessage(chatId, '🚫 Chat blocked. This conversation has been closed.');
        exitChatRoom(chatId, telegramId);
      } else {
        await bot.sendMessage(chatId, '✅ Chat unblocked. You can now continue the conversation.');
      }

    } catch (error) {
      console.error('[CHAT ROOM] Error blocking/unblocking chat:', error);
      bot.sendMessage(chatId, '❌ Failed to update block status.');
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
