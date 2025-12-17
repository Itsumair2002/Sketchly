const mongoose = require('mongoose');

const boardElementSchema = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  elementId: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed, required: true },
  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

boardElementSchema.index({ roomId: 1, createdAt: 1 });
boardElementSchema.index({ roomId: 1, elementId: 1 }, { unique: true });

boardElementSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

boardElementSchema.pre('findOneAndUpdate', function (next) {
  this.set({ updatedAt: new Date() });
  next();
});

module.exports = mongoose.model('BoardElement', boardElementSchema);
