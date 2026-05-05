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
    let value = (user ?.displayName || "").trim();

    if (!value && user ?.email) {
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
        .map((part) => part[0] ?.toUpperCase() || "")
        .join("") || "U";

    initialsEls.forEach((el) => {
        el.textContent = initials;
    });
}

function attachLogout() {
    document.querySelectorAll(".js-logout-btn").forEach((btn) => {
        btn.addEventListener("click", async() => {
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
    form.addEventListener("submit", async(event) => {
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
    form.addEventListener("submit", async(event) => {
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

const DASHBOARD_STORAGE_KEYS = {
    theme: "syncdocs-dashboard-theme",
    starredDocs: "syncdocs-starred-docs"
};

function readJsonFromStorage(key, fallback) {
    try {
        const rawValue = window.localStorage.getItem(key);
        if (!rawValue) return fallback;
        const parsed = JSON.parse(rawValue);
        return parsed ?? fallback;
    } catch (_error) {
        return fallback;
    }
}

function writeJsonToStorage(key, value) {
    try {
        window.localStorage.setItem(key, JSON.stringify(value));
    } catch (_error) {
        // Ignore storage failures in private browsing or blocked storage modes.
    }
}

function formatRelativeTime(dateValue) {
    const date = new Date(dateValue);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

function getStarredDocIds() {
    const values = readJsonFromStorage(DASHBOARD_STORAGE_KEYS.starredDocs, []);
    return Array.isArray(values) ? values.filter((value) => typeof value === "string") : [];
}

function setStarredDocIds(docIds) {
    writeJsonToStorage(DASHBOARD_STORAGE_KEYS.starredDocs, Array.from(new Set(docIds)));
}

function getDashboardTheme() {
    const storedTheme = window.localStorage.getItem(DASHBOARD_STORAGE_KEYS.theme);
    return storedTheme === "dark" ? "dark" : "light";
}

function applyDashboardTheme(theme) {
    const safeTheme = theme === "dark" ? "dark" : "light";
    document.body.dataset.theme = safeTheme;
    writeJsonToStorage(DASHBOARD_STORAGE_KEYS.theme, safeTheme);

    const desktopThemeBtn = document.getElementById("theme-toggle");
    const mobileThemeBtn = document.getElementById("mobile-theme-btn");
    if (desktopThemeBtn) {
        desktopThemeBtn.title = safeTheme === "dark" ? "Switch to light mode" : "Switch to dark mode";
        desktopThemeBtn.setAttribute("aria-pressed", String(safeTheme === "dark"));
    }
    if (mobileThemeBtn) {
        mobileThemeBtn.setAttribute("aria-pressed", String(safeTheme === "dark"));
    }
}

function createDocCard(doc, options = {}) {
    const { onRename, onCopyLink, onDelete, onToggleStar, index = 0, isStarred = false } = options;
    const row = document.createElement("div");
    row.className = "doc-row";
    row.style.setProperty("--row-index", String(index));
    const colorIndex = index % 6;

    row.innerHTML = `
    <div class="doc-icon doc-icon-${colorIndex}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
    </div>
    <div class="doc-info">
      <span class="doc-name">${doc.title || "Untitled Document"}</span>
      <span class="doc-time">Edited ${formatRelativeTime(doc.updatedAt || doc.createdAt)}</span>
    </div>
    <div class="doc-row-actions">
      <button class="doc-action star ${isStarred ? "active" : ""}" data-action="star" data-tooltip="${isStarred ? "Unstar" : "Star"}" aria-pressed="${isStarred ? "true" : "false"}">
        <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      </button>
      <button class="doc-action" data-action="open" data-tooltip="Open">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      </button>
      <button class="doc-action" data-action="rename" data-tooltip="Rename">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button class="doc-action" data-action="copy-link" data-tooltip="Copy link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
      </button>
      <button class="doc-action danger" data-action="delete" data-tooltip="Delete">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>
    </div>
  `;

    // Clicking the row opens the document
    row.addEventListener("click", (e) => {
        // Don't navigate if an action button was clicked
        if (e.target.closest(".doc-action")) return;
        window.location.href = `editor.html?docId=${doc.documentId}`;
    });

    row.querySelector('[data-action="star"]').addEventListener("click", async(e) => {
        e.stopPropagation();
        if (!onToggleStar) return;
        await onToggleStar(doc);
    });

    row.querySelector('[data-action="open"]').addEventListener("click", (e) => {
        e.stopPropagation();
        window.location.href = `editor.html?docId=${doc.documentId}`;
    });

    row.querySelector('[data-action="rename"]').addEventListener("click", async(e) => {
        e.stopPropagation();
        if (!onRename) return;
        await onRename(doc);
    });

    row.querySelector('[data-action="copy-link"]').addEventListener("click", async(e) => {
        e.stopPropagation();
        if (!onCopyLink) return;
        await onCopyLink(doc);
    });

    row.querySelector('[data-action="delete"]').addEventListener("click", async(e) => {
        e.stopPropagation();
        if (!onDelete) return;
        await onDelete(doc);
    });

    return row;
}

function setupDashboard() {
    protectRoute(async(user) => {
        const docListEl = document.getElementById("doc-list");
        const newDocBtn = document.getElementById("new-doc-btn");
        const refreshDocsBtn = document.getElementById("refresh-docs-btn");
        const backBtn = document.getElementById("dashboard-back-btn");
        const searchTriggerBtn = document.getElementById("search-trigger");
        const searchOverlay = document.getElementById("search-overlay");
        const searchInput = document.getElementById("search-input");
        const searchResults = document.getElementById("search-results");
        const themeToggleBtn = document.getElementById("theme-toggle");
        const mobileThemeBtn = document.getElementById("mobile-theme-btn");
        const mobileMenuBtn = document.getElementById("mobile-menu-btn");
        const mobileNav = document.getElementById("mobile-nav");
        const profileDropdownWrap = document.getElementById("profile-dropdown-wrap");
        const userPillBtn = document.getElementById("user-pill-btn");
        const profileDropdown = document.getElementById("profile-dropdown");
        const sortDropdownWrap = document.getElementById("sort-dropdown-wrap");
        const sortBtn = document.getElementById("sort-btn");
        const sortDropdown = document.getElementById("sort-dropdown");
        const shortcutsBtn = document.getElementById("shortcuts-btn");
        const shortcutsOverlay = document.getElementById("shortcuts-overlay");
        const shortcutsCloseBtn = document.getElementById("shortcuts-close");
        const confirmOverlay = document.getElementById("confirm-overlay");
        const confirmCancelBtn = document.getElementById("confirm-cancel");
        const confirmOkBtn = document.getElementById("confirm-ok");
        const confirmTitleEl = document.getElementById("confirm-title");
        const confirmDescEl = document.getElementById("confirm-desc");
        const docCountEl = document.querySelector(".js-doc-count");
        const totalDocsEl = document.querySelector(".js-total-docs");
        const starredDocsEl = document.querySelector(".js-starred-docs");
        const recentDocsEl = document.querySelector(".js-recent-docs");
        const lastActivityEl = document.querySelector(".js-last-activity");
        const filterTabs = Array.from(document.querySelectorAll(".toolbar-tab"));

        const state = {
            docs: [],
            filter: "all",
            sort: "date-desc",
            searchQuery: "",
            starredDocs: new Set(getStarredDocIds()),
            theme: getDashboardTheme()
        };

        let pendingConfirm = null;

        function openOverlay(overlayElement) {
            if (!overlayElement) return;
            overlayElement.classList.add("is-open");
            document.body.classList.add("dashboard-modal-open");
        }

        function closeOverlay(overlayElement) {
            if (!overlayElement) return;
            overlayElement.classList.remove("is-open");
            if (!document.querySelector(".is-open")) {
                document.body.classList.remove("dashboard-modal-open");
            }
        }

        function setPanelOpen(panel, isOpen) {
            if (!panel) return;
            panel.classList.toggle("is-open", Boolean(isOpen));
        }

        function setActiveFilter(filterName) {
            state.filter = filterName;
            filterTabs.forEach((tab) => {
                tab.classList.toggle("active", tab.dataset.filter === filterName);
            });
            renderDashboard();
        }

        function sortDocuments(documents) {
            const ordered = [...documents];

            ordered.sort((firstDoc, secondDoc) => {
                const firstTime = new Date(firstDoc.updatedAt || firstDoc.createdAt).getTime();
                const secondTime = new Date(secondDoc.updatedAt || secondDoc.createdAt).getTime();
                const firstTitle = (firstDoc.title || "").toLowerCase();
                const secondTitle = (secondDoc.title || "").toLowerCase();

                switch (state.sort) {
                    case "date-asc":
                        return firstTime - secondTime;
                    case "name-asc":
                        return firstTitle.localeCompare(secondTitle);
                    case "name-desc":
                        return secondTitle.localeCompare(firstTitle);
                    case "date-desc":
                    default:
                        return secondTime - firstTime;
                }
            });

            return ordered;
        }

        function getVisibleDocuments() {
            const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
            let documents = [...state.docs];

            if (state.filter === "recent") {
                documents = documents.filter((doc) => new Date(doc.updatedAt || doc.createdAt).getTime() >= sevenDaysAgo);
            }

            if (state.filter === "starred") {
                documents = documents.filter((doc) => state.starredDocs.has(doc.documentId));
            }

            return sortDocuments(documents);
        }

        function updateSummary() {
            const totalCount = state.docs.length;
            const recentCount = state.docs.filter((doc) => new Date(doc.updatedAt || doc.createdAt).getTime() >= Date.now() - 7 * 24 * 60 * 60 * 1000).length;
            const latestDoc = [...state.docs].sort((firstDoc, secondDoc) => new Date(secondDoc.updatedAt || secondDoc.createdAt) - new Date(firstDoc.updatedAt || firstDoc.createdAt))[0];

            if (docCountEl) {
                docCountEl.textContent = totalCount ?
                    `${totalCount} document${totalCount !== 1 ? "s" : ""}` :
                    "No documents yet";
            }

            if (totalDocsEl) totalDocsEl.textContent = String(totalCount);
            if (starredDocsEl) starredDocsEl.textContent = String(state.starredDocs.size);
            if (recentDocsEl) recentDocsEl.textContent = String(recentCount);
            if (lastActivityEl) {
                lastActivityEl.textContent = latestDoc ?
                    formatRelativeTime(latestDoc.updatedAt || latestDoc.createdAt) :
                    "No activity yet";
            }
        }

        function renderSearchResults() {
            if (!searchResults) return;

            const query = (state.searchQuery || "").trim().toLowerCase();
            const matches = !query ?
                sortDocuments(state.docs).slice(0, 8) :
                sortDocuments(state.docs.filter((doc) => (doc.title || "").toLowerCase().includes(query))).slice(0, 8);

            searchResults.innerHTML = "";

            if (!matches.length) {
                const empty = document.createElement("div");
                empty.className = "search-empty";
                empty.textContent = query ? "No matching documents found" : "Type to search your documents...";
                searchResults.appendChild(empty);
                return;
            }

            matches.forEach((doc) => {
                const item = document.createElement("button");
                item.type = "button";
                item.className = "search-result-item";
                item.innerHTML = `
          <span class="search-result-title">${doc.title || "Untitled Document"}</span>
          <span class="search-result-meta">Edited ${formatRelativeTime(doc.updatedAt || doc.createdAt)}</span>
        `;
                item.addEventListener("click", () => {
                    window.location.href = `editor.html?docId=${doc.documentId}`;
                });
                searchResults.appendChild(item);
            });
        }

        function createLoadingSkeleton() {
            const row = document.createElement("div");
            row.className = "skeleton-card";
            return row;
        }

        function showLoadingSkeletons() {
            docListEl.innerHTML = "";
            for (let i = 0; i < 4; i++) {
                docListEl.appendChild(createLoadingSkeleton());
            }
        }

        function renderActivityFeed() {
            const activityFeed = document.getElementById("activity-feed");
            if (!activityFeed || !state.docs.length) {
                if (activityFeed) {
                    activityFeed.innerHTML = `
            <div class="search-empty" style="padding: 24px; text-align: center;">
              <div style="font-size: 14px; color: var(--ink-muted);">No activity yet</div>
            </div>`;
                }
                return;
            }

            // Sort docs by update time and take last 6
            const recentDocs = [...state.docs]
                .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
                .slice(0, 6);

            activityFeed.innerHTML = recentDocs.map((doc) => `
        <div class="activity-item">
          <div class="activity-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <div class="activity-content">
            <div class="activity-title" title="${doc.title || 'Untitled Document'}">${(doc.title || 'Untitled Document').substring(0, 40)}</div>
            <div class="activity-time">Updated ${formatRelativeTime(doc.updatedAt || doc.createdAt)}</div>
          </div>
        </div>
      `).join("");
        }

        function renderDashboard() {
            const visibleDocs = getVisibleDocuments();
            docListEl.innerHTML = "";

            if (!visibleDocs.length) {
                const emptyState = document.createElement("div");
                emptyState.className = "empty-state";
                emptyState.innerHTML = state.filter === "all" ? `
          <div class="empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <p class="empty-title">No documents yet</p>
          <p class="empty-desc">Create your first document to start collaborating. Click "New document" to get started.</p>
        ` : state.filter === "recent" ? `
          <div class="empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <p class="empty-title">No recent documents</p>
          <p class="empty-desc">Documents you've edited in the last 7 days will appear here.</p>
        ` : `
          <div class="empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </div>
          <p class="empty-title">No starred documents</p>
          <p class="empty-desc">Star your favorite documents for quick access. Click the star icon on any document.</p>
        `;
                docListEl.appendChild(emptyState);
                updateSummary();
                renderActivityFeed();
                renderSearchResults();
                return;
            }

            visibleDocs.forEach((doc, index) => {
                docListEl.appendChild(
                    createDocCard(doc, {
                        index,
                        isStarred: state.starredDocs.has(doc.documentId),
                        onToggleStar: async(targetDoc) => {
                            if (state.starredDocs.has(targetDoc.documentId)) {
                                state.starredDocs.delete(targetDoc.documentId);
                            } else {
                                state.starredDocs.add(targetDoc.documentId);
                            }

                            setStarredDocIds([...state.starredDocs]);
                            renderDashboard();
                            setMessage("dashboard-message", state.starredDocs.has(targetDoc.documentId) ? "✨ Added to starred" : "⭐ Removed from starred", "ok");
                        },
                        onRename: async(targetDoc) => {
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

                            setMessage("dashboard-message", "✏️ Document renamed", "ok");
                            await loadDocuments();
                        },
                        onCopyLink: async(targetDoc) => {
                            const shareUrl = `${window.location.origin}${window.location.pathname.replace("dashboard.html", "editor.html")}?docId=${encodeURIComponent(targetDoc.documentId)}`;

                            try {
                                await navigator.clipboard.writeText(shareUrl);
                                setMessage("dashboard-message", "🔗 Document link copied", "ok");
                            } catch (_error) {
                                window.prompt("Copy this link:", shareUrl);
                            }
                        },
                        onDelete: async(targetDoc) => {
                            const confirmed = await requestConfirm({
                                title: "Delete document?",
                                description: `Delete \"${targetDoc.title || "Untitled Document"}\"? This cannot be undone.`,
                                confirmText: "Delete"
                            });

                            if (!confirmed) return;

                            await apiRequest(
                                `/api/documents/${targetDoc.documentId}?requesterEmail=${encodeURIComponent(user.email)}`, { method: "DELETE" }
                            );

                            state.starredDocs.delete(targetDoc.documentId);
                            setStarredDocIds([...state.starredDocs]);
                            setMessage("dashboard-message", "🗑️ Document deleted", "ok");
                            await loadDocuments();
                        }
                    })
                );
            });

            updateSummary();
            renderActivityFeed();
            renderSearchResults();
        }

        function setSort(sortMode) {
            state.sort = sortMode;
            sortDropdown ?.querySelectorAll(".sort-option").forEach((option) => {
                option.classList.toggle("active", option.dataset.sort === sortMode);
            });
            renderDashboard();
        }

        function toggleTheme() {
            state.theme = state.theme === "dark" ? "light" : "dark";
            applyDashboardTheme(state.theme);
        }

        function openSearch() {
            if (!searchOverlay) return;
            state.searchQuery = "";
            renderSearchResults();
            openOverlay(searchOverlay);
            window.setTimeout(() => {
                searchInput ?.focus();
            }, 0);
        }

        function closeSearch() {
            closeOverlay(searchOverlay);
            if (searchInput) searchInput.value = "";
            state.searchQuery = "";
        }

        function openShortcuts() {
            openOverlay(shortcutsOverlay);
        }

        function closeShortcuts() {
            closeOverlay(shortcutsOverlay);
        }

        function closeProfileDropdown() {
            profileDropdown ?.classList.remove("is-open");
        }

        function closeSortDropdown() {
            sortDropdown ?.classList.remove("is-open");
        }

        function closeMobileNav() {
            mobileNav ?.classList.remove("is-open");
        }

        function closeAllPanels() {
            closeSearch();
            closeShortcuts();
            closeProfileDropdown();
            closeSortDropdown();
            closeMobileNav();
            if (pendingConfirm) {
                resolveConfirm(false);
            } else {
                closeOverlay(confirmOverlay);
            }

            confirmTitleEl.textContent = title;
            confirmDescEl.textContent = description;
            confirmOkBtn.textContent = confirmText;

            openOverlay(confirmOverlay);

            return new Promise((resolve) => {
                pendingConfirm = resolve;
            });
        }

        function resolveConfirm(choice) {
            if (pendingConfirm) {
                pendingConfirm(choice);
                pendingConfirm = null;
            }
            closeOverlay(confirmOverlay);
        }

        async function loadDocuments() {
            try {
                showLoadingSkeletons();
                const docs = await apiRequest(`/api/documents?createdBy=${encodeURIComponent(user.email)}`);
                state.docs = Array.isArray(docs) ? docs : [];

                if (docCountEl) {
                    docCountEl.textContent = state.docs.length ?
                        `${state.docs.length} document${state.docs.length !== 1 ? "s" : ""}` :
                        "No documents yet";
                }

                renderDashboard();
            } catch (error) {
                docListEl.innerHTML = "";
                setMessage("dashboard-message", error.message, "error");
            }
        }

        if (backBtn) {
            backBtn.addEventListener("click", () => {
                if (window.history.length > 1) {
                    window.history.back();
                    return;
                }

                window.location.href = "landing.html";
            });
        }

        if (searchTriggerBtn) {
            searchTriggerBtn.addEventListener("click", openSearch);
        }

        if (themeToggleBtn) {
            themeToggleBtn.addEventListener("click", toggleTheme);
        }

        if (mobileThemeBtn) {
            mobileThemeBtn.addEventListener("click", () => {
                toggleTheme();
                closeMobileNav();
            });
        }

        if (mobileMenuBtn) {
            mobileMenuBtn.addEventListener("click", () => {
                mobileNav ?.classList.toggle("is-open");
            });
        }

        if (userPillBtn) {
            userPillBtn.addEventListener("click", (event) => {
                event.stopPropagation();
                profileDropdown ?.classList.toggle("is-open");
                closeSortDropdown();
            });
        }

        if (sortBtn) {
            sortBtn.addEventListener("click", (event) => {
                event.stopPropagation();
                sortDropdown ?.classList.toggle("is-open");
                closeProfileDropdown();
            });
        }

        if (shortcutsBtn) {
            shortcutsBtn.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                openShortcuts();
                closeProfileDropdown();
            });
        }

        if (shortcutsCloseBtn) {
            shortcutsCloseBtn.addEventListener("click", closeShortcuts);
        }

        if (searchOverlay) {
            searchOverlay.addEventListener("click", (event) => {
                if (event.target === searchOverlay) {
                    closeSearch();
                }
            });
        }

        if (shortcutsOverlay) {
            shortcutsOverlay.addEventListener("click", (event) => {
                if (event.target === shortcutsOverlay) {
                    closeShortcuts();
                }
            });
        }

        if (confirmOverlay) {
            confirmOverlay.addEventListener("click", (event) => {
                if (event.target === confirmOverlay) {
                    resolveConfirm(false);
                }
            });
        }

        if (confirmCancelBtn) {
            confirmCancelBtn.addEventListener("click", () => resolveConfirm(false));
        }

        if (confirmOkBtn) {
            confirmOkBtn.addEventListener("click", () => resolveConfirm(true));
        }

        if (searchInput) {
            searchInput.addEventListener("input", () => {
                state.searchQuery = searchInput.value;
                renderSearchResults();
            });

            searchInput.addEventListener("keydown", (event) => {
                if (event.key === "Escape") {
                    closeSearch();
                }
            });
        }

        if (sortDropdown) {
            sortDropdown.querySelectorAll(".sort-option").forEach((option) => {
                option.addEventListener("click", () => {
                    setSort(option.dataset.sort || "date-desc");
                    closeSortDropdown();
                });
            });
        }

        if (filterTabs.length) {
            filterTabs.forEach((tab) => {
                tab.addEventListener("click", () => {
                    setActiveFilter(tab.dataset.filter || "all");
                });
            });
        }

        if (docListEl) {
            docListEl.addEventListener("click", (event) => {
                if (!event.target.closest(".doc-action")) {
                    closeAllPanels();
                }
            });
        }

        document.addEventListener("click", (event) => {
            if (profileDropdownWrap && !profileDropdownWrap.contains(event.target)) {
                closeProfileDropdown();
            }
            if (sortDropdownWrap && !sortDropdownWrap.contains(event.target)) {
                closeSortDropdown();
            }
            if (mobileMenuBtn && !mobileMenuBtn.contains(event.target) && mobileNav && !mobileNav.contains(event.target)) {
                closeMobileNav();
            }
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                closeAllPanels();
            }

            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
                event.preventDefault();
                openSearch();
            }

            if (event.key === "?" && !event.metaKey && !event.ctrlKey && !event.altKey) {
                event.preventDefault();
                openShortcuts();
            }

            if (event.key.toLowerCase() === "n" && !event.metaKey && !event.ctrlKey && !event.altKey) {
                if (document.activeElement && ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
                    return;
                }

                event.preventDefault();
                newDocBtn ?.click();
            }

            if (event.key.toLowerCase() === "r" && !event.metaKey && !event.ctrlKey && !event.altKey) {
                if (document.activeElement && ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
                    return;
                }

                event.preventDefault();
                refreshDocsBtn ?.click();
            }

            if (event.key.toLowerCase() === "d" && !event.metaKey && !event.ctrlKey && !event.altKey) {
                if (document.activeElement && ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
                    return;
                }

                event.preventDefault();
                toggleTheme();
            }
        });

        if (refreshDocsBtn) {
            refreshDocsBtn.addEventListener("click", async() => {
                refreshDocsBtn.disabled = true;
                const originalText = refreshDocsBtn.innerHTML;
                refreshDocsBtn.textContent = "Refreshing...";
                await loadDocuments();
                refreshDocsBtn.innerHTML = originalText;
                refreshDocsBtn.disabled = false;
                setMessage("dashboard-message", "Documents refreshed", "ok");
            });
        }

        async function loadDocuments() {
            try {
                docListEl.innerHTML = "";

                const docs = await apiRequest(`/api/documents?createdBy=${encodeURIComponent(user.email)}`);
                state.docs = Array.isArray(docs) ? docs : [];
                renderDashboard();
            } catch (error) {
                setMessage("dashboard-message", error.message, "error");
            }
        }

        newDocBtn.addEventListener("click", async() => {
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

        const activityRefreshBtn = document.getElementById("activity-refresh-btn");
        if (activityRefreshBtn) {
            activityRefreshBtn.addEventListener("click", async() => {
                activityRefreshBtn.style.transform = "rotate(180deg)";
                activityRefreshBtn.style.transition = "transform 600ms cubic-bezier(0.34, 1.56, 0.64, 1)";

                await loadDocuments();

                window.setTimeout(() => {
                    activityRefreshBtn.style.transform = "rotate(0deg)";
                }, 600);
            });
        }

        applyDashboardTheme(state.theme);
        setSort(state.sort);
        renderSearchResults();

        await loadDocuments();
    });
}

function setupEditor() {
    protectRoute(async(user) => {
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

            const allUsers = Array.from(new Set([doc ?.createdBy, ...(doc ?.allowedUsers || [])].filter(Boolean)));
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

        const TEMPLATES = [{
                icon: "📋",
                title: "Meeting Notes",
                desc: "Structured agenda, attendees, and action items",
                content: `<h1>Meeting Notes</h1><p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p><p><strong>Attendees:</strong> </p><h2>Agenda</h2><ol><li>Topic 1</li><li>Topic 2</li><li>Topic 3</li></ol><h2>Discussion</h2><p>Key points discussed during the meeting...</p><h2>Action Items</h2><ul><li><strong>[Owner]</strong> — Task description — <em>Due: </em></li><li><strong>[Owner]</strong> — Task description — <em>Due: </em></li></ul><h2>Next Meeting</h2><p>Date: TBD</p>`
            },
            {
                icon: "🚀",
                title: "Project Brief",
                desc: "Outline goals, scope, timeline, and deliverables",
                content: `<h1>Project Brief</h1><h2>Overview</h2><p>Provide a brief summary of what this project aims to achieve.</p><h2>Goals &amp; Objectives</h2><ul><li>Goal 1: </li><li>Goal 2: </li><li>Goal 3: </li></ul><h2>Scope</h2><p><strong>In scope:</strong> </p><p><strong>Out of scope:</strong> </p><h2>Timeline</h2><p><strong>Start Date:</strong> </p><p><strong>End Date:</strong> </p><h2>Key Milestones</h2><ol><li>Milestone 1 — Date</li><li>Milestone 2 — Date</li></ol><h2>Team &amp; Roles</h2><ul><li><strong>Project Lead:</strong> </li><li><strong>Developer:</strong> </li><li><strong>Designer:</strong> </li></ul><h2>Risks &amp; Mitigations</h2><p>Identify potential risks and how to address them.</p>`
            },
            {
                icon: "📊",
                title: "Weekly Report",
                desc: "Summarize progress, blockers, and plans for next week",
                content: `<h1>Weekly Report</h1><p><strong>Week of:</strong> ${new Date().toLocaleDateString()}</p><p><strong>Author:</strong> </p><h2>Completed This Week</h2><ul><li>Task 1</li><li>Task 2</li><li>Task 3</li></ul><h2>In Progress</h2><ul><li>Task — Expected completion: </li></ul><h2>Blockers</h2><ul><li>Blocker description — <em>Impact / Needed resolution</em></li></ul><h2>Plan for Next Week</h2><ol><li>Priority 1</li><li>Priority 2</li><li>Priority 3</li></ol><h2>Highlights &amp; Wins</h2><p>Share any notable achievements or positive outcomes.</p>`
            },
            {
                icon: "✅",
                title: "To-Do List",
                desc: "Organize tasks by category and priority",
                content: `<h1>To-Do List</h1><p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p><h2>🔴 High Priority</h2><ul><li>Task 1</li><li>Task 2</li></ul><h2>🟡 Medium Priority</h2><ul><li>Task 1</li><li>Task 2</li></ul><h2>🟢 Low Priority</h2><ul><li>Task 1</li><li>Task 2</li></ul><h2>📌 Notes</h2><p>Additional context or reminders...</p>`
            },
            {
                icon: "✍️",
                title: "Blog Post",
                desc: "Draft a blog article with introduction and sections",
                content: `<h1>Blog Post Title</h1><p><em>By [Author Name] · ${new Date().toLocaleDateString()}</em></p><h2>Introduction</h2><p>Hook your reader with a compelling opening paragraph that sets up the topic and explains why it matters.</p><h2>Background</h2><p>Provide context the reader needs to understand the rest of the article.</p><h2>Main Point 1</h2><p>Elaborate on your first key idea with supporting details, examples, or data.</p><h2>Main Point 2</h2><p>Develop your second argument or perspective.</p><h2>Conclusion</h2><p>Summarize the key takeaways and include a call to action.</p>`
            },
            {
                icon: "🐛",
                title: "Bug Report",
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
                const allDocsItem = workspaceNav ?.querySelector('[data-nav="all-docs"] .count-badge');
                if (allDocsItem) allDocsItem.textContent = String(docs.length);
            } catch (_error) {
                myDocsList.innerHTML = '<button class="doc-item current" type="button"><span class="left"><span class="dot i-accent"></span>Current Document</span></button>';
            }
        }

        if (newDocBtn) {
            newDocBtn.addEventListener("click", async() => {
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
            shareLinkBtn.addEventListener("click", async() => {
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
            shareBtn.addEventListener("click", async() => {
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
            addUserBtn.addEventListener("click", async() => {
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
            const content = payload ?.content || "";
            const title = payload ?.title || "Untitled Document";
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

                setLastEdited(updatedDoc ?.updatedAt || Date.now());
                setAutosaveStatus("Active");
                setMessage(statusElId, `Saved at ${new Date().toLocaleTimeString()}`, "ok");
                pushVersion(currentUserLabel, updatedDoc ?.updatedAt || Date.now());
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

