const crypto = require("crypto");
const fs = require("fs/promises");
const fsSync = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const CONFIG_PATH = path.join(ROOT, "site.config.json");
const PROJECTS_JSON = path.join(ROOT, "projects.json");
const CONTENT_JS = path.join(__dirname, "content.js");
const BUILD_DIR = path.join(ROOT, "assets", "build");
const SEARCH_INDEX_JSON = path.join(ROOT, "search-index.json");
const SITE_INDEX_JSON = path.join(ROOT, "site-index.json");

const COLLECTION_DIRS = {
  updates: path.join(ROOT, "updates"),
  articles: path.join(ROOT, "articles"),
};

const GALLERY_DIR = path.join(ROOT, "gallery");

const STATIC_PAGES = [
  {
    id: "stack",
    path: "/stack",
    title: "Stack",
    description:
      "A practical skill map for lonely guy across programming, machine learning, robotics simulation, systems, and deployment.",
    kicker: "skill map",
    sections: [
      {
        title: "Languages and formats",
        body: "Python, C/C++, JavaScript, Rust, MATLAB, Bash, URDF, MJCF, and the low-level interfaces needed to move between simulation and real systems.",
      },
      {
        title: "AI and ML",
        body: "Reinforcement learning, deep learning, supervised and unsupervised learning, LLM basics, transformers, Gymnasium, PyTorch-style workflows, Hugging Face, NumPy, pandas, and visualization.",
      },
      {
        title: "Robotics and embedded systems",
        body: "MuJoCo, MATLAB, Simulink, Simscape Multibody, Gazebo, ROS, Arduino, Raspberry Pi, sensors, and embedded C/C++ practice.",
      },
      {
        title: "Systems thinking",
        body: "Deterministic runtimes, quantized deployment, cache-aware inference, API design, and the habit of turning vague agent ideas into testable environments.",
      },
    ],
  },
  {
    id: "contact",
    path: "/contact",
    title: "Contact",
    description:
      "Canonical links and contact routes for lonely guy across GitHub, X, Hugging Face, ORCID, LinkedIn, email, and Discord.",
    kicker: "links",
    sections: [],
  },
];

function normalizeBaseUrl(value) {
  return String(value || "https://lonelyguy.vercel.app").replace(/\/+$/, "");
}

async function loadSiteConfig() {
  const defaults = {
    baseUrl: "https://lonelyguy.vercel.app",
    siteName: "Lonely Guy",
    shortName: "Lonely Guy",
    description:
      "se1 (lonely guy) - cs undergrad building towards autonomous robotic assistants through reinforcement learning, robotics, world models, embodied ai, and systems.",
    author: { name: "SE1", alternateName: "Lonely Guy", sameAs: [], knowsAbout: [] },
    seo: {
      defaultTitle:
        "Lonely Guy - RL, Robotics, Embodied AI & Systems Portfolio",
      defaultDescription:
        "se1 (lonely guy) - cs undergrad building towards autonomous robotic assistants through reinforcement learning, robotics, world models, embodied ai, and systems. portfolio with blogs, projects, and research.",
      defaultImage: "/assets/SE1.jpg",
      twitterHandle: "@lonelyguyse1",
      language: "en-US",
      locale: "en_US",
      themeColor: "#0b0504",
    },
    analytics: { vercelAnalytics: true, vercelSpeedInsights: true },
    socials: [],
    gsc: { propertyUrl: "https://lonelyguy.vercel.app/" },
  };

  try {
    const parsed = JSON.parse(await fs.readFile(CONFIG_PATH, "utf8"));
    return {
      ...defaults,
      ...parsed,
      baseUrl: normalizeBaseUrl(parsed.baseUrl || defaults.baseUrl),
      author: { ...defaults.author, ...(parsed.author || {}) },
      seo: { ...defaults.seo, ...(parsed.seo || {}) },
      analytics: { ...defaults.analytics, ...(parsed.analytics || {}) },
      gsc: { ...defaults.gsc, ...(parsed.gsc || {}) },
    };
  } catch {
    return defaults;
  }
}

function canonicalPath(pathname) {
  if (!pathname || pathname === "/") return "/";
  return "/" + String(pathname).replace(/^\/+|\/+$/g, "");
}

function canonicalUrl(config, pathname) {
  const cleanPath = canonicalPath(pathname);
  return cleanPath === "/" ? `${config.baseUrl}/` : `${config.baseUrl}${cleanPath}`;
}

function collectionUrl(config, type) {
  return canonicalUrl(config, type);
}

function recordUrl(config, type, slug) {
  return canonicalUrl(config, `${type}/${slug}`);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeXml(value) {
  return escapeHtml(value);
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("\n", " ");
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<script\b[\s\S]*?<\/script(?:\s+[^>]*)?\s*>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style(?:\s+[^>]*)?\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLineEndings(value) {
  return String(value || "").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
}

function externalAttrs(url) {
  return /^https?:\/\//i.test(url) ? ' target="_blank" rel="noreferrer"' : "";
}

function toSlug(fileName) {
  return fileName.replace(/\.[^.]+$/, "");
}

function formatFallbackTitle(slug) {
  const withoutDate = slug.replace(/^\d{4}-\d{2}-\d{2}[-_]?/, "");
  return (withoutDate || slug).replace(/[-_]/g, " ");
}

function normalizeAssetUrl(assetPath) {
  if (!assetPath) return "";
  const normalized = String(assetPath).trim().replace(/\\/g, "/");
  if (!normalized) return "";
  if (/^https?:\/\//i.test(normalized) || normalized.startsWith("/")) {
    return normalized;
  }
  if (
    /\.(png|jpe?g|webp|gif|svg)$/i.test(normalized) &&
    !normalized.includes("/")
  ) {
    return `gallery/${normalized}`;
  }
  return normalized;
}

function toRootPath(assetPath) {
  if (!assetPath || /^https?:\/\//i.test(assetPath)) return assetPath;
  return "/" + String(assetPath).replace(/^\/+/, "");
}

function absoluteImageUrl(config, image) {
  const fallback = config.seo.defaultImage || "/assets/SE1.jpg";
  const raw = normalizeAssetUrl(image || fallback);
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${config.baseUrl}${toRootPath(raw)}`;
}

function inlineMarkdown(text) {
  const escaped = escapeHtml(text);
  return escaped
    .replace(
      /\[!\[([^\]]*)\]\(([^)]+)\)\]\(([^)]+)\)/g,
      (_, alt, imgUrl, linkUrl) =>
        `<a href="${escapeAttr(linkUrl)}"${externalAttrs(linkUrl)}><img src="${escapeAttr(normalizeAssetUrl(imgUrl))}" alt="${escapeAttr(alt)}" loading="lazy" decoding="async"></a>`,
    )
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
      return `<img src="${escapeAttr(normalizeAssetUrl(src))}" alt="${escapeAttr(alt)}" loading="lazy" decoding="async">`;
    })
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      (_, label, url) =>
        `<a href="${escapeAttr(url)}"${externalAttrs(url)}>${escapeHtml(label)}</a>`,
    )
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

function extractYouTubeId(url) {
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.toLowerCase();
    if (host === "youtu.be") {
      return parsed.pathname.replace(/^\/+/, "").split("/")[0];
    }
    if (host === "youtube.com" || host.endsWith(".youtube.com")) {
      return parsed.searchParams.get("v") || parsed.pathname.split("/").pop();
    }
  } catch {}
  return "";
}

function youtubeEmbedHtml(url, videoTitle) {
  const id = extractYouTubeId(url);
  if (!id || !/^[a-zA-Z0-9_-]{6,}$/.test(id)) return "";
  const title = videoTitle || "Video walkthrough";
  return `<div class="reader-video"><iframe src="https://www.youtube-nocookie.com/embed/${escapeAttr(id)}" title="${escapeAttr(title)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>`;
}

function extractYouTubeIdsFromHtml(html) {
  const ids = [];
  const regex = /youtube(?:-nocookie)?\.com\/embed\/([a-zA-Z0-9_-]{6,})/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    ids.push(match[1]);
  }
  return [...new Set(ids)];
}

function markdownToHtml(markdown) {
  const blocks = normalizeLineEndings(markdown)
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  return blocks
    .map((block) => {
      const youtubeMatch = block.match(/^\{%\s*youtube\s+([^%]+?)\s*%\}$/i);
      if (youtubeMatch) return youtubeEmbedHtml(youtubeMatch[1]);

      if (block.startsWith("```") && block.endsWith("```")) {
        const code = block.replace(/^```[\w-]*\n?/, "").replace(/\n?```$/, "");
        return `<pre><code>${escapeHtml(code)}</code></pre>`;
      }

      if (/^#{1,6}\s/.test(block)) {
        const m = block.match(/^(#{1,6})\s(.+)$/);
        return `<h${m[1].length}>${inlineMarkdown(m[2])}</h${m[1].length}>`;
      }

      const tableLines = block.split("\n");
      if (
        tableLines.length >= 2 &&
        tableLines.every((l) => l.includes("|")) &&
        /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(tableLines[1])
      ) {
        const parseRow = (line) =>
          line
            .trim()
            .replace(/^\|/, "")
            .replace(/\|$/, "")
            .split("|")
            .map((cell) => cell.trim());
        const headers = parseRow(tableLines[0]);
        const rows = tableLines.slice(2).map(parseRow);
        return `<table><thead><tr>${headers
          .map((cell) => `<th>${inlineMarkdown(cell)}</th>`)
          .join("")}</tr></thead><tbody>${rows
          .map(
            (row) =>
              `<tr>${row.map((cell) => `<td>${inlineMarkdown(cell)}</td>`).join("")}</tr>`,
          )
          .join("")}</tbody></table>`;
      }

      if (block.split("\n").every((l) => /^[-*]\s/.test(l))) {
        return `<ul>${block
          .split("\n")
          .map((l) => l.replace(/^[-*]\s/, ""))
          .map((l) => `<li>${inlineMarkdown(l)}</li>`)
          .join("")}</ul>`;
      }

      if (block.split("\n").every((l) => /^\d+\.\s/.test(l))) {
        return `<ol>${block
          .split("\n")
          .map((l) => l.replace(/^\d+\.\s/, ""))
          .map((l) => `<li>${inlineMarkdown(l)}</li>`)
          .join("")}</ol>`;
      }

      if (block.split("\n").every((l) => /^>\s?/.test(l))) {
        const quote = block
          .split("\n")
          .map((l) => l.replace(/^>\s?/, ""))
          .join(" ");
        return `<blockquote>${inlineMarkdown(quote)}</blockquote>`;
      }

      if (/^!\[([^\]]*)\]\(([^)]+)\)$/.test(block)) {
        const m = block.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
        return `<div class="reader-media"><img src="${escapeAttr(normalizeAssetUrl(m[2]))}" alt="${escapeAttr(m[1])}" loading="lazy" decoding="async"></div>`;
      }

      if (/^---$/.test(block.trim())) return "<hr>";

      const paragraph = block
        .split("\n")
        .map((l) => inlineMarkdown(l))
        .join("<br>");
      return `<p>${paragraph}</p>`;
    })
    .join("");
}

function parseFrontmatter(rawText, fallbackDate) {
  const text = normalizeLineEndings(rawText);
  if (!text.startsWith("---\n")) {
    return { attributes: {}, body: text.trim(), dateLabel: fallbackDate };
  }
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { attributes: {}, body: text.trim(), dateLabel: fallbackDate };
  const attributes = {};
  for (const line of m[1].split("\n")) {
    const sep = line.indexOf(":");
    if (sep === -1) continue;
    const key = line.slice(0, sep).trim();
    const value = line.slice(sep + 1).trim();
    if (["tags", "keywords"].includes(key)) {
      attributes[key] = value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    } else if (["featured"].includes(key)) {
      attributes[key] = /^(true|yes|1)$/i.test(value);
    } else {
      attributes[key] = value;
    }
  }
  return {
    attributes,
    body: m[2].trim(),
    dateLabel: attributes.date || fallbackDate,
  };
}

function extractFirstImage(markdownBody) {
  const m = normalizeLineEndings(markdownBody).match(/!\[[^\]]*\]\(([^)]+)\)/);
  return m ? m[1] : "";
}

