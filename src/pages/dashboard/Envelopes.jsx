import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { useMonth } from '../../contexts/MonthContext';
import { formatMonthDate } from '../../lib/dateUtils';
import { Plus, Check, Loader2, Trash2, ChevronRight, RotateCw, Info, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { recurrenceService } from '../../services/recurrenceService';
import BottomNav from '../../components/layout/BottomNav';
import MonthSelector from '../../components/layout/MonthSelector';
import TopBar from '../../components/layout/TopBar';
import BottomModal from '../../components/ui/BottomModal';
import { FormCard, AmountInput } from '../../components/ui/FormUI';
import IconSelector from '../../components/ui/IconSelector';
import { getIconComponent } from '../../lib/iconRegistry';
const COLORS = ['#5C6EFF', '#22c55e', '#F9A825', '#ef4444', '#9B5CFF', '#06b6d4', '#64748b'];
const ACCENT = '#5C6EFF';

/* ── Donut ring chart ── */
const DonutChart = ({ segments, total, size = 140, centerLabel = "Total" }) => {
  const r = 52, cx = 70, cy = 70;
  const circ = 2 * Math.PI * r;
  let accumulatedPct = 0;

  return (
    <svg width={size} height={size} viewBox="0 0 140 140">
      <circle cx={cx} cy={cy} r={r} fill="none" strokeWidth={16} stroke="#EEF2FB" />
      {segments.map((seg, i) => {
        const pct = total > 0 ? seg.value / total : 0;
        const strokeDasharray = `${pct * circ} ${circ}`;
        const strokeDashoffset = -(accumulatedPct * circ);
        accumulatedPct += pct;
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            strokeWidth={16}
            stroke={seg.color}
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ transform: 'rotate(-90deg)', transformOrigin: '70px 70px', transition: 'stroke-dasharray 0.7s ease, stroke-dashoffset 0.7s ease' }}
          />
        );
      })}
      <text x="70" y="65" textAnchor="middle" style={{ fontSize: 15, fontWeight: 800, fill: '#1a1a2e', fontFamily: 'Inter' }}>
        {total.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
      </text>
      <text x="70" y="83" textAnchor="middle" style={{ fontSize: 9, fontWeight: 700, fill: '#B0B8C9', fontFamily: 'Inter', textTransform: 'uppercase', letterSpacing: 1.5 }}>
        {centerLabel}
      </text>
    </svg>
  );
};

