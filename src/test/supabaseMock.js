// Faux client Supabase pour les tests de rendu : données fixes, aucune requête réseau.
// Il enregistre les lectures et écritures demandées par l'application.

export const USER = { id: 'u1', email: 'lorick@test.fr', user_metadata: { full_name: 'Lorick' } };
export const OTHER_USER_ID = 'u2';
export const DASHBOARD_ID = 'd1';

const OCT = '2026-10-01';
const SEP = '2026-09-01';
const base = { dashboard_id: DASHBOARD_ID, is_hidden: false, created_at: '2026-10-01T08:00:00+00:00' };

const envelopeExpenses = [
  { ...base, id: 'ee1', user_id: 'u1', envelope_id: 'env1', name: 'Carrefour', amount: 35.2, date: '2026-10-10', icon: 'ShoppingCart', color: '#3b82f6', month_date: OCT },
  { ...base, id: 'ee2', user_id: 'u2', envelope_id: 'env1', name: 'Marché', amount: 12.3, date: '2026-10-20', icon: 'ShoppingCart', color: '#3b82f6', month_date: OCT },
  { ...base, id: 'ee3', user_id: 'u1', envelope_id: 'env2', name: 'Cinéma', amount: 18, date: '2026-10-03', icon: 'Ticket', color: '#f43f5e', month_date: OCT },
];
const savingEntries = [
  { ...base, id: 'se1', user_id: 'u1', saving_id: 'sav1', amount: 50, date: '2026-10-02', month_date: OCT, savings: { name: 'Voyage', icon: 'Plane', color: '#F9A825' } },
  { ...base, id: 'se2', user_id: 'u1', saving_id: 'sav1', amount: 25, date: '2026-10-28', month_date: OCT, savings: { name: 'Voyage', icon: 'Plane', color: '#F9A825' } },
  // Versements des mois précédents : ils comptent dans le cumul de l'objectif
  { ...base, id: 'se3', user_id: 'u1', saving_id: 'sav1', amount: 100, date: '2026-08-12', month_date: '2026-08-01', savings: { name: 'Voyage', icon: 'Plane', color: '#F9A825' } },
  { ...base, id: 'se4', user_id: 'u1', saving_id: 'sav3', amount: 60, date: '2026-06-15', month_date: '2026-06-01', savings: { name: 'Ancien projet', icon: 'Gift', color: '#22c55e' } },
];
const entriesOf = (savingId) => savingEntries.filter(e => e.saving_id === savingId);

