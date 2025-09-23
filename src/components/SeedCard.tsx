import React from 'react';
import { Copy, Trash2, Wallet, Eye, EyeOff } from 'lucide-react';
import { SeedPhrase } from '../types/vault';
import { clearClipboardAfterDelay } from '../utils/storage';

interface SeedCardProps {
  seed: SeedPhrase;
  onDelete: () => void;
  darkMode?: boolean;
  onCopyFeedback?: (message: string) => void;
}

const SeedCard: React.FC<SeedCardProps> = ({ seed, onDelete, darkMode = false, onCopyFeedback }) => {
  const [isVisible, setIsVisible] = React.useState(false);
  
  const handleCopy = async () => {
    clearClipboardAfterDelay(seed.seed);
    onCopyFeedback?.('Seed phrase copied! Auto-clearing in 10 seconds...');
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
    } bg-gradient-to-br ${
      darkMode ? 'from-gray-800/50 to-gray-900/50' : 'from-white/50 to-gray-50/50'
    }`}>
      <div className="flex items-start justify-between mb-3 sm:mb-4">
        <div className="flex items-center">
          <Wallet className={`w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3 ${
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
};

export default SeedCard;