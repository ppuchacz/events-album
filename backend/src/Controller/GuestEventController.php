<?php

namespace App\Controller;

use App\Entity\MediaItem;
use App\Message\ConvertVideoMessage;
use App\Repository\EventAlbumRepository;
use App\Repository\MediaItemRepository;
use App\Service\EventSerializer;
use App\Service\MediaProcessorService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Messenger\MessageBusInterface;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/public/events')]
class GuestEventController extends AbstractController
{
    private const ALLOWED_IMAGE_MIMES = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
    ];

    private const ALLOWED_VIDEO_MIMES = [
        'video/mp4',
        'video/quicktime',
        'video/webm',
        'video/x-matroska',
        'video/3gpp',
        'video/mpeg',
        'video/x-msvideo',
        'video/ogg',
    ];

    public function __construct(
        private readonly EventAlbumRepository $eventRepository,
        private readonly MediaItemRepository $mediaRepository,
        private readonly EntityManagerInterface $entityManager,
        private readonly EventSerializer $serializer,
        private readonly MediaProcessorService $mediaProcessor,
        private readonly MessageBusInterface $messageBus,
    ) {
    }

    #[Route('/{slug}', name: 'api_public_event_get', methods: ['GET'])]
    public function getPublicEvent(string $slug): JsonResponse
    {
        $event = $this->eventRepository->findOneBySlug($slug);
        if (null === $event) {
            return $this->json([
                'error' => 'Nie znaleziono wydarzenia o podanym identyfikatorze.',
            ], Response::HTTP_NOT_FOUND);
        }

        if (!$event->isCurrentlyVisible()) {
            return $this->json([
                'isAvailable' => false,
                'reason' => $event->getVisibilityStatusReason(),
                'event' => [
                    'title' => $event->getTitle(),
                    'slug' => $event->getSlug(),
                    'activeFrom' => $event->getActiveFrom()?->format(\DateTimeInterface::ATOM),
                    'activeTo' => $event->getActiveTo()?->format(\DateTimeInterface::ATOM),
                ],
                'media' => [],
            ]);
        }

        $visibleMedia = $this->mediaRepository->findVisibleForEvent($event);
        $quality = $event->getDisplayQuality();

        return $this->json([
            'isAvailable' => true,
            'reason' => null,
            'event' => $this->serializer->serializeEventForGuest($event),
            'media' => array_map(
                fn (MediaItem $item) => $this->serializer->serializeMediaItem($item, $quality, false),
                $visibleMedia
            ),
        ]);
    }

    #[Route('/{slug}/media', name: 'api_public_event_upload', methods: ['POST'])]
    public function uploadMedia(string $slug, Request $request): JsonResponse
    {
        $event = $this->eventRepository->findOneBySlug($slug);
        if (null === $event) {
            return $this->json([
                'error' => 'Nie znaleziono wydarzenia o podanym identyfikatorze.',
            ], Response::HTTP_NOT_FOUND);
        }

        if (!$event->isCurrentlyVisible()) {
            return $this->json([
                'error' => $event->getVisibilityStatusReason() ?? 'Strona wydarzenia jest obecnie nieaktywna.',
            ], Response::HTTP_FORBIDDEN);
        }

        if (!$event->isAllowUploads()) {
            return $this->json([
                'error' => 'Przesyłanie nowych zdjęć i filmów zostało wyłączone przez organizatora.',
            ], Response::HTTP_FORBIDDEN);
        }

        /** @var list<UploadedFile> $uploadedFiles */
        $uploadedFiles = [];
        $filesBag = $request->files->all();

        if (isset($filesBag['files']) && is_array($filesBag['files'])) {
            foreach ($filesBag['files'] as $f) {
                if ($f instanceof UploadedFile) {
                    $uploadedFiles[] = $f;
                }
            }
        }
        if (isset($filesBag['file']) && $filesBag['file'] instanceof UploadedFile) {
            $uploadedFiles[] = $filesBag['file'];
        }

        if (count($uploadedFiles) === 0) {
            return $this->json([
                'error' => 'Nie wybrano żadnego pliku do przesłania.',
            ], Response::HTTP_BAD_REQUEST);
        }

        $authorName = $request->request->get('authorName');
        $caption = $request->request->get('caption');

        $eventId = $event->getId();
        $origRelDir = sprintf('uploads/%s/original', $eventId);
        $origAbsDir = $this->mediaProcessor->getPublicDir() . '/' . $origRelDir;
        if (!is_dir($origAbsDir)) {
            mkdir($origAbsDir, 0775, true);
        }

        $createdItems = [];

        foreach ($uploadedFiles as $file) {
            if (!$file->isValid()) {
                return $this->json([
                    'error' => sprintf('Błąd przesyłania pliku "%s": %s', $file->getClientOriginalName(), $file->getErrorMessage()),
                ], Response::HTTP_BAD_REQUEST);
            }

            $mimeType = $file->getMimeType() ?: $file->getClientMimeType() ?: 'application/octet-stream';
            $isImage = in_array($mimeType, self::ALLOWED_IMAGE_MIMES, true) || str_starts_with($mimeType, 'image/');
            $isVideo = in_array($mimeType, self::ALLOWED_VIDEO_MIMES, true) || str_starts_with($mimeType, 'video/');

            if (!$isImage && !$isVideo) {
                return $this->json([
                    'error' => sprintf('Nieobsługiwany format pliku "%s" (%s). Dozwolone są zdjęcia i filmy.', $file->getClientOriginalName(), $mimeType),
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }

            $fileSize = (int) $file->getSize();
            $ext = strtolower($file->guessExtension() ?: pathinfo($file->getClientOriginalName(), PATHINFO_EXTENSION) ?: ($isImage ? 'jpg' : 'mp4'));
            $uniqueBase = bin2hex(random_bytes(12));
            $storedFilename = sprintf('%s.%s', $uniqueBase, $ext);

            $file->move($origAbsDir, $storedFilename);
            $relOriginalPath = sprintf('/%s/%s', $origRelDir, $storedFilename);

            $mediaItem = new MediaItem(
                $event,
                $isImage ? MediaItem::TYPE_IMAGE : MediaItem::TYPE_VIDEO,
                $file->getClientOriginalName(),
                $relOriginalPath,
                $mimeType,
                $fileSize
            );
            $mediaItem->setAuthorName(is_string($authorName) ? $authorName : null);
            $mediaItem->setCaption(is_string($caption) ? $caption : null);

            if ($isImage) {
                $this->mediaProcessor->processImage($mediaItem);
                $this->entityManager->persist($mediaItem);
                $this->entityManager->flush();
            } else {
                // Quick thumbnail right away if ffmpeg is present, then enqueue full video conversion in RabbitMQ
                $thumbsRelDir = sprintf('uploads/%s/thumbs', $eventId);
                $thumbRelPath = sprintf('/%s/%s_thumb.jpg', $thumbsRelDir, $uniqueBase);
                $thumbAbsPath = $this->mediaProcessor->getPublicDir() . $thumbRelPath;
                if ($this->mediaProcessor->generateVideoThumbnail($origAbsDir . '/' . $storedFilename, $thumbAbsPath)) {
                    $mediaItem->setThumbnailPath($thumbRelPath);
                }

                $mediaItem->setStatus(MediaItem::STATUS_PENDING);
                $this->entityManager->persist($mediaItem);
                $this->entityManager->flush();

                $this->messageBus->dispatch(new ConvertVideoMessage((int) $mediaItem->getId()));
            }

            $createdItems[] = $this->serializer->serializeMediaItem($mediaItem, $event->getDisplayQuality(), false);
        }

        return $this->json([
            'uploaded' => $createdItems,
        ], Response::HTTP_CREATED);
    }
}
