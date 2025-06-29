const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// User Schema
const userSchema = new mongoose.Schema({
  telegramId: String,
  name: String,
  age: Number,
  location: String,
  bio: String
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

// Match Random User
app.get('/match/:telegramId', async (req, res) => {
  const { telegramId } = req.params;
  try {
    const users = await User.aggregate([
      { $match: { telegramId: { $ne: telegramId } } },
      { $sample: { size: 1 } }
    ]);
    res.json(users[0] || {});
  } catch (err) {
    res.status(500).json({ error: 'Match failed' });
  }
});

// Placeholder for Chat (future)
app.post('/chat', (req, res) => {
  res.send({ message: 'Chat feature coming soon!' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running on port', PORT));
