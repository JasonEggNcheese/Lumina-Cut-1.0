import React, { useState } from 'react';
import { generateCreativeIdeas, generateScript } from '../services/geminiService';
import { Sparkles, MessageSquare, ListVideo, Loader2, X } from 'lucide-react';
import { Button } from './Button';

interface AIAssistantProps {
  onClose: () => void;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({ onClose }) => {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'ideas' | 'script'>('ideas');

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsLoading(true);
    setResponse('');
    
    try {
      let result = '';
      if (mode === 'ideas') {
        result = await generateCreativeIdeas(prompt);
      } else {
        result = await generateScript(prompt);
      }
      setResponse(result);
    } catch (e) {
      setResponse("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 border-l border-gray-800 w-full md:w-80 shadow-2xl absolute right-0 top-0 z-50">
      <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-850">
        <div className="flex items-center gap-2 text-violet-400">
          <Sparkles size={18} />
          <h2 className="font-semibold text-white">Lumina AI</h2>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <X size={18} />
        </button>
      </div>

      <div className="p-4 flex gap-2">
        <Button 
          variant={mode === 'ideas' ? 'primary' : 'secondary'} 
          size="sm"
          onClick={() => setMode('ideas')}
          className="flex-1"
        >
          <MessageSquare size={14} className="mr-1" /> Ideas
        </Button>
        <Button 
          variant={mode === 'script' ? 'primary' : 'secondary'} 
          size="sm"
          onClick={() => setMode('script')}
          className="flex-1"
        >
          <ListVideo size={14} className="mr-1" /> Script
        </Button>
      </div>

      <div className="p-4 flex-1 overflow-y-auto custom-scrollbar pb-20 md:pb-4">
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-400 mb-1">
            {mode === 'ideas' ? 'Describe your vibe or song...' : 'Describe the video concept...'}
          </label>
          <textarea
            className="w-full bg-gray-800 text-sm text-gray-200 p-3 rounded-md border border-gray-700 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none resize-none h-24"
            placeholder={mode === 'ideas' ? "e.g., A moody cyberpunk city at night with neon rain" : "e.g., A dancer moving through different eras of history"}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>

        <Button 
          onClick={handleGenerate} 
          disabled={isLoading || !prompt.trim()} 
          className="w-full mb-6"
        >
          {isLoading ? <Loader2 className="animate-spin mr-2" size={16} /> : <Sparkles className="mr-2" size={16} />}
          {isLoading ? 'Thinking...' : 'Generate'}
        </Button>

        {response && (
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Result</h3>
            <div className="prose prose-invert prose-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
              {response}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};