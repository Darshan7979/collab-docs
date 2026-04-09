const BACKEND_URL = "http://localhost:5000";
const AUTO_SAVE_MS = 5000;

const page = document.body.dataset.page;

function setMessage(id, text, type = "") {
  const el = document.getElementById(id);
  if (!el) return;

  el.textContent = text;
  el.classList.remove("error", "ok");
  if (type) {
    el.classList.add(type);
  }
}

function setUserInNavbar(user) {
  const userEls = document.querySelectorAll(".js-user-email");
  const value = user?.displayName || user?.email || "Unknown User";
  userEls.forEach((el) => {
    el.textContent = value;
  });
}

function attachLogout() {
  document.querySelectorAll(".js-logout-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await auth.signOut();
      window.location.href = "login.html";
    });
  });
}

function redirectIfLoggedIn() {
  auth.onAuthStateChanged((user) => {
    if (user) {
      window.location.href = "dashboard.html";
    }
  });
}

function protectRoute(onSuccess) {
  auth.onAuthStateChanged((user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    setUserInNavbar(user);
    attachLogout();
    onSuccess(user);
  });
}

function setupLogin() {
  redirectIfLoggedIn();

  const form = document.getElementById("login-form");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;

    try {
      await auth.signInWithEmailAndPassword(email, password);
      setMessage("auth-message", "Login successful. Redirecting...", "ok");
      window.location.href = "dashboard.html";
    } catch (error) {
      setMessage("auth-message", error.message, "error");
    }
  });
}

function setupSignup() {
  redirectIfLoggedIn();

  const form = document.getElementById("signup-form");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = document.getElementById("signup-name").value.trim();
    const email = document.getElementById("signup-email").value.trim();
    const password = document.getElementById("signup-password").value;

    try {
      const cred = await auth.createUserWithEmailAndPassword(email, password);

      if (name) {
        await cred.user.updateProfile({ displayName: name });
      }

      setMessage("auth-message", "Account created. Redirecting...", "ok");
      window.location.href = "dashboard.html";
    } catch (error) {
      setMessage("auth-message", error.message, "error");
    }
  });
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${BACKEND_URL}${path}`, {
    headers: {
      "Content-Type": "application/json"
    },
    ...options
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || "Request failed");
  }

  return response.json();
}

function createDocCard(doc) {
  const article = document.createElement("article");
  article.className = "doc-card";

  const updatedText = new Date(doc.updatedAt || doc.createdAt).toLocaleString();

  article.innerHTML = `
    <h3>${doc.title || "Untitled Document"}</h3>
    <p class="doc-meta">Last updated: ${updatedText}</p>
    <button class="btn btn-primary">Open</button>
  `;

  article.querySelector("button").addEventListener("click", () => {
    window.location.href = `editor.html?id=${doc.documentId}`;
  });

  return article;
}

function setupDashboard() {
  protectRoute(async (user) => {
    const docListEl = document.getElementById("doc-list");
    const newDocBtn = document.getElementById("new-doc-btn");

    async function loadDocuments() {
      try {
        docListEl.innerHTML = "";

        const docs = await apiRequest(`/api/documents?createdBy=${encodeURIComponent(user.email)}`);

        if (!docs.length) {
          docListEl.innerHTML = "<p>No documents yet. Create your first one.</p>";
          return;
        }

        docs.forEach((doc) => {
          docListEl.appendChild(createDocCard(doc));
        });
      } catch (error) {
        setMessage("dashboard-message", error.message, "error");
      }
    }

    newDocBtn.addEventListener("click", async () => {
      const title = window.prompt("Document title:", "Untitled Document");
      if (title === null) return;

      try {
        const newDoc = await apiRequest("/api/documents", {
          method: "POST",
          body: JSON.stringify({
            title: title.trim() || "Untitled Document",
            createdBy: user.email
          })
        });

        window.location.href = `editor.html?id=${newDoc.documentId}`;
      } catch (error) {
        setMessage("dashboard-message", error.message, "error");
      }
    });

    await loadDocuments();
  });
}

function setupEditor() {
  protectRoute((user) => {
    const params = new URLSearchParams(window.location.search);
    const documentId = params.get("id");

    if (!documentId) {
      window.location.href = "dashboard.html";
      return;
    }

    const statusElId = "editor-status";
    const titleInput = document.getElementById("doc-title");
    const saveBtn = document.getElementById("save-now-btn");

    const quill = new Quill("#editor", {
      theme: "snow",
      modules: {
        toolbar: "#toolbar-container"
      }
    });

    quill.disable();
    setMessage(statusElId, "Loading document...");

    const socket = io(BACKEND_URL);

    socket.emit("join-document", {
      documentId,
      userEmail: user.email
    });

    socket.on("document-load", (payload) => {
      const content = payload?.content || "";
      const title = payload?.title || "Untitled Document";

      quill.setContents(quill.clipboard.convert(content));
      titleInput.value = title;
      quill.enable();
      setMessage(statusElId, "Connected. Real-time sync is active.", "ok");
    });

    socket.on("receive-changes", (delta) => {
      quill.updateContents(delta, "silent");
    });

    socket.on("presence-update", ({ message }) => {
      if (!message) return;
      setMessage(statusElId, message, "ok");
      setTimeout(() => {
        setMessage(statusElId, "Connected. Real-time sync is active.", "ok");
      }, 2000);
    });

    quill.on("text-change", (delta, _oldDelta, source) => {
      // Only send user-generated edits to avoid feedback loops.
      if (source !== "user") return;

      socket.emit("send-changes", { documentId, delta });
    });

    async function saveDocument() {
      try {
        const payload = {
          title: titleInput.value.trim() || "Untitled Document",
          content: quill.root.innerHTML
        };

        await apiRequest(`/api/documents/${documentId}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });

        // Also push through socket so server receives last version quickly.
        socket.emit("save-document", {
          documentId,
          ...payload
        });

        setMessage(statusElId, `Saved at ${new Date().toLocaleTimeString()}`, "ok");
      } catch (error) {
        setMessage(statusElId, `Save failed: ${error.message}`, "error");
      }
    }

    const intervalId = setInterval(saveDocument, AUTO_SAVE_MS);

    saveBtn.addEventListener("click", saveDocument);

    window.addEventListener("beforeunload", () => {
      clearInterval(intervalId);
      socket.disconnect();
    });
  });
}

if (page === "login") {
  setupLogin();
}

if (page === "signup") {
  setupSignup();
}

if (page === "dashboard") {
  setupDashboard();
}

if (page === "editor") {
  setupEditor();
}
