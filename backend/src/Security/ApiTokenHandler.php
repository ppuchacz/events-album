<?php

namespace App\Security;

use App\Repository\UserRepository;
use Symfony\Component\Security\Core\Exception\BadCredentialsException;
use Symfony\Component\Security\Http\AccessToken\AccessTokenHandlerInterface;
use Symfony\Component\Security\Http\Authenticator\Passport\Badge\UserBadge;

class ApiTokenHandler implements AccessTokenHandlerInterface
{
    public function __construct(
        private readonly UserRepository $userRepository,
    ) {
    }

    public function getUserBadgeFrom(string $accessToken): UserBadge
    {
        $accessToken = trim($accessToken);
        if ($accessToken === '') {
            throw new BadCredentialsException('Brak tokenu autoryzacyjnego.');
        }

        $user = $this->userRepository->findOneByApiToken($accessToken);
        if (null === $user) {
            throw new BadCredentialsException('Nieprawidłowy lub wygasły token autoryzacyjny.');
        }

        return new UserBadge($user->getUserIdentifier(), fn () => $user);
    }
}
