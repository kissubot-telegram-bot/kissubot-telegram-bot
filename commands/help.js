const axios = require('axios');

const API_BASE = process.env.API_BASE || 'http://localhost:3000/api';

function setupHelpCommands(bot) {
  // HELP command
  bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    const helpMsg = `🤖 **KISU1BOT HELP GUIDE** 🤖\n\n` +
      `📋 **Main Commands:**\n` +
      `• /start - Welcome message\n` +
      `• /register - Create your dating profile\n` +
      `• /browse - Browse and like profiles\n` +
      `• /profile - View/edit your profile\n` +
      `• /settings - Access all settings\n\n` +
      `💕 **Dating Features:**\n` +
      `• /matches - See your matches\n` +
      `• /likesyou - See who likes you (VIP)\n` +
      `• /photo - Upload profile photos\n\n` +
      `⭐ **Premium Features:**\n` +
      `• /vip - Upgrade to VIP\n` +
      `• /coins - Buy coins\n` +
      `• /gifts - Send virtual gifts\n\n` +
      `❓ **Need More Help?**`;

    const opts = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📞 Contact Support', callback_data: 'contact_support' },
            { text: '⭐ Get VIP', callback_data: 'manage_vip' }
          ],
          [
            { text: '📚 User Guide', callback_data: 'user_guide' },
            { text: '🚨 Report Issue', callback_data: 'report_menu' }
          ],
          [
            { text: '💬 Send Feedback', callback_data: 'email_feedback' }
          ]
        ]
      }
    };

    bot.sendMessage(chatId, helpMsg, opts);
  });

  // REPORT command
  bot.onText(/\/report/, (msg) => {
    const chatId = msg.chat.id;
    const reportMsg = `🚨 **REPORT CENTER** 🚨\n\n` +
      `Help us keep Kisu1bot safe for everyone!\n\n` +
      `📋 **What would you like to report?**\n\n` +
      `• **User Report** - Inappropriate behavior\n` +
      `• **Content Report** - Inappropriate photos/messages\n` +
      `• **Bug Report** - Technical issues\n` +
      `• **Feature Request** - Suggest improvements\n\n` +
      `🔒 **All reports are confidential and reviewed by our team.**`;

    const opts = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '👤 Report User', callback_data: 'report_user' },
            { text: '📸 Report Content', callback_data: 'report_content' }
          ],
          [
            { text: '🐛 Report Bug', callback_data: 'report_bug' },
            { text: '💡 Feature Request', callback_data: 'feature_request' }
          ],
          [
            { text: '🔙 Back to Help', callback_data: 'show_help' }
          ]
        ]
      }
    };

    bot.sendMessage(chatId, reportMsg, opts);
  });

  // DELETE command
  bot.onText(/\/delete/, (msg) => {
    const chatId = msg.chat.id;
    const deleteMsg = `⚠️ **DELETE PROFILE** ⚠️\n\n` +
      `🚨 **WARNING: This action cannot be undone!**\n\n` +
      `💔 **Deleting your profile will remove:**\n` +
      `• All your profile information\n` +
      `• All your photos\n` +
      `• All your matches and conversations\n` +
      `• Your VIP status and coins\n\n` +
      `🤔 **Before you delete, consider:**\n` +
      `• Taking a break instead (deactivate temporarily)\n` +
      `• Contacting support if you're having issues\n` +
      `• Adjusting your settings instead\n\n` +
      `💭 **What would you like to do?**`;

    const opts = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '❌ Cancel - Keep My Profile', callback_data: 'cancel_delete' }
          ],
          [
            { text: '⏸️ Deactivate Temporarily', callback_data: 'deactivate_profile' }
          ],
          [
            { text: '🗑️ DELETE PERMANENTLY', callback_data: 'confirm_delete_profile' }
          ],
          [
            { text: '📞 Contact Support First', callback_data: 'contact_support' }
          ]
        ]
      }
    };

    bot.sendMessage(chatId, deleteMsg, opts);
  });

  // CONTACT command
  bot.onText(/\/contact/, (msg) => {
    const chatId = msg.chat.id;
    const contactMsg = `📞 **CONTACT SUPPORT** 📞\n\n` +
      `Our support team is here to help!\n\n` +
      `📧 **Email Support:**\n` +
      `support@kisu1bot.com\n\n` +
      `💬 **Live Chat:**\n` +
      `Available 9 AM - 6 PM EST\n\n` +
      `📋 **When contacting us, please include:**\n` +
      `• Your username: @${msg.from.username || 'N/A'}\n` +
      `• Description of the issue\n` +
      `• Screenshots if applicable\n\n` +
      `⏱️ **Response Time:** Usually within 24 hours\n\n` +
      `🙏 **Thank you for using Kisu1bot!**`;

    const opts = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📧 Email Support', callback_data: 'email_support' },
            { text: '💬 Send Feedback', callback_data: 'email_feedback' }
          ],
          [
            { text: '🚨 Report Issue', callback_data: 'report_menu' }
          ],
          [
            { text: '🔙 Back to Help', callback_data: 'show_help' }
          ]
        ]
      }
    };

    bot.sendMessage(chatId, contactMsg, opts);
  });
}

module.exports = { setupHelpCommands };