function fallbackSummary(markdownBody) {
  const line = normalizeLineEndings(markdownBody)
    .split(/\n+/)
    .map((l) => l.trim())
    .find(
      (l) =>
        l &&
        !l.startsWith("#") &&
        !l.startsWith("-") &&
        !l.startsWith("!") &&
        !l.startsWith("{%"),
    );
  return line || "No summary yet.";
}

function readingTime(markdownBody) {
  const words = normalizeLineEndings(markdownBody)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[^\w\s-]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

function toPictureHtml(html) {
  return html.replace(
    /<img src="((?:gallery|assets)\/[^"]+?)\.(png|jpe?g)" alt="([^"]*?)"(.*?)>/gi,
    (match, assetPath, ext, alt, extra) => {
      const rootPath = toRootPath(`${assetPath}.${ext}`);
      const avif = toRootPath(`${assetPath}.avif`);
      const webp = toRootPath(`${assetPath}.webp`);
      const attrs = /loading=/.test(extra) ? extra : `${extra} loading="lazy"`;
      const decoded = /decoding=/.test(attrs) ? attrs : `${attrs} decoding="async"`;
      return `<picture><source srcset="${avif}" type="image/avif"><source srcset="${webp}" type="image/webp"><img src="${rootPath}" alt="${alt}"${decoded}></picture>`;
    },
  );
}

function toRootRelativePaths(html) {
  return html
    .replace(/(src="|srcset=")(gallery\/)/g, "$1/$2")
    .replace(/(src="|srcset=")(assets\/)/g, "$1/$2");
}

async function collectImageTargets(directory) {
  const targets = [];
  const entries = await fs
    .readdir(directory, { withFileTypes: true })
    .catch(() => []);
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "icons" || entry.name === "build") continue;
      targets.push(...(await collectImageTargets(fullPath)));
    } else if (/\.(png|jpe?g)$/i.test(entry.name)) {
      targets.push(fullPath);
    }
  }
  return targets;
}

async function convertImages() {
  const targets = [
    ...(await collectImageTargets(GALLERY_DIR)),
    ...(await collectImageTargets(path.join(ROOT, "assets"))),
  ];

  for (const file of targets) {
    const base = file.replace(/\.\w+$/, "");
    const webpPath = base + ".webp";
    const avifPath = base + ".avif";
    const [webpExists, avifExists] = await Promise.all([
      fs
        .access(webpPath)
        .then(() => true)
        .catch(() => false),
      fs
        .access(avifPath)
        .then(() => true)
        .catch(() => false),
    ]);

    if (webpExists && avifExists) continue;

    const img = sharp(file);
    if (!webpExists) await img.clone().webp({ quality: 80, effort: 6 }).toFile(webpPath);
    if (!avifExists) await img.clone().avif({ quality: 65, effort: 4 }).toFile(avifPath);
    console.log(`  -> ${path.relative(ROOT, file)} -> webp + avif`);
  }

  await generateHeroImageVariants();
}

async function generateHeroImageVariants() {
  const source = path.join(ROOT, "assets", "yuri.png");
  if (!fsSync.existsSync(source)) return;
  for (const width of [480, 720]) {
    const base = path.join(ROOT, "assets", `yuri-${width}`);
    const webpPath = `${base}.webp`;
    const avifPath = `${base}.avif`;
    const [webpExists, avifExists] = await Promise.all([
      fs
        .access(webpPath)
        .then(() => true)
        .catch(() => false),
      fs
        .access(avifPath)
        .then(() => true)
        .catch(() => false),
    ]);
    const img = sharp(source).resize({ width, withoutEnlargement: true });
    if (!webpExists) await img.clone().webp({ quality: 80, effort: 6 }).toFile(webpPath);
    if (!avifExists) await img.clone().avif({ quality: 65, effort: 4 }).toFile(avifPath);
    if (!webpExists || !avifExists) console.log(`  -> assets/yuri-${width} -> webp + avif`);
  }
}

async function imageMetadata(publicPath) {
  if (!publicPath || /^https?:\/\//i.test(publicPath) || /\.svg$/i.test(publicPath)) {
    return {};
  }
  const filePath = path.join(ROOT, publicPath.replace(/^\/+/, ""));
  try {
    const meta = await sharp(filePath).metadata();
    return { width: meta.width, height: meta.height };
  } catch {
    return {};
  }
}

async function readMarkdownCollection(directory) {
  const entries = await fs
    .readdir(directory, { withFileTypes: true })
    .catch(() => []);
  const files = entries.filter((e) => e.isFile() && e.name.endsWith(".md"));
  const records = await Promise.all(
    files.map(async (entry) => {
      const filePath = path.join(directory, entry.name);
      const stats = await fs.stat(filePath);
      const rawText = await fs.readFile(filePath, "utf8");
      const fallbackDate = stats.mtime.toISOString().slice(0, 10);
      const parsed = parseFrontmatter(rawText, fallbackDate);
      const body = parsed.body || "";
      const html = toPictureHtml(markdownToHtml(body));
      const image = normalizeAssetUrl(
        parsed.attributes.image ||
          parsed.attributes.ogImage ||
          extractFirstImage(body),
      );
      return {
        id: parsed.attributes.slug || toSlug(entry.name),
        title:
          parsed.attributes.title || formatFallbackTitle(toSlug(entry.name)),
        date: parsed.attributes.date || fallbackDate,
        updated: parsed.attributes.updated || parsed.attributes.date || fallbackDate,
        dateLabel: parsed.dateLabel,
        summary: parsed.attributes.summary || fallbackSummary(body),
        seoTitle: parsed.attributes.seoTitle || "",
        seoDescription: parsed.attributes.seoDescription || "",
        canonical: parsed.attributes.canonical || "",
        tags: parsed.attributes.tags || [],
        featured: parsed.attributes.featured || false,
        readingTime: parsed.attributes.readingTime || readingTime(body),
        image,
        imageMeta: await imageMetadata(image),
        html,
        text: stripHtml(html),
      };
    }),
  );
  return records.sort((a, b) => b.date.localeCompare(a.date));
}

function altFromFilename(filename) {
  const slug = filename.replace(/\.[^.]+$/, "");
  return slug
    .split(".")
    .filter(Boolean)
    .map((part) => {
      if (part === "graph") return "training graph";
      if (part === "result") return "result";
      return part;
    })
    .join(" ");
}