export const DATA = {
  profiles: [{ id: 'u1', email: 'lorick@test.fr', full_name: 'Lorick', avatar_url: null, role: 'free' }],
  dashboards: [{
    id: DASHBOARD_ID, name: 'Mon Budget', owner_id: 'u1', created_at: '2026-03-01T08:00:00+00:00',
    members: [
      { id: 'm1', dashboard_id: DASHBOARD_ID, user_id: 'u1', role: 'owner', profile: { full_name: 'Lorick', email: 'lorick@test.fr', avatar_url: null } },
      { id: 'm2', dashboard_id: DASHBOARD_ID, user_id: 'u2', role: 'editor', profile: { full_name: 'Alex', email: 'alex@test.fr', avatar_url: null } },
    ],
    invitations: [],
  }],
  incomes: [
    { ...base, id: 'inc1', user_id: 'u1', name: 'Salaire', amount: 1380, date: '2026-10-06', is_recurrent: true, icon: 'Briefcase', color: '#A0D2EB', month_date: OCT },
    { ...base, id: 'inc2', user_id: 'u2', name: 'Vente', amount: 60.5, date: '2026-10-12', is_recurrent: false, icon: 'Gift', color: '#22c55e', month_date: OCT },
    { ...base, id: 'inc3', user_id: 'u1', name: 'CAF', amount: 175, date: '2026-10-25', is_recurrent: true, icon: null, color: null, month_date: OCT },
    { ...base, id: 'inc0', user_id: 'u1', name: 'Salaire', amount: 1380, date: '2026-09-06', is_recurrent: true, icon: 'Briefcase', color: '#A0D2EB', month_date: SEP },
  ],
  expenses: [
    { ...base, id: 'exp1', user_id: 'u1', name: 'Loyer', amount: 250, date: '2026-10-06', is_recurrent: true, icon: 'Home', color: '#E5BA73', month_date: OCT },
    { ...base, id: 'exp2', user_id: 'u1', name: 'Garagiste', amount: 89.9, date: '2026-10-09', is_recurrent: false, icon: 'Car', color: '#ef4444', month_date: OCT },
    { ...base, id: 'exp3', user_id: 'u2', name: 'Essence', amount: 200, date: '2026-10-27', is_recurrent: true, icon: null, color: null, month_date: OCT },
    { ...base, id: 'exp0', user_id: 'u1', name: 'Loyer', amount: 250, date: '2026-09-06', is_recurrent: true, icon: 'Home', color: '#E5BA73', month_date: SEP },
  ],
  envelopes: [
    { ...base, id: 'env1', user_id: 'u1', name: 'Courses', max_amount: 400, is_recurrent: true, icon: 'ShoppingCart', color: '#3b82f6', month_date: OCT, envelope_expenses: envelopeExpenses.filter(e => e.envelope_id === 'env1') },
    { ...base, id: 'env2', user_id: 'u1', name: 'Loisirs', max_amount: 15, is_recurrent: false, icon: null, color: null, month_date: OCT, envelope_expenses: envelopeExpenses.filter(e => e.envelope_id === 'env2') },
  ],
  envelope_expenses: envelopeExpenses,
  savings: [
    // Objectif avec montant à atteindre et échéance
    { id: 'sav1', dashboard_id: DASHBOARD_ID, user_id: 'u1', name: 'Voyage', monthly_amount: 100, goal_amount: 2000, icon: 'Plane', color: '#F9A825', start_month: '2026-07-01', end_month: '2027-03-01', created_at: '2026-07-01T08:00:00+00:00', saving_entries: entriesOf('sav1') },
    // Épargne régulière sans plafond ni fin
    { id: 'sav2', dashboard_id: DASHBOARD_ID, user_id: 'u2', name: 'Urgences', monthly_amount: 40, goal_amount: null, icon: null, color: null, start_month: OCT, end_month: null, created_at: '2026-10-01T08:00:00+00:00', saving_entries: [] },
    // Objectif terminé : n'apparaît plus en octobre mais compte dans le patrimoine
    { id: 'sav3', dashboard_id: DASHBOARD_ID, user_id: 'u1', name: 'Ancien projet', monthly_amount: 30, goal_amount: null, icon: 'Gift', color: '#22c55e', start_month: '2026-05-01', end_month: '2026-08-01', created_at: '2026-05-01T08:00:00+00:00', saving_entries: entriesOf('sav3') },
  ],
  saving_entries: savingEntries,
};

export const log = { ops: [], reads: [] };
let listeners = [];

let myInvitations = [];
// Erreur renvoyée par toutes les lectures (panne réseau simulée), ou null
let readError = null;
// Erreur renvoyée par la fonction de récurrence, ou null
let recurrenceError = null;

// État d'authentification simulé
let session = { user: USER };
let authListeners = [];
let nextAuthError = null;
const authResult = () => {
  const error = nextAuthError;
  nextAuthError = null;
  return { data: {}, error };
};
const logAuth = (op, payload) => log.ops.push({ table: 'auth', op, payload: sortKeys(payload), filters: [] });

const sortKeys = (value) => {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, sortKeys(value[k])]));
  return value;
};

const matches = (row, [col, operator, val]) => {
  if (!(col in row)) return true;
  return operator === 'lte' ? String(row[col]) <= String(val) : String(row[col]) === String(val);
};

