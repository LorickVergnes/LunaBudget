import React from 'react';
import EntryDetailPage from './EntryDetailPage';

const CONFIG = {
  table: 'envelope_expenses',
  parentTable: 'envelopes',
  parentKey: 'envelope_id',
  parentRoute: '/envelopes',
  defaultName: 'Enveloppe',
  defaultIcon: 'Wallet',
  defaultColor: '#A0D2EB',
  spinnerColor: '#A0D2EB',
  totalColor: '#A0D2EB',
  totalPrefix: '',
  hasName: true,
  extraRow: { icon: 'ShoppingCart', color: '#A0D2EB' },
  texts: {
    headerLabel: 'Détail Enveloppe',
    empty: 'Aucune dépense dans cette enveloppe.',
    addTitle: 'Ajouter une dépense',
    editTitle: 'Modifier la dépense',
    namePlaceholder: 'Ex: Courses, Cinéma...',
    submitLabel: 'Ajouter',
    deleteTitle: 'Supprimer cette dépense ?',
    deleteMessage: "Voulez-vous vraiment supprimer cette dépense de l'enveloppe ? Cette action est définitive.",
    created: 'Dépense ajoutée avec succès',
    updated: 'Dépense modifiée avec succès',
    deleted: 'Dépense supprimée',
    parentDeleted: 'Cette enveloppe a été supprimée par un collaborateur.',
    realtimeMessage: (name, verb) => `${name || 'Une dépense'} a été ${verb} par un collaborateur`,
    feminine: true,
  },
};

const EnvelopeDetail = () => <EntryDetailPage config={CONFIG} />;

export default EnvelopeDetail;
