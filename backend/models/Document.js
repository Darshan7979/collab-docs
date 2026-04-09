const mongoose = require("mongoose");

// Each document is uniquely identified by documentId so users can share links.
const documentSchema = new mongoose.Schema({
  documentId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  title: {
    type: String,
    required: true,
    default: "Untitled Document",
    trim: true
  },
  content: {
    type: String,
    default: ""
  },
  createdBy: {
    type: String,
    required: true,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Document", documentSchema);
