export type DisplayQuality = 'high' | 'medium' | 'low' | 'very_low';

export interface UserInfo {
  id: number;
  email: string;
}

export interface EventAdminData {
  id: number;
  title: string;
  description: string | null;
  slug: string;
  allowUploads: boolean;
  isActive: boolean;
  activeFrom: string | null;
  activeTo: string | null;
  displayQuality: DisplayQuality;
  displayQualityLabel: string;
  availableQualities: Record<DisplayQuality, string>;
  isCurrentlyVisible: boolean;
  visibilityReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EventGuestData {
  title: string;
  description?: string | null;
  slug: string;
  allowUploads?: boolean;
  displayQuality?: DisplayQuality;
  displayQualityLabel?: string;
  activeFrom: string | null;
  activeTo: string | null;
}

export interface MediaItemData {
  id: number;
  type: 'image' | 'video';
  originalFilename: string;
  authorName: string | null;
  caption: string | null;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  thumbnailUrl: string | null;
  displayUrl: string;
  activeQuality: DisplayQuality;
  width: number | null;
  height: number | null;
  duration: number | null;
  fileSize: number;
  mimeType: string;
  createdAt: string;
  // Admin fields
  isHidden?: boolean;
  originalUrl?: string;
  variants?: Record<string, string>;
  errorMessage?: string | null;
}

export interface GuestEventResponse {
  isAvailable: boolean;
  reason: string | null;
  event: EventGuestData;
  media: MediaItemData[];
}
