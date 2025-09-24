// server/models/Feedback.js
const mongoose = require('mongoose');

const FeedbackSchema = new mongoose.Schema({
  email: {
    type: String,
    trim: true,
    lowercase: true,
  },
  message: {
    type: String,
    required: true,
    trim: true,
    minlength: 3,
    maxlength: 2000,
  },
  ip: {
    type: String,
    required: true,
  },
  userAgent: {
    type: String,
    default: 'unknown',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Optional: index for analytics (by IP + time)
FeedbackSchema.index({ ip: 1, createdAt: -1 });

module.exports = mongoose.model('Feedback', FeedbackSchema);
