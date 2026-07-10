const tabButtons = Array.from(document.querySelectorAll("[role='tab']"));
const tabPanels = Array.from(document.querySelectorAll("[role='tabpanel']"));
const crumbCurrent = document.getElementById("crumb-current");
const progressBar = document.getElementById("scroll-progress-bar");
const scrollTopLinks = Array.from(document.querySelectorAll("[data-scroll-top]"));
const tabsSection = document.getElementById("tabs");
const gallerySearch = document.getElementById("gallery-search");
const galleryGrid = document.getElementById("gallery-grid");
const galleryLightbox = document.getElementById("gallery-lightbox");
const galleryLightboxImage = document.getElementById("gallery-lightbox-image");
const galleryLightboxCaption = document.getElementById("gallery-lightbox-caption");
const galleryLightboxClose = Array.from(document.querySelectorAll("[data-lightbox-close]"));
const siteContent = window.PORTFOLIO_CONTENT || {
  updates: [],
  articles: [],
  projects: [],
  gallery: [],
};
let contentLoadPromise = null;
let contentRendered = false;
let searchIndex = [];

const feedSections = {
  updates: {
    list: document.getElementById("updates-list"),
    empty: document.getElementById("updates-reader-empty"),
    reader: document.getElementById("updates-reader-content"),
    emptyText: "no updates added yet.",
  },
  articles: {
    list: document.getElementById("articles-list"),
    empty: document.getElementById("articles-reader-empty"),
    reader: document.getElementById("articles-reader-content"),
    emptyText: "no articles added yet.",
  },
  projects: {
    list: document.getElementById("projects-list"),
    empty: document.getElementById("projects-reader-empty"),
    reader: document.getElementById("projects-reader-content"),
    emptyText: "no projects added yet.",
  },
};

const feedRecords = {
  updates: [],
  articles: [],
  projects: [],
};

let galleryRecords = [];
let lastFocusedGalleryTrigger = null;

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function pictureHtml(src, alt, extra) {
  if (!src) return "";
  const attrs = extra || "";
  if (/^https?:\/\//i.test(src)) {
    return "<img src=\"" + escapeHtml(src) + "\" alt=\"" + escapeHtml(alt) + "\"" + attrs + " loading=\"lazy\">";
  }
  const base = src.replace(/\.(png|jpe?g|gif)$/i, "");
  return [
    "<picture>",
    "<source srcset=\"" + escapeHtml(base) + ".avif\" type=\"image/avif\">",
    "<source srcset=\"" + escapeHtml(base) + ".webp\" type=\"image/webp\">",
    "<img src=\"" + escapeHtml(src) + "\" alt=\"" + escapeHtml(alt) + "\"" + attrs + " loading=\"lazy\">",
    "</picture>",
  ].join("");
}

const tabRoutes = {
  home: "/",
  stack: "/stack",
  updates: "/updates",
  articles: "/articles",
  images: "/gallery",
  projects: "/projects",
  contact: "/contact",
};

const routeTabs = Object.fromEntries(Object.entries(tabRoutes).map(([tab, route]) => [route, tab]));

window.currentTab = "home";

function isContentTab(tabId) {
  return ["updates", "articles", "images", "projects"].includes(tabId);
}

function applyLoadedContent(content) {
  const loadedContent = content || {};
  siteContent.updates = Array.isArray(loadedContent.updates) ? loadedContent.updates : [];
  siteContent.articles = Array.isArray(loadedContent.articles) ? loadedContent.articles : [];
  siteContent.projects = Array.isArray(loadedContent.projects) ? loadedContent.projects : [];
  siteContent.gallery = Array.isArray(loadedContent.gallery) ? loadedContent.gallery : [];
}

function loadPortfolioContent() {
  if (window.PORTFOLIO_CONTENT) {
    applyLoadedContent(window.PORTFOLIO_CONTENT);
    return Promise.resolve(siteContent);
  }

  if (contentLoadPromise) {
    return contentLoadPromise;
  }

  const source = window.PORTFOLIO_CONTENT_SRC;
  if (!source) {
    return Promise.resolve(siteContent);
  }

  contentLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = source;
    script.async = true;
    script.onload = () => {
      applyLoadedContent(window.PORTFOLIO_CONTENT);
      resolve(siteContent);
    };
    script.onerror = () => {
      contentLoadPromise = null;
      reject(new Error("portfolio content failed to load"));
    };
    document.head.appendChild(script);
  });

  return contentLoadPromise;
}

