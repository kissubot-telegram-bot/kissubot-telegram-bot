const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const app = express();
app.use(bodyParser.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
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

      const PORT = process.env.PORT || 3002;
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server is listening on port ${PORT}`);
      });

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
    folder: 'kisu1bot_profiles',
    allowed_formats: ['jpg', 'png', 'jpeg'],
  },
});

const upload = multer({ storage: storage });

// User Schema
const userSchema = new mongoose.Schema({
  // Basic Info
  telegramId: { type: String, required: true, unique: true },
  username: String,
  name: String,
  age: Number,
  location: { type: String, required: true },
  bio: String,
  profilePhoto: String, // Add profile photo field
  
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
    unreadCount: { type: Number, default: 0 }
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
    ageMax: { type: Number, default: 35 },
    maxDistance: { type: Number, default: 50 },
    genderPreference: { type: String, default: 'any' },
    locationPreference: { type: String, default: null }
  },

  // System Fields
  createdAt: { type: Date, default: Date.now },
  lastActive: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
  deactivatedAt: Date,
  reactivatedAt: Date
});
const User = mongoose.model('User', userSchema);

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

// Get users who liked you
app.get('/likes/:telegramId', async (req, res) => {
  const { telegramId } = req.params;
  try {
    const user = await User.findOne({ telegramId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get users who liked this user with more detailed info
    const likers = await User.find({ 
      telegramId: { $in: user.likes }
    }).select('telegramId name age location bio isVip profilePhoto createdAt lastActive');

    // Add like timestamp and sort by most recent
    const likersWithTimestamp = likers.map(liker => {
      const likeIndex = user.likes.indexOf(liker.telegramId);
      return {
        ...liker.toObject(),
        likedAt: new Date(Date.now() - (likeIndex * 60000)), // Approximate timestamp
        isOnline: liker.lastActive && (Date.now() - liker.lastActive.getTime()) < 300000 // 5 minutes
      };
    }).sort((a, b) => b.likedAt - a.likedAt);

    // Check if user is VIP to determine how many likes to show
    const likesToShow = user.isVip ? likersWithTimestamp.length : Math.min(3, likersWithTimestamp.length);
    const hasHiddenLikes = likersWithTimestamp.length > likesToShow;

    // Get preview of likes for non-VIP (blurred/limited info)
    const visibleLikes = user.isVip 
      ? likersWithTimestamp.slice(0, likesToShow)
      : likersWithTimestamp.slice(0, likesToShow).map(liker => ({
          ...liker,
          name: liker.name.charAt(0) + '*'.repeat(liker.name.length - 1),
          bio: 'Upgrade to VIP to see full profile',
          profilePhoto: null // Hide photo for non-VIP
        }));
    
    res.json({
      likes: visibleLikes,
      totalLikes: likersWithTimestamp.length,
      visibleLikes: likesToShow,
      hasHiddenLikes,
      isVip: user.isVip,
      previewCount: user.isVip ? 0 : Math.max(0, likersWithTimestamp.length - 3)
    });
  } catch (err) {
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



// Get user gifts
app.get('/gifts/:telegramId', async (req, res) => {
  const { telegramId } = req.params;
  try {
    const user = await User.findOne({ telegramId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user.gifts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch gifts' });
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

// Purchase coins
app.post('/coins/purchase/:telegramId', async (req, res) => {
  const { telegramId } = req.params;
  const { amount } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid coin amount' });
  }

  try {
    const user = await User.findOne({ telegramId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.coins += amount;
    await user.save();

    res.json({
      message: 'Coins purchased successfully',
      newBalance: user.coins
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to purchase coins' });
  }
});

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


// Placeholder for Chat (future)
app.post('/chat', (req, res) => {
  res.send({ message: 'Chat feature coming soon!' });
});

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

// Update user profile
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

    const user = await User.findOneAndUpdate(
      { telegramId },
      { profilePhoto: imageUrl },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ 
      message: 'Photo uploaded successfully', 
      imageUrl, 
      user: {
        telegramId: user.telegramId,
        name: user.name,
        profilePhoto: user.profilePhoto
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

// Start server
PORT = process.env.PORT || 3003;
app.listen(PORT, () => console.log('Server running on port', PORT));
