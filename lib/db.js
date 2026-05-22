// Tiny zero-dependency JSON file store. Synchronous writes are fine at this scale.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const EMPTY = { hotels: {}, ratings: [], feedback: [] };

function load() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {
    return structuredClone(EMPTY);
  }
}

let state = load();

function persist() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, DB_FILE); // atomic-ish swap
}

function slugify(name) {
  const COMBINING_MARKS = /[̀-ͯ]/g;
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'hotel';
}

export function createHotel({ id, name, whatsapp, googleUrl, tripadvisorUrl }) {
  id = id || crypto.randomUUID().slice(0, 8);
  const hotel = {
    id,
    name: name.trim(),
    slug: slugify(name),
    whatsapp: (whatsapp || '').replace(/[^0-9]/g, ''),
    googleUrl: (googleUrl || '').trim(),
    tripadvisorUrl: (tripadvisorUrl || '').trim(),
    createdAt: new Date().toISOString(),
  };
  state.hotels[id] = hotel;
  persist();
  return hotel;
}

export function updateHotel(id, patch) {
  const hotel = state.hotels[id];
  if (!hotel) return null;
  if (patch.name !== undefined) {
    hotel.name = patch.name.trim();
    hotel.slug = slugify(hotel.name);
  }
  if (patch.whatsapp !== undefined) hotel.whatsapp = patch.whatsapp.replace(/[^0-9]/g, '');
  if (patch.googleUrl !== undefined) hotel.googleUrl = patch.googleUrl.trim();
  if (patch.tripadvisorUrl !== undefined) hotel.tripadvisorUrl = patch.tripadvisorUrl.trim();
  persist();
  return hotel;
}

export function getHotel(id) {
  return state.hotels[id] || null;
}

export function listHotels() {
  return Object.values(state.hotels).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function recordRating(hotelId, stars, channel = 'web') {
  const rating = {
    id: crypto.randomUUID().slice(0, 8),
    hotelId,
    stars: Number(stars),
    channel,
    createdAt: new Date().toISOString(),
  };
  state.ratings.push(rating);
  persist();
  return rating;
}

export function recordFeedback(hotelId, { stars, name, contact, message }) {
  const entry = {
    id: crypto.randomUUID().slice(0, 8),
    hotelId,
    stars: Number(stars) || null,
    name: (name || '').trim(),
    contact: (contact || '').trim(),
    message: (message || '').trim(),
    createdAt: new Date().toISOString(),
  };
  state.feedback.push(entry);
  persist();
  return entry;
}

export function statsFor(hotelId) {
  const ratings = state.ratings.filter((r) => r.hotelId === hotelId);
  const feedback = state.feedback
    .filter((f) => f.hotelId === hotelId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const total = ratings.length;
  const sum = ratings.reduce((acc, r) => acc + r.stars, 0);
  const avg = total ? sum / total : 0;
  const distribution = [1, 2, 3, 4, 5].map(
    (star) => ratings.filter((r) => r.stars === star).length
  );
  const promoted = ratings.filter((r) => r.stars >= 4).length;
  return { total, avg, distribution, promoted, feedback };
}

// Test helper: wipe everything (used by smoke test with a temp DATA_DIR).
export function _reset() {
  state = structuredClone(EMPTY);
  persist();
}