function showContentLoadError() {
  Object.values(feedSections).forEach((section) => {
    if (section.list) {
      section.list.innerHTML = '<p class="dynamic-note">could not load this section.</p>';
    }
  });

  if (galleryGrid) {
    galleryGrid.innerHTML = '<p class="dynamic-note">could not load images.</p>';
  }
}

function renderInteractiveContent() {
  if (contentRendered) {
    return;
  }

  renderFeed("updates", siteContent.updates || []);
  renderFeed("articles", siteContent.articles || []);
  renderFeed("projects", siteContent.projects || []);
  renderGallery(siteContent.gallery || []);
  rebuildSearchIndex();
  contentRendered = true;
}

function ensureInteractiveContent() {
  return loadPortfolioContent().then(() => {
    renderInteractiveContent();
    return siteContent;
  });
}

function setActiveTab(tabId, updateHash = true, scrollToTabs = false) {
  const nextButton = tabButtons.find((button) => button.dataset.tab === tabId) || tabButtons[0];
  const nextId = nextButton.dataset.tab;

  if (!updateHash && nextId === window.currentTab) {
    return;
  }

  tabButtons.forEach((button) => {
    const isActive = button === nextButton;
    button.setAttribute("aria-selected", String(isActive));
    button.tabIndex = isActive ? 0 : -1;
  });

  tabPanels.forEach((panel) => {
    panel.hidden = panel.id !== `panel-${nextId}`;
  });

  crumbCurrent.textContent = nextId;
  window.currentTab = nextId;

  if (updateHash && window.location.protocol !== "file:") {
    history.pushState({ tab: nextId }, "", tabRoutes[nextId] || "/");
  }

  if (scrollToTabs) {
    tabsSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (isContentTab(nextId)) {
    ensureInteractiveContent().catch(showContentLoadError);
  }
}

window.assistantNavigate = function (type, id) {
  if (id) {
    setActiveTab(type, true, true);
    var section = feedSections[type];
    if (section) {
      var trigger = section.list.querySelector('.feed-trigger[data-entry-target="' + escapeHtml(id) + '"]');
      if (trigger) trigger.click();
    }
  } else {
    setActiveTab(type, true, true);
  }
};

let lastFocusedReaderTrigger = null;

function closeReader(sectionKey) {
  const section = feedSections[sectionKey];

  if (!section) {
    return;
  }

  document.querySelectorAll(`.feed-trigger[data-section="${sectionKey}"]`).forEach((trigger) => {
    trigger.classList.remove("is-active");
    trigger.setAttribute("aria-pressed", "false");
  });

  section.reader.hidden = true;
  section.reader.innerHTML = "";
  section.empty.hidden = false;

  if (lastFocusedReaderTrigger && document.contains(lastFocusedReaderTrigger)) {
    lastFocusedReaderTrigger.focus();
  }

  lastFocusedReaderTrigger = null;
}

function openReader(sectionKey, id) {
  const section = feedSections[sectionKey];
  const record = (feedRecords[sectionKey] || []).find((item) => item.id === id);

  if (!section || !record) {
    return;
  }

  lastFocusedReaderTrigger = document.querySelector(
    `.feed-trigger[data-section="${sectionKey}"][data-entry-target="${escapeHtml(id)}"]`
  );

  document.querySelectorAll(`.feed-trigger[data-section="${sectionKey}"]`).forEach((trigger) => {
    const isActive = trigger.dataset.entryTarget === id;
    trigger.classList.toggle("is-active", isActive);
    trigger.setAttribute("aria-pressed", String(isActive));
  });

  const standaloneUrl = `/${sectionKey}/${escapeHtml(id)}`;
  section.reader.innerHTML = `
    <div class="reader-head">
      <div>
        <p class="reader-kicker">${escapeHtml(record.dateLabel)}</p>
        <h3>${escapeHtml(record.title)}</h3>
      </div>
      <div class="reader-head-actions">
        <a class="reader-expand" href="${standaloneUrl}">expand</a>
        <button class="reader-close" type="button" data-reader-close="${sectionKey}">exit</button>
      </div>
    </div>
    <div class="reader-body">${record.html}</div>
  `;

  section.reader.querySelector("[data-reader-close]").addEventListener("click", () => {
    closeReader(sectionKey);
  });

  section.empty.hidden = true;
  section.reader.hidden = false;
}

function renderFeed(sectionKey, records) {
  const section = feedSections[sectionKey];

  if (!section) {
    return;
  }

  feedRecords[sectionKey] = records;

  if (!records.length) {
    section.list.innerHTML = `<p class="dynamic-note">${section.emptyText}</p>`;
    closeReader(sectionKey);
    return;
  }

  section.list.innerHTML = records
    .map((record) => {
      const preview = record.image
        ? "\n          <span class=\"feed-trigger-media\">\n            " + pictureHtml(record.image, "", "") + "\n          </span>\n        "
        : "";

      return `
        <button
          class="feed-trigger${record.image ? "" : " feed-trigger--text-only"}"
          type="button"
          data-section="${sectionKey}"
          data-entry-target="${escapeHtml(record.id)}"
          aria-pressed="false"
        >
          ${preview}
          <span class="feed-trigger-copy">
            <span class="feed-trigger-meta">${escapeHtml(record.dateLabel)}</span>
            <strong>${escapeHtml(record.title)}</strong>
            <span>${escapeHtml(record.summary)}</span>
            <span class="feed-trigger-action">read more</span>
          </span>
        </button>
      `;
    })
    .join("");

  section.list.querySelectorAll(`.feed-trigger[data-section="${sectionKey}"]`).forEach((trigger) => {
    trigger.addEventListener("click", () => {
      openReader(sectionKey, trigger.dataset.entryTarget);
    });
  });

  closeReader(sectionKey);
}

function renderGallery(items) {
  galleryRecords = [...items].sort((left, right) => right.date.localeCompare(left.date));
  updateGalleryView();
}

function updateGalleryView() {
  const query = gallerySearch ? gallerySearch.value.trim().toLowerCase() : "";
  const items = galleryRecords
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => {
      if (!query) {
        return true;
      }

      return [item.caption, item.alt, item.url].some((value) => value.toLowerCase().includes(query));
    });

  if (!items.length) {
    galleryGrid.innerHTML = galleryRecords.length
      ? '<p class="dynamic-note">no matching images.</p>'
      : '<p class="dynamic-note">no images added yet.</p>';
    return;
  }

  galleryGrid.innerHTML = items
    .map(({ item, index }) => {
      return [
        "<figure class=\"gallery-item\">",
        "<button class=\"gallery-trigger\" type=\"button\" data-gallery-index=\"" + index + "\" aria-label=\"open " + escapeHtml(item.caption) + "\">",
        pictureHtml(item.url, item.alt, ""),
        "</button>",
        "<figcaption>" + escapeHtml(item.caption) + "</figcaption>",
        "</figure>",
      ].join("");
    })
    .join("");

  galleryGrid.querySelectorAll(".gallery-trigger").forEach((trigger) => {
    trigger.addEventListener("click", () => {
      openGalleryLightbox(Number(trigger.dataset.galleryIndex), trigger);
    });
  });
}

