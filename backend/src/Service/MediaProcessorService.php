<?php

namespace App\Service;

use App\Entity\EventAlbum;
use App\Entity\MediaItem;
use Psr\Log\LoggerInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

class MediaProcessorService
{
    /**
     * Video conversion profiles matching EventAlbum quality tiers.
     *
     * @var array<string, array{maxWidth: int, crf: int, maxrate: string, bufsize: string, audioBitrate: string}>
     */
    public const VIDEO_PROFILES = [
        EventAlbum::QUALITY_HIGH => [
            'maxWidth' => 1920,
            'crf' => 21,
            'maxrate' => '4000k',
            'bufsize' => '8000k',
            'audioBitrate' => '128k',
        ],
        EventAlbum::QUALITY_MEDIUM => [
            'maxWidth' => 1280,
            'crf' => 25,
            'maxrate' => '1800k',
            'bufsize' => '3600k',
            'audioBitrate' => '128k',
        ],
        EventAlbum::QUALITY_LOW => [
            'maxWidth' => 854,
            'crf' => 28,
            'maxrate' => '800k',
            'bufsize' => '1600k',
            'audioBitrate' => '96k',
        ],
        EventAlbum::QUALITY_VERY_LOW => [
            'maxWidth' => 480,
            'crf' => 32,
            'maxrate' => '350k',
            'bufsize' => '700k',
            'audioBitrate' => '64k',
        ],
    ];

    /**
     * Image scaling/compression profiles matching EventAlbum quality tiers.
     *
     * @var array<string, array{maxDim: int, jpegQuality: int}>
     */
    public const IMAGE_PROFILES = [
        EventAlbum::QUALITY_HIGH => ['maxDim' => 2048, 'jpegQuality' => 90],
        EventAlbum::QUALITY_MEDIUM => ['maxDim' => 1280, 'jpegQuality' => 80],
        EventAlbum::QUALITY_LOW => ['maxDim' => 854, 'jpegQuality' => 68],
        EventAlbum::QUALITY_VERY_LOW => ['maxDim' => 540, 'jpegQuality' => 50],
    ];

    private string $publicDir;

    public function __construct(
        #[Autowire('%kernel.project_dir%')]
        string $projectDir,
        private readonly LoggerInterface $logger,
    ) {
        $this->publicDir = rtrim($projectDir, '/\\') . '/public';
    }

    public function getPublicDir(): string
    {
        return $this->publicDir;
    }

    /**
     * Generates a thumbnail and 4 quality variants for an uploaded image.
     */
    public function processImage(MediaItem $item): void
    {
        $sourceAbs = $this->publicDir . '/' . ltrim($item->getOriginalPath(), '/');
        if (!is_file($sourceAbs)) {
            throw new \RuntimeException(sprintf('Plik źródłowy zdjęcia nie istnieje: %s', $sourceAbs));
        }

        $eventId = $item->getEvent()->getId() ?? 'default';
        $baseName = pathinfo($sourceAbs, PATHINFO_FILENAME);

        $thumbsRelDir = sprintf('uploads/%s/thumbs', $eventId);
        $variantsRelDir = sprintf('uploads/%s/variants', $eventId);

        $this->ensureDirectory($this->publicDir . '/' . $thumbsRelDir);
        $this->ensureDirectory($this->publicDir . '/' . $variantsRelDir);

        $imageInfo = @getimagesize($sourceAbs);
        if ($imageInfo !== false) {
            $item->setWidth((int) $imageInfo[0]);
            $item->setHeight((int) $imageInfo[1]);
        }

        if (extension_loaded('gd') && $imageInfo !== false) {
            $srcImg = $this->loadGdImage($sourceAbs, (int) $imageInfo[2]);
            if ($srcImg !== null) {
                $srcImg = $this->fixExifOrientation($srcImg, $sourceAbs);
                $origW = imagesx($srcImg);
                $origH = imagesy($srcImg);
                $item->setWidth($origW);
                $item->setHeight($origH);

                // 1. Generate thumbnail (max 480px)
                $thumbRelPath = sprintf('/%s/%s_thumb.jpg', $thumbsRelDir, $baseName);
                $this->saveResizedGd($srcImg, $origW, $origH, 480, 78, $this->publicDir . $thumbRelPath);
                $item->setThumbnailPath($thumbRelPath);

                // 2. Generate 4 quality variants
                $variants = [];
                foreach (self::IMAGE_PROFILES as $qualityKey => $profile) {
                    $variantRelPath = sprintf('/%s/%s_%s.jpg', $variantsRelDir, $baseName, $qualityKey);
                    $this->saveResizedGd(
                        $srcImg,
                        $origW,
                        $origH,
                        $profile['maxDim'],
                        $profile['jpegQuality'],
                        $this->publicDir . $variantRelPath
                    );
                    $variants[$qualityKey] = $variantRelPath;
                }
                imagedestroy($srcImg);

                $item->setVariants($variants);
                $item->setStatus(MediaItem::STATUS_READY);
                return;
            }
        }

        // Fallback if GD is unavailable or format not supported by GD: try ffmpeg or direct reference
        $thumbRelPath = sprintf('/%s/%s_thumb.jpg', $thumbsRelDir, $baseName);
        if ($this->runFfmpegResizeImage($sourceAbs, $this->publicDir . $thumbRelPath, 480, 5)) {
            $item->setThumbnailPath($thumbRelPath);
            $variants = [];
            foreach ([
                EventAlbum::QUALITY_HIGH => [2048, 2],
                EventAlbum::QUALITY_MEDIUM => [1280, 5],
                EventAlbum::QUALITY_LOW => [854, 10],
                EventAlbum::QUALITY_VERY_LOW => [540, 16],
            ] as $qualityKey => [$maxDim, $qscale]) {
                $variantRelPath = sprintf('/%s/%s_%s.jpg', $variantsRelDir, $baseName, $qualityKey);
                if ($this->runFfmpegResizeImage($sourceAbs, $this->publicDir . $variantRelPath, $maxDim, $qscale)) {
                    $variants[$qualityKey] = $variantRelPath;
                } else {
                    $variants[$qualityKey] = $item->getOriginalPath();
                }
            }
            $item->setVariants($variants);
        } else {
            $item->setThumbnailPath($item->getOriginalPath());
            $item->setVariants([
                EventAlbum::QUALITY_HIGH => $item->getOriginalPath(),
                EventAlbum::QUALITY_MEDIUM => $item->getOriginalPath(),
                EventAlbum::QUALITY_LOW => $item->getOriginalPath(),
                EventAlbum::QUALITY_VERY_LOW => $item->getOriginalPath(),
            ]);
        }

        $item->setStatus(MediaItem::STATUS_READY);
    }

