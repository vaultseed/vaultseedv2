import React, { useState } from 'react';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';

interface FAQProps {
  darkMode?: boolean;
}

interface FAQItem {
  question: string;
  answer: string;
}

const FAQ: React.FC<FAQProps> = ({ darkMode = false }) => {
  const [openItems, setOpenItems] = useState<number[]>([]);

  const faqItems: FAQItem[] = [
    {
      question: "Why should I use VaultSeed?",
      answer: "VaultSeed provides enterprise-grade encryption for your crypto seed phrases with zero-knowledge architecture. Your data is encrypted before it ever leaves your device, ensuring complete privacy and security. Unlike other solutions, we use advanced encryption with AES-GCM and PBKDF2 key derivation."
    },
    {
      question: "How secure is my data?",
      answer: "Your data is encrypted using AES-GCM with 256-bit keys derived through PBKDF2 with 500,000 iterations. We implement multi-layer brute-force protection, security questions for 2FA, and automatic clipboard clearing. All encryption happens on your device before any data is transmitted."
    },
    {
      question: "What happens if I forget my master password?",
      answer: "Due to our zero-knowledge architecture, we cannot recover your master password. However, you can use your security questions to regain access to your vault. Make sure to remember your security question answers and consider exporting encrypted backups regularly."
    },
    {
      question: "Can I backup my vault?",
      answer: "Yes! You can export encrypted backups of your vault that include all your seed phrases. These backups are encrypted with a separate password and can be imported on any device running SeedVault for maximum portability."
    },
    {
      question: "Is VaultSeed open source?",
      answer: "Yes, VaultSeed is fully open source and audited. You can review our code at github.com/vaultseed-io/vaultseed.io, contribute improvements, or even run your own instance. Transparency is key to building trust in security applications."
    },
    {
      question: "What devices are supported?",
      answer: "VaultSeed works on any device with a modern web browser that supports the Web Crypto API. This includes desktop computers, laptops, tablets, and smartphones. Our responsive design ensures a seamless experience across all screen sizes."
    }
  ];

  const toggleItem = (index: number) => {
    setOpenItems(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  return (
    <div className={`backdrop-blur-sm rounded-2xl p-4 sm:p-6 md:p-8 shadow-xl border ${
      darkMode 
        ? 'bg-gray-800/80 border-gray-700/20' 
        : 'bg-white/80 border-white/20'
    }`}>
      <div className="flex items-center justify-center mb-4 sm:mb-6">
        <HelpCircle className={`w-6 h-6 sm:w-8 sm:h-8 mr-2 sm:mr-3 ${darkMode ? 'text-purple-400' : 'text-indigo-600'}`} />
        <h3 className={`text-xl sm:text-2xl font-bold ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
          Frequently Asked Questions
        </h3>
      </div>
      
      <div className="space-y-3 sm:space-y-4">
        {faqItems.map((item, index) => (
          <div 
            key={index}
            className={`border rounded-lg transition-all duration-200 ${
              darkMode 
                ? 'border-gray-700 hover:border-gray-600' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <button
              onClick={() => toggleItem(index)}
              className={`w-full px-4 sm:px-6 py-3 sm:py-4 text-left flex items-center justify-between transition-colors duration-200 ${
                darkMode 
                  ? 'hover:bg-gray-700/30 text-gray-200' 
                  : 'hover:bg-gray-50 text-gray-800'
              }`}
            >
              <span className="font-semibold pr-4 text-sm sm:text-base">{item.question}</span>
              {openItems.includes(index) ? (
                <ChevronUp className={`w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 ${
                  darkMode ? 'text-purple-400' : 'text-indigo-600'
                }`} />
              ) : (
                <ChevronDown className={`w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 ${
                  darkMode ? 'text-gray-400' : 'text-gray-500'
                }`} />
              )}
            </button>
            
            {openItems.includes(index) && (
              <div className={`px-4 sm:px-6 pb-3 sm:pb-4 border-t ${
                darkMode ? 'border-gray-700' : 'border-gray-200'
              }`}>
                <p className={`pt-3 sm:pt-4 leading-relaxed text-sm sm:text-base ${
                  darkMode ? 'text-gray-300' : 'text-gray-600'
                }`}>
                  {item.answer}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default FAQ;