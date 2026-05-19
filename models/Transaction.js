const mongoose = require('mongoose');

const STARS_TO_USD = 0.013; // Telegram developer payout rate

const transactionSchema = new mongoose.Schema({
  telegramId:          { type: String, required: true, index: true },   // buyer
  recipientTelegramId: { type: String },                                  // gift VIP recipient
  buyerName:           { type: String },
  productKey:          { type: String, required: true },                  // e.g. 'vip_monthly'
  productTitle:        { type: String },                                  // human label
  type:                { type: String, enum: ['coins', 'vip', 'boost', 'gift_vip'], required: true },
  amountStars:         { type: Number, required: true },
  amountUSD:           { type: Number },                                  // amountStars * STARS_TO_USD
  coinsAdded:          { type: Number, default: 0 },
  vipDays:             { type: Number, default: 0 },
  boostsAdded:         { type: Number, default: 0 },
  telegramChargeId:    { type: String },                                  // from Telegram for refund tracking
  createdAt:           { type: Date, default: Date.now, index: true }
});

transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ telegramId: 1, createdAt: -1 });
transactionSchema.index({ type: 1, createdAt: -1 });

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = { Transaction, STARS_TO_USD };
