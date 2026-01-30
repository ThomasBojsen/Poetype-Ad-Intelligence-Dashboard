import React from 'react';
import { useAuth } from './AuthContext';

interface ClientGuardProps {
  children: React.ReactNode;
}

export const ClientGuard: React.FC<ClientGuardProps> = ({ children }) => {
  const { user, loading, signInWithMagicLink } = useAuth();
  const [email, setEmail] = React.useState('');
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (loading) return null;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFF2EB] px-4">
        <div className="bg-white rounded-xl shadow-sm border border-[#EADFD8] p-8 max-w-md w-full space-y-4">
          <h2 className="text-xl font-semibold text-[#0B1221]">Client Login</h2>
          <p className="text-sm text-stone-500">Enter your email to receive a magic link.</p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D6453D]/20"
            placeholder="you@example.com"
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          {sent ? (
            <p className="text-sm text-stone-500">Check your email for the link.</p>
          ) : (
            <button
              onClick={async () => {
                setError(null);
                const { error } = await signInWithMagicLink(email);
                if (error) setError(error.message || 'Failed to send link');
                else setSent(true);
              }}
              className="w-full bg-[#0B1221] text-white rounded-lg py-2 text-sm font-medium hover:bg-stone-800"
            >
              Send Magic Link
            </button>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
