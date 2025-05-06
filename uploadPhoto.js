const express = require('express');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../utils/cloudinary');
const User = require('../models/UserProfile');

const router = express.Router();

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'kissubot_profiles',
    allowed_formats: ['jpg', 'png'],
  },
});

const upload = multer({ storage: storage });

router.post('/upload-photo/:telegramId', upload.single('image'), async (req, res) => {
  try {
    const imageUrl = req.file.path;
    const telegramId = req.params.telegramId;

    const user = await User.findOneAndUpdate(
      { telegramId },
      { profilePhoto: imageUrl },
      { new: true }
    );

    res.json({ message: 'Photo uploaded', imageUrl, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Upload failed' });
  }
});

module.exports = router;
