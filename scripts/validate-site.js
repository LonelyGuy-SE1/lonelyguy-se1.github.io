const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const config = JSON.parse(fs.readFileSync(path.join(ROOT, "site.config.json"), "utf8"));
const BASE_URL = String(config.baseUrl || "https://lonelyguy.vercel.app").replace(/\/+$/, "");

const failures = [];
const warnings = [];

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function fileForPath(pathname) {
  const clean = pathname.replace(/^\/+|\/+$/g, "");
  return clean ? path.join(ROOT, clean, "index.html") : path.join(ROOT, "index.html");
}

function pathFromUrl(url) {
  if (url.startsWith(BASE_URL)) {
    const parsed = new URL(url);
    return parsed.pathname || "/";
  }
  if (url.startsWith("/")) return url.split("#")[0].split("?")[0] || "/";
  return "";
}

function extractSitemapUrls() {
  const sitemapPath = path.join(ROOT, "sitemap.xml");
  if (!fs.existsSync(sitemapPath)) fail("Missing sitemap.xml");
  const xml = read(sitemapPath);
  return Array.from(xml.matchAll(/<loc>(.*?)<\/loc>/g))
    .map((match) => match[1])
    .filter((url) => url.startsWith(BASE_URL));
}

function checkJsonLd(html, pagePath) {
  const scripts = Array.from(
    html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g),
  );
  if (!scripts.length) {
    fail(`${pagePath}: missing JSON-LD`);
    return;
  }
  for (const script of scripts) {
    try {
      JSON.parse(script[1]);
    } catch (error) {
      fail(`${pagePath}: invalid JSON-LD (${error.message})`);
    }
  }
}

function shouldValidateInternalPath(pathname) {
  if (!pathname || pathname === "#") return false;
  if (pathname.startsWith("/assets/")) return false;
  if (pathname.startsWith("/gallery/")) return false;
  if (pathname.startsWith("/api/")) return false;
  if (pathname === "/feed.xml" || pathname === "/feed.json") return false;
  if (pathname === "/sitemap.xml" || pathname === "/robots.txt") return false;
  if (pathname === "/search-index.json" || pathname === "/site-index.json") return false;
  return true;
}

function checkLinks(html, pagePath) {
  const hrefs = Array.from(html.matchAll(/\shref="([^"]+)"/g)).map((match) => match[1]);
  for (const href of hrefs) {
    if (/^(https?:|mailto:|tel:|#)/i.test(href)) continue;
    const internalPath = pathFromUrl(href);
    if (!shouldValidateInternalPath(internalPath)) continue;
    const target = fileForPath(internalPath);
    if (!fs.existsSync(target)) {
      fail(`${pagePath}: broken internal link ${href}`);
    }
  }
}

function checkHtmlPage(pathname) {
  const filePath = fileForPath(pathname);
  if (!fs.existsSync(filePath)) {
    fail(`${pathname}: missing ${path.relative(ROOT, filePath)}`);
    return;
  }
  const html = read(filePath);
  if (!/<title>[^<]{8,}<\/title>/.test(html)) fail(`${pathname}: missing useful title`);
  if (!/<meta name="description" content="[^"]{50,}"/.test(html)) {
    fail(`${pathname}: missing useful meta description`);
  }
  const canonicals = html.match(/<link rel="canonical" href="[^"]+"\s*\/?>/g) || [];
  if (canonicals.length !== 1) fail(`${pathname}: expected exactly one canonical, found ${canonicals.length}`);
  checkJsonLd(html, pathname);
  checkLinks(html, pathname);
}

function checkRobots() {
  const robotsPath = path.join(ROOT, "robots.txt");
  if (!fs.existsSync(robotsPath)) {
    fail("Missing robots.txt");
    return;
  }
  const robots = read(robotsPath);
  if (!robots.includes(`${BASE_URL}/sitemap.xml`)) {
    fail("robots.txt does not reference the configured sitemap URL");
  }
}

function checkIndexes() {
  for (const name of ["search-index.json", "site-index.json", "llms.txt", "feed.xml", "feed.json"]) {
    const filePath = path.join(ROOT, name);
    if (!fs.existsSync(filePath)) fail(`Missing ${name}`);
  }
  try {
    const records = JSON.parse(read(path.join(ROOT, "search-index.json")));
    if (!Array.isArray(records) || records.length < 5) {
      fail("search-index.json has too few records");
    }
  } catch (error) {
    fail(`search-index.json is invalid JSON (${error.message})`);
  }
}

const urls = extractSitemapUrls();
if (!urls.length) fail("Sitemap has no configured-site URLs");

const seen = new Set();
for (const url of urls) {
  if (seen.has(url)) fail(`Duplicate sitemap URL: ${url}`);
  seen.add(url);
  const pathname = new URL(url).pathname || "/";
  checkHtmlPage(pathname);
}

checkRobots();
checkIndexes();

if (warnings.length) {
  console.warn("Warnings:");
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (failures.length) {
  console.error("SEO validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`SEO validation passed for ${urls.length} sitemap URLs.`);
