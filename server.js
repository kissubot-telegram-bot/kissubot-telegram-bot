const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

// Define PORT early so it's available before first app.listen
const PORT = process.env.PORT || 3003;

// Configure Cloudinary BEFORE importing bot
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});



const TelegramBot = require('node-telegram-bot-api');

// Bot initialization
const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('❌ BOT_TOKEN is required in .env file');
  process.exit(1);
}
// Use polling for local development, webhook for production
const useWebhook = process.env.USE_WEBHOOK === 'true';
const bot = new TelegramBot(token, { polling: !useWebhook });

// Import and setup command modules
const { setupAuthCommands } = require('./commands/auth');
const { setupTermsCommands } = require('./commands/terms');
const { setupProfileCommands } = require('./commands/profile');
const { setupBrowsingCommands } = require('./commands/browsing');
const { setupHelpCommands } = require('./commands/help');
const { setupSettingsCommands } = require('./commands/settings');
const { setupPremiumCommands } = require('./commands/premium');
const { setupGiftCommands } = require('./commands/gifts');
const { setupSocialDebugCommands } = require('./commands/social-debug');
const { setupSocialCommands } = require('./commands/social');
const { setupLikesCommands } = require('./commands/likes');
const { setupMatchesCommands } = require('./commands/matches');
const { setupPaymentCommands } = require('./commands/payment');
const { setupChatCommands } = require('./commands/chat');
const { setupDebugMatchesCommand } = require('./commands/debug-matches');

const userStates = new Map();

const app = express();
app.use(bodyParser.json());

// CORS middleware for admin dashboard
app.use((req, res, next) => {
  const allowedOrigins = [
    'https://genuine-youtiao-657363.netlify.app',
    'http://localhost:3002',
    'http://localhost:3000'
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin) || !origin) {
    res.header('Access-Control-Allow-Origin', origin || '*');
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Health check endpoint for dashboard
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    bot: !!bot,
    uptime: process.uptime(),
    endpoints: {
      admin_stats: '/admin/stats',
      admin_users: '/admin/users',
      admin_revenue: '/admin/revenue'
    }
  });
});

// Explicit route for admin dashboard index (must come before static middleware)
app.get('/admin', (req, res) => {
  res.sendFile(__dirname + '/admin/index.html');
});

app.get('/admin/', (req, res) => {
  res.sendFile(__dirname + '/admin/index.html');
});

// Serve admin dashboard static files (CSS, JS, etc.)
app.use('/admin', express.static('admin'));

