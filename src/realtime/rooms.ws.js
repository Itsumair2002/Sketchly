const ROOM_JOIN = async (ws, payload, ctx, requestId) => {
  const { roomId } = payload || {};
  if (!roomId) {
    ctx.send(ws, 'ERROR', { code: 'BAD_REQUEST', message: 'roomId is required' }, requestId);
    return;
  }

  const { role, error } = await ctx.ensureMember(roomId, ws.user.userId);
  if (!role) {
    ctx.send(ws, 'ERROR', { code: 'ACCESS_DENIED', message: error || 'Not a member' }, requestId);
    return;
  }

  if (!ctx.roomSockets.has(roomId)) ctx.roomSockets.set(roomId, new Set());
  const roomSet = ctx.roomSockets.get(roomId);
  roomSet.add(ws);

  if (!ctx.socketRooms.has(ws)) ctx.socketRooms.set(ws, new Set());
  ctx.socketRooms.get(ws).add(roomId);

  const onlineUsers = [];
  roomSet.forEach((client) => {
    if (!client.user) return;
    if (onlineUsers.find((u) => u.userId === client.user.userId)) return;
    onlineUsers.push({ userId: client.user.userId, name: client.user.name });
  });

  ctx.send(ws, 'ROOM_JOINED', { roomId, onlineUsers }, requestId);
  ctx.broadcast(roomSet, 'PRESENCE_JOIN', { roomId, userId: ws.user.userId, name: ws.user.name }, ws);
};

const ROOM_LEAVE = async (ws, payload, ctx, requestId) => {
  const { roomId } = payload || {};
  if (!roomId) {
    ctx.send(ws, 'ERROR', { code: 'BAD_REQUEST', message: 'roomId is required' }, requestId);
    return;
  }

  const roomSet = ctx.roomSockets.get(roomId);
  if (roomSet) {
    roomSet.delete(ws);
    if (roomSet.size === 0) ctx.roomSockets.delete(roomId);
  }
  const rooms = ctx.socketRooms.get(ws);
  if (rooms) {
    rooms.delete(roomId);
    if (rooms.size === 0) ctx.socketRooms.delete(ws);
  }

  ctx.broadcast(roomSet || new Set(), 'PRESENCE_LEAVE', { roomId, userId: ws.user.userId }, ws);
  ctx.send(ws, 'ROOM_LEFT', { roomId }, requestId);
};

module.exports = { ROOM_JOIN, ROOM_LEAVE };
