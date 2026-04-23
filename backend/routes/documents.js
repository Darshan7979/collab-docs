const express = require("express");
const { randomBytes } = require("crypto");
const Document = require("../models/Document");

const router = express.Router();

// Create a short share-friendly document id like: doc_a1b2c3d4
function generateFriendlyDocId() {
  return `doc_${randomBytes(6).toString("hex")}`;
}

async function createUniqueDocId() {
  let docId = generateFriendlyDocId();

  // Very unlikely to collide, but we still guarantee uniqueness.
  while (await Document.exists({ documentId: docId })) {
    docId = generateFriendlyDocId();
  }

  return docId;
}

function canAccessDocument(doc, email) {
  if (!email) {
    return false;
  }

  return doc.createdBy === email || doc.allowedUsers.includes(email);
}

// Get all documents (optionally filtered by creator email).
router.get("/", async (req, res) => {
  try {
    const filter = {};

    if (req.query.createdBy) {
      filter.createdBy = req.query.createdBy;
    }

    const documents = await Document.find(filter)
      .select("documentId title createdBy createdAt updatedAt")
      .sort({ updatedAt: -1 });

    res.json(documents);
  } catch (error) {
    res.status(500).json({ message: "Could not load documents", error: error.message });
  }
});

// Create a new document.
router.post("/", async (req, res) => {
  try {
    const { title, createdBy } = req.body;

    if (!createdBy) {
      return res.status(400).json({ message: "createdBy is required" });
    }

    const documentId = await createUniqueDocId();

    const newDocument = await Document.create({
      documentId,
      title: title || "Untitled Document",
      content: "",
      createdBy,
      // Creator is always allowed by default.
      allowedUsers: [createdBy]
    });

    res.status(201).json(newDocument);
  } catch (error) {
    res.status(500).json({ message: "Could not create document", error: error.message });
  }
});

// Get one document by its public documentId.
router.get("/:documentId", async (req, res) => {
  try {
    const { userEmail } = req.query;
    const doc = await Document.findOne({ documentId: req.params.documentId });

    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }

    if (!canAccessDocument(doc, userEmail)) {
      return res.status(403).json({ message: "You are not allowed to access this document" });
    }

    res.json(doc);
  } catch (error) {
    res.status(500).json({ message: "Could not load document", error: error.message });
  }
});

// Update title and/or content (used by auto-save).
router.put("/:documentId", async (req, res) => {
  try {
    const { content, title, userEmail } = req.body;

    const existingDoc = await Document.findOne({ documentId: req.params.documentId });

    if (!existingDoc) {
      return res.status(404).json({ message: "Document not found" });
    }

    if (!canAccessDocument(existingDoc, userEmail)) {
      return res.status(403).json({ message: "You are not allowed to edit this document" });
    }

    const updateData = {
      updatedAt: new Date()
    };

    if (typeof content === "string") {
      updateData.content = content;
    }

    if (typeof title === "string" && title.trim()) {
      updateData.title = title.trim();
    }

    const updatedDoc = await Document.findOneAndUpdate(
      { documentId: req.params.documentId },
      { $set: updateData },
      { new: true }
    );

    res.json(updatedDoc);
  } catch (error) {
    res.status(500).json({ message: "Could not update document", error: error.message });
  }
});

// Add a person to document access list.
router.post("/:documentId/allow-user", async (req, res) => {
  try {
    const { requesterEmail, userEmailToAdd } = req.body;

    if (!requesterEmail || !userEmailToAdd) {
      return res.status(400).json({ message: "requesterEmail and userEmailToAdd are required" });
    }

    const doc = await Document.findOne({ documentId: req.params.documentId });

    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Keep it simple: only owner can add users.
    if (doc.createdBy !== requesterEmail) {
      return res.status(403).json({ message: "Only owner can add people" });
    }

    if (!doc.allowedUsers.includes(userEmailToAdd)) {
      doc.allowedUsers.push(userEmailToAdd);
    }

    doc.updatedAt = new Date();
    await doc.save();

    res.json({
      message: "User added successfully",
      allowedUsers: doc.allowedUsers
    });
  } catch (error) {
    res.status(500).json({ message: "Could not add user", error: error.message });
  }
});

// Delete a document (owner only).
router.delete("/:documentId", async (req, res) => {
  try {
    const { requesterEmail } = req.query;

    if (!requesterEmail) {
      return res.status(400).json({ message: "requesterEmail is required" });
    }

    const doc = await Document.findOne({ documentId: req.params.documentId });

    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }

    if (doc.createdBy !== requesterEmail) {
      return res.status(403).json({ message: "Only owner can delete document" });
    }

    await Document.deleteOne({ documentId: req.params.documentId });

    res.json({
      message: "Document deleted successfully",
      documentId: req.params.documentId
    });
  } catch (error) {
    res.status(500).json({ message: "Could not delete document", error: error.message });
  }
});

module.exports = router;
