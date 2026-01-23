import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from './components';
import { AuthProvider, DebugProvider, useAuth } from './context';
import {
  RestaurantsPage,
  RestaurantDetailPage,
  MenuItemDetailPage,
  SearchPage,
  StatisticsPage,
  ImportPage,
  SettingsPage,
} from './pages';

function AuthenticatedRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading state
  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh',
        flexDirection: 'column',
        gap: 'var(--space-lg)',
      }}>
        <div className="spinner" style={{ width: 40, height: 40 }} />
        <p style={{ color: 'var(--color-text-secondary)' }}>Loading...</p>
      </div>
    );
  }

  // Show login if not authenticated
  if (!isAuthenticated) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh',
        flexDirection: 'column',
        padding: 'var(--space-lg)',
        textAlign: 'center',
      }}>
        <h1 style={{ 
          fontSize: 'var(--font-size-3xl)',
          background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: 'var(--space-md)',
        }}>
          TasteTrail
        </h1>
        <p style={{ 
          color: 'var(--color-text-secondary)', 
          marginBottom: 'var(--space-xl)',
          maxWidth: 300,
        }}>
          Track your favorite restaurant dishes and share with family
        </p>
        <a 
          href="/.auth/login/aad?post_login_redirect_uri=/"
          className="btn btn-primary" 
          style={{ minWidth: 200, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', textDecoration: 'none' }}
        >
          <svg viewBox="0 0 24 24" fill="none" style={{ width: 20, height: 20 }}>
            <rect x="2" y="2" width="9" height="9" fill="#f25022" />
            <rect x="13" y="2" width="9" height="9" fill="#7fba00" />
            <rect x="2" y="13" width="9" height="9" fill="#00a4ef" />
            <rect x="13" y="13" width="9" height="9" fill="#ffb900" />
          </svg>
          Sign in with Microsoft
        </a>
      </div>
    );
  }

  // Authenticated routes
  return (
    <Routes>
      <Route path="/" element={<RestaurantsPage />} />
      <Route path="/restaurant/:id" element={<RestaurantDetailPage />} />
      <Route path="/menu-item/:id" element={<MenuItemDetailPage />} />
      <Route path="/search" element={<SearchPage />} />
      <Route path="/statistics" element={<StatisticsPage />} />
      <Route path="/import" element={<ImportPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <DebugProvider>
        <AuthProvider>
          <BrowserRouter>
            <AuthenticatedRoutes />
          </BrowserRouter>
        </AuthProvider>
      </DebugProvider>
    </ErrorBoundary>
  );
}
