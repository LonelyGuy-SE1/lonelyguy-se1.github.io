const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const ROOT = path.resolve(__dirname, "..");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

function serve404(res) {
  const file = path.join(ROOT, "404.html");
  if (fs.existsSync(file)) {
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    fs.createReadStream(file).pipe(res);
  } else {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("404 Not Found");
  }
}

const server = http.createServer((req, res) => {
  let url = req.url.split("?")[0];

  // If no extension, treat as directory/index.html (cleanUrls style)
  let filePath;
  if (path.extname(url)) {
    filePath = path.join(ROOT, url);
  } else {
    filePath = path.join(ROOT, url, "index.html");
  }

  // Security: prevent path traversal
  if (!filePath.startsWith(ROOT)) {
    serve404(res);
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // Try adding .html
      const htmlPath = filePath.replace(/\/index\.html$/, ".html");
      fs.stat(htmlPath, (err2, stat2) => {
        if (!err2 && stat2.isFile()) {
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          fs.createReadStream(htmlPath).pipe(res);
        } else {
          serve404(res);
        }
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": mime });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`dev server running at http://localhost:${PORT}`);
});
