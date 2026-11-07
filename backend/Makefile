.PHONY: help install start worker migrate cache-clear lint

help:
	@echo "Dostępne komendy dla projektu backend (Symfony API & Worker):"
	@echo "  make install      - Instalacja zależności Composer"
	@echo "  make start        - Uruchomienie serwera deweloperskiego API (port 8000)"
	@echo "  make worker       - Uruchomienie workera konwersji wideo (Symfony Messenger / RabbitMQ)"
	@echo "  make migrate      - Wykonanie migracji bazy danych PostgreSQL"
	@echo "  make cache-clear  - Wyczyszczenie pamięci podręcznej Symfony"
	@echo "  make lint         - Sprawdzenie poprawności kontenera DI i konfiguracji"

install:
	composer install --no-interaction

start:
	php -S 0.0.0.0:8000 -t public public/router.php

worker:
	php bin/console messenger:consume async -vv --time-limit=3600

migrate:
	php bin/console doctrine:migrations:migrate --no-interaction --allow-no-migration

cache-clear:
	php bin/console cache:clear

lint:
	php bin/console lint:container
	php bin/console lint:yaml config