async function readGallery() {
  const entries = await fs
    .readdir(GALLERY_DIR, { withFileTypes: true })
    .catch(() => []);
  const images = entries.filter((e) => {
    if (!e.isFile() || e.name.startsWith(".")) return false;
    const ext = path.extname(e.name).toLowerCase();
    return (
      ext !== ".webp" &&
      ext !== ".avif" &&
      [".png", ".jpg", ".jpeg", ".gif"].includes(ext)
    );
  });
  const records = await Promise.all(
    images.map(async (entry) => {
      const fullPath = path.join(GALLERY_DIR, entry.name);
      const stats = await fs.stat(fullPath);
      const publicPath = `gallery/${encodeURIComponent(entry.name)}`;
      return {
        url: publicPath,
        alt: altFromFilename(entry.name),
        caption: altFromFilename(entry.name),
        date: stats.mtime.toISOString(),
        imageMeta: await imageMetadata(publicPath),
      };
    }),
  );
  return records.sort((a, b) => b.date.localeCompare(a.date));
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (!value) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function readProjects() {
  let entries = [];
  try {
    entries = JSON.parse(await fs.readFile(PROJECTS_JSON, "utf8"));
  } catch {
    entries = [];
  }

  const projects = await Promise.all(
    entries
      .filter((entry) => entry && entry.title)
      .map(async (entry) => {
        const repo = String(entry.repo || "").trim();
        const repoName = repo ? repo.split("/").pop() : entry.title;
        const slug =
          entry.slug ||
          repoName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        const url = repo ? `https://github.com/${repo}` : "";
        const html = toPictureHtml(markdownToHtml(entry.body || entry.summary || ""));
        const image = normalizeAssetUrl(entry.ogImage || entry.images?.[0]?.src || "");
        return {
          id: slug,
          slug,
          repo,
          title: entry.title,
          summary:
            entry.summary ||
            (repo ? `GitHub repository for ${repoName}, part of SE1's work.` : ""),
          status: entry.status || "project",
          featured: Boolean(entry.featured),
          tags: normalizeList(entry.tags),
          stack: normalizeList(entry.stack),
          metrics: normalizeList(entry.metrics),
          role: entry.role || "",
          demo: entry.demo || "",
          paper: entry.paper || "",
          video: entry.video || "",
          article: entry.article || "",
          url,
          images: Array.isArray(entry.images) ? entry.images : [],
          image,
          imageMeta: await imageMetadata(image),
          started: entry.started || "",
          updated: entry.updated || entry.started || new Date().toISOString().slice(0, 10),
          date: entry.updated || entry.started || new Date().toISOString().slice(0, 10),
          dateLabel: entry.status || "project",
          html,
          text: stripHtml(html),
        };
      }),
  );

  return projects.sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    return b.updated.localeCompare(a.updated);
  });
}

function analyticsScripts(config) {
  const parts = [];
  if (config.analytics?.vercelAnalytics) {
    parts.push(`<script>
      window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
    </script>
    <script defer src="/_vercel/insights/script.js"></script>`);
  }
  if (config.analytics?.vercelSpeedInsights) {
    parts.push(`<script>
      window.si = window.si || function () { (window.siq = window.siq || []).push(arguments); };
    </script>
    <script defer src="/_vercel/speed-insights/script.js"></script>`);
  }
  return parts.join("\n");
}

function siteGraphJsonLd(config) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Person",
        "@id": `${config.baseUrl}/#person`,
        name: config.author.name,
        alternateName: config.author.alternateName,
        url: config.baseUrl,
        email: config.author.email,
        jobTitle: config.author.jobTitle,
        description: config.author.description,
        sameAs: config.author.sameAs || [],
        knowsAbout: config.author.knowsAbout || [],
      },
      {
        "@type": "WebSite",
        "@id": `${config.baseUrl}/#website`,
        url: `${config.baseUrl}/`,
        name: config.siteName,
        description: config.description,
        publisher: { "@id": `${config.baseUrl}/#person` },
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${config.baseUrl}/search?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };
}

function breadcrumbsJsonLd(config, crumbs) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: crumb.url,
    })),
  };
}

function itemListJsonLd(items) {
  return {
    "@type": "ItemList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: item.url,
    })),
  };
}

function metadataHead(config, page, assets, jsonLdGraph = []) {
  const pathName = page.path || "/";
  const title = page.title || config.seo.defaultTitle;
  const fullTitle = page.rawTitle
    ? title
    : title === config.seo.defaultTitle
      ? title
      : (config.seo.titleTemplate || "%s - SE1").replace("%s", title);
  const description = page.description || config.seo.defaultDescription;
  const canonical = page.canonical || canonicalUrl(config, pathName);
  const image = absoluteImageUrl(config, page.image);
  const type = page.type || "website";
  const robots = page.robots || "index, follow, max-image-preview:large";
  const graph = siteGraphJsonLd(config);
  graph["@graph"].push(...jsonLdGraph);

  return `<meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(fullTitle)}</title>
    <meta name="description" content="${escapeAttr(description)}" />
    <meta name="author" content="${escapeAttr(config.author.name)}" />
    <meta name="robots" content="${escapeAttr(robots)}" />
    <meta name="theme-color" content="${escapeAttr(config.seo.themeColor)}" />
    <link rel="canonical" href="${escapeAttr(canonical)}" />
    <meta property="og:site_name" content="${escapeAttr(config.siteName)}" />
    <meta property="og:title" content="${escapeAttr(fullTitle)}" />
    <meta property="og:description" content="${escapeAttr(description)}" />
    <meta property="og:type" content="${escapeAttr(type)}" />
    <meta property="og:url" content="${escapeAttr(canonical)}" />
    <meta property="og:image" content="${escapeAttr(image)}" />
    <meta property="og:image:width" content="640" />
    <meta property="og:image:height" content="640" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:locale" content="${escapeAttr(config.seo.locale)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="${escapeAttr(config.seo.twitterHandle)}" />
    <meta name="twitter:creator" content="${escapeAttr(config.seo.twitterHandle)}" />
    <meta name="twitter:title" content="${escapeAttr(fullTitle)}" />
    <meta name="twitter:description" content="${escapeAttr(description)}" />
    <meta name="twitter:image" content="${escapeAttr(image)}" />
    ${page.date ? `<meta property="article:published_time" content="${escapeAttr(page.date)}" />` : ""}
    ${page.updated ? `<meta property="article:modified_time" content="${escapeAttr(page.updated)}" />` : ""}
    <link rel="alternate" type="application/rss+xml" title="${escapeAttr(config.siteName)} - Articles" href="/feed.xml" />
    <link rel="alternate" type="application/feed+json" title="${escapeAttr(config.siteName)} - Articles" href="/feed.json" />
    <link rel="icon" type="image/jpeg" href="/assets/SE1.jpg" />
    <link rel="stylesheet" href="${assets.css}" />
    <script type="application/ld+json">${JSON.stringify(graph)}</script>
    ${analyticsScripts(config)}`;
}

function headerHtml(activePath = "") {
  const links = [
    ["/", "home"],
    ["/stack", "stack"],
    ["/updates", "updates"],
    ["/articles", "blogs"],
    ["/gallery", "gallery"],
    ["/projects", "projects"],
    ["/contact", "contact"],
  ];
  return `<header class="site-header">
      <div class="site-width header-inner">
        <a class="brand" href="/">
          <img class="brand-mark" src="/assets/SE1.jpg" alt="" width="640" height="640" decoding="async" />
          <span class="brand-copy"><strong>lonely guy</strong></span>
        </a>
        <nav class="header-nav static-header-nav" aria-label="Main">
          ${links
            .map(([href, label]) => {
              const current = activePath === href ? ' aria-current="page"' : "";
              return `<a class="tab-button" href="${href}"${current}>${label}</a>`;
            })
            .join("")}
        </nav>
      </div>
    </header>`;
}

function footerHtml(config) {
  return `<footer class="site-footer" id="footer">
      <div class="site-width footer-inner">
        <p class="footer-kicker">stuck in my head while making this</p>
        <blockquote class="footer-quote">
          "Your enemy is a resilient one. The thing you all oppose isn't just
          me. Nor is it heretics. It's part imagination and part curiosity. In
          short, it's truth itself"
        </blockquote>
        <div class="footer-meta">
          <span>this quote from ORB feels so deep, it was a banger. iykyk</span>
          <a href="/">back to home</a>
        </div>
        <p class="footer-copy">&copy; 2026 SE1. All rights reserved.</p>
      </div>
    </footer>`;
}

function shell(config, assets, page, body, jsonLdGraph = [], extraScripts = "") {
  const spaRedirect = page.spaRedirect
    ? `<script>if(!window.location.search){location.replace("${page.spaRedirect}")}</script>`
    : "";
  return `<!doctype html>
<html lang="en">
<head>
    ${metadataHead(config, page, assets, jsonLdGraph)}
</head>
<body>
    ${spaRedirect}
    <a class="skip-link" href="#main">skip to main</a>
    ${headerHtml(page.path)}
    <main class="site-width static-page" id="main">
      ${body}
    </main>
    ${footerHtml(config)}
    ${extraScripts}
    <script defer src="${assets.assistant}"></script>
</body>
</html>`;
}

function renderTagList(items, className = "meta-chip-list") {
  if (!items || !items.length) return "";
  return `<ul class="${className}">${items
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("")}</ul>`;
}

function renderLinkPills(links) {
  const valid = links.filter((link) => link && link.href);
  if (!valid.length) return "";
  return `<div class="reader-head-actions">${valid
    .map(
      (link) =>
        `<a href="${escapeAttr(link.href)}"${externalAttrs(link.href)}>${escapeHtml(link.label)}</a>`,
    )
    .join("")}</div>`;
}

