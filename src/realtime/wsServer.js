const { WebSocketServer } = require('ws');
const createWsRouter = require('./wsRouter');
const verifyWsAuth = require('./wsAuth');
const broadcast = require('../utils/broadcast');
const Message = require('../models/Message');
const BoardElement = require('../models/BoardElement');

const HEARTBEAT_INTERVAL = 30000;

const setupWsServer = (httpServer) => {
  const roomSockets = new Map();
  const socketRooms = new Map();

  const router = createWsRouter({ roomSockets, socketRooms, models: { Message, BoardElement } });
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  const cleanupSocket = (ws) => {
    const rooms = socketRooms.get(ws);
    if (!rooms) return;
    rooms.forEach((roomId) => {
      const roomSet = roomSockets.get(roomId);
      if (roomSet) {
        roomSet.delete(ws);
        if (roomSet.size === 0) {
          roomSockets.delete(roomId);
        } else {
          broadcast(roomSet, 'PRESENCE_LEAVE', { roomId, userId: ws.user?.userId });
        }
      }
    });
    socketRooms.delete(ws);
  };

  wss.on('connection', async (ws, req) => {
    const user = await verifyWsAuth(req);
    if (!user) {
      ws.close(4001, 'Unauthorized');
      return;
    }

    ws.user = user;
    ws.isAlive = true;

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (data) => {
      router(ws, data.toString());
    });

    ws.on('close', () => {
      cleanupSocket(ws);
    });

    ws.on('error', () => {
      cleanupSocket(ws);
    });
  });

  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        cleanupSocket(ws);
        ws.terminate();
        return;
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, HEARTBEAT_INTERVAL);

  wss.on('close', () => {
    clearInterval(interval);
  });

  return wss;
};

module.exports = setupWsServer;
