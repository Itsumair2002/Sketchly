const validate = require('../utils/validate');

const PRESENCE_UPDATE = async (ws, payload, ctx, requestId) => {
  const { roomId, cursor } = payload || {};
  if (!roomId || !validate.isValidObjectId(roomId)) {
    ctx.send(ws, 'ERROR', { code: 'BAD_REQUEST', message: 'roomId is required' }, requestId);
    return;
  }

  const { role, error } = await ctx.ensureMember(roomId, ws.user.userId);
  if (!role) {
    ctx.send(ws, 'ERROR', { code: 'ACCESS_DENIED', message: error || 'Not a member' }, requestId);
    return;
  }
  const joinedRooms = ctx.socketRooms.get(ws);
  if (!joinedRooms || !joinedRooms.has(roomId)) {
    ctx.send(ws, 'ERROR', { code: 'NOT_JOINED', message: 'Join room first' }, requestId);
    return;
  }

  const roomSet = ctx.roomSockets.get(roomId) || new Set();
  ctx.broadcast(roomSet, 'PRESENCE_STATE', { roomId, userId: ws.user.userId, cursor }, ws);
};

module.exports = { PRESENCE_UPDATE };
