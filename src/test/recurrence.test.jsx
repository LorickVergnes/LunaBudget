// @vitest-environment jsdom
/**
 * Récurrences : ce que l'application demande à la base selon ce que l'utilisateur choisit
 * (rythme, fin, « ce mois uniquement » ou « ce mois et les suivants », arrêt).
 * Le comportement des fonctions SQL elles-mêmes est vérifié sur une vraie base, pas ici.
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

const click = async (el) => { expect(el, 'élément à cliquer').toBeTruthy(); await act(async () => { el.click(); }); await settle(4); };
const iconButton = (icon, index = 0) => [...document.querySelectorAll(`svg.lucide-${icon}`)].map(s => s.closest('button')).filter(Boolean)[index];
const modal = () => [...document.querySelectorAll('[data-modal-open="true"]')].pop();
const inModal = (selector) => modal().querySelector(selector);
const modalButton = (label) => [...modal().querySelectorAll('button')].find(b => b.textContent.trim() === label);
const setInput = async (input, value) => {
  expect(input, 'champ à remplir').toBeTruthy();
  const prototype = input instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, value);
    input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
};
const submit = async () => {
  await act(async () => { modal().querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
  await settle();
};
const ops = () => mock.log.ops.map(o => (o.table === 'rpc' ? o.op : `${o.table}.${o.op}`));
const rpc = (name) => mock.log.ops.find(o => o.op === name)?.payload;
const rowOp = (table, op) => mock.log.ops.find(o => o.table === table && o.op === op);

describe('récurrences', () => {
  beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); });
  afterAll(async () => {
    if (root) await act(async () => { root.unmount(); });
    vi.useRealTimers();
  });

  describe('ajout', () => {
    it('sans répétition : une ligne ordinaire, sans aucun champ de récurrence', async () => {
      await start('/expenses');
      await click(iconButton('plus'));
      await setInput(inModal('input[type="number"]'), '45');
      await setInput(inModal('input[type="text"]'), 'Plombier');
      await submit();

      expect(ops()).toEqual(['expenses.insert']);
      const row = rowOp('expenses', 'insert').payload[0];
      for (const field of ['repeat', 'repeat_end', 'scope', 'is_recurrent', 'recurrence']) expect(row).not.toHaveProperty(field);
    });

    it('avec un rythme et une fin : une règle, et aucune ligne écrite directement', async () => {
      await start('/expenses');
      await click(iconButton('plus'));
      await setInput(inModal('input[type="number"]'), '300');
      await setInput(inModal('input[type="text"]'), 'Assurance');
      await setInput(inModal('input[type="date"]'), '2026-10-31');
      // Le mois de fin n'est proposé qu'une fois un rythme choisi
      expect(inModal('input[type="month"]')).toBeNull();
      await setInput(inModal('select'), '3');
      expect(inModal('input[type="month"]').min).toBe('2026-10');
      await setInput(inModal('input[type="month"]'), '2027-06');
      await submit();

      expect(ops()).toEqual(['create_recurrence']);
      expect(rpc('create_recurrence')).toMatchObject({
        dash_id: 'd1', rule_kind: 'expense', first_month: '2026-10-01', existing_row: null,
        rule_name: 'Assurance', rule_amount: 300, rule_day: 31, rule_interval: 3, last_month: '2027-06-01',
      });
    });

    it('enveloppe « chaque mois » : une règle mensuelle sans fin', async () => {
      await start('/envelopes');
      await click(iconButton('plus'));
      await setInput(inModal('input[type="number"]'), '120');
      await setInput(inModal('input[type="text"]'), 'Animaux');
      await click([...modal().querySelectorAll('label')].find(l => l.textContent === 'Reporter chaque mois').closest('div[style*="cursor: pointer"]'));
      await submit();

      expect(ops()).toEqual(['create_recurrence']);
      expect(rpc('create_recurrence')).toMatchObject({
        rule_kind: 'envelope', first_month: '2026-10-01', rule_amount: 120, rule_interval: 1, last_month: null,
      });
    });
  });

  describe('modification d\'un élément récurrent', () => {
    it('propose « ce mois uniquement » par défaut : seule la ligne change, la règle est intacte', async () => {
      await start('/incomes');
      await click(iconButton('pencil', 0)); // Salaire, récurrent
      expect(modalButton('Ce mois uniquement').getAttribute('aria-checked')).toBe('true');
      // Les réglages de la règle ne sont pas affichés tant qu'on ne modifie que ce mois
      expect(inModal('select')).toBeNull();
      await setInput(inModal('input[type="number"]'), '1400');
      await submit();

      expect(ops()).toEqual(['incomes.update']);
      const { payload, filters } = rowOp('incomes', 'update');
      expect(filters).toEqual(['id=inc1']);
      expect(payload.amount).toBe(1400);
      for (const field of ['repeat', 'repeat_end', 'scope', 'is_recurrent']) expect(payload).not.toHaveProperty(field);
    });

    it('« ce mois et les suivants » : la règle change à partir de ce mois, en une seule opération', async () => {
      await start('/incomes');
      await click(iconButton('pencil', 0));
      await click(modalButton('Ce mois et les suivants'));
      expect(inModal('select').value).toBe('1');
      await setInput(inModal('input[type="number"]'), '1450');
      await submit();

      expect(ops()).toEqual(['update_recurrence_from']);
      expect(rpc('update_recurrence_from')).toMatchObject({
        rule_id: 'rule-inc1', from_month: '2026-10-01', rule_name: 'Salaire', rule_amount: 1450, rule_day: 6, rule_interval: 1, last_month: null,
      });
    });

    it('affiche le rythme et la fin de la règle existante', async () => {
      await start('/expenses');
      await click(iconButton('pencil', 2)); // Essence : tous les 3 mois, jusqu'en juillet 2027
      await click(modalButton('Ce mois et les suivants'));
      expect(inModal('select').value).toBe('3');
      expect(inModal('input[type="month"]').value).toBe('2027-07');
    });

    it('« ce mois et les suivants » avec « Jamais » : la ligne du mois est gardée, la règle s\'arrête au mois suivant', async () => {
      await start('/incomes');
      await click(iconButton('pencil', 0));
      await click(modalButton('Ce mois et les suivants'));
      await setInput(inModal('select'), '0');
      await submit();

      expect(ops()).toEqual(['incomes.update', 'stop_recurrence']);
      expect(rpc('stop_recurrence')).toEqual({ rule_id: 'rule-inc1', from_month: '2026-11-01' });
    });

    it('refuse une fin antérieure au mois modifié, sans rien envoyer', async () => {
      await start('/incomes');
      await click(iconButton('pencil', 0));
      await click(modalButton('Ce mois et les suivants'));
      await setInput(inModal('input[type="month"]'), '2026-08');
      await submit();

      expect(ops()).toEqual([]);
      expect(document.body.textContent).toContain('La fin de la répétition ne peut pas précéder ce mois.');
    });
  });

  describe('une ligne ordinaire devient récurrente', () => {
    it('la ligne est modifiée puis rattachée à une nouvelle règle, comme première occurrence', async () => {
      await start('/incomes');
      await click(iconButton('pencil', 1)); // Vente, ligne ordinaire
      // Pas de choix de portée sur une ligne qui n'a pas de règle
      expect(modalButton('Ce mois uniquement')).toBeUndefined();
      await setInput(inModal('select'), '1');
      await submit();

      expect(ops()).toEqual(['incomes.update', 'create_recurrence']);
      expect(rpc('create_recurrence')).toMatchObject({
        rule_kind: 'income', first_month: '2026-10-01', existing_row: 'inc2', rule_name: 'Vente', rule_day: 12, rule_interval: 1,
      });
    });
  });

  describe('suppression d\'un élément récurrent', () => {
    it('« Arrêter la récurrence » arrête la règle à partir de ce mois, sans supprimer la ligne directement', async () => {
      await start('/incomes');
      await click(iconButton('trash-2', 0));
      await click(modalButton('Arrêter la récurrence'));
      await settle();

      expect(ops()).toEqual(['stop_recurrence']);
      expect(rpc('stop_recurrence')).toEqual({ rule_id: 'rule-inc1', from_month: '2026-10-01' });
      expect(document.body.textContent).toContain('Récurrence arrêtée');
    });

    it('« Supprimer ce mois uniquement » masque la ligne et ne touche pas à la règle', async () => {
      await start('/incomes');
      await click(iconButton('trash-2', 0));
      await click(modalButton('Supprimer ce mois uniquement'));
      await settle();

      expect(ops()).toEqual(['incomes.update']);
      expect(rowOp('incomes', 'update').payload).toEqual({ is_hidden: true });
    });

    it('une ligne ordinaire est simplement supprimée', async () => {
      await start('/incomes');
      await click(iconButton('trash-2', 1));
      await click(modalButton('Supprimer'));
      await settle();

      expect(ops()).toEqual(['incomes.delete']);
    });
  });
});
