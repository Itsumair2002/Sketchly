require('dotenv').config();
const http = require('http');
const connectDb = require('./config/db');
const app = require('./app');
const setupWsServer = require('./realtime/wsServer');

const start = async () => {
  await connectDb();

  const server = http.createServer(app);
  setupWsServer(server);

  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on port ${port}`);
  });
};

start();
