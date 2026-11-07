<?php

namespace App\Controller;

use App\Entity\EventAlbum;
use App\Entity\User;
use App\Repository\EventAlbumRepository;
use App\Repository\UserRepository;
use App\Service\EventSerializer;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

#[Route('/api')]
class AuthController extends AbstractController
{
    public function __construct(
        private readonly UserRepository $userRepository,
        private readonly EventAlbumRepository $eventRepository,
        private readonly EntityManagerInterface $entityManager,
        private readonly UserPasswordHasherInterface $passwordHasher,
        private readonly EventSerializer $serializer,
    ) {
    }

    #[Route('/auth/register', name: 'api_auth_register', methods: ['POST'])]
    public function register(Request $request): JsonResponse
    {
        $payload = json_decode($request->getContent(), true);
        if (!is_array($payload)) {
            return $this->json(['error' => 'Nieprawidłowy format danych JSON.'], Response::HTTP_BAD_REQUEST);
        }

        $email = strtolower(trim((string) ($payload['email'] ?? '')));
        $password = (string) ($payload['password'] ?? '');
        $eventTitle = trim((string) ($payload['eventTitle'] ?? ''));
        $requestedSlug = trim((string) ($payload['slug'] ?? ''));

        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return $this->json(['error' => 'Podaj prawidłowy adres e-mail.'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        if (strlen($password) < 6) {
            return $this->json(['error' => 'Hasło musi mieć co najmniej 6 znaków.'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        if ($this->userRepository->findOneByEmail($email) !== null) {
            return $this->json(['error' => 'Konto z tym adresem e-mail już istnieje.'], Response::HTTP_CONFLICT);
        }

        if ($eventTitle === '') {
            $emailPrefix = explode('@', $email)[0] ?: 'impreza';
            $eventTitle = 'Album Wydarzenia - ' . ucfirst($emailPrefix);
        }

        $baseSlug = EventSerializer::slugify($requestedSlug !== '' ? $requestedSlug : $eventTitle);
        $slug = $baseSlug;

        if ($requestedSlug !== '' && !$this->eventRepository->isSlugAvailable($slug)) {
            return $this->json(['error' => 'Wybrany identyfikator (slug) jest już zajęty.'], Response::HTTP_CONFLICT);
        }

        $counter = 1;
        while (!$this->eventRepository->isSlugAvailable($slug)) {
            $slug = sprintf('%s-%d', $baseSlug, ++$counter);
        }

        $user = new User($email);
        $user->setPassword($this->passwordHasher->hashPassword($user, $password));
        $token = $user->generateApiToken();

        $event = new EventAlbum($user, $eventTitle, $slug);
        $event->setDescription('Podziel się swoimi zdjęciami i filmami z naszej uroczystości!');
        $user->setEvent($event);

        $this->entityManager->persist($user);
        $this->entityManager->persist($event);
        $this->entityManager->flush();

        return $this->json([
            'token' => $token,
            'user' => [
                'id' => $user->getId(),
                'email' => $user->getEmail(),
            ],
            'event' => $this->serializer->serializeEventForAdmin($event),
        ], Response::HTTP_CREATED);
    }

    #[Route('/auth/login', name: 'api_auth_login', methods: ['POST'])]
    public function login(Request $request): JsonResponse
    {
        $payload = json_decode($request->getContent(), true);
        if (!is_array($payload)) {
            return $this->json(['error' => 'Nieprawidłowy format danych JSON.'], Response::HTTP_BAD_REQUEST);
        }

        $email = strtolower(trim((string) ($payload['email'] ?? '')));
        $password = (string) ($payload['password'] ?? '');

        if ($email === '' || $password === '') {
            return $this->json(['error' => 'Podaj adres e-mail oraz hasło.'], Response::HTTP_BAD_REQUEST);
        }

        $user = $this->userRepository->findOneByEmail($email);
        if (null === $user || !$this->passwordHasher->isPasswordValid($user, $password)) {
            return $this->json(['error' => 'Nieprawidłowy adres e-mail lub hasło.'], Response::HTTP_UNAUTHORIZED);
        }

        $token = $user->getApiToken() ?? $user->generateApiToken();
        $event = $user->getEvent();
        if (null === $event) {
            $slug = EventSerializer::slugify(explode('@', $user->getEmail())[0] . '-' . random_int(100, 999));
            $event = new EventAlbum($user, 'Moje Wydarzenie', $slug);
            $user->setEvent($event);
            $this->entityManager->persist($event);
        }

        $this->entityManager->flush();

        return $this->json([
            'token' => $token,
            'user' => [
                'id' => $user->getId(),
                'email' => $user->getEmail(),
            ],
            'event' => $this->serializer->serializeEventForAdmin($event),
        ]);
    }

    #[Route('/admin/me', name: 'api_admin_me', methods: ['GET'])]
    public function me(#[CurrentUser] ?User $user): JsonResponse
    {
        if (null === $user) {
            return $this->json(['error' => 'Brak autoryzacji.'], Response::HTTP_UNAUTHORIZED);
        }

        $event = $user->getEvent();

        return $this->json([
            'user' => [
                'id' => $user->getId(),
                'email' => $user->getEmail(),
            ],
            'event' => $event ? $this->serializer->serializeEventForAdmin($event) : null,
        ]);
    }
}
