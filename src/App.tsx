import React, { useState, useEffect } from 'react';
import { Shield, Plus, Eye, EyeOff, Download, Upload, Trash2, Copy, Lock, Unlock, Moon, Sun, Github, MessageSquare } from 'lucide-react';
import { getKey, encryptData, decryptData, validatePassword, generateSalt, getPasswordStrength, exportVault } from './utils/crypto';
import { 
  saveVault, 
  loadVault, 
  getFailedAttempts, 
  setFailedAttempts, 
  isAccountLocked, 
  recordFailedAttempt, 
  clearFailedAttempts,
  clearClipboardAfterDelay,
  getAppSettings,
  saveAppSettings,
  isIPLocked,
  recordIPFailedAttempt,
  clearIPFailedAttempts
} from './utils/storage';
import { authAPI, vaultAPI } from './utils/api';
import { VaultData, SeedPhrase, SecurityQuestion, TooltipState } from './types/vault';
import Header from './components/Header';
import TabButton from './components/TabButton';
import FloatingInput from './components/FloatingInput';
import ActionButton from './components/ActionButton';
import SeedCard from './components/SeedCard';
import ExportModal from './components/ExportModal';
import FeedbackModal from './components/FeedbackModal';
import Tooltip from './components/Tooltip';
import SecurityFeatures from './components/SecurityFeatures';
import FAQ from './components/FAQ';
import SocialLinks from './components/SocialLinks';

