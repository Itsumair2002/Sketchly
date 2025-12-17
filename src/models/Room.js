const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  joinCode: { type: String, required: true, unique: true, trim: true },
  createdAt: { type: Date, default: Date.now }
});

roomSchema.index({ joinCode: 1 }, { unique: true });

module.exports = mongoose.model('Room', roomSchema);
