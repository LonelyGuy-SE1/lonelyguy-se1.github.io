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
  papers: [],
  gallery: [],
};

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
  papers: {
    list: document.getElementById("papers-list"),
    empty: document.getElementById("papers-reader-empty"),
    reader: document.getElementById("papers-reader-content"),
    emptyText: "no papers added yet.",
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
  papers: [],
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
  const base = src.replace(/\.(png|jpe?g|gif)$/i, "");
  const extMatch = src.match(/\.(png|jpe?g|gif)$/i);
  const fallbackExt = extMatch ? extMatch[1] : "png";
  const attrs = extra || "";
  return [
    "<picture>",
    "<source srcset=\"" + escapeHtml(base) + ".avif\" type=\"image/avif\">",
    "<source srcset=\"" + escapeHtml(base) + ".webp\" type=\"image/webp\">",
    "<img src=\"" + escapeHtml(src) + "\" alt=\"" + escapeHtml(alt) + "\"" + attrs + " loading=\"lazy\">",
    "</picture>",
  ].join("");
}

function setActiveTab(tabId, updateHash = true, scrollToTabs = false) {
  const nextButton = tabButtons.find((button) => button.dataset.tab === tabId) || tabButtons[0];
  const nextId = nextButton.dataset.tab;

  tabButtons.forEach((button) => {
    const isActive = button === nextButton;
    button.setAttribute("aria-selected", String(isActive));
    button.tabIndex = isActive ? 0 : -1;
  });

  tabPanels.forEach((panel) => {
    panel.hidden = panel.id !== `panel-${nextId}`;
  });

  crumbCurrent.textContent = nextId;

  if (updateHash) {
    history.replaceState(null, "", `#${nextId}`);
  }

  if (scrollToTabs) {
    tabsSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

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

  section.reader.innerHTML = `
    <div class="reader-head">
      <div>
        <p class="reader-kicker">${escapeHtml(record.dateLabel)}</p>
        <h4>${escapeHtml(record.title)}</h4>
      </div>
      <button class="reader-close" type="button" data-reader-close="${sectionKey}">exit</button>
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
  button.addEventListener("click", () => {
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
    history.replaceState(null, "", "#top");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});

function syncTabWithHash() {
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
renderFeed("updates", siteContent.updates || []);
renderFeed("articles", siteContent.articles || []);
renderFeed("papers", siteContent.papers || []);
renderGallery(siteContent.gallery || []);

async function fetchProjects() {
  const section = feedSections.projects;
  try {
    const res = await fetch("projects.json");
    const repos = await res.json();
    if (!repos.length) {
      section.list.innerHTML = `<p class="dynamic-note">no projects added yet.</p>`;
      return;
    }
    const projects = await Promise.all(
      repos.map(async ({ repo }) => {
        const [owner, name] = repo.split("/");
        const [infoRes, readmeRes] = await Promise.all([
          fetch(`https://api.github.com/repos/${owner}/${name}`),
          fetch(`https://api.github.com/repos/${owner}/${name}/readme`),
        ]);
        const info = await infoRes.json();
        let readme = "";
        try {
          const readmeData = await readmeRes.json();
          if (readmeData.content) {
            readme = atob(readmeData.content.replace(/\n/g, ""));
          }
        } catch {}
        return {
          id: repo,
          title: info.name || repo,
          summary: info.description || "No description",
          html: readme,
          url: info.html_url || `https://github.com/${repo}`,
        };
      })
    );
    feedRecords.projects = projects;
    renderProjectsList(projects);
  } catch {
    section.list.innerHTML = `<p class="dynamic-note">failed to load projects.</p>`;
  }
}

function renderProjectsList(records) {
  const section = feedSections.projects;
  if (!records.length) {
    section.list.innerHTML = `<p class="dynamic-note">no projects added yet.</p>`;
    closeReader("projects");
    return;
  }
  section.list.innerHTML = records
    .map((record) => {
      const summary = record.summary.length > 100
        ? record.summary.slice(0, 100) + "..."
        : record.summary;
      return `
        <button
          class="feed-trigger feed-trigger--text-only"
          type="button"
          data-section="projects"
          data-entry-target="${escapeHtml(record.id)}"
          aria-pressed="false"
        >
          <span class="feed-trigger-copy">
            <strong>${escapeHtml(record.title)}</strong>
            <span>${escapeHtml(summary)}</span>
            <span class="feed-trigger-action">view readme</span>
          </span>
        </button>
      `;
    })
    .join("");
  section.list.querySelectorAll(".feed-trigger").forEach((trigger) => {
    trigger.addEventListener("click", () => {
      openProjectsReader(trigger.dataset.entryTarget);
    });
  });
  closeReader("projects");
}

function openProjectsReader(id) {
  const section = feedSections.projects;
  const record = feedRecords.projects.find((item) => item.id === id);
  if (!record) return;
  document.querySelectorAll('.feed-trigger[data-section="projects"]').forEach((trigger) => {
    const isActive = trigger.dataset.entryTarget === id;
    trigger.classList.toggle("is-active", isActive);
    trigger.setAttribute("aria-pressed", String(isActive));
  });
  const readmeHtml = record.html ? marked.parse(record.html, { gfm: true, breaks: true }) : "<p>No README available.</p>";
  section.reader.innerHTML = `
    <div class="reader-head">
      <div>
        <h4>${escapeHtml(record.title)}</h4>
      </div>
      <div class="reader-head-actions">
        <a href="${escapeHtml(record.url)}" target="_blank" rel="noreferrer">visit repo</a>
        <button class="reader-close" type="button" data-reader-close="projects">exit</button>
      </div>
    </div>
    <div class="reader-body">${readmeHtml}</div>
  `;
  section.reader.querySelector("[data-reader-close]").addEventListener("click", () => {
    closeReader("projects");
  });
  section.empty.hidden = true;
  section.reader.hidden = false;
}

fetchProjects();
