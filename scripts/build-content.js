const fs = require("fs/promises");
const fsSync = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const BASE_URL = "https://lonelyguy.vercel.app";

const COLLECTION_DIRS = {
  updates: path.join(ROOT, "updates"),
  articles: path.join(ROOT, "articles"),
  papers: path.join(ROOT, "papers"),
};
const GALLERY_DIR = path.join(ROOT, "gallery");
const CONTENT_JS = path.join(__dirname, "content.js");

function normalizeLineEndings(value) {
  return value.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toPictureHtml(html) {
  return html.replace(
    /<img src="(gallery\/[^"]+?)\.(png|jpe?g)" alt="([^"]*?)"(.*?)>/gi,
    (match, path, ext, alt, extra) => {
      return `<picture><source srcset="${path}.avif" type="image/avif"><source srcset="${path}.webp" type="image/webp"><img src="${path}.${ext}" alt="${alt}"${extra} loading="lazy"></picture>`;
    }
  );
}

async function convertImages() {
  const galleryDir = path.join(ROOT, "gallery");
  const targets = [];

  try {
    const files = await fs.readdir(galleryDir);
    for (const f of files) {
      if (/\.(png|jpe?g)$/i.test(f)) targets.push(path.join(galleryDir, f));
    }
  } catch {}
  try {
    const yuri = path.join(ROOT, "assets", "yuri.png");
    if (fsSync.existsSync(yuri)) targets.push(yuri);
  } catch {}

  if (!targets.length) return;

  for (const file of targets) {
    const base = file.replace(/\.\w+$/, "");
    const webpPath = base + ".webp";
    const avifPath = base + ".avif";

    const [webpExists, avifExists] = await Promise.all([
      fs.access(webpPath).then(() => true).catch(() => false),
      fs.access(avifPath).then(() => true).catch(() => false),
    ]);

    if (webpExists && avifExists) continue;

    const img = sharp(file);
    const meta = await img.metadata();
    if (!webpExists) await img.webp({ quality: 80, effort: 6 }).toFile(webpPath);
    if (!avifExists) await img.avif({ quality: 65, effort: 4 }).toFile(avifPath);
    console.log(`  → ${path.basename(file)} → webp + avif`);
  }
}

function normalizeAssetUrl(assetPath) {
  if (!assetPath) return "";
  const normalized = assetPath.trim().replace(/\\/g, "/");
  if (!normalized) return "";
  if (/^https?:\/\//i.test(normalized) || normalized.startsWith("/")) return normalized;
  if (/\.(png|jpe?g|webp|gif|svg)$/i.test(normalized) && !normalized.includes("/")) {
    return `gallery/${normalized}`;
  }
  return normalized;
}

function toRootRelativePaths(html) {
  return html.replace(/(src="|srcset=")(gallery\/)/g, '$1/$2');
}

function inlineMarkdown(text) {
  const escaped = escapeHtml(text);
  return escaped
    .replace(
      /\[!\[([^\]]*)\]\(([^)]+)\)\]\(([^)]+)\)/g,
      (_, alt, imgUrl, linkUrl) => `<a href="${escapeHtml(linkUrl)}" target="_blank" rel="noreferrer"><img src="${escapeHtml(imgUrl)}" alt="${alt}"></a>`,
    )
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
      return `<img src="${escapeHtml(normalizeAssetUrl(src))}" alt="${alt}">`;
    })
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      (_, text, url) => `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(text)}</a>`,
    )
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

