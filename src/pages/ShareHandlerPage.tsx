import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export function ShareHandlerPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [restaurantName, setRestaurantName] = useState<string>('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMessage('Invalid share link.');
      return;
    }

    const claim = async () => {
      try {
        const result = await api.claimShare(token);
        if (result.error) {
          throw new Error(result.error.message);
        }

        if (result.data) {
          setRestaurantName(result.data.name);
          setStatus('success');
          // Wait a moment then redirect
          setTimeout(() => {
            navigate(`/restaurant/${result.data!.restaurantId}`);
          }, 2000);
        }
      } catch (err) {
        setStatus('error');
        setErrorMessage(err instanceof Error ? err.message : 'Failed to process share link');
      }
    };

    claim();
  }, [token, navigate]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: 'var(--space-md)',
      textAlign: 'center'
    }}>
      <div style={{
        backgroundColor: 'var(--color-bg-secondary)',
        padding: 'var(--space-xl)',
        borderRadius: 'var(--radius-lg)',
        maxWidth: 400,
        width: '100%',
        boxShadow: 'var(--shadow-md)',
      }}>
        {status === 'loading' && (
          <>
            <div className="spinner" style={{ margin: '0 auto var(--space-lg)' }} />
            <h2>Processing Share Link...</h2>
            <p style={{ color: 'var(--color-text-secondary)' }}>Please wait while we add this restaurant to your list.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ fontSize: 40, marginBottom: 'var(--space-md)' }}>🎉</div>
            <h2 style={{ color: 'var(--color-success)' }}>Success!</h2>
            <p>You now have access to <strong>{restaurantName}</strong>.</p>
            <p style={{ fontSize: '0.9em', marginTop: 'var(--space-sm)' }}>Redirecting you...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize: 40, marginBottom: 'var(--space-md)' }}>😕</div>
            <h2 style={{ color: 'var(--color-danger)' }}>Something went wrong</h2>
            <p style={{ color: 'var(--color-text-secondary)' }}>{errorMessage}</p>
            <button 
              className="btn btn-primary"
              style={{ marginTop: 'var(--space-lg)', width: '100%' }}
              onClick={() => navigate('/')}
            >
              Go Home
            </button>
          </>
        )}
      </div>
    </div>
  );
}
