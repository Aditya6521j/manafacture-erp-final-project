const mongoose = require('mongoose');
const { MONGO_URI, NODE_ENV } = require('./env');

mongoose.set('strictQuery', true);

async function connectDB(uri = MONGO_URI) {
  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15000,
      autoIndex: NODE_ENV !== 'production',
    });
    if (NODE_ENV !== 'test') {
      console.log(`[db] MongoDB connected → ${conn.connection.host}/${conn.connection.name}`);
    }
    mongoose.connection.on('disconnected', () => console.warn('[db] MongoDB disconnected'));
    mongoose.connection.on('error', (err) => console.error('[db] MongoDB error:', err.message));
    return conn;
  } catch (err) {
    console.error('[db] Connection failed:', err.message);
    throw err;
  }
}

module.exports = { connectDB, mongoose };
