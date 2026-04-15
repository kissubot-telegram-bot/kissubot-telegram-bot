const mongoose = require('mongoose');

const likeSchema = new mongoose.Schema({
  fromUserId: { type: String, required: true },
  toUserId: { type: String, required: true },
  superLike: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

// Index for quick lookups
likeSchema.index({ toUserId: 1, createdAt: -1 });
likeSchema.index({ fromUserId: 1, toUserId: 1 }, { unique: true });

module.exports = mongoose.model('Like', likeSchema);
