<?php

namespace App\Repository;

use App\Entity\EventAlbum;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<EventAlbum>
 */
class EventAlbumRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, EventAlbum::class);
    }

    public function findOneBySlug(string $slug): ?EventAlbum
    {
        return $this->findOneBy(['slug' => strtolower(trim($slug))]);
    }

    public function isSlugAvailable(string $slug, ?int $excludeEventId = null): bool
    {
        $qb = $this->createQueryBuilder('e')
            ->select('COUNT(e.id)')
            ->where('e.slug = :slug')
            ->setParameter('slug', strtolower(trim($slug)));

        if ($excludeEventId !== null) {
            $qb->andWhere('e.id != :excludeId')
               ->setParameter('excludeId', $excludeEventId);
        }

        return (int) $qb->getQuery()->getSingleScalarResult() === 0;
    }
}
