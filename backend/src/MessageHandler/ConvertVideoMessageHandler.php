<?php

namespace App\MessageHandler;

use App\Entity\MediaItem;
use App\Message\ConvertVideoMessage;
use App\Repository\MediaItemRepository;
use App\Service\MediaProcessorService;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\Messenger\Attribute\AsMessageHandler;

#[AsMessageHandler]
class ConvertVideoMessageHandler
{
    public function __construct(
        private readonly MediaItemRepository $mediaItemRepository,
        private readonly MediaProcessorService $mediaProcessor,
        private readonly EntityManagerInterface $entityManager,
        private readonly LoggerInterface $logger,
    ) {
    }

    public function __invoke(ConvertVideoMessage $message): void
    {
        $mediaItem = $this->mediaItemRepository->find($message->getMediaItemId());
        if (null === $mediaItem) {
            $this->logger->warning(sprintf('MediaItem #%d nie został znaleziony.', $message->getMediaItemId()));
            return;
        }

        if ($mediaItem->getType() !== MediaItem::TYPE_VIDEO) {
            return;
        }

        $mediaItem->setStatus(MediaItem::STATUS_PROCESSING);
        $this->entityManager->flush();

        try {
            $this->mediaProcessor->convertVideoAndGenerateThumbnail($mediaItem);
            $this->entityManager->flush();

            $this->logger->info(sprintf('Pomyślnie przekonwertowano film #%d.', $mediaItem->getId()));
        } catch (\Throwable $e) {
            $mediaItem->setStatus(MediaItem::STATUS_FAILED);
            $mediaItem->setErrorMessage($e->getMessage());
            $this->entityManager->flush();

            $this->logger->error(sprintf('Błąd konwersji filmu #%d: %s', $mediaItem->getId(), $e->getMessage()));
            throw $e;
        }
    }
}
