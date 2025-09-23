import React from 'react';
import { Shield, Sun, Moon, Download, Github } from 'lucide-react';

interface HeaderProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onExport?: () => void;
  onLogout?: () => void;
  currentUser?: any;
}

const Header: React.FC<HeaderProps> = ({ 
  darkMode, 
  onToggleDarkMode, 
  onExport, 
  onLogout, 
  currentUser 
}) => {
  return (
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
            {currentUser && (
              <p className={`text-xs sm:text-sm ${
                darkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                {currentUser.email}
              </p>
            )}
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
            onClick={onToggleDarkMode}
            className={`p-2 rounded-lg transition-colors ${
              darkMode 
                ? 'bg-gray-700 text-yellow-400 hover:bg-gray-600' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {darkMode ? <Sun className="w-4 h-4 sm:w-5 sm:h-5" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>
          
          {onExport && (
            <button
              onClick={onExport}
              className={`flex items-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-2 rounded-lg transition-colors text-sm ${
                darkMode 
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Download className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Export</span>
            </button>
          )}
          
          {onLogout && (
            <button
              onClick={onLogout}
              className={`px-3 sm:px-4 py-2 rounded-lg transition-colors text-sm ${
                darkMode 
                  ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50' 
                  : 'bg-red-50 text-red-600 hover:bg-red-100'
              }`}
            >
              Logout
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Header;
