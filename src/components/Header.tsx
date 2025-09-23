import React from 'react';
import { Vault, Moon, Sun, Github, Twitter } from 'lucide-react';

interface HeaderProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

const Header: React.FC<HeaderProps> = ({ darkMode, onToggleDarkMode }) => {
  return (
    <header className={`relative overflow-hidden min-h-[200px] md:min-h-[240px] ${
      darkMode 
        ? 'bg-gradient-to-br from-gray-900 via-purple-900 to-indigo-900' 
        : 'bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800'
    }`}>
      <div className="absolute inset-0 bg-black/10"></div>
      <div className="relative px-4 sm:px-6 py-6 md:py-8 text-center">
        <div className="absolute top-4 right-4 flex items-center space-x-2">
          <a
            href="https://github.com/vaultseed-io/vaultseed.io"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 sm:p-3 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white hover:bg-white/20 transition-all duration-200 hover:scale-110"
            title="GitHub Repository"
          >
            <Github className="w-4 h-4 sm:w-5 sm:h-5" />
          </a>
          <a
            href="https://x.com/vaultseed_io"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 sm:p-3 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white hover:bg-white/20 transition-all duration-200 hover:scale-110"
            title="Follow us on X"
          >
            <Twitter className="w-4 h-4 sm:w-5 sm:h-5" />
          </a>
          <button
            onClick={onToggleDarkMode}
            className="p-2 sm:p-3 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white hover:bg-white/20 transition-all duration-200 hover:scale-110"
            title="Toggle dark mode"
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
        <div className="mt-3 sm:mt-4 flex justify-center px-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-full px-4 sm:px-6 py-2 border border-white/20">
            <span className="text-white/90 text-xs sm:text-sm font-medium">🔒 Enterprise-grade encryption • Zero-knowledge architecture</span>
          </div>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
    </header>
  );
};

export default Header;