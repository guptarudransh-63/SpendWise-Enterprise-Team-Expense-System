const mongoose = require('mongoose');
const env = require('./env');

let isReplicaSet = false;

const connectDB = async (uri = env.MONGO_URI) => {
  try {
    console.log(`[SpendWise] Connecting to MongoDB at ${uri}...`);
    const conn = await mongoose.connect(uri, {
      autoIndex: true,
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[SpendWise] MongoDB Connected: ${conn.connection.host}:${conn.connection.port}/${conn.connection.name}`);

    // Check if connected instance supports transactions (replica set)
    try {
      const adminDb = conn.connection.db.admin();
      const status = await adminDb.command({ replSetGetStatus: 1 });
      if (status && status.ok === 1) {
        isReplicaSet = true;
        console.log('MongoDB is running in Replica Set mode. Full ACID Transactions are ENABLED.');
      }
    } catch (e) {
      // Not a replica set or no permissions
      isReplicaSet = false;
      console.log('MongoDB is running in Standalone mode. Multi-document transactions will execute sequentially without replica sessions.');
    }

    return conn;
  } catch (error) {
    console.error(`\n❌ [SpendWise] MongoDB Connection Error: ${error.message}`);
    console.error(`💡 Ensure MongoDB is running. On macOS with Homebrew, run:`);
    console.error(`   brew services start mongodb-community\n`);
    if (env.NODE_ENV !== 'test') {
      process.exit(1);
    }
    throw error;
  }
};

/**
 * Execute work inside an interactive MongoDB transaction when replica set is enabled,
 * or execute directly when standalone.
 * @param {Function} callback - async (session) => { ... }
 */
const withTransaction = async (callback) => {
  if (!isReplicaSet) {
    // Standalone fallback: execute without session
    return await callback(null);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const result = await callback(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const disconnectDB = async () => {
  await mongoose.disconnect();
};

module.exports = {
  connectDB,
  disconnectDB,
  withTransaction,
  getIsReplicaSet: () => isReplicaSet,
  setIsReplicaSet: (val) => { isReplicaSet = val; }
};
