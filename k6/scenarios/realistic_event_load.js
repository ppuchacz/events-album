import { sleep, group } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import { EventAlbumClient } from '../lib/api.js';
import {
  GUEST_NAMES,
  GUEST_CAPTIONS,
  EVENT_TITLES,
  getRandomItem,
  generateRandomSlug,
  generateRandomEmail,
} from '../lib/fixtures.js';

// Wczytanie przykładowych plików zdjęć o różnych rozdzielczościach
const sampleSmall = open('../fixtures/sample_small.jpg', 'b');
const sampleMedium = open('../fixtures/sample_medium.jpg', 'b');
const sampleLarge = open('../fixtures/sample_large.jpg', 'b');
const SAMPLES = [sampleSmall, sampleMedium, sampleLarge];

// Metryki specyficzne dla aplikacji EventAlbum
const uploadDuration = new Trend('event_photo_upload_duration_ms');
const galleryLoadDuration = new Trend('event_gallery_load_duration_ms');
const authDuration = new Trend('event_auth_duration_ms');
const photosUploadedCounter = new Counter('event_photos_uploaded_total');
const successfulUploadsRate = new Rate('event_successful_uploads_rate');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

// Profil ruchu odpowiadający przebiegowi rzeczywistej imprezy okolicznościowej
export const options = {
  scenarios: {
    // 1. Organizatorzy (rejestracja, logowanie, konfiguracja albumu, kontrola jakości) - ok. 5% ruchu
    organizers: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 2 },  // Przygotowanie imprezy
        { duration: '1m', target: 3 },   // Powitanie gości
        { duration: '1m30s', target: 5 },// Szczyt uroczystości
        { duration: '1m', target: 2 },   // Dalsza część zabawy
        { duration: '30s', target: 0 },  // Zakończenie
      ],
      exec: 'organizerScenario',
    },

    // 2. Goście przeglądający (skanowanie QR, wejście na stronę, oglądanie galerii i zdjęć) - ok. 70% ruchu
    browsing_guests: {
      executor: 'ramping-vus',
      startVUs: 2,
      stages: [
        { duration: '30s', target: 10 }, // Przybycie pierwszych gości i skanowanie QR
        { duration: '1m', target: 35 },  // Wypełnianie się sali, wspólne przeglądanie
        { duration: '1m30s', target: 60 },// Kulminacja zabawy (tort, tańce, toasty)
        { duration: '1m', target: 25 },  // Spokojniejsze przeglądanie galerii
        { duration: '30s', target: 0 },  // Stopniowe rozchodzenie się gości
      ],
      exec: 'browsingGuestScenario',
    },

    // 3. Goście dodający zdjęcia (robienie zdjęć telefonem, wpisanie życzeń, upload) - ok. 25% ruchu
    uploading_guests: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 4 },  // Pierwsze zdjęcia z wejścia
        { duration: '1m', target: 12 },  // Wzrost liczby dodawanych zdjęć
        { duration: '1m30s', target: 25 },// Szczyt wrzucania zdjęć z kluczowych momentów
        { duration: '1m', target: 8 },   // Dalsze zdjęcia z zabawy
        { duration: '30s', target: 0 },  // Wyciszenie
      ],
      exec: 'uploadingGuestScenario',
    },
  },

  thresholds: {
    http_req_failed: ['rate<0.02'], // Poniżej 2% błędów pod obciążeniem
    http_req_duration: ['p(95)<2000'], // 95% żądań poniżej 2 sekund
    event_successful_uploads_rate: ['rate>0.95'], // >95% poprawnych uploadów
  },
};

/**
 * Inicjalizacja środowiska testowego:
 * Utworzenie głównego wydarzenia oraz dodanie kilku zdjęć początkowych.
 */
export function setup() {
  const client = new EventAlbumClient(BASE_URL);
  const mainSlug = generateRandomSlug('wesele');
  const mainEmail = generateRandomEmail('para_mloda');
  const mainPassword = 'Password123!';
  const mainTitle = 'Wesele Kasi i Tomka';

  console.log(`[setup] Inicjalizacja głównego wydarzenia: ${mainTitle} (${mainSlug}) na ${BASE_URL}`);

  const regRes = client.register(mainEmail, mainPassword, mainTitle, mainSlug);
  let token = null;
  try {
    token = regRes.json('token');
  } catch (e) {
    console.error('[setup] Błąd parsowania odpowiedzi rejestracji:', e);
  }

  // Wrzucenie 2 zdjęć na start
  if (token) {
    client.uploadGuestMedia(
      mainSlug,
      sampleMedium,
      'start_photo1.jpg',
      'Fotograf',
      'Pierwsze pamiątkowe zdjęcie przed rozpoczęciem imprezy!'
    );
    client.uploadGuestMedia(
      mainSlug,
      sampleSmall,
      'start_photo2.jpg',
      'Organizator',
      'Zapraszamy do wspólnego dodawania zdjęć!'
    );
  }

  return {
    slug: mainSlug,
    email: mainEmail,
    password: mainPassword,
    token: token,
  };
}

/**
 * Scenariusz 1: Organizator (Rejestracja, Logowanie, Panel Admina, Konfiguracja)
 */
