import React, { useState, useEffect } from 'react';
import { Shield, Plus, Settings, Download, MessageSquare } from 'lucide-react';
import { VaultData, SeedPhrase, SecurityQuestion, TooltipState } from './types/vault';
import { encryptData, decryptData, getKey, validatePassword, generateSalt } from './utils/crypto';
import { 
  saveVault, 
  loadVault, 
  getFailedAttempts, 
  setFailedAttempts, 
  recordFailedAttempt, 
  clearFailedAttempts,
  isAccountLocked,
  getAppSettings,
  saveAppSettings
} from './utils/storage';
import { authAPI, vaultAPI } from './utils/api';
import Header from './components/Header';
import TabButton from './components/TabButton';
import FloatingInput from './components/FloatingInput';
import ActionButton from './components/ActionButton';
import SeedCard from './components/SeedCard';
import SecurityFeatures from './components/SecurityFeatures';
import FAQ from './components/FAQ';
import SocialLinks from './components/SocialLinks';
import Tooltip from './components/Tooltip';
import ExportModal from './components/ExportModal';
import FeedbackModal from './components/FeedbackModal';

type AuthStep = 'login' | 'register' | 'security-verification' | 'authenticated';
type Tab = 'vault' | 'add' | 'settings';

function App() {
  // Authentication state
  const [authStep, setAuthStep] = useState<AuthStep>('login');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [pendingAuth, setPendingAuth] = useState<any>(null);
  
  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityQuestions, setSecurityQuestions] = useState<SecurityQuestion[]>([
    { question: '', answer: '' },
    { question: '', answer: '' }
  ]);
  const [securityAnswers, setSecurityAnswers] = useState(['', '']);
  
  // Vault state
  const [vaultData, setVaultData] = useState<VaultData>({ seeds: [], securityQuestions: [] });
  const [activeTab, setActiveTab] = useState<Tab>('vault');
  const [newSeed, setNewSeed] = useState('');
  const [newSeedName, setNewSeedName] = useState('');
  
  // Settings state
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [newSecurityQuestions, setNewSecurityQuestions] = useState<SecurityQuestion[]>([
    { question: '', answer: '' },
    { question: '', answer: '' }
  ]);
  
  // UI state
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tooltip, setTooltip] = useState<TooltipState>({ show: false, message: '', type: 'info' });
  const [showExportModal, setShowExportModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  useEffect(() => {
    const settings = getAppSettings();
    setDarkMode(settings.darkMode);
    
    // Don't auto-login on refresh - always require full authentication
  }, []);

  const loadUserVault = async (userEmail: string) => {
    try {
      // Try to load from server first
      const serverVault = await vaultAPI.get();
      if (serverVault.encryptedData && serverVault.clientSalt) {
        // Server has data, but we need the password to decrypt it
        // For now, just show empty vault until user enters password
        return;
      }
      
      // Fallback to local storage
      const stored = loadVault(userEmail);
      if (stored && password) {
        const key = await getKey(password, stored.salt);
        const decrypted = await decryptData(key, stored.data);
        if (decrypted) {
          const data = JSON.parse(decrypted);
          setVaultData(data);
        }
      }
    } catch (error) {
      console.error('Failed to load vault:', error);
    }
  };

  const showTooltip = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setTooltip({ show: true, message, type });
  };

  const handleRegister = async () => {
    if (!email || !password || !confirmPassword) {
      setError('All fields are required');
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

    if (!securityQuestions[0].question || !securityQuestions[0].answer || 
        !securityQuestions[1].question || !securityQuestions[1].answer) {
      setError('Please fill in both security questions and answers');
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
      setVaultData({ seeds: [], securityQuestions });
      setAuthStep('authenticated');
      showTooltip('Account created successfully!', 'success');
      
      // Clear form
      setPassword('');
      setConfirmPassword('');
      setSecurityQuestions([{ question: '', answer: '' }, { question: '', answer: '' }]);
      
    } catch (error: any) {
      setError(error.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Email and password are required');
      return;
    }

    // Check account lockout
    const lockStatus = isAccountLocked(email);
    if (lockStatus.locked) {
      setError(`Account locked. Try again in ${lockStatus.timeLeft} minutes.`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await authAPI.login({ email, password });
      
      // Check if user has security questions
      if (response.user.securityQuestions && response.user.securityQuestions.length > 0) {
        // Store pending auth data and move to security verification
        setPendingAuth({
          user: response.user,
          token: response.token,
          password: password
        });
        setAuthStep('security-verification');
      } else {
        // No security questions, complete login
        setCurrentUser(response.user);
        setAuthStep('authenticated');
        await loadUserVaultWithPassword(email, password);
      }
      
      clearFailedAttempts(email);
      
    } catch (error: any) {
      recordFailedAttempt(email);
      setError(error.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSecurityVerification = async () => {
    if (!securityAnswers[0] || !securityAnswers[1]) {
      setError('Please answer both security questions');
      return;
    }

    if (!pendingAuth) {
      setError('Authentication session expired. Please login again.');
      setAuthStep('login');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await authAPI.verifySecurityQuestions({
        email,
        answers: securityAnswers
      });

      // Security verification passed, complete login
      setCurrentUser(pendingAuth.user);
      
      // Load vault data with the password
      await loadUserVaultWithPassword(email, pendingAuth.password);
      
      setAuthStep('authenticated');
      setPendingAuth(null);
      setSecurityAnswers(['', '']);
      showTooltip('Login successful!', 'success');
      
    } catch (error: any) {
      setError(error.message || 'Security verification failed');
    } finally {
      setLoading(false);
    }
  };

  const loadUserVaultWithPassword = async (userEmail: string, userPassword: string) => {
    try {
      // Try server first
      const serverVault = await vaultAPI.get();
      if (serverVault.encryptedData && serverVault.clientSalt) {
        const key = await getKey(userPassword, serverVault.clientSalt);
        const decrypted = await decryptData(key, serverVault.encryptedData);
        if (decrypted) {
          const data = JSON.parse(decrypted);
          setVaultData(data);
          showTooltip(`Loaded ${data.seeds?.length || 0} seed phrases from server`, 'success');
          return;
        }
      }
      
      // Fallback to local storage
      const stored = loadVault(userEmail);
      if (stored) {
        const key = await getKey(userPassword, stored.salt);
        const decrypted = await decryptData(key, stored.data);
        if (decrypted) {
          const data = JSON.parse(decrypted);
          setVaultData(data);
          showTooltip(`Loaded ${data.seeds?.length || 0} seed phrases from local storage`, 'success');
        }
      }
    } catch (error) {
      console.error('Failed to load vault:', error);
      showTooltip('Failed to load vault data', 'error');
    }
  };

  const handleLogout = () => {
    authAPI.logout();
    setCurrentUser(null);
    setAuthStep('login');
    setVaultData({ seeds: [], securityQuestions: [] });
    setEmail('');
    setPassword('');
    setActiveTab('vault');
    showTooltip('Logged out successfully', 'success');
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

    await saveVaultData(updatedVault);
    setNewSeed('');
    setNewSeedName('');
    setActiveTab('vault');
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
      setVaultData(data);
      
      if (currentUser && password) {
        const salt = generateSalt();
        const key = await getKey(password, salt);
        const encrypted = await encryptData(key, JSON.stringify(data));
        
        // Save to server
        try {
          await vaultAPI.save(encrypted, salt);
        } catch (error) {
          console.error('Failed to save to server:', error);
        }
        
        // Save locally as backup
        saveVault(currentUser.email, { salt, data: encrypted });
      }
    } catch (error) {
      console.error('Failed to save vault:', error);
      showTooltip('Failed to save vault', 'error');
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmNewPassword) {
      setError('Please enter and confirm new password');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError('New passwords do not match');
      return;
    }

    if (!validatePassword(newPassword)) {
      setError('Password must be at least 8 characters with uppercase, lowercase, number, and special character');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Re-encrypt vault with new password
      const salt = generateSalt();
      const key = await getKey(newPassword, salt);
      const encrypted = await encryptData(key, JSON.stringify(vaultData));
      
      // Save with new password
      await vaultAPI.save(encrypted, salt);
      saveVault(currentUser.email, { salt, data: encrypted });
      
      // Update local password reference
      setPassword(newPassword);
      
      setNewPassword('');
      setConfirmNewPassword('');
      showTooltip('Password changed successfully!', 'success');
      
    } catch (error) {
      setError('Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSecurityQuestions = async () => {
    if (!newSecurityQuestions[0].question || !newSecurityQuestions[0].answer ||
        !newSecurityQuestions[1].question || !newSecurityQuestions[1].answer) {
      setError('Please fill in both security questions and answers');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const updatedVault = {
        ...vaultData,
        securityQuestions: newSecurityQuestions
      };
      
      await saveVaultData(updatedVault);
      setNewSecurityQuestions([{ question: '', answer: '' }, { question: '', answer: '' }]);
      showTooltip('Security questions updated successfully!', 'success');
      
    } catch (error) {
      setError('Failed to update security questions');
    } finally {
      setLoading(false);
    }
  };

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    saveAppSettings({ darkMode: newDarkMode });
  };

  const handleLogoClick = () => {
    if (authStep === 'authenticated') {
      handleLogout();
    }
  };

  // Background gradient
  const backgroundClass = darkMode 
    ? 'min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-indigo-900'
    : 'min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50';

  if (authStep === 'login' || authStep === 'register') {
    return (
      <div className={backgroundClass}>
        <div className="container mx-auto px-4 py-8">
          <Header 
            darkMode={darkMode} 
            onToggleDarkMode={toggleDarkMode}
            onLogoClick={handleLogoClick}
          />
          
          <div className="max-w-md mx-auto">
            <div className={`backdrop-blur-sm rounded-2xl p-8 shadow-xl border ${
              darkMode 
                ? 'bg-gray-800/80 border-gray-700/20' 
                : 'bg-white/80 border-white/20'
            }`}>
              <div className="flex justify-center mb-8">
                <TabButton
                  active={authStep === 'login'}
                  onClick={() => {
                    setAuthStep('login');
                    setError('');
                  }}
                  darkMode={darkMode}
                >
                  Sign In
                </TabButton>
                <TabButton
                  active={authStep === 'register'}
                  onClick={() => {
                    setAuthStep('register');
                    setError('');
                  }}
                  darkMode={darkMode}
                >
                  Sign Up
                </TabButton>
              </div>

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
                showPasswordStrength={authStep === 'register'}
              />

              {authStep === 'register' && (
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

                  <div className="space-y-4 mb-6">
                    <h4 className={`font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                      Security Questions
                    </h4>
                    {securityQuestions.map((sq, index) => (
                      <div key={index} className="space-y-3">
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
                </>
              )}

              {error && (
                <p className="text-red-500 text-sm mb-4 flex items-center">
                  <span className="w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center mr-2">!</span>
                  {error}
                </p>
              )}

              <ActionButton
                onClick={authStep === 'login' ? handleLogin : handleRegister}
                loading={loading}
                darkMode={darkMode}
              >
                {authStep === 'login' ? 'Sign In' : 'Create Account'}
              </ActionButton>
            </div>
          </div>

          <div className="max-w-4xl mx-auto mt-12 space-y-8">
            <SecurityFeatures darkMode={darkMode} />
            <FAQ darkMode={darkMode} />
            <SocialLinks darkMode={darkMode} onFeedbackClick={() => setShowFeedbackModal(true)} />
          </div>
        </div>

        <Tooltip
          show={tooltip.show}
          message={tooltip.message}
          type={tooltip.type}
          onHide={() => setTooltip({ show: false, message: '', type: 'info' })}
          darkMode={darkMode}
        />

        <FeedbackModal
          isOpen={showFeedbackModal}
          onClose={() => setShowFeedbackModal(false)}
          darkMode={darkMode}
          onSuccess={(message) => showTooltip(message, 'success')}
        />
      </div>
    );
  }

  if (authStep === 'security-verification') {
    return (
      <div className={backgroundClass}>
        <div className="container mx-auto px-4 py-8">
          <Header 
            darkMode={darkMode} 
            onToggleDarkMode={toggleDarkMode}
            onLogoClick={handleLogoClick}
          />
          
          <div className="max-w-md mx-auto">
            <div className={`backdrop-blur-sm rounded-2xl p-8 shadow-xl border ${
              darkMode 
                ? 'bg-gray-800/80 border-gray-700/20' 
                : 'bg-white/80 border-white/20'
            }`}>
              <div className="text-center mb-8">
                <Shield className={`w-16 h-16 mx-auto mb-4 ${darkMode ? 'text-purple-400' : 'text-indigo-600'}`} />
                <h2 className={`text-2xl font-bold ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                  Security Verification
                </h2>
                <p className={`mt-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Please answer your security questions to access your vault
                </p>
              </div>

              {pendingAuth?.user?.securityQuestions?.map((sq: any, index: number) => (
                <div key={index} className="mb-6">
                  <label className={`block text-sm font-medium mb-2 ${
                    darkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    {sq.question}
                  </label>
                  <FloatingInput
                    id={`security-answer-${index}`}
                    label={`Answer ${index + 1}`}
                    value={securityAnswers[index]}
                    onChange={(value) => {
                      const updated = [...securityAnswers];
                      updated[index] = value;
                      setSecurityAnswers(updated);
                    }}
                    placeholder="Your answer"
                    required
                    darkMode={darkMode}
                  />
                </div>
              ))}

              {error && (
                <p className="text-red-500 text-sm mb-4 flex items-center">
                  <span className="w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center mr-2">!</span>
                  {error}
                </p>
              )}

              <ActionButton
                onClick={handleSecurityVerification}
                loading={loading}
                darkMode={darkMode}
              >
                Verify & Access Vault
              </ActionButton>

              <button
                onClick={() => {
                  setAuthStep('login');
                  setPendingAuth(null);
                  setSecurityAnswers(['', '']);
                  setError('');
                }}
                className={`w-full mt-4 py-2 text-sm ${
                  darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-800'
                } transition-colors`}
              >
                Back to Login
              </button>
            </div>
          </div>
        </div>

        <Tooltip
          show={tooltip.show}
          message={tooltip.message}
          type={tooltip.type}
          onHide={() => setTooltip({ show: false, message: '', type: 'info' })}
          darkMode={darkMode}
        />
      </div>
    );
  }

  // Authenticated view
  return (
    <div className={backgroundClass}>
      <div className="container mx-auto px-4 py-8">
        <Header 
          darkMode={darkMode} 
          onToggleDarkMode={toggleDarkMode}
          onLogoClick={handleLogoClick}
          onExport={() => setShowExportModal(true)}
          onLogout={handleLogout}
          currentUser={currentUser}
        />
        
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-center mb-8">
            <TabButton
              active={activeTab === 'vault'}
              onClick={() => setActiveTab('vault')}
              darkMode={darkMode}
            >
              My Vault ({vaultData.seeds.length})
            </TabButton>
            <TabButton
              active={activeTab === 'add'}
              onClick={() => setActiveTab('add')}
              darkMode={darkMode}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Seed
            </TabButton>
            <TabButton
              active={activeTab === 'settings'}
              onClick={() => setActiveTab('settings')}
              darkMode={darkMode}
            >
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </TabButton>
          </div>

          <div className={`backdrop-blur-sm rounded-2xl p-8 shadow-xl border ${
            darkMode 
              ? 'bg-gray-800/80 border-gray-700/20' 
              : 'bg-white/80 border-white/20'
          }`}>
            {activeTab === 'vault' && (
              <div>
                <h2 className={`text-2xl font-bold mb-6 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                  Your Seed Phrases
                </h2>
                {vaultData.seeds.length === 0 ? (
                  <div className="text-center py-12">
                    <Shield className={`w-16 h-16 mx-auto mb-4 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`} />
                    <p className={`text-lg ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      No seed phrases stored yet
                    </p>
                    <p className={`text-sm mt-2 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                      Click "Add Seed" to store your first seed phrase securely
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {vaultData.seeds.map((seed) => (
                      <SeedCard
                        key={seed.id}
                        seed={seed}
                        onDelete={() => handleDeleteSeed(seed.id)}
                        darkMode={darkMode}
                        onCopy={() => showTooltip('Seed phrase copied! Will clear in 10 seconds.', 'success')}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'add' && (
              <div>
                <h2 className={`text-2xl font-bold mb-6 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                  Add New Seed Phrase
                </h2>
                
                <FloatingInput
                  id="seedName"
                  label="Wallet Name (Optional)"
                  value={newSeedName}
                  onChange={setNewSeedName}
                  placeholder="e.g., MetaMask Wallet, Hardware Wallet"
                  darkMode={darkMode}
                />

                <div className="mb-6">
                  <label className={`block text-sm font-medium mb-2 ${
                    darkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Seed Phrase *
                  </label>
                  <textarea
                    value={newSeed}
                    onChange={(e) => {
                      setNewSeed(e.target.value);
                      setError('');
                    }}
                    placeholder="Enter your 12 or 24 word seed phrase..."
                    rows={4}
                    className={`w-full px-4 py-3 border-2 rounded-xl transition-all duration-200 outline-none resize-none ${
                      darkMode
                        ? 'text-white bg-gray-800 border-gray-600 focus:border-purple-500'
                        : 'text-gray-900 bg-white border-gray-200 focus:border-indigo-500'
                    } ${
                      error 
                        ? darkMode ? 'border-red-500 focus:border-red-400' : 'border-red-400 focus:border-red-500'
                        : ''
                    }`}
                  />
                </div>

                {error && (
                  <p className="text-red-500 text-sm mb-4 flex items-center">
                    <span className="w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center mr-2">!</span>
                    {error}
                  </p>
                )}

                <ActionButton
                  onClick={handleAddSeed}
                  disabled={!newSeed.trim()}
                  darkMode={darkMode}
                >
                  Add Seed Phrase
                </ActionButton>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-8">
                <div>
                  <h2 className={`text-2xl font-bold mb-6 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                    Settings
                  </h2>
                  
                  <div className="space-y-8">
                    <div>
                      <h3 className={`text-lg font-semibold mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Change Password
                      </h3>
                      
                      <FloatingInput
                        id="newPassword"
                        label="New Password"
                        value={newPassword}
                        onChange={setNewPassword}
                        placeholder="Enter new password"
                        isPassword
                        required
                        darkMode={darkMode}
                        showPasswordStrength
                      />

                      <FloatingInput
                        id="confirmNewPassword"
                        label="Confirm New Password"
                        value={confirmNewPassword}
                        onChange={setConfirmNewPassword}
                        placeholder="Confirm new password"
                        isPassword
                        required
                        darkMode={darkMode}
                      />

                      <ActionButton
                        onClick={handleChangePassword}
                        loading={loading}
                        disabled={!newPassword || !confirmNewPassword}
                        darkMode={darkMode}
                      >
                        Change Password
                      </ActionButton>
                    </div>

                    <div>
                      <h3 className={`text-lg font-semibold mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Update Security Questions
                      </h3>
                      
                      {newSecurityQuestions.map((sq, index) => (
                        <div key={index} className="space-y-3 mb-4">
                          <FloatingInput
                            id={`newQuestion-${index}`}
                            label={`Security Question ${index + 1}`}
                            value={sq.question}
                            onChange={(value) => {
                              const updated = [...newSecurityQuestions];
                              updated[index].question = value;
                              setNewSecurityQuestions(updated);
                            }}
                            placeholder="e.g., What was your first pet's name?"
                            required
                            darkMode={darkMode}
                          />
                          <FloatingInput
                            id={`newAnswer-${index}`}
                            label={`Answer ${index + 1}`}
                            value={sq.answer}
                            onChange={(value) => {
                              const updated = [...newSecurityQuestions];
                              updated[index].answer = value;
                              setNewSecurityQuestions(updated);
                            }}
                            placeholder="Your answer"
                            required
                            darkMode={darkMode}
                          />
                        </div>
                      ))}

                      <ActionButton
                        onClick={handleUpdateSecurityQuestions}
                        loading={loading}
                        disabled={!newSecurityQuestions[0].question || !newSecurityQuestions[0].answer ||
                                 !newSecurityQuestions[1].question || !newSecurityQuestions[1].answer}
                        darkMode={darkMode}
                      >
                        Update Security Questions
                      </ActionButton>
                    </div>
                  </div>
                </div>

                {error && (
                  <p className="text-red-500 text-sm flex items-center">
                    <span className="w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center mr-2">!</span>
                    {error}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <SocialLinks darkMode={darkMode} onFeedbackClick={() => setShowFeedbackModal(true)} />
      </div>

      <Tooltip
        show={tooltip.show}
        message={tooltip.message}
        type={tooltip.type}
        onHide={() => setTooltip({ show: false, message: '', type: 'info' })}
        darkMode={darkMode}
      />

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
    </div>
  );
}

export default App;
