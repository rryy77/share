// ローカル開発用の静的サーバー（本番は Vercel が静的配信するので不要）
//
// 画面共有APIは「安全なコンテキスト(HTTPS または localhost)」でしか使えないため、
// ローカル確認は file:// ではなく必ずこのサーバー経由（http://localhost）で開くこと。
//
//   npm start  →  http://localhost:3000

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, extname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, 'public');
const PORT = process.env.PORT || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  try {
    let urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (urlPath === '/') urlPath = '/index.html';
    if (urlPath === '/view') urlPath = '/view.html'; // vercel.json と同じ書き換え

    const filePath = normalize(join(PUBLIC_DIR, urlPath));
    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    const data = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404).end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`\n  画面共有アプリ (ローカル)`);
  console.log(`  ホスト画面:  http://localhost:${PORT}\n`);
});