const execute = (st) => {
  const filters = st.filters.map(([c, o, v]) => `${c}${o === 'lte' ? '<=' : '='}${v}`).sort();
  if (st.op !== 'select') {
    log.ops.push({ table: st.table, op: st.op, payload: sortKeys(st.payload), filters });
    return { data: st.single ? { id: 'new1', ...(Array.isArray(st.payload) ? st.payload[0] : st.payload) } : null, error: null };
  }
  log.reads.push(`${st.table} | ${st.cols.replace(/\s+/g, ' ').trim()} | ${filters.join(' & ')}`);
  if (readError) return { data: null, error: readError };
  const rows = (DATA[st.table] || []).filter(row => st.filters.every(f => matches(row, f)));
  return { data: st.single ? rows[0] ?? null : rows, error: null };
};

const from = (table) => {
  const st = { table, op: 'select', cols: '*', filters: [], payload: undefined, single: false };
  const builder = {
    select(cols = '*') { if (st.op === 'select') st.cols = cols; return builder; },
    insert(payload) { st.op = 'insert'; st.payload = payload; return builder; },
    update(payload) { st.op = 'update'; st.payload = payload; return builder; },
    upsert(payload) { st.op = 'upsert'; st.payload = payload; return builder; },
    delete() { st.op = 'delete'; return builder; },
    eq(col, val) { st.filters.push([col, 'eq', val]); return builder; },
    lte(col, val) { st.filters.push([col, 'lte', val]); return builder; },
    order() { return builder; },
    single() { st.single = true; return builder; },
    maybeSingle() { st.single = true; return builder; },
    then(resolve, reject) { return Promise.resolve().then(() => execute(st)).then(resolve, reject); },
  };
  return builder;
};

// Même calcul que la fonction SQL get_monthly_totals, sur les données fixes
const monthlyTotals = (dashId, asOf) => {
  const currentMonth = `${asOf.slice(0, 7)}-01`;
  const realized = (row) => row.month_date < currentMonth || (row.month_date === currentMonth && row.date <= asOf);
  const sum = (rows, key = 'amount') => rows.reduce((cents, row) => cents + Math.round(Number(row[key]) * 100), 0) / 100;
  const of = (table) => DATA[table].filter(row => row.dashboard_id === dashId);
  const visible = (table) => of(table).filter(row => row.is_hidden === false);
  const months = [...new Set(['incomes', 'expenses', 'envelopes', 'envelope_expenses', 'saving_entries'].flatMap(table => of(table).map(row => row.month_date)))].sort();

  return months.map(month => {
    const inMonth = (rows) => rows.filter(row => row.month_date === month);
    const envelopeExpenses = inMonth(of('envelope_expenses'));
    return {
      month_date: month,
      income_real: sum(inMonth(visible('incomes')).filter(realized)),
      income_planned: sum(inMonth(visible('incomes'))),
      fixed_real: sum(inMonth(visible('expenses')).filter(realized)),
      fixed_planned: sum(inMonth(visible('expenses'))),
      envelope_real: sum(envelopeExpenses.filter(realized)),
      envelope_planned: sum(inMonth(visible('envelopes')).map(envelope => ({
        amount: Math.max(Number(envelope.max_amount), sum(envelopeExpenses.filter(expense => expense.envelope_id === envelope.id))),
      }))),
      savings_real: sum(inMonth(of('saving_entries')).filter(realized)),
    };
  });
};

