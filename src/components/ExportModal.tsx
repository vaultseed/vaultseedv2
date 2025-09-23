import React, { useState } from 'react';
import { Download, X, Lock } from 'lucide-react';
import { exportVault } from '../utils/crypto';
import { VaultData } from '../types/vault';
import FloatingInput from './FloatingInput';
import ActionButton from './ActionButton';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  vaultData: VaultData;
  darkMode?: boolean;
  onSuccess: (message: string) => void;
}

const ExportModal: React.FC<ExportModalProps> = ({ 
  isOpen, 
  onClose, 
  vaultData, 
  darkMode = false,
  onSuccess 
}) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleExport = async () => {
    if (!password || !confirmPassword) {
      setError('Please enter and confirm your export password');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Export password must be at least 8 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const exportData = await exportVault(vaultData, password);
      
      // Create and download file
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `seedvault-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      onSuccess('Vault exported successfully! Keep your backup file safe.');
      onClose();
      setPassword('');
      setConfirmPassword('');
    } catch (error) {
      setError('Failed to export vault. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`w-full max-w-md rounded-2xl p-6 shadow-2xl ${
        darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
      }`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Download className={`w-6 h-6 mr-3 ${darkMode ? 'text-purple-400' : 'text-indigo-600'}`} />
            <h3 className={`text-xl font-bold ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
              Export Vault
            </h3>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              darkMode 
                ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className={`mb-6 p-4 rounded-lg border ${
          darkMode 
            ? 'bg-yellow-900/20 border-yellow-700/30 text-yellow-200' 
            : 'bg-yellow-50 border-yellow-200 text-yellow-800'
        }`}>
          <div className="flex items-start">
            <Lock className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium mb-1">Security Notice</p>
              <p>Your backup will be encrypted with a separate password. Store this password securely - it cannot be recovered.</p>
            </div>
          </div>
        </div>

        <FloatingInput
          id="exportPassword"
          label="Export Password"
          value={password}
          onChange={(value) => {
            setPassword(value);
            setError('');
          }}
          placeholder="Enter a strong password for your backup"
          isPassword
          required
          darkMode={darkMode}
        />

        <FloatingInput
          id="confirmExportPassword"
          label="Confirm Export Password"
          value={confirmPassword}
          onChange={(value) => {
            setConfirmPassword(value);
            setError('');
          }}
          placeholder="Confirm your export password"
          isPassword
          required
          darkMode={darkMode}
          error={error}
        />

        <div className="flex space-x-3">
          <ActionButton
            onClick={onClose}
            variant="secondary"
            darkMode={darkMode}
            className="flex-1"
          >
            Cancel
          </ActionButton>
          <ActionButton
            onClick={handleExport}
            loading={loading}
            disabled={!password || !confirmPassword}
            darkMode={darkMode}
            className="flex-1"
          >
            Export
          </ActionButton>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;