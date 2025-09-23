import React, { useState, useEffect } from 'react';
import { Shield, Lock, Eye, EyeOff, Plus, Download, Upload, Sun, Moon, Github, AlertTriangle, Trash2 } from 'lucide-react';
import { getKey, encryptData, decryptData, validatePassword, generateSalt, getPasswordStrength } from './utils/crypto';
import { 
  saveVault, 
  loadVault, 
  getFailedAttempts, 
  recordFailedAttempt, 
  clearFailedAttempts, 
  isAccountLocked,
  isIPLocked,
  recordIPFailedAttempt,
  clearIPFailedAttempts,
  getAppSettings,
  saveAppSettings
} from './utils/storage';
import { VaultData, SeedPhrase, SecurityQuestion, TooltipState } from './types/vault';
import { authAPI, vaultAPI } from './utils/api';
import FloatingInput from './components/FloatingInput';
import ActionButton from './components/ActionButton';
import TabButton from './components/TabButton';
import SeedCard from './components/SeedCard';
import ExportModal from './components/ExportModal';
import FeedbackModal from './components/FeedbackModal';
import Tooltip from './components/Tooltip';
import FAQ from './components/FAQ';
import SecurityFeatures from './components/SecurityFeatures';
import SocialLinks from './components/SocialLinks';

