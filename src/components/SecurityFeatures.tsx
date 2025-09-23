import React from 'react';
import { Shield, Lock, Eye, Key, Clock, Clipboard, Code, Server, Zap } from 'lucide-react';

interface SecurityFeaturesProps {
  darkMode?: boolean;
}

const SecurityFeatures: React.FC<SecurityFeaturesProps> = ({ darkMode = false }) => {
  const features = [
    {
      icon: <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500" />,
      title: "AES-GCM Encryption",
      text: "Military-grade encryption with 256-bit keys"
    },
    {
      icon: <Key className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500" />,
      title: "Advanced Key Derivation",
      text: "PBKDF2 with 500,000 iterations for maximum security"
    },
    {
      icon: <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500" />,
      title: "Multi-Factor Authentication",
      text: "Encrypted security questions for additional protection"
    },
    {
      icon: <Eye className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500" />,
      title: "Zero-Knowledge Architecture",
      text: "Your data is encrypted before it ever leaves your device"
    },
    {
      icon: <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500" />,
      title: "Brute-Force Protection",
      text: "Advanced rate limiting with exponential backoff"
    },
    {
      icon: <Clipboard className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500" />,
      title: "Secure Clipboard",
      text: "Automatic clipboard clearing for privacy"
    },
    {
      icon: <Code className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500" />,
      title: "Open Source & Audited",
      text: "Transparent code reviewed by security experts"
    },
    {
      icon: <Server className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500" />,
      title: "Enterprise Ready",
      text: "Scalable infrastructure with 99.9% uptime"
    },
    {
      icon: <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500" />,
      title: "Lightning Fast",
      text: "Optimized performance with instant access"
    }
  ];

  return (
    <div className={`backdrop-blur-sm rounded-2xl p-4 sm:p-6 md:p-8 shadow-xl border ${
      darkMode 
        ? 'bg-gray-800/80 border-gray-700/20' 
        : 'bg-white/80 border-white/20'
    }`}>
      <div className="flex items-center justify-center mb-4 sm:mb-6">
        <Shield className={`w-6 h-6 sm:w-8 sm:h-8 mr-2 sm:mr-3 ${darkMode ? 'text-purple-400' : 'text-indigo-600'}`} />
        <h3 className={`text-xl sm:text-2xl font-bold ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
          Enterprise Security Features
        </h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {features.map((feature, index) => (
          <div 
            key={index}
            className={`flex items-start space-x-3 p-3 sm:p-4 rounded-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-lg border ${
              darkMode 
                ? 'hover:bg-gray-700/50 border-gray-700/30 hover:border-purple-500/30' 
                : 'hover:bg-white/70 border-gray-200/30 hover:border-indigo-300/50'
            }`}
          >
            <div className="flex-shrink-0 mt-0.5">
              {feature.icon}
            </div>
            <div>
              <h4 className={`font-semibold text-sm sm:text-base ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                {feature.title}
              </h4>
              <p className={`text-xs sm:text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {feature.text}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SecurityFeatures;