    /**
     * Generates a video thumbnail and converts the video to 4 quality tiers using ffmpeg.
     * Invoked asynchronously by the RabbitMQ worker.
     */
    public function convertVideoAndGenerateThumbnail(MediaItem $item): void
    {
        $sourceAbs = $this->publicDir . '/' . ltrim($item->getOriginalPath(), '/');
        if (!is_file($sourceAbs)) {
            throw new \RuntimeException(sprintf('Plik źródłowy wideo nie istnieje: %s', $sourceAbs));
        }

        $eventId = $item->getEvent()->getId() ?? 'default';
        $baseName = pathinfo($sourceAbs, PATHINFO_FILENAME);

        $thumbsRelDir = sprintf('uploads/%s/thumbs', $eventId);
        $variantsRelDir = sprintf('uploads/%s/variants', $eventId);

        $this->ensureDirectory($this->publicDir . '/' . $thumbsRelDir);
        $this->ensureDirectory($this->publicDir . '/' . $variantsRelDir);

        // 1. Probe metadata with ffprobe
        $this->probeVideoMetadata($sourceAbs, $item);

        // 2. Generate video thumbnail JPEG
        $thumbRelPath = sprintf('/%s/%s_thumb.jpg', $thumbsRelDir, $baseName);
        $thumbAbsPath = $this->publicDir . $thumbRelPath;
        $this->generateVideoThumbnail($sourceAbs, $thumbAbsPath);
        if (is_file($thumbAbsPath)) {
            $item->setThumbnailPath($thumbRelPath);
        }

        // 3. Convert video to each quality tier (High, Medium, Low, Very Low)
        $variants = [];
        foreach (self::VIDEO_PROFILES as $qualityKey => $profile) {
            $variantRelPath = sprintf('/%s/%s_%s.mp4', $variantsRelDir, $baseName, $qualityKey);
            $variantAbsPath = $this->publicDir . $variantRelPath;

            $scaleFilter = sprintf("scale='min(%d,iw)':-2", $profile['maxWidth']);
            $cmd = sprintf(
                'ffmpeg -y -i %s -vf %s -c:v libx264 -preset veryfast -crf %d -maxrate %s -bufsize %s -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a %s %s 2>&1',
                escapeshellarg($sourceAbs),
                escapeshellarg($scaleFilter),
                $profile['crf'],
                escapeshellarg($profile['maxrate']),
                escapeshellarg($profile['bufsize']),
                escapeshellarg($profile['audioBitrate']),
                escapeshellarg($variantAbsPath)
            );

            $output = [];
            $exitCode = 0;
            exec($cmd, $output, $exitCode);

            if ($exitCode !== 0 || !is_file($variantAbsPath)) {
                $this->logger->error('Błąd konwersji ffmpeg dla jakości ' . $qualityKey, [
                    'exitCode' => $exitCode,
                    'output' => implode("\n", array_slice($output, -15)),
                ]);
                throw new \RuntimeException(sprintf(
                    'Konwersja ffmpeg dla jakości "%s" nie powiodła się (kod %d).',
                    $qualityKey,
                    $exitCode
                ));
            }

            $variants[$qualityKey] = $variantRelPath;
        }

        $item->setVariants($variants);
        $item->setStatus(MediaItem::STATUS_READY);
        $item->setErrorMessage(null);
    }

