// routes/chat.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Chat = require('../models/Chat');
const Query = require('../models/Query');

// List all chats for a user
router.get('/', auth, async (req, res) => {
  const chats = await Chat.find({ user: req.userId }).sort({ updatedAt: -1 }).lean();
  res.json(chats);
});

// Get one chat with queries
router.get('/:id', auth, async (req, res) => {
  const chat = await Chat.findOne({ _id: req.params.id, user: req.userId }).lean();
  if (!chat) return res.status(404).json({ error: 'Chat not found' });
  const queries = await Query.find({ chat: chat._id }).sort({ createdAt: 1 }).lean();
  res.json({ chat, queries });
});

// Create new chat manually
router.post('/', auth, async (req, res) => {
  const { title } = req.body;
  const chat = await Chat.create({ user: req.userId, title: title || 'New Chat' });
  res.status(201).json(chat);
});

// Delete a chat and its queries
router.delete('/:id', auth, async (req, res) => {
  const chat = await Chat.findOneAndDelete({ _id: req.params.id, user: req.userId });
  if (!chat) return res.status(404).json({ error: 'Chat not found' });
  await Query.deleteMany({ chat: chat._id });
  res.json({ success: true });
});

// Delete all chat and its queries
router.delete('/', auth, async (req, res) => {
  const chats = await Chat.deleteMany({  user: req.userId  });
  if (!chats) return res.status(404).json({ error: 'Failed to delete all chats' });
  await Query.deleteMany({ user: req.userId });
  res.json({ success: true });
});

module.exports = router;
