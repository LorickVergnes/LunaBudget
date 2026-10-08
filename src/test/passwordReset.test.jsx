// @vitest-environment jsdom
/**
 * Mot de passe oublié : demande du lien par email, puis choix du nouveau mot de passe
 * au retour du lien.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import * as mock from './supabaseMock';
import { readAuthLinkFromUrl } from '../lib/authLink';
import App from '../App';

vi.mock('../lib/supabaseClient', async () => ({ supabase: (await import('./supabaseMock')).supabase }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
vi.setConfig({ testTimeout: 30_000 });

let root = null;

const settle = async (rounds = 6) => {
  for (let i = 0; i < rounds; i++) await act(async () => { await new Promise(r => setTimeout(r, 15)); });
};

// Démarre l'application sur une URL donnée, comme le ferait un chargement de page :
// le lien reçu par email est lu une seule fois, au démarrage.
const start = async (hash, { loggedOut = true } = {}) => {
  window.location.hash = hash;
  window.innerWidth = 1280;
  localStorage.clear();
  readAuthLinkFromUrl();
  mock.resetMock();
  if (loggedOut) mock.setMockSession(null);
  document.body.innerHTML = '<div id="root"></div>';
  root = createRoot(document.getElementById('root'));
  await act(async () => { root.render(<App />); });
  await settle();
};

afterEach(async () => {
  if (root) await act(async () => { root.unmount(); });
  root = null;
});

const text = () => document.body.textContent;
const inputs = () => [...document.querySelectorAll('form input')];
const type = async (input, value) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const submit = async () => {
  await act(async () => { document.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
  await settle();
};
const clickLink = async (label) => {
  const link = [...document.querySelectorAll('a')].find(a => a.textContent.includes(label));
  expect(link, `lien « ${label} »`).toBeTruthy();
  await act(async () => { link.click(); });
  await settle(3);
};
const authCalls = (op) => mock.log.ops.filter(o => o.table === 'auth' && o.op === op);

describe('connexion', () => {
  it('mauvais identifiants : message en français, sans dire lequel des deux est faux', async () => {
    await start('#/login');
    mock.failNextAuthCall({ code: 'invalid_credentials', message: 'Invalid login credentials' });
    await type(inputs()[0], 'lorick@test.fr');
    await type(inputs()[1], 'mauvais-mot-de-passe');
    await submit();

    expect(text()).toContain('Email ou mot de passe incorrect.');
    expect(text()).not.toContain('Invalid login credentials');
    expect(window.location.hash).toBe('#/login');
  });
});

describe('demande du lien de réinitialisation', () => {
  it('la page de connexion mène à « Mot de passe oublié »', async () => {
    await start('#/login');
    await clickLink('Mot de passe oublié');
    expect(window.location.hash).toBe('#/forgot-password');
    expect(text()).toContain('Recevez un lien pour en choisir un nouveau');
  });

  it('envoie la demande à Supabase avec l\'adresse de retour de l\'application', async () => {
    await start('#/forgot-password');
    await type(inputs()[0], 'lorick@test.fr');
    await submit();

    expect(authCalls('resetPasswordForEmail')).toEqual([{
      table: 'auth', op: 'resetPasswordForEmail', filters: [],
      payload: { email: 'lorick@test.fr', redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}` },
    }]);
    expect(text()).toContain('Vérifiez vos emails');
    expect(text()).toContain('Si un compte existe pour lorick@test.fr');
  });

  it('explique un refus pour trop de demandes, sans quitter le formulaire', async () => {
    await start('#/forgot-password');
    mock.failNextAuthCall({ code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' });
    await type(inputs()[0], 'lorick@test.fr');
    await submit();

    expect(text()).toContain('Trop de demandes');
    expect(text()).not.toContain('Vérifiez vos emails');
  });
});

describe('retour du lien reçu par email', () => {
  const RECOVERY_HASH = '#access_token=abc&expires_in=3600&refresh_token=def&token_type=bearer&type=recovery';

  it('demande le nouveau mot de passe avant d\'afficher l\'application', async () => {
    // Supabase a ouvert une session à partir du lien
    await start(RECOVERY_HASH, { loggedOut: false });
    expect(text()).toContain('Nouveau mot de passe');
    expect(text()).toContain('Pour le compte lorick@test.fr');
    expect(text()).not.toContain('Reste à vivre');
  });

  it('refuse deux mots de passe différents sans rien envoyer', async () => {
    await start(RECOVERY_HASH, { loggedOut: false });
    await type(inputs()[0], 'nouveau-secret');
    await type(inputs()[1], 'autre-chose');
    await submit();

    expect(text()).toContain('Les deux mots de passe ne sont pas identiques');
    expect(authCalls('updateUser')).toEqual([]);
  });

  it('refuse un mot de passe trop court sans rien envoyer', async () => {
    await start(RECOVERY_HASH, { loggedOut: false });
    await type(inputs()[0], 'abc');
    await type(inputs()[1], 'abc');
    await submit();

    expect(text()).toContain('au moins 6 caractères');
    expect(authCalls('updateUser')).toEqual([]);
  });

  it('enregistre le nouveau mot de passe puis ouvre l\'application', async () => {
    await start(RECOVERY_HASH, { loggedOut: false });
    await type(inputs()[0], 'nouveau-secret');
    await type(inputs()[1], 'nouveau-secret');
    await submit();

    expect(authCalls('updateUser')).toEqual([{ table: 'auth', op: 'updateUser', filters: [], payload: { password: 'nouveau-secret' } }]);
    expect(text()).toContain('Mot de passe mis à jour');
    expect(text()).toContain('Reste à vivre');
    expect(text()).not.toContain('Nouveau mot de passe');
  });

  it('affiche l\'erreur de Supabase et reste sur le formulaire', async () => {
    await start(RECOVERY_HASH, { loggedOut: false });
    mock.failNextAuthCall({ code: 'same_password', message: 'New password should be different from the old password.' });
    await type(inputs()[0], 'nouveau-secret');
    await type(inputs()[1], 'nouveau-secret');
    await submit();

    expect(text()).toContain("différent de l'ancien");
    expect(text()).toContain('Nouveau mot de passe');
  });

  it('réagit aussi à l\'événement PASSWORD_RECOVERY envoyé par Supabase', async () => {
    await start('#/', { loggedOut: false });
    expect(text()).toContain('Reste à vivre');
    await act(async () => { await mock.emitAuth('PASSWORD_RECOVERY'); });
    await settle(3);
    expect(text()).toContain('Nouveau mot de passe');
  });

  it('lien sans session : propose de redemander un lien', async () => {
    await start(RECOVERY_HASH, { loggedOut: true });
    expect(text()).toContain('Lien expiré');
    await submit();
    expect(window.location.hash).toBe('#/forgot-password');
    expect(text()).toContain('Recevez un lien pour en choisir un nouveau');
  });

  it('lien expiré : retour à la connexion avec une explication', async () => {
    await start('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
    expect(window.location.hash).toBe('#/login');
    expect(text()).toContain('Ce lien est invalide ou a expiré');
  });
});
