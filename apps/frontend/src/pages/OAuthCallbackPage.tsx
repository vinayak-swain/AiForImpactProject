import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../utils/api';
import { ParticleBackground } from '../components/ParticleBackground';

export const OAuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const token = searchParams.get('token');
      if (!token) {
        setError('No authentication token found in URL.');
        return;
      }

      try {
        // Store the access token
        localStorage.setItem('accessToken', token);
        
        // Fetch and store the user profile
        await api.fetchMe();
        
        // Redirect to dashboard
        navigate('/dashboard');
      } catch (err: any) {
        console.error('OAuth callback processing failed:', err);
        setError(err.message || 'Authentication failed. Please try again.');
        // Clean up partially set state
        localStorage.removeItem('accessToken');
        localStorage.removeItem('currentUser');
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="theme-celestial bg-background text-on-surface min-h-screen flex items-center justify-center flex-col gap-6 font-body relative">
      <ParticleBackground theme="login" />
      
      <div className="z-10 bg-surface/80 backdrop-blur-xl p-8 rounded-2xl border border-outline/20 shadow-2xl max-w-sm w-full text-center">
        {error ? (
          <div className="space-y-4">
            <span className="material-symbols-outlined text-error text-5xl">error</span>
            <h2 className="text-xl font-bold text-on-surface">Authentication Error</h2>
            <p className="text-sm text-on-surface-variant">{error}</p>
            <button
              onClick={() => navigate('/login')}
              className="w-full mt-4 py-3 bg-primary text-white font-bold rounded-full hover:brightness-110 active:scale-95 transition-all text-sm"
            >
              Back to Login
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="w-12 h-12 border-4 border-secondary border-t-transparent rounded-full animate-spin mx-auto"></div>
            <h2 className="text-xl font-bold text-on-surface">Completing Login</h2>
            <p className="text-sm text-on-surface-variant">Syncing your profile, please wait...</p>
          </div>
        )}
      </div>
    </div>
  );
};
