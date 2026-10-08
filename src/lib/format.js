// Montant en euros, sans décimales inutiles : 400 € ; 35,2 € ; 12,35 €
export const formatEuro = (amount) =>
  amount.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' €';
