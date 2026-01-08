const validate = require('../utils/validate');

const BOARD_ELEMENT_ADD = async (ws, payload, ctx, requestId) => {
  const { roomId, element } = payload || {};
  if (!roomId || !validate.isValidObjectId(roomId)) {
    ctx.send(ws, 'ERROR', { code: 'BAD_REQUEST', message: 'roomId is required' }, requestId);
    return;
  }
  if (!element || !validate.isNonEmptyString(element.elementId) || !validate.isNonEmptyString(element.type)) {
    ctx.send(ws, 'ERROR', { code: 'BAD_REQUEST', message: 'Invalid element' }, requestId);
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

  const doc = await ctx.models.BoardElement.create({
    roomId,
    elementId: element.elementId,
    userId: ws.user.userId,
    type: element.type,
    data: element.data || {},
    isDeleted: false
  });

  const payloadOut = {
    roomId,
    element: {
      elementId: doc.elementId,
      type: doc.type,
      data: doc.data,
      userId: doc.userId.toString(),
      isDeleted: doc.isDeleted,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    }
  };

  const roomSet = ctx.roomSockets.get(roomId) || new Set();
  ctx.broadcast(roomSet, 'BOARD_ELEMENT_ADDED', payloadOut);
};

const BOARD_ELEMENT_DELETE = async (ws, payload, ctx, requestId) => {
  const { roomId, elementId } = payload || {};
  if (!roomId || !validate.isValidObjectId(roomId) || !validate.isNonEmptyString(elementId)) {
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

  const element = await ctx.models.BoardElement.findOneAndUpdate(
    { roomId, elementId },
    { isDeleted: true, updatedAt: new Date() },
    { new: true }
  );
  if (!element) {
    ctx.send(ws, 'ERROR', { code: 'NOT_FOUND', message: 'Element not found' }, requestId);
    return;
  }
  if (element.userId.toString() !== ws.user.userId.toString()) {
    ctx.send(ws, 'ERROR', { code: 'ACCESS_DENIED', message: 'Cannot delete this element' }, requestId);
    return;
  }
  const roomSet = ctx.roomSockets.get(roomId) || new Set();
  ctx.broadcast(roomSet, 'BOARD_ELEMENT_DELETED', { roomId, elementId });
};

const BOARD_ELEMENT_UPDATE = async (ws, payload, ctx, requestId) => {
  const { roomId, elementId, patch } = payload || {};
  if (!roomId || !validate.isValidObjectId(roomId) || !validate.isNonEmptyString(elementId)) {
    ctx.send(ws, 'ERROR', { code: 'BAD_REQUEST', message: 'Invalid payload' }, requestId);
    return;
  }
  if (typeof patch !== 'object' || patch === null) {
    ctx.send(ws, 'ERROR', { code: 'BAD_REQUEST', message: 'patch is required' }, requestId);
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

  const element = await ctx.models.BoardElement.findOne({ roomId, elementId });
  if (!element) {
    ctx.send(ws, 'ERROR', { code: 'NOT_FOUND', message: 'Element not found' }, requestId);
    return;
  }
  if (element.isDeleted) {
    ctx.send(ws, 'ERROR', { code: 'NOT_FOUND', message: 'Element is deleted' }, requestId);
    return;
  }

  element.data = { ...element.data, ...patch };
  element.updatedAt = new Date();
  await element.save();

  const roomSet = ctx.roomSockets.get(roomId) || new Set();
  ctx.broadcast(roomSet, 'BOARD_ELEMENT_UPDATED', { roomId, elementId, patch });
};

const BOARD_ELEMENT_RESTORE = async (ws, payload, ctx, requestId) => {
  const { roomId, elementId, element } = payload || {};
  if (!roomId || !validate.isValidObjectId(roomId) || !validate.isNonEmptyString(elementId)) {
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

  const doc = await ctx.models.BoardElement.findOne({ roomId, elementId });
  if (!doc) {
    ctx.send(ws, 'ERROR', { code: 'NOT_FOUND', message: 'Element not found' }, requestId);
    return;
  }
  if (doc.userId.toString() !== ws.user.userId.toString()) {
    ctx.send(ws, 'ERROR', { code: 'ACCESS_DENIED', message: 'Cannot restore this element' }, requestId);
    return;
  }

  if (element && typeof element.data === 'object') {
    doc.data = { ...doc.data, ...element.data };
  }
  doc.isDeleted = false;
  doc.updatedAt = new Date();
  await doc.save();

  const roomSet = ctx.roomSockets.get(roomId) || new Set();
  ctx.broadcast(roomSet, 'BOARD_ELEMENT_RESTORED', {
    roomId,
    element: {
      elementId: doc.elementId,
      type: doc.type,
      data: doc.data,
      userId: doc.userId.toString(),
      isDeleted: doc.isDeleted,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    }
  });
};

const BOARD_ELEMENT_LIVE = async (ws, payload, ctx, requestId) => {
  const { roomId, element } = payload || {};
  if (!roomId || !validate.isValidObjectId(roomId)) {
    ctx.send(ws, 'ERROR', { code: 'BAD_REQUEST', message: 'roomId is required' }, requestId);
    return;
  }
  if (!element || !validate.isNonEmptyString(element.elementId) || !validate.isNonEmptyString(element.type)) {
    ctx.send(ws, 'ERROR', { code: 'BAD_REQUEST', message: 'Invalid element' }, requestId);
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
  ctx.broadcast(roomSet, 'BOARD_ELEMENT_LIVE', { roomId, element: { ...element, userId: ws.user.userId } }, ws);
};

module.exports = { BOARD_ELEMENT_ADD, BOARD_ELEMENT_DELETE, BOARD_ELEMENT_UPDATE, BOARD_ELEMENT_RESTORE, BOARD_ELEMENT_LIVE };
