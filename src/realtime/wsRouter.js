const Room = require('../models/Room');
const RoomMember = require('../models/RoomMember');
const send = require('../utils/send');
const broadcast = require('../utils/broadcast');
const validate = require('../utils/validate');
const roomHandlers = require('./rooms.ws');
const chatHandlers = require('./chat.ws');
const boardHandlers = require('./board.ws');
const presenceHandlers = require('./presence.ws');

const handlers = {
  ...roomHandlers,
  ...chatHandlers,
  ...boardHandlers,
  ...presenceHandlers
};

const sendError = (ws, message, code = 'BAD_REQUEST', requestId) => {
  send(ws, 'ERROR', { code, message }, requestId);
};

const ensureMember = async (roomId, userId) => {
  if (!validate.isValidObjectId(roomId)) return { room: null, role: null, error: 'Invalid room' };
  const room = await Room.findById(roomId).lean();
  if (!room) return { room: null, role: null, error: 'Room not found' };
  if (room.ownerId.toString() === userId.toString()) {
    return { room, role: 'owner', error: null };
  }
  const membership = await RoomMember.findOne({ roomId, userId }).lean();
  if (!membership) return { room, role: null, error: 'Not a member' };
  return { room, role: membership.role || 'viewer', error: null };
};

const createWsRouter = (context) => {
  const ctx = { ...context, ensureMember, send, broadcast };

  return async (ws, rawData) => {
    let message;
    try {
      message = JSON.parse(rawData);
    } catch (err) {
      sendError(ws, 'Invalid JSON');
      return;
    }

    const { type, payload = {}, requestId } = message;
    if (!type || typeof type !== 'string') {
      sendError(ws, 'Missing type', 'MALFORMED', requestId);
      return;
    }

  const handler = handlers[type];
    if (!handler) {
      sendError(ws, 'Unknown event type', 'UNKNOWN_EVENT', requestId);
      return;
    }

    try {
      await handler(ws, payload, ctx, requestId);
    } catch (err) {
      sendError(ws, 'Server error', 'SERVER_ERROR', requestId);
    }
  };
};

module.exports = createWsRouter;
