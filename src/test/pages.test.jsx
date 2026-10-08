// @vitest-environment jsdom
/**
 * Test de rendu de toutes les pages, en desktop et en mobile, avec un faux Supabase.
 * Il parcourt les parcours principaux (ouvrir, ajouter, modifier, supprimer, temps réel)
 * et vérifie que rien ne plante.
 *
 * Avec la variable GOLDEN_OUT=<fichier>, il écrit aussi le rendu HTML et les écritures
 * en base de chaque étape : comparer deux fichiers permet de vérifier qu'une refonte
 * ne change ni l'affichage ni les données envoyées.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { log, emitRealtime, listenedTables, resetMock, DATA, USER, OTHER_USER_ID, DASHBOARD_ID } from './supabaseMock';
import { resetOwnChanges } from '../lib/ownChanges';
import App from '../App';

vi.mock('../lib/supabaseClient', async () => ({ supabase: (await import('./supabaseMock')).supabase }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// Chaque parcours monte plusieurs fois l'application : on laisse de la marge sur une machine chargée
vi.setConfig({ testTimeout: 30_000 });

const ROUTES = [
  ['dashboard', '/'], ['incomes', '/incomes'], ['expenses', '/expenses'],
  ['envelopes', '/envelopes'], ['envelope-detail', '/envelopes/env1'],
  ['savings', '/savings'], ['saving-detail', '/savings/sav1'],
  ['global', '/global'], ['account', '/account'],
];
const VIEWPORTS = [['desktop', 1280], ['mobile', 400]];

const results = {};
const consoleErrors = [];
let root = null;

const settle = async (rounds = 6) => {
  for (let i = 0; i < rounds; i++) await act(async () => { await new Promise(r => setTimeout(r, 15)); });
};

const mount = async (path, width) => {
  if (root) await act(async () => { root.unmount(); });
  resetMock();
  resetOwnChanges();
  localStorage.clear();
  window.innerWidth = width;
  window.location.hash = '#' + path;
  document.body.innerHTML = '<div id="root"></div>';
  root = createRoot(document.getElementById('root'));
  await act(async () => { root.render(<App />); });
  await settle();
};

const html = () => document.body.innerHTML.replace(/></g, '>\n<');
const toasts = () => [...document.querySelectorAll('.toast-message')].map(t => t.textContent);
const snapshot = (key, extra = {}) => {
  results[key] = { html: html(), ops: [...log.ops], reads: [...log.reads].sort(), toasts: toasts(), ...extra };
  log.ops.length = 0;
};

const click = async (el) => { await act(async () => { el.click(); }); await settle(3); };
const setValue = (input, value) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};
const buttonsWith = (iconClass) => [...document.querySelectorAll(`svg.${iconClass}`)].map(s => s.closest('button')).filter(Boolean);
const findAddButton = () => {
  const candidates = buttonsWith('lucide-plus');
  return candidates.find(b => b.style.position === 'fixed') || candidates.find(b => b.closest('.desktop-greeting-toprow')) || null;
};
const openModal = () => [...document.querySelectorAll('[data-modal-open="true"]')].pop();
const submitForm = async () => {
  const form = openModal()?.querySelector('form');
  if (!form) return false;
  await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
  await settle();
  return true;
};

describe('rendu des pages', () => {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 15, 10, 0, 0));
    vi.spyOn(console, 'error').mockImplementation((...args) => { consoleErrors.push(args.map(String).join(' ').slice(0, 300)); });
  });

  afterAll(async () => {
    if (root) await act(async () => { root.unmount(); });
    vi.useRealTimers();
    if (process.env.GOLDEN_OUT) fs.writeFileSync(process.env.GOLDEN_OUT, JSON.stringify({ results, consoleErrors }, null, 1));
  });

  for (const [vp, width] of VIEWPORTS) {
    for (const [name, path] of ROUTES) {
      const key = `${name}/${vp}`;

      it(`${key} : affichage`, async () => {
        await mount(path, width);
        snapshot(`${key}/base`, { realtimeTables: listenedTables() });
        expect(document.querySelector('.loading-container')).toBeNull();
        expect(document.body.textContent.length).toBeGreaterThan(50);
      });

      it(`${key} : ajout`, async () => {
        await mount(path, width);
        const add = findAddButton();
        if (!add) return;
        await click(add);
        snapshot(`${key}/add-open`);
        const form = openModal().querySelector('form');
        expect(form).not.toBeNull();
        // Coche "récurrent" si le formulaire le propose (fait apparaître la date de fin sur l'épargne)
        const recurrentLabel = [...form.querySelectorAll('label')].find(l => /mois|récurrent/i.test(l.textContent));
        const recurrentCard = recurrentLabel?.closest('div[style*="cursor: pointer"]');
        if (recurrentCard) await click(recurrentCard);
        await act(async () => {
          openModal().querySelectorAll('form input').forEach(input => {
            if (input.type === 'number') setValue(input, '123.456');
            else if (input.type === 'text') setValue(input, 'Test rendu');
            else if (input.type === 'month') setValue(input, '2027-03');
            else if (input.type === 'date') setValue(input, '2026-10-18');
          });
        });
        await settle(2);
        snapshot(`${key}/add-filled`);
        await submitForm();
        snapshot(`${key}/add-submitted`);
        expect(results[`${key}/add-submitted`].ops.some(o => o.op === 'insert')).toBe(true);
      });

      it(`${key} : modification`, async () => {
        await mount(path, width);
        const edit = buttonsWith('lucide-pencil')[0];
        if (!edit) return;
        await click(edit);
        snapshot(`${key}/edit-open`);
        await submitForm();
        snapshot(`${key}/edit-submitted`);
        expect(results[`${key}/edit-submitted`].ops.some(o => o.op === 'update')).toBe(true);
      });

      it(`${key} : suppression`, async () => {
        await mount(path, width);
        const count = buttonsWith('lucide-trash-2').length;
        if (!count) return;
        // Chaque élément × chaque bouton de la modale de confirmation
        for (let index = 0; index < Math.min(count, 2); index++) {
          for (const label of [/Supprimer ce mois uniquement/, /Arrêter la récurrence|^Supprimer$/]) {
            await mount(path, width);
            await click(buttonsWith('lucide-trash-2')[index]);
            const modal = openModal();
            expect(modal).toBeTruthy();
            const tag = `${key}/delete-${index}-${label.source.slice(0, 12)}`;
            snapshot(`${tag}-open`);
            const confirm = [...modal.querySelectorAll('button')].find(b => label.test(b.textContent.trim()));
            if (!confirm) continue;
            await click(confirm);
            await settle();
            snapshot(`${tag}-done`);
            expect(results[`${tag}-done`].ops.length).toBe(1);
          }
        }
      });

      it(`${key} : temps réel`, async () => {
        await mount(path, width);
        const tables = listenedTables();
        if (!tables.length) return;
        // Laisse passer la fenêtre pendant laquelle les copies de récurrence sont considérées comme les nôtres
        vi.setSystemTime(new Date(Date.now() + 6000));
        for (const table of tables) {
          // Les objectifs d'épargne n'appartiennent à aucun mois : on prend alors le premier
          const existing = DATA[table].find(r => r.month_date === '2026-10-01') ?? DATA[table][0];
          const fresh = { ...existing, id: 'rt1', name: 'Depuis un autre' };
          const events = [
            ['insert-autre', 'INSERT', { ...fresh, user_id: OTHER_USER_ID }, null],
            ['insert-moi', 'INSERT', { ...fresh, user_id: USER.id }, null],
            ['update-autre', 'UPDATE', { ...existing, user_id: OTHER_USER_ID }, { id: existing.id }],
            ['delete-autre', 'DELETE', null, { id: existing.id }],
            ['autre-mois', 'INSERT', { ...fresh, user_id: OTHER_USER_ID, month_date: '2026-08-01' }, null],
            ['autre-parent', 'INSERT', { ...fresh, user_id: OTHER_USER_ID, envelope_id: 'zz', saving_id: 'zz' }, null],
          ];
          for (const [label, type, newRecord, oldRecord] of events) {
            log.reads.length = 0;
            const before = toasts().length;
            await act(async () => { emitRealtime(table, type, newRecord, oldRecord); });
            await settle(3);
            results[`${key}/realtime-${table}-${label}`] = { newToasts: toasts().slice(before), refetched: log.reads.length > 0, path: window.location.hash };
          }
        }
        expect(DASHBOARD_ID).toBeTruthy();
      });
    }
  }

  it('aucune erreur React pendant les parcours', () => {
    expect(consoleErrors).toEqual([]);
  });
});
