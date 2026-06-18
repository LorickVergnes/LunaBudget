import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { useDashboard } from '../../contexts/DashboardContext';
import { useMonth } from '../../contexts/MonthContext';
import { formatMonthDate } from '../../lib/dateUtils';
import { Plus, Check, Loader2, Trash2, ChevronRight, RotateCw, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { recurrenceService } from '../../services/recurrenceService';
import BottomNav from '../../components/layout/BottomNav';
import MonthSelector from '../../components/layout/MonthSelector';
import TopBar from '../../components/layout/TopBar';
import DesktopHeader from '../../components/layout/DesktopHeader';
import DesktopSidebar from '../../components/layout/DesktopSidebar';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import BottomModal from '../../components/ui/BottomModal';
import DeleteConfirmationModal from '../../components/ui/DeleteConfirmationModal';
import { FormCard, AmountInput } from '../../components/ui/FormUI';
import IconSelector from '../../components/ui/IconSelector';
import { getIconComponent } from '../../lib/iconRegistry';
import DonutChart from '../../components/ui/DonutChart';
import ColorPicker from '../../components/ui/ColorPicker';
import { ALL_COLORS } from '../../lib/colorUtils';
import useDesktop from '../../hooks/useDesktop';

const ACCENT = '#5C6EFF';

const fmt = (num) => num.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' €';

const ProgressLinear = ({ value, max, color, height = 6 }) => {
  const pct = Math.min((value / Math.max(max, 1)) * 100, 100);
  return (
    <div style={{ height, borderRadius: 99, background: '#EEF2FB', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, borderRadius: 99, background: color, transition: 'width .7s ease' }} />
    </div>
  );
};

const IconBubble = ({ icon, color, size = 42 }) => {
  const IC = getIconComponent(icon);
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <IC size={size * 0.45} style={{ color }} />
    </div>
  );
};