// Health check endpoint (original)
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Terms of Service HTML View
app.get('/docs/terms', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Terms of Service - KissuBot</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.7; padding: 20px; color: #222; background: #fff; }
        h1 { color: #e63950; font-size: 1.6rem; margin-bottom: 4px; }
        h2 { font-size: 1.05rem; margin-top: 24px; color: #e63950; }
        .meta { color: #888; font-size: 0.85rem; margin-bottom: 20px; }
        .container { max-width: 640px; margin: 0 auto; }
        hr { border: none; border-top: 1px solid #eee; margin: 18px 0; }
        ul { padding-left: 20px; }
        li { margin-bottom: 4px; }
        a { color: #e63950; }
        p { margin: 8px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Terms of Service</h1>
        <p class="meta">Effective Date: 18 March 2026 &nbsp;|&nbsp; Last Updated: 18 March 2026</p>
        <p>Welcome to KissuBot ("we," "our," or "us"). These Terms of Service ("Terms") govern your use of our Telegram bot, services, and platform (collectively, the "Service").</p>
        <p>By accessing or using KissuBot, you agree to be bound by these Terms. If you do not agree, do not use the Service.</p>

        <hr>
        <h2>1. ELIGIBILITY</h2>
        <ul>
          <li>You must be at least 18 years old to use KissuBot.</li>
          <li>By using the Service, you confirm that you are 18 years or older and have the legal capacity to enter into this agreement.</li>
        </ul>
        <p>We reserve the right to suspend or terminate accounts that violate this requirement.</p>

        <hr>
        <h2>2. DESCRIPTION OF SERVICE</h2>
        <p>KissuBot is a Telegram-based platform that allows users to create profiles, discover and match with other users, communicate through the platform, and access premium features through paid subscriptions.</p>
        <p>We may modify, update, or discontinue any part of the Service at any time.</p>

        <hr>
        <h2>3. USER ACCOUNTS</h2>
        <p>You agree to provide accurate and truthful information, keep your account secure, and be responsible for all activity under your account.</p>
        <p>We are not responsible for any loss or damage resulting from unauthorized account access.</p>

        <hr>
        <h2>4. USER CONDUCT</h2>
        <p>You agree NOT to:</p>
        <ul>
          <li>Use the Service for illegal purposes</li>
          <li>Harass, abuse, or harm other users</li>
          <li>Share false, misleading, or fraudulent information</li>
          <li>Upload inappropriate, explicit, or offensive content</li>
          <li>Impersonate another person</li>
          <li>Attempt to scam or exploit other users</li>
        </ul>
        <p>We reserve the right to remove content or suspend accounts that violate these rules.</p>

        <hr>
        <h2>5. USER CONTENT</h2>
        <p>You are responsible for all content you share, including profile information, photos, and messages. By using KissuBot, you grant us a limited license to display and use your content for operating and improving the Service.</p>
        <p>We do not guarantee the accuracy or authenticity of user content.</p>

        <hr>
        <h2>6. MATCHING AND INTERACTIONS</h2>
        <p>KissuBot does not guarantee matches, responses from other users, or compatibility/outcomes of interactions. You are solely responsible for your interactions with other users. Always exercise caution when communicating or meeting others.</p>

        <hr>
        <h2>7. PAYMENTS AND SUBSCRIPTIONS</h2>
        <ul>
          <li>All purchases are final and non-refundable, unless required by law</li>
          <li>Subscription benefits are activated upon successful payment</li>
          <li>We reserve the right to change pricing at any time</li>
        </ul>
        <p>Failure of payment may result in loss of premium access.</p>

        <hr>
        <h2>8. TERMINATION</h2>
        <p>We may suspend or terminate your access if you violate these Terms, engage in harmful or abusive behavior, or we are required to do so by law. You may stop using the Service at any time.</p>

        <hr>
        <h2>9. DISCLAIMERS</h2>
        <p>The Service is provided "as is" and "as available." We do not guarantee continuous availability, error-free operation, or that the Service will meet your expectations. Use the Service at your own risk.</p>

        <hr>
        <h2>10. LIMITATION OF LIABILITY</h2>
        <p>To the fullest extent permitted by law, KissuBot shall not be liable for indirect or consequential damages, loss of data, profits, or opportunities, or any interactions between users.</p>

        <hr>
        <h2>11. PRIVACY</h2>
        <p>Your use of the Service is also governed by our <a href="/docs/privacy">Privacy Policy</a>, which explains how we collect and use your data.</p>

        <hr>
        <h2>12. CHANGES TO TERMS</h2>
        <p>We may update these Terms at any time. Continued use of the Service after updates means you accept the revised Terms.</p>

        <hr>
        <h2>13. GOVERNING LAW</h2>
        <p>These Terms shall be governed by and interpreted in accordance with the laws of USA, Delaware.</p>

        <hr>
        <h2>14. CONTACT</h2>
        <p>For questions or support:</p>
        <ul>
          <li>Email: <a href="mailto:spprtksbt@gmail.com">spprtksbt@gmail.com</a></li>
          <li>Telegram: <a href="https://t.me/kissuSupport">@kissuSupport</a></li>
        </ul>

        <hr>
        <h2>15. ACCEPTANCE</h2>
        <p>By using KissuBot, you acknowledge that you have read, understood, and agree to these Terms of Service.</p>
        <br><br>
      </div>
    </body>
    </html>
  `);
});

// Privacy Policy HTML View
app.get('/docs/privacy', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Privacy Policy - KissuBot</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.7; padding: 20px; color: #222; background: #fff; }
        h1 { color: #e63950; font-size: 1.6rem; margin-bottom: 4px; }
        h2 { font-size: 1.05rem; margin-top: 24px; color: #e63950; }
        h3 { font-size: 0.95rem; margin-top: 14px; color: #555; }
        .meta { color: #888; font-size: 0.85rem; margin-bottom: 20px; }
        .container { max-width: 640px; margin: 0 auto; }
        hr { border: none; border-top: 1px solid #eee; margin: 18px 0; }
        ul { padding-left: 20px; }
        li { margin-bottom: 4px; }
        a { color: #e63950; }
        p { margin: 8px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Privacy Policy</h1>
        <p class="meta">Effective Date: 18 March 2026 &nbsp;|&nbsp; Last Updated: 18 March 2026</p>
        <p>Welcome to KissuBot ("we," "our," or "us"). This Privacy Policy explains how we collect, use, store, and protect your information when you use our Telegram bot and services (the "Service").</p>
        <p>By using KissuBot, you agree to the practices described in this Privacy Policy.</p>

        <hr>
        <h2>1. INFORMATION WE COLLECT</h2>
        <h3>🔹 a. Personal Information</h3>
        <ul>
          <li>Name or username</li>
          <li>Age and gender</li>
          <li>Location</li>
          <li>Profile photos</li>
          <li>Bio or profile description</li>
        </ul>
        <h3>🔹 b. Telegram Data</h3>
        <ul>
          <li>Telegram User ID</li>
          <li>Telegram username</li>
          <li>Messages and interactions within the bot</li>
        </ul>
        <h3>🔹 c. Usage Data</h3>
        <ul>
          <li>Activity within the bot (matches, swipes, chats)</li>
          <li>Log data (timestamps, actions performed)</li>
          <li>Device or connection information (if available)</li>
        </ul>
        <h3>🔹 d. Payment Information</h3>
        <ul>
          <li>Transaction details (subscription status, purchase history)</li>
        </ul>
        <p><em>Note: We do NOT store sensitive payment details such as card numbers. Payments are processed through third-party providers (e.g., Telegram, crypto platforms).</em></p>

        <hr>
        <h2>2. HOW WE USE YOUR INFORMATION</h2>
        <p>We use your information to:</p>
        <ul>
          <li>Provide and operate the Service</li>
          <li>Create and manage user profiles</li>
          <li>Enable matching and communication between users</li>
          <li>Process payments and subscriptions</li>
          <li>Improve features, performance, and user experience</li>
          <li>Detect and prevent fraud, abuse, or illegal activity</li>
          <li>Communicate updates, promotions, or important notices</li>
        </ul>

        <hr>
        <h2>3. HOW YOUR INFORMATION IS SHARED</h2>
        <p>We do <strong>NOT</strong> sell your personal data.</p>
        <h3>🔹 With Other Users</h3>
        <ul>
          <li>Your profile (photos, name, age, bio) is visible to other users</li>
          <li>Messages are shared with users you interact with</li>
        </ul>
        <h3>🔹 With Service Providers</h3>
        <ul>
          <li>Hosting providers</li>
          <li>Payment processors</li>
          <li>Analytics tools</li>
        </ul>
        <h3>🔹 Legal Requirements</h3>
        <p>We may disclose information if required by law or to protect our rights, prevent fraud or abuse, or comply with legal obligations.</p>

        <hr>
        <h2>4. DATA RETENTION</h2>
        <p>We retain your data as long as your account is active, as needed to provide the Service, and to comply with legal obligations.</p>
        <p>You may request deletion of your account and data at any time.</p>

        <hr>
        <h2>5. DATA SECURITY</h2>
        <p>We take reasonable measures to protect your data, including secure servers, access controls, and monitoring for unauthorized activity.</p>
        <p>However, no system is 100% secure. Use the Service at your own risk.</p>

        <hr>
        <h2>6. YOUR RIGHTS</h2>
        <p>Depending on your location, you may have the right to:</p>
        <ul>
          <li>Access your personal data</li>
          <li>Correct inaccurate information</li>
          <li>Request deletion of your data</li>
          <li>Withdraw consent</li>
        </ul>
        <p>To exercise these rights, contact us using the details below.</p>

        <hr>
        <h2>7. AGE RESTRICTION</h2>
        <p>KissuBot is strictly for users 18 years and older. We do not knowingly collect data from individuals under 18. If we become aware of such data, it will be removed immediately.</p>

        <hr>
        <h2>8. THIRD-PARTY SERVICES</h2>
        <p>Our Service may rely on third-party platforms such as Telegram and payment providers (e.g., crypto or Telegram payments). These services have their own privacy policies, and we are not responsible for their practices.</p>

        <hr>
        <h2>9. INTERNATIONAL USE</h2>
        <p>Your data may be processed and stored in different countries. By using the Service, you consent to such transfers.</p>

        <hr>
        <h2>10. CHANGES TO THIS POLICY</h2>
        <p>We may update this Privacy Policy at any time. We will notify users of significant changes where appropriate. Continued use of the Service means you accept the updated policy.</p>

        <hr>
        <h2>11. CONTACT US</h2>
        <p>If you have any questions or requests regarding this Privacy Policy:</p>
        <ul>
          <li>Email: <a href="mailto:spprtksbt@gmail.com">spprtksbt@gmail.com</a></li>
          <li>Telegram: <a href="https://t.me/kissuSupport">@kissuSupport</a></li>
        </ul>

        <hr>
        <h2>12. CONSENT</h2>
        <p>By using KissuBot, you acknowledge that you have read, understood, and agreed to this Privacy Policy.</p>
        <br><br>
      </div>
    </body>
    </html>
  `);
});

// Test endpoint to verify server is reachable
app.get('/test', (req, res) => {
  console.log('✅ Test endpoint hit!');
  res.json({
    status: 'success',
    message: 'Server is reachable',
    timestamp: new Date().toISOString()
  });
});

// Webhook info endpoint - check current webhook status
app.get('/webhook-info', async (req, res) => {
  try {
    const webhookInfo = await bot.getWebHookInfo();
    console.log('📡 Current webhook info:', webhookInfo);
    res.json(webhookInfo);
  } catch (err) {
    console.error('Error getting webhook info:', err);
    res.status(500).json({ error: err.message });
  }
});

// Reset webhook endpoint - manually reset webhook
app.get('/reset-webhook', async (req, res) => {
  try {
    const webhookUrl = process.env.WEBHOOK_URL;
    if (!webhookUrl) {
      return res.status(400).json({ error: 'WEBHOOK_URL not set in environment variables' });
    }

    const baseWebhookUrl = webhookUrl.replace(/\/$/, '').replace(/\/webhook\/telegram$/, '');
    const fullWebhookUrl = `${baseWebhookUrl}/webhook/telegram`;
    
    console.log(`🔄 Resetting webhook to: ${fullWebhookUrl}`);
    
    // Delete old webhook first
    await bot.deleteWebHook();
    console.log('✅ Old webhook deleted');
    
    // Set new webhook
    await bot.setWebHook(fullWebhookUrl);
    console.log('✅ New webhook registered');
    
    // Get info to confirm
    const webhookInfo = await bot.getWebHookInfo();
    
    res.json({
      success: true,
      message: 'Webhook reset successfully',
      webhookInfo
    });
  } catch (err) {
    console.error('❌ Error resetting webhook:', err);
    res.status(500).json({ error: err.message });
  }
});

// Telegram webhook endpoint - receives updates from Telegram
app.post('/webhook/telegram', async (req, res) => {
  try {
    const update = req.body;

    console.log(`🔔 [Webhook] Incoming: "${update.message?.text || 'non-text message'}" from ${update.message?.from?.id}`);

    // Process the update through the bot instance
    bot.processUpdate(update);

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('❌ Webhook error:', err);
    res.status(200).json({ ok: true }); // Still return 200 so Telegram doesn't retry
  }
});

// Log all requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// Connect to MongoDB
console.log('MONGODB_URI:', process.env.MONGODB_URI);
// MongoDB connection with retry logic
const connectWithRetry = async () => {
  const maxRetries = 5;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
        socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
      });
      console.log('MongoDB connected successfully');

      const server = app.listen(PORT, '0.0.0.0', async () => {
        console.log(`Server is listening on port ${PORT}`);

        try {
          const webhookUrl = process.env.WEBHOOK_URL;
          if (!webhookUrl) {
            console.error('❌ CRITICAL: WEBHOOK_URL environment variable not set.');
            return; // Do not proceed if the URL isn't set
          }

          const baseWebhookUrl = webhookUrl.replace(/\/$/, '').replace(/\/webhook\/telegram$/, '');
          const fullWebhookUrl = `${baseWebhookUrl}/webhook/telegram`;
          console.log(`📡 Registering webhook with Telegram: ${fullWebhookUrl}`);

          await bot.setWebHook(fullWebhookUrl);
          console.log('✅ Webhook registered successfully with Telegram');
        } catch (err) {
          console.error('❌ Failed to register webhook:', err.message);
        }
      });

      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.error(`Error: Port ${PORT} is already in use. Please free up the port and try again.`);
          process.exit(1);
        } else {
          console.error('An unexpected error occurred:', err);
          process.exit(1);
        }
      });

      const gracefulShutdown = (signal) => {
        console.log(`${signal} received. Shutting down gracefully...`);
        server.close(async () => {
          console.log('HTTP server closed.');
          try {
            await mongoose.connection.close();
            console.log('MongoDB connection closed.');
            process.exit(0);
          } catch (err) {
            console.error('Error closing MongoDB:', err);
            process.exit(1);
          }
        });
      };

      process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
      process.on('SIGINT', () => gracefulShutdown('SIGINT'));

      // ── Admin Alert System ─────────────────────────────────────────────
      const ALERT_ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
      const alertState = { lastMatchCount: null, lastUserCount: null };

      async function runAlerts() {
        if (!bot || ALERT_ADMIN_IDS.length === 0) return;
        try {
          const now = new Date();
          const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
          const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000);

          const [matchesTodayAgg, newToday, recentMatchAgg] = await Promise.all([
            User.aggregate([
              { $unwind: '$matches' },
              { $match: { 'matches.matchedAt': { $gte: todayStart } } },
              { $group: { _id: null, count: { $sum: 1 } } }
            ]),
            User.countDocuments({ createdAt: { $gte: todayStart } }),
            User.aggregate([
              { $unwind: '$matches' },
              { $match: { 'matches.matchedAt': { $gte: twoHoursAgo } } },
              { $group: { _id: null, count: { $sum: 1 } } }
            ])
          ]);

          const matchesToday = Math.round((matchesTodayAgg[0]?.count || 0) / 2);
          const recentMatches = Math.round((recentMatchAgg[0]?.count || 0) / 2);
          const hour = now.getHours();
          const alerts = [];

          // Alert: no matches in last 2 hours (only during active hours 10am-11pm)
          if (hour >= 10 && hour <= 23 && recentMatches === 0) {
            alerts.push(`⚠️ *No matches* in the last 2 hours. Check if the matching system is working.`);
          }

          // Alert: matches dropped significantly vs yesterday's count
          if (alertState.lastMatchCount !== null && matchesToday < alertState.lastMatchCount * 0.5 && matchesToday < 5) {
            alerts.push(`📉 *Match drop detected:* Only ${matchesToday} matches today (was ${alertState.lastMatchCount} at last check).`);
          }

          // Alert: user spike — more than 50 new users today
          if (newToday > 50 && (alertState.lastUserCount === null || newToday > alertState.lastUserCount + 20)) {
            alerts.push(`🚀 *User spike!* ${newToday} new users joined today.`);
          }

          // Alert: zero matches all day (after 6pm)
          if (hour >= 18 && matchesToday === 0) {
            alerts.push(`🔴 *Zero matches today!* No matches have occurred at all today. Investigate immediately.`);
          }

          alertState.lastMatchCount = matchesToday;
          alertState.lastUserCount = newToday;

          if (alerts.length > 0) {
            const msg = `🤖 *KissuBot Alert*\n\n${alerts.join('\n\n')}\n\n_${now.toLocaleString()}_`;
            for (const adminId of ALERT_ADMIN_IDS) {
              await bot.sendMessage(adminId, msg, { parse_mode: 'Markdown' }).catch(() => {});
            }
            console.log(`[ALERTS] Sent ${alerts.length} alert(s) to ${ALERT_ADMIN_IDS.length} admin(s)`);
          }
        } catch (err) {
          console.error('[ALERTS] Error running alerts:', err.message);
        }
      }

      // Run alert check every hour
      setInterval(runAlerts, 60 * 60 * 1000);
      // Also run once on startup (after 2 min delay)
      setTimeout(runAlerts, 2 * 60 * 1000);
      console.log(`[ALERTS] Alert system started. Admin IDs: ${ALERT_ADMIN_IDS.length ? ALERT_ADMIN_IDS.join(', ') : 'none configured (set ADMIN_IDS env var)'}`);

      break;
    } catch (err) {
      retries += 1;
      console.error(`MongoDB connection attempt ${retries} failed:`, err.message);
      if (retries === maxRetries) {
        console.error('Max retries reached. Could not connect to MongoDB');
        process.exit(1);
      }
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
    }
  }
};

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected. Attempting to reconnect...');
  connectWithRetry();
});

// Initial connection
connectWithRetry();

// Configure multer for Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'kissubot_profiles',
  },
});

const upload = multer({ storage: storage });

