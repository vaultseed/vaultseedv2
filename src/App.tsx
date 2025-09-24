import React, { useState, useEffect } from 'react';
import { Shield, Plus, Eye, EyeOff, Sun, Moon, Download, Github, MessageSquare } from 'lucide-react';
import { 
  encryptData, 
  decryptData, 
  getKey, 
  validatePassword, 
  generateSalt,
  getPasswordStrength 
} from './utils/crypto';
import { 
  saveVault, 
  loadVault, 
  getFailedAttempts, 
  setFailedAttempts, 
  recordFailedAttempt, 
  clearFailedAttempts, 
  isAccountLocked,
  recordIPFailedAttempt,
  clearIPFailedAttempts,
  isIPLocked,
  getAppSettings,
  saveAppSettings,
  deleteVault
} from './utils/storage';
import { authAPI, vaultAPI } from './utils/api';
import { VaultData, SeedPhrase, TooltipState } from './types/vault';
import FloatingInput from './components/FloatingInput';

export default function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [vaultData, setVaultData] = useState<VaultData>({ seeds: [], securityQuestions: [] });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newSeed, setNewSeed] = useState('');
  const [newSeedName, setNewSeedName] = useState('');
  const [showAddSeed, setShowAddSeed] = useState(false);
  const [securityAnswers, setSecurityAnswers] = useState(['', '']);
  const [storedSecurityQuestions, setStoredSecurityQuestions] = useState<string[]>([]);
  const [showSecurityVerification, setShowSecurityVerification] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Tooltip helper
  const showTooltip = (message: string, type: 'success' | 'error' | 'info') => {
    setTooltip({ message, type });
    setTimeout(() => setTooltip(null), 4000);
  };

  // Load vault helper
  const loadUserVault = async () => {
    try {
      const serverVault: any = await vaultAPI.get();
      if (serverVault && serverVault.data && serverVault.salt) {
        const key = await getKey(password, serverVault.salt);
        const decrypted = await decryptData(key, serverVault.data);
        if (decrypted) {
          setVaultData(JSON.parse(decrypted));
          return serverVault.salt;
        } else {
          showTooltip('Could not decrypt server vault. Wrong password?', 'error');
        }
      }
      setVaultData({ seeds: [], securityQuestions: [] });
      return null;
    } catch (error) {
      console.warn('Failed to load vault', error);
      showTooltip('Failed to load vault.', 'error');
      return null;
    }
  };

  // Login
  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await authAPI.login({ email, password });
      if (response && response.user) {
        setCurrentUser(response.user);
        if (response.user.securityQuestions?.length > 0) {
          setStoredSecurityQuestions(response.user.securityQuestions.map((sq: any) => sq.question));
          setShowSecurityVerification(true);
        } else {
          setIsAuthenticated(true);
          clearFailedAttempts(email);
          clearIPFailedAttempts();
          showTooltip('Login successful!', 'success');
          const salt = await loadUserVault();
          if (salt) localStorage.setItem('vaultseed_salt', salt);
        }
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err: any) {
      console.error(err);
      showTooltip('Login failed. Please check your credentials.', 'error');
      recordFailedAttempt(email);
      recordIPFailedAttempt();
    } finally {
      setLoading(false);
    }
  };

  // Add seed
  const handleAddSeed = async () => {
    if (!newSeed.trim()) {
      setError('Please enter a seed phrase');
      return;
    }

    const seedPhrase: SeedPhrase = {
      id: Date.now().toString(),
      seed: newSeed.trim(),
      name: newSeedName.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    const updatedVault: VaultData = {
      ...vaultData,
      seeds: [...(vaultData.seeds || []), seedPhrase],
    };

    try {
      let salt = localStorage.getItem('vaultseed_salt');
      if (!salt) {
        salt = generateSalt();
        localStorage.setItem('vaultseed_salt', salt);
      }
      const key = await getKey(password, salt);
      const encrypted = await encryptData(key, JSON.stringify(updatedVault));

      await vaultAPI.save(encrypted, salt);
      saveVault(email, { data: encrypted, salt });

      setVaultData(updatedVault);
      setNewSeed('');
      setNewSeedName('');
      setShowAddSeed(false);
      showTooltip('Seed phrase added successfully!', 'success');
    } catch (err) {
      setError('Failed to save seed phrase');
    }
  };

  // Delete seed
  const handleDeleteSeed = async (id: string) => {
    const updatedVault = {
      ...vaultData,
      seeds: (vaultData.seeds || []).filter(s => s.id !== id),
    };
    try {
      let salt = localStorage.getItem('vaultseed_salt');
      if (!salt) {
        salt = generateSalt();
        localStorage.setItem('vaultseed_salt', salt);
      }
      const key = await getKey(password, salt);
      const encrypted = await encryptData(key, JSON.stringify(updatedVault));
      await vaultAPI.save(encrypted, salt);
      saveVault(email, { data: encrypted, salt });

      setVaultData(updatedVault);
      showTooltip('Seed deleted', 'success');
    } catch (err) {
      showTooltip('Failed to delete seed', 'error');
    }
  };

  // Logout
  const handleLogout = () => {
    try {
      if (email) deleteVault(email);
    } catch (e) {}
    authAPI.logout();
    setIsAuthenticated(false);
    setCurrentUser(null);
    setVaultData({ seeds: [], securityQuestions: [] } as any);
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setSecurityAnswers(['', '']);
    setStoredSecurityQuestions([]);
    localStorage.removeItem('vaultseed_salt');
    showTooltip('Logged out', 'info');
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'}`}>
      {/* header */}
      <header className="p-4 flex justify-between items-center shadow">
        <div className="flex items-center gap-2">
          <Shield />
          <span className="font-bold text-lg">VaultSeed</span>
        </div>
        <div className="flex gap-4 items-center">
          <button onClick={() => setDarkMode(!darkMode)}>
            {darkMode ? <Sun /> : <Moon />}
          </button>
          {isAuthenticated && (
            <button className="bg-red-500 px-4 py-2 rounded text-white" onClick={handleLogout}>Logout</button>
          )}
        </div>
      </header>

      <main className="p-6">
        {!isAuthenticated ? (
          <div className="max-w-md mx-auto bg-white dark:bg-gray-800 p-6 rounded shadow">
            <FloatingInput label="Email" value={email} onChange={e => setEmail(e.target.value)} />
            <FloatingInput label="Password" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} />
            <button className="mt-4 bg-blue-600 text-white w-full py-2 rounded" onClick={handleLogin} disabled={loading}>
              {loading ? 'Loading...' : 'Login'}
            </button>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Your Seed Vault</h2>
              <button className="flex items-center gap-1 bg-green-600 text-white px-3 py-1 rounded" onClick={() => setShowAddSeed(true)}>
                <Plus size={16}/> Add Seed
              </button>
            </div>
            {vaultData.seeds && vaultData.seeds.length > 0 ? (
              <ul className="space-y-2">
                {vaultData.seeds.map(seed => (
                  <li key={seed.id} className="flex justify-between items-center p-2 bg-gray-200 dark:bg-gray-700 rounded">
                    <span>{seed.name || 'Unnamed Seed'}</span>
                    <button onClick={() => handleDeleteSeed(seed.id)} className="text-red-500">Delete</button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No seeds stored yet.</p>
            )}
            {showAddSeed && (
              <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-700 rounded">
                <FloatingInput label="Seed Phrase" value={newSeed} onChange={e => setNewSeed(e.target.value)} />
                <FloatingInput label="Name (optional)" value={newSeedName} onChange={e => setNewSeedName(e.target.value)} />
                <button className="mt-2 bg-blue-600 text-white px-4 py-2 rounded" onClick={handleAddSeed}>Save Seed</button>
              </div>
            )}
          </div>
        )}
      </main>

      {tooltip && (
        <div className={`fixed bottom-4 right-4 px-4 py-2 rounded shadow text-white ${tooltip.type === 'success' ? 'bg-green-600' : tooltip.type === 'error' ? 'bg-red-600' : 'bg-blue-600'}`}>
          {tooltip.message}
        </div>
      )}
    </div>
  );
}
