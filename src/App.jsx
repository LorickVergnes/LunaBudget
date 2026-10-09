import { lazy, Suspense, useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from './lib/queryClient';
import { pageLoaders } from './lib/pageLoaders';
import { useAuth } from './hooks/useAuth';
import LoadingSpinner from './components/ui/LoadingSpinner';
import AppLayout from './components/layout/AppLayout';
import { MonthProvider } from './contexts/MonthContext';
import { AuthProvider } from './contexts/AuthContext';
import { DashboardProvider } from './contexts/DashboardContext';
import { ToastProvider } from './contexts/ToastContext';
import AmbientOrbs from './components/ui/AmbientOrbs';
import ErrorBoundary from './components/ui/ErrorBoundary';

// Chaque page est un fichier séparé, téléchargé au moment de l'afficher
const Dashboard = lazy(pageLoaders.Dashboard);
const Incomes = lazy(pageLoaders.Incomes);
const Expenses = lazy(pageLoaders.Expenses);
const Envelopes = lazy(pageLoaders.Envelopes);
const EnvelopeDetail = lazy(pageLoaders.EnvelopeDetail);
const Savings = lazy(pageLoaders.Savings);
const SavingDetail = lazy(pageLoaders.SavingDetail);
const GlobalView = lazy(pageLoaders.GlobalView);
const Account = lazy(pageLoaders.Account);
const Login = lazy(pageLoaders.Login);
const Signup = lazy(pageLoaders.Signup);
const ForgotPassword = lazy(pageLoaders.ForgotPassword);
const ResetPassword = lazy(pageLoaders.ResetPassword);

const fullScreenLoader = <LoadingSpinner fullHeight color="#6366f1" />;

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
    return <Suspense fallback={fullScreenLoader}><ResetPassword /></Suspense>;
  }

  // Ce Suspense couvre les pages publiques ; les pages connectées ont le leur dans AppLayout,
  // pour que l'en-tête et la navigation restent affichés pendant le téléchargement d'une page.
  return (
    <Router>
      <Suspense fallback={fullScreenLoader}>
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
      </Suspense>
    </Router>
  );
};

function App() {
  // Un cache par instance de l'application (et non global au module)
  const [queryClient] = useState(createQueryClient);

  return (
    <ErrorBoundary fullScreen>
      <QueryClientProvider client={queryClient}>
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
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
