import * as db from './db.js';

// Idempotently seed demo hotels so a fresh deploy has something to test.
// Real WhatsApp number and review links should be set in Settings.
export function ensureDemoData() {
  if (db.getHotel('arte-natureza')) return;

  db.createHotel({
    id: 'arte-natureza',
    name: 'Hotel Arte da Natureza',
    // Test number for now — replace with the hotel's real WhatsApp number in Settings.
    whatsapp: process.env.ARTE_WHATSAPP || '56968337765',
    // Google review URL still a discovery link until the exact place review link is added.
    googleUrl:
      process.env.ARTE_GOOGLE_URL ||
      'https://www.google.com/maps/search/?api=1&query=Hotel+Arte+da+Natureza+Bonito',
    tripadvisorUrl:
      process.env.ARTE_TRIPADVISOR_URL ||
      'https://www.tripadvisor.com.br/HotelHighlight-g303349-d6727263-Reviews-Arte_da_Natureza_Hotel_Bonito-Bonito_State_of_Mato_Grosso_do_Sul.html',
  });
}
