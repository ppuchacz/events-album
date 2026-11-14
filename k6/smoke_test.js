import { sleep, check } from 'k6';
import { EventAlbumClient } from './lib/api.js';
import { generateRandomSlug, generateRandomEmail } from './lib/fixtures.js';

const sampleSmall = open('./fixtures/sample_small.jpg', 'b');

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    checks: ['rate==1.0'],
    http_req_failed: ['rate==0'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

export default function () {
  const client = new EventAlbumClient(BASE_URL);

  console.log(`[Smoke Test] Uruchamianie testu dymnego przeciwko: ${BASE_URL}`);

  // 1. Pobranie strony głównej
  const frontRes = client.fetchFrontendApp();
  check(frontRes, { 'Frontend dostępny': (r) => r.status === 200 });

  // 2. Rejestracja
  const email = generateRandomEmail('smoke');
  const slug = generateRandomSlug('smoke');
  const regRes = client.register(email, 'Haslo123!', 'Smoke Test Event', slug);
  check(regRes, { 'Rejestracja powiodła się': (r) => r.status === 201 });

  // 3. Logowanie
  const loginRes = client.login(email, 'Haslo123!');
  check(loginRes, { 'Logowanie powiodło się': (r) => r.status === 200 });
  const token = loginRes.json('token');

  // 4. Panel Admina
  const adminRes = client.getAdminEvent(token);
  check(adminRes, { 'Panel admina dostępny': (r) => r.status === 200 });

  // 5. Zmiana jakości
  const updateRes = client.updateAdminEvent(token, { displayQuality: 'medium' });
  check(updateRes, { 'Aktualizacja jakości powiodła się': (r) => r.status === 200 });

  // 6. Publiczna strona gościa
  const guestRes = client.getPublicEvent(slug);
  check(guestRes, { 'Strona gości dostępna': (r) => r.status === 200 });

  // 7. Wrzucenie zdjęcia przez gościa
  const uploadRes = client.uploadGuestMedia(
    slug,
    sampleSmall,
    'smoke_test.jpg',
    'Tester Dymny',
    'Życzenia testowe!'
  );
  check(uploadRes, { 'Upload zdjęcia powiódł się': (r) => r.status === 201 });

  const uploaded = uploadRes.json('uploaded.0');
  if (uploaded && uploaded.thumbnailUrl) {
    // 8. Pobranie miniatury
    const thumbRes = client.fetchMediaAsset(uploaded.thumbnailUrl);
    check(thumbRes, { 'Pobranie miniatury powiodło się': (r) => r.status === 200 });
  }

  console.log('[Smoke Test] Wszystkie kroki przeszły pomyślnie!');
}
