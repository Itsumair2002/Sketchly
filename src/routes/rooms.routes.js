const express = require('express');
const crypto = require('crypto');
const Room = require('../models/Room');
const RoomMember = require('../models/RoomMember');
const Message = require('../models/Message');
const BoardElement = require('../models/BoardElement');
const authHttp = require('../middleware/authHttp');

const router = express.Router();

router.use(authHttp);

const generateJoinCode = () => crypto.randomBytes(3).toString('hex');

const ensureMember = async (roomId, userId) => {
  const room = await Room.findById(roomId).lean();
  if (!room) return { room: null, role: null };
  if (room.ownerId.toString() === userId.toString()) {
    return { room, role: 'owner' };
  }
  const membership = await RoomMember.findOne({ roomId, userId }).lean();
  if (!membership) return { room, role: null };
  return { room, role: membership.role || 'viewer' };
};

router.post('/', async (req, res) => {
  const { name } = req.body || {};
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  try {
    let joinCode = generateJoinCode();
    let exists = await Room.findOne({ joinCode });
    while (exists) {
      joinCode = generateJoinCode();
      // eslint-disable-next-line no-await-in-loop
      exists = await Room.findOne({ joinCode });
    }

    const room = await Room.create({ name, ownerId: req.user.userId, joinCode });
    await RoomMember.create({ roomId: room._id, userId: req.user.userId, role: 'owner' });

    return res.json({ room: { id: room._id.toString(), name: room.name, joinCode: room.joinCode, ownerId: room.ownerId.toString(), createdAt: room.createdAt } });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

router.post('/join', async (req, res) => {
  const { joinCode } = req.body || {};
  if (!joinCode) {
    return res.status(400).json({ error: 'joinCode is required' });
  }

  try {
    const room = await Room.findOne({ joinCode: joinCode.trim() });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    let role = room.ownerId.toString() === req.user.userId ? 'owner' : 'viewer';
    const existing = await RoomMember.findOne({ roomId: room._id, userId: req.user.userId });
    if (!existing) {
      await RoomMember.create({ roomId: room._id, userId: req.user.userId, role });
    } else {
      role = existing.role;
    }

    return res.json({ room: { id: room._id.toString(), name: room.name, joinCode: room.joinCode, ownerId: room.ownerId.toString(), createdAt: room.createdAt }, role });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/', async (req, res) => {
  try {
    const memberships = await RoomMember.find({ userId: req.user.userId }).lean();
    const roomIds = memberships.map((m) => m.roomId);
    const rooms = await Room.find({ _id: { $in: roomIds } }).lean();
    const result = rooms.map((room) => {
      const membership = memberships.find((m) => m.roomId.toString() === room._id.toString());
      return {
        id: room._id.toString(),
        name: room.name,
        joinCode: room.joinCode,
        ownerId: room.ownerId.toString(),
        createdAt: room.createdAt,
        role: room.ownerId.toString() === req.user.userId ? 'owner' : membership?.role || 'viewer'
      };
    });
    return res.json({ rooms: result });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:roomId', async (req, res) => {
  try {
    const { room, role } = await ensureMember(req.params.roomId, req.user.userId);
    if (!room || !role) {
      return res.status(403).json({ error: 'Access denied' });
    }
    return res.json({ room: { id: room._id.toString(), name: room.name, joinCode: room.joinCode, ownerId: room.ownerId.toString(), createdAt: room.createdAt }, role });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:roomId/board-elements', async (req, res) => {
  try {
    const { role } = await ensureMember(req.params.roomId, req.user.userId);
    if (!role) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const elements = await BoardElement.find({ roomId: req.params.roomId, isDeleted: false })
      .sort({ createdAt: 1 })
      .lean();
    const mapped = elements.map((el) => ({
      id: el._id.toString(),
      roomId: el.roomId.toString(),
      elementId: el.elementId,
      type: el.type,
      data: el.data,
      userId: el.userId.toString(),
      isDeleted: el.isDeleted,
      createdAt: el.createdAt,
      updatedAt: el.updatedAt
    }));
    return res.json({ elements: mapped });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:roomId/messages', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  try {
    const { role } = await ensureMember(req.params.roomId, req.user.userId);
    if (!role) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const messages = await Message.find({ roomId: req.params.roomId, deletedFor: { $ne: req.user.userId } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    const mapped = messages.map((m) => ({
      id: m._id.toString(),
      roomId: m.roomId.toString(),
      senderId: m.senderId.toString(),
      text: m.text,
      createdAt: m.createdAt,
      isDeleted: Boolean(m.isDeleted)
    }));
    return res.json({ messages: mapped });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

// Delete room (owner only) and cascade related data
router.delete('/:roomId', async (req, res) => {
  try {
    const { room, role } = await ensureMember(req.params.roomId, req.user.userId);
    if (!room || role !== 'owner') {
      return res.status(403).json({ error: 'Access denied' });
    }

    await Promise.all([
      RoomMember.deleteMany({ roomId: room._id }),
      Message.deleteMany({ roomId: room._id }),
      BoardElement.deleteMany({ roomId: room._id }),
      Room.deleteOne({ _id: room._id })
    ]);

    return res.json({ success: true, roomId: req.params.roomId });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

// Exit room (non-owner)
router.delete('/:roomId/exit', async (req, res) => {
  try {
    const { room, role } = await ensureMember(req.params.roomId, req.user.userId);
    if (!room || !role) {
      return res.status(404).json({ error: 'Room not found' });
    }
    if (role === 'owner') {
      return res.status(400).json({ error: 'Owner cannot exit room. Delete instead.' });
    }
    await RoomMember.deleteOne({ roomId: room._id, userId: req.user.userId });
    return res.json({ success: true, roomId: req.params.roomId });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
