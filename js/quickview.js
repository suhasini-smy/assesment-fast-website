/* ===================================================================
   TrailGear Co. — quickview.js  (added in the "expert" difficulty pass)

   Adds a "Quick View" modal to each product card. Functionally it
   works fine — open it, close it, nothing looks wrong. The bug only
   shows up in a heap snapshot: closed modals are never actually
   released.
   =================================================================== */

// BUG: every closed modal gets pushed here "for analytics/history" and
// is never cleared. Since each entry holds a reference to a DOM node
// that has been removed from the document, the garbage collector
// can't reclaim any of them — classic detached-node memory leak.
// It's invisible in the DOM inspector (the nodes aren't in the tree)
// and invisible in normal use (nothing breaks) — only a heap snapshot
// diff between two "open + close" cycles reveals it.
const closedModalHistory = [];

function openQuickView(card) {
  const name = card.querySelector('h3').textContent;
  const price = card.querySelector('.price').textContent;
  const img = card.querySelector('img').src;

  const overlay = document.createElement('div');
  overlay.className = 'quickview-overlay';
  overlay.innerHTML =
    '<div class="quickview-modal">' +
    '  <button class="quickview-close" aria-label="Close">&times;</button>' +
    '  <img src="' + img + '" alt="' + name + '">' +
    '  <h3>' + name + '</h3>' +
    '  <p class="price">' + price + '</p>' +
    '</div>';

  document.body.appendChild(overlay);

  // BUG: a fresh click-outside-to-close listener is added on `document`
  // every single time a Quick View is opened, and it is never removed
  // — including the one attached to THIS overlay after it's closed.
  // Open/close a few times and every past overlay's listener is still
  // live, still running its full logic on every future click anywhere
  // on the page.
  document.addEventListener('click', function outsideClickHandler(e) {
    if (e.target === overlay) {
      closeQuickView(overlay);
    }
  });

  overlay.querySelector('.quickview-close').addEventListener('click', function () {
    closeQuickView(overlay);
  });
}

function closeQuickView(overlay) {
  overlay.remove(); // removed from the DOM...
  closedModalHistory.push(overlay); // ...but retained here forever
}

document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.product-card').forEach(function (card) {
    card.style.cursor = 'pointer';
    card.addEventListener('click', function () {
      openQuickView(card);
    });
  });
});
