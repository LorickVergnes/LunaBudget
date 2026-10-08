// @vitest-environment jsdom
/**
 * Partage d'un budget : invitations (envoi, réponse) et rôles (propriétaire, éditeur, lecteur).
 * L'interface n'est qu'un confort : les droits réels sont appliqués par la base.
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

let root = null;
const settle = async (rounds = 6) => {
  for (let i = 0; i < rounds; i++) await act(async () => { await new Promise(r => setTimeout(r, 15)); });
};

// `prepare` règle le faux Supabase (rôle, invitations) avant le démarrage de l'application
const start = async (path, { width = 1280, prepare } = {}) => {
  if (root) await act(async () => { root.unmount(); });
  mock.resetMock();
  resetOwnChanges();
  prepare?.();
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
const icons = (name) => document.querySelectorAll(`svg.lucide-${name}`).length;
const click = async (el) => { expect(el, 'élément à cliquer').toBeTruthy(); await act(async () => { el.click(); }); await settle(4); };
const buttonWithText = (label) => [...document.querySelectorAll('button')].find(b => b.textContent.trim().includes(label));
const setInput = async (el, value, eventName = 'input') => {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event(eventName, { bubbles: true }));
  });
};
const ops = (table) => mock.log.ops.filter(o => o.table === table);

// Ouvre Paramètres du budget > onglet Membres
const openMembers = async () => {
  await click(buttonWithText('Mon Budget'));
  await click(document.querySelector('button[title="Paramètres"]'));
  await click(buttonWithText('Membres'));
};

describe('rôles', () => {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 15, 10, 0, 0));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });
  afterAll(async () => {
    if (root) await act(async () => { root.unmount(); });
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const PAGES = [['/incomes', 'Historique des revenus'], ['/envelopes', 'Courses'], ['/savings', 'Voyage'], ['/envelopes/env1', 'Carrefour'], ['/savings/sav1', 'Versement']];

  for (const width of [1280, 400]) {
    for (const [path, marker] of PAGES) {
      it(`lecteur : ${path} en ${width}px se consulte sans aucun bouton d'édition`, async () => {
        await start(path, { width, prepare: () => mock.setMockRole('viewer') });
        expect(text()).toContain(marker);
        expect(icons('pencil')).toBe(0);
        expect(icons('trash-2')).toBe(0);
        expect(icons('plus')).toBe(0);
      });

      it(`éditeur : ${path} en ${width}px garde ses boutons d'édition`, async () => {
        await start(path, { width, prepare: () => mock.setMockRole('editor') });
        expect(icons('pencil')).toBeGreaterThan(0);
        expect(icons('trash-2')).toBeGreaterThan(0);
        expect(icons('plus')).toBeGreaterThan(0);
      });
    }
  }

  it('lecteur : l\'épargne propose de voir les versements, et le budget est signalé en lecture seule', async () => {
    await start('/savings', { prepare: () => mock.setMockRole('viewer') });
    expect(text()).toContain('Voir les versements');
    expect(text()).not.toContain('Alimenter');
    expect(document.querySelector('[aria-label="Lecture seule"]')).toBeTruthy();
  });

  it('propriétaire : aucun signalement de lecture seule', async () => {
    await start('/savings');
    expect(text()).toContain('Alimenter');
    expect(document.querySelector('[aria-label="Lecture seule"]')).toBeNull();
  });
});

describe('invitations envoyées par le propriétaire', () => {
  beforeAll(() => { vi.spyOn(window, 'confirm').mockReturnValue(true); });
  afterAll(() => { vi.restoreAllMocks(); });

  it('crée une invitation en attente, avec le rôle choisi et l\'email en minuscules', async () => {
    await start('/');
    await openMembers();
    await setInput(document.querySelector('[data-modal-open="true"] input[type="email"]'), '  Camille@Test.FR ');
    await setInput(document.querySelector('select[aria-label="Rôle de l\'invité"]'), 'viewer', 'change');
    await act(async () => { document.querySelector('[data-modal-open="true"] form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    await settle();

    expect(ops('dashboard_invitations')).toEqual([{
      table: 'dashboard_invitations', op: 'insert', filters: [],
      payload: [{ dashboard_id: 'd1', email: 'camille@test.fr', invited_by: 'u1', role: 'viewer' }],
    }]);
    expect(text()).toContain('Invitation enregistrée');
    // Plus aucun ajout direct de membre, ni recherche de compte par email
    expect(ops('dashboard_members')).toEqual([]);
    expect(mock.log.reads.some(r => r.includes('get_user_id_by_email'))).toBe(false);
  });

  it('refuse d\'inviter quelqu\'un qui est déjà membre', async () => {
    await start('/');
    await openMembers();
    await setInput(document.querySelector('[data-modal-open="true"] input[type="email"]'), 'alex@test.fr');
    await act(async () => { document.querySelector('[data-modal-open="true"] form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    await settle();

    expect(text()).toContain('déjà membre');
    expect(ops('dashboard_invitations')).toEqual([]);
  });

  it('liste les invitations en attente et permet d\'en annuler une', async () => {
    await start('/', { prepare: () => mock.setMockSentInvitations([{ id: 'inv9', email: 'camille@test.fr', role: 'viewer', created_at: '2026-10-10T08:00:00+00:00' }]) });
    await openMembers();
    expect(text()).toContain('Invitations en attente (1)');
    expect(text()).toContain('camille@test.fr');
    expect(text()).toContain('Lecteur • en attente de réponse');

    await click(document.querySelector('button[title="Annuler l\'invitation"]'));
    expect(ops('dashboard_invitations')).toEqual([{ table: 'dashboard_invitations', op: 'delete', filters: ['id=inv9'] }]);
  });

  it('change le rôle d\'un membre et peut le retirer', async () => {
    await start('/');
    await openMembers();
    await setInput(document.querySelector('select[aria-label="Rôle de Alex"]'), 'viewer', 'change');
    await settle();
    expect(ops('dashboard_members')).toEqual([{ table: 'dashboard_members', op: 'update', payload: { role: 'viewer' }, filters: ['dashboard_id=d1', 'user_id=u2'] }]);

    await click(document.querySelector('button[title="Retirer"]'));
    expect(ops('dashboard_members')[1]).toEqual({ table: 'dashboard_members', op: 'delete', filters: ['dashboard_id=d1', 'user_id=u2'] });
  });

  it('un membre invité ne peut ni inviter ni gérer les rôles, mais peut quitter le budget', async () => {
    await start('/', { prepare: () => mock.setMockRole('editor') });
    await openMembers();
    expect(document.querySelector('[data-modal-open="true"] input[type="email"]')).toBeNull();
    expect(document.querySelector('[data-modal-open="true"] select')).toBeNull();
    expect(document.querySelector('button[title="Retirer"]')).toBeNull();

    await click(buttonWithText('Général'));
    await click(buttonWithText('Quitter ce tableau de bord'));
    expect(ops('dashboard_members')).toEqual([{ table: 'dashboard_members', op: 'delete', filters: ['dashboard_id=d1', 'user_id=u1'] }]);
  });
});

describe('invitations reçues', () => {
  const invitation = { id: 'inv1', dashboard_id: 'd2', dashboard_name: 'Budget famille', invited_by_name: 'Alex', role: 'viewer', created_at: '2026-10-10T08:00:00+00:00' };

  it('rien ne s\'affiche quand il n\'y a pas d\'invitation', async () => {
    await start('/');
    expect(text()).not.toContain('Invitations reçues');
    expect(document.querySelector('[aria-label="Invitations en attente"]')).toBeNull();
  });

  it('propose l\'invitation dès la connexion, avec le budget, l\'invitant et le rôle', async () => {
    await start('/', { prepare: () => mock.setMockMyInvitations([invitation]) });
    expect(text()).toContain('Invitations reçues');
    expect(text()).toContain('Budget famille');
    expect(text()).toContain('Alex vous invite à rejoindre ce budget en tant que lecteur');
    expect(ops('rpc')).toEqual([]);
  });

  it('accepter rejoint le budget', async () => {
    await start('/', { prepare: () => mock.setMockMyInvitations([invitation]) });
    await click(buttonWithText('Accepter'));
    expect(ops('rpc')).toEqual([{ table: 'rpc', op: 'accept_invitation', payload: { invitation_id: 'inv1' }, filters: [] }]);
    expect(text()).toContain('Vous avez rejoint « Budget famille »');
    expect(text()).not.toContain('Invitations reçues');
  });

  it('refuser fait disparaître l\'invitation sans rien rejoindre', async () => {
    await start('/', { prepare: () => mock.setMockMyInvitations([invitation]) });
    await click(buttonWithText('Refuser'));
    expect(ops('rpc')).toEqual([{ table: 'rpc', op: 'decline_invitation', payload: { invitation_id: 'inv1' }, filters: [] }]);
    expect(text()).toContain('Invitation refusée');
    expect(text()).not.toContain('Invitations reçues');
  });

  it('une invitation ignorée reste accessible depuis le sélecteur de budgets', async () => {
    await start('/', { prepare: () => mock.setMockMyInvitations([invitation]) });
    // Fermeture de la fenêtre sans répondre
    await click(document.querySelector('[data-modal-open="true"] button'));
    await settle(30);
    expect(document.querySelector('[aria-label="Invitations en attente"]')).toBeTruthy();

    await click(buttonWithText('Mon Budget'));
    await click(buttonWithText('1 invitation reçue'));
    expect(text()).toContain('Alex vous invite à rejoindre ce budget');
  });
});
