const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.log(err));

// User Schema
const User = mongoose.model('User', {
  telegramId: String,
  name: String,
  age: Number,
  location: String,
  bio: String,
});

// Endpoint to register user
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

app.listen(process.env.PORT || 3000, () => {
  console.log('Server running...');
});
