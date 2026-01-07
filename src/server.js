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
  const host = process.env.HOST || '0.0.0.0';
  server.listen(port, host, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on ${host}:${port}`);
  });
};

start();
