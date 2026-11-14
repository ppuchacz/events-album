import http from 'k6/http';
import { check } from 'k6';

/**
 * Klient API dla testów k6 aplikacji EventAlbum.
 */

export class EventAlbumClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  /**
   * Rejestracja nowego organizatora i utworzenie albumu wydarzenia.
   */
  register(email, password, eventTitle, slug) {
    const url = `${this.baseUrl}/api/auth/register`;
    const payload = JSON.stringify({
      email,
      password,
      eventTitle,
      slug,
    });
    const params = {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      tags: { endpoint: 'auth_register' },
    };

    const res = http.post(url, payload, params);
    check(res, {
      'rejestracja status 201': (r) => r.status === 201,
      'rejestracja zawiera token': (r) => {
        try {
          return !!r.json('token');
        } catch (_) {
          return false;
        }
      },
    });

    return res;
  }

  /**
   * Logowanie organizatora do panelu administracyjnego.
   */
  login(email, password) {
    const url = `${this.baseUrl}/api/auth/login`;
    const payload = JSON.stringify({ email, password });
    const params = {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      tags: { endpoint: 'auth_login' },
    };

    const res = http.post(url, payload, params);
    check(res, {
      'logowanie status 200': (r) => r.status === 200,
      'logowanie zawiera token': (r) => {
        try {
          return !!r.json('token');
        } catch (_) {
          return false;
        }
      },
    });

    return res;
  }

  /**
   * Pobranie danych wydarzenia w panelu administracyjnym.
   */
  getAdminEvent(token) {
    const url = `${this.baseUrl}/api/admin/event`;
    const params = {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
      tags: { endpoint: 'admin_get_event' },
    };

    const res = http.get(url, params);
    check(res, {
      'pobranie admin event status 200': (r) => r.status === 200,
    });

    return res;
  }

  /**
   * Aktualizacja ustawień wydarzenia przez organizatora.
   */
  updateAdminEvent(token, updates) {
    const url = `${this.baseUrl}/api/admin/event`;
    const payload = JSON.stringify(updates);
    const params = {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      tags: { endpoint: 'admin_update_event' },
    };

    const res = http.put(url, payload, params);
    check(res, {
      'aktualizacja admin event status 200': (r) => r.status === 200,
    });

    return res;
  }

  /**
   * Pobranie publicznej strony wydarzenia dla gości (strona albumu).
   */
  getPublicEvent(slug) {
    const url = `${this.baseUrl}/api/public/events/${slug}`;
    const params = {
      headers: {
        'Accept': 'application/json',
      },
      tags: { endpoint: 'guest_get_event' },
    };

    const res = http.get(url, params);
    check(res, {
      'pobranie publicznego wydarzenia status 200': (r) => r.status === 200,
      'wydarzenie jest dostepne': (r) => {
        try {
          return r.json('isAvailable') === true;
        } catch (_) {
          return false;
        }
      },
    });

    return res;
  }

  /**
   * Wysłanie zdjęcia przez gościa na stronę albumu wydarzenia.
   */
  uploadGuestMedia(slug, imageBytes, filename, authorName, caption) {
    const url = `${this.baseUrl}/api/public/events/${slug}/media`;
    const fd = {
      file: http.file(imageBytes, filename, 'image/jpeg'),
      authorName: authorName || '',
      caption: caption || '',
    };
    const params = {
      tags: { endpoint: 'guest_upload_media' },
      timeout: '30s',
    };

    const res = http.post(url, fd, params);
    check(res, {
      'upload zdjecia status 201': (r) => r.status === 201,
      'zwrocono zserializowany mediaItem': (r) => {
        try {
          const json = r.json();
          return Array.isArray(json.uploaded) && json.uploaded.length > 0;
        } catch (_) {
          return false;
        }
      },
    });

    return res;
  }

  /**
   * Pobranie zasobu multimedialnego (miniatura lub wariant wyswietlania).
   */
  fetchMediaAsset(mediaPath) {
    if (!mediaPath) return null;
    const fullUrl = mediaPath.startsWith('http')
      ? mediaPath
      : `${this.baseUrl}${mediaPath.startsWith('/') ? '' : '/'}${mediaPath}`;

    const res = http.get(fullUrl, { tags: { endpoint: 'get_media_asset' } });
    check(res, {
      'pobranie miniatury/zdjecia status 200': (r) => r.status === 200,
    });
    return res;
  }

  /**
   * Pobranie strony głównej SPA (React index.html).
   */
  fetchFrontendApp() {
    const res = http.get(`${this.baseUrl}/`, { tags: { endpoint: 'get_frontend' } });
    check(res, {
      'frontend SPA status 200': (r) => r.status === 200,
    });
    return res;
  }
}
