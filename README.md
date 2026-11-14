# EventAlbum – Aplikacja do współdzielenia zdjęć i filmów na imprezach okolicznościowych

Kompleksowa aplikacja webowa (album online) umożliwiająca gościom weselnym i uczestnikom imprez okolicznościowych przeglądanie oraz dodawanie zdjęć i filmów, a organizatorom pełne zarządzanie widocznością, moderacją, kodem QR oraz jakością przesyłanych multimediów.

## Architektura systemu

- **Frontend (`frontend/`)** – Aplikacja SPA w **React 18 + TypeScript + Vite + TailwindCSS**:
  - **Strona dla gości (`/e/:slug` lub `/:slug`)**:
    - Podgląd zdjęć i filmów wrzuconych przez uczestników (z uwzględnieniem wybranej przez organizatora jakości wyświetlania),
    - Wrzucanie zdjęć i filmów z podpisem autora i życzeniami/komentarzem,
    - Powiększenie zdjęcia lub odtworzenie filmu w pełnoekranowym oknie Lightbox po kliknięciu w miniaturkę,
    - Automatyczna aktualizacja statusu filmów przetwarzanych w tle.
  - **Panel administracyjny (`/login`, `/register`, `/admin`)**:
    - Rejestracja i logowanie organizatora (1 konto = 1 wydarzenie/album),
    - Ustawienie identyfikatora (`slug`), pod którym dostępna jest strona dla gości,
    - Ukrywanie i odkrywanie pojedynczych materiałów przesłanych przez gości oraz ich usuwanie,
    - Włączanie i wyłączanie możliwości wysyłania materiałów przez gości (`allowUploads`),
    - Sterowanie widocznością strony dla gości – główny przełącznik aktywności (`isActive`) oraz opcjonalny przedział dat aktywności (`activeFrom` – `activeTo`),
    - Generowanie kodu QR z bezpośrednim linkiem do strony dla gości oraz możliwość pobrania go jako plik PNG do druku,
    - Wybór jakości wyświetlanych zdjęć i filmów na stronie gości (**Wysoka**, **Średnia**, **Niska**, **Bardzo oszczędna**) w celu dopasowania transferu do jakości łącza internetowego w miejscu uroczystości.
- **Backend API (`backend/`)** – Aplikacja **PHP 8.3 + Symfony 7.1 + Doctrine ORM + PostgreSQL**:
  - REST API obsługujące autoryzację (Bearer Token), konfigurację albumu i obsługę plików multimedialnych,
  - Generowanie miniaturek oraz 4 wariantów jakościowych dla zdjęć (`high`, `medium`, `low`, `very_low`),
  - Zlecanie asynchronicznej konwersji wideo do kolejki **RabbitMQ** poprzez **Symfony Messenger** (`App\Message\ConvertVideoMessage`).
- **Worker (`worker` w oparciu o `backend/`)** – Konsument kolejki **RabbitMQ** (`php bin/console messenger:consume async`):
  - Wykorzystuje **FFmpeg** oraz **FFprobe** do wygenerowania miniaturki klatki filmu oraz przekonwertowania wideo do formatu MP4 (H.264 / AAC) w 4 przedziałach jakości (`high` 1080p, `medium` 720p, `low` 480p, `very_low` 360p).
- **Kolejka komunikatów** – **RabbitMQ 3** (wraz z panelem Management UI).
- **Baza danych** – **PostgreSQL 16**.

## Struktura projektu i pliki Makefile

- [Makefile](file:///c:/Users/User/Desktop/projects/events-album/Makefile) – główny plik `Makefile` do zarządzania środowiskiem Docker Compose (`dev` oraz `prod`).
- [backend/Makefile](file:///c:/Users/User/Desktop/projects/events-album/backend/Makefile) – plik `Makefile` dla aplikacji Symfony API oraz Workera (`make install`, `make start`, `make worker`, `make migrate`, `make lint`).
- [frontend/Makefile](file:///c:/Users/User/Desktop/projects/events-album/frontend/Makefile) – plik `Makefile` dla aplikacji React (`make install`, `make dev`, `make build`, `make lint`).
- [docker-compose.dev.yml](file:///c:/Users/User/Desktop/projects/events-album/docker-compose.dev.yml) – konfiguracja Docker Compose dla środowiska deweloperskiego.
- [docker-compose.prod.yml](file:///c:/Users/User/Desktop/projects/events-album/docker-compose.prod.yml) – konfiguracja Docker Compose dla środowiska produkcyjnego (z serwerem Nginx dla zbudowanego frontendu React).

## Uruchomienie projektu

### Środowisko deweloperskie (DEV)
```bash
make dev-up
# lub bezpośrednio:
docker compose -f docker-compose.dev.yml up -d --build
```
Po uruchomieniu:
- **Aplikacja Frontend (React – Panel Admina i Strona Gości)**: http://localhost:5173
- **Backend API (Symfony)**: http://localhost:8000
- **RabbitMQ Management UI**: http://localhost:15672 (`guest` / `guest`)

### Środowisko produkcyjne (PROD)
```bash
make prod-up
# lub bezpośrednio:
docker compose -f docker-compose.prod.yml up -d --build
```
Po uruchomieniu w trybie produkcyjnym aplikacja jest dostępna pod adresem `http://localhost:8080`.