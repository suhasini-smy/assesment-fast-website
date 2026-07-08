/* ===================================================================
   TrailGear Co. — analytics.js  (added in the "expert" difficulty pass)

   This simulates a typical in-house analytics/tracking layer. It reads
   as reasonable, defensively-written code — it even has a "throttle"
   utility right there to prove the author thought about performance.
   That's the point: several of these bugs are logic bugs you have to
   READ to find, not just profile.
   =================================================================== */

// Looks like a standard throttle helper...
function throttle(fn, wait) {
  let last = 0;
  return function (...args) {
    const now = Date.now();
    // BUG: should be `now - last >= wait`. As written this is always
    // true (a duration is never negative), so this "throttle" fires on
    // every single call — zero actual throttling. Easy to miss in review
    // because the shape of the code looks correct.
    if (now - last >= 0) {
      last = now;
      fn.apply(this, args);
    }
  };
}

// Buffer of tracked events. Intentionally never trimmed or capped.
let analyticsBuffer = [];

function logEvent(type, payload) {
  analyticsBuffer.push({ type, payload, t: Date.now() });

  // BUG: localStorage is synchronous, disk-backed, and here we
  // re-serialize the ENTIRE growing buffer on every call. Wrapped in
  // the (broken) throttle above, this runs on every scroll/mousemove
  // tick instead of the "every 200ms" the throttle call site implies.
  try {
    localStorage.setItem('trailgear_analytics', JSON.stringify(analyticsBuffer));
  } catch (e) {
    // storage quota errors swallowed silently
  }
}

const trackScroll = throttle(function () {
  logEvent('scroll', { y: window.scrollY });
}, 200); // <- looks safe, isn't, because throttle() is broken

window.addEventListener('scroll', trackScroll);

// "View tracking" for product cards. BUG: this creates a BRAND NEW
// IntersectionObserver instance every time it runs, observes every
// card again, and never disconnects the previous observer. Because
// it's wired to the same (non-throttling) scroll handler, a new set of
// observers gets created on nearly every scroll event — an
// ever-growing pile of active observers all still firing.
function trackProductVisibility() {
  const observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        logEvent('product_view', { id: entry.target.dataset.productId || null });
      }
    });
  });
  document.querySelectorAll('.product-card').forEach(function (card) {
    observer.observe(card);
  });
}
window.addEventListener('scroll', throttle(trackProductVisibility, 500)); // also unthrottled in practice

// "Sync to server" heartbeat. In a real app this would POST the
// buffer and clear it. Here it never clears the buffer, so this
// JSON.stringify call gets a little more expensive every time it
// runs, for as long as the tab stays open — a slow, compounding
// "boiling frog" cost that a 10-second profile won't show, but a
// 5-minute session will.
setInterval(function () {
  const payload = JSON.stringify(analyticsBuffer); // never sent anywhere, never cleared
  console.debug('[analytics] would sync', payload.length, 'bytes');
}, 2000);

window.addEventListener('load', function () {
  logEvent('page_load', { path: location.pathname });
});