function makeArticlePageHtml(config, assets, record, type) {
  const url = recordUrl(config, type, record.id);
  const imageUrl = absoluteImageUrl(config, record.image);
  const schemaType = type === "articles" ? "BlogPosting" : "Article";
  const collectionTitle =
    type === "articles" ? "Blogs" : type === "updates" ? "Updates" : "Papers";
  const jsonLd = [
    {
      "@type": schemaType,
      "@id": `${url}#post`,
      headline: record.title,
      description: record.summary,
      image: imageUrl,
      datePublished: record.date,
      dateModified: record.updated || record.date,
      author: { "@id": `${config.baseUrl}/#person` },
      publisher: { "@id": `${config.baseUrl}/#person` },
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
      isPartOf: { "@id": `${config.baseUrl}/#website` },
      keywords: record.tags || [],
      timeRequired: `PT${record.readingTime || 1}M`,
    },
    breadcrumbsJsonLd(config, [
      { name: "Home", url: canonicalUrl(config, "/") },
      { name: collectionTitle, url: collectionUrl(config, type) },
      { name: record.title, url },
    ]),
  ];

  // Add VideoObject for any YouTube embeds in the article body
  const videoIds = extractYouTubeIdsFromHtml(record.html);
  for (const videoId of videoIds) {
    jsonLd.push({
      "@type": "VideoObject",
      "@id": `${url}#video-${videoId}`,
      name: `${record.title} - video walkthrough`,
      description: record.summary,
      uploadDate: record.updated || record.date,
      embedUrl: `https://www.youtube.com/embed/${videoId}`,
      thumbnailUrl: imageUrl,
    });
  }
  const body = `<article>
        <div class="reader-head">
          <div>
            <p class="reader-kicker">${escapeHtml(record.dateLabel)}${record.readingTime ? ` / ${escapeHtml(record.readingTime)} min read` : ""}</p>
            <h1>${escapeHtml(record.title)}</h1>
          </div>
          ${renderLinkPills([{ label: `back to ${type === "articles" ? "blogs" : type}`, href: `/?t=${type}` }])}
        </div>
        <p class="static-page-summary">${escapeHtml(record.summary)}</p>
        ${renderTagList(record.tags)}
        <div class="reader-body">${toRootRelativePaths(record.html)}</div>
      </article>`;
  return shell(
    config,
    assets,
    {
      path: canonicalPath(`${type}/${record.id}`),
      title: record.seoTitle || record.title,
      description: record.seoDescription || record.summary,
      type: "article",
      image: record.image,
      date: record.date,
      updated: record.updated || record.date,
      canonical: record.canonical || url,
    },
    body,
    jsonLd,
  );
}

function projectLinks(record) {
  return [
    { label: "source", href: record.url },
    { label: "demo", href: record.demo },
    { label: "article", href: record.article },
    { label: "paper", href: record.paper },
    { label: "video", href: record.video },
  ].filter((item) => item.href);
}

function projectMediaHtml(record) {
  if (!record.images?.length) return "";
  return `<div class="project-media-grid">${record.images
    .map((image) => {
      const src = normalizeAssetUrl(image.src);
      const root = toRootPath(src);
      const base = root.replace(/\.(png|jpe?g)$/i, "");
      const picture = /\.(png|jpe?g)$/i.test(root)
        ? `<picture><source srcset="${base}.avif" type="image/avif"><source srcset="${base}.webp" type="image/webp"><img src="${root}" alt="${escapeAttr(image.alt || record.title)}" loading="lazy" decoding="async"></picture>`
        : `<img src="${escapeAttr(src)}" alt="${escapeAttr(image.alt || record.title)}" loading="lazy" decoding="async">`;
      return `<figure>${picture}<figcaption>${escapeHtml(image.alt || record.title)}</figcaption></figure>`;
    })
    .join("")}</div>`;
}

function shieldsBadgeUrl(item) {
  const params = new URLSearchParams({
    style: "flat-square",
    logoColor: item.logoColor || "white",
  });
  if (item.logo) params.set("logo", item.logo);
  if (item.logoSize) params.set("logoSize", item.logoSize);
  const labelPath = encodeURIComponent(item.label).replaceAll("-", "--");
  return `https://img.shields.io/badge/${labelPath}-${item.color}?${params.toString()}`;
}

function skillBadgeHtml(item) {
  return `<img class="skill-badge${item.hot ? " skill-badge--hot" : ""}" src="${escapeAttr(shieldsBadgeUrl(item))}" alt="${escapeAttr(item.label)}" loading="lazy" decoding="async">`;
}

function skillBadgeRow(items) {
  return `<div class="shield-row">${items.map(skillBadgeHtml).join("\n              ")}</div>`;
}

function stackBoardHtml(options = {}) {
  const headingTag = options.headingLevel === 3 ? "h3" : "h2";
  return `<div class="stack-board" aria-label="skill stack">
          <article class="stack-card">
            <div class="stack-card-head">
              <span class="stack-glyph">ML</span>
              <div>
                <${headingTag}>ml / ai</${headingTag}>
                <p>concepts, training methods, and the frameworks around them.</p>
              </div>
            </div>
            ${skillBadgeRow([
              { label: "reinforcement learning", color: "ff6b35", hot: true },
              { label: "deep learning", color: "dc2626" },
              { label: "transformers", color: "c4284a" },
              { label: "llms", color: "8b5cf6" },
              { label: "computer vision", color: "0891b2" },
              { label: "finetuning", color: "16a34a" },
              { label: "lora / peft", color: "059669" },
              { label: "quantization", color: "0d9488" },
              { label: "rag", color: "7c3aed" },
              { label: "agentic ai", color: "dc2626", hot: true },
              { label: "mcps", color: "ea580c" },
              { label: "classifiers", color: "2563eb" },
              { label: "logistic regression", color: "6366f1" },
              { label: "dqn", color: "e11d48" },
              { label: "pytorch", logo: "pytorch", color: "ee4c2c" },
              { label: "jax", logo: "jax", color: "5c6bc0" },
              { label: "numpy", logo: "numpy", color: "4dabcf" },
              { label: "hugging face", logo: "huggingface", color: "ffcc00", logoColor: "000000" },
              { label: "wandb", logo: "wandb", color: "ffcc33", logoColor: "000000" },
              { label: "scikit-learn", logo: "scikitlearn", color: "f7931e", logoColor: "000000" },
              { label: "stable baselines", color: "00599c" },
              { label: "gymnasium", color: "0081a5" },
              { label: "trackio", color: "a855f7" },
              { label: "trl", color: "f97316" },
              { label: "unsloth", color: "10b981" },
              { label: "openenv", color: "16a34a" },
              { label: "sentence transformers", color: "e16737" },
              { label: "matplotlib", logo: "matplotlib", color: "11557c" },
              { label: "seaborn", color: "4c72b0" },
              { label: "pillow", logo: "python", color: "3776ab" },
            ])}
            <p>
              supervised / unsupervised learning, rl, deep learning, llm basics,
              finetuning, peft, quantization, rag, agentic systems, mcp tooling,
              encoders, decoders, rnns, and the messy experimental tooling around them.
            </p>
          </article>

          <article class="stack-card">
            <div class="stack-card-head">
              <span class="stack-glyph">CODE</span>
              <div>
                <${headingTag}>languages + formats</${headingTag}>
                <p>stuff used to express models, systems, and simulations.</p>
              </div>
            </div>
            ${skillBadgeRow([
              { label: "python", logo: "python", color: "3776ab", hot: true },
              { label: "c/c++", logo: "cplusplus", color: "00599c" },
              { label: "javascript", logo: "javascript", color: "f7df1e", logoColor: "000000" },
              { label: "rust", logo: "rust", color: "ce422b" },
              { label: "matlab", logo: "mathworks", color: "e16737" },
              { label: "bash", logo: "gnubash", color: "4eaa25" },
              { label: "urdf", color: "cc8833" },
              { label: "html", logo: "html5", color: "e34f26" },
              { label: "css", logo: "css3", color: "1572b6" },
              { label: "mjcf", color: "a855f7" },
            ])}
          </article>

          <article class="stack-card">
            <div class="stack-card-head">
              <span class="stack-glyph">BOT</span>
              <div>
                <${headingTag}>robotics / sim / embedded</${headingTag}>
                <p>simulators, control intuition, and hardware-side basics.</p>
              </div>
            </div>
            ${skillBadgeRow([
              { label: "mujoco", color: "3c4f65", hot: true },
              { label: "simulink", color: "f2a900", logoColor: "000000" },
              { label: "ros", logo: "ros", color: "22314e" },
              { label: "arduino", logo: "arduino", color: "00878f" },
              { label: "raspberry pi", logo: "raspberrypi", color: "a22846" },
              { label: "simscape multibody", color: "f2a900", logoColor: "000000" },
            ])}
          </article>

          <article class="stack-card">
            <div class="stack-card-head">
              <span class="stack-glyph">SYS</span>
              <div>
                <${headingTag}>infra / dev / testing</${headingTag}>
                <p>the workbench around experiments and deployment.</p>
              </div>
            </div>
            ${skillBadgeRow([
              { label: "git", logo: "git", color: "f05032" },
              { label: "github", logo: "github", color: "181717" },
              { label: "github actions", logo: "githubactions", color: "2088ff" },
              { label: "ci/cd", color: "0284c7" },
              { label: "docker", logo: "docker", color: "2496ed" },
              { label: "wsl", logo: "windows", color: "0078d4" },
              { label: "tailscale", logo: "tailscale", color: "24253f" },
              { label: "pytest", logo: "pytest", color: "0a9edc", logoColor: "000000" },
              { label: "doctest", color: "6b21a8" },
              { label: "google test", color: "4285f4", logoColor: "000000" },
              { label: "google benchmarks", color: "34a853" },
              { label: "jupyter", logo: "jupyter", color: "f37626", logoColor: "000000" },
              { label: "colab", logo: "googlecolab", color: "f9ab00", logoColor: "000000" },
              { label: "parallax", color: "cc8833", logoColor: "000000" },
            ])}
            <p>
              also spent a good chunk of time on blockchain architecture, dapps,
              daos, and tokenomics. had its time, taught a lot, not the center
              of gravity right now.
            </p>
          </article>

          <article class="stack-card">
            <div class="stack-card-head">
              <span class="stack-glyph">WEB</span>
              <div>
                <${headingTag}>web / fullstack</${headingTag}>
                <p>frontends, backends, and the glue between them.</p>
              </div>
            </div>
            ${skillBadgeRow([
              { label: "next.js", logo: "nextdotjs", color: "000000" },
              { label: "node.js", logo: "nodedotjs", color: "339933" },
              { label: "fastapi", logo: "fastapi", color: "009688" },
              { label: "shadcn", color: "ffffff", logoColor: "000000" },
              { label: "three.js", logo: "threedotjs", color: "000000" },
              { label: "websocket", logo: "websocket", color: "0153be" },
              { label: "chrome extensions", logo: "googlechrome", color: "4285f4", logoColor: "ffffff" },
            ])}
          </article>

          <article class="stack-card">
            <div class="stack-card-head">
              <span class="stack-glyph">DATA</span>
              <div>
                <${headingTag}>cloud / data / compute</${headingTag}>
                <p>hosting, databases, and services around deployment.</p>
              </div>
            </div>
            ${skillBadgeRow([
              { label: "aws", logo: "amazonwebservices", color: "232f3e", logoColor: "ff9900" },
              { label: "vercel", logo: "vercel", color: "000000" },
              { label: "modal", logo: "modal", color: "1b1b1b" },
              { label: "supabase", logo: "supabase", color: "3ecf8e" },
              { label: "postgresql", logo: "postgresql", color: "4169e1" },
              { label: "redis", logo: "redis", color: "dc382d" },
              { label: "hf jobs", logo: "huggingface", color: "ffcc00", logoColor: "000000" },
              { label: "sentry", logo: "sentry", color: "362d59" },
            ])}
          </article>
        </div>

        <p class="stack-note">
          still not treating this as a certificate wall. skills are weird, they
          decay, improve, and change shape. judge me more by projects, writeups,
          and a conversation.
        </p>`;
}

