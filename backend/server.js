const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const { Server } = require("socket.io");

const Document = require("./models/Document");
const documentRoutes = require("./routes/documents");

dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/collab_docs";
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "*";

app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => {
  res.json({ message: "Collab Docs backend is running" });
});

app.use("/api/documents", documentRoutes);

const io = new Server(server, {
  cors: {
    origin: FRONTEND_ORIGIN,
    methods: ["GET", "POST"]
  }
});

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("join-document", async ({ docId, documentId, userEmail }) => {
    // Support both names, but docId is preferred in frontend.
    const roomId = docId || documentId;

    if (!roomId) {
      return;
    }

    // Ensure the document exists so first collaborator can start immediately.
    let doc = await Document.findOne({ documentId: roomId });
    if (!doc) {
      doc = await Document.create({
        documentId: roomId,
        title: "Untitled Document",
        content: "",
        createdBy: userEmail || "unknown",
        allowedUsers: userEmail ? [userEmail] : []
      });
    }

    const canAccess =
      userEmail && (doc.createdBy === userEmail || doc.allowedUsers.includes(userEmail));

    if (!canAccess) {
      socket.emit("document-unauthorized", {
        message: "You are not allowed to access this document"
      });
      return;
    }

    socket.join(roomId);

    socket.emit("document-load", {
      documentId: doc.documentId,
      title: doc.title,
      content: doc.content
    });

    socket.to(roomId).emit("presence-update", {
      message: `${userEmail || "A user"} joined this document`
    });
  });

  socket.on("send-changes", ({ docId, documentId, delta }) => {
    const roomId = docId || documentId;

    if (!roomId || !delta) {
      return;
    }

    socket.to(roomId).emit("receive-changes", delta);
  });

  socket.on("save-document", async ({ docId, documentId, content, title, userEmail }) => {
    const roomId = docId || documentId;

    if (!roomId) {
      return;
    }

    const doc = await Document.findOne({ documentId: roomId });

    if (!doc) {
      return;
    }

    const canAccess =
      userEmail && (doc.createdBy === userEmail || doc.allowedUsers.includes(userEmail));

    if (!canAccess) {
      return;
    }

    await Document.findOneAndUpdate(
      { documentId: roomId },
      {
        $set: {
          content: typeof content === "string" ? content : "",
          title: typeof title === "string" && title.trim() ? title.trim() : "Untitled Document",
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

async function startServer() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("MongoDB connected");

    server.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

startServer();
