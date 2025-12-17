const validate = require('../utils/validate');

const CHAT_SEND = async (ws, payload, ctx, requestId) => {
  const { roomId, text } = payload || {};
  if (!roomId || !validate.isValidObjectId(roomId)) {
    ctx.send(ws, 'ERROR', { code: 'BAD_REQUEST', message: 'roomId is required' }, requestId);
    return;
  }
  if (!validate.isNonEmptyString(text, 500)) {
    ctx.send(ws, 'ERROR', { code: 'BAD_REQUEST', message: 'Text is required' }, requestId);
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

  const message = await ctx.models.Message.create({
    roomId,
    senderId: ws.user.userId,
    text: text.trim(),
    isDeleted: false,
    deletedFor: []
  });

  const payloadOut = {
    roomId,
    message: {
      id: message._id.toString(),
      roomId: message.roomId.toString(),
      senderId: message.senderId.toString(),
      text: message.text,
      createdAt: message.createdAt,
      isDeleted: message.isDeleted
    }
  };

  const roomSet = ctx.roomSockets.get(roomId) || new Set();
  ctx.broadcast(roomSet, 'CHAT_NEW', payloadOut);
};

const CHAT_TYPING = async (ws, payload, ctx, requestId) => {
  const { roomId, isTyping } = payload || {};
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
  ctx.broadcast(roomSet, 'CHAT_TYPING', { roomId, userId: ws.user.userId, isTyping: Boolean(isTyping) }, ws);
};

const CHAT_DELETE = async (ws, payload, ctx, requestId) => {
  const { roomId, messageId, forEveryone } = payload || {};
  if (!roomId || !validate.isValidObjectId(roomId) || !validate.isValidObjectId(messageId)) {
    ctx.send(ws, 'ERROR', { code: 'BAD_REQUEST', message: 'Invalid payload' }, requestId);
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
  const msg = await ctx.models.Message.findOne({ _id: messageId, roomId });
  if (!msg) {
    ctx.send(ws, 'ERROR', { code: 'NOT_FOUND', message: 'Message not found' }, requestId);
    return;
  }

  if (forEveryone) {
    if (msg.senderId.toString() !== ws.user.userId.toString()) {
      ctx.send(ws, 'ERROR', { code: 'ACCESS_DENIED', message: 'Only sender can delete for everyone' }, requestId);
      return;
    }
    msg.isDeleted = true;
    msg.text = '';
    msg.updatedAt = new Date();
    await msg.save();
    const roomSet = ctx.roomSockets.get(roomId) || new Set();
    ctx.broadcast(roomSet, 'CHAT_DELETED', { roomId, messageId, forEveryone: true });
  } else {
    const already = (msg.deletedFor || []).find((id) => id.toString() === ws.user.userId.toString());
    if (!already) {
      msg.deletedFor = [...(msg.deletedFor || []), ws.user.userId];
      msg.updatedAt = new Date();
      await msg.save();
    }
    ctx.send(ws, 'CHAT_DELETED', { roomId, messageId, forEveryone: false }, requestId);
  }
};

module.exports = { CHAT_SEND, CHAT_TYPING, CHAT_DELETE };
