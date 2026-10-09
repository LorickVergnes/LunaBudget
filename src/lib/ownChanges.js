/**
 * Mémoire courte des modifications faites depuis cet onglet.
 *
 * Supabase Realtime renvoie aussi nos propres changements, sans dire qui les a faits
 * (une suppression n'arrive qu'avec l'identifiant de la ligne). On note donc ce qu'on
 * vient de modifier pour ne pas afficher « modifié par un collaborateur » sur ses propres actions.
 */
const OWN_CHANGE_WINDOW_MS = 10_000;
const RECURRENCE_WINDOW_MS = 5_000;

const recentChanges = new Map(); // id de ligne -> horodatage
const monthsApplied = new Set(); // "dashboard:mois" déjà traités dans cette session
let lastRecurrenceAt = -Infinity;

// Identifiant (UUID) d'une ligne que l'on s'apprête à créer
export const newRowId = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  // Navigateurs anciens ou page servie sans HTTPS
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    return (char === 'x' ? random : (random % 4) + 8).toString(16);
  });
};

export const markOwnChange = (id) => {
  const now = Date.now();
  for (const [key, time] of recentChanges) {
    if (now - time > OWN_CHANGE_WINDOW_MS) recentChanges.delete(key);
  }
  recentChanges.set(String(id), now);
};

export const isOwnChange = (id) => {
  const time = recentChanges.get(String(id));
  return time !== undefined && Date.now() - time <= OWN_CHANGE_WINDOW_MS;
};

// La première ouverture d'un mois peut copier des éléments récurrents créés par d'autres membres :
// ces insertions viennent de nous, même si elles portent le nom de leur auteur d'origine.
export const markRecurrenceRun = (dashboardId, month) => {
  const key = `${dashboardId}:${month}`;
  if (monthsApplied.has(key)) return;
  monthsApplied.add(key);
  lastRecurrenceAt = Date.now();
};

export const isRecurrenceRecent = () => Date.now() - lastRecurrenceAt <= RECURRENCE_WINDOW_MS;

// Pour les tests
export const resetOwnChanges = () => {
  recentChanges.clear();
  monthsApplied.clear();
  lastRecurrenceAt = -Infinity;
};
