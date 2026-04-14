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

const Savings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { selectedDate, setSelectedDate } = useMonth();
  const isDesktop = useDesktop();
  const [savings, setSavings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingItem, setDeletingItem] = useState(null);
  const [showForecast, setShowForecast] = useState(false);
  const [formData, setFormData] = useState({ name: '', target_amount: '', icon: 'PiggyBank', color: '#F9A825', is_recurrent: false, max_month: '' });

  useEffect(() => { if (user) fetchData(); }, [user, selectedDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      await recurrenceService.checkAndApplyRecurrence(user.id, selectedDate);
      const { data: savs } = await supabase.from('savings')
        .select('*, saving_entries(amount, date)')
        .eq('user_id', user.id)
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
          currentForecast: allEntries.reduce((a, c) => a + parseFloat(c.amount), 0),
          currentReal: realEntries.reduce((a, c) => a + parseFloat(c.amount), 0)
        };
      }));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleAdd = async (e) => {
    e.preventDefault(); setLoading(true);
    const roundedAmount = Math.round(parseFloat(formData.target_amount) * 100) / 100;
    const data = { ...formData, target_amount: roundedAmount, user_id: user.id, month_date: formatMonthDate(selectedDate) };
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
  const totalSaved = savings.reduce((a, c) => a + (showForecast ? c.currentForecast : c.currentReal), 0);

  const donutSegments = savings.map(s => ({
    value: showForecast ? s.currentForecast : s.currentReal,
    color: s.color || '#F9A825'
  }));

  const modalForm = (
    <BottomModal isOpen={showForm} onClose={resetForm} title={editingId ? "Modifier l'objectif" : "Nouvel objectif"}>
      <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <AmountInput value={formData.target_amount} onChange={e => setFormData({ ...formData, target_amount: e.target.value })} color="#9CA3AF" />
        <FormCard>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', display: 'block', marginBottom: 4 }}>Nom</label>
          <input type="text" required placeholder="Voyage, Voiture, Urgences..." value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: 15, color: '#4B5563' }} />
        </FormCard>
        <FormCard style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} onClick={() => setFormData({ ...formData, is_recurrent: !formData.is_recurrent })}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', display: 'block', marginBottom: 4 }}>Objectif récurrent</label>
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
            <label style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', display: 'block', marginBottom: 4 }}>Date de fin (Optionnel)</label>
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

  // Shared saving card
  const SavingCard = ({ s, i }) => {
    const IC = getIconComponent(s.icon);
    const current = showForecast ? s.currentForecast : s.currentReal;
    const pct = Math.min((current / Math.max(s.target_amount, 1)) * 100, 100);
    const done = current >= s.target_amount;
    return (
      <div className="card fade-up" style={{ padding: '18px', animationDelay: `${i * 40}ms`, cursor: 'pointer' }}
        onClick={() => navigate(`/savings/${s.id}`, { state: { date: selectedDate, name: s.name, icon: s.icon, color: s.color } })}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: `${s.color || '#F9A825'}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <IC size={20} style={{ color: s.color || '#F9A825' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 800, color: '#1a1a2e' }}>{s.name}</p>
            <p style={{ fontSize: 11, color: '#B0B8C9', fontWeight: 500 }}>Objectif : {parseFloat(s.target_amount).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</p>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={e => openEdit(e, s)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><Pencil size={14} style={{ color: '#9CA3AF' }} /></button>
            <button onClick={e => del(e, s)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><Trash2 size={14} style={{ color: '#D1D5DB' }} /></button>
          </div>
        </div>
        {/* Progress bar */}
        <div style={{ height: 7, borderRadius: 99, background: '#EEF2FB', overflow: 'hidden', marginBottom: 8 }}>
          <div style={{ height: '100%', width: `${pct}%`, borderRadius: 99, background: done ? '#22c55e' : (s.color || '#F9A825'), transition: 'width .7s ease' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: done ? '#22c55e' : '#B0B8C9', fontWeight: 600 }}>
            {showForecast ? 'Total prévu' : 'Versé'} : {current.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e' }}>{Math.round(pct)}%</span>
        </div>
        {s.is_recurrent && <RotateCw size={11} style={{ color: '#9B5CFF', marginTop: 8 }} />}
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
                <div className="desktop-toggle">
                  <button className={`desktop-toggle-btn${!showForecast ? ' desktop-toggle-btn--active' : ''}`} onClick={() => setShowForecast(false)}>Réel</button>
                  <button className={`desktop-toggle-btn${showForecast ? ' desktop-toggle-btn--active' : ''}`} onClick={() => setShowForecast(true)}>Prévisions</button>
                </div>
                <button onClick={() => { resetForm(); setShowForm(true); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F9A825', color: 'white', border: 'none', borderRadius: 12, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(249,168,37,0.35)' }}>
                  <Plus size={18} /> Nouvel objectif
                </button>
              </div>
            </div>

            {loading && !showForm ? <LoadingSpinner color="#F9A825" /> : (
              <div className="desktop-main-grid">
                {/* Left: Summary */}
                <div className="desktop-budget-card" style={{ display: 'flex', flexDirection: 'column' }}>
                  <p className="desktop-card-title">Résumé de l'épargne</p>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 32, padding: '10px 0' }}>
                    <DonutChart segments={donutSegments} total={totalSaved || 0} size={200} centerLabel={showForecast ? "Prévu" : "Réel"} />
                    
                    <div style={{ width: '100%' }}>
                       <div style={{ display: 'flex', justifyContent: 'center', gap: 40, marginBottom: 24, borderBottom: '1px solid #F5F7FF', paddingBottom: 16 }}>
                          <div style={{ textAlign: 'center' }}>
                            <p style={{ fontSize: 12, fontWeight: 700, color: '#B0B8C9', textTransform: 'uppercase', marginBottom: 4 }}>Total épargné</p>
                            <p style={{ fontSize: 24, fontWeight: 900, color: '#1a1a2e' }}>{totalSaved.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</p>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <p style={{ fontSize: 12, fontWeight: 700, color: '#B0B8C9', textTransform: 'uppercase', marginBottom: 4 }}>Objectif global</p>
                            <p style={{ fontSize: 24, fontWeight: 900, color: '#F9A825' }}>{totalTarget.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</p>
                          </div>
                       </div>

                       <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
                        {savings.map(s => {
                          const saved = showForecast ? s.currentForecast : s.currentReal;
                          return (
                            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color || '#F9A825', flexShrink: 0 }} />
                                <span style={{ fontSize: 13, color: '#555', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                              </div>
                              <span style={{ fontSize: 13, fontWeight: 800, color: '#1a1a2e', flexShrink: 0 }}>{saved.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Grid of cards */}
                <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 250px)', paddingRight: 4 }}>
                  <p className="desktop-card-title">Mes objectifs ({savings.length})</p>
                  {savings.length === 0 ? (
                    <div className="desktop-budget-card" style={{ textAlign: 'center', padding: '60px 20px' }}>
                      <p style={{ color: '#B0B8C9', fontWeight: 600 }}>Aucun objectif. Préparez l'avenir !</p>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                      {savings.map((s, i) => <SavingCard key={s.id} s={s} i={i} />)}
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
      <TopBar title="Épargne" />
      <div style={{ padding: '20px 16px', maxWidth: 480, margin: '0 auto' }}>
        <MonthSelector selectedDate={selectedDate} onDateChange={setSelectedDate} />
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
          <div style={{ background: 'white', borderRadius: 14, padding: 4, display: 'flex', gap: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <button onClick={() => setShowForecast(false)} style={{ border: 'none', padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', background: !showForecast ? '#5C6EFF' : 'transparent', color: !showForecast ? 'white' : '#B0B8C9' }}>Réel</button>
            <button onClick={() => setShowForecast(true)} style={{ border: 'none', padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', background: showForecast ? '#5C6EFF' : 'transparent', color: showForecast ? 'white' : '#B0B8C9' }}>Prévisions</button>
          </div>
        </div>
        {loading && !showForm ? <LoadingSpinner color="#F9A825" /> : (
          <>
            <div className="card fade-up" style={{ padding: '20px', marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px 24px', flexWrap: 'wrap' }}>
                <div style={{ minWidth: '100px', textAlign: 'center' }}>
                  <p style={{ fontSize: 12, color: '#B0B8C9', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{showForecast ? 'Épargne Prévue' : 'Épargne Réelle'}</p>
                  <p style={{ fontSize: 24, fontWeight: 900, color: '#1a1a2e', marginBottom: 2 }}>{totalSaved.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</p>
                  <span style={{ fontSize: 11, color: '#B0B8C9' }}>Objectif: {totalTarget.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                  <DonutChart segments={donutSegments} total={totalSaved || 1} size={120} centerLabel={showForecast ? "Total Prévu" : "Total Réel"} />
                </div>
                <div style={{ flex: '1 1 140px', display: 'flex', flexDirection: 'column', gap: 6, minWidth: '140px' }}>
                  {savings.slice(0, 3).map(s => {
                    const saved = showForecast ? s.currentForecast : s.currentReal;
                    return (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color || '#F9A825', flexShrink: 0 }} />
                          <span style={{ fontSize: 11, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#1a1a2e', flexShrink: 0 }}>{saved.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 20 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', marginBottom: 10, paddingLeft: 4 }}>Historique des épargnes</p>
              {savings.length === 0 ? (
                <div className="card" style={{ padding: '40px 20px', textAlign: 'center' }}><p style={{ color: '#B0B8C9', fontWeight: 600 }}>Aucun objectif. Préparez l'avenir !</p></div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {savings.map((s, i) => {
                    const IC = getIconComponent(s.icon);
                    const current = showForecast ? s.currentForecast : s.currentReal;
                    const pct = Math.min((current / Math.max(s.target_amount, 1)) * 100, 100);
                    const done = current >= s.target_amount;
                    return (
                      <div key={s.id} className="card fade-up" style={{ padding: '16px', animationDelay: `${i * 40}ms`, cursor: 'pointer' }}
                        onClick={() => navigate(`/savings/${s.id}`, { state: { date: selectedDate, name: s.name, icon: s.icon, color: s.color } })}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                          <div style={{ width: 46, height: 46, borderRadius: '50%', background: `${s.color || '#F9A825'}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <IC size={22} style={{ color: s.color || '#F9A825' }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                              <p style={{ fontSize: 15, fontWeight: 800, color: '#1a1a2e' }}>{s.name}</p>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <button onClick={e => openEdit(e, s)} style={{ background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, padding: 4 }}><Pencil size={16} style={{ color: '#9CA3AF' }} /></button>
                                <button onClick={e => del(e, s)} style={{ background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, padding: 4 }}><Trash2 size={16} style={{ color: '#D1D5DB' }} /></button>
                              </div>
                            </div>
                            <p style={{ fontSize: 12, color: '#B0B8C9', fontWeight: 500, marginBottom: 8 }}>
                              Objectif: {parseFloat(s.target_amount).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} € · {showForecast ? 'Prévu' : 'Réel'}: {current.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                            </p>
                            <div style={{ height: 6, borderRadius: 99, background: '#EEF2FB', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, borderRadius: 99, background: done ? '#22c55e' : (s.color || '#F9A825'), transition: 'width .7s ease' }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                              <p style={{ fontSize: 12, color: '#B0B8C9', fontWeight: 500 }}>{showForecast ? 'Total prévu' : 'Versé au réel'} : {current.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</p>
                              {s.is_recurrent && <RotateCw size={11} style={{ color: '#9B5CFF' }} />}
                            </div>
                          </div>
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
export default Savings;
