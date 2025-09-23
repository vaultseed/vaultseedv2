import React, { useState, useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { getPasswordStrength } from '../utils/crypto';

interface FloatingInputProps {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  isPassword?: boolean;
  error?: string;
  hint?: string;
  darkMode?: boolean;
  showPasswordStrength?: boolean;
}

const FloatingInput: React.FC<FloatingInputProps> = ({
  id,
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  required = false,
  isPassword = false,
  error,
  hint,
  darkMode = false,
  showPasswordStrength = false
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [inputType, setInputType] = useState(type);

  useEffect(() => {
    if (isPassword) {
      setInputType(showPassword ? 'text' : 'password');
    }
  }, [isPassword, showPassword]);

  const passwordStrength = showPasswordStrength && value ? getPasswordStrength(value) : null;
  const hasValue = value.length > 0;
  const isFloating = isFocused || hasValue;

  return (
    <div className="relative mb-6">
      <div className="relative">
        <input
          id={id}
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={isFocused ? placeholder : ''}
          required={required}
          className={`w-full px-3 sm:px-4 pt-5 sm:pt-6 pb-2 border-2 rounded-xl transition-all duration-200 outline-none peer text-sm sm:text-base ${
            darkMode
              ? 'text-white bg-gray-800 border-gray-600 focus:border-purple-500'
              : 'text-gray-900 bg-white border-gray-200 focus:border-indigo-500'
          } ${
            error 
              ? darkMode ? 'border-red-500 focus:border-red-400' : 'border-red-400 focus:border-red-500'
              : ''
          } ${isPassword ? 'pr-12' : ''}`}
        />
        <label
          htmlFor={id}
          className={`absolute left-3 sm:left-4 pointer-events-none transition-all duration-200 ${
            darkMode ? 'text-gray-400' : 'text-gray-500'
          } ${
            isFloating
              ? 'top-1.5 sm:top-2 text-xs font-medium'
              : 'top-3 sm:top-4 text-sm sm:text-base'
          } ${
            isFocused && !error 
              ? darkMode ? 'text-purple-400' : 'text-indigo-600' 
              : ''
          } ${error ? 'text-red-500' : ''}`}
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className={`absolute right-2 sm:right-3 top-1/2 transform -translate-y-1/2 transition-colors ${
              darkMode 
                ? 'text-gray-400 hover:text-gray-200' 
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {showPassword ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>
        )}
      </div>
      
      {passwordStrength && (
        <div className="mt-2">
          <div className="flex items-center justify-between mb-1">
            <span className={`text-xs sm:text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              Password Strength: {passwordStrength.feedback}
            </span>
          </div>
          <div className={`w-full h-2 rounded-full ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
            <div 
              className={`h-full rounded-full transition-all duration-300 ${passwordStrength.color}`}
              style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
            />
          </div>
        </div>
      )}
      
      {error && (
        <p className="text-red-500 text-xs sm:text-sm mt-2 flex items-center">
          <span className="w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center mr-2">!</span>
          {error}
        </p>
      )}
      
      {hint && !error && (
        <p className={`text-xs sm:text-sm mt-2 ${
          darkMode ? 'text-gray-400' : 'text-gray-500'
        }`}>
          {hint}
        </p>
      )}
    </div>
  );
};

export default FloatingInput;