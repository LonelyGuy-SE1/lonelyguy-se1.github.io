const fs = require("fs/promises");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const COLLECTION_DIRS = {
  updates: path.join(ROOT, "updates"),
  articles: path.join(ROOT, "articles"),
  papers: path.join(ROOT, "papers"),
};
const GALLERY_DIR = path.join(ROOT, "gallery");
const OUTPUT_FILE = path.join(__dirname, "content.js");

function normalizeLineEndings(value) {
  return value.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeAssetUrl(assetPath) {
  if (!assetPath) {
    return "";
  }

  const normalized = assetPath.trim().replace(/\\/g, "/");

  if (!normalized) {
    return "";
  }

  if (/^https?:\/\//i.test(normalized) || normalized.startsWith("/")) {
    return normalized;
  }

  if (/\.(png|jpe?g|webp|gif|svg)$/i.test(normalized) && !normalized.includes("/")) {
    return `gallery/${normalized}`;
  }

  return normalized;
}

function inlineMarkdown(text) {
  const escaped = escapeHtml(text);

  return escaped
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
      return `<img src="${escapeHtml(normalizeAssetUrl(src))}" alt="${alt}">`;
    })
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

function markdownToHtml(markdown) {
  const blocks = normalizeLineEndings(markdown)
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks
    .map((block) => {
      if (block.startsWith("```") && block.endsWith("```")) {
        const code = block.replace(/^```[\w-]*\n?/, "").replace(/\n?```$/, "");
        return `<pre><code>${escapeHtml(code)}</code></pre>`;
      }

      if (/^#{1,6}\s/.test(block)) {
        const match = block.match(/^(#{1,6})\s(.+)$/);
        const level = match[1].length;
        return `<h${level}>${inlineMarkdown(match[2])}</h${level}>`;
      }

      if (block.split("\n").every((line) => /^[-*]\s/.test(line))) {
        const items = block
          .split("\n")
          .map((line) => line.replace(/^[-*]\s/, ""))
          .map((line) => `<li>${inlineMarkdown(line)}</li>`)
          .join("");
        return `<ul>${items}</ul>`;
      }

      if (block.split("\n").every((line) => /^\d+\.\s/.test(line))) {
        const items = block
          .split("\n")
          .map((line) => line.replace(/^\d+\.\s/, ""))
          .map((line) => `<li>${inlineMarkdown(line)}</li>`)
          .join("");
        return `<ol>${items}</ol>`;
      }

      if (block.split("\n").every((line) => /^>\s?/.test(line))) {
        const quote = block
          .split("\n")
          .map((line) => line.replace(/^>\s?/, ""))
          .join(" ");
        return `<blockquote>${inlineMarkdown(quote)}</blockquote>`;
      }

      if (/^!\[([^\]]*)\]\(([^)]+)\)$/.test(block)) {
        const match = block.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
        return `<div class="reader-media"><img src="${escapeHtml(normalizeAssetUrl(match[2]))}" alt="${escapeHtml(match[1])}"></div>`;
      }

      const paragraph = block
        .split("\n")
        .map((line) => inlineMarkdown(line))
        .join("<br>");
      return `<p>${paragraph}</p>`;
    })
    .join("");
}

function parseFrontmatter(rawText, fallbackDate) {
  const normalizedText = normalizeLineEndings(rawText);

  if (!normalizedText.startsWith("---\n")) {
    return {
      attributes: {},
      body: normalizedText.trim(),
      dateLabel: fallbackDate,
    };
  }

  const match = normalizedText.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);

  if (!match) {
    return {
      attributes: {},
      body: normalizedText.trim(),
      dateLabel: fallbackDate,
    };
  }

  const attributes = {};
  for (const line of match[1].split("\n")) {
    const separator = line.indexOf(":");
    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    attributes[key] = value;
  }

  return {
    attributes,
    body: match[2].trim(),
    dateLabel: attributes.date || fallbackDate,
  };
}

function toSlug(fileName) {
  return fileName.replace(/\.[^.]+$/, "");
}

function formatFallbackTitle(slug) {
  const withoutDate = slug.replace(/^\d{4}-\d{2}-\d{2}[-_]?/, "");
  const base = withoutDate || slug;
  return base.replace(/[-_]/g, " ");
}

function extractFirstImage(markdownBody) {
  const match = normalizeLineEndings(markdownBody).match(/!\[[^\]]*\]\(([^)]+)\)/);
  return match ? match[1] : "";
}

function fallbackSummary(markdownBody) {
  const line = normalizeLineEndings(markdownBody)
    .split(/\n+/)
    .map((entry) => entry.trim())
    .find((entry) => entry && !entry.startsWith("#") && !entry.startsWith("-") && !entry.startsWith("!"));

  return line || "no summary yet.";
}

async function readMarkdownCollection(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
  const markdownFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".md"));

  const records = await Promise.all(
    markdownFiles.map(async (entry) => {
      const filePath = path.join(directory, entry.name);
      const stats = await fs.stat(filePath);
      const rawText = await fs.readFile(filePath, "utf8");
      const fallbackDate = stats.mtime.toISOString().slice(0, 10);
      const parsed = parseFrontmatter(rawText, fallbackDate);
      const summary = parsed.attributes.summary || fallbackSummary(parsed.body);
      const previewImage = parsed.attributes.image || extractFirstImage(parsed.body);

      return {
        id: toSlug(entry.name),
        title: parsed.attributes.title || formatFallbackTitle(toSlug(entry.name)),
        date: parsed.attributes.date || fallbackDate,
        dateLabel: parsed.dateLabel,
        summary,
        image: normalizeAssetUrl(previewImage),
        html: markdownToHtml(parsed.body),
      };
    }),
  );

  return records.sort((left, right) => right.date.localeCompare(left.date));
}

async function readGallery() {
  const entries = await fs.readdir(GALLERY_DIR, { withFileTypes: true }).catch(() => []);
  const imageFiles = entries.filter((entry) => {
    if (!entry.isFile() || entry.name.startsWith(".")) {
      return false;
    }

    return [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(path.extname(entry.name).toLowerCase());
  });

  const records = await Promise.all(
    imageFiles.map(async (entry) => {
      const stats = await fs.stat(path.join(GALLERY_DIR, entry.name));
      const label = toSlug(entry.name).replace(/[-_]/g, " ");
      return {
        url: `gallery/${encodeURIComponent(entry.name)}`,
        alt: label,
        caption: label,
        date: stats.mtime.toISOString(),
      };
    }),
  );

  return records.sort((left, right) => right.date.localeCompare(left.date));
}

async function build() {
  const content = {
    updates: await readMarkdownCollection(COLLECTION_DIRS.updates),
    articles: await readMarkdownCollection(COLLECTION_DIRS.articles),
    papers: await readMarkdownCollection(COLLECTION_DIRS.papers),
    gallery: await readGallery(),
  };

  const output = `window.PORTFOLIO_CONTENT = ${JSON.stringify(content, null, 2)};\n`;
  await fs.writeFile(OUTPUT_FILE, output, "utf8");
}

build();
