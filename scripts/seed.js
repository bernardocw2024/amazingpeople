// Seeds demo data so you can test the app immediately.
// Usage: npm run seed   (then: npm start)
import * as db from '../lib/db.js';
import { ensureDemoData } from '../lib/demo.js';

db._reset();
ensureDemoData(); // creates "Hotel Arte da Natureza" (id: arte-natureza)

const id = 'arte-natureza';

// A realistic spread: mostly happy guests, a few unhappy ones.
const ratingPattern = [5, 5, 5, 5, 4, 5, 4, 5, 3, 5, 5, 2, 4, 5, 5, 1, 5, 4, 5, 5];
for (const stars of ratingPattern) db.recordRating(id, stars, 'whatsapp');

const feedback = [
  { stars: 2, name: 'Marina L.', contact: 'marina@example.com', message: 'O quarto estava limpo, mas o ar-condicionado fazia muito barulho à noite.' },
  { stars: 3, name: 'Tom R.', contact: '', message: 'Breakfast options were limited and ran out by 9am. Otherwise a lovely stay near the rivers.' },
  { stars: 1, name: '', contact: '+5567999990000', message: 'Check-in demorou mais de 40 minutos com apenas uma pessoa na recepção.' },
];
for (const fb of feedback) db.recordFeedback(id, fb);

console.log('Seeded demo data.');
console.log(`  Hotel:        Hotel Arte da Natureza (id ${id})`);
console.log(`  Dashboard:    /dashboard/${id}`);
console.log(`  Guest review: /r/${id}`);
console.log('\nRun "npm start" and open http://localhost:3000');
