// Treść zadań pokazywana uczestnikowi przed każdym scenariuszem.
// TODO: wpisać ostateczne treści scenariuszy z protokołu badania.
export const SCENARIOS = {
  1: {
    title: 'Zamów jeden produkt',
    text: 'Zamów na miejscu jednego Cheeseburgera i przejdź do płatności kartą.',
  },
  2: {
    title: 'Zamów zestaw',
    text: 'Zamów na wynos McZestaw Big Mac® z dużymi frytkami i Coca-Colą, a następnie złóż zamówienie.',
  },
  3: {
    title: 'Popraw zamówienie',
    text: 'Dodaj do zamówienia dwa McCrispy®, usuń jeden z nich w podsumowaniu i zapłać przy kasie.',
  },
};

// AB → S1–S3 w wersji A, potem S1–S3 w wersji B; BA odwrotnie
export const sequenceFor = (kolejnosc) =>
  kolejnosc.split('').flatMap((wersja) => [1, 2, 3].map((n) => ({ wersja, n })));
