// Seeds demo data so you can test the app immediately.
// Usage: npm run seed   (then: npm start)
import * as db from '../lib/db.js';

db._reset();

const hotel = db.createHotel({
  name: 'Azure Bay Hotel',
  whatsapp: '15551234567',
  googleUrl: 'https://search.google.com/local/writereview?placeid=ChIJDemoAzureBay',
  tripadvisorUrl: 'https://www.tripadvisor.com/UserReviewEdit-g60763-d99999-Azure_Bay_Hotel.html',
});

// A realistic spread: mostly happy guests, a few unhappy ones.
const ratingPattern = [5, 5, 5, 5, 4, 5, 4, 5, 3, 5, 5, 2, 4, 5, 5, 1, 5, 4, 5, 5];
for (const stars of ratingPattern) {
  db.recordRating(hotel.id, stars, 'web');
}

const feedback = [
  { stars: 2, name: 'Marina L.', contact: 'marina@example.com', message: 'Room was clean but the AC was very noisy at night and kept me awake.' },
  { stars: 3, name: 'Tom R.', contact: '', message: 'Breakfast options were limited and ran out by 9am. Otherwise a nice stay.' },
  { stars: 1, name: '', contact: '+15557654321', message: 'Check-in took over 45 minutes with only one person at the desk.' },
];
for (const fb of feedback) {
  db.recordFeedback(hotel.id, fb);
}

console.log('Seeded demo data.');
console.log(`  Hotel:        ${hotel.name} (id ${hotel.id})`);
console.log(`  Dashboard:    /dashboard/${hotel.id}`);
console.log(`  Guest review: /r/${hotel.id}`);
console.log('\nRun "npm start" and open http://localhost:3000');
