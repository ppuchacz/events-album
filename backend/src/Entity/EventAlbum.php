<?php

namespace App\Entity;

use App\Repository\EventAlbumRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: EventAlbumRepository::class)]
#[ORM\Table(name: 'event_albums')]
class EventAlbum
{
    public const QUALITY_HIGH = 'high';
    public const QUALITY_MEDIUM = 'medium';
    public const QUALITY_LOW = 'low';
    public const QUALITY_VERY_LOW = 'very_low';

    public const ALLOWED_QUALITIES = [
        self::QUALITY_HIGH => 'Wysoka',
        self::QUALITY_MEDIUM => 'Średnia',
        self::QUALITY_LOW => 'Niska',
        self::QUALITY_VERY_LOW => 'Bardzo oszczędna',
    ];

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\OneToOne(inversedBy: 'event', targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $owner;

    #[ORM\Column(length: 255)]
    private string $title;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $description = null;

    #[ORM\Column(length: 120, unique: true)]
    private string $slug;

    #[ORM\Column]
    private bool $allowUploads = true;

    #[ORM\Column]
    private bool $isActive = true;

    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $activeFrom = null;

    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $activeTo = null;

    #[ORM\Column(length: 32)]
    private string $displayQuality = self::QUALITY_HIGH;

    /**
     * @var Collection<int, MediaItem>
     */
    #[ORM\OneToMany(mappedBy: 'event', targetEntity: MediaItem::class, cascade: ['persist', 'remove'], orphanRemoval: true)]
    #[ORM\OrderBy(['createdAt' => 'DESC'])]
    private Collection $mediaItems;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column]
    private \DateTimeImmutable $updatedAt;

    public function __construct(User $owner, string $title, string $slug)
    {
        $this->owner = $owner;
        $this->title = $title;
        $this->slug = $slug;
        $this->mediaItems = new ArrayCollection();
        $this->createdAt = new \DateTimeImmutable();
        $this->updatedAt = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getOwner(): User
    {
        return $this->owner;
    }

    public function setOwner(User $owner): static
    {
        $this->owner = $owner;
        return $this;
    }

    public function getTitle(): string
    {
        return $this->title;
    }

    public function setTitle(string $title): static
    {
        $this->title = trim($title);
        $this->touch();
        return $this;
    }

    public function getDescription(): ?string
    {
        return $this->description;
    }

    public function setDescription(?string $description): static
    {
        $this->description = $description !== null ? trim($description) : null;
        $this->touch();
        return $this;
    }

    public function getSlug(): string
    {
        return $this->slug;
    }

    public function setSlug(string $slug): static
    {
        $this->slug = strtolower(trim($slug));
        $this->touch();
        return $this;
    }

    public function isAllowUploads(): bool
    {
        return $this->allowUploads;
    }

    public function setAllowUploads(bool $allowUploads): static
    {
        $this->allowUploads = $allowUploads;
        $this->touch();
        return $this;
    }

    public function isActive(): bool
    {
        return $this->isActive;
    }

    public function setIsActive(bool $isActive): static
    {
        $this->isActive = $isActive;
        $this->touch();
        return $this;
    }

    public function getActiveFrom(): ?\DateTimeImmutable
    {
        return $this->activeFrom;
    }

    public function setActiveFrom(?\DateTimeImmutable $activeFrom): static
    {
        $this->activeFrom = $activeFrom;
        $this->touch();
        return $this;
    }

    public function getActiveTo(): ?\DateTimeImmutable
    {
        return $this->activeTo;
    }

    public function setActiveTo(?\DateTimeImmutable $activeTo): static
    {
        $this->activeTo = $activeTo;
        $this->touch();
        return $this;
    }

    public function getDisplayQuality(): string
    {
        return $this->displayQuality;
    }

    public function getDisplayQualityLabel(): string
    {
        return self::ALLOWED_QUALITIES[$this->displayQuality] ?? 'Wysoka';
    }

    public function setDisplayQuality(string $displayQuality): static
    {
        if (!array_key_exists($displayQuality, self::ALLOWED_QUALITIES)) {
            throw new \InvalidArgumentException(sprintf('Nieprawidłowa jakość: %s', $displayQuality));
        }
        $this->displayQuality = $displayQuality;
        $this->touch();
        return $this;
    }

    public function isCurrentlyVisible(?\DateTimeImmutable $now = null): bool
    {
        $now ??= new \DateTimeImmutable();

        if (!$this->isActive) {
            return false;
        }

        if ($this->activeFrom !== null && $now < $this->activeFrom) {
            return false;
        }

        if ($this->activeTo !== null && $now > $this->activeTo) {
            return false;
        }

        return true;
    }

    public function getVisibilityStatusReason(?\DateTimeImmutable $now = null): ?string
    {
        $now ??= new \DateTimeImmutable();

        if (!$this->isActive) {
            return 'Strona wydarzenia została wyłączona przez organizatora.';
        }

        if ($this->activeFrom !== null && $now < $this->activeFrom) {
            return sprintf('Strona wydarzenia będzie aktywna od %s.', $this->activeFrom->format('Y-m-d H:i'));
        }

        if ($this->activeTo !== null && $now > $this->activeTo) {
            return sprintf('Okres aktywności strony wydarzenia zakończył się %s.', $this->activeTo->format('Y-m-d H:i'));
        }

        return null;
    }

    /**
     * @return Collection<int, MediaItem>
     */
    public function getMediaItems(): Collection
    {
        return $this->mediaItems;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function getUpdatedAt(): \DateTimeImmutable
    {
        return $this->updatedAt;
    }

    private function touch(): void
    {
        $this->updatedAt = new \DateTimeImmutable();
    }
}
