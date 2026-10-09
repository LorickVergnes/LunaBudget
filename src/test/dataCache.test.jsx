// @vitest-environment jsdom
/**
 * Cache des données : une action ne recharge qu'une fois, et les pages ou les mois déjà
 * visités s'affichent sans attendre.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import * as mock from './supabaseMock';
import { resetOwnChanges } from '../lib/ownChanges';
import { readAuthLinkFromUrl } from '../lib/authLink';
import App from '../App';

vi.mock('../lib/supabaseClient', async () => ({ supabase: (await import('./supabaseMock')).supabase }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
vi.setConfig({ testTimeout: 30_000 });

const OCT = '2026-10-01';
let root = null;

const settle = async (rounds = 6) => {
  for (let i = 0; i < rounds; i++) await act(async () => { await new Promise(r => setTimeout(r, 15)); });
};
const start = async (path) => {
  if (root) await act(async () => { root.unmount(); });
  vi.setSystemTime(new Date(2026, 9, 15, 10, 0, 0));
  mock.resetMock();
  resetOwnChanges();
  localStorage.clear();
  window.innerWidth = 1280;
  window.location.hash = '#' + path;
  readAuthLinkFromUrl();
  document.body.innerHTML = '<div id="root"></div>';
  root = createRoot(document.getElementById('root'));
  await act(async () => { root.render(<App />); });
  await settle();
};

const text = () => document.body.textContent;
const isLoading = () => document.querySelector('.loading-container') !== null;
// Nombre de requêtes de lecture envoyées dont la description commence par `prefix`
const reads = (prefix) => mock.log.reads.filter(r => r.startsWith(prefix)).length;
const recurrenceCalls = (month) => reads(`rpc apply_recurrence | {"dash_id":"d1","for_month":"${month}"}`);
const later = (ms) => vi.setSystemTime(new Date(Date.now() + ms));

const click = async (el) => { expect(el, 'élément à cliquer').toBeTruthy(); await act(async () => { el.click(); }); };
const clickAndSettle = async (el) => { await click(el); await settle(4); };
const navLink = (label) => [...document.querySelectorAll('a')].find(a => a.textContent.trim() === label);
const iconButton = (icon, index = 0) => [...document.querySelectorAll(`svg.lucide-${icon}`)].map(s => s.closest('button')).filter(Boolean)[index];
const modal = () => [...document.querySelectorAll('[data-modal-open="true"]')].pop();
const emit = async (...args) => { await act(async () => { mock.emitRealtime(...args); }); await settle(4); };

const addIncome = async () => {
  await clickAndSettle(iconButton('plus'));
  await act(async () => {
    modal().querySelectorAll('form input').forEach(input => {
      const value = input.type === 'number' ? '50' : input.type === 'text' ? 'Remboursement' : null;
      if (value === null) return;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });
  await act(async () => { modal().querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
  await settle();
  return mock.log.ops.find(o => o.table === 'incomes' && o.op === 'insert').payload[0];
};

describe('cache des données', () => {
  beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); });
  afterAll(async () => {
    if (root) await act(async () => { root.unmount(); });
    vi.useRealTimers();
  });

  it('un ajout recharge les données une seule fois, même quand le temps réel renvoie notre propre ajout', async () => {
    await start('/incomes');
    expect(reads('incomes |')).toBe(1);

    const inserted = await addIncome();
    expect(reads('incomes |')).toBe(2);

    // Supabase nous renvoie l'ajout que l'on vient de faire
    await emit('incomes', 'INSERT', { ...inserted, month_date: OCT }, null);
    expect(reads('incomes |')).toBe(2);
    expect(text()).not.toContain('par un collaborateur');
  });

  it('une suppression recharge les données une seule fois', async () => {
    await start('/incomes');
    await clickAndSettle(iconButton('trash-2', 1));
    await clickAndSettle([...modal().querySelectorAll('button')].find(b => b.textContent.trim() === 'Supprimer'));
    expect(reads('incomes |')).toBe(2);

    await emit('incomes', 'DELETE', null, { id: 'inc2' });
    expect(reads('incomes |')).toBe(2);
  });

  it('le changement d\'un collaborateur recharge les données et prévient', async () => {
    await start('/incomes');
    later(6000);
    await emit('incomes', 'INSERT', { id: 'x1', user_id: mock.OTHER_USER_ID, name: 'Vente', month_date: OCT }, null);
    expect(reads('incomes |')).toBe(2);
    expect(text()).toContain('Vente a été ajouté par un collaborateur');
  });

  it('recharger après une action ne masque pas la page derrière un indicateur de chargement', async () => {
    await start('/incomes');
    await clickAndSettle(iconButton('trash-2', 1));
    // Juste après le clic de confirmation, avant la fin du rechargement
    await click([...modal().querySelectorAll('button')].find(b => b.textContent.trim() === 'Supprimer'));
    expect(isLoading()).toBe(false);
    expect(text()).toContain('Salaire');
    await settle();
  });

  it('la récurrence n\'est demandée qu\'une fois par mois, pas à chaque rechargement', async () => {
    await start('/incomes');
    expect(recurrenceCalls(OCT)).toBe(1);
    await addIncome();
    later(6000);
    await emit('incomes', 'INSERT', { id: 'x1', user_id: mock.OTHER_USER_ID, name: 'Vente', month_date: OCT }, null);
    expect(reads('incomes |')).toBe(3);
    expect(recurrenceCalls(OCT)).toBe(1);
  });

  it('revenir sur une page déjà visitée l\'affiche immédiatement, sans nouvelle requête', async () => {
    await start('/incomes');
    await clickAndSettle(navLink('Dépenses'));
    expect(text()).toContain('Historique des dépenses fixes');
    expect(reads('incomes |')).toBe(1);

    await click(navLink('Revenus'));
    // Aucune attente : le contenu est déjà là
    expect(isLoading()).toBe(false);
    expect(text()).toContain('Salaire');
    await settle();
    expect(reads('incomes |')).toBe(1);
    expect(recurrenceCalls(OCT)).toBe(1);
  });

  it('après 10 secondes, une page revisitée s\'affiche tout de suite puis se remet à jour en arrière-plan', async () => {
    await start('/incomes');
    await clickAndSettle(navLink('Dépenses'));
    later(11_000);

    await click(navLink('Revenus'));
    expect(isLoading()).toBe(false);
    expect(text()).toContain('Salaire');
    await settle();
    expect(reads('incomes |')).toBe(2);
  });

  it('changer de mois puis revenir ne recharge pas le mois déjà affiché', async () => {
    await start('/incomes');
    await clickAndSettle(iconButton('chevron-right'));
    expect(text()).toContain('novembre 2026');
    expect(recurrenceCalls('2026-11-01')).toBe(1);

    await click(iconButton('chevron-left'));
    expect(isLoading()).toBe(false);
    expect(text()).toContain('Salaire');
    await settle();
    expect(reads('incomes | * | dashboard_id=d1 & is_hidden=false & month_date=2026-10-01')).toBe(1);
    expect(recurrenceCalls(OCT)).toBe(1);
  });

  it('une modification en octobre fait recalculer la récurrence de novembre à sa prochaine ouverture', async () => {
    await start('/incomes');
    await clickAndSettle(iconButton('chevron-right'));
    await clickAndSettle(iconButton('chevron-left'));
    expect(recurrenceCalls('2026-11-01')).toBe(1);

    // Nouveau revenu en octobre : s'il est récurrent, il doit être reporté en novembre
    await addIncome();
    await clickAndSettle(iconButton('chevron-right'));
    expect(recurrenceCalls('2026-11-01')).toBe(2);
    // Octobre, lui, n'a pas besoin d'être recalculé
    expect(recurrenceCalls(OCT)).toBe(1);
  });

  it('une modification sur une page met à jour les autres pages à leur prochain affichage', async () => {
    await start('/');
    expect(reads('incomes |')).toBe(1);
    await clickAndSettle(navLink('Revenus'));
    await addIncome();

    // Le tableau de bord, déjà en cache, est rechargé quand on y revient
    await clickAndSettle(navLink('Budget'));
    expect(mock.log.reads.filter(r => r.startsWith('incomes | id, amount')).length).toBe(2);
  });
});
