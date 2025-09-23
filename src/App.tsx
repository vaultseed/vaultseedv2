import React, { useState, useCallback } from 'react';
import { PlusCircle, LogOut, Download, Vault, Moon, Sun, Eye, EyeOff, Copy, Trash2, Shield, Lock, Key, Clock, Clipboard, Code, Server, Zap, HelpCircle, ChevronDown, ChevronUp, MessageSquare, X, Star, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { authAPI, vaultAPI } from './utils/api';
import FAQ from './components/FAQ';
import SecurityFeatures from './components/SecurityFeatures';
import FeedbackModal from './components/FeedbackModal';
import SocialLinks from './components/SocialLinks';

// Types
interface SecurityQuestion {
  question: string;
  answer: string;
}

interface SeedPhrase {
  seed: string;
  name?: string;
  id: string;
  createdAt: string;
}

interface VaultData {
  seeds: SeedPhrase[];
  securityQuestions: SecurityQuestion[];
}

interface StoredVault {
  salt: string;
  data: string;
}

// Crypto utilities
async function getKey(password: string, salt: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode(salt),
      iterations: 500000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptData(key: CryptoKey, data: string): Promise<string> {
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(data)
  );
  
  const buf = new Uint8Array(iv.byteLength + encrypted.byteLength);
  buf.set(iv, 0);
  buf.set(new Uint8Array(encrypted), iv.byteLength);
  
  return btoa(String.fromCharCode(...buf));
}

async function decryptData(key: CryptoKey, data: string): Promise<string | null> {
  try {
    const buf = new Uint8Array([...atob(data)].map(c => c.charCodeAt(0)));
    const iv = buf.slice(0, 12);
    const encText = buf.slice(12);
    
    const dec = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      encText
    );
    
    return new TextDecoder().decode(dec);
  } catch (e) {
    return null;
  }
}

function validatePassword(password: string): boolean {
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])[A-Za-z\d!@#$%^&*(),.?":{}|<>]{8,}$/;
  return regex.test(password);
}

function generateSalt(): string {
  return crypto.getRandomValues(new Uint8Array(16))
    .reduce((str, b) => str + String.fromCharCode(b), "");
}

// Storage utilities
function saveVault(email: string, vault: StoredVault): void {
  localStorage.setItem(`seedvault_${email}`, JSON.stringify(vault));
}

function loadVault(email: string): StoredVault | null {
  const stored = localStorage.getItem(`seedvault_${email}`);
  return stored ? JSON.parse(stored) : null;
}

function clearClipboardAfterDelay(text: string, delay: number = 10000): void {
  navigator.clipboard.writeText(text).then(() => {
    setTimeout(() => navigator.clipboard.writeText(""), delay);
  });
}

type ActiveTab = 'login' | 'create';
type AppState = 'auth' | 'security' | 'vault';

