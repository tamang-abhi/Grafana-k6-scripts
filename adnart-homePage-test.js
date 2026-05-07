import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 5 },
    { duration: '2m', target: 10 },
    { duration: '2m', target: 20 },
    { duration: '2m', target: 40 },
    { duration: '2m', target: 0 },
  ],
};

const BASE_URL = __ENV.BASE_URL || ''; // please add home page url

export default function () {
  const res = http.get(`${BASE_URL}/`, {
    headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
    timeout: '30s',
  });

  check(res, {
    'status < 400': (r) => r.status < 400,
  });

  sleep(1);
}
