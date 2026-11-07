<?php

namespace App\Entity;

use App\Repository\MediaItemRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: MediaItemRepository::class)]
#[ORM\Table(name: 'media_items')]
class MediaItem
{
    public const TYPE_IMAGE = 'image';
    public const TYPE_VIDEO = 'video';

    public const STATUS_PENDING = 'pending';
    public const STATUS_PROCESSING = 'processing';
    public const STATUS_READY = 'ready';
    public const STATUS_FAILED = 'failed';

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(inversedBy: 'mediaItems', targetEntity: EventAlbum::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private EventAlbum $event;

    #[ORM\Column(length: 16)]
    private string $type;

    #[ORM\Column(length: 255)]
    private string $originalFilename;

    #[ORM\Column(length: 120, nullable: true)]
    private ?string $authorName = null;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $caption = null;

    #[ORM\Column]
    private bool $isHidden = false;

    #[ORM\Column(length: 24)]
    private string $status = self::STATUS_PENDING;

    #[ORM\Column(length: 512)]
    private string $originalPath;

    #[ORM\Column(length: 512, nullable: true)]
    private ?string $thumbnailPath = null;

    /**
     * @var array<string, string> Quality key ('high', 'medium', 'low', 'very_low') => relative file path
     */
    #[ORM\Column(type: 'json')]
    private array $variants = [];

    #[ORM\Column]
    private int $fileSize = 0;

    #[ORM\Column(length: 120)]
    private string $mimeType;

    #[ORM\Column(nullable: true)]
    private ?int $width = null;

    #[ORM\Column(nullable: true)]
    private ?int $height = null;

    #[ORM\Column(nullable: true)]
    private ?float $duration = null;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $errorMessage = null;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    public function __construct(
        EventAlbum $event,
        string $type,
        string $originalFilename,
        string $originalPath,
        string $mimeType,
        int $fileSize
    ) {
        $this->event = $event;
        $this->type = $type;
        $this->originalFilename = $originalFilename;
        $this->originalPath = $originalPath;
        $this->mimeType = $mimeType;
        $this->fileSize = $fileSize;
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getEvent(): EventAlbum
    {
        return $this->event;
    }

    public function getType(): string
    {
        return $this->type;
    }

    public function getOriginalFilename(): string
    {
        return $this->originalFilename;
    }

    public function getAuthorName(): ?string
    {
        return $this->authorName;
    }

    public function setAuthorName(?string $authorName): static
    {
        $this->authorName = $authorName !== null && trim($authorName) !== '' ? trim($authorName) : null;
        return $this;
    }

    public function getCaption(): ?string
    {
        return $this->caption;
    }

    public function setCaption(?string $caption): static
    {
        $this->caption = $caption !== null && trim($caption) !== '' ? trim($caption) : null;
        return $this;
    }

    public function isHidden(): bool
    {
        return $this->isHidden;
    }

    public function setIsHidden(bool $isHidden): static
    {
        $this->isHidden = $isHidden;
        return $this;
    }

    public function getStatus(): string
    {
        return $this->status;
    }

    public function setStatus(string $status): static
    {
        $this->status = $status;
        return $this;
    }

    public function getOriginalPath(): string
    {
        return $this->originalPath;
    }

    public function getThumbnailPath(): ?string
    {
        return $this->thumbnailPath;
    }

    public function setThumbnailPath(?string $thumbnailPath): static
    {
        $this->thumbnailPath = $thumbnailPath;
        return $this;
    }

    /**
     * @return array<string, string>
     */
    public function getVariants(): array
    {
        return $this->variants;
    }

    /**
     * @param array<string, string> $variants
     */
    public function setVariants(array $variants): static
    {
        $this->variants = $variants;
        return $this;
    }

    public function setVariant(string $quality, string $path): static
    {
        $this->variants[$quality] = $path;
        return $this;
    }

    public function getPathForQuality(string $quality): string
    {
        if (isset($this->variants[$quality]) && $this->variants[$quality] !== '') {
            return $this->variants[$quality];
        }
        // Fallback to any available variant or originalPath
        foreach ([EventAlbum::QUALITY_HIGH, EventAlbum::QUALITY_MEDIUM, EventAlbum::QUALITY_LOW, EventAlbum::QUALITY_VERY_LOW] as $fallback) {
            if (isset($this->variants[$fallback]) && $this->variants[$fallback] !== '') {
                return $this->variants[$fallback];
            }
        }
        return $this->originalPath;
    }

    public function getFileSize(): int
    {
        return $this->fileSize;
    }

    public function getMimeType(): string
    {
        return $this->mimeType;
    }

    public function getWidth(): ?int
    {
        return $this->width;
    }

    public function setWidth(?int $width): static
    {
        $this->width = $width;
        return $this;
    }

    public function getHeight(): ?int
    {
        return $this->height;
    }

    public function setHeight(?int $height): static
    {
        $this->height = $height;
        return $this;
    }

    public function getDuration(): ?float
    {
        return $this->duration;
    }

    public function setDuration(?float $duration): static
    {
        $this->duration = $duration;
        return $this;
    }

    public function getErrorMessage(): ?string
    {
        return $this->errorMessage;
    }

    public function setErrorMessage(?string $errorMessage): static
    {
        $this->errorMessage = $errorMessage;
        return $this;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }
}
