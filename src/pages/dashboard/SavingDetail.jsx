import React from 'react';
import EntryDetailPage from './EntryDetailPage';

const CONFIG = {
  table: 'saving_entries',
  parentTable: 'savings',
  parentKey: 'saving_id',
  parentRoute: '/savings',
  defaultName: 'Épargne',
  defaultIcon: 'PiggyBank',
  defaultColor: '#F9A825',
  spinnerColor: '#F9A825',
  totalColor: '#22c55e',
  totalPrefix: '+',
  hasName: false,
  extraRow: {},
  texts: {
    headerLabel: 'Versements',
    empty: 'Aucun versement pour cet objectif.',
    entryTitle: 'Versement',
    addTitle: 'Ajouter un versement',
    editTitle: 'Modifier le versement',
    submitLabel: 'Confirmer le versement',
    deleteTitle: 'Supprimer ce versement ?',
    deleteMessage: 'Voulez-vous vraiment supprimer ce versement de votre épargne ? Cette action est définitive.',
    created: 'Versement ajouté avec succès',
    updated: 'Versement modifié avec succès',
    deleted: 'Versement supprimé',
    parentDeleted: "Cet objectif d'épargne a été supprimé par un collaborateur.",
    realtimeMessage: (_name, verb) => `Un versement a été ${verb} par un collaborateur`,
    feminine: false,
  },
};

const SavingDetail = () => <EntryDetailPage config={CONFIG} />;

export default SavingDetail;
