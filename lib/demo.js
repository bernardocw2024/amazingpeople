import * as db from './db.js';

// Idempotently seed demo hotels so a fresh deploy has something to test.
// Real WhatsApp number and review links should be set in Settings.
export function ensureDemoData() {
  if (db.getHotel('arte-natureza')) return;

  db.createHotel({
    id: 'arte-natureza',
    name: 'Hotel Arte da Natureza',
    // Placeholder — set the hotel's real WhatsApp number (country code + number) in Settings.
    whatsapp: process.env.ARTE_WHATSAPP || '',
    // Placeholder discovery links until the exact Google/TripAdvisor review URLs are added.
    googleUrl:
      process.env.ARTE_GOOGLE_URL ||
      'https://www.google.com/maps/search/?api=1&query=Hotel+Arte+da+Natureza+Bonito',
    tripadvisorUrl:
      process.env.ARTE_TRIPADVISOR_URL ||
      'https://www.tripadvisor.com/Search?q=Hotel%20Arte%20da%20Natureza%20Bonito',
  });
}
