/**
 * Zestaw realistycznych danych testowych (fikstur) w języku polskim
 * symulujących zachowania uczestników imprez okolicznościowych.
 */

export const GUEST_NAMES = [
  'Kasia i Michał',
  'Stolik 3 - Przyjaciele z liceum',
  'Świadek Piotr',
  'Świadkowa Ania',
  'Babcia Marysia i Dziadek Janek',
  'Ciocia Grażynka i Wujek Janusz',
  'Ekipa z Wrocławia',
  'Tomek i Karolina',
  'Marta z Warszawy',
  'Kuzyn Bartek',
  'Rodzinka Kowalskich',
  'Znajomi z pracy',
  'Patryk i Natalia',
  'Ola & Kamil',
  'Monika z Poznania',
  'Dominik i Magda',
  'Wojtek',
  'Zosia i Filip'
];

export const GUEST_CAPTIONS = [
  'Wszystkiego najlepszego na nowej drodze życia! 🥂',
  'Sto lat Młodej Parze! Cudowna impreza! 🎉',
  'Parkiet płonie! Pozdrowienia! 💃🕺',
  'Najlepsze wesele w tym roku!',
  'Zdrowie za Wasze szczęście!',
  'Pyszny tort i niesamowita atmosfera 🎂',
  'Pozdrowienia od stolika 3!',
  'Wspaniali Państwo Młodzi! ❤️',
  'Bawimy się do białego rana!',
  'Pamiątka z pierwszego tańca ✨',
  'Świetna muzyka i orkiestra!',
  '' // część gości dodaje zdjęcia bez komentarza
];

export const EVENT_TITLES = [
  'Wesele Anny i Piotra',
  '18-tka Jakuba',
  'Jubileusz 30-lecia Firmy',
  'Urodziny Mai',
  'Złote Gody Marii i Józefa',
  'Chrzciny Antoniego',
  'Bal Sylwestrowy',
  'Impreza Integracyjna 2026'
];

export function getRandomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

export function generateRandomSlug(prefix = 'event') {
  const rand = Math.random().toString(36).substring(2, 8);
  const timestamp = Date.now().toString().slice(-4);
  return `${prefix}-${timestamp}-${rand}`;
}

export function generateRandomEmail(prefix = 'user') {
  const rand = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${Date.now()}_${rand}@example.com`;
}
