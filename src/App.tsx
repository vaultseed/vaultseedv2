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
  saveAppSettings
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

function App() {
  // Authentication state
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityQuestions, setSecurityQuestions] = useState([
    { question: '', answer: '' },
    { question: '', answer: '' }
  ]);
  const [securityAnswers, setSecurityAnswers] = useState(['', '']);
  const [showSecurityVerification, setShowSecurityVerification] = useState(false);
  const [storedSecurityQuestions, setStoredSecurityQuestions] = useState<string[]>([]);
  
  // App state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  
  // Vault state
  const [vaultData, setVaultData] = useState<VaultData>({ seeds: [], securityQuestions: [] });
  const [newSeed, setNewSeed] = useState('');
  const [newSeedName, setNewSeedName] = useState('');
  const [showAddSeed, setShowAddSeed] = useState(false);
  const [activeTab, setActiveTab] = useState<'vault' | 'security' | 'faq'>('vault');
  
  // Modal state
  const [showExportModal, setShowExportModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  
  // Tooltip state
  const [tooltip, setTooltip] = useState<TooltipState>({ show: false, message: '', type: 'info' });

  // Load settings on mount
  useEffect(() => {
    const settings = getAppSettings();
    setDarkMode(settings.darkMode);
    
    // Check for existing session
    const token = localStorage.getItem('vaultseed_token');
    const user = localStorage.getItem('vaultseed_user');
    if (token && user) {
      setIsAuthenticated(true);
      setCurrentUser(JSON.parse(user));
      loadUserVault();
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

  const loadUserVault = async () => {
    try {
      const response = await vaultAPI.get();
      if (response.encryptedData && response.clientSalt) {
        // For now, we'll use local storage as fallback
        const localVault = loadVault(email);
        if (localVault) {
          const key = await getKey(password, localVault.salt);
          const decrypted = await decryptData(key, localVault.data);
          if (decrypted) {
            setVaultData(JSON.parse(decrypted));
          }
        }
      }
    } catch (error) {
      console.error('Failed to load vault:', error);
    }
  };

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

    // Check IP-based rate limiting
    const ipLock = isIPLocked();
    if (ipLock.locked) {
      setError(`Too many failed attempts. Try again in ${ipLock.timeLeft} minutes.`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const salt = generateSalt();
      
      const response = await authAPI.register({
        email,
        password,
        securityQuestions,
        salt
      });

      setCurrentUser(response.user);
      setIsAuthenticated(true);
      clearIPFailedAttempts();
      showTooltip('Account created successfully! Please login with your credentials.', 'success');
      // Switch to login mode after successful registration
      setIsLogin(true);
      setPassword(''); // Clear password for security
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
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }

    // Check account-specific lockout
    const lockStatus = isAccountLocked(email);
    if (lockStatus.locked) {
      setError(`Account locked. Try again in ${lockStatus.timeLeft} minutes.`);
      return;
    }

    // Check IP-based rate limiting
    const ipLock = isIPLocked();
    if (ipLock.locked) {
      setError(`Too many failed attempts. Try again in ${ipLock.timeLeft} minutes.`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await authAPI.login({ email, password });
      
      if (response.user.securityQuestions && response.user.securityQuestions.length > 0) {
        setStoredSecurityQuestions(response.user.securityQuestions.map((sq: any) => sq.question));
        setShowSecurityVerification(true);
        setCurrentUser(response.user);
      } else {
        setCurrentUser(response.user);
        setIsAuthenticated(true);
        clearFailedAttempts(email);
        clearIPFailedAttempts();
        showTooltip('Login successful!', 'success');
        loadUserVault();
      }
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
        email,
        answers: securityAnswers
      });

      setIsAuthenticated(true);
      setShowSecurityVerification(false);
      clearFailedAttempts(email);
      clearIPFailedAttempts();
      showTooltip('Security verification successful!', 'success');
      loadUserVault();
    } catch (error: any) {
      recordFailedAttempt(email);
      recordIPFailedAttempt();
      setError(error.message || 'Security verification failed');
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
      name: newSeedName.trim() || undefined,
      createdAt: new Date().toISOString()
    };

    const updatedVault = {
      ...vaultData,
      seeds: [...vaultData.seeds, seedPhrase]
    };

    try {
      await saveVaultData(updatedVault);
      setVaultData(updatedVault);
      setNewSeed('');
      setNewSeedName('');
      setShowAddSeed(false);
      showTooltip('Seed phrase added successfully!', 'success');
    } catch (error) {
      setError('Failed to save seed phrase');
    }
  };

  const handleDeleteSeed = async (seedId: string) => {
    const updatedVault = {
      ...vaultData,
      seeds: vaultData.seeds.filter(seed => seed.id !== seedId)
    };

    try {
      await saveVaultData(updatedVault);
      setVaultData(updatedVault);
      showTooltip('Seed phrase deleted', 'success');
    } catch (error) {
      setError('Failed to delete seed phrase');
    }
  };

  const saveVaultData = async (data: VaultData) => {
    try {
      const salt = generateSalt();
      const key = await getKey(password, salt);
      const encrypted = await encryptData(key, JSON.stringify(data));
      
      // Save to server
      await vaultAPI.save(encrypted, salt);
      
      // Also save locally as backup
      saveVault(email, { salt, data: encrypted });
    } catch (error) {
      throw new Error('Failed to save vault data');
    }
  };

  const handleLogout = () => {
    authAPI.logout();
    setIsAuthenticated(false);
    setCurrentUser(null);
    setVaultData({ seeds: [], securityQuestions: [] });
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setSecurityQuestions([{ question: '', answer: '' }, { question: '', answer: '' }]);
    setSecurityAnswers(['', '']);
    setShowSecurityVerification(false);
    showTooltip('Logged out successfully', 'success');
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setSecurityQuestions([{ question: '', answer: '' }, { question: '', answer: '' }]);
    setSecurityAnswers(['', '']);
    setError('');
    setShowSecurityVerification(false);
  };

  const switchMode = (loginMode: boolean) => {
    setIsLogin(loginMode);
    resetForm();
  };

  if (isAuthenticated) {
    return (
      <div className={`min-h-screen transition-colors duration-300 ${
        darkMode 
          ? 'bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900' 
          : 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50'
      }`}>
        <div className="container mx-auto px-4 py-6 sm:py-8">
          <Header 
            darkMode={darkMode}
            onToggleDarkMode={() => setDarkMode(!darkMode)}
            onExport={() => setShowExportModal(true)}
            onLogout={handleLogout}
            currentUser={currentUser}
          />

          <div className="flex flex-col lg:flex-row gap-6 sm:gap-8">
            <div className="lg:w-1/4">
              <div className={`backdrop-blur-sm rounded-2xl p-4 sm:p-6 shadow-xl border ${
                darkMode ? 'bg-gray-800/80 border-gray-700/20' : 'bg-white/80 border-white/20'
              }`}>
                <div className="flex flex-col space-y-2 sm:space-y-3">
                  <TabButton
                    active={activeTab === 'vault'}
                    onClick={() => setActiveTab('vault')}
                    darkMode={darkMode}
                  >
                    My Vault
                  </TabButton>
                  <TabButton
                    active={activeTab === 'security'}
                    onClick={() => setActiveTab('security')}
                    darkMode={darkMode}
                  >
                    Security
                  </TabButton>
                  <TabButton
                    active={activeTab === 'faq'}
                    onClick={() => setActiveTab('faq')}
                    darkMode={darkMode}
                  >
                    FAQ
                  </TabButton>
                </div>
              </div>
            </div>

            <div className="lg:w-3/4">
              {activeTab === 'vault' && (
                <div className={`backdrop-blur-sm rounded-2xl p-4 sm:p-6 md:p-8 shadow-xl border ${
                  darkMode ? 'bg-gray-800/80 border-gray-700/20' : 'bg-white/80 border-white/20'
                }`}>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 sm:mb-8">
                    <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-0 ${
                      darkMode ? 'text-gray-200' : 'text-gray-800'
                    }`}>
                      Seed Phrases ({vaultData.seeds.length})
                    </h2>
                    <ActionButton
                      onClick={() => setShowAddSeed(!showAddSeed)}
                      darkMode={darkMode}
                      className="w-full sm:w-auto"
                    >
                      <Plus className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                      Add Seed
                    </ActionButton>
                  </div>

                  {showAddSeed && (
                    <div className={`mb-6 sm:mb-8 p-4 sm:p-6 rounded-xl border ${
                      darkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'
                    }`}>
                      <h3 className={`text-lg font-semibold mb-4 ${
                        darkMode ? 'text-gray-200' : 'text-gray-800'
                      }`}>
                        Add New Seed Phrase
                      </h3>
                      
                      <FloatingInput
                        id="seedName"
                        label="Wallet Name (Optional)"
                        value={newSeedName}
                        onChange={setNewSeedName}
                        placeholder="e.g., Main Wallet, Trading Wallet"
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

                      <div className="flex flex-col sm:flex-row gap-3">
                        <ActionButton
                          onClick={() => setShowAddSeed(false)}
                          variant="secondary"
                          darkMode={darkMode}
                          className="flex-1"
                        >
                          Cancel
                        </ActionButton>
                        <ActionButton
                          onClick={handleAddSeed}
                          loading={loading}
                          disabled={!newSeed.trim()}
                          darkMode={darkMode}
                          className="flex-1"
                        >
                          Add Seed
                        </ActionButton>
                      </div>
                    </div>
                  )}

                  {vaultData.seeds.length === 0 ? (
                    <div className="text-center py-12">
                      <Shield className={`w-16 h-16 mx-auto mb-4 ${
                        darkMode ? 'text-gray-600' : 'text-gray-400'
                      }`} />
                      <h3 className={`text-xl font-semibold mb-2 ${
                        darkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        No seed phrases yet
                      </h3>
                      <p className={`${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                        Add your first seed phrase to get started
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                      {vaultData.seeds.map((seed) => (
                        <SeedCard
                          key={seed.id}
                          seed={seed}
                          onDelete={() => handleDeleteSeed(seed.id)}
                          darkMode={darkMode}
                          onCopyFeedback={(message) => showTooltip(message, 'success')}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'security' && <SecurityFeatures darkMode={darkMode} />}
              {activeTab === 'faq' && <FAQ darkMode={darkMode} />}
            </div>
          </div>

          <SocialLinks 
            darkMode={darkMode} 
            onFeedbackClick={() => setShowFeedbackModal(true)} 
          />
        </div>

        <ExportModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          vaultData={vaultData}
          darkMode={darkMode}
          onSuccess={(message) => showTooltip(message, 'success')}
        />

        <FeedbackModal
          isOpen={showFeedbackModal}
          onClose={() => setShowFeedbackModal(false)}
          darkMode={darkMode}
          onSuccess={(message) => showTooltip(message, 'success')}
        />

        <Tooltip
          show={tooltip.show}
          message={tooltip.message}
          type={tooltip.type}
          onHide={hideTooltip}
          darkMode={darkMode}
        />
      </div>
    );
  }

  if (showSecurityVerification) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 transition-colors duration-300 ${
        darkMode 
          ? 'bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900' 
          : 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50'
      }`}>
        <div className={`w-full max-w-md backdrop-blur-sm rounded-2xl p-6 sm:p-8 shadow-2xl border ${
          darkMode ? 'bg-gray-800/90 border-gray-700/30' : 'bg-white/90 border-white/30'
        }`}>
          <div className="text-center mb-6">
            <Shield className={`w-12 h-12 mx-auto mb-4 ${
              darkMode ? 'text-purple-400' : 'text-indigo-600'
            }`} />
            <h2 className={`text-2xl font-bold mb-2 ${
              darkMode ? 'text-gray-200' : 'text-gray-800'
            }`}>
              Security Verification
            </h2>
            <p className={`text-sm ${
              darkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Please answer your security questions
            </p>
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

          {error && (
            <p className="text-red-500 text-sm mt-4 text-center">{error}</p>
          )}

          <div className="mt-6 space-y-3">
            <ActionButton
              onClick={handleSecurityVerification}
              loading={loading}
              disabled={securityAnswers.some(answer => !answer.trim())}
              darkMode={darkMode}
            >
              Verify
            </ActionButton>
            <ActionButton
              onClick={() => {
                setShowSecurityVerification(false);
                resetForm();
              }}
              variant="secondary"
              darkMode={darkMode}
            >
              Back to Login
            </ActionButton>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 transition-colors duration-300 ${
      darkMode 
        ? 'bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900' 
        : 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50'
    }`}>
      <div className="w-full max-w-6xl flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
        {/* Left side - Branding */}
        <div className="lg:w-1/2 text-center lg:text-left">
          <div className="flex items-center justify-center lg:justify-start mb-6">
            <Shield className={`w-12 h-12 sm:w-16 sm:h-16 mr-3 sm:mr-4 ${
              darkMode ? 'text-purple-400' : 'text-indigo-600'
            }`} />
            <div>
              <h1 className={`text-3xl sm:text-4xl lg:text-5xl font-bold ${
                darkMode ? 'text-gray-200' : 'text-gray-800'
              }`}>
                VaultSeed
              </h1>
              <p className={`text-sm sm:text-base ${
                darkMode ? 'text-purple-400' : 'text-indigo-600'
              }`}>
                Secure Seed Phrase Manager
              </p>
            </div>
          </div>
          
          <p className={`text-lg sm:text-xl mb-6 sm:mb-8 ${
            darkMode ? 'text-gray-300' : 'text-gray-600'
          }`}>
            Enterprise-grade encryption for your crypto seed phrases with zero-knowledge architecture
          </p>
          
          <div className="flex flex-wrap gap-4 justify-center lg:justify-start mb-6 sm:mb-8">
            <div className={`flex items-center text-sm sm:text-base ${
              darkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>
              <Shield className="w-4 h-4 mr-2 text-green-500" />
              AES-256 Encryption
            </div>
            <div className={`flex items-center text-sm sm:text-base ${
              darkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>
              <Eye className="w-4 h-4 mr-2 text-green-500" />
              Zero-Knowledge
            </div>
            <div className={`flex items-center text-sm sm:text-base ${
              darkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>
              <Github className="w-4 h-4 mr-2 text-green-500" />
              Open Source
            </div>
          </div>

          <div className="flex items-center justify-center lg:justify-start space-x-4">
            <a
              href="https://github.com/vaultseed/vaultseedv2"
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors text-sm ${
                darkMode 
                  ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Github className="w-4 h-4" />
              <span>View Source</span>
            </a>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-lg transition-colors ${
                darkMode 
                  ? 'bg-gray-800 text-yellow-400 hover:bg-gray-700' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Right side - Auth Form */}
        <div className="lg:w-1/2 w-full max-w-md mb-8 lg:mb-0">
          <div className={`w-full backdrop-blur-sm rounded-2xl p-6 sm:p-8 shadow-2xl border transition-all duration-300 ${
            darkMode ? 'bg-gray-800/90 border-gray-700/30' : 'bg-white/90 border-white/30'
          }`}>
            
            {/* Tab buttons */}
            <div className="flex mb-6 sm:mb-8">
              <button
                onClick={() => switchMode(true)}
                className={`flex-1 py-3 px-4 text-center font-semibold transition-all duration-200 rounded-l-xl ${
                  isLogin
                    ? darkMode
                      ? 'bg-gray-700 text-purple-400 border-b-2 border-purple-400'
                      : 'bg-gray-50 text-indigo-600 border-b-2 border-indigo-600'
                    : darkMode
                      ? 'text-gray-400 hover:text-gray-200'
                      : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Login
              </button>
              <button
                onClick={() => switchMode(false)}
                className={`flex-1 py-3 px-4 text-center font-semibold transition-all duration-200 rounded-r-xl ${
                  !isLogin
                    ? darkMode
                      ? 'bg-gray-700 text-purple-400 border-b-2 border-purple-400'
                      : 'bg-gray-50 text-indigo-600 border-b-2 border-indigo-600'
                    : darkMode
                      ? 'text-gray-400 hover:text-gray-200'
                      : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Register
              </button>
            </div>

            {/* Form content */}
            <div className={isLogin ? 'space-y-4' : 'space-y-6'}>
              <FloatingInput
                id="email"
                label="Email"
                type="email"
                value={email}
                onChange={(value) => {
                  setEmail(value);
                  setError('');
                }}
                placeholder="Enter your email"
                required
                darkMode={darkMode}
              />

              <FloatingInput
                id="password"
                label="Password"
                value={password}
                onChange={(value) => {
                  setPassword(value);
                  setError('');
                }}
                placeholder="Enter your password"
                isPassword
                required
                darkMode={darkMode}
                showPasswordStrength={!isLogin}
              />

              {!isLogin && (
                <>
                  <FloatingInput
                    id="confirmPassword"
                    label="Confirm Password"
                    value={confirmPassword}
                    onChange={(value) => {
                      setConfirmPassword(value);
                      setError('');
                    }}
                    placeholder="Confirm your password"
                    isPassword
                    required
                    darkMode={darkMode}
                  />

                  <div className={`p-4 rounded-lg border ${
                    darkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'
                  }`}>
                    <h4 className={`font-semibold mb-3 ${
                      darkMode ? 'text-gray-200' : 'text-gray-800'
                    }`}>
                      Security Questions
                    </h4>
                    <p className={`text-sm mb-4 ${
                      darkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      These are required to access your vault in the future.
                    </p>
                    
                    <div className="mb-4">
                      <h5 className={`text-sm font-medium mb-2 ${
                        darkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Security Question 1 *
                      </h5>
                      <FloatingInput
                        id="question1"
                        label="What was your first pet's name?"
                        value={securityQuestions[0].answer}
                        onChange={(value) => {
                          const newQuestions = [...securityQuestions];
                          newQuestions[0].question = "What was your first pet's name?";
                          newQuestions[0].answer = value;
                          setSecurityQuestions(newQuestions);
                          setError('');
                        }}
                        placeholder="Your answer"
                        required
                        darkMode={darkMode}
                      />
                    </div>

                    <div className="mb-4">
                      <h5 className={`text-sm font-medium mb-2 ${
                        darkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Security Question 2 *
                      </h5>
                      <FloatingInput
                        id="question2"
                        label="What city were you born in?"
                        value={securityQuestions[1].answer}
                        onChange={(value) => {
                          const newQuestions = [...securityQuestions];
                          newQuestions[1].question = "What city were you born in?";
                          newQuestions[1].answer = value;
                          setSecurityQuestions(newQuestions);
                          setError('');
                        }}
                        placeholder="Your answer"
                        required
                        darkMode={darkMode}
                      />
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
      </div>

      {/* FAQ and Security Features on main page */}
      <div className="w-full max-w-6xl mt-12 lg:mt-16">
        <div className="space-y-8">
          <SecurityFeatures darkMode={darkMode} />
          <FAQ darkMode={darkMode} />
        </div>
      </div>

      <SocialLinks 
        darkMode={darkMode} 
        onFeedbackClick={() => setShowFeedbackModal(true)} 
      />

      <FeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        darkMode={darkMode}
        onSuccess={(message) => showTooltip(message, 'success')}
      />

      <Tooltip
        show={tooltip.show}
        message={tooltip.message}
        type={tooltip.type}
        onHide={hideTooltip}
        darkMode={darkMode}
      />
    </div>
  );
}

export default App;
