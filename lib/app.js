import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as db from './db.js';
import * as view from './render.js';
import { ensureDemoData } from './demo.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = process.env.PUBLIC_DIR || path.join(__dirname, '..', 'public');
const ID = '([a-z0-9-]+)'; // hotel id / slug

// Seed demo content on cold start (skipped under test).
if (process.env.NODE_ENV !== 'test') ensureDemoData();

function send(res, status, body, type = 'text/html; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type });
  res.end(body);
}

function redirect(res, location) {
  res.writeHead(303, { Location: location });
  res.end();
}

function originFor(req) {
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  return `${proto}://${host}`;
}

function parseBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 1e6) req.destroy(); // basic flood guard
    });
    req.on('end', () => resolve(new URLSearchParams(raw)));
  });
}

const STATIC_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function serveStatic(res, pathname) {
  const safe = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  const file = path.join(PUBLIC_DIR, safe);
  if (!file.startsWith(PUBLIC_DIR) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    return false;
  }
  const ext = path.extname(file);
  send(res, 200, fs.readFileSync(file), STATIC_TYPES[ext] || 'application/octet-stream');
  return true;
}

export async function handler(req, res) {
  try {
    const url = new URL(req.url, originFor(req));
    const { pathname } = url;
    const method = req.method;

    if (method === 'GET' && (pathname === '/styles.css' || pathname.startsWith('/assets/'))) {
      if (serveStatic(res, pathname)) return;
    }

    if (method === 'GET' && (pathname === '/' || pathname === '')) {
      return send(res, 200, view.landingPage());
    }

    if (method === 'GET' && pathname === '/dashboard') {
      return send(res, 200, view.dashboardPage(db.listHotels()));
    }

    if (method === 'POST' && pathname === '/hotels') {
      const form = await parseBody(req);
      if (!form.get('name')) return send(res, 400, view.dashboardPage(db.listHotels()));
      const hotel = db.createHotel({
        name: form.get('name'),
        whatsapp: form.get('whatsapp'),
        googleUrl: form.get('googleUrl'),
        tripadvisorUrl: form.get('tripadvisorUrl'),
      });
      return redirect(res, `/dashboard/${hotel.id}`);
    }

    const detailMatch = pathname.match(new RegExp(`^/dashboard/${ID}$`, 'i'));
    if (method === 'GET' && detailMatch) {
      const hotel = db.getHotel(detailMatch[1]);
      if (!hotel) return send(res, 404, view.notFoundPage());
      return send(res, 200, view.hotelDetailPage(hotel, db.statsFor(hotel.id), originFor(req)));
    }

    const updateMatch = pathname.match(new RegExp(`^/hotels/${ID}$`, 'i'));
    if (method === 'POST' && updateMatch) {
      const form = await parseBody(req);
      const hotel = db.updateHotel(updateMatch[1], {
        name: form.get('name'),
        whatsapp: form.get('whatsapp'),
        googleUrl: form.get('googleUrl'),
        tripadvisorUrl: form.get('tripadvisorUrl'),
      });
      if (!hotel) return send(res, 404, view.notFoundPage());
      return redirect(res, `/dashboard/${hotel.id}`);
    }

    const rateMatch = pathname.match(new RegExp(`^/r/${ID}$`, 'i'));
    if (method === 'GET' && rateMatch) {
      const hotel = db.getHotel(rateMatch[1]);
      if (!hotel) return send(res, 404, view.notFoundPage());
      return send(res, 200, view.ratePage(hotel));
    }

    const doRateMatch = pathname.match(new RegExp(`^/r/${ID}/rate$`, 'i'));
    if (method === 'GET' && doRateMatch) {
      const hotel = db.getHotel(doRateMatch[1]);
      if (!hotel) return send(res, 404, view.notFoundPage());
      const stars = Math.min(5, Math.max(1, Number(url.searchParams.get('stars')) || 0));
      if (!stars) return redirect(res, `/r/${hotel.id}`);
      db.recordRating(hotel.id, stars, 'web');
      if (stars >= 4) return send(res, 200, view.promotePage(hotel, stars));
      return send(res, 200, view.feedbackPage(hotel, stars));
    }

    const fbMatch = pathname.match(new RegExp(`^/r/${ID}/feedback$`, 'i'));
    if (method === 'GET' && fbMatch) {
      const hotel = db.getHotel(fbMatch[1]);
      if (!hotel) return send(res, 404, view.notFoundPage());
      const stars = Math.min(5, Math.max(1, Number(url.searchParams.get('stars')) || 5));
      return send(res, 200, view.feedbackPage(hotel, stars));
    }

    if (method === 'POST' && fbMatch) {
      const hotel = db.getHotel(fbMatch[1]);
      if (!hotel) return send(res, 404, view.notFoundPage());
      const form = await parseBody(req);
      db.recordFeedback(hotel.id, {
        stars: form.get('stars'),
        name: form.get('name'),
        contact: form.get('contact'),
        message: form.get('message'),
      });
      return send(res, 200, view.thanksPage(hotel));
    }

    return send(res, 404, view.notFoundPage());
  } catch (err) {
    console.error(err);
    return send(res, 500, view.layout({ title: 'Error', body: '<h1>Something went wrong.</h1>' }));
  }
}
