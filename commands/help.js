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
          bot.sendMessage(chatId,
            `� *Email Support*\n\nSend your request to:\n📮 *spprtksbt@gmail.com*\n\n📋 *Please include:*\n• Your username: @${query.from.username || 'N/A'}\n• Your user ID: \`${telegramId}\`\n• Detailed description of your issue\n• Screenshots if relevant\n\n⏰ *Response time:* 24-48 hours`,
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '💬 Message @kissSupport', url: 'https://t.me/kissSupport' }],
                  [{ text: '🔙 Back to Help', callback_data: 'show_help' }]
                ]
              }
            }
          );
          break;

        case 'contact_support': {
          const supportMsg =
            `🆘 *Support Center*\n\n` +
            `Our support team is here to help!\n\n` +
            `💬 *Telegram:* @kissSupport\n` +
            `📧 *Email:* spprtksbt@gmail.com\n` +
            `⏰ Response time: 24\u201348 hours\n\n` +
            `💬 *Common Issues:*\n` +
            `• Profile visibility\n` +
            `• Payment / VIP problems\n` +
            `• Technical difficulties\n` +
            `• Account recovery\n` +
            `• Report violations`;

          bot.sendMessage(chatId, supportMsg, {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '� Message @kissSupport', url: 'https://t.me/kissSupport' }],
                [{ text: '🔙 Back to Help', callback_data: 'show_help' }]
              ]
            }
          });
          break;
        }

        case 'show_help':
        case 'help_menu':
          const helpText = `🤖 **KISSUBOT HELP CENTER** 🤖\n\n` +
            `Need help finding your way around KissuBot? Choose a category below for more information:\n\n` +
            `💡 **Tip:** Complete your profile and add multiple photos to get more matches! 💕`;

          bot.sendMessage(chatId, helpText, {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '👤 Profile Help', callback_data: 'help_profile' },
                  { text: '🔍 Browsing Help', callback_data: 'help_browsing' }
                ],
                [
                  { text: '👑 VIP & Coins', callback_data: 'help_premium' },
                  { text: '📱 Stories Help', callback_data: 'help_stories' }
                ],
                [
                  { text: '📞 Contact Support', callback_data: 'contact_support' },
                  { text: '🚨 Report Center', callback_data: 'report_menu' }
                ],
                [
                  { text: '🏠 Main Menu', callback_data: 'main_menu' }
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
    const helpText = `🤖 **KISSUBOT HELP CENTER** 🤖\n\n` +
      `Need help finding your way around KissuBot? Choose a category below for more information:\n\n` +
      `💡 **Tip:** Complete your profile and add multiple photos to get more matches! 💕`;

    bot.sendMessage(chatId, helpText, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '👤 Profile Help', callback_data: 'help_profile' },
            { text: '🔍 Browsing Help', callback_data: 'help_browsing' }
          ],
          [
            { text: '👑 VIP & Coins', callback_data: 'help_premium' },
            { text: '📱 Stories Help', callback_data: 'help_stories' }
          ],
          [
            { text: '📞 Contact Support', callback_data: 'contact_support' },
            { text: '🚨 Report Center', callback_data: 'report_menu' }
          ],
          [
            { text: '🏠 Main Menu', callback_data: 'main_menu' }
          ]
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

  // CONTACT command
  bot.onText(/\/contact/, (msg) => {
    const chatId = msg.chat.id;
    const contactMsg =
      `🆘 *Support Center*\n\n` +
      `💬 *Telegram:* @kissSupport\n` +
      `� *Email:* spprtksbt@gmail.com\n\n` +
      `📋 *When contacting us, please include:*\n` +
      `• Your username: @${msg.from.username || 'N/A'}\n` +
      `• Description of the issue\n` +
      `• Screenshots if applicable\n\n` +
      `🙏 Thank you for using Kissubot!`;

    bot.sendMessage(chatId, contactMsg, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '� Message @kissSupport', url: 'https://t.me/kissSupport' }],
          [{ text: '🚨 Report Issue', callback_data: 'report_menu' }],
          [{ text: '🔙 Back to Help', callback_data: 'show_help' }]
        ]
      }
    });
  });
}

module.exports = { setupHelpCommands };