function markdownToHtml(markdown) {
  const blocks = normalizeLineEndings(markdown)
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  return blocks
    .map((block) => {
      if (block.startsWith("```") && block.endsWith("```")) {
        const code = block.replace(/^```[\w-]*\n?/, "").replace(/\n?```$/, "");
        return `<pre><code>${escapeHtml(code)}</code></pre>`;
      }
      if (/^#{1,6}\s/.test(block)) {
        const m = block.match(/^(#{1,6})\s(.+)$/);
        return `<h${m[1].length}>${inlineMarkdown(m[2])}</h${m[1].length}>`;
      }
      if (block.split("\n").every((l) => /^[-*]\s/.test(l))) {
        const items = block.split("\n").map((l) => l.replace(/^[-*]\s/, "")).map((l) => `<li>${inlineMarkdown(l)}</li>`).join("");
        return `<ul>${items}</ul>`;
      }
      if (block.split("\n").every((l) => /^\d+\.\s/.test(l))) {
        const items = block.split("\n").map((l) => l.replace(/^\d+\.\s/, "")).map((l) => `<li>${inlineMarkdown(l)}</li>`).join("");
        return `<ol>${items}</ol>`;
      }
      if (block.split("\n").every((l) => /^>\s?/.test(l))) {
        const quote = block.split("\n").map((l) => l.replace(/^>\s?/, "")).join(" ");
        return `<blockquote>${inlineMarkdown(quote)}</blockquote>`;
      }
      if (/^!\[([^\]]*)\]\(([^)]+)\)$/.test(block)) {
        const m = block.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
        return `<div class="reader-media"><img src="${escapeHtml(normalizeAssetUrl(m[2]))}" alt="${escapeHtml(m[1])}"></div>`;
      }
      if (/^---$/.test(block.trim())) {
        return `<hr>`;
      }
      const paragraph = block.split("\n").map((l) => inlineMarkdown(l)).join("<br>");
      return `<p>${paragraph}</p>`;
    })
    .join("");
}

function parseFrontmatter(rawText, fallbackDate) {
  const text = normalizeLineEndings(rawText);
  if (!text.startsWith("---\n")) return { attributes: {}, body: text.trim(), dateLabel: fallbackDate };
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { attributes: {}, body: text.trim(), dateLabel: fallbackDate };
  const attributes = {};
  for (const line of m[1].split("\n")) {
    const sep = line.indexOf(":");
    if (sep === -1) continue;
    attributes[line.slice(0, sep).trim()] = line.slice(sep + 1).trim();
  }
  return { attributes, body: m[2].trim(), dateLabel: attributes.date || fallbackDate };
}

function toSlug(fileName) {
  return fileName.replace(/\.[^.]+$/, "");
}

function formatFallbackTitle(slug) {
  const withoutDate = slug.replace(/^\d{4}-\d{2}-\d{2}[-_]?/, "");
  return (withoutDate || slug).replace(/[-_]/g, " ");
}

function extractFirstImage(markdownBody) {
  const m = normalizeLineEndings(markdownBody).match(/!\[[^\]]*\]\(([^)]+)\)/);
  return m ? m[1] : "";
}

function fallbackSummary(markdownBody) {
  const line = normalizeLineEndings(markdownBody)
    .split(/\n+/)
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith("#") && !l.startsWith("-") && !l.startsWith("!"));
  return line || "no summary yet.";
}

function altFromFilename(filename) {
  const slug = filename.replace(/\.[^.]+$/, "");
  const parts = slug.split(".").filter(Boolean);
  if (parts.length <= 2) return parts.join(" ");
  return parts
    .map((p, i) => {
      if (i === 0) return p;
      if (p === "breakout") return "breakout";
      if (p === "preprocessing") return "preprocessing";
      if (p === "graph") return "training graph";
      if (p === "result") return "result";
      return p;
    })
    .join(" ");
}

async function readMarkdownCollection(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
  const files = entries.filter((e) => e.isFile() && e.name.endsWith(".md"));
  const records = await Promise.all(
    files.map(async (entry) => {
      const filePath = path.join(directory, entry.name);
      const stats = await fs.stat(filePath);
      const rawText = await fs.readFile(filePath, "utf8");
      const fallbackDate = stats.mtime.toISOString().slice(0, 10);
      const parsed = parseFrontmatter(rawText, fallbackDate);
      return {
        id: toSlug(entry.name),
        title: parsed.attributes.title || formatFallbackTitle(toSlug(entry.name)),
        date: parsed.attributes.date || fallbackDate,
        dateLabel: parsed.dateLabel,
        summary: parsed.attributes.summary || fallbackSummary(parsed.body),
        image: normalizeAssetUrl(parsed.attributes.image || extractFirstImage(parsed.body)),
        html: toPictureHtml(markdownToHtml(parsed.body)),
      };
    }),
  );
  return records.sort((a, b) => b.date.localeCompare(a.date));
}