function App() {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  
  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityQuestions, setSecurityQuestions] = useState<SecurityQuestion[]>([
    { question: '', answer: '' },
    { question: '', answer: '' }
  ]);
  
  // Vault state
  const [vaultData, setVaultData] = useState<VaultData>({ seeds: [], securityQuestions: [] });
  const [isVaultUnlocked, setIsVaultUnlocked] = useState(false);
  const [masterPassword, setMasterPassword] = useState('');
  const [newSeedPhrase, setNewSeedPhrase] = useState('');
  const [newSeedName, setNewSeedName] = useState('');
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipState>({ show: false, message: '', type: 'info' });

  // Load settings on mount
  useEffect(() => {
    const settings = getAppSettings();
    setDarkMode(settings.darkMode);
    
    // Check if user is already logged in
    const token = localStorage.getItem('vaultseed_token');
    const user = localStorage.getItem('vaultseed_user');
    if (token && user) {
      setCurrentUser(JSON.parse(user));
      setIsAuthenticated(true);
    }
  }, []);

  // Apply dark mode to document
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    saveAppSettings({ darkMode });
  }, [darkMode]);

  const showTooltip = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setTooltip({ show: true, message, type });
  };

  const hideTooltip = () => {
    setTooltip({ show: false, message: '', type: 'info' });
  };

  const handleRegister = async () => {
    // Check IP-based rate limiting first
    const ipLockStatus = isIPLocked();
    if (ipLockStatus.locked) {
      setError(`Too many failed attempts from this device. Try again in ${ipLockStatus.timeLeft} minutes.`);
      return;
    }

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

    setLoading(true);
    setError('');

    try {
      const salt = generateSalt();
      
      await authAPI.register({
        email,
        password,
        securityQuestions,
        salt
      });

      clearIPFailedAttempts();
      showTooltip('Account created successfully! You can now log in.', 'success');
      setAuthMode('login');
      setPassword('');
      setConfirmPassword('');
      setSecurityQuestions([{ question: '', answer: '' }, { question: '', answer: '' }]);
    } catch (error: any) {
      recordIPFailedAttempt();
      setError(error.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    // Check IP-based rate limiting first
    const ipLockStatus = isIPLocked();
    if (ipLockStatus.locked) {
      setError(`Too many failed attempts from this device. Try again in ${ipLockStatus.timeLeft} minutes.`);
      return;
    }

    // Check account-specific locking
    const lockStatus = isAccountLocked(email);
    if (lockStatus.locked) {
      setError(`Account locked due to failed attempts. Try again in ${lockStatus.timeLeft} minutes.`);
      return;
    }

    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await authAPI.login({ email, password });
      
      clearFailedAttempts(email);
      clearIPFailedAttempts();
      setCurrentUser(response.user);
      setIsAuthenticated(true);
      showTooltip('Login successful!', 'success');
    } catch (error: any) {
      recordFailedAttempt(email);
      recordIPFailedAttempt();
      setError(error.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlockVault = async () => {
    if (!masterPassword) {
      setError('Please enter your master password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Try to load vault from server first
      try {
        const serverVault = await vaultAPI.get();
        if (serverVault.encryptedData && serverVault.clientSalt) {
          const key = await getKey(masterPassword, serverVault.clientSalt);
          const decrypted = await decryptData(key, serverVault.encryptedData);
          
          if (decrypted) {
            const data = JSON.parse(decrypted);
            setVaultData(data);
            setIsVaultUnlocked(true);
            showTooltip('Vault unlocked successfully!', 'success');
            return;
          }
        }
      } catch (serverError) {
        console.log('Server vault not found, checking local storage');
      }

      // Fallback to local storage
      const stored = loadVault(currentUser.email);
      if (stored) {
        const key = await getKey(masterPassword, stored.salt);
        const decrypted = await decryptData(key, stored.data);
        
        if (decrypted) {
          const data = JSON.parse(decrypted);
          setVaultData(data);
          setIsVaultUnlocked(true);
          showTooltip('Vault unlocked successfully!', 'success');
        } else {
          setError('Invalid master password');
        }
      } else {
        // New vault
        setVaultData({ seeds: [], securityQuestions: [] });
        setIsVaultUnlocked(true);
        showTooltip('New vault created!', 'success');
      }
    } catch (error) {
      setError('Failed to unlock vault');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSeed = async () => {
    if (!newSeedPhrase.trim()) {
      setError('Please enter a seed phrase');
      return;
    }

    const newSeed: SeedPhrase = {
      id: Date.now().toString(),
      seed: newSeedPhrase.trim(),
      name: newSeedName.trim() || 'Unnamed Wallet',
      createdAt: new Date().toISOString()
    };

    const updatedVault = {
      ...vaultData,
      seeds: [...vaultData.seeds, newSeed]
    };

    await saveVaultData(updatedVault);
    setNewSeedPhrase('');
    setNewSeedName('');
    showTooltip('Seed phrase added successfully!', 'success');
  };

  const handleDeleteSeed = async (id: string) => {
    const updatedVault = {
      ...vaultData,
      seeds: vaultData.seeds.filter(seed => seed.id !== id)
    };

    await saveVaultData(updatedVault);
    showTooltip('Seed phrase deleted', 'success');
  };

  const saveVaultData = async (data: VaultData) => {
    try {
      const salt = generateSalt();
      const key = await getKey(masterPassword, salt);
      const encrypted = await encryptData(key, JSON.stringify(data));
      
      // Save to server
      try {
        await vaultAPI.save(encrypted, salt);
      } catch (serverError) {
        console.log('Server save failed, saving locally');
        // Fallback to local storage
        saveVault(currentUser.email, { salt, data: encrypted });
      }
      
      setVaultData(data);
    } catch (error) {
      showTooltip('Failed to save vault', 'error');
    }
  };

  const handleLogout = () => {
    authAPI.logout();
    setIsAuthenticated(false);
    setCurrentUser(null);
    setIsVaultUnlocked(false);
    setVaultData({ seeds: [], securityQuestions: [] });
    setMasterPassword('');
    setEmail('');
    setPassword('');
    showTooltip('Logged out successfully', 'success');
  };

  const handleCopyFeedback = (message: string) => {
    showTooltip(message, 'success');
  };

  // Background gradient based on theme
  const backgroundClass = darkMode 
    ? 'min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-indigo-900'
    : 'min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50';

  if (!isAuthenticated) {
    return (
      <div className={backgroundClass}>
        <Tooltip {...tooltip} onHide={hideTooltip} darkMode={darkMode} />
        <div className="container mx-auto px-4 py-8">
          <Header 
            darkMode={darkMode} 
            onToggleDarkMode={() => setDarkMode(!darkMode)} 
          />
          
          <div className="max-w-md mx-auto">
            <div className={`backdrop-blur-sm rounded-2xl p-6 shadow-2xl border transition-all duration-300 ${
              darkMode 
                ? 'bg-gray-800/80 border-gray-700/20' 
                : 'bg-white/80 border-white/20'
            } ${authMode === 'login' ? 'min-h-[400px]' : 'min-h-[600px]'}`}>
              
              <div className="flex justify-center mb-6">
                <div className="flex bg-gray-100 dark:bg-gray-700 rounded-xl p-1">
                  <TabButton
                    active={authMode === 'login'}
                    onClick={() => {
                      setAuthMode('login');
                      setError('');
                    }}
                    darkMode={darkMode}
                  >
                    Login
                  </TabButton>
                  <TabButton
                    active={authMode === 'register'}
                    onClick={() => {
                      setAuthMode('register');
                      setError('');
                    }}
                    darkMode={darkMode}
                  >
                    Register
                  </TabButton>
                </div>
              </div>

              <div className={authMode === 'login' ? 'space-y-4' : 'space-y-6'}>
                <FloatingInput
                  id="email"
                  label="Email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="Enter your email"
                  required
                  darkMode={darkMode}
                />

                <FloatingInput
                  id="password"
                  label="Password"
                  value={password}
                  onChange={setPassword}
                  placeholder="Enter your password"
                  isPassword
                  required
                  darkMode={darkMode}
                  showPasswordStrength={authMode === 'register'}
                />

                {authMode === 'register' && (
                  <>
                    <FloatingInput
                      id="confirmPassword"
                      label="Confirm Password"
                      value={confirmPassword}
                      onChange={setConfirmPassword}
                      placeholder="Confirm your password"
                      isPassword
                      required
                      darkMode={darkMode}
                    />

                    <div className={`p-4 rounded-lg border ${
                      darkMode 
                        ? 'bg-blue-900/20 border-blue-700/30 text-blue-200' 
                        : 'bg-blue-50 border-blue-200 text-blue-800'
                    }`}>
                      <h4 className="font-semibold mb-2 flex items-center">
                        <Lock className="w-4 h-4 mr-2" />
                        Security Questions
                      </h4>
                      <p className="text-sm mb-3">
                        These will help you recover access if you forget your password.
                      </p>
                      
                      <div className="space-y-3">
                        {securityQuestions.map((sq, index) => (
                          <div key={index} className="space-y-2">
                            <FloatingInput
                              id={`question-${index}`}
                              label={`Security Question ${index + 1}`}
                              value={sq.question}
                              onChange={(value) => {
                                const updated = [...securityQuestions];
                                updated[index].question = value;
                                setSecurityQuestions(updated);
                              }}
                              placeholder="e.g., What was your first pet's name?"
                              required
                              darkMode={darkMode}
                            />
                            <FloatingInput
                              id={`answer-${index}`}
                              label={`Answer ${index + 1}`}
                              value={sq.answer}
                              onChange={(value) => {
                                const updated = [...securityQuestions];
                                updated[index].answer = value;
                                setSecurityQuestions(updated);
                              }}
                              placeholder="Your answer"
                              required
                              darkMode={darkMode}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {error && (
                  <div className="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg">
                    {error}
                  </div>
                )}

                <ActionButton
                  onClick={authMode === 'login' ? handleLogin : handleRegister}
                  loading={loading}
                  darkMode={darkMode}
                >
                  {authMode === 'login' ? 'Login' : 'Create Account'}
                </ActionButton>
              </div>
            </div>
          </div>

          <div className="max-w-4xl mx-auto mt-12 space-y-8">
            <SecurityFeatures darkMode={darkMode} />
            <FAQ darkMode={darkMode} />
            <SocialLinks 
              darkMode={darkMode} 
              onFeedbackClick={() => setShowFeedbackModal(true)} 
            />
          </div>
        </div>

        <FeedbackModal
          isOpen={showFeedbackModal}
          onClose={() => setShowFeedbackModal(false)}
          darkMode={darkMode}
          onSuccess={showTooltip}
        />
      </div>
    );
  }

  if (!isVaultUnlocked) {
    return (
      <div className={backgroundClass}>
        <Tooltip {...tooltip} onHide={hideTooltip} darkMode={darkMode} />
        <div className="container mx-auto px-4 py-8">
          <Header 
            darkMode={darkMode} 
            onToggleDarkMode={() => setDarkMode(!darkMode)}
            onLogout={handleLogout}
            currentUser={currentUser}
          />
          
          <div className="max-w-md mx-auto">
            <div className={`backdrop-blur-sm rounded-2xl p-8 shadow-2xl border ${
              darkMode 
                ? 'bg-gray-800/80 border-gray-700/20' 
                : 'bg-white/80 border-white/20'
            }`}>
              <div className="text-center mb-8">
                <Unlock className={`w-16 h-16 mx-auto mb-4 ${
                  darkMode ? 'text-purple-400' : 'text-indigo-600'
                }`} />
                <h2 className={`text-2xl font-bold ${
                  darkMode ? 'text-gray-200' : 'text-gray-800'
                }`}>
                  Unlock Your Vault
                </h2>
                <p className={`mt-2 ${
                  darkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Enter your master password to access your seed phrases
                </p>
              </div>

              <FloatingInput
                id="masterPassword"
                label="Master Password"
                value={masterPassword}
                onChange={setMasterPassword}
                placeholder="Enter your master password"
                isPassword
                required
                darkMode={darkMode}
                error={error}
              />

              <ActionButton
                onClick={handleUnlockVault}
                loading={loading}
                darkMode={darkMode}
              >
                Unlock Vault
              </ActionButton>

              <div className={`mt-6 p-4 rounded-lg border ${
                darkMode 
                  ? 'bg-yellow-900/20 border-yellow-700/30 text-yellow-200' 
                  : 'bg-yellow-50 border-yellow-200 text-yellow-800'
              }`}>
                <div className="flex items-start">
                  <Shield className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium mb-1">Security Notice</p>
                    <p>This is NOT your account password. This is your vault's master password that encrypts your seed phrases locally.</p>
                    <p className="mt-2">
                      <strong>⚠️ Warning:</strong> VaultSeed is currently in development. 
                      <a 
                        href="https://github.com/vaultseed/vaultseedv2" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="underline hover:no-underline ml-1"
                      >
                        View source code
                      </a>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={backgroundClass}>
      <Tooltip {...tooltip} onHide={hideTooltip} darkMode={darkMode} />
      <div className="container mx-auto px-4 py-8">
        <Header 
          darkMode={darkMode} 
          onToggleDarkMode={() => setDarkMode(!darkMode)}
          onExport={() => setShowExportModal(true)}
          onLogout={handleLogout}
          currentUser={currentUser}
        />
        
        <div className="max-w-4xl mx-auto">
          <div className={`backdrop-blur-sm rounded-2xl p-6 mb-8 shadow-xl border ${
            darkMode 
              ? 'bg-gray-800/80 border-gray-700/20' 
              : 'bg-white/80 border-white/20'
          }`}>
            <h2 className={`text-2xl font-bold mb-6 ${
              darkMode ? 'text-gray-200' : 'text-gray-800'
            }`}>
              Add New Seed Phrase
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <FloatingInput
                id="seedName"
                label="Wallet Name"
                value={newSeedName}
                onChange={setNewSeedName}
                placeholder="e.g., Main Wallet, Trading Wallet"
                darkMode={darkMode}
              />
              <FloatingInput
                id="seedPhrase"
                label="Seed Phrase"
                value={newSeedPhrase}
                onChange={setNewSeedPhrase}
                placeholder="Enter your 12 or 24 word seed phrase"
                required
                darkMode={darkMode}
              />
            </div>
            
            <ActionButton
              onClick={handleAddSeed}
              disabled={!newSeedPhrase.trim()}
              darkMode={darkMode}
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Seed Phrase
            </ActionButton>
          </div>

          {vaultData.seeds.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {vaultData.seeds.map((seed) => (
                <SeedCard
                  key={seed.id}
                  seed={seed}
                  onDelete={() => handleDeleteSeed(seed.id)}
                  darkMode={darkMode}
                  onCopyFeedback={handleCopyFeedback}
                />
              ))}
            </div>
          ) : (
            <div className={`backdrop-blur-sm rounded-2xl p-12 text-center shadow-xl border ${
              darkMode 
                ? 'bg-gray-800/80 border-gray-700/20' 
                : 'bg-white/80 border-white/20'
            }`}>
              <Shield className={`w-16 h-16 mx-auto mb-4 ${
                darkMode ? 'text-gray-600' : 'text-gray-400'
              }`} />
              <h3 className={`text-xl font-semibold mb-2 ${
                darkMode ? 'text-gray-300' : 'text-gray-600'
              }`}>
                Your vault is empty
              </h3>
              <p className={`${
                darkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>
                Add your first seed phrase to get started
              </p>
            </div>
          )}
        </div>
      </div>

      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        vaultData={vaultData}
        darkMode={darkMode}
        onSuccess={showTooltip}
      />

      <FeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        darkMode={darkMode}
        onSuccess={showTooltip}
      />
    </div>
  );
}

export default App;
