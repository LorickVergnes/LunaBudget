// @vitest-environment jsdom
/**
 * Notifications temps réel : on prévient des changements des collaborateurs,
 * jamais de ses propres actions.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { emitRealtime, resetMock, DATA, USER, OTHER_USER_ID } from './supabaseMock';
import { resetOwnChanges } from '../lib/ownChanges';
import App from '../App';

vi.mock('../lib/supabaseClient', async () => ({ supabase: (await import('./supabaseMock')).supabase }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
vi.setConfig({ testTimeout: 30_000 });

let root = null;
const settle = async (rounds = 6) => {
  for (let i = 0; i < rounds; i++) await act(async () => { await new Promise(r => setTimeout(r, 15)); });
};
const mountIncomes = async () => {
  if (root) await act(async () => { root.unmount(); });
  resetMock();
  resetOwnChanges();
  window.innerWidth = 1280;
  window.location.hash = '#/incomes';
  document.body.innerHTML = '<div id="root"></div>';
  root = createRoot(document.getElementById('root'));
  await act(async () => { root.render(<App />); });
  await settle();
};
const toasts = () => [...document.querySelectorAll('.toast-message')].map(t => t.textContent);
const realtimeToasts = () => toasts().filter(t => t.includes('collaborateur'));
const emit = async (...args) => { await act(async () => { emitRealtime(...args); }); await settle(3); };
const click = async (el) => { await act(async () => { el.click(); }); await settle(4); };
const later = (ms) => vi.setSystemTime(new Date(Date.now() + ms));
const trashButtons = () => [...document.querySelectorAll('svg.lucide-trash-2')].map(s => s.closest('button'));
const modalButton = (label) => [...document.querySelectorAll('[data-modal-open="true"] button')].find(b => label.test(b.textContent.trim()));

const salaire = DATA.incomes.find(i => i.id === 'inc1'); // créé par moi, récurrent
const vente = DATA.incomes.find(i => i.id === 'inc2');   // créé par le collaborateur, ponctuel

describe('notifications temps réel', () => {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 15, 10, 0, 0));
  });
  afterAll(async () => {
    if (root) await act(async () => { root.unmount(); });
    vi.useRealTimers();
  });

  it('ne notifie pas ma propre suppression', async () => {
    await mountIncomes();
    await click(trashButtons()[1]);
    await click(modalButton(/^Supprimer$/));
    // Supabase renvoie la suppression avec le seul identifiant de la ligne
    await emit('incomes', 'DELETE', null, { id: vente.id });
    expect(toasts()).toContain('Revenu supprimé');
    expect(realtimeToasts()).toEqual([]);
  });

  it('ne notifie pas quand je masque un élément créé par un collaborateur', async () => {
    await mountIncomes();
    await click(trashButtons()[2]); // CAF, récurrent
    await click(modalButton(/Supprimer ce mois uniquement/));
    const caf = DATA.incomes.find(i => i.id === 'inc3');
    await emit('incomes', 'UPDATE', { ...caf, user_id: OTHER_USER_ID, is_hidden: true }, { id: caf.id });
    expect(realtimeToasts()).toEqual([]);
  });

  it('notifie la suppression faite par un collaborateur', async () => {
    await mountIncomes();
    await emit('incomes', 'DELETE', null, { id: vente.id });
    expect(realtimeToasts()).toEqual(['Un revenu a été supprimé par un collaborateur']);
  });

  it('notifie quand un collaborateur modifie ou masque un de mes éléments', async () => {
    await mountIncomes();
    later(6000);
    // La ligne garde mon user_id : seul l'identifiant permet de savoir que ce n'est pas moi
    await emit('incomes', 'UPDATE', { ...salaire, user_id: USER.id, is_hidden: true }, { id: salaire.id });
    expect(realtimeToasts()).toEqual(['Salaire a été modifié par un collaborateur']);
  });

  it('ne notifie pas les copies de récurrence déclenchées par mon ouverture du mois', async () => {
    await mountIncomes();
    // Copie d'un élément récurrent du collaborateur, créée par la récurrence que je viens de lancer
    await emit('incomes', 'INSERT', { ...salaire, id: 'clone1', user_id: OTHER_USER_ID }, null);
    expect(realtimeToasts()).toEqual([]);
  });

  it('notifie un ajout récurrent fait par un collaborateur plus tard', async () => {
    await mountIncomes();
    later(6000);
    await emit('incomes', 'INSERT', { ...salaire, id: 'new2', name: 'Loyer perçu', user_id: OTHER_USER_ID }, null);
    expect(realtimeToasts()).toEqual(['Loyer perçu a été ajouté par un collaborateur']);
  });

  it('ne notifie pas ce que je viens d\'ajouter', async () => {
    await mountIncomes();
    later(6000);
    await emit('incomes', 'INSERT', { ...vente, id: 'new3', user_id: USER.id }, null);
    expect(realtimeToasts()).toEqual([]);
  });

  it('oublie mes actions après quelques secondes', async () => {
    await mountIncomes();
    await click(trashButtons()[1]);
    await click(modalButton(/^Supprimer$/));
    later(11_000);
    // Même ligne, mais bien plus tard : ce n'est plus mon action
    await emit('incomes', 'UPDATE', { ...vente, user_id: OTHER_USER_ID }, { id: vente.id });
    expect(realtimeToasts()).toEqual(['Vente a été modifié par un collaborateur']);
  });
});