async function readGallery() {
  const entries = await fs.readdir(GALLERY_DIR, { withFileTypes: true }).catch(() => []);
  const images = entries.filter((e) => {
    if (!e.isFile() || e.name.startsWith(".")) return false;
    const ext = path.extname(e.name).toLowerCase();
    return ext !== ".webp" && ext !== ".avif" && [".png", ".jpg", ".jpeg", ".gif"].includes(ext);
  });
  const records = await Promise.all(
    images.map(async (entry) => {
      const stats = await fs.stat(path.join(GALLERY_DIR, entry.name));
      return {
        url: `gallery/${encodeURIComponent(entry.name)}`,
        alt: altFromFilename(entry.name),
        caption: altFromFilename(entry.name),
        date: stats.mtime.toISOString(),
      };
    }),
  );
  return records.sort((a, b) => b.date.localeCompare(a.date));
}

function makePageHtml(record, type, slug) {
  const url = `${BASE_URL}/${type}/${slug}/`;
  const imageUrl = record.image
    ? (record.image.startsWith("http") ? record.image : `${BASE_URL}/${record.image}`)
    : `${BASE_URL}/assets/SE1.jpg`;
  const htmlContent = toRootRelativePaths(record.html);
  const articleType = type === "articles" ? "BlogPosting" : "Article";
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": articleType,
        "@id": `${url}#post`,
        headline: record.title,
        description: record.summary,
        image: imageUrl,
        datePublished: record.date,
        dateModified: record.date,
        author: { "@id": `${BASE_URL}/#person` },
        publisher: { "@id": `${BASE_URL}/#person` },
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
        isPartOf: { "@id": `${BASE_URL}/#website` },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": BASE_URL },
          { "@type": "ListItem", "position": 2, "name": type, "item": `${BASE_URL}/#${type}` },
          { "@type": "ListItem", "position": 3, "name": record.title, "item": url },
        ],
      },
    ],
  });

  return `<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(record.title)} — Lonely Guy</title>
    <meta name="description" content="${escapeHtml(record.summary)} — lonely guy's portfolio on reinforcement learning, robotics, and embodied ai." />
    <meta name="keywords" content="reinforcement learning, robotics, embodied AI, ${escapeHtml(record.title.toLowerCase())}" />
    <link rel="canonical" href="${url}" />
    <meta property="og:site_name" content="Lonely Guy" />
    <meta property="og:title" content="${escapeHtml(record.title)}" />
    <meta property="og:description" content="${escapeHtml(record.summary)}" />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@lonelyguyse1" />
    <meta name="twitter:creator" content="@lonelyguyse1" />
    <meta name="twitter:title" content="${escapeHtml(record.title)}" />
    <meta name="twitter:description" content="${escapeHtml(record.summary)}" />
    <meta name="twitter:image" content="${imageUrl}" />
    <link rel="icon" type="image/jpeg" href="../../assets/SE1.jpg" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="../../styles/main.css" />
    <script type="application/ld+json">${jsonLd}</script>
    <!-- Vercel Analytics -->
    <script>
      window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
    </script>
    <script defer src="/_vercel/insights/script.js"></script>
    <!-- Vercel Speed Insights -->
    <script>
      window.si = window.si || function () { (window.siq = window.siq || []).push(arguments); };
    </script>
    <script defer src="/_vercel/speed-insights/script.js"></script>
</head>
<body>
    <a class="skip-link" href="#main">skip to main</a>

    <header class="site-header">
      <div class="site-width header-inner">
        <a class="brand" href="../../index.html">
          <img class="brand-mark" src="../../assets/SE1.jpg" alt="" />
          <span class="brand-copy"><strong>lonely guy</strong></span>
        </a>
        <nav class="breadcrumbs" aria-label="Breadcrumb">
          <ol class="breadcrumb-list">
            <li><a href="../../index.html">home</a></li>
            <li><a href="../../index.html#${type}">${type}</a></li>
            <li aria-current="page">${escapeHtml(record.title)}</li>
          </ol>
        </nav>
      </div>
    </header>

    <main class="site-width" id="main">
      <article>
        <div class="reader-head">
          <div>
            <p class="reader-kicker">${escapeHtml(record.dateLabel)}</p>
            <h1>${escapeHtml(record.title)}</h1>
          </div>
          <a href="../../index.html#${type}" class="reader-close">back</a>
        </div>
        <div class="reader-body">${htmlContent}</div>
      </article>
    </main>

    <footer class="site-footer">
      <div class="site-width footer-inner">
        <p class="footer-kicker">stuck in my head while making this</p>
        <blockquote class="footer-quote">
          &ldquo;Your enemy is a resilient one. The thing you all oppose isn&rsquo;t just me. Nor is it heretics. It&rsquo;s part imagination and part curiosity. In short, it&rsquo;s truth itself&rdquo;
        </blockquote>
        <div class="footer-meta">
          <span>this quote from ORB feels so deep, it was a banger. iykyk</span>
          <a href="../../index.html">back to home</a>
        </div>
        <p class="footer-copy">&copy; 2026 Lonely Guy. All rights reserved.</p>
      </div>
    </footer>
</body>
</html>`;
}

