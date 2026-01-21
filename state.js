const mongoose = require('mongoose');

const stateSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  step: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed, default: {} }
});

const State = mongoose.model('State', stateSchema);

module.exports = State;