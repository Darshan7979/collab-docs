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
  const initialsEls = document.querySelectorAll(".js-user-initials");
  let value = (user?.displayName || "").trim();

  if (!value && user?.email) {
    value = user.email.split("@")[0] || "Unknown User";
  }

  if (!value) {
    value = "Unknown User";
  }

  userEls.forEach((el) => {
    el.textContent = value;
  });

  const initials = value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "U";

  initialsEls.forEach((el) => {
    el.textContent = initials;
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

function createDocCard(doc, options = {}) {
  const { onRename, onCopyLink, onDelete, index = 0 } = options;
  const article = document.createElement("article");
  article.className = "doc-card";
  article.style.setProperty("--card-index", String(index));

  const updatedText = new Date(doc.updatedAt || doc.createdAt).toLocaleString();

  article.innerHTML = `
    <h3 class="doc-title">${doc.title || "Untitled Document"}</h3>
    <p class="doc-meta">Last updated: ${updatedText}</p>
    <div class="doc-actions">
      <button class="btn btn-primary" data-action="open">Open</button>
      <button class="btn btn-ghost doc-action-btn" data-action="rename">Rename</button>
      <button class="btn btn-ghost doc-action-btn" data-action="copy-link">Copy Link</button>
      <button class="btn btn-ghost doc-action-btn doc-action-delete" data-action="delete">Delete</button>
    </div>
  `;

  article.querySelector('[data-action="open"]').addEventListener("click", () => {
    window.location.href = `editor.html?docId=${doc.documentId}`;
  });

  article.querySelector('[data-action="rename"]').addEventListener("click", async () => {
    if (!onRename) return;
    await onRename(doc);
  });

  article.querySelector('[data-action="copy-link"]').addEventListener("click", async () => {
    if (!onCopyLink) return;
    await onCopyLink(doc);
  });

  article.querySelector('[data-action="delete"]').addEventListener("click", async () => {
    if (!onDelete) return;
    await onDelete(doc);
  });

  return article;
}

function setupDashboard() {
  protectRoute(async (user) => {
    const docListEl = document.getElementById("doc-list");
    const newDocBtn = document.getElementById("new-doc-btn");
    const refreshDocsBtn = document.getElementById("refresh-docs-btn");
    const backBtn = document.getElementById("dashboard-back-btn");

    if (backBtn) {
      backBtn.addEventListener("click", () => {
        if (window.history.length > 1) {
          window.history.back();
          return;
        }

        window.location.href = "landing.html";
      });
    }

    async function loadDocuments() {
      try {
        docListEl.innerHTML = "";

        const docs = await apiRequest(`/api/documents?createdBy=${encodeURIComponent(user.email)}`);

        if (!docs.length) {
          docListEl.innerHTML = "<p>No documents yet. Create your first one.</p>";
          return;
        }

        docs.forEach((doc, index) => {
          docListEl.appendChild(
            createDocCard(doc, {
              index,
              onRename: async (targetDoc) => {
                const nextTitle = window.prompt("Rename document:", targetDoc.title || "Untitled Document");
                if (nextTitle === null) return;

                const title = nextTitle.trim() || "Untitled Document";
                await apiRequest(`/api/documents/${targetDoc.documentId}`, {
                  method: "PUT",
                  body: JSON.stringify({
                    title,
                    userEmail: user.email
                  })
                });

                setMessage("dashboard-message", "Document renamed", "ok");
                await loadDocuments();
              },
              onCopyLink: async (targetDoc) => {
                const shareUrl = `${window.location.origin}${window.location.pathname.replace("dashboard.html", "editor.html")}?docId=${encodeURIComponent(targetDoc.documentId)}`;

                try {
                  await navigator.clipboard.writeText(shareUrl);
                  setMessage("dashboard-message", "Document link copied", "ok");
                } catch (_error) {
                  window.prompt("Copy this link:", shareUrl);
                }
              },
              onDelete: async (targetDoc) => {
                const confirmDelete = window.confirm(`Delete \"${targetDoc.title || "Untitled Document"}\"? This cannot be undone.`);
                if (!confirmDelete) return;

                await apiRequest(
                  `/api/documents/${targetDoc.documentId}?requesterEmail=${encodeURIComponent(user.email)}`,
                  { method: "DELETE" }
                );

                setMessage("dashboard-message", "Document deleted", "ok");
                await loadDocuments();
              }
            })
          );
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

    if (refreshDocsBtn) {
      refreshDocsBtn.addEventListener("click", async () => {
        refreshDocsBtn.disabled = true;
        const oldText = refreshDocsBtn.textContent;
        refreshDocsBtn.textContent = "Refreshing...";
        await loadDocuments();
        refreshDocsBtn.textContent = oldText;
        refreshDocsBtn.disabled = false;
      });
    }

    await loadDocuments();
  });
}

function setupEditor() {
  protectRoute(async (user) => {
    const params = new URLSearchParams(window.location.search);
    const docId = params.get("docId") || params.get("id");

    if (!docId) {
      window.location.href = "dashboard.html";
      return;
    }

    const statusElId = "editor-status";
    const titleInput = document.getElementById("doc-title");
    const saveBtn = document.getElementById("save-now-btn");
    const shareBtn = document.getElementById("share-link-btn");
    const commentBtn = document.getElementById("comment-btn");
    const statusPill = document.querySelector(".status-pill");
    const addUserEmailInput = document.getElementById("add-user-email");
    const addUserBtn = document.getElementById("add-user-btn");
    const docIdDisplay = document.getElementById("doc-id-display");
    const topbarTitle = document.getElementById("topbar-doc-title");
    const lastEditedEl = document.getElementById("last-edited");
    const collaboratorCountEl = document.getElementById("collaborator-count");
    const versionLabelEl = document.getElementById("version-label");
    const autosaveStatusEl = document.getElementById("autosave-status");
    const outlineList = document.getElementById("outline-list");
    const myDocsList = document.getElementById("my-docs-list");
    const newDocBtn = document.getElementById("new-document-btn");
    const workspaceNav = document.getElementById("workspace-nav");
    const collabList = document.getElementById("collab-list");
    const chatMessages = document.getElementById("chat-messages");
    const chatInput = document.getElementById("chat-input");
    const chatSendBtn = document.getElementById("chat-send-btn");
    const versionList = document.getElementById("version-list");
    const editorScroll = document.getElementById("editor-scroll");

    docIdDisplay.textContent = docId;

    let saveSequence = 0;
    const versionEntries = [];
    const currentUserLabel = user.displayName || user.email || "You";

    function setTopbarTitle(value) {
      const resolved = value && value.trim() ? value.trim() : "Untitled Document";
      if (titleInput) titleInput.value = resolved;
      if (topbarTitle) topbarTitle.textContent = resolved;
    }

    function setAutosaveStatus(value) {
      if (autosaveStatusEl) autosaveStatusEl.textContent = value;
    }

    function setLastEdited(dateLike) {
      if (!lastEditedEl) return;
      const value = dateLike ? new Date(dateLike) : new Date();
      lastEditedEl.textContent = value.toLocaleString();
    }

    function showSaveConfirmation() {
      if (!saveBtn) return;
      saveBtn.classList.add("saved");
      saveBtn.textContent = "✓ Saved";
      window.setTimeout(() => {
        saveBtn.classList.remove("saved");
        saveBtn.textContent = "Save";
      }, 1800);
    }

    function renderVersionHistory() {
      if (!versionList) return;
      versionList.innerHTML = "";

      if (!versionEntries.length) {
        const empty = document.createElement("div");
        empty.className = "version-item";
        empty.textContent = "No versions yet";
        versionList.appendChild(empty);
        return;
      }

      versionEntries.forEach((entry, index) => {
        const row = document.createElement("div");
        row.className = "version-item";
        row.innerHTML = `${entry.label}${index === 0 ? ' <span class="status-current">Current</span>' : ""} - ${entry.author}, ${entry.when}`;
        versionList.appendChild(row);
      });
    }

    function pushVersion(author, timeValue) {
      saveSequence += 1;
      const label = `v1.${saveSequence}`;
      if (versionLabelEl) versionLabelEl.textContent = label;

      versionEntries.unshift({
        label,
        author,
        when: new Date(timeValue || Date.now()).toLocaleTimeString()
      });

      if (versionEntries.length > 8) {
        versionEntries.pop();
      }

      renderVersionHistory();
    }

    function appendChatBubble({ author, text, timestamp, isSelf }) {
      if (!chatMessages) return;
      const bubble = document.createElement("div");
      bubble.className = `chat-bubble ${isSelf ? "self" : "other"}`;
      const nameEl = document.createElement("div");
      nameEl.className = "chat-author";
      nameEl.textContent = isSelf ? "You" : author;
      const msgEl = document.createElement("div");
      msgEl.textContent = text;
      const timeEl = document.createElement("div");
      timeEl.className = "chat-time";
      timeEl.textContent = new Date(timestamp || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      bubble.append(nameEl, msgEl, timeEl);
      chatMessages.appendChild(bubble);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function sendChatMessage(socketRef) {
      if (!chatInput) return;
      const text = chatInput.value.trim();
      if (!text) return;
      socketRef.emit("send-chat", { docId, author: currentUserLabel, text });
      chatInput.value = "";
      chatInput.focus();
    }

    function renderCollaborators(doc) {
      if (!collabList) return;

      const allUsers = Array.from(new Set([doc?.createdBy, ...(doc?.allowedUsers || [])].filter(Boolean)));
      collabList.innerHTML = "";

      allUsers.forEach((email) => {
        const row = document.createElement("div");
        row.className = "collab-item";
        row.innerHTML = `<span class="live-dot"></span>${email}${email === user.email ? " - You" : " - Editing"}`;
        collabList.appendChild(row);
      });

      if (collaboratorCountEl) {
        collaboratorCountEl.textContent = String(allUsers.length);
      }
    }

    function wireWorkspaceNav() {
      if (!workspaceNav) return;
      workspaceNav.querySelectorAll(".nav-item").forEach((item) => {
        item.addEventListener("click", () => {
          const nav = item.dataset.nav;
          if (nav === "all-docs") {
            window.location.href = "dashboard.html";
            return;
          }
          if (nav === "shared") {
            alert("Shared documents: This view shows documents shared with you by other users.");
          } else if (nav === "recent") {
            alert("Recent documents: This view shows your recently opened documents.");
          } else if (nav === "starred") {
            alert("Starred documents: This view shows your bookmarked documents.");
          }
          workspaceNav.querySelectorAll(".nav-item").forEach((el) => el.classList.remove("active"));
          item.classList.add("active");
        });
      });
    }

    const TEMPLATES = [
      {
        icon: "📋", title: "Meeting Notes",
        desc: "Structured agenda, attendees, and action items",
        content: `<h1>Meeting Notes</h1><p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p><p><strong>Attendees:</strong> </p><h2>Agenda</h2><ol><li>Topic 1</li><li>Topic 2</li><li>Topic 3</li></ol><h2>Discussion</h2><p>Key points discussed during the meeting...</p><h2>Action Items</h2><ul><li><strong>[Owner]</strong> — Task description — <em>Due: </em></li><li><strong>[Owner]</strong> — Task description — <em>Due: </em></li></ul><h2>Next Meeting</h2><p>Date: TBD</p>`
      },
      {
        icon: "🚀", title: "Project Brief",
        desc: "Outline goals, scope, timeline, and deliverables",
        content: `<h1>Project Brief</h1><h2>Overview</h2><p>Provide a brief summary of what this project aims to achieve.</p><h2>Goals &amp; Objectives</h2><ul><li>Goal 1: </li><li>Goal 2: </li><li>Goal 3: </li></ul><h2>Scope</h2><p><strong>In scope:</strong> </p><p><strong>Out of scope:</strong> </p><h2>Timeline</h2><p><strong>Start Date:</strong> </p><p><strong>End Date:</strong> </p><h2>Key Milestones</h2><ol><li>Milestone 1 — Date</li><li>Milestone 2 — Date</li></ol><h2>Team &amp; Roles</h2><ul><li><strong>Project Lead:</strong> </li><li><strong>Developer:</strong> </li><li><strong>Designer:</strong> </li></ul><h2>Risks &amp; Mitigations</h2><p>Identify potential risks and how to address them.</p>`
      },
      {
        icon: "📊", title: "Weekly Report",
        desc: "Summarize progress, blockers, and plans for next week",
        content: `<h1>Weekly Report</h1><p><strong>Week of:</strong> ${new Date().toLocaleDateString()}</p><p><strong>Author:</strong> </p><h2>Completed This Week</h2><ul><li>Task 1</li><li>Task 2</li><li>Task 3</li></ul><h2>In Progress</h2><ul><li>Task — Expected completion: </li></ul><h2>Blockers</h2><ul><li>Blocker description — <em>Impact / Needed resolution</em></li></ul><h2>Plan for Next Week</h2><ol><li>Priority 1</li><li>Priority 2</li><li>Priority 3</li></ol><h2>Highlights &amp; Wins</h2><p>Share any notable achievements or positive outcomes.</p>`
      },
      {
        icon: "✅", title: "To-Do List",
        desc: "Organize tasks by category and priority",
        content: `<h1>To-Do List</h1><p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p><h2>🔴 High Priority</h2><ul><li>Task 1</li><li>Task 2</li></ul><h2>🟡 Medium Priority</h2><ul><li>Task 1</li><li>Task 2</li></ul><h2>🟢 Low Priority</h2><ul><li>Task 1</li><li>Task 2</li></ul><h2>📌 Notes</h2><p>Additional context or reminders...</p>`
      },
      {
        icon: "✍️", title: "Blog Post",
        desc: "Draft a blog article with introduction and sections",
        content: `<h1>Blog Post Title</h1><p><em>By [Author Name] · ${new Date().toLocaleDateString()}</em></p><h2>Introduction</h2><p>Hook your reader with a compelling opening paragraph that sets up the topic and explains why it matters.</p><h2>Background</h2><p>Provide context the reader needs to understand the rest of the article.</p><h2>Main Point 1</h2><p>Elaborate on your first key idea with supporting details, examples, or data.</p><h2>Main Point 2</h2><p>Develop your second argument or perspective.</p><h2>Conclusion</h2><p>Summarize the key takeaways and include a call to action.</p>`
      },
      {
        icon: "🐛", title: "Bug Report",
        desc: "Document bugs with steps to reproduce and expected behavior",
        content: `<h1>Bug Report</h1><p><strong>Reported by:</strong> </p><p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p><p><strong>Severity:</strong> 🔴 Critical / 🟡 Medium / 🟢 Low</p><h2>Summary</h2><p>Brief description of the bug.</p><h2>Steps to Reproduce</h2><ol><li>Step 1</li><li>Step 2</li><li>Step 3</li></ol><h2>Expected Behavior</h2><p>What should happen.</p><h2>Actual Behavior</h2><p>What actually happens.</p><h2>Environment</h2><ul><li><strong>Browser:</strong> </li><li><strong>OS:</strong> </li><li><strong>Version:</strong> </li></ul><h2>Screenshots / Logs</h2><p>Attach any relevant screenshots or error logs.</p>`
      }
    ];

    function wireTemplateButtons(quillInstance) {
      const modal = document.getElementById("template-modal");
      const grid = document.getElementById("template-modal-grid");
      const closeBtn = document.getElementById("template-modal-close");
      if (!modal || !grid) return;

      // Build template cards
      grid.innerHTML = "";
      TEMPLATES.forEach((tpl) => {
        const card = document.createElement("div");
        card.className = "template-card";
        card.innerHTML = `<div class="template-card-icon">${tpl.icon}</div><div class="template-card-title">${tpl.title}</div><div class="template-card-desc">${tpl.desc}</div>`;
        card.addEventListener("click", () => {
          if (quillInstance) {
            const hasContent = quillInstance.getText().trim().length > 0;
            let action = "replace";
            if (hasContent) {
              const choice = window.prompt(
                `Your document has existing content.\n\nType "replace" to replace it, or "append" to add the template at the end.\n\nOr click Cancel to go back.`,
                "append"
              );
              if (choice === null) return;
              action = choice.trim().toLowerCase() === "replace" ? "replace" : "append";
            }
            if (action === "replace") {
              quillInstance.clipboard.dangerouslyPasteHTML(tpl.content);
            } else {
              const len = quillInstance.getLength();
              quillInstance.clipboard.dangerouslyPasteHTML(len - 1, "<br><br>" + tpl.content);
            }
            if (titleInput && action === "replace") titleInput.value = tpl.title;
            if (action === "replace") setTopbarTitle(tpl.title);
            setMessage(statusElId, `Template "${tpl.title}" ${action === "replace" ? "applied" : "appended"}`, "ok");
          }
          modal.style.display = "none";
        });
        grid.appendChild(card);
      });

      // Close button
      if (closeBtn) closeBtn.addEventListener("click", () => { modal.style.display = "none"; });
      // Click outside to close
      modal.addEventListener("click", (e) => { if (e.target === modal) modal.style.display = "none"; });

      // Wire the sidebar "Browse templates" button
      document.querySelectorAll(".template-item").forEach((btn) => {
        btn.addEventListener("click", () => {
          const label = btn.textContent.trim().toLowerCase();
          if (label.includes("browse")) {
            modal.style.display = "flex";
          } else if (label.includes("import")) {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".txt,.html,.md,.doc,.docx";
            input.addEventListener("change", () => {
              if (input.files && input.files[0]) {
                const file = input.files[0];
                const reader = new FileReader();
                reader.onload = (e) => {
                  const content = e.target.result;
                  if (quillInstance) {
                    quillInstance.clipboard.dangerouslyPasteHTML(content);
                    setMessage(statusElId, `Imported "${file.name}"`, "ok");
                  }
                };
                reader.readAsText(file);
              }
            });
            input.click();
          }
        });
      });
    }

    function renderSidebarDocs(docs) {
      if (!myDocsList) return;
      myDocsList.innerHTML = "";
      const colorClass = ["i-accent", "i-coral", "i-teal", "i-amber"];

      docs.forEach((doc, index) => {
        const item = document.createElement("button");
        item.className = `doc-item${doc.documentId === docId ? " current" : ""}`;
        item.setAttribute("type", "button");

        const left = document.createElement("span");
        left.className = "left";
        const dot = document.createElement("span");
        dot.className = `dot ${colorClass[index % colorClass.length]}`;
        const label = document.createElement("span");
        label.textContent = doc.title || "Untitled Document";
        left.append(dot, label);
        item.appendChild(left);

        item.addEventListener("click", () => {
          window.location.href = `editor.html?docId=${doc.documentId}`;
        });

        myDocsList.appendChild(item);
      });
    }

    async function loadSidebarDocs() {
      if (!myDocsList) return;
      try {
        const docs = await apiRequest(`/api/documents?createdBy=${encodeURIComponent(user.email)}`);
        renderSidebarDocs(docs);
        // Update "All Documents" count badge dynamically
        const allDocsItem = workspaceNav?.querySelector('[data-nav="all-docs"] .count-badge');
        if (allDocsItem) allDocsItem.textContent = String(docs.length);
      } catch (_error) {
        myDocsList.innerHTML = '<button class="doc-item current" type="button"><span class="left"><span class="dot i-accent"></span>Current Document</span></button>';
      }
    }

    if (newDocBtn) {
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
          setMessage(statusElId, error.message, "error");
        }
      });
    }

    wireWorkspaceNav();
    await loadSidebarDocs();

    const shareLinkBtn = document.getElementById("share-link-btn");
    if (shareLinkBtn) {
      shareLinkBtn.addEventListener("click", async () => {
        try {
          const shareUrl = window.location.href;
          await navigator.clipboard.writeText(shareUrl);
          
          const originalText = shareLinkBtn.textContent;
          shareLinkBtn.textContent = "Copied!";
          shareLinkBtn.style.backgroundColor = "var(--teal)";
          shareLinkBtn.style.color = "#fff";
          shareLinkBtn.style.borderColor = "var(--teal)";
          
          setTimeout(() => {
            shareLinkBtn.textContent = originalText;
            shareLinkBtn.style = ""; // Reset inline styles
          }, 2000);
          
          setMessage(statusElId, "Link copied to clipboard!", "ok");
        } catch (err) {
          setMessage(statusElId, "Failed to copy link", "error");
        }
      });
    }

    if (statusPill) {
      statusPill.setAttribute("role", "button");
      statusPill.setAttribute("title", "Click to toggle status");
      statusPill.style.cursor = "pointer";
      statusPill.addEventListener("click", () => {
        const isPublished = statusPill.classList.contains("published");
        statusPill.classList.toggle("published", !isPublished);
        statusPill.classList.toggle("draft", isPublished);
        statusPill.textContent = isPublished ? "Draft" : "Published";
      });
    }

    const rightPanelToggle = document.getElementById("toggle-right-panel");
    if (rightPanelToggle) {
      rightPanelToggle.addEventListener("click", () => {
        const shell = document.querySelector(".portal-shell");
        if (shell) {
          shell.classList.toggle("right-collapsed");
        }
      });
    }

    const rightResizer = document.getElementById("right-resizer");
    if (rightResizer) {
      let isResizing = false;
      const portalShell = document.querySelector(".portal-shell");
      
      rightResizer.addEventListener("mousedown", (e) => {
        isResizing = true;
        rightResizer.classList.add("dragging");
        // Disable text selection globally while dragging
        document.body.style.userSelect = "none";
      });

      document.addEventListener("mousemove", (e) => {
        if (!isResizing) return;
        // Calculate new right panel width based on mouse X position
        // Assuming the grid is at the edge of the window
        // Panel width = window width - mouseX
        let newWidth = window.innerWidth - e.clientX;
        
        // Enforce min and max widths
        const minWidth = 180;
        const maxWidth = 500;
        
        if (newWidth < minWidth) newWidth = minWidth;
        if (newWidth > maxWidth) newWidth = maxWidth;
        
        portalShell.style.setProperty("--right-panel-width", `${newWidth}px`);
      });

      document.addEventListener("mouseup", () => {
        if (isResizing) {
          isResizing = false;
          rightResizer.classList.remove("dragging");
          document.body.style.userSelect = "";
        }
      });
    }

    const FontFormat = Quill.import("formats/font");
    FontFormat.whitelist = ["serif", "monospace", "roboto", "merriweather", "playfair", "courier"];
    Quill.register(FontFormat, true);

    const quill = new Quill("#editor", {
      theme: "snow",
      modules: {
        toolbar: "#toolbar-container",
        history: {
          delay: 300,
          maxStack: 100,
          userOnly: true
        }
      }
    });

    quill.disable();
    setAutosaveStatus("Loading...");
    setMessage(statusElId, "Loading document...");
    wireTemplateButtons(quill);

    function rebuildOutline() {
      if (!outlineList) return;
      const headings = Array.from(quill.root.querySelectorAll("h1, h2"));
      outlineList.innerHTML = "";

      if (!headings.length) {
        const empty = document.createElement("button");
        empty.className = "outline-item active";
        empty.textContent = "No headings yet";
        outlineList.appendChild(empty);
        return;
      }

      headings.forEach((heading, index) => {
        const anchorId = `outline-h-${index}`;
        heading.dataset.outlineId = anchorId;

        const entry = document.createElement("button");
        entry.className = `outline-item${heading.tagName === "H2" ? " sub" : ""}`;
        entry.textContent = heading.textContent.trim() || heading.tagName;
        entry.dataset.target = anchorId;
        entry.addEventListener("click", () => {
          heading.scrollIntoView({ behavior: "smooth", block: "center" });
        });
        outlineList.appendChild(entry);
      });
    }

    function syncOutlineActive() {
      if (!outlineList) return;
      const headings = Array.from(quill.root.querySelectorAll("h1, h2"));
      if (!headings.length) return;

      let active = headings[0];
      const threshold = 140;
      headings.forEach((heading) => {
        const rect = heading.getBoundingClientRect();
        if (rect.top <= threshold) {
          active = heading;
        }
      });

      const selectedId = active.dataset.outlineId;
      outlineList.querySelectorAll(".outline-item").forEach((item) => {
        item.classList.toggle("active", item.dataset.target === selectedId);
      });
    }

    const undoBtn = document.querySelector(".ql-undo");
    const redoBtn = document.querySelector(".ql-redo");
    if (undoBtn) {
      undoBtn.addEventListener("click", () => quill.history.undo());
    }
    if (redoBtn) {
      redoBtn.addEventListener("click", () => quill.history.redo());
    }

    if (editorScroll) {
      editorScroll.addEventListener("scroll", syncOutlineActive);
    }

    titleInput.addEventListener("input", () => {
      setTopbarTitle(titleInput.value);
      setAutosaveStatus("Unsaved changes");
    });

    if (shareBtn) {
      shareBtn.addEventListener("click", async () => {
        const shareUrl = `${window.location.origin}${window.location.pathname}?docId=${encodeURIComponent(docId)}`;

        try {
          await navigator.clipboard.writeText(shareUrl);
          setMessage(statusElId, "Share link copied", "ok");
        } catch (_error) {
          window.prompt("Copy this link:", shareUrl);
        }
      });
    }

    if (commentBtn) {
      commentBtn.addEventListener("click", () => {
        if (chatInput) chatInput.focus();
      });
    }

    async function refreshDocumentMeta() {
      try {
        const freshDoc = await apiRequest(`/api/documents/${docId}?userEmail=${encodeURIComponent(user.email)}`);
        renderCollaborators(freshDoc);
      } catch (_error) {
        // Ignore metadata refresh errors to avoid interrupting editing.
      }
    }

    if (addUserBtn) {
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
          await refreshDocumentMeta();
        } catch (error) {
          setMessage(statusElId, error.message, "error");
        }
      });
    }

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
      setTopbarTitle(title);
      quill.enable();
      setAutosaveStatus("Active");
      setMessage(statusElId, "Connected. Real-time sync is active.", "ok");
      rebuildOutline();
      syncOutlineActive();
    });

    socket.on("receive-changes", (delta) => {
      quill.updateContents(delta, "silent");
      rebuildOutline();
      syncOutlineActive();
    });

    socket.on("presence-update", ({ message }) => {
      if (!message) return;
      setMessage(statusElId, message, "ok");
      setTimeout(() => {
        setMessage(statusElId, "Connected. Real-time sync is active.", "ok");
      }, 1800);
    });

    // ── Live Chat via Socket ──
    socket.on("receive-chat", (msg) => {
      appendChatBubble(msg);
    });

    if (chatSendBtn) {
      chatSendBtn.addEventListener("click", () => sendChatMessage(socket));
    }
    if (chatInput) {
      chatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          sendChatMessage(socket);
        }
      });
    }

    quill.on("text-change", (delta, _oldDelta, source) => {
      if (source !== "user") return;
      socket.emit("send-changes", { docId, delta });
      setAutosaveStatus("Unsaved changes");
      rebuildOutline();
      syncOutlineActive();
    });

    try {
      const initialDoc = await apiRequest(`/api/documents/${docId}?userEmail=${encodeURIComponent(user.email)}`);
      setTopbarTitle(initialDoc.title || "Untitled Document");
      setLastEdited(initialDoc.updatedAt || initialDoc.createdAt);
      renderCollaborators(initialDoc);
      pushVersion(initialDoc.createdBy || currentUserLabel, initialDoc.updatedAt || initialDoc.createdAt);
    } catch (error) {
      if (!error.message.toLowerCase().includes("not found")) {
        setMessage(statusElId, error.message, "error");
      }
    }

    async function saveDocument({ manual = false } = {}) {
      try {
        setAutosaveStatus("Saving...");

        const payload = {
          title: titleInput.value.trim() || "Untitled Document",
          content: quill.root.innerHTML,
          userEmail: user.email
        };

        const updatedDoc = await apiRequest(`/api/documents/${docId}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });

        socket.emit("save-document", {
          docId,
          userEmail: user.email,
          ...payload
        });

        setLastEdited(updatedDoc?.updatedAt || Date.now());
        setAutosaveStatus("Active");
        setMessage(statusElId, `Saved at ${new Date().toLocaleTimeString()}`, "ok");
        pushVersion(currentUserLabel, updatedDoc?.updatedAt || Date.now());
        if (manual) {
          showSaveConfirmation();
        }
      } catch (error) {
        setAutosaveStatus("Error");
        setMessage(statusElId, `Save failed: ${error.message}`, "error");
      }
    }

    const intervalId = setInterval(() => {
      saveDocument({ manual: false });
    }, AUTO_SAVE_MS);

    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        saveDocument({ manual: true });
      });
    }

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
