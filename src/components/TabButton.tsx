import React from 'react';

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  darkMode?: boolean;
}

const TabButton: React.FC<TabButtonProps> = ({ active, onClick, children, darkMode = false }) => {
  return (
    <div className="relative">
      <button
        onClick={onClick}
        className={`px-4 sm:px-6 md:px-8 py-2 sm:py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 relative text-sm sm:text-base ${
          active
            ? darkMode
              ? 'bg-gray-800 text-purple-400 shadow-lg border-2 border-purple-500/30'
              : 'bg-white text-indigo-600 shadow-lg border-2 border-indigo-100'
            : darkMode
              ? 'bg-gray-800/60 text-gray-300 hover:bg-gray-800/80 border-2 border-transparent'
              : 'bg-white/60 text-gray-600 hover:bg-white/80 border-2 border-transparent'
        }`}
      >
        {children}
      </button>
      {active && (
        <div className={`absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-12 h-0.5 rounded-full transition-all duration-300 ${
          darkMode ? 'bg-purple-400' : 'bg-indigo-600'
        }`} />
      )}
    </div>
  );
};

export default TabButton;