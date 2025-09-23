import React, { useEffect } from 'react';
import { CheckCircle, AlertCircle, Info } from 'lucide-react';

interface TooltipProps {
  show: boolean;
  message: string;
  type: 'success' | 'error' | 'info';
  onHide: () => void;
  darkMode?: boolean;
}

const Tooltip: React.FC<TooltipProps> = ({ show, message, type, onHide, darkMode = false }) => {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        onHide();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [show, onHide]);

  if (!show) return null;

  const icons = {
    success: <CheckCircle className="w-5 h-5" />,
    error: <AlertCircle className="w-5 h-5" />,
    info: <Info className="w-5 h-5" />
  };

  const colors = {
    success: darkMode 
      ? 'bg-green-900/90 text-green-200 border-green-700' 
      : 'bg-green-100 text-green-800 border-green-300',
    error: darkMode 
      ? 'bg-red-900/90 text-red-200 border-red-700' 
      : 'bg-red-100 text-red-800 border-red-300',
    info: darkMode 
      ? 'bg-blue-900/90 text-blue-200 border-blue-700' 
      : 'bg-blue-100 text-blue-800 border-blue-300'
  };

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right duration-300 max-w-sm">
      <div className={`flex items-center space-x-3 px-3 sm:px-4 py-2 sm:py-3 rounded-lg border backdrop-blur-sm shadow-lg ${colors[type]}`}>
        {icons[type]}
        <span className="font-medium text-sm sm:text-base">{message}</span>
        <button
          onClick={onHide}
          className="ml-2 opacity-70 hover:opacity-100 transition-opacity text-lg"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default Tooltip;