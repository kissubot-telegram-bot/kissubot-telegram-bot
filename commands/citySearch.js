/**
 * citySearch.js — City lookup using OpenStreetMap Nominatim (free, no API key)
 */

const axios = require('axios');

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

/**
 * Search for cities matching a query string.
 * Returns up to 5 results as { label, city, country } objects.
 */
async function searchCities(query) {
  try {
    const res = await axios.get(NOMINATIM_URL, {
      params: {
        q: query,
        format: 'json',
        addressdetails: 1,
        limit: 5,
        featuretype: 'city'
      },
      headers: {
        'User-Agent': 'KissuBot/1.0 (dating bot)'
      },
      timeout: 5000
    });

    const results = res.data || [];
    const seen = new Set();
    const cities = [];

    for (const r of results) {
      const addr = r.address || {};
      const city = addr.city || addr.town || addr.village || addr.county || addr.state_district || query;
      const state = addr.state || '';
      const country = addr.country || '';
      const label = state
        ? `${city}, ${state}, ${country}`
        : `${city}, ${country}`;
      const key = label.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        cities.push({ label, city, country });
      }
      if (cities.length >= 5) break;
    }

    return cities;
  } catch (err) {
    console.error('[citySearch] Nominatim error:', err.message);
    return [];
  }
}

/**
 * Build the reply keyboard for city selection results.
 * Shows numbered buttons 1–N plus a Back button.
 */
function buildCityKeyboard(cities) {
  const nums = cities.map((_, i) => ({ text: String(i + 1) }));
  const rows = [];
  // Put all numbers in one row (up to 5)
  rows.push(nums);
  rows.push([{ text: '⬅️ Back' }]);
  return {
    keyboard: rows,
    resize_keyboard: true,
    one_time_keyboard: true
  };
}

/**
 * Format city results as a numbered list string.
 */
function formatCityList(cities) {
  return cities.map((c, i) => `${i + 1}️⃣ ${c.label}`).join('\n');
}

module.exports = { searchCities, buildCityKeyboard, formatCityList };