function trapLightboxFocus(event) {
  if (!galleryLightbox || galleryLightbox.hidden) {
    return;
  }

  const focusable = galleryLightbox.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );

  if (!focusable.length) {
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (event.key === "Tab") {
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}

function openGalleryLightbox(index, trigger) {
  const item = galleryRecords[index];

  if (!item) {
    return;
  }

  lastFocusedGalleryTrigger = trigger || null;
  const lightboxBase = item.url.replace(/\.(png|jpe?g|gif)$/i, "");
  galleryLightboxImage.src = lightboxBase + ".webp";
  galleryLightboxImage.alt = item.alt;
  galleryLightboxCaption.textContent = item.caption;
  galleryLightbox.hidden = false;
  document.body.classList.add("lightbox-open");
  galleryLightbox.querySelector(".lightbox-close").focus();
  document.addEventListener("keydown", trapLightboxFocus);
}

function closeGalleryLightbox() {
  galleryLightbox.hidden = true;
  galleryLightboxImage.src = "";
  galleryLightboxImage.alt = "";
  galleryLightboxCaption.textContent = "";
  document.body.classList.remove("lightbox-open");
  document.removeEventListener("keydown", trapLightboxFocus);

  if (lastFocusedGalleryTrigger && document.contains(lastFocusedGalleryTrigger)) {
    lastFocusedGalleryTrigger.focus();
  }

  lastFocusedGalleryTrigger = null;
}

tabButtons.forEach((button, index) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    setActiveTab(button.dataset.tab, true, true);
  });

  button.addEventListener("keydown", (event) => {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) {
      return;
    }

    event.preventDefault();

    if (event.key === "Home") {
      tabButtons[0].focus();
      setActiveTab(tabButtons[0].dataset.tab, true, true);
      return;
    }

    if (event.key === "End") {
      const lastButton = tabButtons[tabButtons.length - 1];
      lastButton.focus();
      setActiveTab(lastButton.dataset.tab, true, true);
      return;
    }

    const direction = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (index + direction + tabButtons.length) % tabButtons.length;
    tabButtons[nextIndex].focus();
    setActiveTab(tabButtons[nextIndex].dataset.tab, true, true);
  });
});

scrollTopLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    setActiveTab("home", true, false);
    if (window.location.protocol !== "file:") {
      history.replaceState({ tab: "home" }, "", "/");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});

function syncTabWithHash() {
  const tabParam = new URLSearchParams(window.location.search).get("t");
  if (tabParam && tabButtons.some((button) => button.dataset.tab === tabParam)) {
    setActiveTab(tabParam, false, false);
    if (window.location.search) {
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState(null, "", cleanUrl);
    }
    return;
  }

  const routeMatch = routeTabs[window.location.pathname];
  if (routeMatch) {
    setActiveTab(routeMatch, false, false);
    return;
  }

  const hashValue = window.location.hash.replace("#", "");
  const hasMatchingTab = tabButtons.some((button) => button.dataset.tab === hashValue);
  setActiveTab(hasMatchingTab ? hashValue : "home", false, false);
}

function updateScrollProgress() {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  const progress = maxScroll > 0 ? window.scrollY / maxScroll : 0;
  progressBar.style.transform = `scaleX(${progress})`;
}

window.addEventListener("hashchange", syncTabWithHash);
window.addEventListener("popstate", syncTabWithHash);
window.addEventListener("scroll", updateScrollProgress, { passive: true });
window.addEventListener("resize", updateScrollProgress);
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && galleryLightbox && !galleryLightbox.hidden) {
    closeGalleryLightbox();
  }
});

if (gallerySearch) {
  gallerySearch.addEventListener("input", updateGalleryView);
}

galleryLightboxClose.forEach((control) => {
  control.addEventListener("click", closeGalleryLightbox);
});

syncTabWithHash();
updateScrollProgress();
rebuildSearchIndex();

if (isContentTab(window.currentTab)) {
  ensureInteractiveContent().catch(showContentLoadError);
}

// Site Search

const searchInput = document.getElementById("site-search");
const searchResults = document.getElementById("search-results");
const searchTrigger = document.getElementById("search-trigger");
const searchField = document.getElementById("search-field");
let searchTimeout = null;

function openSearch() {
  searchField.classList.add("search-field--open");
  searchTrigger.setAttribute("aria-expanded", "true");
  setTimeout(function () { 
    searchInput.focus(); 
    if (!searchInput.value.trim()) {
      ensureInteractiveContent()
        .then(function () {
          runSearch("");
        })
        .catch(function () {
          runSearch("");
        });
    }
  }, 100);
}

function closeSearch() {
  searchField.classList.remove("search-field--open");
  searchResults.hidden = true;
  searchTrigger.setAttribute("aria-expanded", "false");
  searchInput.value = "";
  searchInput.blur();
}

if (searchTrigger) {
  searchTrigger.addEventListener("click", function () {
    if (searchField.classList.contains("search-field--open")) {
      closeSearch();
      searchTrigger.focus();
    } else {
      openSearch();
    }
  });
}

function rebuildSearchIndex() {
  const index = [];
  
  document.querySelectorAll(".tab-panel").forEach(panel => {
    const id = panel.id.replace("panel-", "");
    if (["updates", "articles", "images", "projects"].includes(id)) return;
    index.push({
      type: "page",
      id: id,
      title: panel.querySelector("h2") ? panel.querySelector("h2").innerText : id,
      summary: "portfolio section",
      date: "",
      content: panel.innerText.replace(/\s+/g, ' ')
    });
  });

  for (const type of ["updates", "articles"]) {
    for (const item of (siteContent[type] || [])) {
      const rawText = (item.html || "").replace(/<[^>]*>?/gm, " ");
      index.push({ type, id: item.id, title: item.title, summary: item.summary, date: item.dateLabel, content: rawText });
    }
  }
  for (const item of (siteContent.gallery || [])) {
    index.push({ type: "gallery", id: item.url, title: item.alt, summary: item.caption, date: "", content: "" });
  }
  for (const item of (feedRecords.projects || [])) {
    const rawText = (item.html || "").replace(/<[^>]*>?/gm, " ");
    index.push({ type: "projects", id: item.id, title: item.title, summary: item.summary, date: "", content: rawText });
  }
  searchIndex = index;
}

