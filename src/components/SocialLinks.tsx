import React from 'react';
import { MessageSquare } from 'lucide-react';

interface SocialLinksProps {
  darkMode?: boolean;
  onFeedbackClick?: () => void;
}

const SocialLinks: React.FC<SocialLinksProps> = ({ darkMode = false, onFeedbackClick }) => {
  return (
    <footer className="mt-8 sm:mt-12 md:mt-16 pb-6 sm:pb-8">
      <div className="text-center">
        <p className={`mb-4 sm:mb-6 text-sm sm:text-base ${
          darkMode ? 'text-gray-400' : 'text-gray-600'
        }`}>
          Help us improve VaultSeed with your feedback
        </p>
        <div className="flex justify-center">
          <button
            onClick={onFeedbackClick}
            className={`flex items-center space-x-2 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-md hover:shadow-lg text-sm sm:text-base ${
              darkMode 
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700' 
                : 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700'
            }`}
          >
            <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="font-medium">Send Feedback</span>
          </button>
        </div>
      </div>
    </footer>
  );
};

export default SocialLinks;