const SingleDonut = ({ value, max, size = 90, stroke = 10, color = ACCENT, trackColor = '#EEF2FB', label, sublabel }) => {
  const pct = Math.min(value / Math.max(max, 1), 1);
  const r = (size - stroke) / 2;
  const cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  const dashLength = Math.max(0, pct * circ);
  
  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" strokeWidth={stroke} stroke={trackColor} />
        <circle cx={cx} cy={cy} r={r} fill="none" strokeWidth={stroke} stroke={color} strokeDasharray={`${dashLength} ${circ}`} strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.7s ease' }} />
      </svg>
      {(label || sublabel) && (
        <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', textAlign: 'center' }}>
          {label && <span style={{ fontSize: size * 0.2, fontWeight: 900, color: '#1a1a2e', display: 'block' }}>{label}</span>}
          {sublabel && <span style={{ fontSize: size * 0.09, fontWeight: 700, color: '#B0B8C9', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>{sublabel}</span>}
        </div>
      )}
    </div>
  );
};

const Envelopes = () => {
  const { user } = useAuth();
  const { activeDashboard, loading: dashLoading } = useDashboard();
  const navigate = useNavigate();
  const { selectedDate, setSelectedDate } = useMonth();
  const isDesktop = useDesktop();
  const [envelopes, setEnvelopes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingItem, setDeletingItem] = useState(null);
  const [formData, setFormData] = useState({ name: '', max_amount: '', icon: 'Wallet', color: ACCENT, is_recurrent: false });

  useEffect(() => { 
    if (user) {
      if (activeDashboard) {
        fetchData();
      } else if (!dashLoading) {
        setLoading(false);
      }
    }
  }, [user, activeDashboard, selectedDate, dashLoading]);

  const fetchData = async () => {
    if (!activeDashboard) return;
    setLoading(true);
    try {
      await recurrenceService.checkAndApplyRecurrence(activeDashboard.id, selectedDate);
      const { data: envs } = await supabase.from('envelopes')
        .select('*, envelope_expenses(amount, date)')
        .eq('dashboard_id', activeDashboard.id)
        .eq('month_date', formatMonthDate(selectedDate))
        .eq('is_hidden', false);

      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const isPastMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1) < new Date(now.getFullYear(), now.getMonth(), 1);
      const isFutureMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1) > new Date(now.getFullYear(), now.getMonth(), 1);

      setEnvelopes((envs || []).map(env => {
        const allExpenses = env.envelope_expenses || [];
        const realExpenses = allExpenses.filter(e => {
          if (isPastMonth) return true;
          if (isFutureMonth) return false;
          return e.date <= todayStr;
        });
        return {
          ...env,
          spent: realExpenses.reduce((a, c) => a + parseFloat(c.amount), 0)
        };
      }));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleAdd = async (e) => {
    e.preventDefault(); setLoading(true);
    const roundedAmount = Math.round(parseFloat(formData.max_amount) * 100) / 100;
    const data = { 
        ...formData, 
        max_amount: roundedAmount, 
        user_id: user.id, 
        dashboard_id: activeDashboard.id,
        month_date: formatMonthDate(selectedDate) 
    };
    if (editingId) {
      const { error } = await supabase.from('envelopes').update(data).eq('id', editingId);
      if (!error) { resetForm(); fetchData(); } else { setLoading(false); alert(error.message); }
    } else {
      const { error } = await supabase.from('envelopes').insert([data]);
      if (!error) { resetForm(); fetchData(); } else { setLoading(false); alert(error.message); }
    }
  };

  const resetForm = () => {
    setFormData({ name: '', max_amount: '', icon: 'Wallet', color: ACCENT, is_recurrent: false });
    setShowForm(false);
    setEditingId(null);
  };

  const openEdit = (e, env) => {
    e.stopPropagation();
    setFormData({ name: env.name, max_amount: env.max_amount.toString(), icon: env.icon || 'Wallet', color: env.color || ACCENT, is_recurrent: env.is_recurrent });
    setEditingId(env.id);
    setShowForm(true);
  };

  const del = (e, env) => {
    e.stopPropagation();
    setDeletingId(env.id);
    setDeletingItem(env);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('envelopes').delete().eq('id', deletingId);
      if (error) alert(error.message); else fetchData();
    } finally { setIsDeleting(false); setShowDeleteModal(false); setDeletingId(null); setDeletingItem(null); }
  };

  const confirmHideOnly = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('envelopes').update({ is_hidden: true }).eq('id', deletingId);
      if (error) alert(error.message); else fetchData();
    } finally { setIsDeleting(false); setShowDeleteModal(false); setDeletingId(null); setDeletingItem(null); }
  };

  const totalBudget = envelopes.reduce((a, c) => a + parseFloat(c.max_amount), 0);
  const totalSpent = envelopes.reduce((a, c) => a + c.spent, 0);
  const totalLeft = Math.max(totalBudget - totalSpent, 0);
  const pctTotal = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

  const modalForm = (
    <BottomModal isOpen={showForm} onClose={resetForm} title={editingId ? "Modifier l'enveloppe" : "Nouvelle enveloppe"}>
      <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <AmountInput value={formData.max_amount} onChange={e => setFormData({ ...formData, max_amount: e.target.value })} color="#9CA3AF" />
        <FormCard>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', display: 'block', marginBottom: 4 }}>Nom</label>
          <input type="text" required placeholder="Alimentation, Loisirs..." value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: 15, color: '#4B5563' }} />
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
        <FormCard><IconSelector value={formData.icon} color={formData.color} onChange={val => setFormData({ ...formData, icon: val })} /></FormCard>
        <FormCard><ColorPicker value={formData.color} onChange={c => setFormData({ ...formData, color: c })} /></FormCard>
        <button type="submit" disabled={loading}
          style={{ background: '#3B82F6', color: 'white', border: 'none', borderRadius: 16, padding: '16px', fontSize: 16, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(59,130,246,0.3)', marginTop: 8 }}>
          {loading ? <Loader2 size={24} className="animate-spin-smooth" /> : editingId ? 'Enregistrer' : "Créer l'enveloppe"}
        </button>
      </form>
    </BottomModal>
  );

  const deleteModal = (
    <DeleteConfirmationModal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)}
      onConfirm={confirmDelete} onConfirmAlternative={confirmHideOnly}
      loading={isDeleting} isRecurrent={deletingItem?.is_recurrent}
      title={deletingItem?.is_recurrent ? "Enveloppe récurrente" : "Supprimer cette enveloppe ?"}
      message={deletingItem?.is_recurrent
        ? "Cette enveloppe est récurrente. Voulez-vous la supprimer définitivement ou seulement pour ce mois-ci ?"
        : "Voulez-vous vraiment supprimer cette enveloppe ? Toutes les dépenses liées seront également supprimées."} />
  );

  const EnvelopeCard = ({ e, i }) => {
    const target = parseFloat(e.max_amount);
    const spent = e.spent;
    const pct = Math.round((spent / Math.max(target, 1)) * 100);
    const remaining = target - spent;
    const over = pct >= 100;
  
    if (isDesktop) {
      return (
        <div className="card fade-up" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, animationDelay: `${i * 40}ms` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div 
              style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
              onClick={() => navigate(`/envelopes/${e.id}`, { state: { date: selectedDate, name: e.name, icon: e.icon, color: e.color } })}
            >
              <IconBubble icon={e.icon} color={e.color || ACCENT} size={44} />
              <div>
                <div style={{ fontWeight: 800, color: '#1a1a2e', fontSize: 15 }}>{e.name}</div>
                <div style={{ fontSize: 12, color: '#B0B8C9', fontWeight: 600 }}>{over ? "Dépassé" : `${pct}% utilisé`}</div>
              </div>
            </div>
          </div>
  
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '8px 0' }} onClick={() => navigate(`/envelopes/${e.id}`, { state: { date: selectedDate, name: e.name, icon: e.icon, color: e.color } })} >
            <SingleDonut value={spent} max={target} size={130} stroke={12} color={over ? '#EF4444' : (e.color || ACCENT)} label={`${pct}%`} sublabel={remaining >= 0 ? "utilisé" : "dépassé"} />
          </div>
  
          <div>
            <ProgressLinear value={spent} max={target} color={over ? '#EF4444' : (e.color || ACCENT)} height={8} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, fontWeight: 700 }}>
              <span style={{ color: '#8892a4' }}>{fmt(spent)}</span>
              <span style={{ color: '#1a1a2e' }}>{fmt(target)}</span>
            </div>
          </div>
  
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={(ev) => openEdit(ev, e)}
              style={{
                flex: 1, padding: '10px', borderRadius: 12,
                background: '#F5F7FF', color: '#5C6EFF',
                fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <Pencil size={14} /> Modifier
            </button>
            <button
              onClick={(ev) => del(ev, e)}
              style={{
                padding: '10px 14px', borderRadius: 12,
                background: '#FEECEC', color: '#DC2626',
                fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer',
              }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      );
    }
  
    // Mobile layout
    return (
      <div className="card fade-up" style={{ padding: 16, animationDelay: `${i * 40}ms`, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }} onClick={() => navigate(`/envelopes/${e.id}`, { state: { date: selectedDate, name: e.name, icon: e.icon, color: e.color } })}>
          <IconBubble icon={e.icon} color={e.color || ACCENT} size={42} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontWeight: 800, color: '#1a1a2e', fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{e.name}</div>
              <div style={{
                fontSize: 11, fontWeight: 800,
                color: over ? "#EF4444" : (e.color || ACCENT),
                background: over ? "#FEECEC" : `${e.color || ACCENT}1A`,
                padding: "3px 8px", borderRadius: 999, flexShrink: 0
              }}>{pct}%</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, fontSize: 12, fontWeight: 700 }}>
              <span style={{ color: '#8892a4' }}>{fmt(spent)} / {fmt(target)}</span>
              <span style={{ color: over ? "#EF4444" : '#8892a4' }}>
                {over ? `+${fmt(-remaining)}` : `${fmt(remaining)} utilisé`}
              </span>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <ProgressLinear value={spent} max={target} color={over ? '#EF4444' : (e.color || ACCENT)} height={8} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={(ev) => openEdit(ev, e)} style={{ flex: 1, padding: '8px', borderRadius: 10, background: '#F5F7FF', color: '#5C6EFF', fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Pencil size={12} /> Modifier
          </button>
          <button onClick={(ev) => del(ev, e)} style={{ padding: '8px 12px', borderRadius: 10, background: '#FEECEC', color: '#DC2626', fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer' }}>
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    );
  };

  // ── DESKTOP ──
  if (isDesktop) {
    return (
      <div className="desktop-shell fade-in">
        <DesktopHeader />
        <div className="desktop-body">
          <DesktopSidebar />
          <main className="desktop-main">
            <div className="desktop-greeting-toprow">
              <div className="desktop-greeting">
                <h1>Enveloppes budgétaires ✉️</h1>
                <p>Gérez vos enveloppes de dépenses variables.</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <MonthSelector selectedDate={selectedDate} onDateChange={setSelectedDate} />
                <button onClick={() => { resetForm(); setShowForm(true); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, background: ACCENT, color: 'white', border: 'none', borderRadius: 12, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(92,110,255,0.35)' }}>
                  <Plus size={18} /> Nouvelle enveloppe
                </button>
              </div>
            </div>

            {loading && !showForm ? <LoadingSpinner color={ACCENT} /> : (
              <div>
                <div className="desktop-budget-card" style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
                    <SingleDonut value={totalSpent} max={totalBudget} size={140} stroke={14} color={ACCENT} label={`${pctTotal}%`} sublabel="global" />
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontSize: 13, color: '#B0B8C9', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Toutes enveloppes confondues</div>
                      <div style={{ fontSize: 32, fontWeight: 900, color: '#1a1a2e', marginTop: 4 }}>
                        {fmt(totalSpent)} <span style={{ fontSize: 18, color: '#8892a4', fontWeight: 700 }}>/ {fmt(totalBudget)}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                        <span style={{ background: '#EEF2FB', color: '#5C6EFF', padding: '6px 12px', borderRadius: 99, fontSize: 13, fontWeight: 700 }}>{envelopes.length} enveloppes</span>
                        <span style={{ background: '#ECFDF5', color: '#059669', padding: '6px 12px', borderRadius: 99, fontSize: 13, fontWeight: 700 }}>{fmt(totalBudget - totalSpent)} disponible</span>
                      </div>
                    </div>
                  </div>
                </div>

                {envelopes.length === 0 ? (
                  <div className="desktop-budget-card" style={{ textAlign: 'center', padding: '60px 20px' }}>
                    <p style={{ color: '#B0B8C9', fontWeight: 600 }}>Aucune enveloppe ce mois.</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                    {envelopes.map((env, i) => <EnvelopeCard key={env.id} e={env} i={i} />)}
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
        {modalForm}
        {deleteModal}
      </div>
    );
  }

  // ── MOBILE ──
  return (
    <div className="fade-in pb-fab-spacer" style={{ minHeight: '100vh', background: '#EEF2FB' }}>
      <TopBar title="Dépenses variables" />
      <div style={{ padding: '20px 16px', maxWidth: 480, margin: '0 auto' }}>
        <MonthSelector selectedDate={selectedDate} onDateChange={setSelectedDate} />
        <div style={{ height: 16 }} />

        {loading && !showForm ? <LoadingSpinner color={ACCENT} /> : (
          <>
            <div style={{ background: 'linear-gradient(135deg, #5C6EFF 0%, #9B5CFF 100%)', borderRadius: 18, padding: 20, color: 'white', marginBottom: 20, boxShadow: '0 4px 14px rgba(92,110,255,0.3)' }} className="fade-up">
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <SingleDonut value={totalSpent} max={totalBudget} size={90} stroke={10} color="#fff" trackColor="rgba(255,255,255,.25)" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, opacity: .85, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Budget enveloppes
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 900, marginTop: 4, letterSpacing: -0.3 }}>{fmt(totalSpent)}</div>
                  <div style={{ fontSize: 12, opacity: .85, fontWeight: 600, marginTop: 2 }}>sur {fmt(totalBudget)} · {pctTotal}%</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0, 1fr)' }}>
              {envelopes.map((env, i) => <EnvelopeCard key={env.id} e={env} i={i} />)}
            </div>
            {envelopes.length === 0 && (
              <div className="card" style={{ padding: '40px 20px', textAlign: 'center' }}><p style={{ color: '#B0B8C9', fontWeight: 600 }}>Aucune enveloppe ce mois.</p></div>
            )}
          </>
        )}
      </div>
      {!showForm && (
        <button onClick={() => { resetForm(); setShowForm(true); }}
          style={{ position: 'fixed', bottom: 90, right: 20, width: 56, height: 56, borderRadius: '50%', background: '#5C6EFF', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 24px rgba(92,110,255,.5)', zIndex: 40 }}>
          <Plus size={26} color="white" />
        </button>
      )}
      {modalForm}
      {deleteModal}
      <BottomNav />
    </div>
  );
};
export default Envelopes;

