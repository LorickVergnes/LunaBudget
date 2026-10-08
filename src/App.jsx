import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/dashboard/Dashboard';
import Incomes from './pages/dashboard/Incomes';
import Expenses from './pages/dashboard/Expenses';
import Envelopes from './pages/dashboard/Envelopes';
import EnvelopeDetail from './pages/dashboard/EnvelopeDetail';
import Savings from './pages/dashboard/Savings';
import SavingDetail from './pages/dashboard/SavingDetail';
import GlobalView from './pages/dashboard/GlobalView';
import Account from './pages/dashboard/Account';
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import { useAuth } from './hooks/useAuth';
import LoadingSpinner from './components/ui/LoadingSpinner';
import AppLayout from './components/layout/AppLayout';
import { MonthProvider } from './contexts/MonthContext';
import { AuthProvider } from './contexts/AuthContext';
import { DashboardProvider } from './contexts/DashboardContext';
import { ToastProvider } from './contexts/ToastContext';
import AmbientOrbs from './components/ui/AmbientOrbs';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner fullHeight color="#6366f1" />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const AppRoutes = () => {
  const { loading, passwordRecovery } = useAuth();

  // Le routeur n'est monté qu'une fois la session lue : au retour d'un lien reçu par email,
  // Supabase doit lire ses paramètres dans l'URL avant que le routeur ne la réécrive.
  if (loading) {
    return <LoadingSpinner fullHeight color="#6366f1" />;
  }

  // Arrivée par le lien « mot de passe oublié » : on demande le nouveau mot de passe avant tout.
  // Le routeur ne démarre qu'ensuite, sur l'adresse choisie par cette page.
  if (passwordRecovery) {
    return <ResetPassword />;
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* Pages connectées : le cadre (en-tête, navigation) est porté par AppLayout */}
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/incomes" element={<Incomes />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/envelopes" element={<Envelopes />} />
          <Route path="/savings" element={<Savings />} />
          <Route path="/global" element={<GlobalView />} />
          <Route path="/account" element={<Account />} />
        </Route>

        {/* Pages de détail : mise en page mobile sur tous les écrans */}
        <Route element={<ProtectedRoute><AppLayout mobileOnly /></ProtectedRoute>}>
          <Route path="/envelopes/:id" element={<EnvelopeDetail />} />
          <Route path="/savings/:id" element={<SavingDetail />} />
        </Route>

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
};

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <DashboardProvider>
          <MonthProvider>
            <AmbientOrbs />
            <AppRoutes />
          </MonthProvider>
        </DashboardProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
