<?php

namespace App\Message;

class ConvertVideoMessage
{
    public function __construct(
        private readonly int $mediaItemId,
    ) {
    }

    public function getMediaItemId(): int
    {
        return $this->mediaItemId;
    }
}