function homepageStackPanelHtml() {
  return `<section
            class="tab-panel"
            id="panel-stack"
            role="tabpanel"
            aria-labelledby="tab-stack"
            hidden
          >
            <p class="panel-label">stack</p>
            <div class="panel-head">
              <h2>skill tree / sub stuff</h2>
              <p>
                this section is something ive always struggled with, when
                exactly could one call that they have acquired a certain skill,
                im sure the field keeps evolving... so its better to judge me by
                having a talk. also what if i learned something but forgot it,
                or learned it but cannot apply it.
              </p>
            </div>

            ${stackBoardHtml({ headingLevel: 3 })}
          </section>`;
}

function makeProjectPageHtml(config, assets, record) {
  const url = recordUrl(config, "projects", record.id);
  const jsonLd = [
    {
      "@type": "SoftwareSourceCode",
      "@id": `${url}#project`,
      name: record.title,
      description: record.summary,
      codeRepository: record.url || undefined,
      programmingLanguage: record.stack,
      keywords: record.tags,
      author: { "@id": `${config.baseUrl}/#person` },
      isPartOf: { "@id": `${config.baseUrl}/#website` },
    },
    breadcrumbsJsonLd(config, [
      { name: "Home", url: canonicalUrl(config, "/") },
      { name: "Projects", url: collectionUrl(config, "projects") },
      { name: record.title, url },
    ]),
  ];
  if (record.video) {
    const videoId = extractYouTubeId(record.video);
    if (videoId) {
      jsonLd.push({
        "@type": "VideoObject",
        name: `${record.title} walkthrough`,
        description: record.summary,
        uploadDate: record.updated,
        embedUrl: `https://www.youtube.com/embed/${videoId}`,
        thumbnailUrl: absoluteImageUrl(config, record.image),
      });
    }
  }

  const body = `<article>
        <div class="reader-head project-hero-head">
          <div>
            <p class="reader-kicker">${escapeHtml(record.status)}</p>
            <h1>${escapeHtml(record.title)}</h1>
          </div>
          ${renderLinkPills(projectLinks(record).concat([{ label: "all projects", href: "/?t=projects" }]))}
        </div>
        <p class="static-page-summary">${escapeHtml(record.summary)}</p>
        ${renderTagList(record.tags)}
        <dl class="project-facts">
          ${record.role ? `<div><dt>role</dt><dd>${escapeHtml(record.role)}</dd></div>` : ""}
          ${record.stack?.length ? `<div><dt>stack</dt><dd>${escapeHtml(record.stack.join(", "))}</dd></div>` : ""}
          ${record.metrics?.length ? `<div><dt>proof</dt><dd><ul>${record.metrics.map((m) => `<li>${escapeHtml(m)}</li>`).join("")}</ul></dd></div>` : ""}
        </dl>
        ${projectMediaHtml(record)}
        <div class="reader-body">${toRootRelativePaths(record.html)}</div>
      </article>`;
  return shell(
    config,
    assets,
    {
      path: canonicalPath(`projects/${record.id}`),
      title: record.title,
      description: record.summary,
      type: "article",
      image: record.image,
      date: record.started,
      updated: record.updated,
    },
    body,
    jsonLd,
  );
}

function makeCollectionPageHtml(config, assets, type, title, description, records) {
  const url = collectionUrl(config, type);
  const itemLinks = records.length
    ? records
        .map((record) => {
          const href = type === "projects" ? recordUrl(config, "projects", record.id) : recordUrl(config, type, record.id);
          const meta =
            type === "projects"
              ? record.status
              : [record.dateLabel, record.readingTime ? `${record.readingTime} min read` : ""]
                  .filter(Boolean)
                  .join(" / ");
          return `<li>
            <a href="${href}"><strong>${escapeHtml(record.title)}</strong></a>
            <span>${escapeHtml(meta || "")}</span>
            <p>${escapeHtml(record.summary || "")}</p>
          </li>`;
        })
        .join("")
    : `<li><span>Nothing published here yet.</span></li>`;
  const jsonLd = [
    {
      "@type": "CollectionPage",
      "@id": `${url}#webpage`,
      url,
      name: title,
      description,
      isPartOf: { "@id": `${config.baseUrl}/#website` },
      about: { "@id": `${config.baseUrl}/#person` },
    },
    itemListJsonLd(
      records.map((r) => ({
        name: r.title,
        url: type === "projects" ? recordUrl(config, "projects", r.id) : recordUrl(config, type, r.id),
      })),
    ),
    breadcrumbsJsonLd(config, [
      { name: "Home", url: canonicalUrl(config, "/") },
      { name: title, url },
    ]),
  ];
  const body = `<article>
        <div class="reader-head">
          <div>
            <p class="reader-kicker">${escapeHtml(type === "articles" ? "blogs" : type)}</p>
            <h1>${escapeHtml(title)}</h1>
          </div>
          ${renderLinkPills([{ label: "home", href: "/" }])}
        </div>
        <p class="static-page-summary">${escapeHtml(description)}</p>
        <ol class="static-link-list">${itemLinks}</ol>
      </article>`;
  return shell(
    config,
    assets,
    { path: canonicalPath(type), title, description, spaRedirect: `/?t=${type}` },
    body,
    jsonLd,
  );
}

function makeStaticInfoPage(config, assets, page) {
  const url = canonicalUrl(config, page.path);
  let bodyContent = "";
  if (page.id === "contact") {
    bodyContent = `<ul class="social-list static-contact-list">${config.socials
      .map(
        (social) =>
          `<li><span>${escapeHtml(social.label)}</span><a href="${escapeAttr(social.url)}" target="_blank" rel="${escapeAttr(social.rel || "noreferrer")} noreferrer">${escapeHtml(social.url.replace(/^https?:\/\//, ""))}</a></li>`,
      )
      .join("")}
      <li><span>email</span><a href="mailto:${escapeAttr(config.author.email)}">${escapeHtml(config.author.email)}</a></li>
      <li><span>backup email</span><a href="mailto:${escapeAttr(config.author.secondaryEmail)}">${escapeHtml(config.author.secondaryEmail)}</a></li>
      <li><span>discord</span><span>lonelyguy_se1</span></li>
    </ul>`;
  } else if (page.id === "stack") {
    bodyContent = stackBoardHtml();
  } else {
    bodyContent = `<div class="static-section-grid">${page.sections
      .map(
        (section) =>
          `<section><h2>${escapeHtml(section.title)}</h2><p>${escapeHtml(section.body)}</p></section>`,
      )
      .join("")}</div>`;
  }
  const jsonLd = [
    {
      "@type": "ProfilePage",
      "@id": `${url}#webpage`,
      url,
      name: page.title,
      description: page.description,
      mainEntity: { "@id": `${config.baseUrl}/#person` },
      isPartOf: { "@id": `${config.baseUrl}/#website` },
    },
    breadcrumbsJsonLd(config, [
      { name: "Home", url: canonicalUrl(config, "/") },
      { name: page.title, url },
    ]),
  ];
  const body = `<article>
        <div class="reader-head">
          <div>
            <p class="reader-kicker">${escapeHtml(page.kicker)}</p>
            <h1>${escapeHtml(page.title)}</h1>
          </div>
          ${renderLinkPills([{ label: "home", href: "/" }])}
        </div>
        <p class="static-page-summary">${escapeHtml(page.description)}</p>
        ${bodyContent}
      </article>`;
  return shell(config, assets, page, body, jsonLd);
}