    public function generateVideoThumbnail(string $sourceAbs, string $targetAbs): bool
    {
        $this->ensureDirectory(dirname($targetAbs));

        // Try taking frame at 0.5s first, fallback to 0.0s for very short videos
        foreach (['00:00:00.500', '00:00:00.000'] as $timestamp) {
            $cmd = sprintf(
                'ffmpeg -y -ss %s -i %s -vframes 1 -vf %s -q:v 4 %s 2>&1',
                escapeshellarg($timestamp),
                escapeshellarg($sourceAbs),
                escapeshellarg("scale='min(480,iw)':-2"),
                escapeshellarg($targetAbs)
            );
            $output = [];
            $exitCode = 0;
            exec($cmd, $output, $exitCode);
            if ($exitCode === 0 && is_file($targetAbs) && filesize($targetAbs) > 0) {
                return true;
            }
        }

        return false;
    }

    public function deleteMediaFiles(MediaItem $item): void
    {
        $paths = array_filter(array_merge(
            [$item->getOriginalPath(), $item->getThumbnailPath()],
            array_values($item->getVariants())
        ));

        foreach (array_unique($paths) as $relPath) {
            $abs = $this->publicDir . '/' . ltrim($relPath, '/');
            if (is_file($abs)) {
                @unlink($abs);
            }
        }
    }

    private function probeVideoMetadata(string $sourceAbs, MediaItem $item): void
    {
        $cmd = sprintf(
            'ffprobe -v quiet -print_format json -show_format -show_streams %s 2>&1',
            escapeshellarg($sourceAbs)
        );
        $output = [];
        $exitCode = 0;
        exec($cmd, $output, $exitCode);
        if ($exitCode !== 0) {
            return;
        }

        $data = json_decode(implode("\n", $output), true);
        if (!is_array($data)) {
            return;
        }

        if (isset($data['format']['duration'])) {
            $item->setDuration((float) $data['format']['duration']);
        }

        foreach ($data['streams'] ?? [] as $stream) {
            if (($stream['codec_type'] ?? '') === 'video') {
                if (isset($stream['width'])) {
                    $item->setWidth((int) $stream['width']);
                }
                if (isset($stream['height'])) {
                    $item->setHeight((int) $stream['height']);
                }
                break;
            }
        }
    }

    private function loadGdImage(string $path, int $imageType): ?\GdImage
    {
        $img = match ($imageType) {
            IMAGETYPE_JPEG => @imagecreatefromjpeg($path),
            IMAGETYPE_PNG => @imagecreatefrompng($path),
            IMAGETYPE_WEBP => function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($path) : false,
            IMAGETYPE_GIF => @imagecreatefromgif($path),
            default => false,
        };

        return $img instanceof \GdImage ? $img : null;
    }

    private function fixExifOrientation(\GdImage $img, string $path): \GdImage
    {
        if (!function_exists('exif_read_data')) {
            return $img;
        }
        $exif = @exif_read_data($path);
        if (!is_array($exif) || empty($exif['Orientation'])) {
            return $img;
        }

        $rotated = match ((int) $exif['Orientation']) {
            3 => @imagerotate($img, 180, 0),
            6 => @imagerotate($img, -90, 0),
            8 => @imagerotate($img, 90, 0),
            default => false,
        };

        if ($rotated instanceof \GdImage) {
            imagedestroy($img);
            return $rotated;
        }

        return $img;
    }

    private function saveResizedGd(
        \GdImage $src,
        int $origW,
        int $origH,
        int $maxDim,
        int $jpegQuality,
        string $targetAbs
    ): void {
        $scale = min(1.0, $maxDim / max($origW, $origH, 1));
        $newW = max(1, (int) round($origW * $scale));
        $newH = max(1, (int) round($origH * $scale));

        $dst = imagecreatetruecolor($newW, $newH);
        // Fill white background in case source PNG/WebP has transparency
        $white = imagecolorallocate($dst, 255, 255, 255);
        imagefilledrectangle($dst, 0, 0, $newW, $newH, $white);

        imagecopyresampled($dst, $src, 0, 0, 0, 0, $newW, $newH, $origW, $origH);
        imagejpeg($dst, $targetAbs, $jpegQuality);
        imagedestroy($dst);
    }

    private function runFfmpegResizeImage(string $sourceAbs, string $targetAbs, int $maxDim, int $qscale): bool
    {
        $scaleFilter = sprintf("scale='min(%d,iw)':-2", $maxDim);
        $cmd = sprintf(
            'ffmpeg -y -i %s -frames:v 1 -vf %s -q:v %d %s 2>&1',
            escapeshellarg($sourceAbs),
            escapeshellarg($scaleFilter),
            $qscale,
            escapeshellarg($targetAbs)
        );
        $output = [];
        $exitCode = 0;
        exec($cmd, $output, $exitCode);

        return $exitCode === 0 && is_file($targetAbs);
    }

    private function ensureDirectory(string $dir): void
    {
        if (!is_dir($dir)) {
            mkdir($dir, 0775, true);
        }
    }
}
