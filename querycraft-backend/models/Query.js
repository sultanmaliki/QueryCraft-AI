const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const QuerySchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  chat: { type: Schema.Types.ObjectId, ref: 'Chat', required: true }, // 🔑 link to a chat
  prompt: { type: String, required: true },
  response: { type: String },
  raw: { type: Schema.Types.Mixed },
  usage: { type: Schema.Types.Mixed },
  model: { type: String },
  status: { type: String, enum: ['pending','done','failed'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Query', QuerySchema);
