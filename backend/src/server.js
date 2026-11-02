const app = require('./app');
const env = require('./config/env');
const { connectDB } = require('./config/db');

const startServer = async () => {
  await connectDB();

  const server = app.listen(env.PORT, () => {
    console.log(`🚀 SpendWise API Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
    console.log(`📚 API Documentation available at: http://localhost:${env.PORT}/api-docs`);
  });

  const handleShutdown = () => {
    console.log('\nReceived kill signal, shutting down gracefully...');
    server.close(() => {
      console.log('HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', handleShutdown);
  process.on('SIGINT', handleShutdown);
};

if (require.main === module) {
  startServer();
}

module.exports = startServer;
