const express = require("express");
const { randomUUID } = require("crypto");
const Document = require("../models/Document");

const router = express.Router();

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

    const newDocument = await Document.create({
      documentId: randomUUID(),
      title: title || "Untitled Document",
      content: "",
      createdBy
    });

    res.status(201).json(newDocument);
  } catch (error) {
    res.status(500).json({ message: "Could not create document", error: error.message });
  }
});

// Get one document by its public documentId.
router.get("/:documentId", async (req, res) => {
  try {
    const doc = await Document.findOne({ documentId: req.params.documentId });

    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }

    res.json(doc);
  } catch (error) {
    res.status(500).json({ message: "Could not load document", error: error.message });
  }
});

// Update title and/or content (used by auto-save).
router.put("/:documentId", async (req, res) => {
  try {
    const { content, title } = req.body;

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

    if (!updatedDoc) {
      return res.status(404).json({ message: "Document not found" });
    }

    res.json(updatedDoc);
  } catch (error) {
    res.status(500).json({ message: "Could not update document", error: error.message });
  }
});

module.exports = router;