function runSearch(query) {
  if (!query || query.length < 2) {
    // Show recommendations if empty
    const recommendations = searchIndex.filter(item => item.type === "articles" || item.type === "projects").slice(0, 5);
    
    if (recommendations.length > 0) {
      searchResults.innerHTML = `<div style="padding: 0.5rem 0.75rem; font-size: 0.75rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em;">Recommended</div>` + recommendations
        .map((rec) => {
          return "<button class=\"search-result-item\" type=\"button\" data-search-type=\"" + escapeHtml(rec.type) + "\" data-search-id=\"" + escapeHtml(rec.id) + "\"><span class=\"search-result-type\">" + escapeHtml(rec.type === "articles" ? "blog" : rec.type) + "</span><strong>" + escapeHtml(rec.title) + "</strong></button>";
        })
        .join("");
      
      searchResults.querySelectorAll(".search-result-item").forEach((el) => {
        el.addEventListener("click", () => {
          closeSearch();
          navigateToSearchResult(el.dataset.searchType, el.dataset.searchId);
        });
      });
      searchResults.hidden = false;
    } else {
      searchResults.hidden = true;
    }
    return;
  }

  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const scored = [];

  for (const item of searchIndex) {
    const haystack = (item.title + " " + item.summary + " " + (item.content || "")).toLowerCase();
    let termMatches = 0;
    for (const t of terms) {
      if (haystack.includes(t)) termMatches++;
    }
    
    if (termMatches === 0) continue;

    const queryLower = query.toLowerCase();
    const exactTitle = item.title.toLowerCase().includes(queryLower) ? 10 : 0;
    const exactSummary = item.summary.toLowerCase().includes(queryLower) ? 5 : 0;
    const exactContent = (item.content || "").toLowerCase().includes(queryLower) ? 2 : 0;
    
    const score = (termMatches * 2) + exactTitle + exactSummary + exactContent;

    let snippet = item.summary.length > 80 ? item.summary.slice(0, 80) + "..." : item.summary;
    if (exactContent && !exactSummary && !exactTitle) {
      const contentLower = (item.content || "").toLowerCase();
      const idx = contentLower.indexOf(queryLower);
      if (idx >= 0) {
        snippet = "..." + (item.content || "").slice(Math.max(0, idx - 20), idx + 60).trim() + "...";
      }
    }

    scored.push({ item, score, snippet });
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 8);

  if (!top.length) {
    searchResults.innerHTML = `<div class="search-result-item" style="text-align: center; color: var(--muted);">no results found.</div>`;
    searchResults.hidden = false;
    return;
  }

  searchResults.innerHTML = top
    .map(({ item, snippet }) => {
      return "<button class=\"search-result-item\" type=\"button\" data-search-type=\"" + escapeHtml(item.type) + "\" data-search-id=\"" + escapeHtml(item.id) + "\"><span class=\"search-result-type\">" + escapeHtml(item.type) + "</span><strong>" + escapeHtml(item.title) + "</strong><span class=\"search-result-snippet\">" + escapeHtml(snippet) + "</span></button>";
    })
    .join("");

  searchResults.hidden = false;

  searchResults.querySelectorAll(".search-result-item").forEach((el) => {
    el.addEventListener("click", () => {
      closeSearch();
      navigateToSearchResult(el.dataset.searchType, el.dataset.searchId);
    });
  });
}

function navigateToSearchResult(type, id) {
  if (type === "page") {
    setActiveTab(id, true, true);
    return;
  }
  if (type === "gallery") {
    setActiveTab("images", true, true);
    return;
  }
  setActiveTab(type, true, true);
  const section = feedSections[type];
  if (!section) return;
  const trigger = section.list.querySelector(".feed-trigger[data-entry-target=\"" + escapeHtml(id) + "\"]");
  if (trigger) trigger.click();
}

if (searchInput) {
  searchInput.addEventListener("focus", () => {
    if (!searchInput.value.trim()) runSearch("");
  });

  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const query = searchInput.value.trim();
      ensureInteractiveContent()
        .then(() => runSearch(query))
        .catch(() => runSearch(query));
    }, 200);
  });

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeSearch();
    }
    if (e.key === "Enter") {
      const first = searchResults.querySelector(".search-result-item");
      if (first) first.click();
    }
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".header-search")) {
      closeSearch();
    }
  });
}
