// src/App.tsx
import React, { useEffect, useState } from 'react';
import { Shield, Plus, Eye, EyeOff, Sun, Moon, Download, Github, MessageSquare } from 'lucide-react';
import {
  encryptData,
  decryptData,
  getKey,
  validatePassword,
  generateSalt,
  getPasswordStrength,
  exportVault as cryptoExportVault
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
  clearClipboardAfterDelay
} from './utils/storage';
import { authAPI, vaultAPI } from './utils/api';
import { VaultData, SeedPhrase, TooltipState } from './types/vault';

import FloatingInput from './components/FloatingInput';
import ActionButton from './components/ActionButton';
import SeedCard from './components/SeedCard';
import TabButton from './components/TabButton';
import Header from './components/Header';
import ExportModal from './components/ExportModal';
import FeedbackModal from './components/FeedbackModal';
import Tooltip from './components/Tooltip';
import FAQ from './components/FAQ';
import SecurityFeatures from './components/SecurityFeatures';
import SocialLinks from './components/SocialLinks';

/**
 * App.tsx
 *
 * Behavior summary (key fixes):
 * - Vaults are encrypted client-side and saved to server as { encryptedData, clientSalt } (matches your API).
 * - When logging in, the app tries to fetch server vault, decrypts using clientSalt/password, and loads it.
 * - If server vault can't be decrypted or is not present, fallback to local backup (loadVault).
 * - On any write (add/delete), the vault is encrypted client-side with clientSalt and saved both to server and to local backup.
 * - Local backup key uses saveVault(email, {data, salt}) so other devices can fallback (best-effort).
 * - Local storage key 'vaultseed_salt' holds the latest clientSalt (optionally removed on logout).
 *
 * Paste as-is into src/App.tsx
 */

