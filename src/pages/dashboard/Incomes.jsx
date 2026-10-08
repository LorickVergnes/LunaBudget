import React from 'react';
import OperationsPage from './OperationsPage';

const CONFIG = {
  table: 'incomes',
  accent: '#A0D2EB',
  defaultIcon: 'Briefcase',
  recurrentIconColor: '#E5BA73',
  addButtonShadow: '0 4px 14px rgba(160,210,235,0.35)',
  texts: {
    title: 'Revenus 💰',
    subtitle: 'Gérez vos sources de revenus pour ce mois.',
    mobileTitle: 'Revenus',
    summaryTitle: 'Résumé des revenus',
    historyTitle: 'Historique des revenus',
    empty: 'Aucun revenu ce mois.',
    forecastLabel: 'Objectif',
    addTitle: 'Ajouter un revenu',
    editTitle: 'Modifier le revenu',
    namePlaceholder: 'Nom de mon revenu',
    recurrentText: 'Revenu récurrent',
    deleteTitle: 'Supprimer ce revenu ?',
    deleteMessage: 'Voulez-vous vraiment supprimer ce revenu ? Cette action est définitive.',
    deleteRecurrentMessage: 'Ce revenu est récurrent. Voulez-vous le supprimer définitivement ou seulement pour ce mois-ci ?',
    created: 'Revenu ajouté avec succès',
    updated: 'Revenu modifié avec succès',
    deleted: 'Revenu supprimé',
    hidden: 'Revenu masqué pour ce mois',
    realtimeFallbackName: 'Un revenu',
    feminine: false,
  },
};

const Incomes = () => <OperationsPage config={CONFIG} />;

export default Incomes;
