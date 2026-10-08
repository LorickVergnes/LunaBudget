import React from 'react';
import { Link } from 'react-router-dom';
import { Loader2, ArrowRight, CheckCircle2 } from 'lucide-react';

const pageStyle = { minHeight: '100vh', background: 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 20px' };

// Cadre des pages d'authentification : logo, titre, carte du formulaire et lien de bas de page
export const AuthShell = ({ icon: Icon, title, subtitle, footer, children }) => (
  <div style={pageStyle}>
    <div style={{ width: '100%', maxWidth: 400 }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, background: 'linear-gradient(135deg,#A0D2EB,#E5BA73)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', boxShadow: '0 8px 24px rgba(160,210,235,.35)' }}>
          <Icon size={30} color="white" />
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#4A6984', marginBottom: 6 }}>{title}</h1>
        <p style={{ fontSize: 14, color: '#B0B8C9', fontWeight: 500 }}>{subtitle}</p>
      </div>

      <div className="card" style={{ padding: 24 }}>
        {children}
      </div>

      {footer && (
        <p style={{ textAlign: 'center', fontSize: 14, color: '#B0B8C9', fontWeight: 500, marginTop: 20 }}>
          {footer}
        </p>
      )}
    </div>
  </div>
);

// Lien dans le texte de bas de page
export const AuthLink = ({ to, children }) => (
  <Link to={to} style={{ color: '#A0D2EB', fontWeight: 700, textDecoration: 'none' }}>{children}</Link>
);

// Bandeau d'erreur au-dessus du formulaire
export const AuthError = ({ children }) => children ? (
  <div style={{ background: '#FFF0F0', border: '1px solid #FFCDD2', borderRadius: 10, padding: '12px 14px', marginBottom: 16, fontSize: 13, fontWeight: 600, color: '#ef4444' }}>
    {children}
  </div>
) : null;

// Champ avec libellé et icône ; les autres props vont à l'<input>
export const AuthField = ({ label, icon: Icon, value, onChange, ...inputProps }) => (
  <div>
    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#B0B8C9', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</label>
    <div style={{ position: 'relative' }}>
      <Icon size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#B0B8C9' }} />
      <input {...inputProps} className="field" style={{ paddingLeft: 42 }}
        value={value} onChange={onChange} />
    </div>
  </div>
);

// Bouton principal du formulaire
export const AuthSubmit = ({ loading, children }) => (
  <button type="submit" disabled={loading}
    style={{ background: 'linear-gradient(135deg,#A0D2EB,#E5BA73)', color: 'white', border: 'none', borderRadius: 14, padding: '15px', fontSize: 15, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 6px 20px rgba(160,210,235,.4)', marginTop: 4 }}>
    {loading ? <Loader2 size={20} className="animate-spin-smooth" /> : <><span>{children}</span><ArrowRight size={18} /></>}
  </button>
);

// Écran de confirmation (« Vérifiez vos emails »), avec retour à la connexion
export const AuthNotice = ({ title, children }) => (
  <div style={pageStyle}>
    <div className="card" style={{ width: '100%', maxWidth: 440, padding: 32, textAlign: 'center' }}>
      <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#22c55e15', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
        <CheckCircle2 size={40} color="#22c55e" />
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 900, color: '#4A6984', marginBottom: 16 }}>{title}</h1>
      <p style={{ fontSize: 14, color: '#555', fontWeight: 500, lineHeight: 1.6, marginBottom: 28 }}>
        {children}
      </p>
      <Link to="/login" style={{ color: '#A0D2EB', fontWeight: 700, textDecoration: 'none', background: '#A0D2EB15', padding: '12px 24px', borderRadius: 99, display: 'inline-block' }}>
        Retourner à la connexion
      </Link>
    </div>
  </div>
);
