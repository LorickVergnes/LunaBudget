import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { useMonth } from '../../contexts/MonthContext';
import { formatMonthDate } from '../../lib/dateUtils';
import { ArrowLeft, Plus, Check, Loader2, Trash2, Calendar, Pencil, ShoppingCart } from 'lucide-react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { getIconComponent } from '../../lib/iconRegistry';
import BottomNav from '../../components/layout/BottomNav';
import TopBar from '../../components/layout/TopBar';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import BottomModal from '../../components/ui/BottomModal';
import DeleteConfirmationModal from '../../components/ui/DeleteConfirmationModal';
import { FormCard, AmountInput } from '../../components/ui/FormUI';

const EnvelopeDetail = () => {
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedDate } = useMonth();
  const [envelopeName] = useState(location.state?.name || 'Enveloppe');
  const envelopeIcon = location.state?.icon || 'Wallet';
  const envelopeColor = location.state?.color || '#5C6EFF';
  const HeaderIcon = getIconComponent(envelopeIcon);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formData, setFormData] = useState({ name: '', amount: '', date: new Date().toISOString().split('T')[0] });

  useEffect(() => { if (user) fetchData(); }, [user, id]);

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase.from('envelope_expenses').select('*')
      .eq('envelope_id', id).order('date', { ascending: false });
    setExpenses(data || []);
    setLoading(false);
  };

  const handleAdd = async (e) => {
    e.preventDefault(); setLoading(true);
    const data = { ...formData, amount: parseFloat(formData.amount), user_id: user.id, envelope_id: id, month_date: formatMonthDate(selectedDate), icon: 'ShoppingCart', color: '#5C6EFF' };
    if (editingId) {
      const { error } = await supabase.from('envelope_expenses').update(data).eq('id', editingId);
      if (!error) { setFormData({ name: '', amount: '', date: new Date().toISOString().split('T')[0] }); setShowForm(false); setEditingId(null); fetchData(); }
      else { setLoading(false); alert(error.message); }
    } else {
      const { error } = await supabase.from('envelope_expenses').insert([data]);
      if (!error) { setFormData({ name: '', amount: '', date: new Date().toISOString().split('T')[0] }); setShowForm(false); fetchData(); }
      else { setLoading(false); alert(error.message); }
    }
  };

  const openEdit = (exp) => {
    setFormData({ name: exp.name, amount: exp.amount.toString(), date: exp.date.split('T')[0] });
    setEditingId(exp.id);
    setShowForm(true);
  };

  const del = (id) => {
    setDeletingId(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('envelope_expenses').delete().eq('id', deletingId);
      if (error) alert(error.message);
      else fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setDeletingId(null);
    }
  };
  const total = expenses.reduce((a, c) => a + parseFloat(c.amount), 0);

  return (
    <div className="fade-in pb-fab-spacer" style={{ minHeight: '100vh', background: '#EEF2FB' }}>
      <TopBar title={envelopeName} />
      
      {/* Sub-header for Envelope Context */}
      <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: '#ffffff', border: '1px solid #E8ECFF', cursor: 'pointer', display: 'flex', padding: '8px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <ArrowLeft size={20} style={{ color: '#1a1a2e' }} />
        </button>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, color: '#B0B8C9', fontWeight: 600, lineHeight: 1 }}>Détail Enveloppe</p>
        </div>
        <span style={{ fontSize: 16, fontWeight: 800, color: '#5C6EFF', background: '#5C6EFF15', padding: '6px 12px', borderRadius: '12px' }}>
          {total.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
        </span>
      </div>

      <div style={{ padding: '0px 16px', maxWidth: 480, margin: '0 auto' }}>
        {loading && !showForm ? (
          <LoadingSpinner color="#5C6EFF" />
        ) : expenses.length === 0 ? (
          <div className="card" style={{ padding: '60px 20px', textAlign: 'center', marginTop: 16 }}>
            <HeaderIcon size={40} style={{ color: '#D1D5DB', margin: '0 auto 12px' }} />
            <p style={{ color: '#B0B8C9', fontWeight: 600 }}>Aucune dépense dans cette enveloppe.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {expenses.map((exp, i) => (
              <div key={exp.id} className="card fade-up" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, animationDelay: `${i * 40}ms` }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: `${envelopeColor}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <HeaderIcon size={20} style={{ color: envelopeColor }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: 2 }}>{exp.name}</p>
                  <p style={{ fontSize: 12, color: '#B0B8C9', fontWeight: 500 }}>
                    {parseFloat(exp.amount).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} € – {new Date(exp.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => openEdit(exp)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                    <Pencil size={16} style={{ color: '#9CA3AF' }} />
                  </button>
                  <button onClick={() => del(exp.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
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
          setFormData({ name: '', amount: '', date: new Date().toISOString().split('T')[0] });
          setEditingId(null);
          setShowForm(true);
        }}
          style={{ position: 'fixed', bottom: 90, right: 20, width: 56, height: 56, borderRadius: '50%', background: '#5C6EFF', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 24px rgba(92,110,255,.5)', zIndex: 40 }}>
          <Plus size={26} color="white" />
        </button>
      )}

      {/* Modal Form */}
      <BottomModal isOpen={showForm} onClose={() => setShowForm(false)} title={editingId ? "Modifier la dépense" : "Ajouter une dépense"}>
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
              placeholder="Ex: Courses, Cinéma..." 
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

          <button type="submit" disabled={loading}
            style={{ 
              background: '#3B82F6', color: 'white', border: 'none', borderRadius: 16, 
              padding: '16px', fontSize: 16, fontWeight: 600, cursor: 'pointer', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              boxShadow: '0 4px 14px rgba(59,130,246,0.3)', marginTop: 8 
            }}
          >
            {loading ? <Loader2 size={24} className="animate-spin-smooth" /> : editingId ? 'Enregistrer' : 'Ajouter'}
          </button>
        </form>
      </BottomModal>

      <DeleteConfirmationModal 
        isOpen={showDeleteModal} 
        onClose={() => setShowDeleteModal(false)} 
        onConfirm={confirmDelete}
        loading={isDeleting}
        title="Supprimer cette dépense ?"
        message="Voulez-vous vraiment supprimer cette dépense de l'enveloppe ? Cette action est définitive."
      />

      <BottomNav />
    </div>
  );
};
export default EnvelopeDetail;
