<?php

namespace App\Service;

use App\Entity\EventAlbum;
use App\Entity\MediaItem;

class EventSerializer
{
    public function serializeEventForAdmin(EventAlbum $event): array
    {
        return [
            'id' => $event->getId(),
            'title' => $event->getTitle(),
            'description' => $event->getDescription(),
            'slug' => $event->getSlug(),
            'allowUploads' => $event->isAllowUploads(),
            'isActive' => $event->isActive(),
            'activeFrom' => $event->getActiveFrom()?->format(\DateTimeInterface::ATOM),
            'activeTo' => $event->getActiveTo()?->format(\DateTimeInterface::ATOM),
            'displayQuality' => $event->getDisplayQuality(),
            'displayQualityLabel' => $event->getDisplayQualityLabel(),
            'availableQualities' => EventAlbum::ALLOWED_QUALITIES,
            'isCurrentlyVisible' => $event->isCurrentlyVisible(),
            'visibilityReason' => $event->getVisibilityStatusReason(),
            'createdAt' => $event->getCreatedAt()->format(\DateTimeInterface::ATOM),
            'updatedAt' => $event->getUpdatedAt()->format(\DateTimeInterface::ATOM),
        ];
    }

    public function serializeEventForGuest(EventAlbum $event): array
    {
        return [
            'title' => $event->getTitle(),
            'description' => $event->getDescription(),
            'slug' => $event->getSlug(),
            'allowUploads' => $event->isAllowUploads(),
            'displayQuality' => $event->getDisplayQuality(),
            'displayQualityLabel' => $event->getDisplayQualityLabel(),
            'activeFrom' => $event->getActiveFrom()?->format(\DateTimeInterface::ATOM),
            'activeTo' => $event->getActiveTo()?->format(\DateTimeInterface::ATOM),
        ];
    }

    public function serializeMediaItem(MediaItem $item, string $quality, bool $includeAdminFields = false): array
    {
        $displayUrl = $item->getPathForQuality($quality);
        $thumbnailUrl = $item->getThumbnailPath() ?: ($item->getType() === MediaItem::TYPE_IMAGE ? $displayUrl : null);

        $data = [
            'id' => $item->getId(),
            'type' => $item->getType(),
            'originalFilename' => $item->getOriginalFilename(),
            'authorName' => $item->getAuthorName(),
            'caption' => $item->getCaption(),
            'status' => $item->getStatus(),
            'thumbnailUrl' => $thumbnailUrl,
            'displayUrl' => $displayUrl,
            'activeQuality' => $quality,
            'width' => $item->getWidth(),
            'height' => $item->getHeight(),
            'duration' => $item->getDuration(),
            'fileSize' => $item->getFileSize(),
            'mimeType' => $item->getMimeType(),
            'createdAt' => $item->getCreatedAt()->format(\DateTimeInterface::ATOM),
        ];

        if ($includeAdminFields) {
            $data['isHidden'] = $item->isHidden();
            $data['originalUrl'] = $item->getOriginalPath();
            $data['variants'] = $item->getVariants();
            $data['errorMessage'] = $item->getErrorMessage();
        }

        return $data;
    }

    public static function slugify(string $text): string
    {
        $transliterated = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $text);
        if ($transliterated === false || $transliterated === '') {
            $transliterated = $text;
        }
        $slug = preg_replace('/[^a-zA-Z0-9]+/', '-', strtolower($transliterated)) ?? '';
        $slug = trim($slug, '-');

        return $slug !== '' ? substr($slug, 0, 80) : 'wydarzenie';
    }
}
