import React from 'react';

interface ActionButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'danger' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  darkMode?: boolean;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  onClick,
  children,
  variant = 'primary',
  disabled = false,
  loading = false,
  className = '',
  darkMode = false
}) => {
  const baseClasses = 'w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200 transform disabled:opacity-50 disabled:cursor-not-allowed';
  const responsiveClasses = 'py-3 sm:py-4 px-4 sm:px-6 text-base sm:text-lg';
  
  const variants = {
    primary: darkMode 
      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 hover:scale-[1.02] shadow-lg hover:shadow-xl'
      : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 hover:scale-[1.02] shadow-lg hover:shadow-xl',
    danger: 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 hover:scale-[1.02] shadow-lg hover:shadow-xl',
    secondary: darkMode
      ? 'bg-gray-800 text-gray-200 border-2 border-gray-600 hover:border-gray-500 hover:bg-gray-700 hover:scale-[1.02]'
      : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 hover:scale-[1.02]'
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${responsiveClasses} ${variants[variant]} ${className}`}
    >
      {loading ? (
        <div className="flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
          Loading...
        </div>
      ) : (
        children
      )}
    </button>
  );
};

export default ActionButton;