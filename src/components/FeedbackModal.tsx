import React, { useState } from 'react';
import { MessageSquare, X, Star } from 'lucide-react';
import FloatingInput from './FloatingInput';
import ActionButton from './ActionButton';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode?: boolean;
  onSuccess: (message: string) => void;
}

const FeedbackModal: React.FC<FeedbackModalProps> = ({ 
  isOpen, 
  onClose, 
  darkMode = false,
  onSuccess 
}) => {
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!feedback.trim()) {
      return;
    }

    setLoading(true);

    try {
      // Simulate API call - in production, this would send to your backend
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      onSuccess('Thank you for your feedback! We appreciate your input.');
      onClose();
      setRating(0);
      setFeedback('');
      setEmail('');
    } catch (error) {
      console.error('Failed to submit feedback:', error);
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
            <MessageSquare className={`w-6 h-6 mr-3 ${darkMode ? 'text-purple-400' : 'text-indigo-600'}`} />
            <h3 className={`text-xl font-bold ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
              Send Feedback
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

        <div className="mb-6">
          <label className={`block text-sm font-medium mb-3 ${
            darkMode ? 'text-gray-300' : 'text-gray-700'
          }`}>
            How would you rate your experience?
          </label>
          <div className="flex space-x-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                className={`p-1 transition-colors ${
                  star <= rating ? 'text-yellow-400' : darkMode ? 'text-gray-600' : 'text-gray-300'
                }`}
              >
                <Star className="w-6 h-6 fill-current" />
              </button>
            ))}
          </div>
        </div>

        <FloatingInput
          id="feedback"
          label="Your Feedback"
          value={feedback}
          onChange={setFeedback}
          placeholder="Tell us what you think about VaultSeed..."
          required
          darkMode={darkMode}
        />

        <FloatingInput
          id="feedbackEmail"
          label="Email (Optional)"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="your@email.com"
          darkMode={darkMode}
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
            onClick={handleSubmit}
            loading={loading}
            disabled={!feedback.trim()}
            darkMode={darkMode}
            className="flex-1"
          >
            Send Feedback
          </ActionButton>
        </div>
      </div>
    </div>
  );
};

export default FeedbackModal;