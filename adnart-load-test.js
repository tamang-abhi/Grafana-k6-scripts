import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ---------- Custom metrics ----------
export const errorRate = new Rate('errors');
export const dbLikeFailures = new Counter('db_like_failures');
export const responseTime = new Trend('custom_response_time');

// ---------- Config ----------
const BASE_URL = __ENV.BASE_URL || ''; // please add base URL

// Replace these with REAL URLs from your site
const URLS = {
  home: [
    '/',
  ],
  shop: [
    '/shop/?orderby=popularity',
    '/materials/puramic/',
    '/product-category/barware/',
  ],
  categories: [
    '/product-category/category-1/',
    '/product-category/category-2/',
    '/product/asobu-bestie-sippy-sbv54/',
    '/product/asobu-happyhats-vacuum-insulated-mug-sm25/',
    '/product/asobu-aspen-bf27/',
  ],
  products: [
    '/product/12-oz-the-black-onyx-mug-screen-printed-mug880/',
    '/product/asobu-explorer-sm80/',
  ],
  translated: [
    // Examples only — replace with real WPML URLs if available
    '/fr/catalogs/',
    '/fr/demander-un-echantillon-virtuel/',
    '/fr/comment-cest-fait/#decorations/',
  ],
  search: [
    // Optional — only keep if site search is active
    '/?s=asobu&post_type=product',
    '/?s=basket&post_type=product',
    '/?s=mug&post_type=product',
    '/?s=glass&post_type=product',
    '/?s=cups&post_type=product',
  ],
  filters: [
    // Optional — add real filter/sort URLs if Woodmart uses them
    '/shop/?orderby=popularity&filter_color-catgories=pastel&query_type_color-catgories=or',
    '/shop/?orderby=popularity&filter_color-catgories=pastel&query_type_color-catgories=or&filter_key-features=puramic',
    '/shop/?orderby=popularity&filter_color-catgories=pastel&query_type_color-catgories=or&filter_key-features=puramic&filter_finish=matte-finish',
  ],
};

// ---------- k6 options ----------
export const options = {
  stages: [
    { duration: '2m', target: 5 },
    { duration: '2m', target: 10 },
    { duration: '2m', target: 20 },
    { duration: '2m', target: 40 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.10'],
    errors: ['rate<0.10'],
    http_req_duration: ['p(95)<5000'],
  },
  noConnectionReuse: false,
  userAgent: 'k6-adnart-catalog-load-test',
};

// ---------- Helpers ----------
function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function makeUrl(path) {
  return `${BASE_URL}${path}`;
}

function defaultHeaders() {
  return {
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
  };
}

function recordResponse(res, label) {
  const ok = check(res, {
    [`${label}: status < 400`]: (r) => r.status < 400,
    [`${label}: body returned`]: (r) => !!r.body,
  });

  responseTime.add(res.timings.duration);

  const body = (res.body || '').toLowerCase();

  const looksLikeFailure =
    body.includes('error establishing a database connection') ||
    body.includes('database connection error') ||
    body.includes('wordpress database error') ||
    body.includes('critical error on this website') ||
    res.status === 500 ||
    res.status === 502 ||
    res.status === 503 ||
    res.status === 504;

  if (!ok || looksLikeFailure) {
    errorRate.add(1);
  } else {
    errorRate.add(0);
  }

  if (looksLikeFailure) {
    dbLikeFailures.add(1);
    console.log(`[${label}] Possible DB/PHP failure: ${res.status} ${res.url}`);
  }
}

function fetchPage(path, label) {
  const res = http.get(makeUrl(path), {
    headers: defaultHeaders(),
    redirects: 5,
    timeout: '30s',
    tags: { page_type: label },
  });

  recordResponse(res, label);
  return res;
}

// ---------- Main scenario ----------
export default function () {
  group('catalog browsing journey', function () {
    fetchPage(randomItem(URLS.home), 'home');
    sleep(Math.random() * 2 + 1);

    fetchPage(randomItem(URLS.shop), 'shop');
    sleep(Math.random() * 2 + 1);

    fetchPage(randomItem(URLS.categories), 'category');
    sleep(Math.random() * 2 + 1);

    fetchPage(randomItem(URLS.products), 'product');
    sleep(Math.random() * 2 + 1);

    if (URLS.translated.length > 0) {
      fetchPage(randomItem(URLS.translated), 'translated');
      sleep(Math.random() * 2 + 1);
    }

    if (URLS.search.length > 0) {
      fetchPage(randomItem(URLS.search), 'search');
      sleep(Math.random() * 2 + 1);
    }

    if (URLS.filters.length > 0) {
      fetchPage(randomItem(URLS.filters), 'filter');
      sleep(Math.random() * 2 + 1);
    }
  });
}