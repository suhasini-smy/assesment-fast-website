/* ===================================================================
   TrailGear Co. — app.js
   =================================================================== */

// --- BUG: jQuery is loaded twice (see index.html) via two <script> tags
// with different filenames but identical content. $.noConflict noise below
// is a red herring some candidates chase instead of removing the duplicate tag.
$(document).ready(function () {
  console.log('jQuery ready, version', $.fn.jquery);
});

// --- BUG: unbounded array that grows forever and is never trimmed —
// a classic memory leak. Every mousemove event pushes a new object and
// nothing ever removes old ones, so retained memory climbs for as long
// as the tab stays open.
const mouseTrail = [];

const MAX_TRAIL_SIZE=100;//added 08-07-2026
window.addEventListener('mousemove', function (e) {
  mouseTrail.push({ x: e.clientX, y: e.clientY, t: performance.now(), el: e.target });

  if(mouseTrail.length > MAX_TRAIL_SIZE){ //added 08-07-2026
    mouseTrail.shift();
  }

});

// --- BUG: a resize handler that is re-registered on every call to
// initGallery() instead of once. Every window resize therefore adds
// ANOTHER listener on top of all previous ones, so work done per-resize
// grows over the life of the page (also a leak).

function initGallery() {
  window.addEventListener('resize', function () {
    document.querySelectorAll('.product-card').forEach(function (card) {
      // no-op-ish work, but multiplied by (leaked listener count) it adds up
      card.style.transform = 'translateZ(0)';
    });
  });
}
initGallery();
document.addEventListener('DOMContentLoaded', initGallery); // called again -> compounds the leak

// --- BUG: layout thrashing. For every card we read a layout property
// (offsetHeight) and then immediately write a style, interleaved, forcing
// the browser to recalculate layout on every single iteration instead of
// batching all reads then all writes.
function equalizeCardHeights() {
  const cards = document.querySelectorAll('.product-card');
  cards.forEach(function (card) {
    const h = card.offsetHeight;           // READ (forces layout)
    card.style.minHeight = h  + 'px';   // WRITE //fixed 08-07-2026
    const h2 = card.offsetHeight;          // READ again (forces layout again)
    card.querySelector('.info').style.paddingTop = (h2 % 5) + 'px'; // WRITE
  });
}
window.addEventListener('scroll', equalizeCardHeights); // no throttling/debouncing at all

// --- BUG: blocking synchronous XHR on the main thread to fetch "reviews".
// This freezes rendering/input until the (artificially slow) request
// completes. Should be an async fetch().

// function loadReviewsSync() {
//   const xhr = new XMLHttpRequest();
//   xhr.open('GET', 'data/reviews.json', false); // false = synchronous
//   xhr.send(null);
//   return JSON.parse(xhr.responseText);
// }


async function loadReviewsSync() {//added 08-07-2026
     const response = await fetch('data/reviews.json');
     
     return await response.json();
}

// --- BUG: renders thousands of DOM nodes in one go with no pagination
// or virtualization, and does it with wasteful innerHTML += in a loop
// (which re-parses the growing string every iteration).
function renderReviews() {
  const reviews = loadReviewsSync();
  const list = document.getElementById('review-list');
  let html = '';
  for (let i = 0; i < reviews.length; i++) {
    // innerHTML += re-serializes and re-parses the ENTIRE list every pass
    html += '<div class="review-item"><strong>' + reviews[i].name +
      '</strong> <span class="stars">' + '★'.repeat(reviews[i].rating) +
      '</span><p>' + reviews[i].text + '</p></div>';
    
  }
  list.innerHTML = html;//fixed 08-07-2026
}

// --- BUG: canvas "particle" background animated with setInterval at an
// unthrottled rate, recreating a brand-new array of particle objects on
// every single tick instead of updating existing ones, and never using
// requestAnimationFrame (so it keeps ticking even when the tab is
// backgrounded, and isn't synced to the display's refresh rate).
function startParticles() {
  const canvas = document.getElementById('particle-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  setInterval(function () {
    // Recreated from scratch every tick — unnecessary allocation churn.
    const particles = [];
    for (let i = 0; i < 400; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 3 + 1,
      });
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(217,123,63,0.6)';
    particles.forEach(function (p) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }, 50); // ~60 times/sec via setInterval instead of requestAnimationFrame
}

// --- Lightweight, honest performance HUD so you can SEE the impact of
// the bugs above (and confirm improvement after fixing them). This part
// is intentionally fine — don't "fix" the HUD itself, it's the ruler,
// not the problem.
function startPerfHud() {
  const hud = document.getElementById('perf-hud');
  let frames = 0;
  let lastFpsTime = performance.now();
  let fps = 0;

  function tick(now) {
    frames++;
    if (now - lastFpsTime >= 1000) {
      fps = frames;
      frames = 0;
      lastFpsTime = now;
    }
    const domCount = document.getElementsByTagName('*').length;
    const mem = performance.memory
      ? (performance.memory.usedJSHeapSize / 1048576).toFixed(1) + ' MB'
      : 'n/a (Chrome only)';
    const listenerHint = mouseTrail.length; // grows forever -> visible leak signal

    hud.innerHTML =
      'FPS: <span class="' + (fps < 30 ? 'warn' : '') + '">' + fps + '</span><br>' +
      'DOM nodes: <span class="' + (domCount > 3000 ? 'warn' : '') + '">' + domCount + '</span><br>' +
      'JS heap: ' + mem + '<br>' +
      'mousemove buffer: <span class="' + (listenerHint > 2000 ? 'warn' : '') + '">' + listenerHint + '</span>';

    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

window.addEventListener('load', function () {
  renderReviews();
  startParticles();
  startPerfHud();
});
