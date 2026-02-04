
import React, { useState, useRef } from 'react';
import { generateCaption, generateMagicImage } from '../services/geminiService';
import { ICONS } from '../constants';

interface CreatePostModalProps {
  onClose: () => void;
  onPost: (imageUrl: string, caption: string) => void;
}

const CreatePostModal: React.FC<CreatePostModalProps> = ({ onClose, onPost }) => {
  const [step, setStep] = useState(1);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [magicPrompt, setMagicPrompt] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
        setStep(2);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMagicGenerate = async () => {
    if (!magicPrompt) return;
    setIsGenerating(true);
    const result = await generateMagicImage(magicPrompt);
    if (result) {
      setSelectedImage(result);
      setStep(2);
    }
    setIsGenerating(false);
  };

  const handleSuggestCaption = async () => {
    setIsGenerating(true);
    const suggested = await generateCaption(selectedImage || '', caption);
    setCaption(suggested);
    setIsGenerating(false);
  };

  const handleSubmit = () => {
    if (selectedImage) {
      onPost(selectedImage, caption);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] overflow-hidden animate-in fade-in zoom-in duration-300 shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-50 dark:border-slate-800">
          <button onClick={onClose} className="text-sm font-bold text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 px-2">Cancel</button>
          <h2 className="font-bold text-gray-900 dark:text-gray-100 tracking-tight">Create Post</h2>
          {step === 2 ? (
            <button onClick={handleSubmit} className="text-sm font-bold text-[#006a4e] dark:text-[#f42a41] px-2 hover:brightness-110">Share</button>
          ) : (
            <div className="w-12"></div>
          )}
        </div>

        <div className="p-7">
          {step === 1 ? (
            <div className="space-y-7 flex flex-col items-center">
              <div className="w-24 h-24 bg-[#006a4e]/10 dark:bg-[#f42a41]/10 rounded-3xl flex items-center justify-center text-[#006a4e] dark:text-[#f42a41] shadow-inner rotate-3">
                <ICONS.Create className="w-12 h-12" />
              </div>
              
              <div className="grid grid-cols-1 gap-5 w-full">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-5 px-4 bg-[#006a4e] text-white rounded-[1.5rem] font-bold hover:brightness-110 shadow-lg shadow-[#006a4e]/20 transition-all active:scale-95"
                >
                  Upload from Device
                </button>
                <div className="relative py-8">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100 dark:border-slate-800"></div></div>
                  <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-[0.2em]"><span className="bg-white dark:bg-slate-900 px-4 text-gray-400 dark:text-gray-500">Lumina AI Creator</span></div>
                </div>
                
                <div className="space-y-4">
                  <textarea
                    placeholder="Describe your vision (e.g., 'A beautiful green landscape with a red sun')..."
                    className="w-full p-5 bg-gray-50 dark:bg-slate-800 dark:text-white border border-gray-100 dark:border-slate-700 rounded-[1.5rem] text-sm h-28 focus:ring-2 focus:ring-[#f42a41] focus:outline-none transition-all placeholder:text-gray-300 dark:placeholder:text-gray-600 font-medium"
                    value={magicPrompt}
                    onChange={(e) => setMagicPrompt(e.target.value)}
                  />
                  <button 
                    onClick={handleMagicGenerate}
                    disabled={isGenerating || !magicPrompt}
                    className="w-full py-5 px-4 bg-brand-gradient text-white rounded-[1.5rem] font-bold flex items-center justify-center space-x-2 disabled:opacity-50 shadow-xl shadow-[#f42a41]/20 hover:brightness-110 active:scale-95 transition-all"
                  >
                    <ICONS.Magic className="w-5 h-5" />
                    <span>{isGenerating ? 'Synthesizing...' : 'Generate Art'}</span>
                  </button>
                </div>
              </div>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
            </div>
          ) : (
            <div className="space-y-5">
              <div className="aspect-square bg-gray-50 dark:bg-slate-950 rounded-[1.5rem] overflow-hidden border border-gray-100 dark:border-slate-800 shadow-sm relative group">
                <img src={selectedImage!} className="w-full h-full object-cover" />
                <button onClick={() => setStep(1)} className="absolute top-4 right-4 bg-black/60 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">Storytelling</label>
                  <button 
                    onClick={handleSuggestCaption}
                    disabled={isGenerating}
                    className="text-xs font-bold text-[#006a4e] dark:text-[#f42a41] flex items-center space-x-1.5 hover:brightness-90 transition-all disabled:opacity-50"
                  >
                    <ICONS.Magic className="w-4 h-4" />
                    <span>AI Caption</span>
                  </button>
                </div>
                <textarea
                  placeholder="Tell the story behind this light..."
                  className="w-full p-5 bg-gray-50 dark:bg-slate-800 dark:text-white border border-gray-100 dark:border-slate-700 rounded-[1.5rem] text-sm h-36 focus:ring-2 focus:ring-[#006a4e] focus:outline-none transition-all placeholder:text-gray-300 dark:placeholder:text-gray-600 font-medium leading-relaxed"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreatePostModal;
