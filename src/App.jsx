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
import { useAuth } from './hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { MonthProvider } from './contexts/MonthContext';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f0f14' }}>
      <Loader2 className="animate-spin" size={40} style={{ color: '#6366f1' }} />
    </div>
  );
  if (!user) return <Navigate to="/login" />;
  return children;
};

function App() {
  return (
    <MonthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/incomes" element={<ProtectedRoute><Incomes /></ProtectedRoute>} />
          <Route path="/expenses" element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
          <Route path="/envelopes" element={<ProtectedRoute><Envelopes /></ProtectedRoute>} />
          <Route path="/envelopes/:id" element={<ProtectedRoute><EnvelopeDetail /></ProtectedRoute>} />
          <Route path="/savings" element={<ProtectedRoute><Savings /></ProtectedRoute>} />
          <Route path="/savings/:id" element={<ProtectedRoute><SavingDetail /></ProtectedRoute>} />
          <Route path="/global" element={<ProtectedRoute><GlobalView /></ProtectedRoute>} />
          <Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </MonthProvider>
  );
}

export default App;