function makeGalleryPageHtml(config, assets, gallery) {
  const url = canonicalUrl(config, "/gallery");
  const jsonLd = [
    {
      "@type": "CollectionPage",
      "@id": `${url}#webpage`,
      url,
      name: "Gallery",
      description:
        "Visual artifacts from SE1's robotics, reinforcement learning, cyber environment, and project work.",
      isPartOf: { "@id": `${config.baseUrl}/#website` },
    },
    itemListJsonLd(
      gallery.map((item) => ({
        name: item.caption,
        url: `${config.baseUrl}${toRootPath(item.url)}`,
      })),
    ),
    ...gallery.slice(0, 12).map((item) => ({
      "@type": "ImageObject",
      contentUrl: `${config.baseUrl}${toRootPath(item.url)}`,
      caption: item.caption,
      creator: { "@id": `${config.baseUrl}/#person` },
    })),
    breadcrumbsJsonLd(config, [
      { name: "Home", url: canonicalUrl(config, "/") },
      { name: "Gallery", url },
    ]),
  ];
  const grid = gallery.length
    ? gallery
        .map((item) => {
          const root = toRootPath(item.url);
          const base = root.replace(/\.(png|jpe?g)$/i, "");
          return `<figure class="gallery-item">
            <picture><source srcset="${base}.avif" type="image/avif"><source srcset="${base}.webp" type="image/webp"><img src="${root}" alt="${escapeAttr(item.alt)}" loading="lazy" decoding="async"></picture>
            <figcaption>${escapeHtml(item.caption)}</figcaption>
          </figure>`;
        })
        .join("")
    : `<p class="dynamic-note">No images added yet.</p>`;
  const body = `<article>
        <div class="reader-head">
          <div>
            <p class="reader-kicker">visual log</p>
            <h1>Gallery</h1>
          </div>
          ${renderLinkPills([{ label: "home", href: "/" }])}
        </div>
        <p class="static-page-summary">Visual artifacts from robotics, reinforcement learning, environment design, and build notes.</p>
        <div class="gallery-grid static-gallery-grid">${grid}</div>
      </article>`;
  return shell(
    config,
    assets,
    {
      path: "/gallery",
      title: "Gallery",
      description:
        "Visual artifacts from SE1's robotics, reinforcement learning, cyber environment, and project work.",
    },
    body,
    jsonLd,
  );
}

function makeSearchPageHtml(config, assets) {
  const url = canonicalUrl(config, "/search");
  const jsonLd = [
    {
      "@type": "SearchResultsPage",
      "@id": `${url}#webpage`,
      url,
      name: "Search",
      description: "Search SE1's portfolio, projects, articles, updates, and gallery.",
      isPartOf: { "@id": `${config.baseUrl}/#website` },
    },
    breadcrumbsJsonLd(config, [
      { name: "Home", url: canonicalUrl(config, "/") },
      { name: "Search", url },
    ]),
  ];
  const body = `<article>
        <div class="reader-head">
          <div>
            <p class="reader-kicker">site search</p>
            <h1>Search</h1>
          </div>
          ${renderLinkPills([{ label: "home", href: "/" }])}
        </div>
        <p class="static-page-summary">Search the public archive of projects, articles, updates, images, and pages.</p>
        <form class="static-search-form" action="/search" method="get">
          <label class="visually-hidden" for="static-search-input">Search query</label>
          <input id="static-search-input" name="q" type="search" placeholder="world models, cybersec, dqn..." autocomplete="off" />
          <button type="submit">search</button>
        </form>
        <div class="static-search-results" id="static-search-results" aria-live="polite"></div>
      </article>`;
  const script = `<script>
    (function () {
      var input = document.getElementById("static-search-input");
      var results = document.getElementById("static-search-results");
      var params = new URLSearchParams(window.location.search);
      var q = params.get("q") || "";
      input.value = q;
      function escapeHtml(value) {
        return String(value || "").replace(/[&<>"']/g, function (ch) {
          return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch];
        });
      }
      function render(query, index) {
        var terms = query.toLowerCase().split(/\\s+/).filter(Boolean);
        if (!terms.length) {
          results.innerHTML = '<p class="dynamic-note">Type a query to search the archive.</p>';
          return;
        }
        var scored = index.map(function (item) {
          var haystack = (item.title + " " + item.summary + " " + item.content).toLowerCase();
          var matches = terms.filter(function (term) { return haystack.indexOf(term) !== -1; }).length;
          var score = matches * 3 + (item.title.toLowerCase().indexOf(query.toLowerCase()) !== -1 ? 8 : 0);
          return { item: item, score: score };
        }).filter(function (row) { return row.score > 0; }).sort(function (a, b) { return b.score - a.score; }).slice(0, 20);
        results.innerHTML = scored.length ? '<ol class="static-link-list">' + scored.map(function (row) {
          return '<li><a href="' + escapeHtml(row.item.url) + '"><strong>' + escapeHtml(row.item.title) + '</strong></a><span>' + escapeHtml(row.item.type) + '</span><p>' + escapeHtml(row.item.summary) + '</p></li>';
        }).join('') + '</ol>' : '<p class="dynamic-note">No results found.</p>';
      }
      fetch("/search-index.json").then(function (res) { return res.json(); }).then(function (index) { render(q, index); });
    })();
  </script>`;
  return shell(
    config,
    assets,
    {
      path: "/search",
      title: "Search",
      description: "Search SE1's portfolio, projects, articles, updates, and gallery.",
    },
    body,
    jsonLd,
    script,
  );
}

async function writePage(routePath, html) {
  const clean = canonicalPath(routePath);
  const dir = clean === "/" ? ROOT : path.join(ROOT, clean.replace(/^\/+/, ""));
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "index.html"), html, "utf8");
  console.log(`  -> ${clean === "/" ? "index.html" : `${clean.slice(1)}/index.html`}`);
}

async function generatePages(config, assets, updates, articles, gallery, projects) {
  for (const record of updates) {
    await writePage(`/updates/${record.id}`, makeArticlePageHtml(config, assets, record, "updates"));
  }
  for (const record of articles) {
    await writePage(`/articles/${record.id}`, makeArticlePageHtml(config, assets, record, "articles"));
  }
  for (const record of projects) {
    await writePage(`/projects/${record.id}`, makeProjectPageHtml(config, assets, record));
  }

  await writePage(
    "/updates",
    makeCollectionPageHtml(
      config,
      assets,
      "updates",
      "Progress Updates",
      "Short progress logs from SE1 on reinforcement learning, robotics, embodied AI, and systems.",
      updates,
    ),
  );
  await writePage(
    "/articles",
    makeCollectionPageHtml(
      config,
      assets,
      "articles",
      "Blogs",
      "Longer technical write-ups from SE1 on reinforcement learning, LLMs, cyber environments, robotics, and systems.",
      articles,
    ),
  );
  await writePage(
    "/projects",
    makeCollectionPageHtml(
      config,
      assets,
      "projects",
      "Projects",
      "Selected project case studies from SE1 across embodied AI, RL, LLM agents, vision, systems, and simulation.",
      projects,
    ),
  );
  await writePage("/gallery", makeGalleryPageHtml(config, assets, gallery));
  await writePage("/search", makeSearchPageHtml(config, assets));

  for (const page of STATIC_PAGES.filter((p) => p.id !== "contact")) {
    await writePage(page.path, makeStaticInfoPage(config, assets, page));
  }
  await writePage("/contact", makeStaticInfoPage(config, assets, STATIC_PAGES.find((p) => p.id === "contact")));
}