// User Schema
const userSchema = new mongoose.Schema({
  // Basic Info
  telegramId: { type: String, required: true, unique: true },
  username: String,
  name: String,
  gender: String,      // e.g. 'Male', 'Female'
  lookingFor: String,  // e.g. 'Male', 'Female', 'Both'
  age: Number,
  location: { type: String, required: true },
  bio: String,
  phone: { type: String, default: null }, // Collected via Telegram contact share
  photos: [String], // Array of photo URLs (max 6)
  profilePhoto: String, // First photo for backward compatibility

  // Terms & Onboarding
  termsAccepted: { type: Boolean, default: false },
  termsAcceptedAt: Date,
  profileCompleted: { type: Boolean, default: false },
  onboardingStep: {
    type: String,
    enum: ['terms', 'registration', 'photo_upload', 'completed'],
    default: 'terms'
  },

  // Currency
  coins: { type: Number, default: 0 },

  // VIP Status
  isVip: { type: Boolean, default: false },
  vipDetails: {
    vipTier: { type: String, enum: ['bronze', 'silver', 'gold'], default: 'bronze' }, // New: VIP tier
    lastCoinGrantDate: { type: Date }, // New: To track monthly coin grants
    expiresAt: Date,
    subscriptionType: { type: String, enum: ['monthly', 'yearly', 'lifetime'] },
    benefits: {
      extraSwipes: { type: Number, default: 0 },
      hideAds: { type: Boolean, default: false },
      priorityMatch: { type: Boolean, default: false },
      seeViewers: { type: Boolean, default: false },
      specialBadge: { type: Boolean, default: false },
      unlimitedViewing: { type: Boolean, default: false },
      storyFilters: { type: Boolean, default: false },
      guaranteedMatches: { type: Boolean, default: false },
      monthlyCoins: { type: Number, default: 0 },
      adFree: { type: Boolean, default: false }
    }
  },

  // Priority Status
  hasPriority: { type: Boolean, default: false },
  priorityExpiresAt: Date,

  // Matching System
  likes: [{ type: String }], // Array of telegramIds who liked this user
  matches: [{
    userId: String,
    matchedAt: { type: Date, default: Date.now },
    lastMessage: {
      text: String,
      sentAt: Date
    },
    unreadCount: { type: Number, default: 0 },
    // In-bot chat system
    inBotMessages: [{
      from: String, // telegramId of sender
      text: String,
      sentAt: { type: Date, default: Date.now }
    }],
    messageCount: {
      user1: { type: Number, default: 0 }, // messages sent by this user
      user2: { type: Number, default: 0 }  // messages sent by matched user
    },
    chatUnlocked: { type: Boolean, default: false }, // true when both users send 1+ message
    privateChatOpened: { type: Boolean, default: false }
  }],

  // Gifts System
  gifts: [{
    from: String,
    giftType: {
      type: String,
      enum: ['rose', 'heart', 'diamond', 'crown', 'ring']
    },
    sentAt: { type: Date, default: Date.now }
  }],

  // Stories System
  stories: [{
    mediaUrl: String,
    caption: String,
    createdAt: { type: Date, default: Date.now },
    expiresAt: Date,
    views: [{ type: String }], // Array of telegramIds who viewed
    reactions: [{
      userId: String,
      reaction: String, // emoji
      createdAt: { type: Date, default: Date.now }
    }],
    messages: [{
      fromUserId: String,
      message: String,
      isAnonymous: { type: Boolean, default: true },
      createdAt: { type: Date, default: Date.now },
      isRevealed: { type: Boolean, default: false }
    }]
  }],

  // Search Settings
  searchSettings: {
    ageMin: { type: Number, default: 18 },
    ageMax: { type: Number, default: 99 },
    maxDistance: { type: Number, default: 50 },
    genderPreference: { type: String, default: 'Any' },
    locationPreference: { type: String, default: null },
    hideLiked: { type: Boolean, default: true }
  },

  // Trust & Safety
  blocked: [{
    userId: { type: String },
    blockedAt: { type: Date, default: Date.now }
  }],

  // Stats Tracking
  stats: {
    likesGiven: { type: Number, default: 0 },
    likesReceived: { type: Number, default: 0 },
    superLikesReceived: { type: Number, default: 0 },
    matchCount: { type: Number, default: 0 },
    reportCount: { type: Number, default: 0 }
  },

  // Seen profiles (liked or passed) — used to avoid re-showing them in browse
  seenProfiles: [{ type: String }],

  // Profile boosts purchased via Telegram Payments
  boosts: { type: Number, default: 0 },

  // Dev / Test flags
  isTestAccount: { type: Boolean, default: false }, // Hidden from normal users; visible only in devMode
  isDevMode: { type: Boolean, default: false },      // Can see test accounts during browse

  // Anti-spam
  lastLikeAt: { type: Date },

  // VIP Perks
  boostExpiresAt: Date,                               // profile boost expiry
  lastBoostAt: Date,                                  // last time boost was activated
  invisibleMode: { type: Boolean, default: false },   // browse without updating lastActive
  lastSkippedProfile: String,                         // for undo-skip feature
  dailySuperLikesVip: {                               // free daily super likes for VIP
    count: { type: Number, default: 0 },
    date: { type: String, default: '' }
  },

  // System Fields
  createdAt: { type: Date, default: Date.now },
  lastActive: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
  deactivatedAt: Date,
  reactivatedAt: Date
});
const User = mongoose.model('User', userSchema);

// Report Schema
const reportSchema = new mongoose.Schema({
  reporterId: { type: String, required: true },
  reportedId: { type: String, required: true },
  reason: { type: String, required: true },
  screenshotFileId: { type: String },
  status: { type: String, enum: ['pending', 'reviewed', 'resolved'], default: 'pending' },
  adminNote: { type: String },
  createdAt: { type: Date, default: Date.now },
  resolvedAt: { type: Date }
});
const Report = mongoose.model('Report', reportSchema);

// ChatRoom Schema - Private chat rooms for matched users
const chatRoomSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  participants: [{ type: String, required: true }], // [user1_telegramId, user2_telegramId]
  messages: [{
    from: { type: String, required: true },
    text: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    read: { type: Boolean, default: false },
    deleted: { type: Boolean, default: false }
  }],
  settings: {
    muted: { type: Map, of: Boolean, default: {} }, // { user1_id: false, user2_id: true }
    blocked: { type: Boolean, default: false }
  },
  lastActivity: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});
const ChatRoom = mongoose.model('ChatRoom', chatRoomSchema);

// Setup command handlers (must be after User model is defined)
const Match = undefined;
const Like = require('./models/Like');

const { setupOnboardingCommands } = require('./commands/onboarding');
const { setupReportCommands } = require('./commands/report');
const { setupVipPerksCommands } = require('./commands/vipPerks');
const { setupChatRoomCommands } = require('./commands/chatRoom');

setupAuthCommands(bot, userStates, User);
setupTermsCommands(bot, User);
setupProfileCommands(bot, userStates, User);
const onboardingHandlers = setupOnboardingCommands(bot, userStates, User);
global.startOnboarding = onboardingHandlers.startOnboarding;
const chatHandlers = setupChatCommands(bot, User, userStates);
global.startInBotChat = chatHandlers.startInBotChat;
const chatRoomHandlers = setupChatRoomCommands(bot, User, ChatRoom, userStates);
global.enterChatRoom = chatRoomHandlers.enterChatRoom;
global.exitChatRoom = chatRoomHandlers.exitChatRoom;
global.sendChatMessage = chatRoomHandlers.sendChatMessage;
setupBrowsingCommands(bot, User, Match, Like, userStates);
setupReportCommands(bot, userStates, User, Report, null);
setupHelpCommands(bot, User);
setupSettingsCommands(bot, userStates, User);
setupPremiumCommands(bot, User, userStates);
setupGiftCommands(bot, User, userStates);
setupSocialDebugCommands(bot, User, Match, Like, userStates);
setupSocialCommands(bot, User);
setupLikesCommands(bot, User, Like);
setupMatchesCommands(bot, User, Match);
setupVipPerksCommands(bot, User);
setupPaymentCommands(bot, User);
setupDebugMatchesCommand(bot, User);

// Register bot command menu with Telegram (visible in the "/" list)
bot.setMyCommands([
  { command: 'start', description: '🚀 Start or restart the bot' },
  { command: 'profile', description: '👤 View and edit your profile' },
  { command: 'browse', description: '🔍 Browse potential matches' },
  { command: 'matches', description: '💕 View your matches' },
  { command: 'likesyou', description: '👀 See who likes you (VIP)' },
  { command: 'store', description: '💎 VIP, Boosts & Coins' },
  { command: 'vip', description: '👑 Manage VIP membership' },
  { command: 'coins', description: '🪙 Check balance & buy coins' },
  { command: 'settings', description: '⚙️ Adjust your preferences' },
  { command: 'help', description: '❓ Get help and support' },
  { command: 'delete', description: '🗑️ Delete your account' }
]).then(() => {
  console.log('✅ Bot command menu registered with Telegram');
}).catch(err => {
  console.error('❌ Failed to register bot command menu:', err.message);
});

// Export bot, userStates, User model, and ChatRoom model so bot.js can import them
module.exports = { bot, userStates, User, ChatRoom };

// Load bot.js to register event handlers for webhook
require('./bot');

// Register User
app.post('/register', async (req, res) => {
  try {
    const { telegramId, name, location, username, age, bio } = req.body;

    if (!location) {
      return res.status(400).json({ error: 'Location is required for registration.' });
    }

    const user = new User({
      telegramId,
      name: name || '',
      location,
      username: username || '',
      age,
      bio
    });
    await user.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error('Registration Error:', err);
    res.status(400).json({ error: 'Registration failed' });
  }
});

