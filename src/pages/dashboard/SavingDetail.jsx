import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { useMonth } from '../../contexts/MonthContext';
import { formatMonthDate } from '../../lib/dateUtils';
import { ArrowLeft, Plus, Check, Loader2, Trash2, Calendar, Pencil } from 'lucide-react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { getIconComponent } from '../../lib/iconRegistry';
import BottomNav from '../../components/layout/BottomNav';
import TopBar from '../../components/layout/TopBar';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import BottomModal from '../../components/ui/BottomModal';
import { FormCard, AmountInput } from '../../components/ui/FormUI';

const SavingDetail = () => {
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedDate } = useMonth();
  const [savingName] = useState(location.state?.name || 'Épargne');
  const savingIcon = location.state?.icon || 'PiggyBank';
  const savingColor = location.state?.color || '#F9A825';
  const HeaderIcon = getIconComponent(savingIcon);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ amount: '', date: new Date().toISOString().split('T')[0] });

  useEffect(() => { if (user) fetchData(); }, [user, id]);

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase.from('saving_entries').select('*').eq('saving_id', id).order('date', { ascending: false });
    setEntries(data || []);
    setLoading(false);
  };

  const handleAdd = async (e) => {
    e.preventDefault(); setLoading(true);
    const data = { ...formData, amount: parseFloat(formData.amount), user_id: user.id, saving_id: id, month_date: formatMonthDate(selectedDate) };
    if (editingId) {
      const { error } = await supabase.from('saving_entries').update(data).eq('id', editingId);
      if (!error) { setFormData({ amount: '', date: new Date().toISOString().split('T')[0] }); setShowForm(false); setEditingId(null); fetchData(); }
      else { setLoading(false); alert(error.message); }
    } else {
      const { error } = await supabase.from('saving_entries').insert([data]);
      if (!error) { setFormData({ amount: '', date: new Date().toISOString().split('T')[0] }); setShowForm(false); fetchData(); }
      else { setLoading(false); alert(error.message); }
    }
  };

  const openEdit = (entry) => {
    setFormData({ amount: entry.amount.toString(), date: entry.date.split('T')[0] });
    setEditingId(entry.id);
    setShowForm(true);
  };

  const del = async (entryId) => { await supabase.from('saving_entries').delete().eq('id', entryId); fetchData(); };
  const total = entries.reduce((a, c) => a + parseFloat(c.amount), 0);

  return (
    <div className="fade-in" style={{ minHeight: '100vh', background: '#EEF2FB', paddingBottom: 76 }}>
      <TopBar title={savingName} />

      {/* Sub-header for Saving Context */}
      <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: '#ffffff', border: '1px solid #E8ECFF', cursor: 'pointer', display: 'flex', padding: '8px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <ArrowLeft size={20} style={{ color: '#1a1a2e' }} />
        </button>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, color: '#B0B8C9', fontWeight: 600, lineHeight: 1 }}>Versements</p>
        </div>
        <span style={{ fontSize: 16, fontWeight: 800, color: '#22c55e', background: '#22c55e15', padding: '6px 12px', borderRadius: '12px' }}>
          +{total.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
        </span>
      </div>

      <div style={{ padding: '0px 16px', maxWidth: 480, margin: '0 auto' }}>
        {loading && !showForm ? (
          <LoadingSpinner color="#F9A825" />
        ) : entries.length === 0 ? (
          <div className="card" style={{ padding: '60px 20px', textAlign: 'center', marginTop: 16 }}>
            <HeaderIcon size={40} style={{ color: '#D1D5DB', margin: '0 auto 12px' }} />
            <p style={{ color: '#B0B8C9', fontWeight: 600 }}>Aucun versement pour cet objectif.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {entries.map((entry, i) => (
              <div key={entry.id} className="card fade-up" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, animationDelay: `${i * 40}ms` }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: `${savingColor}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <HeaderIcon size={20} style={{ color: savingColor }} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: 2 }}>Versement</p>
                  <p style={{ fontSize: 12, color: '#B0B8C9', fontWeight: 500 }}>
                    {parseFloat(entry.amount).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} € – {new Date(entry.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => openEdit(entry)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                    <Pencil size={16} style={{ color: '#9CA3AF' }} />
                  </button>
                  <button onClick={() => del(entry.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                    <Trash2 size={16} style={{ color: '#D1D5DB' }} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!showForm && (
        <button onClick={() => {
          setFormData({ amount: '', date: new Date().toISOString().split('T')[0] });
          setEditingId(null);
          setShowForm(true);
        }}
          style={{ position: 'fixed', bottom: 90, right: 20, width: 56, height: 56, borderRadius: '50%', background: '#5C6EFF', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 24px rgba(92,110,255,.5)', zIndex: 40 }}>
          <Plus size={26} color="white" />
        </button>
      )}

      {/* Modal Form */}
      <BottomModal isOpen={showForm} onClose={() => setShowForm(false)} title={editingId ? "Modifier le versement" : "Ajouter un versement"}>
        <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          
          <AmountInput 
            value={formData.amount} 
            onChange={e => setFormData({ ...formData, amount: e.target.value })}
            color="#9CA3AF"
          />

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

          <button type="submit" disabled={loading}
            style={{ 
              background: '#3B82F6', color: 'white', border: 'none', borderRadius: 16, 
              padding: '16px', fontSize: 16, fontWeight: 600, cursor: 'pointer', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              boxShadow: '0 4px 14px rgba(59,130,246,0.3)', marginTop: 8 
            }}
          >
            {loading ? <Loader2 size={24} className="animate-spin-smooth" /> : editingId ? 'Enregistrer' : 'Confirmer le versement'}
          </button>
        </form>
      </BottomModal>
      <BottomNav />
    </div>
  );
};
export default SavingDetail;