export const supabase = {
  from,
  rpc: async (name, args) => {
    if (name === 'create_dashboard') {
      log.ops.push({ table: 'rpc', op: name, payload: sortKeys(args), filters: [] });
      return { data: 'new1', error: null };
    }
    // Les fonctions qui modifient la base sont enregistrées comme des écritures
    if (name === 'accept_invitation' || name === 'decline_invitation') {
      log.ops.push({ table: 'rpc', op: name, payload: sortKeys(args), filters: [] });
      myInvitations = myInvitations.filter(invitation => invitation.id !== args.invitation_id);
      return { data: name === 'accept_invitation' ? DASHBOARD_ID : null, error: null };
    }
    log.reads.push(`rpc ${name} | ${JSON.stringify(sortKeys(args))}`);
    if (name === 'apply_recurrence' && recurrenceError) return { data: null, error: recurrenceError };
    if (readError) return { data: null, error: readError };
    if (name === 'get_monthly_totals') return { data: monthlyTotals(args.dash_id, args.as_of), error: null };
    if (name === 'get_my_invitations') return { data: myInvitations, error: null };
    return { data: null, error: null };
  },
  auth: {
    getSession: async () => ({ data: { session } }),
    onAuthStateChange: (callback) => {
      authListeners.push(callback);
      return { data: { subscription: { unsubscribe() { authListeners = authListeners.filter(l => l !== callback); } } } };
    },
    signOut: async () => ({ error: null }),
    signInWithPassword: async (payload) => { logAuth('signInWithPassword', { email: payload.email }); return authResult(); },
    updateUser: async (payload) => { logAuth('updateUser', payload); return authResult(); },
    resetPasswordForEmail: async (email, options) => { logAuth('resetPasswordForEmail', { email, ...options }); return authResult(); },
  },
  channel: (name) => {
    const channel = {
      name,
      on(_type, config, callback) { listeners.push({ channel, table: config.table, filter: config.filter, callback }); return channel; },
      subscribe() { return channel; },
    };
    return channel;
  },
  removeChannel: (channel) => { listeners = listeners.filter(l => l.channel !== channel); },
};

// Simule un événement temps réel reçu de Supabase
export const emitRealtime = (table, eventType, newRecord, oldRecord) => {
  listeners.filter(l => l.table === table).forEach(l => l.callback({ eventType, new: newRecord ?? {}, old: oldRecord ?? {} }));
};
export const listenedTables = () => [...new Set(listeners.map(l => l.table))].sort();
export const resetMock = () => {
  log.ops.length = 0; log.reads.length = 0; listeners = [];
  session = { user: USER }; nextAuthError = null;
  myInvitations = [];
  readError = null; recurrenceError = null;
  setMockRole('owner');
  DATA.dashboards[0].invitations = [];
};

// Rôle de l'utilisateur connecté sur le dashboard : 'owner', 'editor' ou 'viewer'
export function setMockRole(role) {
  const dashboard = DATA.dashboards[0];
  dashboard.owner_id = role === 'owner' ? USER.id : OTHER_USER_ID;
  dashboard.members.find(member => member.user_id === USER.id).role = role;
  dashboard.members.find(member => member.user_id === OTHER_USER_ID).role = role === 'owner' ? 'editor' : 'owner';
}
// Invitations reçues par l'utilisateur connecté (réponse de get_my_invitations)
export const setMockMyInvitations = (list) => { myInvitations = list; };
// Invitations envoyées par le propriétaire, en attente
export const setMockSentInvitations = (list) => { DATA.dashboards[0].invitations = list; };

// Toutes les lectures échouent avec cette erreur (null pour rétablir)
export const setMockReadError = (error) => { readError = error; };
// La fonction de récurrence échoue avec cette erreur (null pour rétablir)
export const setMockRecurrenceError = (error) => { recurrenceError = error; };

// Visiteur non connecté (null) ou connecté
export const setMockSession = (value) => { session = value; };
// La prochaine opération d'authentification échouera avec cette erreur
export const failNextAuthCall = (error) => { nextAuthError = error; };
// Simule un événement d'authentification envoyé par Supabase (ex. PASSWORD_RECOVERY)
export const emitAuth = async (event, newSession = session) => {
  session = newSession;
  await Promise.all(authListeners.map(listener => listener(event, newSession)));
};