export function organizerScenario(data) {
  const client = new EventAlbumClient(BASE_URL);

  group('Organizator - Zarządzanie wydarzeniem', () => {
    // Co pewien czas organizator rejestruje nowe wydarzenie lub loguje się do istniejącego
    if (Math.random() < 0.3) {
      const email = generateRandomEmail('admin');
      const slug = generateRandomSlug('event');
      const title = getRandomItem(EVENT_TITLES);

      const t0 = Date.now();
      const res = client.register(email, 'TajneHaslo123!', title, slug);
      authDuration.add(Date.now() - t0);

      sleep(1);

      // Logowanie
      const t1 = Date.now();
      const loginRes = client.login(email, 'TajneHaslo123!');
      authDuration.add(Date.now() - t1);

      let token = null;
      try {
        token = loginRes.json('token');
      } catch (_) {}

      if (token) {
        // Podgląd panelu admina
        client.getAdminEvent(token);
        sleep(1.5);

        // Zmiana jakości wyświetlania (np. optymalizacja pod jakość łącza)
        const qualities = ['high', 'medium', 'low', 'very_low'];
        const chosenQuality = getRandomItem(qualities);
        client.updateAdminEvent(token, { displayQuality: chosenQuality });
      }
    } else {
      // Logowanie do istniejącego konta z setupu
      const t0 = Date.now();
      const loginRes = client.login(data.email, data.password);
      authDuration.add(Date.now() - t0);

      let token = null;
      try {
        token = loginRes.json('token');
      } catch (_) {}

      if (token) {
        client.getAdminEvent(token);
      }
    }

    // Realistyczny czas zastanowienia organizatora (think time)
    sleep(3 + Math.random() * 2);
  });
}

/**
 * Scenariusz 2: Gość przeglądający (Skanowanie QR, przeglądanie galerii, powiększanie zdjęć)
 */
export function browsingGuestScenario(data) {
  const client = new EventAlbumClient(BASE_URL);
  const slug = data.slug;

  group('Gość - Przeglądanie albumu i zdjęć', () => {
    // 1. Gość otwiera stronę w przeglądarce (ładowanie aplikacji SPA)
    client.fetchFrontendApp();
    sleep(0.5);

    // 2. Pobranie danych albumu wydarzenia z API
    const t0 = Date.now();
    const eventRes = client.getPublicEvent(slug);
    galleryLoadDuration.add(Date.now() - t0);

    let mediaList = [];
    try {
      mediaList = eventRes.json('media') || [];
    } catch (_) {}

    // 3. Przeglądanie miniaturek w galerii
    if (mediaList.length > 0) {
      // Gość pobiera miniaturki widocznych zdjęć
      const itemsToView = mediaList.slice(0, Math.min(mediaList.length, 6));
      for (const item of itemsToView) {
        if (item.thumbnailUrl) {
          client.fetchMediaAsset(item.thumbnailUrl);
        }
      }

      sleep(1 + Math.random() * 2);

      // 4. Kliknięcie w wybrane zdjęcie (pełnoekranowy Lightbox)
      const selectedItem = getRandomItem(mediaList);
      if (selectedItem && selectedItem.displayUrl) {
        client.fetchMediaAsset(selectedItem.displayUrl);
      }
    }

    // Realistyczny czas oglądania zdjęć i rozmowy przy stoliku
    sleep(2 + Math.random() * 3);
  });
}

/**
 * Scenariusz 3: Gość dodający zdjęcia (Zrobienie zdjęcia, wpisanie życzeń, wysłanie)
 */
export function uploadingGuestScenario(data) {
  const client = new EventAlbumClient(BASE_URL);
  const slug = data.slug;

  group('Gość - Wrzucanie nowego zdjęcia', () => {
    // 1. Otwarcie strony albumu
    client.getPublicEvent(slug);
    sleep(1);

    // 2. Przygotowanie zdjęcia i życzeń
    const author = getRandomItem(GUEST_NAMES);
    const caption = getRandomItem(GUEST_CAPTIONS);
    const chosenSample = getRandomItem(SAMPLES);
    const filename = `zdjecie_${Date.now()}_${Math.floor(Math.random() * 1000)}.jpg`;

    // 3. Wysłanie zdjęcia z pomiarem czasu przetwarzania po stronie backendu
    const t0 = Date.now();
    const uploadRes = client.uploadGuestMedia(slug, chosenSample, filename, author, caption);
    const duration = Date.now() - t0;
    uploadDuration.add(duration);

    const isSuccess = uploadRes.status === 201;
    successfulUploadsRate.add(isSuccess);

    if (isSuccess) {
      photosUploadedCounter.add(1);

      // 4. Gość po dodaniu zdjęcia widzi je od razu w galerii i pobiera miniaturę
      try {
        const json = uploadRes.json();
        if (json.uploaded && json.uploaded[0] && json.uploaded[0].thumbnailUrl) {
          client.fetchMediaAsset(json.uploaded[0].thumbnailUrl);
        }
      } catch (_) {}
    }

    // Czas do zrobienia kolejnego zdjęcia
    sleep(3 + Math.random() * 4);
  });
}