function App(): JSX.Element {
  // Authentication / form state
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [securityQuestions, setSecurityQuestions] = useState<Array<{ question: string; answer: string }>>([
    { question: '', answer: '' },
    { question: '', answer: '' }
  ]);
  const [securityAnswers, setSecurityAnswers] = useState<string[]>(['', '']);

  // App state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [darkMode, setDarkMode] = useState<boolean>(false);

  // Vault state
  const [vaultData, setVaultData] = useState<VaultData>({ seeds: [], securityQuestions: [] } as VaultData);
  const [newSeed, setNewSeed] = useState<string>('');
  const [newSeedName, setNewSeedName] = useState<string>('');
  const [showAddSeed, setShowAddSeed] = useState<boolean>(false);

  // UI state
  const [activeTab, setActiveTab] = useState<'vault' | 'security' | 'faq'>('vault');
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState<boolean>(false);
  const [showSecurityVerification, setShowSecurityVerification] = useState<boolean>(false);
  const [storedSecurityQuestions, setStoredSecurityQuestions] = useState<string[]>([]);

  // Tooltip
  const [tooltip, setTooltip] = useState<TooltipState>({ show: false, message: '', type: 'info' });

  // page init: load app settings
  useEffect(() => {
    try {
      const settings = getAppSettings();
      if (settings && typeof settings.darkMode !== 'undefined') {
        setDarkMode(Boolean(settings.darkMode));
        document.documentElement.classList.toggle('dark', Boolean(settings.darkMode));
      }
    } catch (e) {
      // ignore
    }
  }, []);

  // persist dark mode changes
  useEffect(() => {
    try {
      saveAppSettings({ darkMode });
      document.documentElement.classList.toggle('dark', darkMode);
    } catch (e) {
      // ignore
    }
  }, [darkMode]);

  // Tooltip helpers
  const showTooltip = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setTooltip({ show: true, message, type });
    setTimeout(() => setTooltip({ show: false, message: '', type: 'info' }), 3000);
  };
  const hideTooltip = () => setTooltip({ show: false, message: '', type: 'info' });

  /**
   * Vault loading:
   * 1. Try server via vaultAPI.get() -> expects { encryptedData, clientSalt } or null
   * 2. If server returned vault: derive key with password + clientSalt, decrypt
   * 3. If server decryption fails or server empty: try local backup via loadVault(email)
   *
   * Returns the clientSalt used (string) or null if none loaded.
   */
  const loadUserVault = async (): Promise<string | null> => {
    try {
      // Attempt server
      try {
        const serverResp: any = await vaultAPI.get();
        if (serverResp && (serverResp.encryptedData || serverResp.data)) {
          // server may return { encryptedData, clientSalt } OR legacy { data, salt }
          const encryptedData = serverResp.encryptedData ?? serverResp.data;
          const clientSalt = serverResp.clientSalt ?? serverResp.salt;
          if (encryptedData && clientSalt) {
            try {
              const key = await getKey(password, clientSalt);
              const decrypted = await decryptData(key, encryptedData);
              if (decrypted) {
                const parsed = JSON.parse(decrypted);
                setVaultData(parsed);
                // store clientSalt locally for subsequent saves
                localStorage.setItem('vaultseed_salt', clientSalt);
                return clientSalt;
              } else {
                // can't decrypt server data with provided password -> fallback to local
                showTooltip('Could not decrypt server vault using the provided password — trying local backup', 'error');
              }
            } catch (e) {
              // decryption or parsing error -> fallback to local
              console.warn('server vault decrypt/parsing error', e);
              showTooltip('Could not decrypt server vault — trying local backup', 'error');
            }
          }
        }
      } catch (err) {
        // server read failed (network/auth) -> fallback to local
        console.warn('vaultAPI.get failed', err);
      }

      // Local fallback
      try {
        const local = loadVault(email);
        if (local && local.data && local.salt) {
          const key = await getKey(password, local.salt);
          const decrypted = await decryptData(key, local.data);
          if (decrypted) {
            const parsed = JSON.parse(decrypted);
            setVaultData(parsed);
            // If server empty, best-effort push local to server
            try {
              const serverCheck = await vaultAPI.get();
              const serverHas = serverCheck && (serverCheck.encryptedData || serverCheck.data);
              if (!serverHas) {
                await vaultAPI.save(local.data, local.salt);
              }
            } catch (pushErr) {
              console.warn('push local backup to server failed', pushErr);
            }
            localStorage.setItem('vaultseed_salt', local.salt);
            return local.salt;
          } else {
            showTooltip('Unable to decrypt local vault — check that your password is correct', 'error');
          }
        }
      } catch (localErr) {
        console.warn('local vault decrypt error', localErr);
      }

      // nothing found anywhere -> initialize empty vault
      setVaultData({ seeds: [], securityQuestions: [] } as VaultData);
      return null;
    } catch (err) {
      console.warn('loadUserVault generic error', err);
      showTooltip('Failed to load vault', 'error');
      return null;
    }
  };

  /**
   * Save current vault to server and local backup.
   * - Ensures a clientSalt exists (creates one if necessary).
   */
  const saveCurrentVault = async (): Promise<void> => {
    try {
      let clientSalt = localStorage.getItem('vaultseed_salt');
      if (!clientSalt) {
        clientSalt = generateSalt();
        localStorage.setItem('vaultseed_salt', clientSalt);
      }
      const key = await getKey(password || '', clientSalt);
      const encrypted = await encryptData(key, JSON.stringify(vaultData));

      // best-effort: save to server, but don't block on failure
      try {
        await vaultAPI.save(encrypted, clientSalt);
      } catch (err) {
        console.warn('vaultAPI.save failed, saving local backup only', err);
        showTooltip('Warning: could not save to server. Saved locally as fallback.', 'error');
      }

      // always save local backup so other devices can fallback
      saveVault(email, { data: encrypted, salt: clientSalt });
    } catch (err) {
      console.error('saveCurrentVault failed', err);
      showTooltip('Failed to save vault', 'error');
    }
  };

  // ---------- Registration ----------
  const handleRegister = async () => {
    if (!email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (!validatePassword(password)) {
      setError('Password must be at least 8 characters with uppercase, lowercase, number, and special character');
      return;
    }
    if (securityQuestions.some(sq => !sq.question || !sq.answer)) {
      setError('Please fill in both security questions and answers');
      return;
    }

    const ipLock = isIPLocked();
    if (ipLock.locked) {
      setError(`Too many failed attempts. Try again in ${ipLock.timeLeft} minutes.`);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const salt = generateSalt();
      const resp = await authAPI.register({
        email,
        password,
        securityQuestions,
        salt
      });
      if (resp && resp.token) {
        showTooltip('Registration successful. Please login.', 'success');
        setIsLogin(true);
        setPassword('');
        setConfirmPassword('');
      } else {
        showTooltip('Registration completed (no token returned). Please login.', 'success');
        setIsLogin(true);
      }
    } catch (err: any) {
      recordIPFailedAttempt();
      setError(err?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  // ---------- Login ----------
  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }

    const lockStatus = isAccountLocked(email);
    if (lockStatus.locked) {
      setError(`Account locked. Try again in ${lockStatus.timeLeft} minutes.`);
      return;
    }

    const ipLock = isIPLocked();
    if (ipLock.locked) {
      setError(`Too many failed attempts. Try again in ${ipLock.timeLeft} minutes.`);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const resp = await authAPI.login({ email, password });
      if (resp && resp.user) {
        setCurrentUser(resp.user);
        // If server requires security question verification, show it
        if (resp.user.securityQuestions && resp.user.securityQuestions.length > 0) {
          setStoredSecurityQuestions(resp.user.securityQuestions.map((sq: any) => sq.question));
          setShowSecurityVerification(true);
        } else {
          setIsAuthenticated(true);
          clearFailedAttempts(email);
          clearIPFailedAttempts();
          showTooltip('Login successful!', 'success');
          await loadUserVault();
        }
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err: any) {
      console.warn('login error', err);
      recordFailedAttempt(email);
      recordIPFailedAttempt();
      setError(err?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // ---------- Security verification ----------
  const handleSecurityVerification = async () => {
    if (securityAnswers.some(a => !a.trim())) {
      setError('Please answer both security questions');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await authAPI.verifySecurityQuestions({
        email,
        answers: securityAnswers
      });

      setIsAuthenticated(true);
      setShowSecurityVerification(false);
      clearFailedAttempts(email);
      clearIPFailedAttempts();
      showTooltip('Security verification successful!', 'success');
      await loadUserVault();
    } catch (err: any) {
      recordFailedAttempt(email);
      recordIPFailedAttempt();
      setError(err?.message || 'Security verification failed');
    } finally {
      setLoading(false);
    }
  };

  // ---------- Add seed ----------
  const handleAddSeed = async () => {
    if (!newSeed.trim()) {
      setError('Please enter a seed phrase');
      return;
    }

    const seedPhrase: SeedPhrase = {
      id: Date.now().toString(),
      seed: newSeed.trim(),
      name: newSeedName.trim() || undefined,
      createdAt: new Date().toISOString()
    };

    const updatedVault: VaultData = {
      ...vaultData,
      seeds: [...(vaultData.seeds || []), seedPhrase]
    };

    // Update UI immediately
    setVaultData(updatedVault);

    try {
      // Ensure clientSalt exists
      let clientSalt = localStorage.getItem('vaultseed_salt');
      if (!clientSalt) {
        clientSalt = generateSalt();
        localStorage.setItem('vaultseed_salt', clientSalt);
      }

      const key = await getKey(password || '', clientSalt);
      const encrypted = await encryptData(key, JSON.stringify(updatedVault));

      // Save to server (best-effort)
      try {
        await vaultAPI.save(encrypted, clientSalt);
      } catch (err) {
        console.warn('Failed to save to server', err);
        showTooltip('Could not save to server. Saved locally as backup.', 'error');
      }

      // Save local backup
      saveVault(email, { data: encrypted, salt: clientSalt });

      // cleanup form
      setNewSeed('');
      setNewSeedName('');
      setShowAddSeed(false);
      showTooltip('Seed phrase added successfully!', 'success');
    } catch (err) {
      console.error('Failed to add seed:', err);
      setError('Failed to save seed phrase');
    }
  };

  // ---------- Delete seed ----------
  const handleDeleteSeed = async (id: string) => {
    const updatedVault = {
      ...vaultData,
      seeds: (vaultData.seeds || []).filter(s => s.id !== id)
    };

    // Update UI immediately
    setVaultData(updatedVault);

    try {
      let clientSalt = localStorage.getItem('vaultseed_salt');
      if (!clientSalt) {
        clientSalt = generateSalt();
        localStorage.setItem('vaultseed_salt', clientSalt);
      }

      const key = await getKey(password || '', clientSalt);
      const encrypted = await encryptData(key, JSON.stringify(updatedVault));

      try {
        await vaultAPI.save(encrypted, clientSalt);
      } catch (err) {
        console.warn('Failed to delete seed on server', err);
      }

      saveVault(email, { data: encrypted, salt: clientSalt });
      showTooltip('Seed phrase deleted', 'success');
    } catch (err) {
      console.error('Failed to delete seed:', err);
      showTooltip('Failed to delete seed', 'error');
    }
  };

  // ---------- Export vault ----------
  const handleExport = async (exportPassword: string) => {
    try {
      const exportJson = await cryptoExportVault(vaultData, exportPassword);
      const blob = new Blob([exportJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vaultseed_export_${email || 'user'}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showTooltip('Exported vault JSON', 'success');
    } catch (err) {
      console.error('Export failed', err);
      showTooltip('Failed to export vault', 'error');
    }
  };

  // ---------- Logout ----------
  const handleLogout = () => {
    try {
      // By design we keep the server copy. Local backup remains as fallback.
      // If you instead want to remove local backup on logout, uncomment:
      // localStorage.removeItem(`vaultseed_${btoa(email)}`);
      authAPI.logout();
    } catch (e) {
      // ignore
    }
    setIsAuthenticated(false);
    setCurrentUser(null);
    setVaultData({ seeds: [], securityQuestions: [] } as VaultData);
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setSecurityAnswers(['', '']);
    setStoredSecurityQuestions([]);
    // Remove ephemeral clientSalt for security (optional)
    localStorage.removeItem('vaultseed_salt');
    showTooltip('Logged out', 'info');
  };

  // ---------- UI helpers ----------
  const switchMode = (loginMode: boolean) => {
    setIsLogin(loginMode);
    setError('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setSecurityQuestions([{ question: '', answer: '' }, { question: '', answer: '' }]);
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setSecurityQuestions([{ question: '', answer: '' }, { question: '', answer: '' }]);
    setSecurityAnswers(['', '']);
    setError('');
  };

  // -------------------------
  // Render
  // -------------------------
  if (isAuthenticated) {
    return (
      <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900' : 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50'}`}>
        <Header
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode(!darkMode)}
          onLogout={handleLogout}
          onExport={() => setShowExportModal(true)}
          userEmail={currentUser?.email}
        />

        <div className="container mx-auto px-4 py-8">
          <div className="max-w-6xl mx-auto">
            {/* Tab Navigation */}
            <div className="flex flex-wrap gap-2 mb-8">
              <TabButton active={activeTab === 'vault'} onClick={() => setActiveTab('vault')} darkMode={darkMode}>My Vault</TabButton>
              <TabButton active={activeTab === 'security'} onClick={() => setActiveTab('security')} darkMode={darkMode}>Security</TabButton>
              <TabButton active={activeTab === 'faq'} onClick={() => setActiveTab('faq')} darkMode={darkMode}>FAQ</TabButton>
            </div>

            {/* Tab Content */}
            {activeTab === 'vault' && (
              <div>
                {/* Add Seed Section */}
                <div className={`backdrop-blur-sm rounded-2xl p-6 shadow-xl border mb-8 ${darkMode ? 'bg-gray-800/90 border-gray-700/30' : 'bg-white/90 border-white/30'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className={`text-xl font-bold ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>Add New Seed Phrase</h2>
                    <button onClick={() => setShowAddSeed(!showAddSeed)} className={`p-2 rounded-lg transition-colors ${darkMode ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>

                  {showAddSeed && (
                    <div className="space-y-4">
                      <FloatingInput id="seedName" label="Seed Name (Optional)" value={newSeedName} onChange={setNewSeedName} placeholder="e.g., MetaMask Wallet" darkMode={darkMode} />
                      <FloatingInput id="seedPhrase" label="Seed Phrase" value={newSeed} onChange={setNewSeed} placeholder="Enter your 12 or 24 word seed phrase" isTextarea required darkMode={darkMode} />
                      <div className="flex gap-3">
                        <ActionButton onClick={handleAddSeed} disabled={!newSeed.trim()} darkMode={darkMode}>Add Seed</ActionButton>
                        <ActionButton onClick={() => { setShowAddSeed(false); setNewSeed(''); setNewSeedName(''); }} variant="secondary" darkMode={darkMode}>Cancel</ActionButton>
                      </div>
                    </div>
                  )}
                </div>

                {/* Seeds List */}
                <div className="grid gap-6">
                  {(vaultData?.seeds || []).length === 0 ? (
                    <div className={`text-center py-12 backdrop-blur-sm rounded-2xl border ${darkMode ? 'bg-gray-800/90 border-gray-700/30' : 'bg-white/90 border-white/30'}`}>
                      <Shield className={`w-16 h-16 mx-auto mb-4 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`} />
                      <h3 className={`text-xl font-semibold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>No seed phrases yet</h3>
                      <p className={`${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Add your first seed phrase to get started</p>
                    </div>
                  ) : (
                    (vaultData.seeds || []).map((seed) => (
                      <SeedCard
                        key={seed.id}
                        seed={seed}
                        darkMode={darkMode}
                        onDelete={() => handleDeleteSeed(seed.id)}
                        onCopy={() => { clearClipboardAfterDelay(seed.seed, 30000); showTooltip('Copied to clipboard for 30s', 'success'); }}
                      />
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-8">
                <div className={`backdrop-blur-sm rounded-2xl p-6 shadow-xl border ${darkMode ? 'bg-gray-800/90 border-gray-700/30' : 'bg-white/90 border-white/30'}`}>
                  <div className="flex items-center mb-6">
                    <Shield className={`w-6 h-6 mr-3 ${darkMode ? 'text-purple-400' : 'text-indigo-600'}`} />
                    <h2 className={`text-xl font-bold ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>Account Security Settings</h2>
                  </div>

                  <div className="grid md:grid-cols-2 gap-8">
                    <div className={`p-6 rounded-xl border ${darkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                      <h3 className={`text-lg font-semibold mb-4 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>Change Password</h3>
                      <div className="space-y-4">
                        <FloatingInput id="currentPassword" label="Current Password" value="" onChange={() => {}} isPassword required darkMode={darkMode} />
                        <FloatingInput id="newPassword" label="New Password" value="" onChange={() => {}} isPassword required darkMode={darkMode} showPasswordStrength />
                        <FloatingInput id="confirmNewPassword" label="Confirm New Password" value="" onChange={() => {}} isPassword required darkMode={darkMode} />
                        <ActionButton onClick={() => showTooltip('Password updated successfully!', 'success')} darkMode={darkMode}>Update Password</ActionButton>
                      </div>
                    </div>

                    <div className={`p-6 rounded-xl border ${darkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                      <h3 className={`text-lg font-semibold mb-4 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>Update Security Questions</h3>
                      <div className="space-y-4">
                        <div>
                          <h5 className={`text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Security Question 1</h5>
                          <FloatingInput id="updateQuestion1" label="What was your first pet's name?" value="" onChange={() => {}} placeholder="New answer" required darkMode={darkMode} />
                        </div>
                        <div>
                          <h5 className={`text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Security Question 2</h5>
                          <FloatingInput id="updateQuestion2" label="What city were you born in?" value="" onChange={() => {}} placeholder="New answer" required darkMode={darkMode} />
                        </div>
                        <ActionButton onClick={() => showTooltip('Security questions updated successfully!', 'success')} darkMode={darkMode}>Update Security Questions</ActionButton>
                      </div>
                    </div>
                  </div>
                </div>

                <SecurityFeatures darkMode={darkMode} />
              </div>
            )}

            {activeTab === 'faq' && <FAQ darkMode={darkMode} />}
          </div>
        </div>

        <SocialLinks darkMode={darkMode} onFeedbackClick={() => setShowFeedbackModal(true)} />

        <ExportModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          vaultData={vaultData}
          darkMode={darkMode}
          onSuccess={(message) => showTooltip(message, 'success')}
          onExport={handleExport}
        />

        <FeedbackModal isOpen={showFeedbackModal} onClose={() => setShowFeedbackModal(false)} darkMode={darkMode} onSuccess={(message) => showTooltip(message, 'success')} />

        <Tooltip show={tooltip.show} message={tooltip.message} type={tooltip.type} onHide={hideTooltip} darkMode={darkMode} />
      </div>
    );
  }

  // Security verification screen
  if (showSecurityVerification) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 transition-colors duration-300 ${darkMode ? 'bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900' : 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50'}`}>
        <div className={`w-full max-w-md backdrop-blur-sm rounded-2xl p-6 sm:p-8 shadow-2xl border ${darkMode ? 'bg-gray-800/90 border-gray-700/30' : 'bg-white/90 border-white/30'}`}>
          <div className="text-center mb-6">
            <Shield className={`w-12 h-12 mx-auto mb-4 ${darkMode ? 'text-purple-400' : 'text-indigo-600'}`} />
            <h2 className={`text-2xl font-bold mb-2 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>Security Verification</h2>
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Please answer your security questions</p>
          </div>

          <div className="space-y-4">
            {storedSecurityQuestions.map((question, index) => (
              <FloatingInput
                key={index}
                id={`securityAnswer${index}`}
                label={question}
                value={securityAnswers[index]}
                onChange={(value) => {
                  const newAnswers = [...securityAnswers];
                  newAnswers[index] = value;
                  setSecurityAnswers(newAnswers);
                  setError('');
                }}
                required
                darkMode={darkMode}
              />
            ))}
          </div>

          {error && <p className="text-red-500 text-sm mt-4 text-center">{error}</p>}

          <div className="mt-6 space-y-3">
            <ActionButton onClick={handleSecurityVerification} loading={loading} disabled={securityAnswers.some(answer => !answer.trim())} darkMode={darkMode}>Verify</ActionButton>
            <ActionButton onClick={() => { setShowSecurityVerification(false); resetForm(); }} variant="secondary" darkMode={darkMode}>Back to Login</ActionButton>
          </div>
        </div>

        <Tooltip show={tooltip.show} message={tooltip.message} type={tooltip.type} onHide={hideTooltip} darkMode={darkMode} />
      </div>
    );
  }

  // Landing / auth screen
  return (
    <div className={`min-h-screen flex items-center justify-center p-4 transition-colors duration-300 ${darkMode ? 'bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900' : 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50'}`}>
      <div className="w-full max-w-7xl">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 mb-12">
          {/* Left side - Branding + Auth */}
          <div className="lg:w-1/2">
            <div className="mb-8">
              <div className="flex items-center mb-6">
                <Shield className={`w-12 h-12 sm:w-16 sm:h-16 mr-3 sm:mr-4 ${darkMode ? 'text-purple-400' : 'text-indigo-600'}`} />
                <div>
                  <h1 className={`text-3xl sm:text-4xl lg:text-5xl font-bold ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>VaultSeed</h1>
                  <p className={`text-sm sm:text-base ${darkMode ? 'text-purple-400' : 'text-indigo-600'}`}>Secure Seed Phrase Manager</p>
                </div>
              </div>

              <p className={`text-lg mb-6 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Enterprise-grade encryption for your crypto seed phrases with zero-knowledge architecture</p>

              <div className="flex flex-wrap gap-4 mb-6">
                <div className={`flex items-center text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}><Shield className="w-4 h-4 mr-2 text-green-500" />AES-256 Encryption</div>
                <div className={`flex items-center text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}><Eye className="w-4 h-4 mr-2 text-green-500" />Zero-Knowledge</div>
                <div className={`flex items-center text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}><Github className="w-4 h-4 mr-2 text-green-500" />Open Source</div>
              </div>

              <div className="flex items-center space-x-4 mb-8">
                <a href="https://github.com/vaultseed/vaultseedv2" target="_blank" rel="noopener noreferrer" className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors text-sm ${darkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}><Github className="w-4 h-4" /><span>View Source</span></a>
                <button onClick={() => setDarkMode(!darkMode)} className={`p-2 rounded-lg transition-colors ${darkMode ? 'bg-gray-800 text-yellow-400 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}</button>
              </div>
            </div>

            <div className={`backdrop-blur-sm rounded-2xl p-6 sm:p-8 shadow-2xl border transition-all duration-300 ${darkMode ? 'bg-gray-800/90 border-gray-700/30' : 'bg-white/90 border-white/30'}`}>
              {/* Tab buttons */}
              <div className="flex mb-6 sm:mb-8">
                <button onClick={() => switchMode(true)} className={`flex-1 py-3 px-4 text-center font-semibold transition-all duration-200 rounded-l-xl ${isLogin ? (darkMode ? 'bg-gray-700 text-purple-400 border-b-2 border-purple-400' : 'bg-gray-50 text-indigo-600 border-b-2 border-indigo-600') : (darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700')}`}>Login</button>
                <button onClick={() => switchMode(false)} className={`flex-1 py-3 px-4 text-center font-semibold transition-all duration-200 rounded-r-xl ${!isLogin ? (darkMode ? 'bg-gray-700 text-purple-400 border-b-2 border-purple-400' : 'bg-gray-50 text-indigo-600 border-b-2 border-indigo-600') : (darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700')}`}>Register</button>
              </div>

              {/* Form */}
              <div className={isLogin ? 'space-y-4' : 'space-y-6'}>
                <FloatingInput id="email" label="Email" type="email" value={email} onChange={(value) => { setEmail(value); setError(''); }} placeholder="Enter your email" required darkMode={darkMode} />

                <FloatingInput id="password" label="Password" value={password} onChange={(value) => { setPassword(value); setError(''); }} placeholder="Enter your password" isPassword required darkMode={darkMode} showPasswordStrength={!isLogin} />

                {!isLogin && (
                  <>
                    <FloatingInput id="confirmPassword" label="Confirm Password" value={confirmPassword} onChange={(value) => { setConfirmPassword(value); setError(''); }} placeholder="Confirm your password" isPassword required darkMode={darkMode} />

                    <div className={`p-4 rounded-lg border ${darkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                      <h4 className={`font-semibold mb-3 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>Security Questions</h4>
                      <p className={`text-sm mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>These are required to access your vault in the future.</p>

                      <div className="mb-4">
                        <h5 className={`text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Security Question 1 *</h5>
                        <FloatingInput id="question1" label="What was your first pet's name?" value={securityQuestions[0].answer} onChange={(value) => { const newQ = [...securityQuestions]; newQ[0].question = "What was your first pet's name?"; newQ[0].answer = value; setSecurityQuestions(newQ); setError(''); }} placeholder="Your answer" required darkMode={darkMode} />
                      </div>

                      <div className="mb-4">
                        <h5 className={`text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Security Question 2 *</h5>
                        <FloatingInput id="question2" label="What city were you born in?" value={securityQuestions[1].answer} onChange={(value) => { const newQ = [...securityQuestions]; newQ[1].question = "What city were you born in?"; newQ[1].answer = value; setSecurityQuestions(newQ); setError(''); }} placeholder="Your answer" required darkMode={darkMode} />
                      </div>
                    </div>
                  </>
                )}

                {error && (
                  <p className="text-red-500 text-sm text-center flex items-center justify-center">
                    <span className="w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center mr-2">!</span>
                    {error}
                  </p>
                )}

                <ActionButton
                  onClick={isLogin ? handleLogin : handleRegister}
                  loading={loading}
                  disabled={
                    !email || !password ||
                    (!isLogin && (!confirmPassword || securityQuestions.some(sq => !sq.question || !sq.answer)))
                  }
                  darkMode={darkMode}
                >
                  {isLogin ? 'Login' : 'Create Account'}
                </ActionButton>
              </div>
            </div>
          </div>

          {/* Right side - security features */}
          <div className="lg:w-1/2">
            <SecurityFeatures darkMode={darkMode} />
          </div>
        </div>

        {/* FAQ */}
        <div className="mb-12"><FAQ darkMode={darkMode} /></div>

        {/* Feedback & Social */}
        <SocialLinks darkMode={darkMode} onFeedbackClick={() => setShowFeedbackModal(true)} />
      </div>

      <FeedbackModal isOpen={showFeedbackModal} onClose={() => setShowFeedbackModal(false)} darkMode={darkMode} onSuccess={(message) => showTooltip(message, 'success')} />

      <Tooltip show={tooltip.show} message={tooltip.message} type={tooltip.type} onHide={hideTooltip} darkMode={darkMode} />
    </div>
  );
}

export default App;
