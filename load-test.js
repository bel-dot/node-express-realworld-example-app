import http from 'k6/http';
import { check, sleep } from 'k6';

// Вибір профілю навантаження через змінну оточення SCENARIO (normal або stress)
const scenarioType = __ENV.SCENARIO || 'normal';

const scenarios = {
  normal: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '15s', target: 25 },  // Ramp-up
      { duration: '45s', target: 25 },  // Steady load
      { duration: '10s', target: 0 },   // Ramp-down
    ],
    gracefulRampDown: '5s',
  },
  stress: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '10s', target: 200 }, 
      { duration: '30s', target: 400 }, 
      { duration: '10s', target: 0 },   
    ],
    gracefulRampDown: '5s',
  },
};

export const options = {
  scenarios: {
    default_scenario: scenarios[scenarioType],
  },
  thresholds: {
    // SLO 1: Error Rate < 1%
    http_req_failed: [
      {
        threshold: 'rate<0.01',
        abortOnFail: false,
      },
    ],
    // SLO 2 & 3: p95 <= 250ms, p99 <= 500ms
    http_req_duration: [
      {
        threshold: 'p(95)<=150',
        abortOnFail: false,
      },
      {
        threshold: 'p(99)<=200',
        abortOnFail: false,
      },
    ],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api';

export default function () {
  const url = `${BASE_URL}/articles?limit=10&offset=0`;
  
  const params = {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'k6-load-test-agent',
    },
    timeout: '5s',
  };

  const response = http.get(url, params);

  // Валідація контракту відповіді
  check(response, {
    'status is 200': (r) => r.status === 200,
    'has articles array': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.articles);
      } catch (e) {
        return false;
      }
    },
  });

  // Затримка між запитами (think time)
  if (scenarioType != 'stress') {
    sleep(0.1);
  }
}
