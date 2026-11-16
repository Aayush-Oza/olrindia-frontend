/* ============================================================
   OLR INDIA - SHARED UTILS
   Single source of truth for helpers used across multiple pages.
   Load this before any page-specific script that needs these.
   ============================================================ */

// ── Slugify ───────────────────────────────────────────────────
function slugify(text) {
  return (text || '').toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ── Condition label ───────────────────────────────────────────
function conditionLabel(val) {
  const map = { new: 'New', like_new: 'Like New', good: 'Good', fair: 'Fair' };
  return map[val] || val;
}

// ── Get initials from a name ──────────────────────────────────
function getInitials(name) {
  if (!name) return 'V';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// ── Navigate to a product detail page ────────────────────────
function openProduct(slug, category, city) {
  if (!slug) return;
  window.location.href = `/product/${slugify(category || '')}/${slugify(city || 'india')}/${slug}`;
}

// ── Build price label ─────────────────────────────────────────
// priceType: the active filter value ('hour'|'km'|'day'|'month'|'')
// Pass activeFilters.priceType (or '' for pages without that filter).
function buildPriceLabel(p, priceType) {
  if (p.listing_type === 'sell') {
    return p.selling_price
      ? `₹${p.selling_price}`
      : `<span style="color:var(--c-ink-faint);font-size:12px;">Price not set</span>`;
  }
  const type = priceType || '';
  if (type === 'hour'  && p.rent_per_hour)  return `₹${p.rent_per_hour} <span>/ hour</span>`;
  if (type === 'km'    && p.rent_per_km)    return `₹${p.rent_per_km} <span>/ km</span>`;
  if (type === 'day'   && p.rent_per_day)   return `₹${p.rent_per_day} <span>/ day</span>`;
  if (type === 'month' && p.rent_per_month) return `₹${p.rent_per_month} <span>/ month</span>`;
  if (p.rent_per_day)   return `₹${p.rent_per_day} <span>/ day</span>`;
  if (p.rent_per_hour)  return `₹${p.rent_per_hour} <span>/ hour</span>`;
  if (p.rent_per_month) return `₹${p.rent_per_month} <span>/ month</span>`;
  if (p.rent_per_km)    return `₹${p.rent_per_km} <span>/ km</span>`;
  return `<span style="color:var(--c-ink-faint);font-size:12px;">Price not set</span>`;
}
