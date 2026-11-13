import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Folder na pliki CSV z rejestrem zdarzeń (jedno zamówienie = jeden plik)
const EVENTS_DIR = path.resolve(__dirname, 'zdarzenia');

// POST /api/zdarzenia  { nazwa: 'plik.csv', csv: '...' } → zapis do zdarzenia/<nazwa>
function eventLogWriter() {
  const handler = (req, res, next) => {
    if (req.url !== '/api/zdarzenia' || req.method !== 'POST') return next();
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const { nazwa, csv } = JSON.parse(body);
        if (typeof csv !== 'string') throw new Error('brak danych csv');
        // Tylko bezpieczne znaki w nazwie pliku, zawsze w folderze zdarzenia/
        const base = path.basename(String(nazwa || 'zdarzenia.csv')).replace(/[^A-Za-z0-9_.-]/g, '_');
        const name = base.endsWith('.csv') ? base : `${base}.csv`;
        fs.mkdirSync(EVENTS_DIR, { recursive: true });
        let file = path.join(EVENTS_DIR, name);
        for (let i = 2; fs.existsSync(file); i++) file = path.join(EVENTS_DIR, name.replace(/\.csv$/, `_${i}.csv`));
        fs.writeFileSync(file, csv, 'utf8');
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ plik: path.relative(__dirname, file) }));
      } catch (err) {
        res.statusCode = 400;
        res.end(JSON.stringify({ blad: String(err.message || err) }));
      }
    });
  };
  return {
    name: 'zapis-zdarzen',
    configureServer(server) { server.middlewares.use(handler); },
    configurePreviewServer(server) { server.middlewares.use(handler); },
  };
}

export default defineConfig({
  plugins: [react(), eventLogWriter()],
  server: { port: 5173, open: false },
});
