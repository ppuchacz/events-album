.PHONY: help dev-up dev-down dev-build dev-logs prod-up prod-down prod-build prod-logs migrate k8s-build k8s-load k8s-apply k8s-delete k8s-status k8s-hpa-watch k6-smoke k6-event k6-hpa

help:
	@echo "EventAlbum - Główny Makefile projektu:"
	@echo "  make dev-up        - Uruchomienie środowiska deweloperskiego (docker-compose.dev.yml)"
	@echo "  make dev-down      - Zatrzymanie środowiska deweloperskiego"
	@echo "  make dev-build     - Przebudowanie obrazów deweloperskich"
	@echo "  make dev-logs      - Podgląd logów środowiska deweloperskiego"
	@echo "  make prod-up       - Uruchomienie środowiska produkcyjnego (docker-compose.prod.yml)"
	@echo "  make prod-down     - Zatrzymanie środowiska produkcyjnego"
	@echo "  make prod-build    - Przebudowanie obrazów produkcyjnych"
	@echo "  make prod-logs     - Podgląd logów środowiska produkcyjnego"
	@echo "  make migrate       - Wykonanie migracji bazy danych w kontenerze backend"
	@echo "  make k8s-build     - Zbudowanie produkcyjnych obrazów Docker pod Kubernetes"
	@echo "  make k8s-load      - Załadowanie zbudowanych obrazów do klastra Minikube"
	@echo "  make k8s-apply     - Wdrożenie manifestów Kubernetes (k8s/)"
	@echo "  make k8s-delete    - Usunięcie zasobów Kubernetes"
	@echo "  make k8s-status    - Sprawdzenie statusu podów, serwisów, ingressu i HPA w events-album"
	@echo "  make k8s-hpa-watch - Podgląd na żywo autoskalera HPA pod obciążeniem"
	@echo "  make k6-smoke      - Szybki test dymny (1 VU) sprawdzający wszystkie ścieżki"
	@echo "  make k6-event      - Pełny test k6 symulujący realistyczny ruch podczas imprezy"
	@echo "  make k6-hpa        - Test k6 wywołujący autoskalowanie backendu HPA (2 -> 10 podów)"

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

k8s-build:
	docker build --target prod -t events-album-backend:latest ./backend
	docker build --target prod -t events-album-frontend:latest ./frontend

k8s-load:
	minikube image load events-album-backend:latest
	minikube image load events-album-frontend:latest

k8s-apply:
	kubectl apply -k k8s/

k8s-delete:
	kubectl delete -k k8s/ --ignore-not-found

k8s-status:
	kubectl get all,ingress,pvc,hpa -n events-album

k8s-hpa-watch:
	kubectl get hpa backend-hpa -n events-album -w

k6-smoke:
	k6 run k6/smoke_test.js

k6-event:
	k6 run k6/scenarios/realistic_event_load.js

k6-hpa:
	k6 run k6/scenarios/hpa_scaling_test.js