function sitemapEntry(config, pathname, options = {}) {
  const imageTags = (options.images || [])
    .filter(Boolean)
    .filter((image) => {
      const raw = image.src || image;
      return !/^https?:\/\//i.test(raw) || String(raw).startsWith(config.baseUrl);
    })
    .map((image) => {
      const loc = absoluteImageUrl(config, image.src || image);
      const caption = image.alt || image.caption || "";
      return `<image:image><image:loc>${escapeXml(loc)}</image:loc>${caption ? `<image:caption>${escapeXml(caption)}</image:caption>` : ""}</image:image>`;
    })
    .join("");
  const videoTags = (options.videos || [])
    .filter((v) => v && v.id)
    .map((video) => {
      const embedUrl = `https://www.youtube.com/embed/${escapeXml(video.id)}`;
      const thumbnail = video.thumbnail ? escapeXml(absoluteImageUrl(config, video.thumbnail)) : "";
      return `<video:video><video:thumbnail_loc>${thumbnail}</video:thumbnail_loc><video:title>${escapeXml(video.title || "Video walkthrough")}</video:title><video:description>${escapeXml(video.description || "Video walkthrough")}</video:description><video:content_loc>https://www.youtube.com/watch?v=${escapeXml(video.id)}</video:content_loc><video:embed_loc>${escapeXml(embedUrl)}</video:embed_loc><video:publication_date>${escapeXml(video.date || "")}</video:publication_date></video:video>`;
    })
    .join("");
  return `<url><loc>${escapeXml(canonicalUrl(config, pathname))}</loc>${options.lastmod ? `<lastmod>${escapeXml(options.lastmod)}</lastmod>` : ""}<changefreq>${options.changefreq || "monthly"}</changefreq><priority>${options.priority || "0.7"}</priority>${imageTags}${videoTags}</url>`;
}

