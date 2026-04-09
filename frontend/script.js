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
    window.location.href = `editor.html?docId=${doc.documentId}`;
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

        window.location.href = `editor.html?docId=${newDoc.documentId}`;
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
    // Prefer docId for share links, but keep id fallback for old links.
    const docId = params.get("docId") || params.get("id");

    if (!docId) {
      window.location.href = "dashboard.html";
      return;
    }

    const statusElId = "editor-status";
    const titleInput = document.getElementById("doc-title");
    const saveBtn = document.getElementById("save-now-btn");
    const shareBtn = document.getElementById("share-link-btn");
    const addUserEmailInput = document.getElementById("add-user-email");
    const addUserBtn = document.getElementById("add-user-btn");
    const docIdDisplay = document.getElementById("doc-id-display");

    docIdDisplay.textContent = docId;

    const quill = new Quill("#editor", {
      theme: "snow",
      modules: {
        toolbar: "#toolbar-container"
      }
    });

    quill.disable();
    setMessage(statusElId, "Loading document...");

    // Check access using REST first so we can show clear unauthorized message.
    apiRequest(`/api/documents/${docId}?userEmail=${encodeURIComponent(user.email)}`)
      .then((doc) => {
        titleInput.value = doc.title || "Untitled Document";
      })
      .catch((error) => {
        if (error.message.toLowerCase().includes("not found")) {
          // If missing, socket join will create this document automatically.
          return;
        }

        setMessage(statusElId, error.message, "error");
      });

    const socket = io(BACKEND_URL);

    socket.emit("join-document", {
      docId,
      userEmail: user.email
    });

    socket.on("document-unauthorized", ({ message }) => {
      setMessage(statusElId, message || "Unauthorized", "error");
      quill.disable();
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

      socket.emit("send-changes", { docId, delta });
    });

    shareBtn.addEventListener("click", async () => {
      // Always share a clean canonical link format.
      const shareUrl = `${window.location.origin}${window.location.pathname}?docId=${encodeURIComponent(docId)}`;

      try {
        await navigator.clipboard.writeText(shareUrl);
        window.alert("Link copied");
      } catch (_error) {
        // Fallback if clipboard API is not available.
        window.prompt("Copy this link:", shareUrl);
      }
    });

    addUserBtn.addEventListener("click", async () => {
      const userEmailToAdd = addUserEmailInput.value.trim();

      if (!userEmailToAdd) {
        setMessage(statusElId, "Please enter an email", "error");
        return;
      }

      try {
        await apiRequest(`/api/documents/${docId}/allow-user`, {
          method: "POST",
          body: JSON.stringify({
            requesterEmail: user.email,
            userEmailToAdd
          })
        });

        addUserEmailInput.value = "";
        setMessage(statusElId, "User added successfully", "ok");
      } catch (error) {
        setMessage(statusElId, error.message, "error");
      }
    });

    async function saveDocument() {
      try {
        const payload = {
          title: titleInput.value.trim() || "Untitled Document",
          content: quill.root.innerHTML,
          userEmail: user.email
        };

        await apiRequest(`/api/documents/${docId}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });

        // Also push through socket so server receives last version quickly.
        socket.emit("save-document", {
          docId,
          userEmail: user.email,
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
