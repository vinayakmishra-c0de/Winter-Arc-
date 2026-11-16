import React, { useState } from 'react';
import { Eye, EyeOff, Lock, LogIn, Mail } from 'lucide-react';

interface LoginPageProps {
  onLogin: (email: string, password: string) => Promise<void>;
  errorMessage: string;
  isSubmitting: boolean;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLogin,
  errorMessage,
  isSubmitting,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setLocalError('Please enter both email and password.');
      return;
    }
    setLocalError('');
    await onLogin(trimmedEmail, password);
  };

  const displayError = localError || errorMessage;

  return (
    <div className="min-h-screen w-full px-4 py-8 flex flex-col items-center justify-between">
      <div className="flex-1 w-full flex items-center justify-center">
        <div className="neu-surface rounded-3xl w-full max-w-md p-6 sm:p-8 space-y-6">
          {/* Brand Header */}
          <div className="flex flex-col items-center text-center space-y-3">
            <div
              className="w-12 h-12 rounded-2xl neu-mint flex items-center justify-center"
              aria-hidden="true"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-[#153226]"
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </div>
            <div>
              <h1 className="font-display font-bold text-xl sm:text-2xl tracking-tight text-[#1E2420]">
                Winter Arc Command Center
              </h1>
              <p className="text-xs sm:text-sm text-[#5A625C] mt-1">
                Sign in with your authorized email and password
              </p>
            </div>
          </div>

          {/* Email & Password Only Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <label
                htmlFor="login-email"
                className="block text-xs font-semibold text-[#5A625C]"
              >
                Email Address
              </label>
              <div className="relative">
                <Mail
                  className="w-4 h-4 text-[#7C847D] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (localError) setLocalError('');
                  }}
                  placeholder="you@example.com"
                  className="neu-input w-full rounded-xl pl-10 pr-4 py-2.5 text-sm"
                  autoFocus
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="login-password"
                className="block text-xs font-semibold text-[#5A625C]"
              >
                Password
              </label>
              <div className="relative">
                <Lock
                  className="w-4 h-4 text-[#7C847D] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (localError) setLocalError('');
                  }}
                  placeholder="Enter your password"
                  className="neu-input w-full rounded-xl pl-10 pr-10 py-2.5 text-sm"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#7C847D] hover:text-[#1E2420] cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {displayError && (
              <div
                role="alert"
                className="neu-well-sm rounded-xl px-3.5 py-2.5 text-xs font-medium text-[#B91C1C]"
              >
                {displayError}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="neu-mint w-full rounded-xl py-3 px-4 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <LogIn className="w-4 h-4" />
              <span>{isSubmitting ? 'Signing In...' : 'Sign In'}</span>
            </button>
          </form>
        </div>
      </div>

      <footer className="neu-surface rounded-2xl px-5 py-3 text-center mt-6">
        <p className="text-xs sm:text-sm font-medium text-[#5A625C]">
          Built by <span className="font-semibold text-[#1E2420]">Vinayak Mishra</span> ( IIT Madras ) |{' '}
          <a
            href="tel:+919508355456"
            className="font-mono tabular-nums font-semibold text-[#153226] hover:underline"
          >
            +91 9508355456
          </a>
        </p>
      </footer>
    </div>
  );
};
