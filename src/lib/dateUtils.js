const pad = (n) => String(n).padStart(2, '0');

export const formatMonthDate = (date) => {
  const d = new Date(date);
  return [d.getFullYear(), pad(d.getMonth() + 1), '01'].join('-');
};

export const getMonthName = (date) => {
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(date);
};

// Premier jour du mois à n mois d'écart.
// On repart toujours du 1er : setMonth() sur un 29, 30 ou 31 déborde sur le mois d'après
// (31 oct. + 1 mois = 1er déc., 31 juil. - 1 mois = 1er juil.).
export const addMonths = (date, n) => {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
};

export const startOfMonth = (date) => addMonths(date, 0);

export const getNextMonth = (date) => addMonths(date, 1);

export const getPrevMonth = (date) => addMonths(date, -1);

// Date au format YYYY-MM-DD en heure locale.
// toISOString() renvoie la date UTC : entre minuit et 2h en France, c'est encore la veille.
export const formatLocalDate = (date) => {
  const d = new Date(date);
  return [d.getFullYear(), pad(d.getMonth() + 1), pad(d.getDate())].join('-');
};

export const getTodayStr = () => formatLocalDate(new Date());

// Lit une date YYYY-MM-DD venant de la base comme une date locale.
// new Date('2026-10-01') est interprété en UTC et peut afficher la veille selon le fuseau.
export const parseLocalDate = (dateStr) => {
  const [year, month, day] = dateStr.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
};
