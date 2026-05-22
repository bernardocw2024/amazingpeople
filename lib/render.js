// Server-rendered HTML. All dynamic values pass through esc() to prevent XSS.
import { qrSvg } from './qr.js';

export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function layout({ title, body, narrow = false }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)} · Amazing People</title>
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <header class="topbar">
    <a class="brand" href="/">
      <span class="brand-mark">★</span> Amazing People
    </a>
    <nav>
      <a href="/dashboard">Dashboard</a>
    </nav>
  </header>
  <main class="${narrow ? 'wrap narrow' : 'wrap'}">
    ${body}
  </main>
  <footer class="footer">
    <p>Turn happy guests into 5-star reviews on Google &amp; TripAdvisor — shared in one tap via WhatsApp.</p>
  </footer>
</body>
</html>`;
}

function waLink(number, text) {
  const base = number ? `https://wa.me/${number}` : 'https://wa.me/';
  return `${base}?text=${encodeURIComponent(text)}`;
}


export function landingPage() {
  const body = `
  <section class="hero">
    <h1>Collect 5-star hotel reviews <br/>straight from WhatsApp.</h1>
    <p class="lead">
      Share one link or QR code with your guests. Happy guests are guided to
      <strong>Google</strong> and <strong>TripAdvisor</strong> in a single tap.
      Unhappy guests reach you privately — before they post in public.
    </p>
    <div class="cta-row">
      <a class="btn btn-primary" href="/dashboard">Set up your hotel</a>
      <a class="btn btn-ghost" href="/dashboard">View dashboard</a>
    </div>
  </section>
  <section class="steps">
    <div class="step">
      <span class="step-num">1</span>
      <h3>Add your hotel</h3>
      <p>Paste your Google and TripAdvisor review links. Takes 30 seconds.</p>
    </div>
    <div class="step">
      <span class="step-num">2</span>
      <h3>Share via WhatsApp</h3>
      <p>Send the review link or print the QR code for reception and rooms.</p>
    </div>
    <div class="step">
      <span class="step-num">3</span>
      <h3>Watch reviews grow</h3>
      <p>Guests rate you, then post publicly. Private feedback stays with you.</p>
    </div>
  </section>`;
  return layout({ title: 'Hotel reviews via WhatsApp', body });
}

export function dashboardPage(hotels) {
  const rows = hotels.length
    ? hotels
        .map(
          (h) => `
      <li class="hotel-row">
        <a href="/dashboard/${esc(h.id)}">${esc(h.name)}</a>
        <span class="muted">/r/${esc(h.id)}</span>
      </li>`
        )
        .join('')
    : `<li class="muted">No hotels yet. Add your first one below.</li>`;

  const body = `
  <h1>Dashboard</h1>
  <section class="card">
    <h2>Your hotels</h2>
    <ul class="hotel-list">${rows}</ul>
  </section>

  <section class="card">
    <h2>Add a hotel</h2>
    <form method="post" action="/hotels" class="form">
      <label>Hotel name
        <input name="name" required placeholder="Grand Plaza Hotel" />
      </label>
      <label>WhatsApp number <span class="muted">(country code + number, digits only)</span>
        <input name="whatsapp" inputmode="numeric" placeholder="15551234567" />
      </label>
      <label>Google review link
        <input name="googleUrl" type="url" placeholder="https://g.page/r/.../review" />
      </label>
      <label>TripAdvisor review link
        <input name="tripadvisorUrl" type="url" placeholder="https://www.tripadvisor.com/UserReviewEdit-..." />
      </label>
      <button class="btn btn-primary" type="submit">Create hotel</button>
    </form>
    <p class="hint">
      Tip: get your Google link from your Business Profile → "Ask for reviews".
      Get the TripAdvisor link from your listing's "Write a review" page.
    </p>
  </section>`;
  return layout({ title: 'Dashboard', body });
}

