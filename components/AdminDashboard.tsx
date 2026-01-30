import React from 'react';
import { useAuth } from './AuthContext';

const AdminDashboard: React.FC = () => {
  const { user, signOut } = useAuth();

  // Placeholder admin UI scaffolding
  return (
    <div className="min-h-screen bg-[#FFF2EB] text-stone-900">
      <header className="flex items-center justify-between p-6 border-b border-[#EADFD8] bg-white/80 backdrop-blur-sm">
        <div>
          <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
          <p className="text-sm text-stone-500">Logged in as {user?.email}</p>
        </div>
        <button
          onClick={signOut}
          className="px-4 py-2 rounded-lg bg-[#0B1221] text-white text-sm font-medium hover:bg-stone-800"
        >
          Log ud
        </button>
      </header>

      <main className="p-6 space-y-6">
        <div className="bg-white border border-[#EADFD8] rounded-xl p-4 shadow-sm">
          <h2 className="text-lg font-semibold mb-2">Client management (placeholder)</h2>
          <p className="text-sm text-stone-500">To be implemented: add client users, assign brands/ad accounts.</p>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