function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('login');
  const [appState, setAppState] = useState<AppState>('auth');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  
  const [tooltip, setTooltip] = useState({ show: false, message: '', type: 'info' as const });
  
  const [loginData, setLoginData] = useState({
    email: '',
    password: '',
    error: ''
  });
  
  const [createData, setCreateData] = useState({
    email: '',
    password: '',
    securityQuestion1: '',
    securityQuestion2: '',
    error: ''
  });
  
  const [securityData, setSecurityData] = useState({
    answer1: '',
    answer2: '',
    error: '',
    questions: ['', '']
  });
  
  const [vaultData, setVaultData] = useState<VaultData>({
    seeds: [],
    securityQuestions: []
  });
  
  const [newSeed, setNewSeed] = useState({
    phrase: '',
    name: ''
  });
  
  const [vaultKey, setVaultKey] = useState<CryptoKey | null>(null);
  const [vaultSalt, setVaultSalt] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  const showTooltip = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setTooltip({ show: true, message, type });
  }, []);

  const handleCreateVault = useCallback(async () => {
    const { email, password, securityQuestion1, securityQuestion2 } = createData;
    
    if (!email || !password || !securityQuestion1 || !securityQuestion2) {
      setCreateData(prev => ({ ...prev, error: 'All fields are required!' }));
      return;
    }
    
    if (!validatePassword(password)) {
      setCreateData(prev => ({ 
        ...prev, 
        error: 'Password must be 8+ characters with uppercase, lowercase, number, and special character' 
      }));
      return;
    }
    
    setLoading(true);
    
    try {
      const salt = generateSalt();
      
      const registerData = {
        email,
        password,
        securityQuestions: [
          { question: "What was your favourite class in school?", answer: securityQuestion1 },
          { question: "What is your favourite city in the world?", answer: securityQuestion2 }
        ],
        salt
      };
      
      await authAPI.register(registerData);
      
      setCreateData({
        email: '',
        password: '',
        securityQuestion1: '',
        securityQuestion2: '',
        error: ''
      });
      
      setActiveTab('login');
      setLoginData(prev => ({ 
        ...prev, 
        error: '',
        email,
      }));
      
      setTimeout(() => {
        setLoginData(prev => ({ ...prev, error: '' }));
        showTooltip('Vault created successfully! Please login.', 'success');
      }, 100);
      
    } catch (error) {
      setCreateData(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to create account. Please try again.' 
      }));
    } finally {
      setLoading(false);
    }
  }, [createData, showTooltip]);

  const handleLogin = useCallback(async () => {
    const { email, password } = loginData;
    
    if (!email || !password) {
      setLoginData(prev => ({ ...prev, error: 'Please enter email and password!' }));
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await authAPI.login({ email, password });
      
      setUser(response.user);
      setUserEmail(email);
      
      setSecurityData({
        answer1: '',
        answer2: '',
        error: '',
        questions: response.user.securityQuestions.map((q: any) => q.question)
      });
      
      setAppState('security');
      
    } catch (error) {
      setLoginData(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Login failed. Please try again.' 
      }));
    } finally {
      setLoading(false);
    }
  }, [loginData]);

  const handleSecurityVerification = useCallback(() => {
    const { answer1, answer2 } = securityData;
    
    if (!answer1 || !answer2) {
      setSecurityData(prev => ({ ...prev, error: 'Please answer both security questions!' }));
      return;
    }
    
    setLoading(true);
    
    authAPI.verifySecurityQuestions({
      email: userEmail,
      answers: [answer1, answer2]
    }).then(async () => {
      setSecurityData(prev => ({ ...prev, error: '' }));
      
      // Load vault data
      try {
        const vaultResponse = await vaultAPI.get();
        if (vaultResponse.encryptedData) {
          // Decrypt vault data
          const key = await getKey(loginData.password, vaultResponse.clientSalt);
          const decrypted = await decryptData(key, vaultResponse.encryptedData);
          
          if (decrypted) {
            const vault: VaultData = JSON.parse(decrypted);
            setVaultData(vault);
            setVaultKey(key);
            setVaultSalt(vaultResponse.clientSalt);
          }
        } else {
          // New vault
          const salt = generateSalt();
          const key = await getKey(loginData.password, salt);
          const newVaultData: VaultData = {
            seeds: [],
            securityQuestions: user.securityQuestions || []
          };
          setVaultData(newVaultData);
          setVaultKey(key);
          setVaultSalt(salt);
        }
        
        setAppState('vault');
      } catch (error) {
        setSecurityData(prev => ({ 
          ...prev, 
          error: 'Failed to load vault. Please try again.' 
        }));
      }
    }).catch((error) => {
      setSecurityData(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Security verification failed!' 
      }));
    }).finally(() => {
      setLoading(false);
    });
  }, [securityData, userEmail, loginData.password, user]);

  const handleAddSeed = useCallback(async () => {
    if (!newSeed.phrase.trim()) return;
    
    const seedPhrase: SeedPhrase = {
      id: crypto.randomUUID(),
      seed: newSeed.phrase.trim(),
      name: newSeed.name.trim() || undefined,
      createdAt: new Date().toISOString()
    };
    
    const updatedVaultData = {
      ...vaultData,
      seeds: [...vaultData.seeds, seedPhrase]
    };
    
    setVaultData(updatedVaultData);
    
    if (vaultKey && userEmail) {
      try {
        const encryptedData = await encryptData(vaultKey, JSON.stringify(updatedVaultData));
        await vaultAPI.save(encryptedData, vaultSalt);
      } catch (error) {
        console.error('Failed to save vault:', error);
        showTooltip('Failed to save seed phrase. Please try again.', 'error');
        return;
      }
    }
    
    clearClipboardAfterDelay(seedPhrase.seed);
    setNewSeed({ phrase: '', name: '' });
    showTooltip('Seed phrase added and copied to clipboard!', 'success');
  }, [newSeed, vaultData, vaultKey, userEmail, vaultSalt, showTooltip]);

  const handleDeleteSeed = useCallback(async (seedId: string) => {
    const updatedVaultData = {
      ...vaultData,
      seeds: vaultData.seeds.filter(seed => seed.id !== seedId)
    };
    
    setVaultData(updatedVaultData);
    
    if (vaultKey && userEmail) {
      try {
        const encryptedData = await encryptData(vaultKey, JSON.stringify(updatedVaultData));
        await vaultAPI.save(encryptedData, vaultSalt);
      } catch (error) {
        console.error('Failed to save vault:', error);
        showTooltip('Failed to delete seed phrase. Please try again.', 'error');
      }
    }
  }, [vaultData, vaultKey, userEmail, vaultSalt]);

  const handleLogout = useCallback(() => {
    authAPI.logout();
    setVaultKey(null);
    setVaultData({ seeds: [], securityQuestions: [] });
    setVaultSalt('');
    setUserEmail('');
    setUser(null);
    setAppState('auth');
    setActiveTab('login');
    setLoginData({ email: '', password: '', error: '' });
    setSecurityData({ answer1: '', answer2: '', error: '', questions: ['', ''] });
  }, []);

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      darkMode ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100'
    }`}>
      {/* Header */}
      <header className={`relative overflow-hidden min-h-[200px] md:min-h-[240px] ${
        darkMode 
          ? 'bg-gradient-to-br from-gray-900 via-purple-900 to-indigo-900' 
          : 'bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800'
      }`}>
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative px-4 sm:px-6 py-6 md:py-8 text-center">
          <div className="absolute top-4 right-4">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 sm:p-3 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white hover:bg-white/20 transition-all duration-200 hover:scale-110"
            >
              {darkMode ? <Sun className="w-4 h-4 sm:w-5 sm:h-5" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>
          </div>
          <div className="flex items-center justify-center mb-3 sm:mb-4">
            <Vault className="w-7 h-7 sm:w-9 sm:h-9 md:w-10 md:h-10 text-white mr-2 sm:mr-3" />
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white">
              VaultSeed
            </h1>
          </div>
          <p className={`text-sm sm:text-base md:text-lg max-w-2xl mx-auto font-light leading-relaxed px-4 ${
            darkMode ? 'text-purple-100' : 'text-indigo-100'
          }`}>
            Securely store your crypto seed phrases with enterprise-grade encryption and zero-knowledge architecture.
          </p>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-4 sm:py-6 md:py-8 max-w-2xl">
        {appState === 'auth' && (
          <>
            {/* Tabs */}
            <div className={`flex justify-center mb-4 sm:mb-6 space-x-2 sm:space-x-4 backdrop-blur-sm p-2 rounded-2xl border shadow-lg ${
              darkMode 
                ? 'bg-gray-800/60 border-gray-700/20' 
                : 'bg-white/60 border-white/20'
            }`}>
              <button
                onClick={() => setActiveTab('login')}
                className={`px-4 sm:px-6 md:px-8 py-2 sm:py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 relative text-sm sm:text-base ${
                  activeTab === 'login'
                    ? darkMode
                      ? 'bg-gray-800 text-purple-400 shadow-lg border-2 border-purple-500/30'
                      : 'bg-white text-indigo-600 shadow-lg border-2 border-indigo-100'
                    : darkMode
                      ? 'bg-gray-800/60 text-gray-300 hover:bg-gray-800/80 border-2 border-transparent'
                      : 'bg-white/60 text-gray-600 hover:bg-white/80 border-2 border-transparent'
                }`}
              >
                Login
              </button>
              <button
                onClick={() => setActiveTab('create')}
                className={`px-4 sm:px-6 md:px-8 py-2 sm:py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 relative text-sm sm:text-base ${
                  activeTab === 'create'
                    ? darkMode
                      ? 'bg-gray-800 text-purple-400 shadow-lg border-2 border-purple-500/30'
                      : 'bg-white text-indigo-600 shadow-lg border-2 border-indigo-100'
                    : darkMode
                      ? 'bg-gray-800/60 text-gray-300 hover:bg-gray-800/80 border-2 border-transparent'
                      : 'bg-white/60 text-gray-600 hover:bg-white/80 border-2 border-transparent'
                }`}
              >
                Create Vault
              </button>
            </div>

            {/* Login Form */}
            {activeTab === 'login' && (
              <div className={`backdrop-blur-sm rounded-2xl p-4 sm:p-6 md:p-8 shadow-xl border mb-4 sm:mb-6 ${
                darkMode ? 'bg-gray-800/80 border-gray-700/20' : 'bg-white/80 border-white/20'
              }`}>
                <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                  Access Your Vault
                </h2>
                
                <div className="relative mb-6">
                  <input
                    type="email"
                    value={loginData.email}
                    onChange={(e) => setLoginData(prev => ({ ...prev, email: e.target.value, error: '' }))}
                    placeholder="Email Address"
                    className={`w-full px-4 py-4 border-2 rounded-xl transition-all duration-200 outline-none text-base ${
                      darkMode
                        ? 'text-white bg-gray-800 border-gray-600 focus:border-purple-500'
                        : 'text-gray-900 bg-white border-gray-200 focus:border-indigo-500'
                    }`}
                  />
                </div>
                
                <div className="relative mb-6">
                  <input
                    type="password"
                    value={loginData.password}
                    onChange={(e) => setLoginData(prev => ({ ...prev, password: e.target.value, error: '' }))}
                    placeholder="Master Password"
                    className={`w-full px-4 py-4 border-2 rounded-xl transition-all duration-200 outline-none text-base ${
                      darkMode
                        ? 'text-white bg-gray-800 border-gray-600 focus:border-purple-500'
                        : 'text-gray-900 bg-white border-gray-200 focus:border-indigo-500'
                    } ${
                      loginData.error 
                        ? darkMode ? 'border-red-500 focus:border-red-400' : 'border-red-400 focus:border-red-500'
                        : ''
                    }`}
                  />
                  {loginData.error && (
                    <p className="text-red-500 text-sm mt-2 flex items-center">
                      <span className="w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center mr-2">!</span>
                      {loginData.error}
                    </p>
                  )}
                </div>
                
                <button
                  onClick={handleLogin}
                  disabled={!loginData.email || !loginData.password || loading}
                  className={`w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200 transform disabled:opacity-50 disabled:cursor-not-allowed ${
                    darkMode 
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 hover:scale-[1.02] shadow-lg hover:shadow-xl'
                      : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 hover:scale-[1.02] shadow-lg hover:shadow-xl'
                  }`}
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                      Loading...
                    </div>
                  ) : (
                    'Access Vault'
                  )}
                </button>
              </div>
            )}

            {/* Create Vault Form */}
            {activeTab === 'create' && (
              <div className={`backdrop-blur-sm rounded-2xl p-4 sm:p-6 md:p-8 shadow-xl border mb-4 sm:mb-6 ${
                darkMode ? 'bg-gray-800/80 border-gray-700/20' : 'bg-white/80 border-white/20'
              }`}>
                <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                  Create New Vault
                </h2>
                
                <div className="space-y-6">
                  <input
                    type="email"
                    value={createData.email}
                    onChange={(e) => setCreateData(prev => ({ ...prev, email: e.target.value, error: '' }))}
                    placeholder="Email Address"
                    className={`w-full px-4 py-4 border-2 rounded-xl transition-all duration-200 outline-none text-base ${
                      darkMode
                        ? 'text-white bg-gray-800 border-gray-600 focus:border-purple-500'
                        : 'text-gray-900 bg-white border-gray-200 focus:border-indigo-500'
                    }`}
                  />
                  
                  <input
                    type="password"
                    value={createData.password}
                    onChange={(e) => setCreateData(prev => ({ ...prev, password: e.target.value, error: '' }))}
                    placeholder="Master Password"
                    className={`w-full px-4 py-4 border-2 rounded-xl transition-all duration-200 outline-none text-base ${
                      darkMode
                        ? 'text-white bg-gray-800 border-gray-600 focus:border-purple-500'
                        : 'text-gray-900 bg-white border-gray-200 focus:border-indigo-500'
                    }`}
                  />
                  
                  <input
                    type="text"
                    value={createData.securityQuestion1}
                    onChange={(e) => setCreateData(prev => ({ ...prev, securityQuestion1: e.target.value, error: '' }))}
                    placeholder="What was your favourite class in school?"
                    className={`w-full px-4 py-4 border-2 rounded-xl transition-all duration-200 outline-none text-base ${
                      darkMode
                        ? 'text-white bg-gray-800 border-gray-600 focus:border-purple-500'
                        : 'text-gray-900 bg-white border-gray-200 focus:border-indigo-500'
                    }`}
                  />
                  
                  <input
                    type="text"
                    value={createData.securityQuestion2}
                    onChange={(e) => setCreateData(prev => ({ ...prev, securityQuestion2: e.target.value, error: '' }))}
                    placeholder="What is your favourite city in the world?"
                    className={`w-full px-4 py-4 border-2 rounded-xl transition-all duration-200 outline-none text-base ${
                      darkMode
                        ? 'text-white bg-gray-800 border-gray-600 focus:border-purple-500'
                        : 'text-gray-900 bg-white border-gray-200 focus:border-indigo-500'
                    } ${
                      createData.error 
                        ? darkMode ? 'border-red-500 focus:border-red-400' : 'border-red-400 focus:border-red-500'
                        : ''
                    }`}
                  />
                  
                  {createData.error && (
                    <p className="text-red-500 text-sm flex items-center">
                      <span className="w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center mr-2">!</span>
                      {createData.error}
                    </p>
                  )}
                </div>
                
                <button
                  onClick={handleCreateVault}
                  disabled={!createData.email || !createData.password || !createData.securityQuestion1 || !createData.securityQuestion2 || loading}
                  className={`w-full mt-6 py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200 transform disabled:opacity-50 disabled:cursor-not-allowed ${
                    darkMode 
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 hover:scale-[1.02] shadow-lg hover:shadow-xl'
                      : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 hover:scale-[1.02] shadow-lg hover:shadow-xl'
                  }`}
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                      Loading...
                    </div>
                  ) : (
                    'Create Secure Vault'
                  )}
                </button>
              </div>
            )}

            {/* Why VaultSeed Section */}
            <div className={`backdrop-blur-sm rounded-2xl p-4 sm:p-6 md:p-8 shadow-xl border mb-4 sm:mb-6 ${
              darkMode ? 'bg-gray-800/80 border-gray-700/20' : 'bg-white/80 border-white/20'
            }`}>
              <div className="text-center mb-6">
                <h3 className={`text-xl sm:text-2xl font-bold mb-4 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                  Why Choose VaultSeed?
                </h3>
                <p className={`text-sm sm:text-base leading-relaxed ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  VaultSeed is the most secure way to store your crypto seed phrases. Unlike other solutions, 
                  we use zero-knowledge architecture with enterprise-grade encryption that happens entirely 
                  on your device before any data is transmitted.
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                <div className="text-center">
                  <div className={`w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-full flex items-center justify-center ${
                    darkMode ? 'bg-purple-900/30' : 'bg-indigo-100'
                  }`}>
                    <Shield className={`w-6 h-6 sm:w-8 sm:h-8 ${darkMode ? 'text-purple-400' : 'text-indigo-600'}`} />
                  </div>
                  <h4 className={`font-semibold text-sm sm:text-base mb-2 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                    Military-Grade Security
                  </h4>
                  <p className={`text-xs sm:text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    AES-256 encryption with PBKDF2 key derivation and 500,000 iterations
                  </p>
                </div>
                
                <div className="text-center">
                  <div className={`w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-full flex items-center justify-center ${
                    darkMode ? 'bg-purple-900/30' : 'bg-indigo-100'
                  }`}>
                    <Eye className={`w-6 h-6 sm:w-8 sm:h-8 ${darkMode ? 'text-purple-400' : 'text-indigo-600'}`} />
                  </div>
                  <h4 className={`font-semibold text-sm sm:text-base mb-2 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                    Zero-Knowledge
                  </h4>
                  <p className={`text-xs sm:text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Your data is encrypted before it ever leaves your device. We can't see it.
                  </p>
                </div>
                
                <div className="text-center">
                  <div className={`w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-full flex items-center justify-center ${
                    darkMode ? 'bg-purple-900/30' : 'bg-indigo-100'
                  }`}>
                    <Code className={`w-6 h-6 sm:w-8 sm:h-8 ${darkMode ? 'text-purple-400' : 'text-indigo-600'}`} />
                  </div>
                  <h4 className={`font-semibold text-sm sm:text-base mb-2 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                    Open Source
                  </h4>
                  <p className={`text-xs sm:text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Fully auditable code reviewed by security experts worldwide
                  </p>
                </div>
              </div>
            </div>

            {/* Security Warning */}
            <div className={`backdrop-blur-sm rounded-2xl p-4 sm:p-6 md:p-8 shadow-xl border mb-4 sm:mb-6 ${
              darkMode 
                ? 'bg-red-900/20 border-red-700/30' 
                : 'bg-red-50/80 border-red-200/50'
            }`}>
              <div className="flex items-start space-x-3">
                <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                  darkMode ? 'bg-red-800' : 'bg-red-100'
                }`}>
                  <span className={`text-sm font-bold ${darkMode ? 'text-red-200' : 'text-red-600'}`}>!</span>
                </div>
                <div>
                  <h3 className={`text-lg sm:text-xl font-bold mb-3 ${
                    darkMode ? 'text-red-200' : 'text-red-800'
                  }`}>
                    🚨 Security Warning
                  </h3>
                  <div className={`space-y-2 text-sm sm:text-base ${
                    darkMode ? 'text-red-300' : 'text-red-700'
                  }`}>
                    <p>
                      <strong>Official Domain:</strong> VaultSeed only operates from <strong>vaultseed.io</strong>
                    </p>
                    <p>
                      <strong>Never Trust Imposters:</strong> VaultSeed will NEVER contact you asking for your master password, security questions, or seed phrases.
                    </p>
                    <p>
                      <strong>Verify Source:</strong> Always check the URL and only use our official GitHub repository: <a 
                        href="https://github.com/vaultseed-io/vaultseed.io" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="underline hover:no-underline"
                      >
                        github.com/vaultseed-io/vaultseed.io
                      </a>
                    </p>
                  </div>
                </div>
              </div>
            </div>
            {/* Security Features */}
            <SecurityFeatures darkMode={darkMode} />

            {/* FAQ Section */}
            {/* FAQ Section */}
            <FAQ darkMode={darkMode} />

            {/* Social Links */}
            <SocialLinks darkMode={darkMode} onFeedbackClick={() => setShowFeedbackModal(true)} />
          </>
        )}

        {appState === 'security' && (
          <div className={`backdrop-blur-sm rounded-2xl p-4 sm:p-6 md:p-8 shadow-xl border ${
            darkMode ? 'bg-gray-800/80 border-gray-700/20' : 'bg-white/80 border-white/20'
          }`}>
            <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
              Verify Your Identity
            </h2>
            <p className={`mb-6 sm:mb-8 text-sm sm:text-base ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Please answer your security questions to access your vault.
            </p>
            
            <div className="space-y-6">
              <input
                type="text"
                value={securityData.answer1}
                onChange={(e) => setSecurityData(prev => ({ ...prev, answer1: e.target.value, error: '' }))}
                placeholder={securityData.questions[0]}
                className={`w-full px-4 py-4 border-2 rounded-xl transition-all duration-200 outline-none text-base ${
                  darkMode
                    ? 'text-white bg-gray-800 border-gray-600 focus:border-purple-500'
                    : 'text-gray-900 bg-white border-gray-200 focus:border-indigo-500'
                }`}
              />
              
              <input
                type="text"
                value={securityData.answer2}
                onChange={(e) => setSecurityData(prev => ({ ...prev, answer2: e.target.value, error: '' }))}
                placeholder={securityData.questions[1]}
                className={`w-full px-4 py-4 border-2 rounded-xl transition-all duration-200 outline-none text-base ${
                  darkMode
                    ? 'text-white bg-gray-800 border-gray-600 focus:border-purple-500'
                    : 'text-gray-900 bg-white border-gray-200 focus:border-indigo-500'
                } ${
                  securityData.error 
                    ? darkMode ? 'border-red-500 focus:border-red-400' : 'border-red-400 focus:border-red-500'
                    : ''
                }`}
              />
              
              {securityData.error && (
                <p className="text-red-500 text-sm flex items-center">
                  <span className="w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center mr-2">!</span>
                  {securityData.error}
                </p>
              )}
            </div>
            
            <button
              onClick={handleSecurityVerification}
              disabled={!securityData.answer1 || !securityData.answer2 || loading}
              className={`w-full mt-6 py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200 transform disabled:opacity-50 disabled:cursor-not-allowed ${
                darkMode 
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 hover:scale-[1.02] shadow-lg hover:shadow-xl'
                  : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 hover:scale-[1.02] shadow-lg hover:shadow-xl'
              }`}
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                  Verifying...
                </div>
              ) : (
                'Verify Identity'
              )}
            </button>
          </div>
        )}

        {appState === 'vault' && (
          <div className="space-y-4 sm:space-y-6">
            {/* Add New Seed */}
            <div className={`backdrop-blur-sm rounded-2xl p-4 sm:p-6 md:p-8 shadow-xl border ${
              darkMode ? 'bg-gray-800/80 border-gray-700/20' : 'bg-white/80 border-white/20'
            }`}>
              <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 flex items-center ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                <PlusCircle className={`w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 ${darkMode ? 'text-purple-400' : 'text-indigo-600'}`} />
                Add New Seed Phrase
              </h2>
              
              <div className="space-y-4">
                <input
                  type="text"
                  value={newSeed.phrase}
                  onChange={(e) => setNewSeed(prev => ({ ...prev, phrase: e.target.value }))}
                  placeholder="Enter your seed phrase"
                  className={`w-full px-4 py-4 border-2 rounded-xl transition-all duration-200 outline-none text-base ${
                    darkMode
                      ? 'text-white bg-gray-800 border-gray-600 focus:border-purple-500'
                      : 'text-gray-900 bg-white border-gray-200 focus:border-indigo-500'
                  }`}
                />
                
                <input
                  type="text"
                  value={newSeed.name}
                  onChange={(e) => setNewSeed(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Wallet Name (Optional)"
                  className={`w-full px-4 py-4 border-2 rounded-xl transition-all duration-200 outline-none text-base ${
                    darkMode
                      ? 'text-white bg-gray-800 border-gray-600 focus:border-purple-500'
                      : 'text-gray-900 bg-white border-gray-200 focus:border-indigo-500'
                  }`}
                />
              </div>
              
              <button
                onClick={handleAddSeed}
                disabled={!newSeed.phrase.trim()}
                className={`w-full mt-6 py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200 transform disabled:opacity-50 disabled:cursor-not-allowed ${
                  darkMode 
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 hover:scale-[1.02] shadow-lg hover:shadow-xl'
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 hover:scale-[1.02] shadow-lg hover:shadow-xl'
                }`}
              >
                Add Seed Phrase
              </button>
            </div>

            {/* Seed List */}
            <div className={`backdrop-blur-sm rounded-2xl p-4 sm:p-6 md:p-8 shadow-xl border ${
              darkMode ? 'bg-gray-800/80 border-gray-700/20' : 'bg-white/80 border-white/20'
            }`}>
              <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                Your Seed Phrases
              </h2>
              
              {vaultData.seeds.length === 0 ? (
                <div className="text-center py-8 sm:py-12">
                  <div className={`w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
                    darkMode ? 'bg-gray-700' : 'bg-gray-100'
                  }`}>
                    <PlusCircle className={`w-6 h-6 sm:w-8 sm:h-8 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                  </div>
                  <p className={`text-base sm:text-lg ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    No seed phrases stored yet
                  </p>
                  <p className={`text-xs sm:text-sm mt-2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    Add your first seed phrase above
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:gap-4">
                  {vaultData.seeds.map((seed) => (
                    <SeedCard
                      key={seed.id}
                      seed={seed}
                      onDelete={() => handleDeleteSeed(seed.id)}
                      darkMode={darkMode}
                    />
                  ))}
                </div>
              )}
              
              <div className={`mt-6 sm:mt-8 pt-4 sm:pt-6 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <button
                  onClick={handleLogout}
                  className="w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200 transform hover:scale-[1.02] bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 shadow-lg hover:shadow-xl"
                >
                  <LogOut className="w-4 h-4 sm:w-5 sm:h-5 mr-2 inline" />
                  Logout
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
      
      {/* Feedback Modal */}
      <FeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        darkMode={darkMode}
        onSuccess={showTooltip}
      />
      
      {/* Tooltip */}
      {tooltip.show && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right duration-300 max-w-sm">
          <div className={`flex items-center space-x-3 px-3 sm:px-4 py-2 sm:py-3 rounded-lg border backdrop-blur-sm shadow-lg ${
            tooltip.type === 'success' 
              ? darkMode 
                ? 'bg-green-900/90 text-green-200 border-green-700' 
                : 'bg-green-100 text-green-800 border-green-300'
              : tooltip.type === 'error'
                ? darkMode 
                  ? 'bg-red-900/90 text-red-200 border-red-700' 
                  : 'bg-red-100 text-red-800 border-red-300'
                : darkMode 
                  ? 'bg-blue-900/90 text-blue-200 border-blue-700' 
                  : 'bg-blue-100 text-blue-800 border-blue-300'
          }`}>
            {tooltip.type === 'success' && <CheckCircle className="w-5 h-5" />}
            {tooltip.type === 'error' && <AlertCircle className="w-5 h-5" />}
            {tooltip.type === 'info' && <Info className="w-5 h-5" />}
            <span className="font-medium text-sm sm:text-base">{tooltip.message}</span>
            <button
              onClick={() => setTooltip(prev => ({ ...prev, show: false }))}
              className="ml-2 opacity-70 hover:opacity-100 transition-opacity text-lg"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Seed Card Component
function SeedCard({ seed, onDelete, darkMode }: { 
  seed: SeedPhrase; 
  onDelete: () => void; 
  darkMode: boolean; 
}) {
  const [isVisible, setIsVisible] = useState(false);
  
  const handleCopy = () => {
    clearClipboardAfterDelay(seed.seed);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className={`backdrop-blur-sm rounded-xl p-4 sm:p-6 border shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] group ${
      darkMode 
        ? 'bg-gray-800/80 border-gray-700/30 hover:bg-gray-800/90' 
        : 'bg-white/80 border-white/20 hover:bg-white/90'
    }`}>
      <div className="flex items-start justify-between mb-3 sm:mb-4">
        <div className="flex items-center">
          <Vault className={`w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3 ${
            darkMode ? 'text-purple-400' : 'text-indigo-600'
          }`} />
          <div>
            <h4 className={`font-semibold text-sm sm:text-base ${
              darkMode ? 'text-gray-200' : 'text-gray-800'
            }`}>
              {seed.name || 'Unnamed Wallet'}
            </h4>
            <p className={`text-xs sm:text-sm ${
              darkMode ? 'text-gray-400' : 'text-gray-500'
            }`}>
              Added {formatDate(seed.createdAt)}
            </p>
          </div>
        </div>
        <button
          onClick={onDelete}
          className={`opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 sm:p-2 rounded-lg text-red-500 hover:text-red-600 ${
            darkMode ? 'hover:bg-red-900/20' : 'hover:bg-red-50'
          }`}
        >
          <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
        </button>
      </div>
      
      <div className={`rounded-lg p-3 sm:p-4 mb-3 sm:mb-4 ${
        darkMode ? 'bg-gray-900/50' : 'bg-gray-50'
      }`}>
        <div className="flex items-center justify-between mb-1 sm:mb-2">
          <span className={`text-xs sm:text-sm font-medium ${
            darkMode ? 'text-gray-400' : 'text-gray-500'
          }`}>
            Seed Phrase
          </span>
          <button
            onClick={() => setIsVisible(!isVisible)}
            className={`p-1 rounded transition-colors ${
              darkMode 
                ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
            }`}
          >
            {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <p className={`text-xs sm:text-sm font-mono break-all leading-relaxed ${
          darkMode ? 'text-gray-300' : 'text-gray-700'
        }`}>
          {isVisible ? seed.seed : '•'.repeat(seed.seed.length)}
        </p>
      </div>
      
      <div className="flex gap-2">
        <button
          onClick={handleCopy}
          className={`flex items-center justify-center flex-1 py-2 px-3 sm:px-4 rounded-lg transition-colors duration-200 font-medium text-sm ${
            darkMode 
              ? 'bg-purple-900/30 text-purple-400 hover:bg-purple-900/50' 
              : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
          }`}
        >
          <Copy className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
          Copy
        </button>
        <button
          onClick={() => setIsVisible(!isVisible)}
          className={`py-2 px-2 sm:px-3 rounded-lg transition-colors duration-200 ${
            darkMode 
              ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {isVisible ? <EyeOff className="w-3 h-3 sm:w-4 sm:h-4" /> : <Eye className="w-3 h-3 sm:w-4 sm:h-4" />}
        </button>
      </div>
    </div>
  );
}

export default App;