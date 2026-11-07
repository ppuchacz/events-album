<?php

namespace App\Repository;

use App\Entity\EventAlbum;
use App\Entity\MediaItem;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<MediaItem>
 */
class MediaItemRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, MediaItem::class);
    }

    /**
     * @return list<MediaItem>
     */
    public function findVisibleForEvent(EventAlbum $event): array
    {
        return $this->createQueryBuilder('m')
            ->andWhere('m.event = :event')
            ->andWhere('m.isHidden = false')
            ->setParameter('event', $event)
            ->orderBy('m.createdAt', 'DESC')
            ->getQuery()
            ->getResult();
    }

    /**
     * @return list<MediaItem>
     */
    public function findAllForEvent(EventAlbum $event): array
    {
        return $this->createQueryBuilder('m')
            ->andWhere('m.event = :event')
            ->setParameter('event', $event)
            ->orderBy('m.createdAt', 'DESC')
            ->getQuery()
            ->getResult();
    }
}
