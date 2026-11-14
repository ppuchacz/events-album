import { sleep, group } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import { EventAlbumClient } from '../lib/api.js';
import {
  GUEST_NAMES,
  GUEST_CAPTIONS,
  getRandomItem,
  generateRandomSlug,
  generateRandomEmail,
} from '../lib/fixtures.js';

const sampleMedium = open('../fixtures/sample_medium.jpg', 'b');
const sampleSmall = open('../fixtures/sample_small.jpg', 'b');

const uploadDuration = new Trend('hpa_photo_upload_ms');
const requestDuration = new Trend('hpa_request_duration_ms');
const uploadsCounter = new Counter('hpa_uploads_total');
const successRate = new Rate('hpa_success_rate');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

/**
 * Test obciążeniowy zaprojektowany do demonstracji działania HorizontalPodAutoscaler (HPA).
 * Szybki skok liczby żądań (zwłaszcza generujących obciążenie CPU operacjami GD na obrazach)
 * podnosi utylizację CPU powyżej 60% i wymusza wyskalowanie podów backendu (od 2 do 10 replik).
 */
export const options = {
  stages: [
    { duration: '20s', target: 5 },   // Poziom bazowy (2 repliki backendu)
    { duration: '30s', target: 35 },  // Agresywny wzrost ruchu (wywołanie autoskalowania HPA)
    { duration: '1m30s', target: 60 },// Utrzymanie szczytu obciążenia (praca wyskalowanej floty)
    { duration: '30s', target: 10 },  // Spadek ruchu (rozpoczęcie procedury scale-down)
    { duration: '20s', target: 0 },   // Zakończenie testu
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'], // Poniżej 5% błędów podczas gwałtownego skalowania
    hpa_success_rate: ['rate>0.95'],
  },
};

export function setup() {
  const client = new EventAlbumClient(BASE_URL);
  const slug = generateRandomSlug('hpa-test');
  const email = generateRandomEmail('hpa_admin');
  const password = 'Password123!';

  console.log(`[HPA Test Setup] Rejestracja wydarzenia testowego: ${slug} na ${BASE_URL}`);
  client.register(email, password, 'HPA Scaling Test Event', slug);

  // Wrzucenie początkowych danych
  client.uploadGuestMedia(slug, sampleSmall, 'init.jpg', 'HPA Init', 'Inicjalizacja testu skalowania');

  return { slug, email, password };
}

export default function (data) {
  const client = new EventAlbumClient(BASE_URL);
  const slug = data.slug;

  const rand = Math.random();

  if (rand < 0.40) {
    // 40% ruchu: Upload zdjęć (intensywna praca CPU - dekodowanie, skalowanie GD, generowanie 4 wariantów)
    group('HPA - Photo Upload', () => {
      const author = getRandomItem(GUEST_NAMES);
      const caption = getRandomItem(GUEST_CAPTIONS);
      const filename = `hpa_${Date.now()}_${Math.floor(Math.random() * 10000)}.jpg`;

      const t0 = Date.now();
      const res = client.uploadGuestMedia(slug, sampleMedium, filename, author, caption);
      const dur = Date.now() - t0;

      uploadDuration.add(dur);
      requestDuration.add(dur);

      const ok = res.status === 201;
      successRate.add(ok);
      if (ok) {
        uploadsCounter.add(1);
      }
    });
  } else if (rand < 0.85) {
    // 45% ruchu: Przeglądanie albumu i pobieranie wariantów (zapytania do bazy danych PostgreSQL i Nginx)
    group('HPA - Gallery Browsing', () => {
      const t0 = Date.now();
      const res = client.getPublicEvent(slug);
      requestDuration.add(Date.now() - t0);

      successRate.add(res.status === 200);

      try {
        const media = res.json('media') || [];
        if (media.length > 0) {
          const item = getRandomItem(media);
          if (item && item.thumbnailUrl) {
            client.fetchMediaAsset(item.thumbnailUrl);
          }
        }
      } catch (_) {}
    });
  } else {
    // 15% ruchu: Rejestracja i logowanie (haszowanie haseł bcrypt / argon2id obciążające procesor)
    group('HPA - Auth Traffic', () => {
      const email = generateRandomEmail('load_user');
      const pass = 'TestPassword123!';
      const newSlug = generateRandomSlug('user-event');

      const t0 = Date.now();
      const res = client.register(email, pass, 'Event ' + email, newSlug);
      requestDuration.add(Date.now() - t0);
      successRate.add(res.status === 201);
    });
  }

  // Krótki czas przerwy, aby generować stały, wysoki strumień zapytań
  sleep(0.5 + Math.random() * 0.5);
}