// Get User Profile
app.get('/users/:telegramId', async (req, res) => {
  const { telegramId } = req.params;
  console.log(`Fetching profile for telegramId: ${telegramId}`);
  try {
    const user = await User.findOne({ telegramId });
    if (!user) {
      console.log(`User not found for telegramId: ${telegramId}`);
      return res.status(404).json({ error: 'User not found' });
    }
    console.log(`User found for telegramId: ${telegramId}`);
    res.json(user);
  } catch (err) {
    console.error(`Error fetching user profile for telegramId: ${telegramId}`, err);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// Browse Users
app.get('/browse/:telegramId', async (req, res) => {
  const { telegramId } = req.params;
  try {
    const currentUser = await User.findOne({ telegramId });
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    let query = User.find({ telegramId: { $ne: telegramId } });
    if (!currentUser.isVip) {
      query = query.limit(5);
    }

    const users = await query;
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profiles' });
  }
});

// Get user matches
app.get('/matches/:telegramId', async (req, res) => {
  const { telegramId } = req.params;
  try {
    const user = await User.findOne({ telegramId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get all matches with their details
    const matchedUsers = await Promise.all(
      user.matches.map(async (match) => {
        const matchedUser = await User.findOne({ telegramId: match.userId });
        if (!matchedUser) return null;

        return {
          userId: match.userId,
          matchedAt: match.matchedAt,
          lastMessage: match.lastMessage,
          unreadCount: match.unreadCount,
          username: matchedUser.username,
          name: matchedUser.name,
          age: matchedUser.age,
          location: matchedUser.location,
          bio: matchedUser.bio,
          isVip: matchedUser.isVip
        };
      })
    );

    // Filter out null values (in case some matched users were deleted)
    const validMatches = matchedUsers.filter(match => match !== null);

    // Sort by most recent match or message
    validMatches.sort((a, b) => {
      const aTime = a.lastMessage?.sentAt || a.matchedAt;
      const bTime = b.lastMessage?.sentAt || b.matchedAt;
      return bTime - aTime;
    });

    res.json(validMatches);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

// Create a new match
app.post('/matches/create', async (req, res) => {
  const { fromId, toId } = req.body;

  try {
    const [user1, user2] = await Promise.all([
      User.findOne({ telegramId: fromId }),
      User.findOne({ telegramId: toId })
    ]);

    if (!user1 || !user2) {
      return res.status(404).json({ error: 'One or both users not found' });
    }

    // Check if they're already matched
    const existingMatch1 = user1.matches.find(m => m.userId === toId);
    const existingMatch2 = user2.matches.find(m => m.userId === fromId);

    if (existingMatch1 || existingMatch2) {
      return res.status(400).json({ error: 'Users are already matched' });
    }

    // Create match for both users
    user1.matches.push({
      userId: toId,
      matchedAt: new Date()
    });

    user2.matches.push({
      userId: fromId,
      matchedAt: new Date()
    });

    await Promise.all([user1.save(), user2.save()]);

    res.json({
      message: 'Match created successfully',
      matchDetails: {
        matchedUser: {
          telegramId: user2.telegramId,
          name: user2.name,
          age: user2.age,
          location: user2.location,
          bio: user2.bio
        }
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create match' });
  }
});

// Unmatch users
app.post('/matches/unmatch', async (req, res) => {
  const { fromId, toId } = req.body;

  try {
    const [user1, user2] = await Promise.all([
      User.findOne({ telegramId: fromId }),
      User.findOne({ telegramId: toId })
    ]);

    if (!user1 || !user2) {
      return res.status(404).json({ error: 'One or both users not found' });
    }

    // Remove match from both users
    user1.matches = user1.matches.filter(m => m.userId !== toId);
    user2.matches = user2.matches.filter(m => m.userId !== fromId);

    await Promise.all([user1.save(), user2.save()]);

    res.json({ message: 'Unmatched successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unmatch users' });
  }
});

// Grant monthly coins to VIP users
app.post('/vip/grant-coins', async (req, res) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const usersToGrant = await User.find({
      isVip: true,
      'vipDetails.lastCoinGrantDate': { $lt: thirtyDaysAgo }
    });

    for (const user of usersToGrant) {
      user.coins += 1000;
      user.vipDetails.lastCoinGrantDate = new Date();
      await user.save();
    }

    res.json({ message: `Granted coins to ${usersToGrant.length} VIP users.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to grant coins' });
  }
});

// Remove a like
app.post('/likes/remove', async (req, res) => {
  const { fromId, toId } = req.body;

  try {
    const user = await User.findOne({ telegramId: toId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Remove the like
    user.likes = user.likes.filter(id => id !== fromId);
    await user.save();

    res.json({ message: 'Like removed successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove like' });
  }
});

// ── Trust & Safety: Submit a report ─────────────────────────────────────
app.post('/report', async (req, res) => {
  const { reporterId, reportedId, reason, screenshotFileId } = req.body;
  try {
    if (!reporterId || !reportedId || !reason) {
      return res.status(400).json({ error: 'reporterId, reportedId and reason are required' });
    }
    const report = await Report.create({ reporterId, reportedId, reason, screenshotFileId: screenshotFileId || null });
    await User.findOneAndUpdate({ telegramId: reportedId }, { $inc: { 'stats.reportCount': 1 } });
    res.status(201).json({ message: 'Report submitted', reportId: report._id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

// ── Admin: Resolve a report ──────────────────────────────────────────────
app.patch('/admin/reports/:id/resolve', async (req, res) => {
  try {
    const report = await Report.findByIdAndUpdate(
      req.params.id,
      { status: 'resolved', adminNote: req.body.adminNote || '', resolvedAt: new Date() },
      { new: true }
    );
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json({ message: 'Report resolved', report });
  } catch (err) {
    res.status(500).json({ error: 'Failed to resolve report' });
  }
});

// ── Stats: Record a like ─────────────────────────────────────────────────
app.post('/stats/like', async (req, res) => {
  const { fromId, toId } = req.body;
  try {
    await Promise.all([
      User.findOneAndUpdate({ telegramId: fromId }, { $inc: { 'stats.likesGiven': 1 } }),
      User.findOneAndUpdate({ telegramId: toId }, { $inc: { 'stats.likesReceived': 1 } })
    ]);
    res.json({ message: 'Stats updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update stats' });
  }
});

// ── Stats: Record a match ────────────────────────────────────────────────
app.post('/stats/match', async (req, res) => {
  const { user1Id, user2Id } = req.body;
  try {
    await Promise.all([
      User.findOneAndUpdate({ telegramId: user1Id }, { $inc: { 'stats.matchCount': 1 } }),
      User.findOneAndUpdate({ telegramId: user2Id }, { $inc: { 'stats.matchCount': 1 } })
    ]);
    res.json({ message: 'Match stats updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update match stats' });
  }
});

// ── Admin: Aggregate stats ───────────────────────────────────────────────
app.get('/admin/stats', async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers, vipUsers, maleUsers, femaleUsers, bannedUsers, pendingReports,
      activeToday, newToday,
      matchesTodayAgg, totalMatchesAgg,
      swipesAgg, zeroMatchesCount, chatsStarted,
      retentionCount, statsAgg
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isVip: true }),
      User.countDocuments({ gender: 'Male' }),
      User.countDocuments({ gender: 'Female' }),
      User.countDocuments({ isBanned: true }),
      Report.countDocuments({ status: 'pending' }),
      // Active today
      User.countDocuments({ lastActive: { $gte: todayStart } }),
      // New today
      User.countDocuments({ createdAt: { $gte: todayStart } }),
      // Matches today (each match stored on both users, divide by 2)
      User.aggregate([
        { $unwind: '$matches' },
        { $match: { 'matches.matchedAt': { $gte: todayStart } } },
        { $group: { _id: null, count: { $sum: 1 } } }
      ]),
      // Total matches
      User.aggregate([
        { $project: { matchCount: { $size: { $ifNull: ['$matches', []] } } } },
        { $group: { _id: null, total: { $sum: '$matchCount' }, avg: { $avg: '$matchCount' } } }
      ]),
      // Total swipes (likes given)
      User.aggregate([
        { $group: { _id: null, total: { $sum: { $ifNull: ['$stats.likesGiven', 0] } } } }
      ]),
      // Users with zero matches
      User.countDocuments({ $or: [{ matches: { $size: 0 } }, { matches: { $exists: false } }] }),
      // Chats started (matches where at least 1 message sent)
      User.aggregate([
        { $unwind: '$matches' },
        { $match: { 'matches.messageCount.user1': { $gt: 0 } } },
        { $group: { _id: null, count: { $sum: 1 } } }
      ]),
      // Retained users (active in last 7 days)
      User.countDocuments({ lastActive: { $gte: weekAgo } }),
      // Legacy stats
      User.aggregate([{
        $group: {
          _id: null,
          totalLikesGiven: { $sum: { $ifNull: ['$stats.likesGiven', 0] } },
          totalLikesReceived: { $sum: { $ifNull: ['$stats.likesReceived', 0] } }
        }
      }])
    ]);

    const agg = statsAgg[0] || {};
    const tmAgg = totalMatchesAgg[0] || { total: 0, avg: 0 };
    const totalMatches = Math.round((tmAgg.total || 0) / 2);
    const avgMatchesPerUser = tmAgg.avg ? parseFloat(tmAgg.avg.toFixed(2)) : 0;
    const matchesToday = Math.round((matchesTodayAgg[0]?.count || 0) / 2);
    const totalSwipes = swipesAgg[0]?.total || 0;
    const chatsCount = chatsStarted[0]?.count || 0;
    const totalRevenue = vipUsers * 9.99;
    const conversionRate = totalUsers > 0 ? ((vipUsers / totalUsers) * 100).toFixed(1) : '0.0';
    const retentionRate = totalUsers > 0 ? ((retentionCount / totalUsers) * 100).toFixed(1) : '0.0';
    const matchRate = totalUsers > 0 ? ((totalMatches / totalUsers) * 100).toFixed(1) : '0.0';
    const zeroMatchPct = totalUsers > 0 ? ((zeroMatchesCount / totalUsers) * 100).toFixed(1) : '0.0';
    const activeUsers = maleUsers + femaleUsers || totalUsers;
    const maleRatio = activeUsers > 0 ? ((maleUsers / activeUsers) * 100).toFixed(1) : '0.0';
    const femaleRatio = activeUsers > 0 ? ((femaleUsers / activeUsers) * 100).toFixed(1) : '0.0';

    // Funnel: Joined → Swiped → Matched → Chatted → Paid
    const swipedUsers = await User.countDocuments({ 'stats.likesGiven': { $gt: 0 } });
    const matchedUsers = await User.countDocuments({ 'matches.0': { $exists: true } });

    res.json({
      // Totals
      totalUsers, vipUsers, maleUsers, femaleUsers, bannedUsers,
      totalMatches, totalRevenue: totalRevenue.toFixed(2),
      totalLikesGiven: agg.totalLikesGiven || 0,
      totalLikesReceived: agg.totalLikesReceived || 0,
      pendingReports,
      // Daily
      activeToday, newToday, matchesToday, revenueToday: 0,
      // Rates
      matchRate, conversionRate, retentionRate, maleRatio, femaleRatio,
      // Quality
      avgMatchesPerUser, zeroMatchPct, totalSwipes, chatsStarted: chatsCount,
      // Funnel
      funnel: {
        joined: totalUsers,
        swiped: swipedUsers,
        matched: matchedUsers,
        chatted: chatsCount,
        paid: vipUsers
      }
    });
  } catch (err) {
    console.error('[Admin Stats] Error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ── Admin: Get all users (paginated) ─────────────────────────────────────
app.get('/admin/users', async (req, res) => {
  try {
    const { search, page = 1, limit = 25, filter } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
        { telegramId: search }
      ];
    }
    if (filter === 'vip') query.isVip = true;
    else if (filter === 'banned') query.isBanned = true;
    else if (filter === 'active') query = { ...query, isBanned: { $ne: true } };
    else if (filter === 'male') query.gender = 'Male';
    else if (filter === 'female') query.gender = 'Female';

    const [users, total] = await Promise.all([
      User.find(query)
        .select('telegramId username name gender age location isVip isBanned createdAt lastActive matches likes')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(query)
    ]);

    res.json({ users, total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ── Admin: Get single user detail ────────────────────────────────────────
app.get('/admin/users/:telegramId', async (req, res) => {
  try {
    const user = await User.findOne({ telegramId: req.params.telegramId })
      .select('-__v');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// ── Admin: Ban user ───────────────────────────────────────────────────────
app.post('/admin/users/:telegramId/ban', async (req, res) => {
  try {
    const { telegramId } = req.params;
    const { reason } = req.body;
    await User.findOneAndUpdate(
      { telegramId },
      { $set: { isBanned: true, bannedAt: new Date(), banReason: reason || 'Admin action' } }
    );
    if (bot) {
      bot.sendMessage(telegramId, '🚫 Your account has been suspended by an admin. Contact support if you believe this is a mistake.').catch(() => {});
    }
    res.json({ message: 'User banned successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

// ── Admin: Unban user ─────────────────────────────────────────────────────
app.post('/admin/users/:telegramId/unban', async (req, res) => {
  try {
    const { telegramId } = req.params;
    await User.findOneAndUpdate(
      { telegramId },
      { $set: { isBanned: false }, $unset: { bannedAt: 1, banReason: 1 } }
    );
    if (bot) {
      bot.sendMessage(telegramId, '✅ Your account has been reinstated. Welcome back!').catch(() => {});
    }
    res.json({ message: 'User unbanned successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unban user' });
  }
});

// ── Admin: Grant VIP ──────────────────────────────────────────────────────
app.post('/admin/users/:telegramId/grant-vip', async (req, res) => {
  try {
    const { telegramId } = req.params;
    const { days = 30 } = req.body;
    const vipExpiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    await User.findOneAndUpdate(
      { telegramId },
      { $set: { isVip: true, vipExpiresAt } }
    );
    if (bot) {
      bot.sendMessage(telegramId, `👑 *Congratulations!* You've been granted VIP for ${days} days by an admin! Enjoy your premium features! 🎉`, { parse_mode: 'Markdown' }).catch(() => {});
    }
    res.json({ message: `VIP granted for ${days} days` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to grant VIP' });
  }
});

// ── Admin: Revoke VIP ─────────────────────────────────────────────────────
app.post('/admin/users/:telegramId/revoke-vip', async (req, res) => {
  try {
    const { telegramId } = req.params;
    await User.findOneAndUpdate(
      { telegramId },
      { $set: { isVip: false }, $unset: { vipExpiresAt: 1 } }
    );
    res.json({ message: 'VIP revoked' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to revoke VIP' });
  }
});

// ── Admin: Delete user ────────────────────────────────────────────────────
app.delete('/admin/users/:telegramId', async (req, res) => {
  try {
    const { telegramId } = req.params;
    await User.findOneAndDelete({ telegramId });
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ── Admin: Broadcast count preview ───────────────────────────────────────
app.get('/admin/broadcast/count', async (req, res) => {
  try {
    const { targetGroup = 'all' } = req.query;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    let query = { isBanned: { $ne: true } };
    if (targetGroup === 'vip') query.isVip = true;
    else if (targetGroup === 'free') query.isVip = { $ne: true };
    else if (targetGroup === 'inactive') query.lastActive = { $lt: sevenDaysAgo };
    else if (targetGroup === 'no_match') query.$or = [{ matches: { $size: 0 } }, { matches: { $exists: false } }];
    else if (targetGroup === 'male') query.gender = 'Male';
    else if (targetGroup === 'female') query.gender = 'Female';
    else if (targetGroup === 'new') query.createdAt = { $gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) };
    const count = await User.countDocuments(query);
    res.json({ count, targetGroup });
  } catch (err) {
    res.status(500).json({ error: 'Failed to count' });
  }
});

// ── Admin: Broadcast message ──────────────────────────────────────────────
app.post('/admin/broadcast', async (req, res) => {
  try {
    const { message, targetGroup = 'all' } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });
    if (!bot) return res.status(500).json({ error: 'Bot not available' });

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    let query = { isBanned: { $ne: true } };
    if (targetGroup === 'vip') query.isVip = true;
    else if (targetGroup === 'free') query.isVip = { $ne: true };
    else if (targetGroup === 'inactive') query.lastActive = { $lt: sevenDaysAgo };
    else if (targetGroup === 'no_match') query.$or = [{ matches: { $size: 0 } }, { matches: { $exists: false } }];
    else if (targetGroup === 'male') query.gender = 'Male';
    else if (targetGroup === 'female') query.gender = 'Female';
    else if (targetGroup === 'new') query.createdAt = { $gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) };

    const users = await User.find(query).select('telegramId');
    let sent = 0, failed = 0;

    for (const user of users) {
      try {
        await bot.sendMessage(user.telegramId, `📢 *Announcement*\n\n${message}`, { parse_mode: 'Markdown' });
        sent++;
        await new Promise(r => setTimeout(r, 50));
      } catch (e) { failed++; }
    }

    res.json({ message: `Broadcast complete`, sent, failed, total: users.length });
  } catch (err) {
    res.status(500).json({ error: 'Broadcast failed' });
  }
});

// ── Admin: Get all reports ────────────────────────────────────────────────
app.get('/admin/reports', async (req, res) => {
  try {
    const reports = await Report.find()
      .sort({ createdAt: -1 })
      .limit(100);
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// ── Admin: Resolve report ─────────────────────────────────────────────────
app.post('/admin/reports/:id/resolve', async (req, res) => {
  try {
    await Report.findByIdAndUpdate(req.params.id, { status: 'resolved', resolvedAt: new Date() });
    res.json({ message: 'Report resolved' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to resolve report' });
  }
});

// ── Admin: Dismiss report ─────────────────────────────────────────────────
app.post('/admin/reports/:id/dismiss', async (req, res) => {
  try {
    await Report.findByIdAndUpdate(req.params.id, { status: 'dismissed', resolvedAt: new Date() });
    res.json({ message: 'Report dismissed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to dismiss report' });
  }
});

// ── Admin: Get recent activity ────────────────────────────────────────────
app.get('/admin/activity', async (req, res) => {
  try {
    const activities = [];
    
    // Get recent users (last 24 hours)
    const recentUsers = await User.find({
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    }).sort({ createdAt: -1 }).limit(5);
    
    recentUsers.forEach(user => {
      activities.push({
        type: 'user_registered',
        icon: '👤',
        text: `New user registered: ${user.name}`,
        time: getTimeAgo(user.createdAt),
        timestamp: user.createdAt
      });
    });
    
    // Get recent VIP subscriptions
    const recentVips = await User.find({
      isVip: true,
      vipExpiresAt: { $gte: new Date() }
    }).sort({ vipExpiresAt: -1 }).limit(3);
    
    recentVips.forEach(user => {
      activities.push({
        type: 'vip_subscription',
        icon: '👑',
        text: `VIP subscription purchased by ${user.name}`,
        time: 'Recently',
        timestamp: user.vipExpiresAt
      });
    });
    
    // Get recent reports
    const recentReports = await Report.find()
      .sort({ createdAt: -1 })
      .limit(2);
    
    recentReports.forEach(report => {
      activities.push({
        type: 'report',
        icon: '🚨',
        text: `New ${report.type} report submitted`,
        time: getTimeAgo(report.createdAt),
        timestamp: report.createdAt
      });
    });
    
    // Sort all activities by timestamp
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json(activities.slice(0, 10));
  } catch (err) {
    console.error('Activity fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

// ── Admin: Get revenue data ───────────────────────────────────────────────
app.get('/admin/revenue', async (req, res) => {
  try {
    const vipUsers = await User.countDocuments({ 
      isVip: true,
      vipExpiresAt: { $gte: new Date() }
    });
    
    const totalUsers = await User.countDocuments();
    
    // Calculate revenue (mock calculation - replace with real payment tracking)
    const monthlyRevenue = vipUsers * 9.99;
    const avgRevenuePerUser = totalUsers > 0 ? (monthlyRevenue / totalUsers).toFixed(2) : 0;
    
    // Generate last 6 months revenue data
    const revenueData = [];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    for (let i = 0; i < 6; i++) {
      revenueData.push({
        month: months[i],
        revenue: Math.floor(Math.random() * 2000) + 1000 // Mock data
      });
    }
    
    res.json({
      monthlyRevenue: monthlyRevenue.toFixed(2),
      avgRevenuePerUser,
      totalRevenue: (monthlyRevenue * 6).toFixed(2),
      revenueData
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch revenue data' });
  }
});

// ── Admin: Get match statistics (paginated) ───────────────────────────────
app.get('/admin/matches', async (req, res) => {
  try {
    const { page = 1, limit = 25, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Count total matches
    const usersWithMatches = await User.aggregate([
      { $unwind: '$matches' },
      { $group: { _id: null, totalMatches: { $sum: 1 } } }
    ]);
    const totalMatches = usersWithMatches[0]?.totalMatches || 0;

    // Count matches today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const matchesToday = await User.aggregate([
      { $unwind: '$matches' },
      { $match: { 'matches.matchedAt': { $gte: today } } },
      { $group: { _id: null, count: { $sum: 1 } } }
    ]);
    const todayCount = matchesToday[0]?.count || 0;

    // Match rate
    const totalUsers = await User.countDocuments();
    const usersWithMatch = await User.countDocuments({ 'matches.0': { $exists: true } });
    const matchRate = totalUsers > 0 ? ((usersWithMatch / totalUsers) * 100).toFixed(1) : 0;

    // Build all unique pairs with pagination
    const allMatchUsers = await User.find(
      { 'matches.0': { $exists: true } },
      { telegramId: 1, name: 1, username: 1, gender: 1, age: 1, location: 1, isVip: 1, matches: 1 }
    ).sort({ updatedAt: -1 });

    const seen = new Set();
    const allPairs = [];
    for (const user of allMatchUsers) {
      for (const match of (user.matches || [])) {
        const key = [String(user.telegramId), String(match.userId)].sort().join('_');
        if (!seen.has(key)) {
          seen.add(key);
          allPairs.push({
            user1: { telegramId: user.telegramId, name: user.name, username: user.username, gender: user.gender, age: user.age, location: user.location, isVip: user.isVip },
            user2Id: match.userId,
            matchedAt: match.matchedAt || null
          });
        }
      }
    }

    // Search filter
    let filtered = allPairs;
    if (search) {
      const q = search.toLowerCase();
      filtered = allPairs.filter(p =>
        (p.user1.name || '').toLowerCase().includes(q) ||
        (p.user1.username || '').toLowerCase().includes(q) ||
        String(p.user1.telegramId).includes(q) ||
        String(p.user2Id).includes(q)
      );
    }

    const totalPairs = filtered.length;
    const pagePairs = filtered.slice(skip, skip + parseInt(limit));

    // Enrich user2 details for this page only
    const user2Ids = pagePairs.map(p => String(p.user2Id));
    const user2Map = {};
    const user2Docs = await User.find({ telegramId: { $in: user2Ids } }, { telegramId: 1, name: 1, username: 1, gender: 1, age: 1, location: 1, isVip: 1 });
    user2Docs.forEach(u => { user2Map[String(u.telegramId)] = u; });

    const enrichedPairs = pagePairs.map(p => ({
      user1: p.user1,
      user2: user2Map[String(p.user2Id)] || { telegramId: p.user2Id, name: 'Unknown' },
      matchedAt: p.matchedAt
    }));

    res.json({
      totalMatches: Math.floor(totalMatches / 2),
      todayMatches: Math.floor(todayCount / 2),
      matchRate,
      recentPairs: enrichedPairs,
      total: totalPairs,
      page: parseInt(page),
      pages: Math.ceil(totalPairs / parseInt(limit)),
      limit: parseInt(limit)
    });
  } catch (err) {
    console.error('Match stats error:', err);
    res.status(500).json({ error: 'Failed to fetch match statistics' });
  }
});

// ── Admin: Manually create a match between two users ──────────────────────
app.post('/admin/match', async (req, res) => {
  try {
    const { user1Id, user2Id } = req.body;
    if (!user1Id || !user2Id) return res.status(400).json({ error: 'Both user IDs required' });
    if (String(user1Id) === String(user2Id)) return res.status(400).json({ error: 'Cannot match a user with themselves' });

    const [user1, user2] = await Promise.all([
      User.findOne({ telegramId: String(user1Id) }),
      User.findOne({ telegramId: String(user2Id) })
    ]);
    if (!user1) return res.status(404).json({ error: `User not found: ${user1Id}` });
    if (!user2) return res.status(404).json({ error: `User not found: ${user2Id}` });

    const alreadyMatched = user1.matches?.some(m => String(m.userId) === String(user2Id));
    if (alreadyMatched) return res.status(409).json({ error: 'Users are already matched' });

    const now = new Date();
    await Promise.all([
      User.findOneAndUpdate(
        { telegramId: String(user1Id) },
        { $push: { matches: { userId: String(user2Id), matchedAt: now } } }
      ),
      User.findOneAndUpdate(
        { telegramId: String(user2Id) },
        { $push: { matches: { userId: String(user1Id), matchedAt: now } } }
      )
    ]);

    res.json({ success: true, message: `Matched ${user1.name} ↔ ${user2.name}` });
  } catch (err) {
    console.error('Admin match error:', err);
    res.status(500).json({ error: 'Failed to create match' });
  }
});

// ── Admin: Get user growth data ───────────────────────────────────────────
app.get('/admin/user-growth', async (req, res) => {
  try {
    const growthData = [];
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const count = await User.countDocuments({
        createdAt: { $gte: date, $lt: nextDate }
      });
      
      growthData.push({
        day: days[6 - i],
        users: count
      });
    }
    
    res.json(growthData);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user growth data' });
  }
});

// Helper function for time ago
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}


// Get users who liked you
app.get('/likes/:telegramId', async (req, res) => {
  const { telegramId } = req.params;
  try {
    const user = await User.findOne({ telegramId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Likes are stored as array of telegramIds on user.likes
    const likerIds = user.likes || [];

    // Get user details for each liker
    const likers = await User.find({
      telegramId: { $in: likerIds }
    }).select('telegramId name age location bio gender isVip photos createdAt lastActive');

    // Build response with liker details
    const likersWithDetails = likers.map(liker => ({
      ...liker.toObject(),
      likedAt: liker.createdAt,
      superLike: false,
      isOnline: liker.lastActive && (Date.now() - new Date(liker.lastActive).getTime()) < 300000
    }));

    // Also check superLikes from Like model as supplement
    const superLikeRecords = await Like.find({ toUserId: telegramId, superLike: true }).lean();
    const superLikerIds = superLikeRecords.map(l => l.fromUserId);

    // Mark super likers
    likersWithDetails.forEach(liker => {
      if (superLikerIds.includes(liker.telegramId)) {
        liker.superLike = true;
      }
    });

    const superLikeCount = likersWithDetails.filter(l => l.superLike).length;

    res.json({
      likes: likersWithDetails,
      totalLikes: likersWithDetails.length,
      superLikes: superLikeCount,
      visibleLikes: likersWithDetails.length,
      hasHiddenLikes: false,
      isVip: user.isVip,
      previewCount: 0
    });
  } catch (err) {
    console.error('Error fetching likes:', err);
    res.status(500).json({ error: 'Failed to fetch likes' });
  }
});

// Like a user
app.post('/like', async (req, res) => {
  const { fromUserId, toUserId } = req.body;

  try {
    // Find the target user
    const targetUser = await User.findOne({ telegramId: toUserId });
    if (!targetUser) {
      return res.status(404).json({ error: 'Target user not found' });
    }

    // Find the user who is liking
    const fromUser = await User.findOne({ telegramId: fromUserId });
    if (!fromUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if already liked
    if (targetUser.likes.includes(fromUserId)) {
      return res.status(400).json({ error: 'User already liked' });
    }

    // Check daily like limit for non-VIP users (50 likes per day)
    if (!fromUser.isVip) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Count likes sent today
      const likesToday = await User.countDocuments({
        likes: fromUserId,
        'likes.0': { $exists: true }
      });

      if (likesToday >= 50) {
        return res.status(400).json({ error: 'Daily like limit reached. Upgrade to VIP for unlimited likes!' });
      }
    }

    // Add like
    targetUser.likes.push(fromUserId);
    await targetUser.save();

    // Check if it's a match (both users liked each other)
    const isMatch = fromUser.likes.includes(toUserId);

    if (isMatch) {
      // Create match for both users
      const matchData = {
        userId: toUserId,
        matchedAt: new Date()
      };
      const reverseMatchData = {
        userId: fromUserId,
        matchedAt: new Date()
      };

      // Add match to both users if not already exists
      if (!fromUser.matches.some(match => match.userId === toUserId)) {
        fromUser.matches.push(matchData);
        await fromUser.save();
      }
      if (!targetUser.matches.some(match => match.userId === fromUserId)) {
        targetUser.matches.push(reverseMatchData);
        await targetUser.save();
      }

      res.json({ message: 'Like sent successfully', isMatch: true });
    } else {
      res.json({ message: 'Like sent successfully', isMatch: false });
    }
  } catch (err) {
    console.error('Like error:', err);
    res.status(500).json({ error: 'Failed to send like' });
  }
});

// Pass a user
app.post('/pass', async (req, res) => {
  const { fromUserId, toUserId } = req.body;

  try {
    // Find the user who is passing
    const fromUser = await User.findOne({ telegramId: fromUserId });
    if (!fromUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // For now, we just acknowledge the pass
    // In a more complex system, you might want to store passes to avoid showing the same user again
    res.json({ message: 'Pass recorded successfully' });
  } catch (err) {
    console.error('Pass error:', err);
    res.status(500).json({ error: 'Failed to record pass' });
  }
});

// Super like a user
app.post('/superlike', async (req, res) => {
  const { fromUserId, toUserId } = req.body;

  try {
    // Find the target user
    const targetUser = await User.findOne({ telegramId: toUserId });
    if (!targetUser) {
      return res.status(404).json({ error: 'Target user not found' });
    }

    // Find the user who is super liking
    const fromUser = await User.findOne({ telegramId: fromUserId });
    if (!fromUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if already liked
    if (targetUser.likes.includes(fromUserId)) {
      return res.status(400).json({ error: 'User already liked' });
    }

    // Check if user has enough coins (10 coins for super like)
    if (!fromUser.isVip && fromUser.coins < 10) {
      return res.status(400).json({ error: 'Insufficient coins' });
    }

    // Deduct coins if not VIP
    if (!fromUser.isVip) {
      fromUser.coins -= 10;
      await fromUser.save();
    }

    // Add super like (same as regular like but with priority)
    targetUser.likes.push(fromUserId);
    await targetUser.save();

    // Check if it's a match
    const isMatch = fromUser.likes.includes(toUserId);

    if (isMatch) {
      // Create match for both users
      const matchData = {
        userId: toUserId,
        matchedAt: new Date()
      };
      const reverseMatchData = {
        userId: fromUserId,
        matchedAt: new Date()
      };

      // Add match to both users if not already exists
      if (!fromUser.matches.some(match => match.userId === toUserId)) {
        fromUser.matches.push(matchData);
        await fromUser.save();
      }
      if (!targetUser.matches.some(match => match.userId === fromUserId)) {
        targetUser.matches.push(reverseMatchData);
        await targetUser.save();
      }

      res.json({ message: 'Super like sent successfully', isMatch: true });
    } else {
      res.json({ message: 'Super like sent successfully', isMatch: false });
    }
  } catch (err) {
    console.error('Super like error:', err);
    res.status(500).json({ error: 'Failed to send super like' });
  }
});



// Get user coins and available packages
app.get('/coins/:telegramId', async (req, res) => {
  const { telegramId } = req.params;
  try {
    const user = await User.findOne({ telegramId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const coinPackages = {
      starter: {
        coins: 1000,
        price: 4.99,
        bonus: 0,
        name: 'Starter Pack'
      },
      popular: {
        coins: 5000,
        price: 19.99,
        bonus: 500,
        name: 'Popular Pack'
      },
      premium: {
        coins: 12000,
        price: 39.99,
        bonus: 2000,
        name: 'Premium Pack'
      },
      ultimate: {
        coins: 30000,
        price: 79.99,
        bonus: 8000,
        name: 'Ultimate Pack'
      }
    };

    res.json({
      coins: user.coins,
      packages: coinPackages
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch coins' });
  }
});

// Purchase coins
app.post('/coins/purchase/:telegramId', async (req, res) => {
  const { telegramId } = req.params;
  const { packageId } = req.body;

  const coinPackages = {
    starter: { coins: 1000, bonus: 0 },
    popular: { coins: 5000, bonus: 500 },
    premium: { coins: 12000, bonus: 2000 },
    ultimate: { coins: 30000, bonus: 8000 }
  };

  if (!coinPackages[packageId]) {
    return res.status(400).json({ error: 'Invalid package' });
  }

  try {
    const user = await User.findOne({ telegramId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const package = coinPackages[packageId];
    const totalCoins = package.coins + package.bonus;
    user.coins += totalCoins;
    await user.save();

    res.json({
      message: 'Coins purchased successfully',
      coinsAdded: totalCoins,
      newBalance: user.coins
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to purchase coins' });
  }
});

// Get VIP status and details
app.get('/vip/:telegramId', async (req, res) => {
  const { telegramId } = req.params;
  try {
    const user = await User.findOne({ telegramId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if VIP has expired
    if (user.vipDetails?.expiresAt && user.vipDetails.expiresAt < new Date()) {
      user.isVip = false;
      user.vipDetails = undefined;
      await user.save();
    }

    const vipPlans = {
      weekly: {
        price: 300, // in coins
        duration: 7, // days
        benefits: {
          extraSwipes: 50,
          hideAds: true,
          priorityMatch: true,
          seeViewers: true,
          specialBadge: true
        }
      },
      monthly: {
        price: 1000, // in coins
        duration: 30, // days
        benefits: {
          extraSwipes: 100,
          hideAds: true,
          priorityMatch: true,
          seeViewers: true,
          specialBadge: true
        }
      },
      yearly: {
        price: 10000,
        duration: 365,
        benefits: {
          extraSwipes: 1000,
          hideAds: true,
          priorityMatch: true,
          seeViewers: true,
          specialBadge: true
        }
      },
      lifetime: {
        price: 25000,
        duration: 3650, // 10 years
        benefits: {
          extraSwipes: 999999,
          hideAds: true,
          priorityMatch: true,
          seeViewers: true,
          specialBadge: true
        }
      }
    };

    res.json({
      isVip: user.isVip,
      vipDetails: user.vipDetails,
      availablePlans: vipPlans
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch VIP status' });
  }
});

// Purchase VIP subscription
app.post('/vip/purchase/:telegramId', async (req, res) => {
  const { telegramId } = req.params;
  const { planType } = req.body;

  const plans = {
    weekly: { price: 300, days: 7 },
    monthly: { price: 1000, days: 30 },
    quarterly: { price: 2500, days: 90 }, // 3 months
    biannual: { price: 4500, days: 180 }, // 6 months
    yearly: { price: 10000, days: 365 },
    lifetime: { price: 25000, days: 3650 }
  };

  if (!plans[planType]) {
    return res.status(400).json({ error: 'Invalid plan type' });
  }

  try {
    const user = await User.findOne({ telegramId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user has enough coins
    if (user.coins < plans[planType].price) {
      return res.status(400).json({
        error: 'Insufficient coins',
        required: plans[planType].price,
        current: user.coins
      });
    }

    // Deduct coins and activate VIP
    user.coins -= plans[planType].price;
    user.isVip = true;

    // Set expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + plans[planType].days);

    // Set VIP details
    user.vipDetails = {
      expiresAt,
      subscriptionType: planType,
      benefits: {
        extraSwipes: planType === 'lifetime' ? 999999 : (planType === 'yearly' ? 1000 : 100),
        hideAds: true,
        priorityMatch: true,
        seeViewers: true,
        specialBadge: true
      }
    };

    await user.save();
    res.json({
      message: 'VIP subscription activated successfully',
      vipDetails: user.vipDetails,
      remainingCoins: user.coins
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to purchase VIP subscription' });
  }
});

// Cancel VIP subscription
app.post('/vip/cancel/:telegramId', async (req, res) => {
  const { telegramId } = req.params;
  try {
    const user = await User.findOne({ telegramId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.isVip) {
      return res.status(400).json({ error: 'No active VIP subscription' });
    }

    user.isVip = false;
    user.vipDetails = undefined;
    await user.save();

    res.json({ message: 'VIP subscription cancelled successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel VIP subscription' });
  }
});

// Get priority status and plans
app.get('/priority/:telegramId', async (req, res) => {
  const { telegramId } = req.params;
  try {
    const user = await User.findOne({ telegramId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const priorityPlans = {
      daily: {
        duration: 1,
        price: 200,
        name: 'Daily Boost',
        description: 'Get priority for 24 hours'
      },
      weekly: {
        duration: 7,
        price: 1000,
        name: 'Weekly Boost',
        description: 'Get priority for 7 days'
      },
      monthly: {
        duration: 30,
        price: 3000,
        name: 'Monthly Boost',
        description: 'Get priority for 30 days'
      }
    };

    // Check if priority has expired
    if (user.priorityExpiresAt && user.priorityExpiresAt < new Date()) {
      user.hasPriority = false;
      user.priorityExpiresAt = null;
      await user.save();
    }

    res.json({
      hasPriority: user.hasPriority,
      expiresAt: user.priorityExpiresAt,
      availablePlans: priorityPlans
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch priority status' });
  }
});

// Purchase priority boost
app.post('/priority/purchase/:telegramId', async (req, res) => {
  const { telegramId } = req.params;
  const { planType } = req.body;

  const plans = {
    daily: { duration: 1, price: 200 },
    weekly: { duration: 7, price: 1000 },
    monthly: { duration: 30, price: 3000 }
  };

  if (!plans[planType]) {
    return res.status(400).json({ error: 'Invalid plan type' });
  }

  try {
    const user = await User.findOne({ telegramId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user has enough coins
    if (user.coins < plans[planType].price) {
      return res.status(400).json({
        error: 'Insufficient coins',
        required: plans[planType].price,
        current: user.coins
      });
    }

    // Calculate new expiry date
    let expiresAt;
    if (user.priorityExpiresAt && user.priorityExpiresAt > new Date()) {
      // If already has priority, extend it
      expiresAt = new Date(user.priorityExpiresAt);
    } else {
      expiresAt = new Date();
    }
    expiresAt.setDate(expiresAt.getDate() + plans[planType].duration);

    // Update user
    user.coins -= plans[planType].price;
    user.hasPriority = true;
    user.priorityExpiresAt = expiresAt;
    await user.save();

    res.json({
      message: 'Priority boost activated successfully',
      expiresAt: user.priorityExpiresAt,
      remainingCoins: user.coins
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to purchase priority boost' });
  }
});

// Get available gifts
app.get('/gifts/available', (req, res) => {
  const gifts = {
    rose: {
      name: 'Rose',
      emoji: '🌹',
      price: 100,
      description: 'A beautiful rose to show your affection'
    },
    heart: {
      name: 'Heart',
      emoji: '❤️',
      price: 200,
      description: 'Express your love with a heart'
    },
    diamond: {
      name: 'Diamond',
      emoji: '💎',
      price: 500,
      description: 'A precious diamond for someone special'
    },
    crown: {
      name: 'Crown',
      emoji: '👑',
      price: 1000,
      description: 'Crown them as your king or queen'
    },
    ring: {
      name: 'Ring',
      emoji: '💍',
      price: 2000,
      description: 'The ultimate symbol of commitment'
    }
  };
  res.json({ gifts });
});

// Send a gift
app.post('/gifts/send', async (req, res) => {
  const { fromId, toId, giftType } = req.body;

  // Gift prices
  const giftPrices = {
    rose: 100,
    heart: 200,
    diamond: 500,
    crown: 1000,
    ring: 2000
  };

  if (!giftPrices[giftType]) {
    return res.status(400).json({ error: 'Invalid gift type' });
  }

  try {
    const [sender, receiver] = await Promise.all([
      User.findOne({ telegramId: fromId }),
      User.findOne({ telegramId: toId })
    ]);

    if (!sender || !receiver) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if sender has enough coins
    const giftPrice = giftPrices[giftType];
    if (sender.coins < giftPrice) {
      return res.status(400).json({
        error: 'Insufficient coins',
        required: giftPrice,
        current: sender.coins
      });
    }

    // Deduct coins and send gift
    sender.coins -= giftPrice;
    receiver.gifts.push({
      from: fromId,
      giftType,
      sentAt: new Date()
    });

    await Promise.all([sender.save(), receiver.save()]);

    res.json({
      message: 'Gift sent successfully',
      remainingCoins: sender.coins
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send gift' });
  }
});

// Get received gifts for a user
app.get('/gifts/:telegramId', async (req, res) => {
  const { telegramId } = req.params;

  try {
    const user = await User.findOne({ telegramId }).populate('gifts.from', 'name username isVip');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Format gifts with sender information
    const formattedGifts = user.gifts.map(gift => ({
      giftType: gift.giftType,
      sentAt: gift.sentAt,
      senderName: gift.from?.name || gift.from?.username || 'Anonymous',
      senderIsVip: gift.from?.isVip || false,
      value: getGiftPrice(gift.giftType)
    }));

    res.json({ gifts: formattedGifts });
  } catch (err) {
    console.error('Error fetching gifts:', err);
    res.status(500).json({ error: 'Failed to fetch gifts' });
  }
});

// Get received gifts for likesyou hub (with full sender details)
app.get('/gifts/received/:telegramId', async (req, res) => {
  const { telegramId } = req.params;

  try {
    const user = await User.findOne({ telegramId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get all senders
    const senderIds = [...new Set(user.gifts.map(g => g.from))];
    const senders = await User.find({ telegramId: { $in: senderIds } })
      .select('telegramId name username isVip');

    const senderMap = {};
    senders.forEach(s => {
      senderMap[s.telegramId] = s;
    });

    // Map gift types to emojis and names
    const giftInfo = {
      rose: { emoji: '🌹', name: 'Rose' },
      chocolate: { emoji: '🍫', name: 'Chocolate' },
      teddy: { emoji: '🧸', name: 'Teddy Bear' },
      perfume: { emoji: '💐', name: 'Perfume' },
      jewelry: { emoji: '💎', name: 'Jewelry' },
      watch: { emoji: '⌚', name: 'Watch' },
      car: { emoji: '🚗', name: 'Car' },
      yacht: { emoji: '🛥️', name: 'Yacht' },
      mansion: { emoji: '🏰', name: 'Mansion' },
      ring: { emoji: '💍', name: 'Diamond Ring' }
    };

    // Format gifts with full details
    const formattedGifts = user.gifts.map(gift => {
      const sender = senderMap[gift.from];
      const giftData = giftInfo[gift.giftType] || { emoji: '🎁', name: gift.giftType };
      
      return {
        senderId: gift.from,
        senderName: sender?.name || sender?.username || 'Anonymous',
        senderIsVip: sender?.isVip || false,
        giftType: gift.giftType,
        giftEmoji: giftData.emoji,
        giftName: giftData.name,
        message: gift.message || '',
        sentAt: gift.sentAt
      };
    });

    res.json({ gifts: formattedGifts });
  } catch (err) {
    console.error('Error fetching received gifts:', err);
    res.status(500).json({ error: 'Failed to fetch received gifts' });
  }
});

// Get sent gifts for a user
app.get('/gifts/sent/:telegramId', async (req, res) => {
  const { telegramId } = req.params;

  try {
    // Find all users who have received gifts from this user
    const recipients = await User.find({
      'gifts.from': telegramId
    });

    let sentGifts = [];
    recipients.forEach(recipient => {
      const giftsFromUser = recipient.gifts.filter(gift => gift.from.toString() === telegramId);
      giftsFromUser.forEach(gift => {
        sentGifts.push({
          giftType: gift.giftType,
          sentAt: gift.sentAt,
          recipientName: recipient.name || recipient.username || 'Anonymous',
          value: getGiftPrice(gift.giftType)
        });
      });
    });

    res.json({ gifts: sentGifts });
  } catch (err) {
    console.error('Error fetching sent gifts:', err);
    res.status(500).json({ error: 'Failed to fetch sent gifts' });
  }
});

// Helper function to get gift prices
function getGiftPrice(giftType) {
  const prices = {
    rose: 100,
    heart: 200,
    diamond: 500,
    crown: 1000,
    ring: 2000
  };
  return prices[giftType] || 0;
}

// Update user profile
app.post('/profile/update/:telegramId', async (req, res) => {
  const { telegramId } = req.params;
  const { field, value } = req.body;

  const allowedFields = ['name', 'age', 'location', 'bio'];
  if (!allowedFields.includes(field)) {
    return res.status(400).json({ error: 'Invalid field' });
  }

  try {
    const user = await User.findOne({ telegramId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user[field] = value;
    await user.save();
    res.json({ message: 'Profile updated successfully', user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Post a story


// Stories endpoints

// Get user's stories
app.get('/stories/user/:telegramId', async (req, res) => {
  const { telegramId } = req.params;

  try {
    const user = await User.findOne({ telegramId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Filter out expired stories (older than 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const activeStories = user.stories.filter(story =>
      new Date(story.createdAt) > twentyFourHoursAgo
    );

    // Update user's stories to remove expired ones
    user.stories = activeStories;
    await user.save();

    res.json({ stories: activeStories });
  } catch (err) {
    console.error('Error fetching user stories:', err);
    res.status(500).json({ error: 'Failed to fetch stories' });
  }
});

// Get recent stories from other users
app.get('/stories/recent/:telegramId', async (req, res) => {
  const { telegramId } = req.params;

  try {
    const currentUser = await User.findOne({ telegramId });
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get stories from other users (excluding current user)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const usersWithStories = await User.find({
      telegramId: { $ne: telegramId },
      'stories.0': { $exists: true }
    }).select('telegramId name isVip stories');

    const recentStories = [];

    for (const user of usersWithStories) {
      const activeStories = user.stories.filter(story =>
        new Date(story.createdAt) > twentyFourHoursAgo
      );

      if (activeStories.length > 0) {
        // Add user info to each story
        activeStories.forEach(story => {
          recentStories.push({
            ...story.toObject(),
            userId: user.telegramId,
            userName: user.name || 'Anonymous',
            isVip: user.isVip || false
          });
        });
      }
    }

    // Sort by creation date (newest first)
    recentStories.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ stories: recentStories.slice(0, 20) }); // Limit to 20 most recent
  } catch (err) {
    console.error('Error fetching recent stories:', err);
    res.status(500).json({ error: 'Failed to fetch recent stories' });
  }
});

// Send anonymous message to story
app.post('/stories/message', async (req, res) => {
  const { storyId, storyOwnerId, fromUserId, message, isAnonymous = true } = req.body;

  try {
    const storyOwner = await User.findOne({ telegramId: storyOwnerId });
    if (!storyOwner) {
      return res.status(404).json({ error: 'Story owner not found' });
    }

    // Add message to story owner's storyMessages
    storyOwner.storyMessages.push({
      storyId,
      storyOwnerId,
      fromUserId,
      message,
      isAnonymous,
      createdAt: new Date(),
      isRead: false,
      isRevealed: false
    });

    await storyOwner.save();
    res.json({ message: 'Story message sent successfully' });
  } catch (err) {
    console.error('Error sending story message:', err);
    res.status(500).json({ error: 'Failed to send story message' });
  }
});

// Get story messages for a user
app.get('/stories/messages/:telegramId', async (req, res) => {
  const { telegramId } = req.params;

  try {
    const user = await User.findOne({ telegramId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get sender details for non-anonymous messages
    const messagesWithSenders = await Promise.all(
      user.storyMessages.map(async (msg) => {
        if (!msg.isAnonymous || msg.isRevealed) {
          const sender = await User.findOne({ telegramId: msg.fromUserId }).select('name age location profilePhoto');
          return {
            ...msg.toObject(),
            senderInfo: sender ? {
              name: sender.name,
              age: sender.age,
              location: sender.location,
              profilePhoto: sender.profilePhoto
            } : null
          };
        }
        return msg.toObject();
      })
    );

    res.json({ messages: messagesWithSenders });
  } catch (err) {
    console.error('Error fetching story messages:', err);
    res.status(500).json({ error: 'Failed to fetch story messages' });
  }
});

// Reveal identity in story message
app.post('/stories/reveal/:messageId', async (req, res) => {
  const { messageId } = req.params;
  const { telegramId } = req.body;

  try {
    const user = await User.findOne({ telegramId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const message = user.storyMessages.id(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    message.isRevealed = true;
    await user.save();

    res.json({ message: 'Identity revealed successfully' });
  } catch (err) {
    console.error('Error revealing identity:', err);
    res.status(500).json({ error: 'Failed to reveal identity' });
  }
});

// Add reaction to story
app.post('/stories/react', async (req, res) => {
  const { storyId, storyOwnerId, fromUserId, reaction } = req.body;

  try {
    const storyOwner = await User.findOne({ telegramId: storyOwnerId });
    if (!storyOwner) {
      return res.status(404).json({ error: 'Story owner not found' });
    }

    const story = storyOwner.stories.id(storyId);
    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    // Remove existing reaction from this user
    story.reactions = story.reactions.filter(r => r.userId !== fromUserId);

    // Add new reaction
    story.reactions.push({
      userId: fromUserId,
      reaction,
      createdAt: new Date()
    });

    await storyOwner.save();
    res.json({ message: 'Reaction added successfully' });
  } catch (err) {
    console.error('Error adding reaction:', err);
    res.status(500).json({ error: 'Failed to add reaction' });
  }
});

// Mark story as viewed
app.post('/stories/view/:storyId', async (req, res) => {
  const { storyId } = req.params;
  const { viewerId } = req.body;

  try {
    const storyOwner = await User.findOne({ 'stories._id': storyId });
    if (!storyOwner) {
      return res.status(404).json({ error: 'Story not found' });
    }

    const story = storyOwner.stories.id(storyId);
    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    // Add viewer if not already viewed
    if (!story.views.includes(viewerId)) {
      story.views.push(viewerId);
      await storyOwner.save();
    }

    res.json({
      message: 'Story viewed successfully',
      story: {
        ...story.toObject(),
        userName: storyOwner.name,
        isVip: storyOwner.isVip,
        userId: storyOwner.telegramId
      },
      viewCount: story.views.length
    });
  } catch (err) {
    console.error('Error marking story as viewed:', err);
    res.status(500).json({ error: 'Failed to mark story as viewed' });
  }
});

// Post a new story
app.post('/stories/post/:telegramId', async (req, res) => {
  const { telegramId } = req.params;
  const { mediaUrl, mediaType, caption, duration } = req.body;

  try {
    const user = await User.findOne({ telegramId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create new story
    const newStory = {
      mediaUrl,
      type: mediaType || 'photo',
      caption: caption || '',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
      views: [],
      duration: duration || (mediaType === 'video' ? 15 : 5) // Default durations
    };

    // Add story to user's stories array
    user.stories.push(newStory);

    // Keep only last 10 stories per user
    if (user.stories.length > 10) {
      user.stories = user.stories.slice(-10);
    }

    await user.save();

    res.json({
      message: 'Story posted successfully',
      story: newStory
    });
  } catch (err) {
    console.error('Error posting story:', err);
    res.status(500).json({ error: 'Failed to post story' });
  }
});

// Get user stories
app.get('/stories/:telegramId', async (req, res) => {
  const { telegramId } = req.params;
  try {
    const user = await User.findOne({ telegramId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    // Filter out expired stories
    const activeStories = user.stories.filter(story =>
      story.expiresAt > new Date()
    );
    res.json(activeStories);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stories' });
  }
});





// Get story analytics for a user
app.get('/stories/analytics/:telegramId', async (req, res) => {
  const { telegramId } = req.params;

  try {
    const user = await User.findOne({ telegramId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const stories = user.stories || [];
    const totalStories = stories.length;
    const totalViews = stories.reduce((sum, story) => sum + (story.views ? story.views.length : 0), 0);
    const avgViews = totalStories > 0 ? Math.round(totalViews / totalStories) : 0;

    // Find best performing story
    const bestStory = stories.reduce((best, story) => {
      const views = story.views ? story.views.length : 0;
      const bestViews = best.views ? best.views.length : 0;
      return views > bestViews ? story : best;
    }, { views: [] });

    const bestStoryViews = bestStory.views ? bestStory.views.length : 0;

    // Calculate engagement rate (views per story / average profile views)
    const engagementRate = totalStories > 0 ? Math.round((avgViews / Math.max(user.profileViews || 1, 1)) * 100) : 0;

    // Count profile visits from story views (approximate)
    const profileVisits = Math.round(totalViews * 0.3); // Assume 30% of story views lead to profile visits

    res.json({
      totalStories,
      totalViews,
      avgViews,
      bestStoryViews,
      engagementRate,
      profileVisits
    });
  } catch (err) {
    console.error('Error fetching story analytics:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Delete a story
app.delete('/stories/:telegramId/:storyId', async (req, res) => {
  const { telegramId, storyId } = req.params;

  try {
    const user = await User.findOne({ telegramId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Remove the story
    user.stories = user.stories.filter(story => story._id.toString() !== storyId);
    await user.save();

    res.json({ message: 'Story deleted successfully' });
  } catch (err) {
    console.error('Error deleting story:', err);
    res.status(500).json({ error: 'Failed to delete story' });
  }
});

// Get user search settings
app.get('/search-settings/:telegramId', async (req, res) => {
  const { telegramId } = req.params;
  try {
    const user = await User.findOne({ telegramId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const searchSettings = user.searchSettings || {
      ageMin: 18,
      ageMax: 35,
      maxDistance: 50,
      genderPreference: 'any',
      locationPreference: null
    };

    res.json(searchSettings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch search settings' });
  }
});

// Update user search settings
app.post('/search-settings/:telegramId', async (req, res) => {
  const { telegramId } = req.params;
  const { ageMin, ageMax, maxDistance, genderPreference, locationPreference } = req.body;

  try {
    const user = await User.findOne({ telegramId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Initialize searchSettings if it doesn't exist
    if (!user.searchSettings) {
      user.searchSettings = {};
    }

    // Update only provided fields
    if (ageMin !== undefined) user.searchSettings.ageMin = ageMin;
    if (ageMax !== undefined) user.searchSettings.ageMax = ageMax;
    if (maxDistance !== undefined) user.searchSettings.maxDistance = maxDistance;
    if (genderPreference !== undefined) user.searchSettings.genderPreference = genderPreference;
    if (locationPreference !== undefined) user.searchSettings.locationPreference = locationPreference;

    await user.save();

    res.json({
      message: 'Search settings updated successfully',
      searchSettings: user.searchSettings
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update search settings' });
  }
});

// Reset user search settings to defaults
app.delete('/search-settings/:telegramId', async (req, res) => {
  const { telegramId } = req.params;
  try {
    const user = await User.findOne({ telegramId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Remove the searchSettings field entirely to let schema defaults apply
    user.searchSettings = undefined;
    await user.save();

    // Return the default values
    const defaultSettings = {
      ageMin: 18,
      ageMax: 35,
      maxDistance: 50,
      genderPreference: 'any',
      locationPreference: null
    };

    res.json({
      message: 'Search settings reset to defaults',
      searchSettings: defaultSettings
    });
  } catch (err) {
    console.error('Reset search settings error:', err);
    res.status(500).json({ error: 'Failed to reset search settings' });
  }
});

// Profile deactivation endpoint
app.post('/users/deactivate/:telegramId', async (req, res) => {
  const { telegramId } = req.params;
  try {
    const user = await User.findOne({ telegramId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.isActive = false;
    user.deactivatedAt = new Date();
    await user.save();

    res.json({
      message: 'Profile deactivated successfully',
      deactivatedAt: user.deactivatedAt
    });
  } catch (err) {
    console.error('Deactivation error:', err);
    res.status(500).json({ error: 'Failed to deactivate profile' });
  }
});

// Profile reactivation endpoint
app.post('/users/reactivate/:telegramId', async (req, res) => {
  const { telegramId } = req.params;
  try {
    const user = await User.findOne({ telegramId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.isActive = true;
    user.deactivatedAt = undefined;
    user.reactivatedAt = new Date();
    await user.save();

    res.json({
      message: 'Profile reactivated successfully',
      reactivatedAt: user.reactivatedAt
    });
  } catch (err) {
    console.error('Reactivation error:', err);
    res.status(500).json({ error: 'Failed to reactivate profile' });
  }
});

// Profile deletion endpoint (permanent)
app.delete('/users/delete/:telegramId', async (req, res) => {
  const { telegramId } = req.params;
  const { confirmationText } = req.body;

  // Require exact confirmation text
  if (confirmationText !== 'DELETE MY PROFILE') {
    return res.status(400).json({
      error: 'Invalid confirmation text. Please type exactly: DELETE MY PROFILE'
    });
  }

  try {
    const user = await User.findOne({ telegramId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Store deletion info for audit
    const deletionInfo = {
      telegramId: user.telegramId,
      username: user.username,
      deletedAt: new Date(),
      wasVip: user.isVip,
      coinsLost: user.coins
    };

    // Permanently delete user
    await User.deleteOne({ telegramId });

    res.json({
      message: 'Profile deleted permanently',
      deletionInfo
    });
  } catch (err) {
    console.error('Deletion error:', err);
    res.status(500).json({ error: 'Failed to delete profile' });
  }
});

// Upload profile photo endpoint
app.post('/upload-photo/:telegramId', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const imageUrl = req.file.path;
    const telegramId = req.params.telegramId;

    // Find user first to check photo count
    const user = await User.findOne({ telegramId });
    if (!user) {
      await cloudinary.uploader.destroy(req.file.filename).catch(() => { });
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user already has 6 photos
    const currentPhotos = user.photos || [];
    if (currentPhotos.length >= 6) {
      return res.status(400).json({ error: 'Maximum 6 photos allowed. Please delete a photo first.' });
    }

    // Add new photo to photos array
    const updatedUser = await User.findOneAndUpdate(
      { telegramId },
      {
        $push: { photos: imageUrl },
        profilePhoto: currentPhotos.length === 0 ? imageUrl : user.profilePhoto // Set first photo as profile photo
      },
      { new: true }
    );

    res.json({
      message: 'Photo uploaded successfully',
      imageUrl,
      photoCount: updatedUser.photos.length,
      user: {
        telegramId: updatedUser.telegramId,
        name: updatedUser.name,
        profilePhoto: updatedUser.profilePhoto
      }
    });
  } catch (err) {
    console.error('Photo upload error:', err);
    res.status(500).json({ error: 'Upload failed', details: err.message });
  }
});


// Catch-all for unhandled routes (should be after all API routes)
app.use((req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Removed duplicate app.listen (server is started in connectWithRetry())
