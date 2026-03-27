import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { useMonth } from '../../contexts/MonthContext';
import { formatMonthDate } from '../../lib/dateUtils';
import { Plus, Check, Calendar, RotateCw, Loader2, Trash2, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { recurrenceService } from '../../services/recurrenceService';
import BottomNav from '../../components/layout/BottomNav';
import MonthSelector from '../../components/layout/MonthSelector';
import TopBar from '../../components/layout/TopBar';
import BottomModal from '../../components/ui/BottomModal';
import { FormCard, AmountInput } from '../../components/ui/FormUI';
import IconSelector from '../../components/ui/IconSelector';
import { getIconComponent } from '../../lib/iconRegistry';
import DonutChart from '../../components/ui/DonutChart';
import ColorPicker from '../../components/ui/ColorPicker';
import { ALL_COLORS } from '../../lib/colorUtils';

const ACCENT = '#9B5CFF';

const Expenses = () => {
  const { user } = useAuth();
  const { selectedDate, setSelectedDate } = useMonth();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', amount: '', date: new Date().toISOString().split('T')[0], is_recurrent: false, icon: 'Home', color: '#9B5CFF' });

  useEffect(() => { if (user) fetchData(); }, [user, selectedDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      await recurrenceService.checkAndApplyRecurrence(user.id, selectedDate);
      const { data, error } = await supabase.from('expenses').select('*')
        .eq('month_date', formatMonthDate(selectedDate)).order('date', { ascending: false });
      if (!error) setExpenses(data || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleAdd = async (e) => {
    e.preventDefault(); setLoading(true);
    const data = { ...formData, amount: parseFloat(formData.amount), user_id: user.id, month_date: formatMonthDate(selectedDate) };
    if (editingId) {
      const { error } = await supabase.from('expenses').update(data).eq('id', editingId);
      if (error) { alert(error.message); setLoading(false); }
      else { setFormData({ name: '', amount: '', date: new Date().toISOString().split('T')[0], is_recurrent: false, icon: 'Home', color: '#9B5CFF' }); setShowForm(false); setEditingId(null); fetchData(); }
    } else {
      const { error } = await supabase.from('expenses').insert([data]);
      if (error) { alert(error.message); setLoading(false); }
      else { setFormData({ name: '', amount: '', date: new Date().toISOString().split('T')[0], is_recurrent: false, icon: 'Home', color: '#9B5CFF' }); setShowForm(false); fetchData(); }
    }
  };

  const openEdit = (exp) => {
    setFormData({ name: exp.name, amount: exp.amount.toString(), date: exp.date.split('T')[0], is_recurrent: exp.is_recurrent, icon: exp.icon || 'Home', color: exp.color || '#9B5CFF' });
    setEditingId(exp.id);
    setShowForm(true);
  };
  const del = async (id) => { await supabase.from('expenses').delete().eq('id', id); fetchData(); };
  const total = expenses.reduce((a, c) => a + parseFloat(c.amount), 0);

  const usedColors = expenses.filter(exp => exp.id !== editingId).map(exp => exp.color);

  const donutSegments = expenses.map(exp => ({
    value: parseFloat(exp.amount),
    color: exp.color || ACCENT
  }));

  return (
    <div style={{ minHeight: '100vh', background: '#EEF2FB', paddingBottom: 76 }}>
      <TopBar title="Dépenses fixes" />

      <div style={{ padding: '20px 16px', maxWidth: 480, margin: '0 auto' }}>
        <MonthSelector selectedDate={selectedDate} onDateChange={setSelectedDate} />

        {loading && !showForm ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}><Loader2 size={32} style={{ color: ACCENT }} className="animate-spin" /></div>
        ) : (
          <>
            {/* Summary card with responsive donut and legend */}
            <div className="card fade-up" style={{ padding: '20px', marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px 24px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '100px' }}>
                <p style={{ fontSize: 12, color: '#B0B8C9', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Total</p>
                <p style={{ fontSize: 24, fontWeight: 900, color: '#1a1a2e' }}>{total.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <DonutChart segments={donutSegments} total={total || 1} size={120} />
              </div>
              <div style={{ flex: '1 1 140px', display: 'flex', flexDirection: 'column', gap: 6, minWidth: '140px' }}>
                {expenses.slice(0, 3).map(exp => (
                  <div key={exp.id} style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: exp.color || ACCENT, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exp.name}</span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#1a1a2e', flexShrink: 0 }}>{parseFloat(exp.amount).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</span>
                  </div>
                ))}
              </div>
            </div>

            {/* List */}
            <div style={{ marginTop: 20 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', marginBottom: 10, paddingLeft: 4 }}>Historique des dépenses fixes</p>
              {expenses.length === 0 ? (
                <div className="card" style={{ padding: '40px 20px', textAlign: 'center' }}>
                  <p style={{ color: '#B0B8C9', fontWeight: 600 }}>Aucune dépense fixe ce mois.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {expenses.map((exp, i) => {
                    const IC = getIconComponent(exp.icon);
                    return (
                      <div key={exp.id} className="card fade-up" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, animationDelay: `${i * 40}ms` }}>
                        <div style={{ width: 44, height: 44, borderRadius: '50%', background: `${exp.color || ACCENT}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <IC size={20} style={{ color: exp.color || ACCENT }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: 2 }}>{exp.name}</p>
                          <p style={{ fontSize: 12, color: '#B0B8C9', fontWeight: 500 }}>
                            {parseFloat(exp.amount).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} € – {new Date(exp.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                          </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {exp.is_recurrent && <RotateCw size={12} style={{ color: '#5C6EFF' }} />}
                          <button onClick={() => openEdit(exp)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                            <Pencil size={16} style={{ color: '#9CA3AF' }} />
                          </button>
                          <button onClick={() => del(exp.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                            <Trash2 size={16} style={{ color: '#D1D5DB' }} />
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
          setFormData({ name: '', amount: '', date: new Date().toISOString().split('T')[0], is_recurrent: false, icon: 'Home', color: '#9B5CFF' });
          setEditingId(null);
          setShowForm(true);
        }}
          style={{ position: 'fixed', bottom: 90, right: 20, width: 56, height: 56, borderRadius: '50%', background: '#5C6EFF', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 24px rgba(92,110,255,.5)', zIndex: 40 }}>
          <Plus size={26} color="white" />
        </button>
      )}

      {/* Modal Form */}
      <BottomModal isOpen={showForm} onClose={() => setShowForm(false)} title={editingId ? "Modifier la dépense fixe" : "Ajouter une dépense fixe"}>
        <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          
          <AmountInput 
            value={formData.amount} 
            onChange={e => setFormData({ ...formData, amount: e.target.value })}
            color="#9CA3AF"
          />

          <FormCard>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', display: 'block', marginBottom: 4 }}>Nom</label>
            <input 
              type="text" 
              required 
              placeholder="Loyer, Netflix, EDF..." 
              value={formData.name} 
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: 15, color: '#4B5563' }} 
            />
          </FormCard>

          <FormCard style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Calendar size={22} style={{ color: '#9CA3AF' }} />
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', display: 'block', marginBottom: 2 }}>Date</label>
              <input 
                type="date" 
                required
                value={formData.date} 
                onChange={e => setFormData({ ...formData, date: e.target.value })}
                style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: 15, color: '#4B5563' }} 
              />
            </div>
          </FormCard>

          <FormCard style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} onClick={() => setFormData({ ...formData, is_recurrent: !formData.is_recurrent })}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', display: 'block', marginBottom: 4 }}>Ajouter chaque mois</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 20, height: 20, borderRadius: 6, border: formData.is_recurrent ? 'none' : '2px solid #D1D5DB', background: formData.is_recurrent ? '#3B82F6' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {formData.is_recurrent && <Check size={14} color="white" />}
                </div>
                <span style={{ fontSize: 15, color: '#4B5563' }}>Dépense récurrente</span>
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
            {loading ? <Loader2 size={24} className="animate-spin" /> : editingId ? 'Enregistrer' : 'Ajouter'}
          </button>
        </form>
      </BottomModal>
      <BottomNav />
    </div>
  );
};
export default Expenses;
