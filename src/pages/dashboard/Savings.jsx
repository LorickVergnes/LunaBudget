import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { useMonth } from '../../contexts/MonthContext';
import { useDashboard } from '../../contexts/DashboardContext';
import { formatMonthDate } from '../../lib/dateUtils';
import { Plus, Check, Loader2, Trash2, Pencil, Zap } from 'lucide-react';
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
import ColorPicker from '../../components/ui/ColorPicker';
import useDesktop from '../../hooks/useDesktop';

const ACCENT = '#A0D2EB';

const fmt = (num) => num.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' €';

const ProgressLinear = ({ value, max, color, height = 6 }) => {
  const pct = Math.min((value / Math.max(max, 1)) * 100, 100);
  return (
    <div style={{ height, borderRadius: 99, background: 'transparent', overflow: 'hidden' }}>
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

const SingleDonut = ({ value, max, size = 90, stroke = 10, color = ACCENT, trackColor = '#F4F7F6', label, sublabel }) => {
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
          {label && <span style={{ fontSize: size * 0.2, fontWeight: 900, color: '#4A6984', display: 'block' }}>{label}</span>}
          {sublabel && <span style={{ fontSize: size * 0.09, fontWeight: 700, color: '#B0B8C9', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>{sublabel}</span>}
        </div>
      )}
    </div>
  );
};

const Savings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { selectedDate, setSelectedDate } = useMonth();
  const { activeDashboard, loading: dashLoading } = useDashboard();
  const isDesktop = useDesktop();
  const [savings, setSavings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingItem, setDeletingItem] = useState(null);
  const [formData, setFormData] = useState({ name: '', target_amount: '', icon: 'PiggyBank', color: '#F9A825', is_recurrent: false, max_month: '' });

  useEffect(() => { 
    if (user) {
      if (activeDashboard) {
        fetchData();
      } else if (!dashLoading) {
        setLoading(false);
      }
    }
  }, [user, selectedDate, activeDashboard, dashLoading]);

  const fetchData = async () => {
    if (!activeDashboard) return;
    setLoading(true);
    try {
      await recurrenceService.checkAndApplyRecurrence(activeDashboard.id, selectedDate);
      const { data: savs } = await supabase.from('savings')
        .select('*, saving_entries(amount, date)')
        .eq('dashboard_id', activeDashboard.id)
        .eq('month_date', formatMonthDate(selectedDate))
        .eq('is_hidden', false);

      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const isPastMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1) < new Date(now.getFullYear(), now.getMonth(), 1);
      const isFutureMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1) > new Date(now.getFullYear(), now.getMonth(), 1);

      setSavings((savs || []).map(s => {
        const allEntries = s.saving_entries || [];
        const realEntries = allEntries.filter(e => {
          if (isPastMonth) return true;
          if (isFutureMonth) return false;
          return e.date <= todayStr;
        });
        return {
          ...s,
          currentReal: realEntries.reduce((a, c) => a + parseFloat(c.amount), 0)
        };
      }));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleAdd = async (e) => {
    e.preventDefault(); setLoading(true);
    const roundedAmount = Math.round(parseFloat(formData.target_amount) * 100) / 100;
    const data = { 
        ...formData, 
        target_amount: roundedAmount, 
        user_id: user.id, 
        dashboard_id: activeDashboard.id,
        month_date: formatMonthDate(selectedDate) 
    };
    if (data.is_recurrent && data.max_month) { data.max_month = `${data.max_month}-01`; } else { data.max_month = null; }
    if (editingId) {
      const { error } = await supabase.from('savings').update(data).eq('id', editingId);
      if (!error) { resetForm(); fetchData(); } else { setLoading(false); alert(error.message); }
    } else {
      const { error } = await supabase.from('savings').insert([data]);
      if (!error) { resetForm(); fetchData(); } else { setLoading(false); alert(error.message); }
    }
  };

  const resetForm = () => {
    setFormData({ name: '', target_amount: '', icon: 'PiggyBank', color: '#F9A825', is_recurrent: false, max_month: '' });
    setShowForm(false);
    setEditingId(null);
  };

  const openEdit = (e, s) => {
    e.stopPropagation();
    const parsedMaxMonth = s.max_month ? s.max_month.substring(0, 7) : '';
    setFormData({ name: s.name, target_amount: s.target_amount.toString(), icon: s.icon || 'PiggyBank', color: s.color || '#F9A825', is_recurrent: s.is_recurrent, max_month: parsedMaxMonth });
    setEditingId(s.id);
    setShowForm(true);
  };

  const del = (e, s) => {
    e.stopPropagation();
    setDeletingId(s.id);
    setDeletingItem(s);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('savings').delete().eq('id', deletingId);
      if (error) alert(error.message); else fetchData();
    } finally { setIsDeleting(false); setShowDeleteModal(false); setDeletingId(null); setDeletingItem(null); }
  };

  const confirmHideOnly = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('savings').update({ is_hidden: true }).eq('id', deletingId);
      if (error) alert(error.message); else fetchData();
    } finally { setIsDeleting(false); setShowDeleteModal(false); setDeletingId(null); setDeletingItem(null); }
  };

  const totalTarget = savings.reduce((a, c) => a + parseFloat(c.target_amount), 0);
  const totalSaved = savings.reduce((a, c) => a + c.currentReal, 0);

  const modalForm = (
    <BottomModal isOpen={showForm} onClose={resetForm} title={editingId ? "Modifier l'objectif" : "Nouvel objectif"}>
      <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <AmountInput value={formData.target_amount} onChange={e => setFormData({ ...formData, target_amount: e.target.value })} color="#9CA3AF" />
        <FormCard>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#4A6984', display: 'block', marginBottom: 4 }}>Nom</label>
          <input type="text" required placeholder="Voyage, Voiture, Urgences..." value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: 15, color: '#4B5563' }} />
        </FormCard>
        <FormCard style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} onClick={() => setFormData({ ...formData, is_recurrent: !formData.is_recurrent })}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#4A6984', display: 'block', marginBottom: 4 }}>Objectif récurrent</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 20, height: 20, borderRadius: 6, border: formData.is_recurrent ? 'none' : '2px solid #D1D5DB', background: formData.is_recurrent ? '#3B82F6' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {formData.is_recurrent && <Check size={14} color="white" />}
              </div>
              <span style={{ fontSize: 15, color: '#4B5563' }}>Créer chaque mois</span>
            </div>
          </div>
        </FormCard>
        {formData.is_recurrent && (
          <FormCard>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#4A6984', display: 'block', marginBottom: 4 }}>Date de fin (Optionnel)</label>
            <span style={{ fontSize: 12, color: '#9CA3AF', display: 'block', marginBottom: 8 }}>Mois et année finaux d'application pour cet objectif.</span>
            <input type="month" value={formData.max_month} onChange={e => setFormData({ ...formData, max_month: e.target.value })}
              style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: 15, color: '#4B5563' }} />
          </FormCard>
        )}
        <FormCard><IconSelector value={formData.icon} color={formData.color} onChange={val => setFormData({ ...formData, icon: val })} /></FormCard>
        <FormCard><ColorPicker value={formData.color} onChange={c => setFormData({ ...formData, color: c })} /></FormCard>
        <button type="submit" disabled={loading}
          style={{ background: '#3B82F6', color: 'white', border: 'none', borderRadius: 16, padding: '16px', fontSize: 16, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(59,130,246,0.3)', marginTop: 8 }}>
          {loading ? <Loader2 size={24} className="animate-spin-smooth" /> : editingId ? 'Enregistrer' : "Créer l'objectif"}
        </button>
      </form>
    </BottomModal>
  );

  const deleteModal = (
    <DeleteConfirmationModal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)}
      onConfirm={confirmDelete} onConfirmAlternative={confirmHideOnly}
      loading={isDeleting} isRecurrent={deletingItem?.is_recurrent}
      title={deletingItem?.is_recurrent ? "Objectif récurrent" : "Supprimer cet objectif ?"}
      message={deletingItem?.is_recurrent
        ? "Cet objectif est récurrent. Voulez-vous le supprimer définitivement ou seulement pour ce mois-ci ?"
        : "Voulez-vous vraiment supprimer cet objectif d'épargne ? Toutes les entrées liées seront également supprimées."} />
  );

  const SavingCard = ({ s, i }) => {
    const target = parseFloat(s.target_amount);
    const current = s.currentReal;
    const pct = Math.round((current / Math.max(target, 1)) * 100);
    const remaining = Math.max(target - current, 0);
    const over = current >= target;

    if (isDesktop) {
      return (
        <div className="card fade-up" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, animationDelay: `${i * 40}ms`, borderLeft: `4px solid ${s.color || '#F9A825'}` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <IconBubble icon={s.icon} color={s.color || '#F9A825'} size={48} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, color: '#4A6984', fontSize: 16, cursor: 'pointer' }} onClick={() => navigate(`/savings/${s.id}`, { state: { date: selectedDate, name: s.name, icon: s.icon, color: s.color } })}>{s.name}</div>
              <div style={{ fontSize: 12, color: '#B0B8C9', fontWeight: 600, marginTop: 2 }}>
                {over ? "Objectif atteint 🎉" : `Reste ${fmt(remaining)}`}
              </div>
            </div>
            <div style={{ background: 'transparent', color: '#A0D2EB', padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
              {pct}%
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }} onClick={() => navigate(`/savings/${s.id}`, { state: { date: selectedDate, name: s.name, icon: s.icon, color: s.color } })}>
            <SingleDonut value={current} max={target} size={100} stroke={10} color={s.color || '#F9A825'} label={`${pct}%`} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <div style={{ fontSize: 11, color: '#B0B8C9', fontWeight: 700 }}>ACTUEL</div>
                <div style={{ fontWeight: 800, color: '#4A6984' }}>{fmt(current)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#B0B8C9', fontWeight: 700 }}>OBJECTIF</div>
                <div style={{ fontWeight: 800, color: '#4A6984' }}>{fmt(target)}</div>
              </div>
            </div>
          </div>

          <ProgressLinear value={current} max={target} color={s.color || '#F9A825'} height={10} />

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => navigate(`/savings/${s.id}`, { state: { date: selectedDate, name: s.name, icon: s.icon, color: s.color } })}
              style={{
                flex: 1, padding: '10px', borderRadius: 12,
                background: 'linear-gradient(135deg, #81BAD8 0%, #CE9C4A 100%)', color: '#fff',
                fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                boxShadow: '0 6px 14px rgba(160,210,235,.3)',
                textShadow: '0 1px 2px rgba(0,0,0,0.2)'
              }}
            >
              <Plus size={14} /> Alimenter
            </button>
            <button
              onClick={(e) => openEdit(e, s)}
              style={{
                padding: '10px 14px', borderRadius: 12,
                background: '#F5F7FF', color: '#A0D2EB',
                fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer',
              }}
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={(e) => del(e, s)}
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

    // Mobile Layout
    return (
      <div className="card fade-up" style={{ padding: 16, animationDelay: `${i * 40}ms`, minWidth: 0, borderLeft: `4px solid ${s.color || '#F9A825'}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0 }}>
          <IconBubble icon={s.icon} color={s.color || '#F9A825'} size={44} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontWeight: 800, color: '#4A6984', fontSize: 15, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }} onClick={() => navigate(`/savings/${s.id}`, { state: { date: selectedDate, name: s.name, icon: s.icon, color: s.color } })}>{s.name}</div>
              <div style={{
                fontSize: 11, fontWeight: 800, color: s.color || '#F9A825',
                background: `${s.color || '#F9A825'}1A`, padding: '3px 8px', borderRadius: 999, flexShrink: 0
              }}>{pct}%</div>
            </div>
            <div style={{ fontSize: 11, color: '#B0B8C9', fontWeight: 600, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {over ? "Objectif atteint 🎉" : `Reste ${fmt(remaining)}`}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 12, fontSize: 13, fontWeight: 700 }}>
          <span style={{ color: '#4A6984', fontWeight: 800, fontSize: 16 }}>{fmt(current)}</span>
          <span style={{ color: '#B0B8C9' }}>{fmt(target)}</span>
        </div>
        <div style={{ marginTop: 6 }}>
          <ProgressLinear value={current} max={target} color={s.color || '#F9A825'} height={10} />
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            onClick={() => navigate(`/savings/${s.id}`, { state: { date: selectedDate, name: s.name, icon: s.icon, color: s.color } })}
            style={{
              flex: 1, padding: '9px', borderRadius: 11,
              background: 'linear-gradient(135deg, #81BAD8 0%, #CE9C4A 100%)', color: '#fff',
              fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              boxShadow: '0 6px 14px rgba(160,210,235,.28)',
              textShadow: '0 1px 2px rgba(0,0,0,0.2)'
            }}
          >
            <Plus size={14} /> Alimenter
          </button>
          <button
            onClick={(e) => openEdit(e, s)}
            style={{
              padding: '9px 14px', borderRadius: 11,
              background: '#F5F7FF', color: '#A0D2EB',
              fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer',
            }}
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={(e) => del(e, s)}
            style={{
              padding: '9px 14px', borderRadius: 11,
              background: '#FEECEC', color: '#DC2626',
              fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer',
            }}
          >
            <Trash2 size={14} />
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
                <h1>Épargne 🐖</h1>
                <p>Suivez vos objectifs d'épargne et vos versements.</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <MonthSelector selectedDate={selectedDate} onDateChange={setSelectedDate} />
                <button onClick={() => { resetForm(); setShowForm(true); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F9A825', color: 'white', border: 'none', borderRadius: 12, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(249,168,37,0.35)' }}>
                  <Plus size={18} /> Nouvel objectif
                </button>
              </div>
            </div>

            {loading && !showForm ? <LoadingSpinner color="#F9A825" /> : (
              <div>
                <div className="desktop-budget-card" style={{ marginBottom: 24, padding: 24, background: 'linear-gradient(135deg, #81BAD8 0%, #CE9C4A 100%)', color: 'white', border: 'none', textShadow: '0 2px 4px rgba(0,0,0,0.15)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 12, opacity: .9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Patrimoine épargné
                      </div>
                      <div style={{ fontSize: 36, fontWeight: 900, marginTop: 4 }}>{fmt(totalSaved)}</div>
                      <div style={{ fontSize: 14, opacity: .9, fontWeight: 600, marginTop: 4 }}>
                        Objectif total : {fmt(totalTarget)}
                      </div>
                    </div>
                  </div>
                </div>

                {savings.length === 0 ? (
                  <div className="desktop-budget-card" style={{ textAlign: 'center', padding: '60px 20px' }}>
                    <p style={{ color: '#B0B8C9', fontWeight: 600 }}>Aucun objectif. Préparez l'avenir !</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                    {savings.map((s, i) => <SavingCard key={s.id} s={s} i={i} />)}
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
    <div className="fade-in pb-fab-spacer" style={{ minHeight: '100vh', background: 'transparent' }}>
      <TopBar title="Épargne" />
      <div style={{ padding: '20px 16px', maxWidth: 480, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <MonthSelector selectedDate={selectedDate} onDateChange={setSelectedDate} />
        </div>

        {loading && !showForm ? <LoadingSpinner color="#F9A825" /> : (
          <>
            <div className="fade-up" style={{ padding: 20, background: 'linear-gradient(135deg, #81BAD8 0%, #CE9C4A 100%)', borderRadius: 18, color: 'white', marginBottom: 20, boxShadow: '0 4px 14px rgba(160,210,235,0.3)', textShadow: '0 2px 4px rgba(0,0,0,0.15)' }}>
              <div style={{ fontSize: 11, opacity: .9, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5 }}>
                Patrimoine épargné
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, marginTop: 4 }}>{fmt(totalSaved)}</div>
              <div style={{ fontSize: 12, opacity: .9, fontWeight: 600, marginTop: 4 }}>
                Objectif total : {fmt(totalTarget)}
              </div>
            </div>

            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0, 1fr)' }}>
              {savings.map((s, i) => <SavingCard key={s.id} s={s} i={i} />)}
            </div>
            {savings.length === 0 && (
              <div className="card" style={{ padding: '40px 20px', textAlign: 'center' }}><p style={{ color: '#B0B8C9', fontWeight: 600 }}>Aucun objectif. Préparez l'avenir !</p></div>
            )}
          </>
        )}
      </div>
      {!showForm && (
        <button onClick={() => { resetForm(); setShowForm(true); }}
          style={{ position: 'fixed', bottom: 90, right: 20, width: 56, height: 56, borderRadius: '50%', background: '#F9A825', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 24px rgba(249,168,37,.5)', zIndex: 40 }}>
          <Plus size={26} color="white" />
        </button>
      )}
      {modalForm}
      {deleteModal}
      <BottomNav />
    </div>
  );
};

export default Savings;
