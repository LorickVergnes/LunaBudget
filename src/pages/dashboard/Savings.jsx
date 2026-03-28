import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { useMonth } from '../../contexts/MonthContext';
import { formatMonthDate } from '../../lib/dateUtils';
import { Plus, Check, Loader2, Trash2, ChevronRight, RotateCw, Info, MoreVertical, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { recurrenceService } from '../../services/recurrenceService';
import BottomNav from '../../components/layout/BottomNav';
import MonthSelector from '../../components/layout/MonthSelector';
import TopBar from '../../components/layout/TopBar';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import BottomModal from '../../components/ui/BottomModal';
import { FormCard, AmountInput } from '../../components/ui/FormUI';
import IconSelector from '../../components/ui/IconSelector';
import { getIconComponent } from '../../lib/iconRegistry';
import DonutChart from '../../components/ui/DonutChart';
import ColorPicker from '../../components/ui/ColorPicker';
import { ALL_COLORS } from '../../lib/colorUtils';

const Savings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { selectedDate, setSelectedDate } = useMonth();
  const [savings, setSavings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', target_amount: '', icon: 'PiggyBank', color: '#F9A825', is_recurrent: false, max_month: '' });

  useEffect(() => { if (user) fetchData(); }, [user, selectedDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      await recurrenceService.checkAndApplyRecurrence(user.id, selectedDate);
      const { data } = await supabase.from('savings')
        .select('*, saving_entries(amount)').eq('month_date', formatMonthDate(selectedDate));
      setSavings((data || []).map(s => ({
        ...s, current: (s.saving_entries || []).reduce((a, c) => a + parseFloat(c.amount), 0)
      })));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleAdd = async (e) => {
    e.preventDefault(); setLoading(true);
    const data = { ...formData, target_amount: parseFloat(formData.target_amount), user_id: user.id, month_date: formatMonthDate(selectedDate) };
    if (data.is_recurrent && data.max_month) {
       data.max_month = `${data.max_month}-01`;
    } else {
       data.max_month = null;
    }

    if (editingId) {
      const { error } = await supabase.from('savings').update(data).eq('id', editingId);
      if (!error) { setFormData({ name: '', target_amount: '', icon: 'PiggyBank', color: '#F9A825', is_recurrent: false, max_month: '' }); setShowForm(false); setEditingId(null); fetchData(); }
      else { setLoading(false); alert(error.message); }
    } else {
      const { error } = await supabase.from('savings').insert([data]);
      if (!error) { setFormData({ name: '', target_amount: '', icon: 'PiggyBank', color: '#F9A825', is_recurrent: false, max_month: '' }); setShowForm(false); fetchData(); }
      else { setLoading(false); alert(error.message); }
    }
  };

  const openEdit = (e, s) => {
    e.stopPropagation();
    const parsedMaxMonth = s.max_month ? s.max_month.substring(0, 7) : '';
    setFormData({ name: s.name, target_amount: s.target_amount.toString(), icon: s.icon || 'PiggyBank', color: s.color || '#F9A825', is_recurrent: s.is_recurrent, max_month: parsedMaxMonth });
    setEditingId(s.id);
    setShowForm(true);
  };

  const del = async (e, id) => {
    e.stopPropagation();
    if (confirm('Supprimer cet objectif ?')) { await supabase.from('savings').delete().eq('id', id); fetchData(); }
  };

  const total = savings.reduce((a, c) => a + parseFloat(c.target_amount), 0);
  const totalSaved = savings.reduce((a, c) => a + c.current, 0);

  const usedColors = savings.filter(s => s.id !== editingId).map(s => s.color);

  return (
    <div className="fade-in" style={{ minHeight: '100vh', background: '#EEF2FB', paddingBottom: 76 }}>
      <TopBar title="Épargne" />

      <div style={{ padding: '20px 16px', maxWidth: 480, margin: '0 auto' }}>
        <MonthSelector selectedDate={selectedDate} onDateChange={setSelectedDate} />

        {loading && !showForm ? (
          <LoadingSpinner color="#F9A825" />
        ) : (
          <>
            {/* Summary card */}
            <div className="card fade-up" style={{ padding: '20px', marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px 24px', flexWrap: 'wrap' }}>
                <div style={{ minWidth: '100px', textAlign: 'center' }}>
                  <p style={{ fontSize: 12, color: '#B0B8C9', fontWeight: 600, marginBottom: 4 }}>Total</p>
                  <p style={{ fontSize: 24, fontWeight: 900, color: '#1a1a2e', marginBottom: 2 }}>{total.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</p>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                  <DonutChart 
                    segments={savings.map(s => ({ value: parseFloat(s.target_amount), color: s.color || '#F9A825' }))} 
                    total={total || 1} 
                    size={120} 
                  />
                </div>
                <div style={{ flex: '1 1 140px', display: 'flex', flexDirection: 'column', gap: 6, minWidth: '140px' }}>
                  {savings.slice(0, 3).map(s => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color || '#F9A825', flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#1a1a2e', flexShrink: 0 }}>{parseFloat(s.target_amount).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Savings list */}
            <div style={{ marginTop: 20 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', marginBottom: 10, paddingLeft: 4 }}>Historique des épargnes</p>
              {savings.length === 0 ? (
                <div className="card" style={{ padding: '40px 20px', textAlign: 'center' }}><p style={{ color: '#B0B8C9', fontWeight: 600 }}>Aucun objectif. Préparez l'avenir !</p></div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {savings.map((s, i) => {
                    const IC = getIconComponent(s.icon);
                    const pct = Math.min((s.current / Math.max(s.target_amount, 1)) * 100, 100);
                    const done = s.current >= s.target_amount;
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
                                <button onClick={e => openEdit(e, s)} style={{ background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, padding: 4 }}>
                                  <Pencil size={16} style={{ color: '#9CA3AF' }} />
                                </button>
                                <button onClick={e => del(e, s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, padding: 4 }}>
                                  <Trash2 size={16} style={{ color: '#D1D5DB' }} />
                                </button>
                              </div>
                            </div>
                            <p style={{ fontSize: 12, color: '#B0B8C9', fontWeight: 500, marginBottom: 8 }}>
                              Objectif: {parseFloat(s.target_amount).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} € · Total épargné: {s.current.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                            </p>
                            {/* Progress bar */}
                            <div style={{ height: 6, borderRadius: 99, background: '#EEF2FB', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, borderRadius: 99, background: done ? '#22c55e' : (s.color || '#F9A825'), transition: 'width .7s ease' }} />
                            </div>
                            {/* Add this month */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                              <p style={{ fontSize: 12, color: '#B0B8C9', fontWeight: 500 }}>Épargne du mois : {s.current.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</p>
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
        <button onClick={() => {
          setFormData({ name: '', target_amount: '', icon: 'PiggyBank', color: '#F9A825', is_recurrent: false, max_month: '' });
          setEditingId(null);
          setShowForm(true);
        }}
          style={{ position: 'fixed', bottom: 90, right: 20, width: 56, height: 56, borderRadius: '50%', background: '#5C6EFF', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 24px rgba(92,110,255,.5)', zIndex: 40 }}>
          <Plus size={26} color="white" />
        </button>
      )}

      {/* Modal Form */}
      <BottomModal isOpen={showForm} onClose={() => setShowForm(false)} title={editingId ? "Modifier l'objectif" : "Nouvel objectif"}>
        <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          
          <AmountInput 
            value={formData.target_amount} 
            onChange={e => setFormData({ ...formData, target_amount: e.target.value })}
            color="#9CA3AF"
          />

          <FormCard>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', display: 'block', marginBottom: 4 }}>Nom</label>
            <input 
              type="text" 
              required 
              placeholder="Voyage, Voiture, Urgences..." 
              value={formData.name} 
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: 15, color: '#4B5563' }} 
            />
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
               <input 
                 type="month" 
                 value={formData.max_month} 
                 onChange={e => setFormData({ ...formData, max_month: e.target.value })}
                 style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: 15, color: '#4B5563' }} 
               />
            </FormCard>
          )}

          <FormCard>
            <IconSelector 
              value={formData.icon} 
              color={formData.color} 
              onChange={val => setFormData({ ...formData, icon: val })} 
            />
          </FormCard>

          <FormCard>
            <ColorPicker 
              value={formData.color} 
              onChange={c => setFormData({ ...formData, color: c })} 
            />
          </FormCard>

          <button type="submit" disabled={loading}
            style={{ 
              background: '#3B82F6', color: 'white', border: 'none', borderRadius: 16, 
              padding: '16px', fontSize: 16, fontWeight: 600, cursor: 'pointer', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              boxShadow: '0 4px 14px rgba(59,130,246,0.3)', marginTop: 8 
            }}
          >
            {loading ? <Loader2 size={24} className="animate-spin-smooth" /> : editingId ? 'Enregistrer' : 'Créer l\'objectif'}
          </button>
        </form>
      </BottomModal>
      <BottomNav />
    </div>
  );
};
export default Savings;
