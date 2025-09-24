# My2Do - Polska Aplikacja Lista Zadań PWA

Aplikacja do zarządzania zadaniami z obsługą języka polskiego, rozpoznawaniem mowy i powiadomieniami offline.

## Funkcjonalności

### ✅ Podstawowe funkcje
- **Notatnik-owy interfejs** - naturalne pisanie zadań
- **Cztery główne widoki**: Notatki → Pulpit → Ukończone → Ustawienia
- **Swipe navigation** - przewijanie między widokami
- **Offline-first** - działanie bez internetu
- **PWA** - instalacja jako aplikacja mobilna

### 📅 Zarządzanie zadaniami
- **3 poziomy priorytetu**: Wysoki/Średni/Niski
- **Kategorie z kolorami** - organizacja zadań
- **Podzadania/checklista** - szczegółowa struktura
- **Zadania cykliczne** - codzienne/tygodniowe/miesięczne
- **Przypomnienia** - z elastycznym czasem

### 🔊 Rozpoznawanie mowy (Polski)
- **Polskie komendy głosowe**:
  - "nowe zadanie" - nowe zadanie
  - "priorytet wysoki/średni/niski" - ustawienie priorytetu
  - "kategoria [nazwa]" - przypisanie kategorii
  - "przypomnij za [czas]" - ustawienie przypomnienia
  - "codziennie/co tydzień" - zadania cykliczne

### 🎨 Personalizacja
- **Tryby**: Jasny/Ciemny
- **Schematy kolorów**: Niebieski/Zielony/Fioletowy/Pomarańczowy
- **Rozmiar czcionki** - regulowany
- **Własne kategorie** - dodawanie/usuwanie/kolory

### 📊 Dashboard
- **Podzielony widok** - zadania ogólne | harmonogram
- **Przesuwany separator** - dostosowanie proporcji
- **Sortowanie według dat** - chronologiczny porządek
- **Szczegóły zadań** - modal z pełnymi informacjami

### 🔔 Powiadomienia
- **Offline push notifications** - działają bez internetu
- **Elastyczne przypomnienia** - 1 min do 1 godz wcześniej
- **Service Worker** - background processing
- **Żądanie uprawnień** - automatyczna konfiguracja

### 📱 Integracja
- **Google Calendar** - eksport zadań (wymaga konfiguracji API)
- **IndexedDB** - lokalna baza danych
- **Web Speech API** - rozpoznawanie polskiej mowy

## Instalacja i uruchomienie

### 🚀 Metoda 1: GitHub Pages (Rekomendowana)

1. **Fork this repository** lub sklonuj na swoje konto GitHub
2. **Włącz GitHub Pages** w ustawieniach repozytorium:
   - Settings → Pages → Source: "GitHub Actions"
3. **Deploy automatycznie** - każdy push na main uruchamia deployment
4. **Dostęp do aplikacji**: `https://yourusername.github.io/my2do/`

#### 🔧 Deployment Options:

**Automatyczny (GitHub Actions):**
```bash
git push origin main  # Auto-deploy via GitHub Actions
```

**Manualny (Scripts):**
```bash
# Linux/Mac
chmod +x deploy.sh
./deploy.sh

# Windows
deploy.bat
```

### 💻 Metoda 2: Lokalne uruchomienie

#### 1. Pobierz projekt
```bash
git clone https://github.com/yourusername/my2do.git
cd my2do
```

#### 2. Ikony PWA ✅
**Ikony PWA są już dołączone!** Aplikacja jest gotowa do zainstalowania jako pełna PWA.

#### 3. Uruchom serwer
```bash
# Python
python -m http.server 8000

# Node.js
npx http-server

# PHP
php -S localhost:8000

# Live Server (VS Code)
```

#### 4. Otwórz aplikację
```
http://localhost:8000
```

### 📱 Instalacja jako PWA

**⚠️ Jeśli aplikacja instaluje się jako "skrót" zamiast aplikacji - brakuje ikon PWA!**

**Prawidłowa instalacja:**
- **Android/Chrome**: Menu → "Zainstaluj My2Do" (ikona aplikacji w menu)
- **iOS/Safari**: Udostępnij → "Dodaj do ekranu głównego"
- **Desktop**: Ikona instalacji ⊕ w pasku adresu przeglądarki

**Rozwiązywanie problemów:**
1. **Brak opcji instalacji** = Sprawdź czy ikony PWA są w folderze `icons/` (powinny być)
2. **Instaluje się jako skrót** = Wyczyść cache przeglądarki i spróbuj ponownie
3. **Nie działa offline** = Sprawdź czy Service Worker się zarejestrował (F12 → Application → Service Workers)

## Konfiguracja Google Calendar (opcjonalna)

