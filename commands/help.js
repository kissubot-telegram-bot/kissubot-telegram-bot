const axios = require('axios');

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

function setupHelpCommands(bot) {
  // Callback query handlers
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const telegramId = query.from.id;
    const data = query.data;

    try {
      switch (data) {
        case 'email_support':
          bot.sendMessage(chatId, `📧 **EMAIL SUPPORT** 📧\n\n` +
            `Send your support request to:\n` +
            `📮 **spprtksbt@gmail.com**\n\n` +
            `📋 **Please include:**\n` +
            `• Your Telegram username: @${query.from.username || 'N/A'}\n` +
            `• Your user ID: ${telegramId}\n` +
            `• Detailed description of your issue\n` +
            `• Screenshots if relevant\n\n` +
            `⏰ **Response time:** 24-48 hours\n\n` +
            `💡 **Tip:** Copy the email address above and paste it in your email app.`);
          break;

        case 'contact_support':
          const supportMsg = `📞 **CONTACT SUPPORT** 📞\n\n` +
            `Our support team is here to help!\n\n` +
            `🕐 **Support Hours:**\n` +
            `Monday - Friday: 9 AM - 6 PM UTC\n` +
            `Weekend: Limited support\n\n` +
            `📧 **Contact Methods:**\n` +
            `• Email: spprtksbt@gmail.com\n` +
            `• Response time: 24-48 hours\n\n` +
            `💬 **Common Issues:**\n` +
            `• Profile not showing up\n` +
            `• Payment/VIP problems\n` +
            `• Technical difficulties\n` +
            `• Account recovery\n` +
            `• Report violations\n\n` +
            `📋 **Before contacting:**\n` +
            `• Check /help for common solutions\n` +
            `• Include your Telegram username\n` +
            `• Describe the issue clearly`;

          bot.sendMessage(chatId, supportMsg, {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '📧 Send Email', callback_data: 'email_support' }
                ],
                [
                  { text: '🔙 Back to Help', callback_data: 'show_help' }
                ]
              ]
            },
            parse_mode: 'Markdown'
          });
          break;

        case 'show_help':
        case 'help_menu':
          const helpText = `🤖 **KISSUBOT HELP** 🤖\n\n` +
            `📋 **Available Commands:**\n\n` +
            `🏠 /start - Start the bot and access main menu\n` +
            `👤 /profile - View and edit your profile\n` +
            `🔍 /browse - Browse potential matches\n` +
            `💕 /matches - View your matches\n` +
            `⚙️ /settings - Access settings menu\n` +
            `📱 /stories - View and post stories\n` +
            `💰 /coins - Check coin balance and buy coins\n` +
            `👑 /vip - Manage VIP membership\n` +
            `❓ /help - View commands and access help center\n\n` +
            `💡 **Tips:**\n` +
            `• Complete your profile to get more matches\n` +
            `• Upload multiple photos for better visibility\n` +
            `• Use VIP features to boost your profile\n` +
            `• Post stories to increase engagement\n\n` +
            `📞 **Need Support?**\n` +
            `Contact us at: spprtksbt@gmail.com\n\n` +
            `Happy matching! 💙`;

          bot.sendMessage(chatId, helpText, {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '📞 Contact Support', callback_data: 'contact_support' }
                ],
                [
                  { text: '🔙 Back to Menu', callback_data: 'main_menu' }
                ]
              ]
            },
            parse_mode: 'Markdown'
          });
          break;
      }
    } catch (err) {
      console.error('Help callback error:', err);
      bot.sendMessage(chatId, '❌ Something went wrong. Please try again.');
    }
  });

  // HELP command
  bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    const helpText = `🤖 **KISSUBOT HELP** 🤖\n\n` +
      `📋 **Available Commands:**\n\n` +
      `🏠 /start - Start the bot and access main menu\n` +
      `👤 /profile - View and edit your profile\n` +
      `🔍 /browse - Browse potential matches\n` +
      `💕 /matches - View your matches\n` +
      `⚙️ /settings - Access settings menu\n` +
      `📱 /stories - View and post stories\n` +
      `💰 /coins - Check coin balance and buy coins\n` +
      `👑 /vip - Manage VIP membership\n` +
      `❓ /help - View commands and access help center\n\n` +
      `💡 **Tips:**\n` +
      `• Complete your profile to get more matches\n` +
      `• Upload multiple photos for better visibility\n` +
      `• Use VIP features to boost your profile\n` +
      `• Post stories to increase engagement\n\n` +
      `Happy matching! 💙`;

    bot.sendMessage(chatId, helpText, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📧 Email Support (spprtksbt@gmail.com)', callback_data: 'email_support' }],
          [{ text: '📞 Contact Support', callback_data: 'contact_support' }],
          [{ text: '🔙 Back to Menu', callback_data: 'main_menu' }]
        ]
      },
      parse_mode: 'Markdown'
    });
  });

  // REPORT command
  bot.onText(/\/report/, (msg) => {
    const chatId = msg.chat.id;
    const reportMsg = `🚨 **REPORT CENTER** 🚨\n\n` +
      `Help us keep Kissubot safe for everyone!\n\n` +
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
      `support@kissubot.com\n\n` +
      `💬 **Live Chat:**\n` +
      `Available 9 AM - 6 PM EST\n\n` +
      `📋 **When contacting us, please include:**\n` +
      `• Your username: @${msg.from.username || 'N/A'}\n` +
      `• Description of the issue\n` +
      `• Screenshots if applicable\n\n` +
      `⏱️ **Response Time:** Usually within 24 hours\n\n` +
      `🙏 **Thank you for using Kissubot!**`;

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
