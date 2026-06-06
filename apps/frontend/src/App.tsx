import { Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { DashboardPage } from './pages/DashboardPage';
import { SessionPage } from './pages/SessionPage';
import { HistoryPage } from './pages/HistoryPage';
import { SummaryPage } from './pages/SummaryPage';
import { ResumePage } from './pages/ResumePage';
import { OAuthCallbackPage } from './pages/OAuthCallbackPage';
import { useInteractions } from './utils/interactions';

function App() {
  useInteractions();

  return (
    <>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/oauth-callback" element={<OAuthCallbackPage />} />

        {/* Authenticated / Dashboard Routes */}
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/session" element={<SessionPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/summary" element={<SummaryPage />} />
        <Route path="/resume" element={<ResumePage />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default App;