async function generatePages(updates, articles, papers) {
  for (const record of updates) {
    const dir = path.join(ROOT, "updates", record.id);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "index.html"), makePageHtml(record, "updates", record.id), "utf8");
    console.log(`  → updates/${record.id}/index.html`);
  }
  for (const record of articles) {
    const dir = path.join(ROOT, "articles", record.id);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "index.html"), makePageHtml(record, "articles", record.id), "utf8");
    console.log(`  → articles/${record.id}/index.html`);
  }
  for (const record of papers) {
    const dir = path.join(ROOT, "papers", record.id);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "index.html"), makePageHtml(record, "papers", record.id), "utf8");
    console.log(`  → papers/${record.id}/index.html`);
  }
}

async function generateSitemap(updates, articles, papers) {
  const entries = [`<url><loc>${BASE_URL}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>`];
  for (const r of updates) {
    entries.push(`<url><loc>${BASE_URL}/updates/${r.id}/</loc><lastmod>${r.date}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`);
  }
  for (const r of articles) {
    entries.push(`<url><loc>${BASE_URL}/articles/${r.id}/</loc><lastmod>${r.date}</lastmod><changefreq>monthly</changefreq><priority>0.9</priority></url>`);
  }
  for (const r of papers) {
    entries.push(`<url><loc>${BASE_URL}/papers/${r.id}/</loc><lastmod>${r.date}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>`);
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>`;
  await fs.writeFile(path.join(ROOT, "sitemap.xml"), xml, "utf8");
  console.log("  → sitemap.xml");
}

function rssDate(dateStr) {
  const d = new Date(dateStr);
  return d.toUTCString();
}

async function generateRssFeed(articles) {
  const items = articles.map((r) => {
    const url = `${BASE_URL}/articles/${r.id}/`;
    const imageTag = r.image
      ? `<figure><img src="${r.image.startsWith("http") ? r.image : `${BASE_URL}/${r.image}`}" alt="" /></figure>`
      : "";
    return `    <item>
      <title><![CDATA[${r.title}]]></title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${rssDate(r.date)}</pubDate>
      <description><![CDATA[${r.summary}]]></description>
      <content:encoded><![CDATA[${imageTag}${toRootRelativePaths(r.html)}]]></content:encoded>
      <author>lonelyguyse1@gmail.com (Lonely Guy)</author>
    </item>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Lonely Guy</title>
    <link>${BASE_URL}/</link>
    <description>rl, robotics, world models, embodied ai, and system stuff.</description>
    <language>en-us</language>
    <lastBuildDate>${rssDate(new Date().toISOString())}</lastBuildDate>
    <atom:link href="${BASE_URL}/feed.xml" rel="self" type="application/rss+xml" />
${items.join("\n")}
  </channel>
</rss>`;
  await fs.writeFile(path.join(ROOT, "feed.xml"), xml, "utf8");
  console.log("  → feed.xml");
}

async function generateJsonFeed(articles) {
  const items = articles.map((r) => {
    const url = `${BASE_URL}/articles/${r.id}/`;
    const imageUrl = r.image
      ? (r.image.startsWith("http") ? r.image : `${BASE_URL}/${r.image}`)
      : `${BASE_URL}/assets/SE1.jpg`;
    return {
      id: url,
      url,
      title: r.title,
      summary: r.summary,
      content_html: toRootRelativePaths(r.html),
      image: imageUrl,
      date_published: r.date + "T00:00:00Z",
      date_modified: r.date + "T00:00:00Z",
      author: { name: "Lonely Guy", url: `${BASE_URL}/` },
    };
  });
  const feed = {
    version: "https://jsonfeed.org/version/1.1",
    title: "Lonely Guy",
    home_page_url: BASE_URL,
    feed_url: `${BASE_URL}/feed.json`,
    description: "rl, robotics, world models, embodied ai, and system stuff.",
    authors: [{ name: "Lonely Guy", url: BASE_URL }],
    language: "en-US",
    items,
  };
  await fs.writeFile(path.join(ROOT, "feed.json"), JSON.stringify(feed, null, 2), "utf8");
  console.log("  → feed.json");
}

async function generateLlmsTxt(updates, articles, papers) {
  let lines = [
    "# Lonely Guy",
    "> rl, robotics, world models, embodied ai, and system stuff.",
    "",
    "lonely guy is a cs undergrad working on reinforcement learning, robotics simulation, world models, and embodied ai. the goal is autonomous robotic assistants.",
    "",
    "## Navigation",
    "- Home: " + BASE_URL + "/",
    "- Articles: " + BASE_URL + "/#articles",
    "- Updates: " + BASE_URL + "/#updates",
    "- Papers: " + BASE_URL + "/#papers",
    "- Gallery: " + BASE_URL + "/#images",
    "- Projects: " + BASE_URL + "/#projects",
    "- Contact: " + BASE_URL + "/#contact",
    "",
  ];
  if (articles.length) {
    lines.push("## Articles");
    for (const r of articles) {
      lines.push(`- [${r.title}](${BASE_URL}/articles/${r.id}/): ${r.summary}`);
    }
    lines.push("");
  }
  if (updates.length) {
    lines.push("## Updates");
    for (const r of updates) {
      lines.push(`- [${r.title}](${BASE_URL}/updates/${r.id}/): ${r.summary}`);
    }
    lines.push("");
  }
  if (papers.length) {
    lines.push("## Papers");
    for (const r of papers) {
      lines.push(`- ${r.title}: ${r.summary}`);
    }
    lines.push("");
  }
  lines.push("## Profiles");
  lines.push(`- [GitHub](https://github.com/LonelyGuy-SE1)`);
  lines.push(`- [Hugging Face](https://huggingface.co/Lonelyguyse1)`);
  lines.push(`- [ORCID](https://orcid.org/0009-0000-7221-863X)`);
  lines.push(`- [LinkedIn](https://www.linkedin.com/in/greeshmasurya/)`);

  await fs.writeFile(path.join(ROOT, "llms.txt"), lines.join("\n"), "utf8");
  console.log("  → llms.txt");
}

async function build() {
  console.log("building content...");

  const [updates, articles, papers, gallery] = await Promise.all([
    readMarkdownCollection(COLLECTION_DIRS.updates),
    readMarkdownCollection(COLLECTION_DIRS.articles),
    readMarkdownCollection(COLLECTION_DIRS.papers),
    readGallery(),
  ]);

  // Write content.js for the SPA
  const content = { updates, articles, papers, gallery };
  const output = `window.PORTFOLIO_CONTENT = ${JSON.stringify(content, null, 2)};\n`;
  await fs.writeFile(CONTENT_JS, output, "utf8");
  console.log("  → scripts/content.js");

  // Generate standalone pages
  console.log("generating pages...");
  await generatePages(updates, articles, papers);

  // Generate sitemap
  console.log("generating sitemap...");
  await generateSitemap(updates, articles, papers);

  // Generate feeds (articles only)
  console.log("generating feeds...");
  await Promise.all([
    generateRssFeed(articles),
    generateJsonFeed(articles),
  ]);

  // Generate llms.txt
  console.log("generating llms.txt...");
  await generateLlmsTxt(updates, articles, papers);

  console.log("done.");
}

build();