### 1. Google Cloud Console
1. Idź do [Google Cloud Console](https://console.cloud.google.com/)
2. Utwórz nowy projekt lub wybierz istniejący
3. Włącz Calendar API
4. Utwórz kredencjały (API Key i OAuth 2.0 Client ID)

### 2. Konfiguracja w kodzie
W pliku `script.js` znajdź:
```javascript
const API_KEY = 'YOUR_API_KEY_HERE';
const CLIENT_ID = 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com';
```

Zastąp swoimi kluczami z Google Cloud Console.

### 3. Konfiguracja domeny
W Google Cloud Console dodaj domenę aplikacji do autoryzowanych origin URLs.

## Użytkowanie

### Tworzenie zadań
1. **Wpisz zadanie** w pole tekstowe
2. **Ustaw datę i czas** (opcjonalne)
3. **Wybierz priorytet** i kategorię
4. **Dodaj podzadania** (opcjonalne)
5. **Ustaw przypomnienie**
6. **Zaznacz cykliczne** (opcjonalne)
7. **Zapisz zadanie**

### Komendy głosowe
Kliknij mikrofon (🎤) i powiedz:
- "Nowe zadanie spotkanie z klientem"
- "Priorytet wysoki"
- "Kategoria praca"
- "Przypomnij za 15 minut"
- "Codziennie"

### Nawigacja
- **Swipe left/right** - przełączanie widoków
- **Dolna nawigacja** - bezpośredni dostęp
- **Kliknij zadanie** - wyświetl szczegóły

### Powiadomienia
1. **Włącz w ustawieniach** - checkbox "Włącz powiadomienia"
2. **Potwierdź uprawnienia** - w przeglądarce
3. **Ustaw przypomnienia** - przy tworzeniu zadań

## Struktura plików

```
my2do/
├── index.html              # Główna strona aplikacji
├── styles.css              # Style CSS z themami
├── script.js               # Logika aplikacji
├── manifest.json           # Konfiguracja PWA
├── sw.js                   # Service Worker
├── .gitignore              # Git ignore file
├── icons/                  # Ikony PWA (wygenerowane)
│   ├── icon-72x72.png
│   ├── icon-96x96.png
│   └── ...
├── create-simple-icons.html # Generator ikon (HTML)
├── create-icons.js         # Generator ikon (Node.js)
├── deploy.sh              # Deploy script (Linux/Mac)
├── deploy.bat             # Deploy script (Windows)
├── .github/
│   └── workflows/
│       └── deploy.yml     # GitHub Actions workflow
└── README.md              # Ten plik
```

## Wymagania przeglądarki

### Obsługiwane funkcje:
- **IndexedDB** - Chrome 24+, Firefox 16+, Safari 7+
- **Service Worker** - Chrome 40+, Firefox 44+, Safari 11.1+
- **Web Speech API** - Chrome 25+, Edge 79+
- **Push Notifications** - Chrome 42+, Firefox 44+

### Najlepsze wsparcie:
- **Chrome/Edge** - pełne wsparcie wszystkich funkcji
- **Firefox** - dobre wsparcie, ograniczone Web Speech API
- **Safari** - bazowe wsparcie PWA, brak Web Speech API

## Znane ograniczenia

1. **Rozpoznawanie mowy** - tylko Chrome/Edge
2. **Google Calendar** - wymaga konfiguracji API
3. **Push notifications na iOS** - ograniczone wsparcie
4. **Offline sync** - brak synchronizacji między urządzeniami

## Deployment

### 🔄 GitHub Actions (Automatyczny)
Aplikacja automatycznie deployuje się na GitHub Pages przy każdym push do main branch.

**Workflow features:**
- ✅ Automatyczne kopiowanie plików
- ✅ Tworzenie 404.html dla SPA
- ✅ Aktualizacja ścieżek dla subdomain
- ✅ Upload artefaktów
- ✅ Deploy na GitHub Pages

### 📜 Manual Scripts

**Linux/Mac:**
```bash
chmod +x deploy.sh
./deploy.sh
```

**Windows:**
```bash
deploy.bat
```

**Co robią skrypty:**
1. 🔍 Sprawdzają czy to repozytorium git
2. 📦 Tworzą build directory
3. 📋 Kopiują potrzebne pliki
4. 🔧 Aktualizują ścieżki dla GitHub Pages
5. 🌿 Switchują na gh-pages branch
6. 📤 Pushują zmiany
7. ✅ Powracają na main branch

### 🛠️ Custom Domain (opcjonalnie)
W `.github/workflows/deploy.yml` odkomentuj i edytuj:
```yaml
- name: Create CNAME
  run: echo "yourdomain.com" > build/CNAME
```

## Rozwój i kontrybucje

### Dodawanie nowych funkcji:
1. **Nowe kategorie** - edytuj `defaultCategories` w `script.js`
2. **Nowe komendy głosowe** - rozszerz `processVoiceCommand()`
3. **Nowe kolory** - dodaj w `:root` w `styles.css`
4. **Nowe języki** - klonuj strukture polską

### Development workflow:
```bash
# 1. Fork repository
git clone https://github.com/yourusername/my2do.git

# 2. Create feature branch
git checkout -b feature/new-feature

# 3. Make changes and test locally
python -m http.server 8000

# 4. Commit and push
git add .
git commit -m "Add new feature"
git push origin feature/new-feature

# 5. Create Pull Request
# 6. Merge to main triggers auto-deployment
```

### Znane TODO:
- [ ] Synchronizacja między urządzeniami
- [ ] Export/import danych
- [ ] Widget na pulpit
- [ ] Zespoły/współdzielenie zadań
- [ ] Integracja z innymi kalendarzami
- [ ] Statistyki i raporty
- [ ] PWA update notifications
- [ ] Offline sync improvements

## Licencja

MIT License - możesz używać, modyfikować i dystrybuować za darmo.

## Kontakt i zgłaszanie błędów

Zgłaszaj problemy poprzez Issues w repozytorium lub bezpośrednio w kodzie.

---

**My2Do** - Twoja polska lista zadań zawsze pod ręką! 🚀