export function hotelDetailPage(hotel, stats, origin) {
  const reviewUrl = `${origin}/r/${hotel.id}`;
  const inviteText = `Hi! Thanks for staying at ${hotel.name}. We'd love your feedback — it takes 20 seconds: ${reviewUrl}`;
  const shareWa = waLink(hotel.whatsapp, inviteText);

  const max = Math.max(1, ...stats.distribution);
  const dist = [5, 4, 3, 2, 1]
    .map((star) => {
      const count = stats.distribution[star - 1];
      const pct = Math.round((count / max) * 100);
      return `<div class="bar-row">
        <span class="bar-label">${star}★</span>
        <span class="bar"><span class="bar-fill" style="width:${pct}%"></span></span>
        <span class="bar-count">${count}</span>
      </div>`;
    })
    .join('');

  const feedback = stats.feedback.length
    ? stats.feedback
        .map(
          (f) => `<li class="fb">
        <div class="fb-head">
          <strong>${esc(f.name || 'Anonymous guest')}</strong>
          <span class="fb-stars">${'★'.repeat(f.stars || 0)}${'☆'.repeat(5 - (f.stars || 0))}</span>
          <span class="muted">${esc(f.createdAt.slice(0, 10))}</span>
        </div>
        <p>${esc(f.message)}</p>
        ${f.contact ? `<p class="muted">Contact: ${esc(f.contact)}</p>` : ''}
      </li>`
        )
        .join('')
    : `<li class="muted">No private feedback yet.</li>`;

  const body = `
  <a class="back" href="/dashboard">← All hotels</a>
  <h1>${esc(hotel.name)}</h1>

  <div class="grid">
    <section class="card">
      <h2>Reputation</h2>
      <div class="stat-big">
        <span class="avg">${stats.avg.toFixed(1)}</span>
        <span class="muted">avg from ${stats.total} rating${stats.total === 1 ? '' : 's'}</span>
      </div>
      <div class="dist">${dist}</div>
      <p class="muted">${stats.promoted} guest${stats.promoted === 1 ? '' : 's'} sent to public review pages.</p>
    </section>

    <section class="card">
      <h2>Share with guests</h2>
      <p>Your review link:</p>
      <code class="link-box">${esc(reviewUrl)}</code>
      <div class="cta-row">
        <a class="btn btn-wa" href="${esc(shareWa)}" target="_blank" rel="noopener">Send via WhatsApp</a>
        <a class="btn btn-ghost" href="/r/${esc(hotel.id)}" target="_blank" rel="noopener">Preview</a>
      </div>
      <div class="qr">
        <div class="qr-code">${qrSvg(reviewUrl)}</div>
        <p class="muted">Print this QR for reception, rooms or the check-out bill.</p>
      </div>
    </section>
  </div>

  <section class="card">
    <h2>Private feedback</h2>
    <ul class="fb-list">${feedback}</ul>
  </section>

  <section class="card">
    <h2>Settings</h2>
    <form method="post" action="/hotels/${esc(hotel.id)}" class="form">
      <label>Hotel name<input name="name" value="${esc(hotel.name)}" required /></label>
      <label>WhatsApp number<input name="whatsapp" value="${esc(hotel.whatsapp)}" /></label>
      <label>Google review link<input name="googleUrl" type="url" value="${esc(hotel.googleUrl)}" /></label>
      <label>TripAdvisor review link<input name="tripadvisorUrl" type="url" value="${esc(hotel.tripadvisorUrl)}" /></label>
      <button class="btn btn-primary" type="submit">Save changes</button>
    </form>
  </section>`;
  return layout({ title: hotel.name, body });
}

// Guest-facing rating page (step 1).
export function ratePage(hotel) {
  const stars = [1, 2, 3, 4, 5]
    .map(
      (s) =>
        `<a class="star-pick" href="/r/${esc(hotel.id)}/rate?stars=${s}" aria-label="${s} stars">${'★'.repeat(s)}${'☆'.repeat(5 - s)}</a>`
    )
    .join('');
  const body = `
  <div class="guest">
    <h1>How was your stay at<br/>${esc(hotel.name)}?</h1>
    <p class="lead">Tap a rating below.</p>
    <div class="star-picker">${stars}</div>
  </div>`;
  return layout({ title: `Review ${hotel.name}`, body, narrow: true });
}

// Happy path (4-5 stars): send to Google & TripAdvisor.
export function promotePage(hotel, stars) {
  const buttons = [];
  if (hotel.googleUrl) {
    buttons.push(
      `<a class="btn btn-google" href="${esc(hotel.googleUrl)}" target="_blank" rel="noopener">Review on Google</a>`
    );
  }
  if (hotel.tripadvisorUrl) {
    buttons.push(
      `<a class="btn btn-ta" href="${esc(hotel.tripadvisorUrl)}" target="_blank" rel="noopener">Review on TripAdvisor</a>`
    );
  }
  if (hotel.whatsapp) {
    const text = `${'⭐'.repeat(stars)} Review for ${hotel.name}: `;
    buttons.push(
      `<a class="btn btn-wa" href="${esc(waLink(hotel.whatsapp, text))}" target="_blank" rel="noopener">Send your review on WhatsApp</a>`
    );
  }
  if (!buttons.length) {
    buttons.push(`<p class="muted">The hotel hasn't added review links yet.</p>`);
  }
  const body = `
  <div class="guest">
    <div class="big-stars">${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}</div>
    <h1>Wonderful — thank you!</h1>
    <p class="lead">Share your experience in one tap — it means the world to us.</p>
    <div class="cta-stack">${buttons.join('')}</div>
    <a class="link-quiet" href="/r/${esc(hotel.id)}/feedback?stars=${stars}">Or send us a private note instead</a>
  </div>`;
  return layout({ title: 'Thank you', body, narrow: true });
}

// Unhappy path (1-3 stars): private feedback capture.
export function feedbackPage(hotel, stars) {
  const body = `
  <div class="guest">
    <div class="big-stars">${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}</div>
    <h1>We're sorry we fell short.</h1>
    <p class="lead">Tell us what went wrong — your note goes straight to the hotel management, privately.</p>
    <form method="post" action="/r/${esc(hotel.id)}/feedback" class="form">
      <input type="hidden" name="stars" value="${stars}" />
      <label>What could we have done better?
        <textarea name="message" required rows="4" placeholder="Your honest feedback…"></textarea>
      </label>
      <label>Your name <span class="muted">(optional)</span>
        <input name="name" />
      </label>
      <label>Email or phone <span class="muted">(optional, so we can make it right)</span>
        <input name="contact" />
      </label>
      <button class="btn btn-primary" type="submit">Send privately</button>
    </form>
  </div>`;
  return layout({ title: 'Your feedback', body, narrow: true });
}

export function thanksPage(hotel) {
  const body = `
  <div class="guest">
    <div class="big-stars">✓</div>
    <h1>Thank you.</h1>
    <p class="lead">Your feedback has been sent to ${esc(hotel.name)}. We truly appreciate it.</p>
  </div>`;
  return layout({ title: 'Thank you', body, narrow: true });
}

export function notFoundPage() {
  return layout({
    title: 'Not found',
    narrow: true,
    body: `<div class="guest"><h1>404</h1><p class="lead">That page doesn't exist.</p><a class="btn btn-ghost" href="/">Go home</a></div>`,
  });
}
