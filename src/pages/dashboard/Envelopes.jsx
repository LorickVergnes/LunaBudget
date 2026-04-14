import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
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

const Envelopes = () => {
  const { user } = useAuth();
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
  const [showForecast, setShowForecast] = useState(false);
  const [formData, setFormData] = useState({ name: '', max_amount: '', icon: 'Wallet', color: ACCENT, is_recurrent: false });

  useEffect(() => { if (user) fetchData(); }, [user, selectedDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      await recurrenceService.checkAndApplyRecurrence(user.id, selectedDate);
      const { data: envs } = await supabase.from('envelopes')
        .select('*, envelope_expenses(amount, date)')
        .eq('user_id', user.id)
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
          spentForecast: allExpenses.reduce((a, c) => a + parseFloat(c.amount), 0),
          spentReal: realExpenses.reduce((a, c) => a + parseFloat(c.amount), 0)
        };
      }));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleAdd = async (e) => {
    e.preventDefault(); setLoading(true);
    const roundedAmount = Math.round(parseFloat(formData.max_amount) * 100) / 100;
    const data = { ...formData, max_amount: roundedAmount, user_id: user.id, month_date: formatMonthDate(selectedDate) };
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
  const totalSpent = envelopes.reduce((a, c) => a + (showForecast ? c.spentForecast : c.spentReal), 0);
  const totalLeft = Math.max(totalBudget - totalSpent, 0);

  const donutSegments = envelopes.map(env => ({
    value: showForecast ? env.spentForecast : env.spentReal,
    color: env.color || ACCENT
  }));

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

  // Shared envelope card
  const EnvelopeCard = ({ env, i, cardStyle = {} }) => {
    const IC = getIconComponent(env.icon);
    const spent = showForecast ? env.spentForecast : env.spentReal;
    const over = spent > env.max_amount;
    const remaining = env.max_amount - spent;
    const pct = Math.min((spent / Math.max(env.max_amount, 1)) * 100, 100);
    return (
      <div className="card fade-up"
        style={{ padding: '18px', cursor: 'pointer', animationDelay: `${i * 40}ms`, background: over ? '#FFF5F5' : 'white', ...cardStyle }}
        onClick={() => navigate(`/envelopes/${env.id}`, { state: { date: selectedDate, name: env.name, icon: env.icon, color: env.color } })}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: '50%', background: `${env.color || ACCENT}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <IC size={20} style={{ color: env.color || ACCENT }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 800, color: '#1a1a2e' }}>{env.name}</p>
            <p style={{ fontSize: 11, color: '#B0B8C9', fontWeight: 500 }}>Max : {env.max_amount} €</p>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={e => openEdit(e, env)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><Pencil size={13} style={{ color: '#9CA3AF' }} /></button>
            <button onClick={e => del(e, env)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><Trash2 size={13} style={{ color: '#D1D5DB' }} /></button>
          </div>
        </div>
        {/* Progress bar */}
        <div style={{ height: 6, borderRadius: 99, background: '#EEF2FB', overflow: 'hidden', marginBottom: 6 }}>
          <div style={{ height: '100%', width: `${pct}%`, borderRadius: 99, background: over ? '#ef4444' : (env.color || ACCENT), transition: 'width .7s ease' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: over ? '#ef4444' : '#22c55e' }}>
            Reste : {remaining.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
          </span>
          <span style={{ fontSize: 11, color: '#B0B8C9', fontWeight: 500 }}>{spent.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} / {env.max_amount} €</span>
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
                <div className="desktop-toggle">
                  <button className={`desktop-toggle-btn${!showForecast ? ' desktop-toggle-btn--active' : ''}`} onClick={() => setShowForecast(false)}>Réel</button>
                  <button className={`desktop-toggle-btn${showForecast ? ' desktop-toggle-btn--active' : ''}`} onClick={() => setShowForecast(true)}>Prévisions</button>
                </div>
                <button onClick={() => { resetForm(); setShowForm(true); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, background: ACCENT, color: 'white', border: 'none', borderRadius: 12, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(92,110,255,0.35)' }}>
                  <Plus size={18} /> Nouvelle enveloppe
                </button>
              </div>
            </div>

            {loading && !showForm ? <LoadingSpinner color={ACCENT} /> : (
              <div className="desktop-main-grid">
                {/* Left: Summary */}
                <div className="desktop-budget-card" style={{ display: 'flex', flexDirection: 'column' }}>
                  <p className="desktop-card-title">Résumé des enveloppes</p>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 32, padding: '10px 0' }}>
                    <DonutChart segments={donutSegments} total={totalSpent || 0} size={200} centerLabel={showForecast ? "Dép. Prévues" : "Dép. Réelles"} />
                    
                    <div style={{ width: '100%' }}>
                       <div style={{ display: 'flex', justifyContent: 'center', gap: 40, marginBottom: 24, borderBottom: '1px solid #F5F7FF', paddingBottom: 16 }}>
                          <div style={{ textAlign: 'center' }}>
                            <p style={{ fontSize: 12, fontWeight: 700, color: '#B0B8C9', textTransform: 'uppercase', marginBottom: 4 }}>Dépensé</p>
                            <p style={{ fontSize: 24, fontWeight: 900, color: '#1a1a2e' }}>{totalSpent.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</p>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <p style={{ fontSize: 12, fontWeight: 700, color: '#B0B8C9', textTransform: 'uppercase', marginBottom: 4 }}>Restant</p>
                            <p style={{ fontSize: 24, fontWeight: 900, color: totalLeft >= 0 ? '#22c55e' : '#ef4444' }}>{totalLeft.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</p>
                          </div>
                       </div>

                       <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
                        {envelopes.map(env => {
                          const spent = showForecast ? env.spentForecast : env.spentReal;
                          return (
                            <div key={env.id} style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: env.color || ACCENT, flexShrink: 0 }} />
                                <span style={{ fontSize: 13, color: '#555', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{env.name}</span>
                              </div>
                              <span style={{ fontSize: 13, fontWeight: 800, color: '#1a1a2e', flexShrink: 0 }}>{spent.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Grid of envelope cards */}
                <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 250px)', paddingRight: 4 }}>
                  <p className="desktop-card-title">Mes enveloppes ({envelopes.length})</p>
                  {envelopes.length === 0 ? (
                    <div className="desktop-budget-card" style={{ textAlign: 'center', padding: '60px 20px' }}>
                      <p style={{ color: '#B0B8C9', fontWeight: 600 }}>Aucune enveloppe ce mois.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                      {envelopes.map((env, i) => <EnvelopeCard key={env.id} env={env} i={i} />)}
                    </div>
                  )}
                </div>
              </div>
            )}
          </main>
        </div>
        {modalForm}
        {deleteModal}
      </div>
    );
  }

  // ── MOBILE (inchangé) ──
  return (
    <div className="fade-in pb-fab-spacer" style={{ minHeight: '100vh', background: '#EEF2FB' }}>
      <TopBar title="Dépenses variables" />
      <div style={{ padding: '20px 16px', maxWidth: 480, margin: '0 auto' }}>
        <MonthSelector selectedDate={selectedDate} onDateChange={setSelectedDate} />
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
          <div style={{ background: 'white', borderRadius: 14, padding: 4, display: 'flex', gap: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <button onClick={() => setShowForecast(false)} style={{ border: 'none', padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', background: !showForecast ? '#5C6EFF' : 'transparent', color: !showForecast ? 'white' : '#B0B8C9' }}>Réel</button>
            <button onClick={() => setShowForecast(true)} style={{ border: 'none', padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', background: showForecast ? '#5C6EFF' : 'transparent', color: showForecast ? 'white' : '#B0B8C9' }}>Prévisions</button>
          </div>
        </div>
        {loading && !showForm ? <LoadingSpinner color={ACCENT} /> : (
          <>
            <div className="card fade-up" style={{ padding: '20px', marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px 24px', flexWrap: 'wrap' }}>
                <div style={{ minWidth: '100px', textAlign: 'center' }}>
                  <p style={{ fontSize: 12, color: '#B0B8C9', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{showForecast ? 'Budget Prévu' : 'Budget Réel'}</p>
                  <p style={{ fontSize: 24, fontWeight: 900, color: totalLeft >= 0 ? '#22c55e' : '#ef4444', marginBottom: 2 }}>{totalLeft.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</p>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                  <DonutChart segments={donutSegments} total={totalSpent || 1} size={120} centerLabel={showForecast ? "Dép. Prévues" : "Dép. Réelles"} />
                </div>
                <div style={{ flex: '1 1 140px', display: 'flex', flexDirection: 'column', gap: 6, minWidth: '140px' }}>
                  {envelopes.slice(0, 3).map(env => {
                    const spent = showForecast ? env.spentForecast : env.spentReal;
                    return (
                      <div key={env.id} style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: env.color || ACCENT, flexShrink: 0 }} />
                          <span style={{ fontSize: 11, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{env.name}</span>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#1a1a2e', flexShrink: 0 }}>{spent.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 20 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', marginBottom: 10, paddingLeft: 4 }}>Les enveloppes</p>
              {envelopes.length === 0 ? (
                <div className="card" style={{ padding: '40px 20px', textAlign: 'center' }}><p style={{ color: '#B0B8C9', fontWeight: 600 }}>Aucune enveloppe ce mois.</p></div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {envelopes.map((env, i) => {
                    const IC = getIconComponent(env.icon);
                    const spent = showForecast ? env.spentForecast : env.spentReal;
                    const over = spent > env.max_amount;
                    const remaining = env.max_amount - spent;
                    return (
                      <div key={env.id} className="card fade-up" style={{ padding: '16px', cursor: 'pointer', animationDelay: `${i * 40}ms`, background: over ? '#FFF5F5' : 'white' }}
                        onClick={() => navigate(`/envelopes/${env.id}`, { state: { date: selectedDate, name: env.name, icon: env.icon, color: env.color } })}>
                        <div style={{ width: 44, height: 44, borderRadius: '50%', background: `${env.color || ACCENT}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                          <IC size={22} style={{ color: env.color || ACCENT }} />
                        </div>
                        <p style={{ fontSize: 14, fontWeight: 800, color: '#1a1a2e', marginBottom: 4 }}>{env.name}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: ACCENT }} />
                          <span style={{ fontSize: 11, color: '#555', fontWeight: 500 }}>Max : {env.max_amount} €</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: over ? '#ef4444' : '#22c55e' }} />
                          <span style={{ fontSize: 11, fontWeight: 600, color: over ? '#ef4444' : '#22c55e' }}>Reste : {remaining.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                          <button onClick={e => openEdit(e, env)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Pencil size={13} style={{ color: '#9CA3AF' }} /></button>
                          <button onClick={e => del(e, env)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Trash2 size={13} style={{ color: '#D1D5DB' }} /></button>
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
