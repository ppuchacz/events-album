import { EventAdminData, GuestEventResponse, MediaItemData, UserInfo } from './types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export function resolveMediaUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  return `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
}

export function getAuthToken(): string | null {
  return localStorage.getItem('events_album_token');
}

export function setAuthToken(token: string | null): void {
  if (token) {
    localStorage.setItem('events_album_token', token);
  } else {
    localStorage.removeItem('events_album_token');
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Błąd zapytania (${response.status})`);
  }

  return data as T;
}

export const api = {
  register(payload: { email: string; password: string; eventTitle?: string; slug?: string }) {
    return request<{ token: string; user: UserInfo; event: EventAdminData }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  login(payload: { email: string; password: string }) {
    return request<{ token: string; user: UserInfo; event: EventAdminData }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getMe() {
    return request<{ user: UserInfo; event: EventAdminData }>('/api/admin/me');
  },

  getAdminEvent() {
    return request<{ event: EventAdminData; media: MediaItemData[] }>('/api/admin/event');
  },

  updateAdminEvent(payload: Partial<{
    title: string;
    description: string | null;
    slug: string;
    allowUploads: boolean;
    isActive: boolean;
    activeFrom: string | null;
    activeTo: string | null;
    displayQuality: string;
  }>) {
    return request<{ event: EventAdminData; media: MediaItemData[] }>('/api/admin/event', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  toggleMediaVisibility(id: number, isHidden: boolean) {
    return request<{ mediaItem: MediaItemData }>(`/api/admin/media/${id}/visibility`, {
      method: 'PATCH',
      body: JSON.stringify({ isHidden }),
    });
  },

  deleteMedia(id: number) {
    return request<{ deleted: boolean; id: number }>(`/api/admin/media/${id}`, {
      method: 'DELETE',
    });
  },

  reprocessMedia(id: number) {
    return request<{ mediaItem: MediaItemData }>(`/api/admin/media/${id}/reprocess`, {
      method: 'POST',
    });
  },

  getPublicEvent(slug: string) {
    return request<GuestEventResponse>(`/api/public/events/${encodeURIComponent(slug)}`);
  },

  uploadGuestMedia(slug: string, files: File[], authorName?: string, caption?: string) {
    const formData = new FormData();
    files.forEach((file) => formData.append('files[]', file));
    if (authorName && authorName.trim() !== '') {
      formData.append('authorName', authorName.trim());
    }
    if (caption && caption.trim() !== '') {
      formData.append('caption', caption.trim());
    }

    return request<{ uploaded: MediaItemData[] }>(`/api/public/events/${encodeURIComponent(slug)}/media`, {
      method: 'POST',
      body: formData,
    });
  },
};
