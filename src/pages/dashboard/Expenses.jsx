import React from 'react';
import OperationsPage from './OperationsPage';

const CONFIG = {
  table: 'expenses',
  accent: '#E5BA73',
  defaultIcon: 'Home',
  recurrentIconColor: '#A0D2EB',
  addButtonShadow: '0 4px 14px rgba(155,92,255,0.35)',
  texts: {
    title: 'Dépenses fixes 💸',
    subtitle: 'Suivez vos charges fixes mensuelles.',
    mobileTitle: 'Dépenses fixes',
    summaryTitle: 'Résumé des dépenses fixes',
    historyTitle: 'Historique des dépenses fixes',
    empty: 'Aucune dépense fixe ce mois.',
    forecastLabel: 'Prévu',
    addTitle: 'Ajouter une dépense fixe',
    editTitle: 'Modifier la dépense fixe',
    namePlaceholder: 'Loyer, Netflix, EDF...',
    recurrentText: 'Dépense récurrente',
    deleteTitle: 'Supprimer cette dépense ?',
    deleteMessage: 'Voulez-vous vraiment supprimer cette dépense fixe ? Cette action est définitive.',
    deleteRecurrentMessage: 'Cette dépense est récurrente. Voulez-vous la supprimer définitivement ou seulement pour ce mois-ci ?',
    created: 'Dépense ajoutée avec succès',
    updated: 'Dépense modifiée avec succès',
    deleted: 'Dépense supprimée',
    hidden: 'Dépense masquée pour ce mois',
    realtimeFallbackName: 'Une dépense fixe',
    feminine: true,
  },
};

const Expenses = () => <OperationsPage config={CONFIG} />;

export default Expenses;
