const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
require('dotenv').config();

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

// Handle MongoDB connection errors
mongoose.connection.on('error', err => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected. Attempting to reconnect...');
  connectWithRetry();
});

// Initial connection
connectWithRetry();

// User Schema
const userSchema = new mongoose.Schema({
  // Basic Info
  telegramId: { type: String, required: true, unique: true },
  username: String,
  name: String,
  age: Number,
  location: String,
  bio: String,
  
  // Currency
  coins: { type: Number, default: 0 },
  
  // VIP Status
  isVip: { type: Boolean, default: false },
  vipDetails: {
    expiresAt: Date,
    subscriptionType: { type: String, enum: ['monthly', 'yearly', 'lifetime'] },
    benefits: {
      extraSwipes: { type: Number, default: 0 },
      hideAds: { type: Boolean, default: false },
      priorityMatch: { type: Boolean, default: false },
      seeViewers: { type: Boolean, default: false },
      specialBadge: { type: Boolean, default: false }
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
    expiresAt: Date
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
  const { telegramId, name, age, location, bio } = req.body;
  try {
    const user = new User({ telegramId, name, age, location, bio });
    await user.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    res.status(400).json({ error: 'Registration failed' });
  }
});

// Browse Users
app.get('/browse/:telegramId', async (req, res) => {
  const { telegramId } = req.params;
  try {
    const users = await User.find({ telegramId: { $ne: telegramId } }).limit(5);
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

// Get user profile
app.get('/profile/:telegramId', async (req, res) => {
  const { telegramId } = req.params;
  
  try {
    // Try both string and number formats to handle data type mismatches
    const user = await User.findOne({ 
      $or: [
        { telegramId: telegramId },
        { telegramId: parseInt(telegramId) },
        { telegramId: telegramId.toString() }
      ]
    });
    
    if (!user) {
      console.log(`Profile not found for telegramId: ${telegramId}`);
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log(`Profile found for telegramId: ${telegramId}`);
    res.json(user);
  } catch (err) {
    console.error('Error fetching profile:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
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

    // Get users who liked this user
    const likers = await User.find({ 
      telegramId: { $in: user.likes }
    }).select('telegramId name age location bio isVip');

    // Check if user is VIP to determine how many likes to show
    const likesToShow = user.isVip ? likers.length : Math.min(3, likers.length);
    const hasHiddenLikes = likers.length > likesToShow;

    // Get preview of likes
    const visibleLikes = likers.slice(0, likesToShow);
    
    res.json({
      likes: visibleLikes,
      totalLikes: likers.length,
      visibleLikes: likesToShow,
      hasHiddenLikes,
      isVip: user.isVip
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch likes' });
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
    monthly: { price: 1000, days: 30 },
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
app.post('/stories/post', async (req, res) => {
  const { telegramId, mediaUrl, caption } = req.body;
  try {
    const user = await User.findOne({ telegramId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // Stories expire after 24 hours
    
    user.stories.push({
      mediaUrl,
      caption,
      createdAt: new Date(),
      expiresAt
    });
    
    await user.save();
    res.json({ message: 'Story posted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to post story' });
  }
});

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

// View a specific story (and record the view)
app.post('/stories/view/:storyId', async (req, res) => {
  const { storyId } = req.params;
  const { viewerId } = req.body;
  
  try {
    // Find user who owns the story
    const user = await User.findOne({ 'stories._id': storyId });
    if (!user) {
      return res.status(404).json({ error: 'Story not found' });
    }

    const story = user.stories.id(storyId);
    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    // Check if story is expired
    if (new Date() > story.expiresAt) {
      return res.status(410).json({ error: 'Story has expired' });
    }

    // Record the view if not already viewed by this user
    if (!story.views.includes(viewerId)) {
      story.views.push(viewerId);
      await user.save();
    }

    // Get viewer info
    const viewer = await User.findOne({ telegramId: viewerId });
    
    res.json({ 
      story: {
        ...story.toObject(),
        ownerName: user.name || 'Anonymous',
        ownerIsVip: user.isVip || false
      },
      viewCount: story.views.length
    });
  } catch (err) {
    console.error('Error viewing story:', err);
    res.status(500).json({ error: 'Failed to view story' });
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

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running on port', PORT));
