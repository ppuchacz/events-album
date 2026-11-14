# Testy Obciążeniowe i Wydajnościowe k6 dla EventAlbum

Katalog zawiera kompleksowy zestaw testów wydajnościowych przygotowanych w narzędziu [k6](https://k6.io), symulujących rzeczywiste zachowanie gości i organizatorów podczas imprez okolicznościowych (wesela, jubileusze, imprezy firmowe, urodziny), połączonych z automatycznym skalowaniem backendu (**Horizontal Pod Autoscaler – HPA**) w klastrze Kubernetes.

---

## 🎭 Symulowane Persony Użytkowników i Profile Ruchu

Ruch w testach odzwierciedla naturalną dynamikę imprezy:

1. **Organizatorzy (`organizers` ~5% ruchu)**:
   - Rejestracja nowego wydarzenia (`POST /api/auth/register`) z unikalnym slugiem i tytułem,
   - Logowanie do panelu administracyjnego (`POST /api/auth/login`),
   - Podgląd panelu i statystyk albumu (`GET /api/admin/event`),
   - Dostosowywanie ustawień jakości multimediów (`high`, `medium`, `low`, `very_low`) pod kątem spodziewanej przepustowości łącza internetowego.
2. **Goście przeglądający (`browsing_guests` ~70% ruchu)**:
   - Wejście na stronę po zeskanowaniu kodu QR (załadowanie aplikacji React SPA `GET /`),
   - Odpytanie API o stan albumu i listę materiałów (`GET /api/public/events/:slug`),
   - Pobieranie miniatur zdjęć z galerii (`GET /uploads/:id/thumbs/...`),
   - Otwieranie wybranych zdjęć w pełnoekranowym Lightboxie (`GET /uploads/:id/variants/...`),
   - Realistyczny czas przeglądania (think-time: 2-5s).
3. **Goście dodający multimedia (`uploading_guests` ~25% ruchu)**:
   - Wypełnienie imienia/podpisu (np. „Stolik 3”, „Kasia i Michał”, „Świadek Piotr”) oraz życzeń/komentarza,
   - Wysłanie zdjęcia w formacie multipart/form-data (`POST /api/public/events/:slug/media`),
   - Weryfikacja natychmiastowego pojawienia się zdjęcia w galerii i pobranie wygenerowanej miniatury.

---

## 📈 Fazy Testu Rzeczywistego (`realistic_event_load.js`)

Test symuluje 5-etapowy cykl uroczystości:
- **Etap 1: Przygotowanie sali (30s)**: Niski ruch (organizatorzy konfigurują album).
- **Etap 2: Przybycie gości i skanowanie QR (1m)**: Wzrost do 35 VUs – goście siadają przy stolikach i skanują kody QR z winietek.
- **Etap 3: Kulminacja zabawy (1m 30s)**: Szczyt (do 90 VUs) – toasty, pierwszy taniec, tort; dziesiątki osób robią i wrzucają zdjęcia naraz.
- **Etap 4: Spokojna zabawa (1m)**: Utrzymanie stabilnego ruchu (przeglądanie rosnącej galerii).
- **Etap 5: Wyciszenie (30s)**: Zakończenie imprezy i spadek ruchu.

---

## ⚖️ Skalowanie Backendu (HPA w Kubernetes)

Backend aplikacji realizuje wymaganie automatycznego skalowania w zależności od natężenia ruchu:

- **Manifest HPA**: [`k8s/backend-hpa.yaml`](../k8s/backend-hpa.yaml)
- **Metryki sterujące**:
  - **CPU**: docelowo `60%` utylizacji (dekodowanie, skalowanie w GD i generowanie 4 wariantów obrazów to operacje CPU-bound),
  - **Memory**: docelowo `75%` utylizacji.
- **Zakres replik**: od **2** (wysoka dostępność w spoczynku) do **10** podów backendu w szczycie.
- **Architektura bezstanowa (Stateless)**: Autoryzacja tokenem Bearer w PostgreSQL – każde żądanie może trafić na dowolną replikę podów backendu.
- **Współdzielony wolumen**: [`k8s/uploads-pvc.yaml`](../k8s/uploads-pvc.yaml) (`ReadWriteMany`) umożliwia jednoczesny zapis i odczyt zdjęć przez wszystkie repliki backendu oraz workera FFmpeg.

---

## 📁 Struktura Plików

```
k6/
├── README.md                           # Dokumentacja i przewodnik
├── smoke_test.js                       # Szybki test weryfikacyjny (1 VU)
├── fixtures/                           # Rzeczywiste pliki JPEG do testów uploadu
│   ├── sample_small.jpg                # 320x240 (11 KB)
│   ├── sample_medium.jpg               # 800x600 (35 KB)
│   └── sample_large.jpg                # 1280x720 (41 KB)
├── lib/
│   ├── api.js                          # Klient HTTP API (rejestracja, logowanie, upload, pobieranie)
│   └── fixtures.js                     # Generatory danych (polskie imiona, życzenia, slugi)
└── scenarios/
    ├── realistic_event_load.js         # Pełna symulacja imprezy z podziałem na persony
    └── hpa_scaling_test.js             # Test stresowy pod weryfikację autoskalowania HPA
```

---

## 🛠️ Uruchamianie Testów

Do dyspozycji są wygodne cele w pliku [`Makefile`](../Makefile):

### 1. Szybki test dymny (Smoke Test)
Sprawdza poprawność wszystkich endpointów (frontend, auth, admin, guest, upload, miniatury):
```bash
make k6-smoke
# lub bezpośrednio:
k6 run k6/smoke_test.js
```

### 2. Pełny test realistycznego obciążenia imprezy
Symuluje organizatorów, gości przeglądających i dodających zdjęcia:
```bash
make k6-event
# lub bezpośrednio:
k6 run k6/scenarios/realistic_event_load.js
```

### 3. Test autoskalowania HPA (Stress Test)
Generuje wysokie obciążenie CPU w celu przetestowania wyskalowania backendu z 2 do 10 podów:
```bash
make k6-hpa
# lub bezpośrednio:
k6 run k6/scenarios/hpa_scaling_test.js
```

### 4. Obserwacja autoskalowania na żywo w osobnym terminalu
```bash
make k8s-hpa-watch
# lub bezpośrednio:
kubectl get hpa backend-hpa -n events-album -w
```
Możesz także podejrzeć bieżące zużycie CPU i pamięci przez pody:
```bash
kubectl top pods -n events-album
```

### 5. Zmiana adresu docelowego (BASE_URL)
Domyślnie testy łączą się z `http://localhost:8080`. Możesz wskazać dowolny adres za pomocą zmiennej środowiskowej:
```bash
BASE_URL="http://192.168.49.2" k6 run k6/scenarios/realistic_event_load.js
```
