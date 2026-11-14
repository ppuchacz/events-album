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

- [Makefile](file:///home/ppuchacz/projects/events-album/Makefile) – główny plik `Makefile` do zarządzania środowiskiem Docker Compose (`dev` oraz `prod`) i Kubernetes (`k8s/`).
- [backend/Makefile](file:///home/ppuchacz/projects/events-album/backend/Makefile) – plik `Makefile` dla aplikacji Symfony API oraz Workera (`make install`, `make start`, `make worker`, `make migrate`, `make lint`).
- [frontend/Makefile](file:///home/ppuchacz/projects/events-album/frontend/Makefile) – plik `Makefile` dla aplikacji React (`make install`, `make dev`, `make build`, `make lint`).
- [docker-compose.dev.yml](file:///home/ppuchacz/projects/events-album/docker-compose.dev.yml) – konfiguracja Docker Compose dla środowiska deweloperskiego.
- [docker-compose.prod.yml](file:///home/ppuchacz/projects/events-album/docker-compose.prod.yml) – konfiguracja Docker Compose dla środowiska produkcyjnego (z serwerem Nginx dla zbudowanego frontendu React).
- [k8s/](file:///home/ppuchacz/projects/events-album/k8s) – kompletne manifesty Kubernetes zarządzane przez Kustomize.

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

### Środowisko produkcyjne (PROD) – Docker Compose
```bash
make prod-up
# lub bezpośrednio:
docker compose -f docker-compose.prod.yml up -d --build
```
Po uruchomieniu w trybie produkcyjnym aplikacja jest dostępna pod adresem `http://localhost:8080`.

---

## Wdrożenie w środowisku Kubernetes (k8s)

Manifesty znajdują się w katalogu [k8s/](file:///home/ppuchacz/projects/events-album/k8s) i są zarządzane deklaratywnie za pomocą Kustomize:

### Architektura wdrożenia w Kubernetes:
1. **Przestrzeń nazw ([k8s/namespace.yaml](file:///home/ppuchacz/projects/events-album/k8s/namespace.yaml))**:
   - `events-album` izoluje wszystkie komponenty aplikacji.
2. **Konfiguracja i sekrety**:
   - [k8s/configmap.yaml](file:///home/ppuchacz/projects/events-album/k8s/configmap.yaml) – zmienne środowiskowe aplikacji (`APP_ENV=prod`, nazwy hostów, porty).
   - [k8s/secret.yaml](file:///home/ppuchacz/projects/events-album/k8s/secret.yaml) – hasła bazy danych, kolejki RabbitMQ oraz `APP_SECRET` i DSN.
3. **Wolumeny trwałe (Persistent Volumes)**:
   - [k8s/database-pvc.yaml](file:///home/ppuchacz/projects/events-album/k8s/database-pvc.yaml) (`2Gi`, ReadWriteOnce) – dane PostgreSQL (`/var/lib/postgresql/data`).
   - [k8s/rabbitmq-pvc.yaml](file:///home/ppuchacz/projects/events-album/k8s/rabbitmq-pvc.yaml) (`1Gi`, ReadWriteOnce) – stan i kolejki RabbitMQ (`/var/lib/rabbitmq`).
   - [k8s/uploads-pvc.yaml](file:///home/ppuchacz/projects/events-album/k8s/uploads-pvc.yaml) (`5Gi`, ReadWriteMany) – współdzielony wolumen zdjęć i filmów (`/app/public/uploads`), montowany wspólnie przez `backend` i `worker`.
4. **Baza danych ([k8s/database.yaml](file:///home/ppuchacz/projects/events-album/k8s/database.yaml))**:
   - PostgreSQL 16 Alpine, serwis `database:5432`, z sondami liveness i readiness opartymi o `pg_isready`.
5. **Kolejka komunikatów ([k8s/rabbitmq.yaml](file:///home/ppuchacz/projects/events-album/k8s/rabbitmq.yaml))**:
   - RabbitMQ 3 Management Alpine, serwis `rabbitmq` (`5672` AMQP, `15672` Management UI), z sondami `rabbitmq-diagnostics ping`.
6. **Backend API ([k8s/backend.yaml](file:///home/ppuchacz/projects/events-album/k8s/backend.yaml))**:
   - Kontener PHP 8.3 z automatyczną migracją bazy danych Doctrine przy starcie.
   - InitContainer oczekujący na gotowość bazy PostgreSQL i RabbitMQ przed uruchomieniem aplikacji.
   - Serwis `backend:8000`.
   - StartupProbe, LivenessProbe i ReadinessProbe monitorujące stan portu 8000.
7. **Worker FFmpeg ([k8s/worker.yaml](file:///home/ppuchacz/projects/events-album/k8s/worker.yaml))**:
   - Asynchroniczny konsument kolejki `messenger:consume async` z automatyczną pętlą restartującą cykl konsumpcji po limitach czasu/pamięci.
   - InitContainer oczekujący na gotowość bazy danych, RabbitMQ oraz backendu (migracji).
   - Współdzieli wolumen `uploads-pvc` z backendem do odczytu i zapisu skonwertowanych materiałów multimedialnych.
8. **Frontend ([k8s/frontend.yaml](file:///home/ppuchacz/projects/events-album/k8s/frontend.yaml))**:
   - Nginx serwujący skompilowaną aplikację React SPA oraz rewerse proxy dla `/api/` i `/uploads/` do serwisu `backend:8000`.
   - Serwis `frontend:80`.
9. **Ingress ([k8s/ingress.yaml](file:///home/ppuchacz/projects/events-album/k8s/ingress.yaml))**:
   - Reguła ingressu kierująca ruch na serwis `frontend:80`.
   - Adnotacje Nginx Ingress: `proxy-body-size: 256m` (obsługa przesyłania dużych plików wideo i zdjęć) oraz `proxy-read-timeout: 300s`.
10. **Autoskalowanie HPA ([k8s/backend-hpa.yaml](file:///home/ppuchacz/projects/events-album/k8s/backend-hpa.yaml))**:
    - HorizontalPodAutoscaler skalujący pody backendu w zakresie od 2 do 10 replik na podstawie utylizacji CPU (próg 60%) oraz pamięci (próg 75%).
11. **Kustomizacja ([k8s/kustomization.yaml](file:///home/ppuchacz/projects/events-album/k8s/kustomization.yaml))**:
    - Agregacja wszystkich manifestów i automatyczne przypisanie do przestrzeni nazw `events-album`.

### Instrukcja wdrożenia na klastrze Kubernetes / Minikube:

```bash
# 1. Zbudowanie produkcyjnych obrazów Docker
make k8s-build

# 2. Załadowanie obrazów do klastra Minikube (jeśli używasz minikube z docker runtime)
make k8s-load

# 3. Wdrożenie wszystkich manifestów (Kustomize)
make k8s-apply

# 4. Sprawdzenie statusu podów, serwisów, ingressu, wolumenów i HPA
make k8s-status

# 5. Usunięcie wdrożonych zasobów z klastra
make k8s-delete
```

---

## 🧪 Testy Obciążeniowe i Wydajnościowe (k6)

W katalogu [k6/](file:///home/ppuchacz/projects/events-album/k6) znajdują się scenariusze testowe w [k6](https://k6.io) symulujące zachowanie użytkowników w realistycznym natężeniu ruchu oraz weryfikujące skalowanie backendu HPA.

- [k6/smoke_test.js](file:///home/ppuchacz/projects/events-album/k6/smoke_test.js) – szybka weryfikacja wszystkich ścieżek użytkownika (1 VU).
- [k6/scenarios/realistic_event_load.js](file:///home/ppuchacz/projects/events-album/k6/scenarios/realistic_event_load.js) – symulacja imprezy z podziałem na 3 persony:
  - **Organizatorzy (~5%)**: rejestracja, logowanie, konfiguracja parametrów albumu i jakości,
  - **Goście przeglądający (~70%)**: skanowanie QR, wejście na stronę SPA, przeglądanie galerii, pobieranie miniatur i podgląd pełnoekranowy zdjęć,
  - **Goście dodający multimedia (~25%)**: wpisanie życzeń/podpisu, wysyłanie zdjęć (multipart/form-data) i natychmiastowy odbiór miniatury.
- [k6/scenarios/hpa_scaling_test.js](file:///home/ppuchacz/projects/events-album/k6/scenarios/hpa_scaling_test.js) – test generujący skokowe obciążenie CPU w celu wywołania skalowania HPA z 2 do 10 replik.

### Polecenia do uruchomienia testów:

```bash
# Szybki test dymny
make k6-smoke

# Pełny test realistycznego obciążenia imprezy
make k6-event

# Test sprawdzający autoskalowanie HPA
make k6-hpa

# Obserwacja na żywo zachowania autoskalera HPA w osobnym oknie
make k8s-hpa-watch
```
Szczegółowy opis konfiguracji i metryk znajduje się w [k6/README.md](file:///home/ppuchacz/projects/events-album/k6/README.md).