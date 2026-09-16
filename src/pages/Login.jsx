import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  
  const { login, loginWithGoogle, sendPasswordReset, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/dashboard';

  // ✅ Redirection automatique lorsque l'utilisateur est connecté
  useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
  }, [user, navigate, from]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }
    setLoading(true);
    await login(email, password);
    setLoading(false); // la redirection se fait via useEffect
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    await loginWithGoogle();
    setGoogleLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast.error('Veuillez renseigner votre adresse email');
      return;
    }
    setResetLoading(true);
    const result = await sendPasswordReset(email);
    setResetLoading(false);
    if (result.success) {
      toast.success('Un email de réinitialisation vous a été envoyé');
    } else {
      toast.error(result.error || 'Erreur lors de l’envoi');
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Partie gauche - Marque & visuel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex-col items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        </div>
        
        <div className="relative z-10 max-w-md text-center">
          <h1 className="text-6xl font-bold tracking-tight text-white mb-2">goCart</h1>
          <p className="text-xl italic font-light text-gray-300 border-t border-gray-600 inline-block px-6 pt-2">admin</p>
          <p className="mt-8 text-lg text-gray-300 leading-relaxed">Gérez votre back-office en toute simplicité.</p>
          <div className="mt-12 flex justify-center"><div className="w-20 h-1 bg-blue-500 rounded-full"></div></div>
          <p className="mt-12 text-sm text-gray-400">Tableau de bord • Statistiques • Commandes • Utilisateurs</p>
        </div>
      </div>

      {/* Partie droite - Formulaire */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-white">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900">goCart</h1>
            <p className="text-sm italic text-gray-500 border-t border-gray-200 inline-block px-4 pt-1">admin</p>
          </div>

          <div className="bg-white">
            <h2 className="text-2xl font-semibold text-gray-800 text-center mb-8">CONNECTEZ-VOUS</h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-500 focus:border-gray-500 bg-white transition"
                  placeholder="exemple@gocart.com"
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">Mot de passe</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-500 focus:border-gray-500 bg-white pr-10"
                    placeholder="••••••••"
                    required
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember"
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-4 w-4 border-gray-300 rounded text-gray-800 focus:ring-gray-500"
                  />
                  <label htmlFor="remember" className="ml-2 text-sm text-gray-600">Rester connecté</label>
                </div>
                <button type="button" onClick={handleForgotPassword} disabled={resetLoading} className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50">
                  {resetLoading ? 'Envoi...' : 'Mot de passe oublié ?'}
                </button>
              </div>

              <button type="submit" disabled={loading || googleLoading} className="w-full py-3 px-4 bg-gray-800 hover:bg-gray-900 text-white font-medium rounded-md transition-colors disabled:bg-gray-400 uppercase tracking-wider text-sm">
                {loading ? 'Connexion en cours...' : 'SE CONNECTER'}
              </button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-300"></div></div>
                <div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-gray-500">Ou</span></div>
              </div>

              <button type="button" onClick={handleGoogleLogin} disabled={loading || googleLoading} className="w-full py-3 px-4 border border-gray-300 rounded-md bg-white hover:bg-gray-50 text-gray-700 font-medium flex items-center justify-center gap-2 transition disabled:bg-gray-100 disabled:text-gray-400">
                {googleLoading ? (
                  <svg className="animate-spin h-5 w-5 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                )}
                {googleLoading ? 'Connexion...' : 'Google'}
              </button>
            </form>
          </div>

          <p className="text-center text-xs text-gray-400 mt-8">Version 2.1.0 • Designed by Karl BIFU</p>
        </div>
      </div>
    </div>
  );
};

export default Login;