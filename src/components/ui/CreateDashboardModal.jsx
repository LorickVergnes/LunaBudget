import React, { useState } from 'react';
import BottomModal from './BottomModal';
import { useDashboard } from '../../contexts/DashboardContext';

const CreateDashboardModal = ({ isOpen, onClose }) => {
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { createDashboard } = useDashboard();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setIsLoading(true);
    try {
      await createDashboard(name);
      setName('');
      onClose();
    } catch (error) {
      alert('Erreur lors de la création : ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <BottomModal isOpen={isOpen} onClose={onClose} title="Nouveau Budget">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ fontSize: 14, color: '#4B5563', textAlign: 'center', marginBottom: 8 }}>
          Créez un nouveau tableau de bord pour séparer vos budgets (ex: Personnel, Entreprise, Vacances...)
        </p>
        
        <div style={{ background: 'var(--bg-white)', padding: '12px 16px', borderRadius: 16, border: '1px solid #E8ECFF' }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#4A6984', display: 'block', marginBottom: 4 }}>Nom du budget</label>
          <input 
            type="text" 
            required 
            placeholder="Mon super budget" 
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: 15, color: 'var(--text-primary)' }} 
          />
        </div>

        <button 
          type="submit"
          disabled={isLoading}
          style={{ 
            background: 'linear-gradient(135deg,#A0D2EB,#E5BA73)', 
            color: 'white', 
            border: 'none', 
            borderRadius: 16, 
            padding: '16px', 
            fontSize: 16, 
            fontWeight: 800, 
            cursor: 'pointer', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            boxShadow: '0 6px 20px rgba(160,210,235,.4)',
            marginTop: 8
          }}
        >
          {isLoading ? 'Création...' : 'Créer le budget'}
        </button>
      </form>
    </BottomModal>
  );
};

export default CreateDashboardModal;