const Envelopes = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { selectedDate, setSelectedDate } = useMonth();
  const [envelopes, setEnvelopes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', max_amount: '', icon: 'Wallet', color: ACCENT, is_recurrent: false });

  useEffect(() => { if (user) fetchData(); }, [user, selectedDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      await recurrenceService.checkAndApplyRecurrence(user.id, selectedDate);
      const { data: envs } = await supabase.from('envelopes')
        .select('*, envelope_expenses(amount)').eq('month_date', formatMonthDate(selectedDate));
      setEnvelopes((envs || []).map(env => ({
        ...env, spent: (env.envelope_expenses || []).reduce((a, c) => a + parseFloat(c.amount), 0)
      })));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleAdd = async (e) => {
    e.preventDefault(); setLoading(true);
    const data = { ...formData, max_amount: parseFloat(formData.max_amount), user_id: user.id, month_date: formatMonthDate(selectedDate) };
    if (editingId) {
      const { error } = await supabase.from('envelopes').update(data).eq('id', editingId);
      if (!error) { setFormData({ name: '', max_amount: '', icon: 'Wallet', color: ACCENT, is_recurrent: false }); setShowForm(false); setEditingId(null); fetchData(); }
      else { setLoading(false); alert(error.message); }
    } else {
      const { error } = await supabase.from('envelopes').insert([data]);
      if (!error) { setFormData({ name: '', max_amount: '', icon: 'Wallet', color: ACCENT, is_recurrent: false }); setShowForm(false); fetchData(); }
      else { setLoading(false); alert(error.message); }
    }
  };

  const openEdit = (e, env) => {
    e.stopPropagation();
    setFormData({ name: env.name, max_amount: env.max_amount.toString(), icon: env.icon || 'Wallet', color: env.color || ACCENT, is_recurrent: env.is_recurrent });
    setEditingId(env.id);
    setShowForm(true);
  };

  const del = async (e, id) => {
    e.stopPropagation();
    if (confirm('Supprimer cette enveloppe ?')) { await supabase.from('envelopes').delete().eq('id', id); fetchData(); }
  };

  const totalBudget = envelopes.reduce((a, c) => a + parseFloat(c.max_amount), 0);
  const totalSpent = envelopes.reduce((a, c) => a + c.spent, 0);
  const totalLeft = Math.max(totalBudget - totalSpent, 0);

  const donutSegments = envelopes.map(env => ({
    value: env.spent,
    color: env.color || ACCENT
  }));

  return (
    <div style={{ minHeight: '100vh', background: '#EEF2FB', paddingBottom: 76 }}>
      <TopBar title="Dépenses variables" />

      <div style={{ padding: '20px 16px', maxWidth: 480, margin: '0 auto' }}>
        <MonthSelector selectedDate={selectedDate} onDateChange={setSelectedDate} />

        {loading && !showForm ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}><Loader2 size={32} style={{ color: ACCENT }} className="animate-spin" /></div>
        ) : (
          <>
            {/* Central donut ring showing spent/remaining */}
            <div className="card fade-up" style={{ padding: '20px', marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px 24px', flexWrap: 'wrap' }}>
                <div style={{ minWidth: '100px', textAlign: 'center' }}>
                  <p style={{ fontSize: 12, color: '#B0B8C9', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Restant</p>
                  <p style={{ fontSize: 24, fontWeight: 900, color: totalLeft >= 0 ? '#22c55e' : '#ef4444', marginBottom: 2 }}>{totalLeft.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</p>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                  <DonutChart segments={donutSegments} total={totalSpent || 1} size={120} centerLabel="Dépensé" />
                </div>
                <div style={{ flex: '1 1 140px', display: 'flex', flexDirection: 'column', gap: 6, minWidth: '140px' }}>
                  {envelopes.slice(0, 3).map(env => (
                    <div key={env.id} style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: env.color || ACCENT, flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{env.name}</span>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#1a1a2e', flexShrink: 0 }}>{env.spent.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Envelope grid */}
            <div style={{ marginTop: 20 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', marginBottom: 10, paddingLeft: 4 }}>Les enveloppes</p>
              {envelopes.length === 0 ? (
                <div className="card" style={{ padding: '40px 20px', textAlign: 'center' }}><p style={{ color: '#B0B8C9', fontWeight: 600 }}>Aucune enveloppe ce mois.</p></div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {envelopes.map((env, i) => {
                    const IC = getIconComponent(env.icon);
                    const over = env.spent > env.max_amount;
                    const remaining = env.max_amount - env.spent;
                    return (
                      <div key={env.id} className="card fade-up" style={{ padding: '16px', cursor: 'pointer', animationDelay: `${i * 40}ms`, background: over ? '#FFF5F5' : 'white' }}
                        onClick={() => navigate(`/envelopes/${env.id}`, { state: { date: selectedDate, name: env.name, icon: env.icon, color: env.color } })}>
                        <div style={{ width: 44, height: 44, borderRadius: '50%', background: `${env.color || ACCENT}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                          <IC size={22} style={{ color: env.color || ACCENT }} />
                        </div>
                        <p style={{ fontSize: 14, fontWeight: 800, color: '#1a1a2e', marginBottom: 4 }}>{env.name}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: ACCENT }} />
                          <span style={{ fontSize: 11, color: '#555', fontWeight: 500 }}>Montant : {env.max_amount} €</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: over ? '#ef4444' : '#22c55e' }} />
                          <span style={{ fontSize: 11, fontWeight: 600, color: over ? '#ef4444' : '#22c55e' }}>
                            Restant : {remaining.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                          <button onClick={e => openEdit(e, env)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Pencil size={13} style={{ color: '#9CA3AF' }} />
                          </button>
                          <button onClick={e => del(e, env.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Trash2 size={13} style={{ color: '#D1D5DB' }} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {!showForm && (
        <button onClick={() => {
          setFormData({ name: '', max_amount: '', icon: 'Wallet', color: ACCENT, is_recurrent: false });
          setEditingId(null);
          setShowForm(true);
        }}
          style={{ position: 'fixed', bottom: 90, right: 20, width: 56, height: 56, borderRadius: '50%', background: '#5C6EFF', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 24px rgba(92,110,255,.5)', zIndex: 40 }}>
          <Plus size={26} color="white" />
        </button>
      )}

      {/* Modal Form */}
      <BottomModal isOpen={showForm} onClose={() => setShowForm(false)} title={editingId ? "Modifier l'enveloppe" : "Nouvelle enveloppe"}>
        <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          
          <AmountInput 
            value={formData.max_amount} 
            onChange={e => setFormData({ ...formData, max_amount: e.target.value })}
            color="#9CA3AF"
          />

          <FormCard>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', display: 'block', marginBottom: 4 }}>Nom</label>
            <input 
              type="text" 
              required 
              placeholder="Alimentation, Loisirs..." 
              value={formData.name} 
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: 15, color: '#4B5563' }} 
            />
          </FormCard>

          <FormCard style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} onClick={() => setFormData({ ...formData, is_recurrent: !formData.is_recurrent })}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', display: 'block', marginBottom: 4 }}>Reporter chaque mois</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 20, height: 20, borderRadius: 6, border: formData.is_recurrent ? 'none' : '2px solid #D1D5DB', background: formData.is_recurrent ? '#3B82F6' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {formData.is_recurrent && <Check size={14} color="white" />}
                </div>
                <span style={{ fontSize: 15, color: '#4B5563' }}>Enveloppe récurrente</span>
              </div>
            </div>
          </FormCard>

          <FormCard>
            <IconSelector 
              value={formData.icon} 
              color={formData.color} 
              onChange={val => setFormData({ ...formData, icon: val })} 
            />
          </FormCard>

          <FormCard>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', display: 'block', marginBottom: 12 }}>Couleur de l'icône</label>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => setFormData({ ...formData, color: c })}
                  style={{ width: 32, height: 32, borderRadius: '50%', background: c, border: formData.color === c ? '3px solid #1a1a2e' : 'none', cursor: 'pointer', padding: 0 }} />
              ))}
            </div>
          </FormCard>

          <button type="submit" disabled={loading}
            style={{ 
              background: '#3B82F6', color: 'white', border: 'none', borderRadius: 16, 
              padding: '16px', fontSize: 16, fontWeight: 600, cursor: 'pointer', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              boxShadow: '0 4px 14px rgba(59,130,246,0.3)', marginTop: 8 
            }}
          >
            {loading ? <Loader2 size={24} className="animate-spin" /> : editingId ? 'Enregistrer' : 'Créer l\'enveloppe'}
          </button>
        </form>
      </BottomModal>
      <BottomNav />
    </div>
  );
};
export default Envelopes;
