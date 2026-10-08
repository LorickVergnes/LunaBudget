import { describe, it, expect } from 'vitest';
import { parseAuthLink } from './authLink';
import { translateAuthError } from './authErrors';

describe('parseAuthLink', () => {
  it('reconnaît un lien de réinitialisation de mot de passe', () => {
    expect(parseAuthLink('#access_token=abc&expires_in=3600&refresh_token=def&token_type=bearer&type=recovery'))
      .toEqual({ isRecovery: true, hasError: false });
  });

  it('reconnaît un lien expiré', () => {
    expect(parseAuthLink('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'))
      .toEqual({ isRecovery: false, hasError: true });
  });

  it('lit aussi les paramètres de la query string', () => {
    expect(parseAuthLink('', '?error=access_denied&error_code=otp_expired').hasError).toBe(true);
    expect(parseAuthLink('#/login', '?type=recovery').isRecovery).toBe(true);
  });

  it('ignore les routes normales de l\'application', () => {
    expect(parseAuthLink('#/incomes')).toEqual({ isRecovery: false, hasError: false });
    expect(parseAuthLink('#/savings/abc')).toEqual({ isRecovery: false, hasError: false });
    expect(parseAuthLink('')).toEqual({ isRecovery: false, hasError: false });
    // Lien de confirmation d'inscription : ce n'est pas une réinitialisation
    expect(parseAuthLink('#access_token=abc&type=signup').isRecovery).toBe(false);
  });
});

describe('translateAuthError', () => {
  it('traduit les erreurs connues par leur code', () => {
    expect(translateAuthError({ code: 'same_password', message: 'x' })).toMatch(/différent de l'ancien/);
    expect(translateAuthError({ code: 'over_email_send_rate_limit', message: 'x' })).toMatch(/Trop de demandes/);
    expect(translateAuthError({ code: 'otp_expired', message: 'x' })).toMatch(/invalide ou a expiré/);
  });

  it('traduit les erreurs connues par leur message', () => {
    expect(translateAuthError({ message: 'New password should be different from the old password.' })).toMatch(/différent de l'ancien/);
    expect(translateAuthError({ message: 'For security purposes, you can only request this after 42 seconds.' })).toMatch(/Trop de demandes/);
    expect(translateAuthError({ message: 'Auth session missing!' })).toMatch(/invalide ou a expiré/);
    expect(translateAuthError({ message: 'Password should be at least 6 characters.' })).toMatch(/trop faible/);
  });

  it('garde le message d\'origine pour une erreur inconnue', () => {
    expect(translateAuthError({ message: 'Something odd' })).toBe('Something odd');
    expect(translateAuthError({})).toBe('Une erreur est survenue. Réessayez.');
    expect(translateAuthError(null)).toBeNull();
  });
});
