// @vitest-environment jsdom
/**
 * Fiabilité des chiffres : ce que l'application affiche et enregistre quand quelque chose
 * sort du parcours idéal (panne réseau, page rechargée, mois affiché différent de celui de la ligne).
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import * as mock from './supabaseMock';
import { resetOwnChanges } from '../lib/ownChanges';
import { readAuthLinkFromUrl } from '../lib/authLink';
import App from '../App';
import { preloadPages } from '../lib/pageLoaders';

vi.mock('../lib/supabaseClient', async () => ({ supabase: (await import('./supabaseMock')).supabase }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
await preloadPages();
vi.setConfig({ testTimeout: 30_000 });

const NETWORK_ERROR = { message: 'TypeError: Failed to fetch' };
let root = null;

const settle = async (rounds = 6) => {
  for (let i = 0; i < rounds; i++) await act(async () => { await new Promise(r => setTimeout(r, 15)); });
};
// Une lecture en échec est retentée une fois, une seconde plus tard, avant d'afficher l'erreur
const settleAfterFailure = async () => {
  await act(async () => { await new Promise(r => setTimeout(r, 1300)); });
  await settle();
};

const start = async (path, { now = new Date(2026, 9, 15, 10, 0, 0), width = 1280, before } = {}) => {
  if (root) await act(async () => { root.unmount(); });
  vi.setSystemTime(now);
  mock.resetMock();
  before?.();
  resetOwnChanges();
  localStorage.clear();
  window.innerWidth = width;
  window.location.hash = '#' + path;
  readAuthLinkFromUrl();
  document.body.innerHTML = '<div id="root"></div>';
  root = createRoot(document.getElementById('root'));
  await act(async () => { root.render(<App />); });
  await settle();
};

const text = () => document.body.textContent;
const click = async (el) => { expect(el, 'élément à cliquer').toBeTruthy(); await act(async () => { el.click(); }); await settle(4); };
const iconButton = (icon, index = 0) => [...document.querySelectorAll(`svg.lucide-${icon}`)].map(s => s.closest('button')).filter(Boolean)[index];
const buttonNamed = (label) => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === label);
const modal = () => [...document.querySelectorAll('[data-modal-open="true"]')].pop();
const fill = async (values) => {
  await act(async () => {
    modal().querySelectorAll('form input').forEach(input => {
      if (!(input.type in values)) return;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, values[input.type]);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });
};
const submit = async () => {
  await act(async () => { modal().querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
  await settle();
};
const lastOp = (table, op) => mock.log.ops.filter(o => o.table === table && o.op === op).pop();

describe('fiabilité', () => {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterAll(async () => {
    if (root) await act(async () => { root.unmount(); });
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('panne de chargement', () => {
    it('affiche une erreur avec un bouton pour réessayer, jamais un budget vide', async () => {
      await start('/incomes', { before: () => mock.setMockReadError(NETWORK_ERROR) });
      await settleAfterFailure();

      expect(text()).toContain('Impossible de charger vos données');
      expect(text()).not.toContain('Aucun revenu ce mois');

      mock.setMockReadError(null);
      await click(buttonNamed('Réessayer'));
      await settle();
      expect(text()).not.toContain('Impossible de charger vos données');
      expect(text()).toContain('Salaire');
    });

    it('le tableau de bord n\'affiche pas 0 € partout quand ses données ne se chargent pas', async () => {
      await start('/');
      expect(text()).toContain('Reste à vivre');

      await start('/', { before: () => mock.setMockReadError(NETWORK_ERROR) });
      await settleAfterFailure();
      expect(text()).toContain('Impossible de charger vos données');
      expect(text()).not.toContain('Reste à vivre');
    });

    it('un échec de la récurrence est signalé, sans empêcher d\'afficher le mois', async () => {
      await start('/incomes', { before: () => mock.setMockRecurrenceError({ message: 'boom' }) });
      await settleAfterFailure();

      expect(text()).toContain('Salaire');
      expect(text()).toContain("Les éléments récurrents n'ont pas pu être reportés");
    });

    it('un échec de la récurrence n\'est pas gardé en cache : il est retenté au chargement suivant', async () => {
      const calls = () => mock.log.reads.filter(r => r.startsWith('rpc apply_recurrence')).length;
      await start('/incomes', { before: () => mock.setMockRecurrenceError({ message: 'boom' }) });
      await settleAfterFailure();
      const afterFailure = calls();

      mock.setMockRecurrenceError(null);
      await click(iconButton('chevron-right'));
      await click(iconButton('chevron-left'));
      // Le mois d'octobre est rechargé (données de plus de 10 s) : la récurrence est redemandée
      vi.setSystemTime(new Date(Date.now() + 11_000));
      await click(iconButton('chevron-right'));
      await click(iconButton('chevron-left'));
      expect(calls()).toBeGreaterThan(afterFailure + 1);
    });
  });

  describe('mois d\'une ligne', () => {
    it('un revenu est rangé dans le mois de sa date, et sa date est proposée dans le mois affiché', async () => {
      await start('/incomes');
      await click(iconButton('chevron-right')); // novembre, alors qu'on est le 15 octobre
      await click(iconButton('plus'));

      const dateInput = modal().querySelector('input[type="date"]');
      expect(dateInput.value).toBe('2026-11-01');
      expect([dateInput.min, dateInput.max]).toEqual(['2026-11-01', '2026-11-30']);

      await fill({ number: '50', text: 'Prime', date: '2026-11-20' });
      await submit();
      const row = lastOp('incomes', 'insert').payload[0];
      expect(row.date).toBe('2026-11-20');
      expect(row.month_date).toBe('2026-11-01');
    });

    it('modifier une ligne ne change ni son auteur ni son dashboard', async () => {
      await start('/incomes');
      await click(iconButton('pencil'));
      await submit();

      const { payload } = lastOp('incomes', 'update');
      expect(payload).not.toHaveProperty('user_id');
      expect(payload).not.toHaveProperty('dashboard_id');
      expect(payload.month_date).toBe('2026-10-01');
    });

    it('une dépense d\'enveloppe prend le mois de son enveloppe, même si la page est rechargée un autre mois', async () => {
      // On arrive directement sur l'enveloppe d'octobre, mais on est en novembre
      await start('/envelopes/env1', { now: new Date(2026, 10, 15, 10, 0, 0), width: 400 });
      await click(iconButton('plus'));

      const dateInput = modal().querySelector('input[type="date"]');
      expect(dateInput.value).toBe('2026-10-01');
      expect([dateInput.min, dateInput.max]).toEqual(['2026-10-01', '2026-10-31']);

      await fill({ number: '12', text: 'Boulangerie' });
      await submit();
      const row = lastOp('envelope_expenses', 'insert').payload[0];
      expect(row.envelope_id).toBe('env1');
      expect(row.month_date).toBe('2026-10-01');
    });

    it('un versement d\'épargne est rangé dans le mois de sa date', async () => {
      await start('/savings/sav1', { width: 400 });
      await click(iconButton('plus'));
      await fill({ number: '40', date: '2026-09-28' });
      await submit();
      expect(lastOp('saving_entries', 'insert').payload[0].month_date).toBe('2026-09-01');
    });
  });

  describe('page de détail rechargée', () => {
    it('retrouve le nom de l\'enveloppe en base, sans passer par la liste', async () => {
      await start('/envelopes/env1', { width: 400 });
      expect(text()).toContain('Courses');
      expect(mock.log.reads.some(r => r.startsWith('envelopes | * | dashboard_id=d1 & id=env1'))).toBe(true);
    });

    it('retourne à la liste si l\'enveloppe n\'existe pas', async () => {
      await start('/envelopes/inconnue', { width: 400 });
      expect(window.location.hash).toBe('#/envelopes');
    });
  });

  describe('vue globale', () => {
    it('ne change pas le mois choisi dans les autres pages', async () => {
      await start('/incomes');
      await click(iconButton('chevron-left'));
      expect(text()).toContain('septembre 2026');

      await click(document.querySelector('a[href="#/global"]'));
      expect(window.location.hash).toBe('#/global');
      await click(document.querySelector('a[href="#/incomes"]'));
      expect(text()).toContain('septembre 2026');
    });

    it('demande ses totaux à la base au lieu de télécharger toutes les lignes', async () => {
      await start('/global');
      expect(mock.log.reads).toContain('rpc get_monthly_totals | {"as_of":"2026-10-15","dash_id":"d1"}');
      expect(mock.log.reads.some(r => r.startsWith('incomes |') || r.startsWith('envelope_expenses |'))).toBe(false);
      // Revenus réels : 1380 (sept.) + 1440,50 (oct.) ; sorties : 60 + 100 + 250 + 443,10
      expect(text()).toMatch(/Solde Total \(Tous les mois\)1\s967,40/);
      expect(text()).toMatch(/Total Dépenses \(6 mois\)-853,10/);
    });

    it('passer en prévisionnel ne relance aucune requête', async () => {
      await start('/global');
      const before = mock.log.reads.length;
      await click(buttonNamed('Prévisions'));
      expect(mock.log.reads.length).toBe(before);
    });
  });

  describe('tableau de bord', () => {
    it('en réel, les dernières opérations ne montrent que ce qui est déjà arrivé', async () => {
      await start('/');
      // « Essence » est datée du 27 et « CAF » du 25 : on est le 15
      expect(text()).not.toContain('Essence');
      expect(text()).not.toContain('CAF');
      expect(text()).toContain('Vente');

      await click(buttonNamed('Prévisions'));
      expect(text()).toContain('Essence');
      expect(text()).toContain('Prévu');
    });

    it('l\'anneau du budget a une légende, et son pourcentage compte les trois parts affichées', async () => {
      await start('/');
      for (const label of ['Dépenses fixes', 'Enveloppes', 'Épargne', 'Total']) expect(text()).toContain(label);
      // Réel au 15 octobre : (339,90 + 53,20 + 50) / 1440,50 = 31 %
      expect(text()).toContain('31%');
    });
  });

  describe('création d\'un dashboard', () => {
    it('passe par une seule fonction en base, qui inscrit aussi le propriétaire', async () => {
      await start('/');
      await click(buttonNamed('Mon Budget') ?? [...document.querySelectorAll('button')].find(b => b.textContent.includes('Mon Budget')));
      await click([...document.querySelectorAll('button')].find(b => b.textContent.includes('Nouveau budget')));
      await fill({ text: 'Vacances' });
      await submit();

      expect(lastOp('rpc', 'create_dashboard').payload).toEqual({ dashboard_name: 'Vacances' });
      expect(mock.log.ops.some(o => o.table === 'dashboards' || o.table === 'dashboard_members')).toBe(false);
    });
  });
});
