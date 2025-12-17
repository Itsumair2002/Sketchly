const mongoose = require('mongoose');

const isNonEmptyString = (value, maxLength = 5000) => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength;
};

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

module.exports = {
  isNonEmptyString,
  isValidObjectId
};
