.PHONY: help dev-up dev-down dev-build dev-logs prod-up prod-down prod-build prod-logs migrate

help:
	@echo "EventAlbum - Główny Makefile projektu:"
	@echo "  make dev-up      - Uruchomienie środowiska deweloperskiego (docker-compose.dev.yml)"
	@echo "  make dev-down    - Zatrzymanie środowiska deweloperskiego"
	@echo "  make dev-build   - Przebudowanie obrazów deweloperskich"
	@echo "  make dev-logs    - Podgląd logów środowiska deweloperskiego"
	@echo "  make prod-up     - Uruchomienie środowiska produkcyjnego (docker-compose.prod.yml)"
	@echo "  make prod-down   - Zatrzymanie środowiska produkcyjnego"
	@echo "  make prod-build  - Przebudowanie obrazów produkcyjnych"
	@echo "  make prod-logs   - Podgląd logów środowiska produkcyjnego"
	@echo "  make migrate     - Wykonanie migracji bazy danych w kontenerze backend"

dev-up:
	docker compose -f docker-compose.dev.yml up -d --build

dev-down:
	docker compose -f docker-compose.dev.yml down

dev-build:
	docker compose -f docker-compose.dev.yml build

dev-logs:
	docker compose -f docker-compose.dev.yml logs -f

prod-up:
	docker compose -f docker-compose.prod.yml up -d --build

prod-down:
	docker compose -f docker-compose.prod.yml down

prod-build:
	docker compose -f docker-compose.prod.yml build

prod-logs:
	docker compose -f docker-compose.prod.yml logs -f

migrate:
	docker compose -f docker-compose.dev.yml exec backend php bin/console doctrine:migrations:migrate --no-interaction
