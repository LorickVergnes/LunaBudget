import React from 'react';
import OperationsPage from './OperationsPage';

const CONFIG = {
  table: 'expenses',
  kind: 'expense',
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
    deleteTitle: 'Supprimer cette dépense ?',
    deleteMessage: 'Voulez-vous vraiment supprimer cette dépense fixe ? Cette action est définitive.',
    deleteRecurrentMessage: '« Supprimer ce mois uniquement » la retire de ce mois. « Arrêter la récurrence » la supprime de ce mois et des mois suivants.',
    created: 'Dépense ajoutée avec succès',
    updated: 'Dépense modifiée avec succès',
    deleted: 'Dépense supprimée',
    stopped: 'Récurrence arrêtée',
    hidden: 'Dépense masquée pour ce mois',
    realtimeFallbackName: 'Une dépense fixe',
    feminine: true,
  },
};

const Expenses = () => <OperationsPage config={CONFIG} />;

export default Expenses;
