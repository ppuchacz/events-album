<?php

namespace App\Controller;

use App\Entity\EventAlbum;
use App\Entity\MediaItem;
use App\Entity\User;
use App\Message\ConvertVideoMessage;
use App\Repository\EventAlbumRepository;
use App\Repository\MediaItemRepository;
use App\Service\EventSerializer;
use App\Service\MediaProcessorService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Messenger\MessageBusInterface;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

#[Route('/api/admin')]
class AdminEventController extends AbstractController
{
    public function __construct(
        private readonly EventAlbumRepository $eventRepository,
        private readonly MediaItemRepository $mediaRepository,
        private readonly EntityManagerInterface $entityManager,
        private readonly EventSerializer $serializer,
        private readonly MediaProcessorService $mediaProcessor,
        private readonly MessageBusInterface $messageBus,
    ) {
    }

    #[Route('/event', name: 'api_admin_event_get', methods: ['GET'])]
    public function getEvent(#[CurrentUser] ?User $user): JsonResponse
    {
        if (null === $user || null === $user->getEvent()) {
            return $this->json(['error' => 'Nie znaleziono wydarzenia przypisanego do konta.'], Response::HTTP_NOT_FOUND);
        }

        $event = $user->getEvent();
        $mediaItems = $this->mediaRepository->findAllForEvent($event);

        return $this->json([
            'event' => $this->serializer->serializeEventForAdmin($event),
            'media' => array_map(
                fn (MediaItem $item) => $this->serializer->serializeMediaItem($item, $event->getDisplayQuality(), true),
                $mediaItems
            ),
        ]);
    }

    #[Route('/event', name: 'api_admin_event_update', methods: ['PUT', 'PATCH'])]
    public function updateEvent(Request $request, #[CurrentUser] ?User $user): JsonResponse
    {
        if (null === $user || null === $user->getEvent()) {
            return $this->json(['error' => 'Nie znaleziono wydarzenia przypisanego do konta.'], Response::HTTP_NOT_FOUND);
        }

        $event = $user->getEvent();
        $payload = json_decode($request->getContent(), true);
        if (!is_array($payload)) {
            return $this->json(['error' => 'Nieprawidłowy format danych JSON.'], Response::HTTP_BAD_REQUEST);
        }

        if (array_key_exists('title', $payload)) {
            $title = trim((string) $payload['title']);
            if ($title === '') {
                return $this->json(['error' => 'Nazwa wydarzenia nie może być pusta.'], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
            $event->setTitle($title);
        }

        if (array_key_exists('description', $payload)) {
            $event->setDescription($payload['description'] !== null ? (string) $payload['description'] : null);
        }

        if (array_key_exists('slug', $payload)) {
            $rawSlug = trim((string) $payload['slug']);
            $normalizedSlug = EventSerializer::slugify($rawSlug);
            if ($rawSlug === '' || $normalizedSlug === '') {
                return $this->json(['error' => 'Identyfikator (slug) nie może być pusty.'], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
            if (!preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $rawSlug)) {
                $rawSlug = $normalizedSlug;
            }
            if (!$this->eventRepository->isSlugAvailable($rawSlug, $event->getId())) {
                return $this->json(['error' => 'Ten identyfikator (slug) jest już zajęty przez inne wydarzenie.'], Response::HTTP_CONFLICT);
            }
            $event->setSlug($rawSlug);
        }

        if (array_key_exists('allowUploads', $payload)) {
            $event->setAllowUploads((bool) $payload['allowUploads']);
        }

        if (array_key_exists('isActive', $payload)) {
            $event->setIsActive((bool) $payload['isActive']);
        }

        if (array_key_exists('activeFrom', $payload)) {
            $rawFrom = $payload['activeFrom'];
            if ($rawFrom === null || trim((string) $rawFrom) === '') {
                $event->setActiveFrom(null);
            } else {
                try {
                    $event->setActiveFrom(new \DateTimeImmutable((string) $rawFrom));
                } catch (\Throwable) {
                    return $this->json(['error' => 'Nieprawidłowy format daty początkowej.'], Response::HTTP_UNPROCESSABLE_ENTITY);
                }
            }
        }

        if (array_key_exists('activeTo', $payload)) {
            $rawTo = $payload['activeTo'];
            if ($rawTo === null || trim((string) $rawTo) === '') {
                $event->setActiveTo(null);
            } else {
                try {
                    $event->setActiveTo(new \DateTimeImmutable((string) $rawTo));
                } catch (\Throwable) {
                    return $this->json(['error' => 'Nieprawidłowy format daty końcowej.'], Response::HTTP_UNPROCESSABLE_ENTITY);
                }
            }
        }

        if ($event->getActiveFrom() !== null && $event->getActiveTo() !== null) {
            if ($event->getActiveFrom() > $event->getActiveTo()) {
                return $this->json([
                    'error' => 'Data rozpoczęcia aktywności nie może być późniejsza niż data zakończenia.',
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
        }

        if (array_key_exists('displayQuality', $payload)) {
            $quality = (string) $payload['displayQuality'];
            if (!array_key_exists($quality, EventAlbum::ALLOWED_QUALITIES)) {
                return $this->json([
                    'error' => 'Nieprawidłowa jakość wyświetlania. Dozwolone: high, medium, low, very_low.',
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
            $event->setDisplayQuality($quality);
        }

        $this->entityManager->flush();

        $mediaItems = $this->mediaRepository->findAllForEvent($event);

        return $this->json([
            'event' => $this->serializer->serializeEventForAdmin($event),
            'media' => array_map(
                fn (MediaItem $item) => $this->serializer->serializeMediaItem($item, $event->getDisplayQuality(), true),
                $mediaItems
            ),
        ]);
    }

    #[Route('/media/{id}/visibility', name: 'api_admin_media_visibility', methods: ['PATCH', 'PUT'])]
    public function updateMediaVisibility(int $id, Request $request, #[CurrentUser] ?User $user): JsonResponse
    {
        if (null === $user || null === $user->getEvent()) {
            return $this->json(['error' => 'Brak autoryzacji.'], Response::HTTP_UNAUTHORIZED);
        }

        $mediaItem = $this->mediaRepository->find($id);
        if (null === $mediaItem || $mediaItem->getEvent()->getId() !== $user->getEvent()->getId()) {
            return $this->json(['error' => 'Nie znaleziono materiału.'], Response::HTTP_NOT_FOUND);
        }

        $payload = json_decode($request->getContent(), true) ?? [];
        if (array_key_exists('isHidden', $payload)) {
            $mediaItem->setIsHidden((bool) $payload['isHidden']);
        } else {
            $mediaItem->setIsHidden(!$mediaItem->isHidden());
        }

        $this->entityManager->flush();

        return $this->json([
            'mediaItem' => $this->serializer->serializeMediaItem(
                $mediaItem,
                $user->getEvent()->getDisplayQuality(),
                true
            ),
        ]);
    }

    #[Route('/media/{id}', name: 'api_admin_media_delete', methods: ['DELETE'])]
    public function deleteMedia(int $id, #[CurrentUser] ?User $user): JsonResponse
    {
        if (null === $user || null === $user->getEvent()) {
            return $this->json(['error' => 'Brak autoryzacji.'], Response::HTTP_UNAUTHORIZED);
        }

        $mediaItem = $this->mediaRepository->find($id);
        if (null === $mediaItem || $mediaItem->getEvent()->getId() !== $user->getEvent()->getId()) {
            return $this->json(['error' => 'Nie znaleziono materiału.'], Response::HTTP_NOT_FOUND);
        }

        $this->mediaProcessor->deleteMediaFiles($mediaItem);
        $this->entityManager->remove($mediaItem);
        $this->entityManager->flush();

        return $this->json(['deleted' => true, 'id' => $id]);
    }

    #[Route('/media/{id}/reprocess', name: 'api_admin_media_reprocess', methods: ['POST'])]
    public function reprocessMedia(int $id, #[CurrentUser] ?User $user): JsonResponse
    {
        if (null === $user || null === $user->getEvent()) {
            return $this->json(['error' => 'Brak autoryzacji.'], Response::HTTP_UNAUTHORIZED);
        }

        $mediaItem = $this->mediaRepository->find($id);
        if (null === $mediaItem || $mediaItem->getEvent()->getId() !== $user->getEvent()->getId()) {
            return $this->json(['error' => 'Nie znaleziono materiału.'], Response::HTTP_NOT_FOUND);
        }

        if ($mediaItem->getType() === MediaItem::TYPE_VIDEO) {
            $mediaItem->setStatus(MediaItem::STATUS_PENDING);
            $mediaItem->setErrorMessage(null);
            $this->entityManager->flush();
            $this->messageBus->dispatch(new ConvertVideoMessage((int) $mediaItem->getId()));
        } else {
            $this->mediaProcessor->processImage($mediaItem);
            $this->entityManager->flush();
        }

        return $this->json([
            'mediaItem' => $this->serializer->serializeMediaItem(
                $mediaItem,
                $user->getEvent()->getDisplayQuality(),
                true
            ),
        ]);
    }
}