async function generateSitemap(config, updates, articles, gallery, projects) {
  const entries = [
    sitemapEntry(config, "/", { changefreq: "weekly", priority: "1.0" }),
    sitemapEntry(config, "/stack", { changefreq: "monthly", priority: "0.7" }),
    sitemapEntry(config, "/contact", { changefreq: "yearly", priority: "0.6" }),
    sitemapEntry(config, "/search", { changefreq: "monthly", priority: "0.4" }),
    sitemapEntry(config, "/gallery", {
      changefreq: "monthly",
      priority: "0.7",
      images: gallery.map((item) => ({ src: item.url, caption: item.caption })),
    }),
    sitemapEntry(config, "/updates", { changefreq: "weekly", priority: "0.8" }),
    sitemapEntry(config, "/articles", { changefreq: "weekly", priority: "0.8" }),
    sitemapEntry(config, "/projects", { changefreq: "monthly", priority: "0.8" }),
  ];
  for (const r of updates) entries.push(sitemapEntry(config, `/updates/${r.id}`, { lastmod: r.updated || r.date, priority: "0.7", images: r.image ? [{ src: r.image }] : [] }));
  for (const r of articles) {
    const articleVideoIds = extractYouTubeIdsFromHtml(r.html);
    entries.push(sitemapEntry(config, `/articles/${r.id}`, {
      lastmod: r.updated || r.date,
      priority: "0.9",
      images: r.image ? [{ src: r.image }] : [],
      videos: articleVideoIds.map((id) => ({
        id,
        title: `${r.title} - video walkthrough`,
        description: r.summary,
        thumbnail: r.image,
        date: r.updated || r.date,
      })),
    }));
  }
  for (const r of projects) {
    const projectVideos = [];
    if (r.video) {
      const videoId = extractYouTubeId(r.video);
      if (videoId) {
        projectVideos.push({
          id: videoId,
          title: `${r.title} walkthrough`,
          description: r.summary,
          thumbnail: r.image,
          date: r.updated,
        });
      }
    }
    entries.push(sitemapEntry(config, `/projects/${r.id}`, {
      lastmod: r.updated,
      priority: r.featured ? "0.85" : "0.7",
      images: r.images || [],
      videos: projectVideos,
    }));
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${entries.join("\n")}
</urlset>`;
  await fs.writeFile(path.join(ROOT, "sitemap.xml"), xml, "utf8");
  console.log("  -> sitemap.xml");
}

function rssDate(dateStr) {
  return new Date(dateStr).toUTCString();
}

async function generateRssFeed(config, articles) {
  const items = articles.map((r) => {
    const url = recordUrl(config, "articles", r.id);
    const imageTag = r.image
      ? `<figure><img src="${absoluteImageUrl(config, r.image)}" alt="" /></figure>`
      : "";
    return `    <item>
      <title><![CDATA[${r.title}]]></title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${rssDate(r.date)}</pubDate>
      <description><![CDATA[${r.summary}]]></description>
      <content:encoded><![CDATA[${imageTag}${toRootRelativePaths(r.html)}]]></content:encoded>
      <author>${escapeHtml(config.author.email || "")} (${escapeHtml(config.author.name)})</author>
    </item>`;
  });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeHtml(config.siteName)}</title>
    <link>${canonicalUrl(config, "/")}</link>
    <description>${escapeHtml(config.description)}</description>
    <language>${escapeHtml(config.seo.language)}</language>
    <lastBuildDate>${rssDate(new Date().toISOString())}</lastBuildDate>
    <atom:link href="${config.baseUrl}/feed.xml" rel="self" type="application/rss+xml" />
${items.join("\n")}
  </channel>
</rss>`;
  await fs.writeFile(path.join(ROOT, "feed.xml"), xml, "utf8");
  console.log("  -> feed.xml");
}

async function generateJsonFeed(config, articles) {
  const items = articles.map((r) => {
    const url = recordUrl(config, "articles", r.id);
    return {
      id: url,
      url,
      title: r.title,
      summary: r.summary,
      content_html: toRootRelativePaths(r.html),
      image: absoluteImageUrl(config, r.image),
      date_published: `${r.date}T00:00:00Z`,
      date_modified: `${r.updated || r.date}T00:00:00Z`,
      tags: r.tags,
      author: { name: config.author.name, url: canonicalUrl(config, "/") },
    };
  });
  const feed = {
    version: "https://jsonfeed.org/version/1.1",
    title: config.siteName,
    home_page_url: canonicalUrl(config, "/"),
    feed_url: `${config.baseUrl}/feed.json`,
    description: config.description,
    authors: [{ name: config.author.name, url: canonicalUrl(config, "/") }],
    language: config.seo.language,
    items,
  };
  await fs.writeFile(path.join(ROOT, "feed.json"), JSON.stringify(feed, null, 2), "utf8");
  console.log("  -> feed.json");
}

function makeSearchRecords(config, updates, articles, gallery, projects) {
  const records = [
    {
      type: "page",
      title: "Home",
      summary: config.description,
      url: "/",
      content: config.author.description || "",
    },
    ...STATIC_PAGES.map((page) => ({
      type: "page",
      title: page.title,
      summary: page.description,
      url: page.path,
      content: page.sections.map((section) => `${section.title} ${section.body}`).join(" "),
    })),
    {
      type: "page",
      title: "Gallery",
      summary: "Visual artifacts from SE1's robotics, reinforcement learning, cyber environment, and project work.",
      url: "/gallery",
      content: gallery.map((item) => item.caption).join(" "),
    },
  ];
  for (const [type, items] of [
    ["updates", updates],
    ["articles", articles],
  ]) {
    for (const item of items) {
      records.push({
        type,
        title: item.title,
        summary: item.summary,
        url: canonicalPath(`${type}/${item.id}`),
        date: item.date,
        tags: item.tags || [],
        content: item.text || "",
      });
    }
  }
  for (const item of projects) {
    records.push({
      type: "projects",
      title: item.title,
      summary: item.summary,
      url: canonicalPath(`projects/${item.id}`),
      date: item.updated,
      tags: item.tags || [],
      content: [item.text, item.stack?.join(" "), item.metrics?.join(" ")].filter(Boolean).join(" "),
    });
  }
  for (const item of gallery) {
    records.push({
      type: "gallery",
      title: item.caption,
      summary: item.alt,
      url: "/gallery",
      content: item.url,
    });
  }
  return records;
}

async function generateMachineIndexes(config, updates, articles, gallery, projects) {
  const searchRecords = makeSearchRecords(config, updates, articles, gallery, projects);
  await fs.writeFile(SEARCH_INDEX_JSON, JSON.stringify(searchRecords, null, 2), "utf8");
  const siteIndex = {
    site: {
      name: config.siteName,
      url: canonicalUrl(config, "/"),
      description: config.description,
      author: config.author,
    },
    generatedAt: new Date().toISOString(),
    routes: searchRecords.map((record) => ({
      type: record.type,
      title: record.title,
      url: canonicalUrl(config, record.url),
      summary: record.summary,
      tags: record.tags || [],
      date: record.date || "",
    })),
  };
  await fs.writeFile(SITE_INDEX_JSON, JSON.stringify(siteIndex, null, 2), "utf8");
  console.log("  -> search-index.json");
  console.log("  -> site-index.json");
}

async function generateLlmsTxt(config, updates, articles, projects) {
  const lines = [
    `# ${config.siteName}`,
    `> ${config.description}`,
    "",
    `${config.author.name} (${config.author.alternateName}) is building toward autonomous robotic assistants through reinforcement learning, robotics, world models, embodied AI, LLM agents, and systems work.`,
    "",
    "## Navigation",
    `- Home: ${canonicalUrl(config, "/")}`,
    `- Stack: ${canonicalUrl(config, "/stack")}`,
    `- Projects: ${collectionUrl(config, "projects")}`,
    `- Articles: ${collectionUrl(config, "articles")}`,
    `- Updates: ${collectionUrl(config, "updates")}`,
    `- Gallery: ${canonicalUrl(config, "/gallery")}`,
    `- Search index JSON: ${config.baseUrl}/search-index.json`,
    `- Site index JSON: ${config.baseUrl}/site-index.json`,
    "",
  ];
  if (projects.length) {
    lines.push("## Projects");
    for (const r of projects) lines.push(`- [${r.title}](${recordUrl(config, "projects", r.id)}): ${r.summary}`);
    lines.push("");
  }
  if (articles.length) {
    lines.push("## Articles");
    for (const r of articles) lines.push(`- [${r.title}](${recordUrl(config, "articles", r.id)}): ${r.summary}`);
    lines.push("");
  }
  if (updates.length) {
    lines.push("## Updates");
    for (const r of updates) lines.push(`- [${r.title}](${recordUrl(config, "updates", r.id)}): ${r.summary}`);
    lines.push("");
  }
  lines.push("## Profiles");
  for (const social of config.socials || []) lines.push(`- [${social.label}](${social.url})`);
  await fs.writeFile(path.join(ROOT, "llms.txt"), lines.join("\n"), "utf8");
  console.log("  -> llms.txt");
}

async function hashAndCopyAsset(sourcePath, publicName) {
  let content = await fs.readFile(sourcePath);
  if (path.extname(publicName) === ".css") {
    content = Buffer.from(
      content
        .toString("utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\s*([{}:;,>])\s*/g, "$1")
        .replace(/\s+/g, " ")
        .replace(/;}/g, "}")
        .trim(),
      "utf8",
    );
  }
  const hash = crypto.createHash("sha256").update(content).digest("hex").slice(0, 10);
  const ext = path.extname(publicName);
  const base = publicName.slice(0, -ext.length);
  const fileName = `${base}.${hash}${ext}`;
  await fs.mkdir(BUILD_DIR, { recursive: true });
  await fs.writeFile(path.join(BUILD_DIR, fileName), content);
  return `/assets/build/${fileName}`;
}

async function generateAssetManifest() {
  await fs.rm(BUILD_DIR, { recursive: true, force: true });
  await fs.mkdir(BUILD_DIR, { recursive: true });
  const manifest = {
    css: await hashAndCopyAsset(path.join(ROOT, "styles", "main.css"), "main.css"),
    content: await hashAndCopyAsset(CONTENT_JS, "content.js"),
    main: await hashAndCopyAsset(path.join(ROOT, "scripts", "main.js"), "main.js"),
    assistant: await hashAndCopyAsset(path.join(ROOT, "scripts", "assistant.js"), "assistant.js"),
  };
  await fs.writeFile(path.join(BUILD_DIR, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  console.log("  -> assets/build/manifest.json");
  return manifest;
}

function updateHeadJsonLd(html, config, projects, articles) {
  const graph = siteGraphJsonLd(config);
  graph["@graph"].push(
    {
      "@type": "ProfilePage",
      "@id": `${config.baseUrl}/#webpage`,
      url: canonicalUrl(config, "/"),
      name: config.seo.defaultTitle,
      description: config.seo.defaultDescription,
      mainEntity: { "@id": `${config.baseUrl}/#person` },
      isPartOf: { "@id": `${config.baseUrl}/#website` },
    },
    itemListJsonLd([
      ...projects.slice(0, 4).map((p) => ({ name: p.title, url: recordUrl(config, "projects", p.id) })),
      ...articles.slice(0, 3).map((a) => ({ name: a.title, url: recordUrl(config, "articles", a.id) })),
    ]),
    breadcrumbsJsonLd(config, [{ name: "Home", url: canonicalUrl(config, "/") }]),
  );

  const replacement = `<!-- JSON-LD: site-wide entity graph -->
    <script type="application/ld+json">
      ${JSON.stringify(graph, null, 6)}
    </script>`;
  return html.replace(
    /<!-- JSON-LD: site-wide entity graph -->\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/,
    replacement,
  );
}

async function updateHomepage(config, assets, updates, articles, projects) {
  const indexPath = path.join(ROOT, "index.html");
  let html = await fs.readFile(indexPath, "utf8");

  html = html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(config.seo.defaultTitle)}</title>`)
    .replace(
      /<meta\s+name="description"\s+content="[\s\S]*?"\s*\/>/,
      `<meta name="description" content="${escapeAttr(config.seo.defaultDescription)}" />`,
    )
    .replace(/<meta name="author" content="[^"]*"\s*\/>/, `<meta name="author" content="${escapeAttr(config.author.name)}" />`)
    .replace(/<link rel="canonical" href="[^"]*"\s*\/>/, `<link rel="canonical" href="${canonicalUrl(config, "/")}" />`)
    .replace(/\s*<meta name="google-site-verification" content="[^"]*"\s*\/>\n?/, "\n")
    .replace(/<meta property="og:site_name" content="[^"]*"\s*\/>/, `<meta property="og:site_name" content="${escapeAttr(config.siteName)}" />`)
    .replace(/<meta\s+property="og:title"\s+content="[\s\S]*?"\s*\/>/, `<meta property="og:title" content="${escapeAttr(config.seo.defaultTitle)}" />`)
    .replace(/<meta\s+property="og:description"\s+content="[\s\S]*?"\s*\/>/, `<meta property="og:description" content="${escapeAttr(config.seo.defaultDescription)}" />`)
    .replace(/<meta property="og:url" content="[^"]*"\s*\/>/, `<meta property="og:url" content="${canonicalUrl(config, "/")}" />`)
    .replace(/<meta\s+property="og:image"\s+content="[\s\S]*?"\s*\/>/, `<meta property="og:image" content="${absoluteImageUrl(config)}" />`)
    .replace(/<meta name="twitter:site" content="[^"]*"\s*\/>/, `<meta name="twitter:site" content="${escapeAttr(config.seo.twitterHandle)}" />`)
    .replace(/<meta name="twitter:creator" content="[^"]*"\s*\/>/, `<meta name="twitter:creator" content="${escapeAttr(config.seo.twitterHandle)}" />`)
    .replace(/<meta\s+name="twitter:title"\s+content="[\s\S]*?"\s*\/>/, `<meta name="twitter:title" content="${escapeAttr(config.seo.defaultTitle)}" />`)
    .replace(/<meta\s+name="twitter:description"\s+content="[\s\S]*?"\s*\/>/, `<meta name="twitter:description" content="${escapeAttr(config.seo.defaultDescription)}" />`)
    .replace(/<meta\s+name="twitter:image"\s+content="[\s\S]*?"\s*\/>/, `<meta name="twitter:image" content="${absoluteImageUrl(config)}" />`);

  html = updateHeadJsonLd(html, config, projects, articles);

  const speculationRules = `<!-- Speculation Rules: conservative same-origin prerender -->
    <script type="speculationrules">
      {
        "prerender": [
          { "where": { "href_matches": "/articles/*" }, "eagerness": "conservative" },
          { "where": { "href_matches": "/projects/*" }, "eagerness": "conservative" }
        ],
        "prefetch": [
          { "where": { "href_matches": "/articles" }, "eagerness": "conservative" },
          { "where": { "href_matches": "/projects" }, "eagerness": "conservative" }
        ]
      }
    </script>`;
  html = html.replace(/<!-- Speculation Rules:[\s\S]*?<\/script>/, speculationRules);

  html = html
    .replace(/<link rel="stylesheet" href="(?:styles\/main\.css|\/assets\/build\/main\.[^"]+\.css)" \/>/, `<link rel="stylesheet" href="${assets.css}" />`)
    .replace(/(?:<script>window\.PORTFOLIO_CONTENT_SRC="[^"]+";<\/script>|<script(?:\s+defer)? src="(?:scripts\/content\.js|\/assets\/build\/content\.[^"]+\.js)"><\/script>)/, `<script>window.PORTFOLIO_CONTENT_SRC="${assets.content}";</script>`)
    .replace(/<script(?:\s+defer)? src="(?:scripts\/main\.js|\/assets\/build\/main\.[^"]+\.js)"><\/script>/, `<script defer src="${assets.main}"></script>`)
    .replace(/<script(?:\s+defer)? src="(?:scripts\/assistant\.js|\/assets\/build\/assistant\.[^"]+\.js)"><\/script>/, `<script defer src="${assets.assistant}"></script>`);

  html = html.replace(
    /<section\s+class="tab-panel"\s+id="panel-stack"[\s\S]*?(?=\s*<section\s+class="tab-panel"\s+id="panel-(?:updates)")/,
    homepageStackPanelHtml(),
  );

  await fs.writeFile(indexPath, html, "utf8");
  console.log("  -> index.html metadata/assets");
}

async function build() {
  console.log("building content...");
  const config = await loadSiteConfig();

  console.log("converting images...");
  await convertImages();

  const [updates, articles, gallery, projects] = await Promise.all([
    readMarkdownCollection(COLLECTION_DIRS.updates),
    readMarkdownCollection(COLLECTION_DIRS.articles),
    readGallery(),
    readProjects(),
  ]);
  const content = { updates, articles, gallery, projects };
  await fs.writeFile(CONTENT_JS, `window.PORTFOLIO_CONTENT=${JSON.stringify(content)};\n`, "utf8");
  console.log("  -> scripts/content.js");

  console.log("hashing assets...");
  const assets = await generateAssetManifest();

  console.log("generating pages...");
  await generatePages(config, assets, updates, articles, gallery, projects);

  console.log("generating sitemap...");
  await generateSitemap(config, updates, articles, gallery, projects);

  console.log("generating feeds...");
  await Promise.all([generateRssFeed(config, articles), generateJsonFeed(config, articles)]);

  console.log("generating machine indexes...");
  await generateMachineIndexes(config, updates, articles, gallery, projects);

  console.log("generating llms.txt...");
  await generateLlmsTxt(config, updates, articles, projects);

  console.log("updating homepage...");
  await updateHomepage(config, assets, updates, articles, projects);

  console.log("done.");
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
