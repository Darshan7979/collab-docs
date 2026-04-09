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

  socket.on("join-document", async ({ documentId, userEmail }) => {
    if (!documentId) {
      return;
    }

    socket.join(documentId);

    // Ensure the document exists so first collaborator can start immediately.
    let doc = await Document.findOne({ documentId });
    if (!doc) {
      doc = await Document.create({
        documentId,
        title: "Untitled Document",
        content: "",
        createdBy: userEmail || "unknown"
      });
    }

    socket.emit("document-load", {
      title: doc.title,
      content: doc.content
    });

    socket.to(documentId).emit("presence-update", {
      message: `${userEmail || "A user"} joined this document`
    });
  });

  socket.on("send-changes", ({ documentId, delta }) => {
    if (!documentId || !delta) {
      return;
    }

    socket.to(documentId).emit("receive-changes", delta);
  });

  socket.on("save-document", async ({ documentId, content, title }) => {
    if (!documentId) {
      return;
    }

    await Document.findOneAndUpdate(
      { documentId },
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