function App() {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  
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
  const [newSeed, setNewSeed] = useState('');
  const [newSeedName, setNewSeedName] = useState('');
  const [masterPassword, setMasterPassword] = useState('');
  const [isVaultUnlocked, setIsVaultUnlocked] = useState(false);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipState>({ show: false, message: '', type: 'info' });
  const [darkMode, setDarkMode] = useState(false);

  // Security verification state
  const [showSecurityVerification, setShowSecurityVerification] = useState(false);
  const [securityAnswers, setSecurityAnswers] = useState(['', '']);
  const [pendingEmail, setPendingEmail] = useState('');

  // Initialize app
  useEffect(() => {
    const settings = getAppSettings();
    setDarkMode(settings.darkMode);
    
    // Check for existing session
    const token = localStorage.getItem('vaultseed_token');
    const user = localStorage.getItem('vaultseed_user');
    
    if (token && user) {
      try {
        setCurrentUser(JSON.parse(user));
        setIsAuthenticated(true);
      } catch (error) {
        // Clear invalid session
        localStorage.removeItem('vaultseed_token');
        localStorage.removeItem('vaultseed_user');
      }
    }
  }, []);

  // Apply dark mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    saveAppSettings({ darkMode });
  }, [darkMode]);

  const showTooltip = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setTooltip({ show: true, message, type });
  };

  const handleRegister = async () => {
    // Check IP lockout
    const ipLockStatus = isIPLocked();
    if (ipLockStatus.locked) {
      setError(`Too many failed attempts. Try again in ${ipLockStatus.timeLeft} minutes.`);
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
      showTooltip('Registration successful! You can now login.', 'success');
      setActiveTab('login');
      
      // Clear form
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
    // Check account lockout
    const lockStatus = isAccountLocked(email);
    if (lockStatus.locked) {
      setError(`Account locked. Try again in ${lockStatus.timeLeft} minutes.`);
      return;
    }

    // Check IP lockout
    const ipLockStatus = isIPLocked();
    if (ipLockStatus.locked) {
      setError(`Too many failed attempts. Try again in ${ipLockStatus.timeLeft} minutes.`);
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
      
      // Clear form
      setPassword('');
    } catch (error: any) {
      recordFailedAttempt(email);
      recordIPFailedAttempt();
      setError(error.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSecurityVerification = async () => {
    if (securityAnswers.some(answer => !answer.trim())) {
      setError('Please answer both security questions');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await authAPI.verifySecurityQuestions({
        email: pendingEmail,
        answers: securityAnswers
      });

      setShowSecurityVerification(false);
      setSecurityAnswers(['', '']);
      setPendingEmail('');
      showTooltip('Security verification successful! You can now access your vault.', 'success');
    } catch (error: any) {
      setError(error.message || 'Security verification failed');
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
      const serverVault = await vaultAPI.get();
      
      if (serverVault.encryptedData) {
        // Decrypt server vault
        const key = await getKey(masterPassword, serverVault.clientSalt);
        const decryptedData = await decryptData(key, serverVault.encryptedData);
        
        if (decryptedData) {
          const parsedData = JSON.parse(decryptedData);
          setVaultData(parsedData);
          setIsVaultUnlocked(true);
          showTooltip('Vault unlocked successfully!', 'success');
        } else {
          setError('Invalid master password');
        }
      } else {
        // No server vault, check local storage
        const localVault = loadVault(currentUser.email);
        
        if (localVault) {
          const key = await getKey(masterPassword, localVault.salt);
          const decryptedData = await decryptData(key, localVault.data);
          
          if (decryptedData) {
            const parsedData = JSON.parse(decryptedData);
            setVaultData(parsedData);
            setIsVaultUnlocked(true);
            showTooltip('Vault unlocked successfully!', 'success');
          } else {
            setError('Invalid master password');
          }
        } else {
          // Create new vault
          const newVaultData: VaultData = { seeds: [], securityQuestions: currentUser.securityQuestions || [] };
          setVaultData(newVaultData);
          setIsVaultUnlocked(true);
          showTooltip('New vault created!', 'success');
        }
      }
    } catch (error: any) {
      setError(error.message || 'Failed to unlock vault');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSeed = async () => {
    if (!newSeed.trim()) {
      setError('Please enter a seed phrase');
      return;
    }

    const seedPhrase: SeedPhrase = {
      id: Date.now().toString(),
      seed: newSeed.trim(),
      name: newSeedName.trim() || 'Unnamed Wallet',
      createdAt: new Date().toISOString()
    };

    const updatedVaultData = {
      ...vaultData,
      seeds: [...vaultData.seeds, seedPhrase]
    };

    await saveVaultData(updatedVaultData);
    setNewSeed('');
    setNewSeedName('');
    showTooltip('Seed phrase added successfully!', 'success');
  };

  const handleDeleteSeed = async (seedId: string) => {
    const updatedVaultData = {
      ...vaultData,
      seeds: vaultData.seeds.filter(seed => seed.id !== seedId)
    };

    await saveVaultData(updatedVaultData);
    showTooltip('Seed phrase deleted successfully!', 'success');
  };

  const saveVaultData = async (data: VaultData) => {
    try {
      const salt = generateSalt();
      const key = await getKey(masterPassword, salt);
      const encryptedData = await encryptData(key, JSON.stringify(data));
      
      // Save to server
      await vaultAPI.save(encryptedData, salt);
      
      // Also save locally as backup
      saveVault(currentUser.email, { salt, data: encryptedData });
      
      setVaultData(data);
    } catch (error) {
      console.error('Failed to save vault:', error);
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

  const backgroundGradient = darkMode 
    ? 'bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900'
    : 'bg-gradient-to-br from-indigo-50 via-white to-purple-50';

  if (!isAuthenticated) {
    return (
      <div className={`min-h-screen ${backgroundGradient} flex items-center justify-center p-4`}>
        <Tooltip {...tooltip} onHide={() => setTooltip({ ...tooltip, show: false })} darkMode={darkMode} />
        
        <div className="w-full max-w-6xl">
          {/* Header */}
          <div className="text-center mb-8 sm:mb-12">
            <div className="flex items-center justify-center mb-4 sm:mb-6">
              <Shield className={`w-8 h-8 sm:w-12 sm:h-12 mr-2 sm:mr-4 ${darkMode ? 'text-purple-400' : 'text-indigo-600'}`} />
              <h1 className={`text-3xl sm:text-4xl md:text-6xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                VaultSeed
              </h1>
            </div>
            <p className={`text-lg sm:text-xl md:text-2xl mb-4 sm:mb-6 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              Secure Your Crypto Seed Phrases with Enterprise-Grade Encryption
            </p>
            
            {/* Dark mode toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`mb-6 sm:mb-8 p-2 sm:p-3 rounded-xl transition-all duration-200 hover:scale-105 ${
                darkMode 
                  ? 'bg-gray-800 text-yellow-400 hover:bg-gray-700' 
                  : 'bg-white text-gray-600 hover:bg-gray-50 shadow-md'
              }`}
            >
              {darkMode ? <Sun className="w-5 h-5 sm:w-6 sm:h-6" /> : <Moon className="w-5 h-5 sm:w-6 sm:h-6" />}
            </button>

            {/* Security Warning */}
            <div className={`mb-6 sm:mb-8 p-4 sm:p-6 rounded-xl border backdrop-blur-sm ${
              darkMode 
                ? 'bg-red-900/20 border-red-700/30 text-red-200' 
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              <div className="flex items-start">
                <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 mt-0.5 flex-shrink-0" />
                <div className="text-left text-sm sm:text-base">
                  <p className="font-semibold mb-1 sm:mb-2">🚨 Security Notice</p>
                  <p className="mb-2">
                    <strong>Official Domain:</strong> VaultSeed only operates from <strong>vaultseed.io</strong>
                  </p>
                  <p className="mb-2">
                    <strong>Never Trust Imposters:</strong> VaultSeed will NEVER contact you asking for passwords or seed phrases
                  </p>
                  <p>
                    <strong>Verify Source:</strong> Always use our official repository: 
                    <a 
                      href="https://github.com/vaultseed/vaultseedv2" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className={`ml-1 underline hover:no-underline ${
                        darkMode ? 'text-red-300' : 'text-red-700'
                      }`}
                    >
                      github.com/vaultseed/vaultseedv2
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-12">
            {/* Auth Form */}
            <div className={`backdrop-blur-sm rounded-2xl p-6 sm:p-8 shadow-xl border ${
              darkMode 
                ? 'bg-gray-800/80 border-gray-700/20' 
                : 'bg-white/80 border-white/20'
            }`}>
              {/* Tab Buttons */}
              <div className="flex space-x-2 sm:space-x-4 mb-6 sm:mb-8 justify-center">
                <TabButton
                  active={activeTab === 'login'}
                  onClick={() => {
                    setActiveTab('login');
                    setError('');
                  }}
                  darkMode={darkMode}
                >
                  Login
                </TabButton>
                <TabButton
                  active={activeTab === 'register'}
                  onClick={() => {
                    setActiveTab('register');
                    setError('');
                  }}
                  darkMode={darkMode}
                >
                  Register
                </TabButton>
              </div>

              {/* Login Form */}
              {activeTab === 'login' && (
                <div>
                  <FloatingInput
                    id="loginEmail"
                    label="Email"
                    type="email"
                    value={email}
                    onChange={setEmail}
                    placeholder="Enter your email"
                    required
                    darkMode={darkMode}
                  />

                  <FloatingInput
                    id="loginPassword"
                    label="Password"
                    value={password}
                    onChange={setPassword}
                    placeholder="Enter your password"
                    isPassword
                    required
                    darkMode={darkMode}
                    error={error}
                  />

                  <ActionButton
                    onClick={handleLogin}
                    loading={loading}
                    disabled={!email || !password}
                    darkMode={darkMode}
                  >
                    Login
                  </ActionButton>
                </div>
              )}

              {/* Register Form */}
              {activeTab === 'register' && (
                <div>
                  <FloatingInput
                    id="registerEmail"
                    label="Email"
                    type="email"
                    value={email}
                    onChange={setEmail}
                    placeholder="Enter your email"
                    required
                    darkMode={darkMode}
                  />

                  <FloatingInput
                    id="registerPassword"
                    label="Password"
                    value={password}
                    onChange={setPassword}
                    placeholder="Create a strong password"
                    isPassword
                    required
                    darkMode={darkMode}
                    showPasswordStrength
                  />

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

                  {/* Security Questions */}
                  <div className="mb-4 sm:mb-6">
                    <h4 className={`text-base sm:text-lg font-semibold mb-3 sm:mb-4 ${
                      darkMode ? 'text-gray-200' : 'text-gray-800'
                    }`}>
                      Security Questions (2FA)
                    </h4>
                    
                    {securityQuestions.map((sq, index) => (
                      <div key={index} className="mb-3 sm:mb-4">
                        <FloatingInput
                          id={`question${index}`}
                          label={`Security Question ${index + 1}`}
                          value={sq.question}
                          onChange={(value) => {
                            const updated = [...securityQuestions];
                            updated[index].question = value;
                            setSecurityQuestions(updated);
                          }}
                          placeholder="e.g., What city were you born in?"
                          required
                          darkMode={darkMode}
                        />
                        
                        <FloatingInput
                          id={`answer${index}`}
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

                  {error && (
                    <p className="text-red-500 text-sm mb-4 flex items-center">
                      <span className="w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center mr-2">!</span>
                      {error}
                    </p>
                  )}

                  <ActionButton
                    onClick={handleRegister}
                    loading={loading}
                    disabled={!email || !password || !confirmPassword || securityQuestions.some(sq => !sq.question || !sq.answer)}
                    darkMode={darkMode}
                  >
                    Create Account
                  </ActionButton>
                </div>
              )}
            </div>

            {/* Security Features */}
            <SecurityFeatures darkMode={darkMode} />
          </div>

          {/* FAQ Section */}
          <div className="mt-8 sm:mt-12 lg:mt-16">
            <FAQ darkMode={darkMode} />
          </div>

          {/* Social Links */}
          <SocialLinks 
            darkMode={darkMode} 
            onFeedbackClick={() => setShowFeedbackModal(true)} 
          />
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
      <div className={`min-h-screen ${backgroundGradient} flex items-center justify-center p-4`}>
        <Tooltip {...tooltip} onHide={() => setTooltip({ ...tooltip, show: false })} darkMode={darkMode} />
        
        <div className={`w-full max-w-md backdrop-blur-sm rounded-2xl p-6 sm:p-8 shadow-xl border ${
          darkMode 
            ? 'bg-gray-800/80 border-gray-700/20' 
            : 'bg-white/80 border-white/20'
        }`}>
          <div className="text-center mb-6 sm:mb-8">
            <Lock className={`w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 ${
              darkMode ? 'text-purple-400' : 'text-indigo-600'
            }`} />
            <h2 className={`text-2xl sm:text-3xl font-bold mb-2 ${
              darkMode ? 'text-gray-200' : 'text-gray-800'
            }`}>
              Unlock Your Vault
            </h2>
            <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Welcome back, {currentUser?.email}
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

          <div className="flex space-x-3">
            <ActionButton
              onClick={handleLogout}
              variant="secondary"
              darkMode={darkMode}
              className="flex-1"
            >
              Logout
            </ActionButton>
            <ActionButton
              onClick={handleUnlockVault}
              loading={loading}
              disabled={!masterPassword}
              darkMode={darkMode}
              className="flex-1"
            >
              Unlock
            </ActionButton>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${backgroundGradient} p-4`}>
      <Tooltip {...tooltip} onHide={() => setTooltip({ ...tooltip, show: false })} darkMode={darkMode} />
      
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className={`backdrop-blur-sm rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8 shadow-xl border ${
          darkMode 
            ? 'bg-gray-800/80 border-gray-700/20' 
            : 'bg-white/80 border-white/20'
        }`}>
          <div className="flex flex-col sm:flex-row items-center justify-between">
            <div className="flex items-center mb-4 sm:mb-0">
              <Shield className={`w-6 h-6 sm:w-8 sm:h-8 mr-2 sm:mr-3 ${
                darkMode ? 'text-purple-400' : 'text-indigo-600'
              }`} />
              <div>
                <h1 className={`text-xl sm:text-2xl font-bold ${
                  darkMode ? 'text-gray-200' : 'text-gray-800'
                }`}>
                  VaultSeed
                </h1>
                <p className={`text-xs sm:text-sm ${
                  darkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  {currentUser?.email}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 sm:space-x-3">
              <a
                href="https://github.com/vaultseed/vaultseedv2"
                target="_blank"
                rel="noopener noreferrer"
                className={`p-2 rounded-lg transition-colors ${
                  darkMode 
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Github className="w-4 h-4 sm:w-5 sm:h-5" />
              </a>
              
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`p-2 rounded-lg transition-colors ${
                  darkMode 
                    ? 'bg-gray-700 text-yellow-400 hover:bg-gray-600' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {darkMode ? <Sun className="w-4 h-4 sm:w-5 sm:h-5" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5" />}
              </button>
              
              <button
                onClick={() => setShowExportModal(true)}
                className={`flex items-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-2 rounded-lg transition-colors text-sm ${
                  darkMode 
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Download className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Export</span>
              </button>
              
              <button
                onClick={handleLogout}
                className={`px-3 sm:px-4 py-2 rounded-lg transition-colors text-sm ${
                  darkMode 
                    ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50' 
                    : 'bg-red-50 text-red-600 hover:bg-red-100'
                }`}
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* Add Seed Form */}
        <div className={`backdrop-blur-sm rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8 shadow-xl border ${
          darkMode 
            ? 'bg-gray-800/80 border-gray-700/20' 
            : 'bg-white/80 border-white/20'
        }`}>
          <h3 className={`text-lg sm:text-xl font-bold mb-4 sm:mb-6 flex items-center ${
            darkMode ? 'text-gray-200' : 'text-gray-800'
          }`}>
            <Plus className={`w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 ${
              darkMode ? 'text-purple-400' : 'text-indigo-600'
            }`} />
            Add New Seed Phrase
          </h3>
          
          <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
            <FloatingInput
              id="seedName"
              label="Wallet Name"
              value={newSeedName}
              onChange={setNewSeedName}
              placeholder="e.g., MetaMask Wallet"
              darkMode={darkMode}
            />
            
            <FloatingInput
              id="seedPhrase"
              label="Seed Phrase"
              value={newSeed}
              onChange={setNewSeed}
              placeholder="Enter your 12 or 24 word seed phrase"
              required
              darkMode={darkMode}
              error={error}
            />
          </div>
          
          <ActionButton
            onClick={handleAddSeed}
            disabled={!newSeed.trim()}
            darkMode={darkMode}
            className="mt-4"
          >
            Add Seed Phrase
          </ActionButton>
        </div>

        {/* Seed Phrases Grid */}
        <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
          {vaultData.seeds.map((seed) => (
            <SeedCard
              key={seed.id}
              seed={seed}
              onDelete={() => handleDeleteSeed(seed.id)}
              darkMode={darkMode}
              onCopyFeedback={showTooltip}
            />
          ))}
        </div>

        {vaultData.seeds.length === 0 && (
          <div className={`text-center py-12 sm:py-16 ${
            darkMode ? 'text-gray-400' : 'text-gray-500'
          }`}>
            <Lock className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 opacity-50" />
            <p className="text-lg sm:text-xl mb-2">Your vault is empty</p>
            <p className="text-sm sm:text-base">Add your first seed phrase to get started</p>
          </div>
        )}
      </div>

      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        vaultData={vaultData}
        darkMode={darkMode}
        onSuccess={showTooltip}
      />
    </div>
  );
}

export default App;
