const mongoose = require('mongoose');

mongoose.set('strictQuery', false);

const connectDb = async () => {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) {
      throw new Error('MONGO_URI not set');
    }
    await mongoose.connect(uri, {
      autoIndex: true
    });
    // eslint-disable-next-line no-console
    console.log('MongoDB connected');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Mongo connection error', err);
    process.exit(1);
  }
};

module.exports = connectDb;
