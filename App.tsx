
import React, { useState, useEffect, useRef } from 'react';
import { HashRouter as Router } from 'react-router-dom';
import Navbar from './components/Navbar';
import PostCard from './components/PostCard';
import CreatePostModal from './components/CreatePostModal';
import { ICONS, MOCK_STORIES } from './constants';
import { Post, User, Comment, Story } from './types';
import { supabase } from './lib/supabase';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';

// Helper functions for Gemini Live API
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('lumina_theme');
    return (saved as 'light' | 'dark') || 'light';
  });

  const [activeTab, setActiveTab] = useState('home');
  const [posts, setPosts] = useState<Post[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [selectedChatUser, setSelectedChatUser] = useState<User | null>(null);
  const [chatMessages, setChatMessages] = useState<{sender: string, text: string, time: string}[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [conversations, setConversations] = useState<User[]>([]);
  const [suggestions, setSuggestions] = useState<User[]>([]);
  const [stories, setStories] = useState<Story[]>(MOCK_STORIES);
  const [activeStory, setActiveStory] = useState<Story | null>(null);
  const [isCreatingStory, setIsCreatingStory] = useState(false);

  // Call states
  const [isCalling, setIsCalling] = useState(false);
  const [callType, setCallType] = useState<'audio' | 'video' | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const callSessionRef = useRef<any>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('lumina_theme', theme);
    const html = document.documentElement;
    if (theme === 'dark') {
      html.classList.add('dark');
      html.classList.remove('light');
    } else {
      html.classList.add('light');
      html.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) fetchProfile(session.user.id);
      else setTimeout(() => setSessionLoading(false), 1500);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setIsLoggingIn(true);
        fetchProfile(session.user.id);
      } else {
        setCurrentUser(null);
        setSessionLoading(false);
        setIsLoggingIn(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!error && data) {
      const user: User = {
        id: data.id,
        username: data.username,
        fullName: data.full_name,
        avatar: data.avatar_url || `https://picsum.photos/seed/${data.id}/150/150`,
        coverPhoto: data.cover_photo_url || 'https://picsum.photos/seed/cover/1200/400',
        bio: data.bio || "✨ Living life one light at a time. | Storyteller | Dreamer",
        followersCount: data.followers_count || 1284,
        followingCount: data.following_count || 482
      };
      localStorage.setItem('lumina_user', JSON.stringify(user));
      setTimeout(() => {
        setCurrentUser(user);
        setSessionLoading(false);
        setIsLoggingIn(false);
      }, 1200);
    } else {
      setSessionLoading(false);
      setIsLoggingIn(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchPosts();
      fetchUsers();
      fetchConversations();
    }
  }, [currentUser]);

  const fetchPosts = async () => {
    const { data, error } = await supabase
      .from('posts')
      .select('*, profiles(*)')
      .order('created_at', { ascending: false });

    if (!error && data) {
      const mappedPosts: Post[] = await Promise.all(data.map(async (p) => {
        const { data: commentsData } = await supabase
          .from('comments')
          .select('*, profiles(username)')
          .eq('post_id', p.id)
          .order('created_at', { ascending: true });

        return {
          id: p.id,
          user: {
            id: p.profiles.id,
            username: p.profiles.username,
            fullName: p.profiles.full_name,
            avatar: p.profiles.avatar_url || `https://picsum.photos/seed/${p.profiles.id}/150/150`
          },
          imageUrl: p.image_url,
          caption: p.caption,
          likes: p.likes_count || 0,
          isLiked: false, 
          timestamp: new Date(p.created_at).toLocaleDateString(),
          comments: commentsData ? commentsData.map(c => ({
            id: c.id,
            username: c.profiles.username,
            text: c.text,
            timestamp: new Date(c.created_at).toLocaleTimeString()
          })) : []
        };
      }));
      setPosts(mappedPosts);
    }
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .neq('id', currentUser?.id)
      .limit(10);

    if (!error && data) {
      setSuggestions(data.map(u => ({
        id: u.id,
        username: u.username,
        fullName: u.full_name,
        avatar: u.avatar_url || `https://picsum.photos/seed/${u.id}/150/150`,
        coverPhoto: u.cover_photo_url || 'https://picsum.photos/seed/cover/1200/400',
        bio: u.bio || "Sharing my perspective with the world.",
        followersCount: u.followers_count || Math.floor(Math.random() * 5000),
        followingCount: u.following_count || Math.floor(Math.random() * 1000)
      })));
    }
  };

  const fetchConversations = async () => {
    if (!currentUser) return;
    const { data, error } = await supabase
      .from('messages')
      .select('sender_id, receiver_id')
      .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`);

    if (!error && data) {
      const userIds = new Set<string>();
      data.forEach(m => {
        if (m.sender_id !== currentUser.id) userIds.add(m.sender_id);
        if (m.receiver_id !== currentUser.id) userIds.add(m.receiver_id);
      });

      if (userIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('*')
          .in('id', Array.from(userIds));
        
        if (profiles) {
          setConversations(profiles.map(p => ({
            id: p.id,
            username: p.username,
            fullName: p.full_name,
            avatar: p.avatar_url || `https://picsum.photos/seed/${p.id}/150/150`
          })));
        }
      }
    }
  };

  const fetchMessages = async (otherUserId: string) => {
    if (!currentUser) return;
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUser.id})`)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setChatMessages(data.map(m => ({
        sender: m.sender_id,
        text: m.text,
        time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      })));
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChatUser || !messageInput.trim() || !currentUser) return;
    const text = messageInput.trim();
    setMessageInput('');
    setChatMessages(prev => [...prev, {
      sender: currentUser.id,
      text: text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    const { error } = await supabase.from('messages').insert({
      sender_id: currentUser.id,
      receiver_id: selectedChatUser.id,
      text: text
    });
    if (error) setToast({ message: 'Failed to send message', type: 'error' });
    else if (!conversations.find(c => c.id === selectedChatUser.id)) fetchConversations();
  };

  const startCall = async (type: 'audio' | 'video') => {
    if (!selectedChatUser) return;
    setIsCalling(true);
    setCallType(type);
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    const outputAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    audioContextRef.current = outputAudioCtx;
    const outputNode = outputAudioCtx.createGain();
    outputNode.connect(outputAudioCtx.destination);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: type === 'video' 
      });
      
      if (localVideoRef.current && type === 'video') {
        localVideoRef.current.srcObject = stream;
      }

      const inputAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            const source = inputAudioCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              if (isMuted) return;
              const inputData = e.inputBuffer.getChannelData(0);
              const l = inputData.length;
              const int16 = new Int16Array(l);
              for (let i = 0; i < l; i++) int16[i] = inputData[i] * 32768;
              const pcmBlob = {
                data: encode(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };
              sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioCtx.destination);

            if (type === 'video') {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              const video = localVideoRef.current;
              const interval = setInterval(() => {
                if (video && ctx) {
                  canvas.width = video.videoWidth / 4;
                  canvas.height = video.videoHeight / 4;
                  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                  canvas.toBlob(blob => {
                    if (blob) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        const base64 = (reader.result as string).split(',')[1];
                        sessionPromise.then(s => s.sendRealtimeInput({ media: { data: base64, mimeType: 'image/jpeg' } }));
                      };
                      reader.readAsDataURL(blob);
                    }
                  }, 'image/jpeg', 0.5);
                }
              }, 1000);
              (window as any)._videoInterval = interval;
            }
          },
          onmessage: async (msg: LiveServerMessage) => {
            const base64Audio = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioCtx.currentTime);
              const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioCtx, 24000, 1);
              const source = outputAudioCtx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputNode);
              source.addEventListener('ended', () => sourcesRef.current.delete(source));
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
            }
            if (msg.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onclose: () => endCall(),
          onerror: () => endCall(),
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
          systemInstruction: `You are ${selectedChatUser.username}, a friendly person on Lumina. You are currently in a ${type} call. Be natural, casual, and engage in high-quality conversation. Use the visual input if provided to react to the user's surroundings or appearance.`
        }
      });
      callSessionRef.current = sessionPromise;
    } catch (err) {
      console.error(err);
      setIsCalling(false);
      setToast({ message: "Camera/Mic permission denied", type: "error" });
    }
  };

  const endCall = () => {
    if (callSessionRef.current) {
      callSessionRef.current.then((s: any) => s.close());
    }
    if ((window as any)._videoInterval) clearInterval((window as any)._videoInterval);
    setIsCalling(false);
    setCallType(null);
    nextStartTimeRef.current = 0;
    sourcesRef.current.forEach(s => s.stop());
    sourcesRef.current.clear();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && currentUser) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const { error } = await supabase.from('profiles').update({ avatar_url: base64 }).eq('id', currentUser.id);
        if (!error) {
          setCurrentUser(prev => {
            if (!prev) return null;
            const updated = { ...prev, avatar: base64 };
            localStorage.setItem('lumina_user', JSON.stringify(updated));
            return updated;
          });
          setViewingUser(prev => {
            if (prev && prev.id === currentUser.id) return { ...prev, avatar: base64 };
            return prev;
          });
          setToast({ message: 'Profile photo updated!', type: 'success' });
        }
      };
      reader.readAsDataURL(file);
      e.target.value = ''; 
    }
  };

  const handleTabChange = (tab: string) => {
    if (tab === 'create') setShowCreateModal(true);
    else {
      setActiveTab(tab);
      if (tab === 'profile') setViewingUser(currentUser);
      else setViewingUser(null);
      if (tab === 'chat') {
        setSelectedChatUser(null);
        fetchConversations();
      }
    }
  };

  const isChatTab = activeTab === 'chat';

  if (sessionLoading || isLoggingIn) {
    return (
      <div className="fixed inset-0 bg-white dark:bg-slate-950 flex flex-col items-center justify-center z-[200]">
        <div className="text-center space-y-4">
          <h1 className="brand-font text-7xl font-bold brand-text-gradient animate-pulse-soft">Lumina</h1>
          <div className="flex justify-center">
            <div className="w-16 h-1 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
               <div className="h-full bg-brand-gradient w-full animate-[progress_1.5s_infinite_linear]"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!currentUser) return null;

  return (
    <Router>
      <div className="h-full flex flex-col bg-white dark:bg-slate-950 overflow-hidden text-gray-900 dark:text-gray-100 transition-colors duration-300">
        <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} />
        
        {toast && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[500] w-[90%] max-sm animate-slide-down">
            <div className={`px-4 py-3 rounded-2xl shadow-2xl flex items-center justify-center space-x-3 ${toast.type === 'success' ? 'bg-[#006a4e] text-white' : 'bg-[#f42a41] text-white'}`}>
              <span className="font-bold text-sm text-center">{toast.message}</span>
            </div>
          </div>
        )}

        {/* Call Overlay UI */}
        {isCalling && selectedChatUser && (
          <div className="fixed inset-0 z-[600] bg-slate-950 flex flex-col items-center justify-center p-6 animate-in fade-in duration-500">
            <div className="absolute top-12 text-center space-y-2">
               <div className="relative mx-auto">
                 <div className="absolute inset-0 bg-[#f42a41]/20 rounded-full blur-2xl animate-pulse"></div>
                 <img src={selectedChatUser.avatar} className="w-24 h-24 rounded-full border-4 border-[#006a4e]/50 object-cover relative z-10" />
               </div>
               <h2 className="text-white text-2xl font-bold pt-4">{selectedChatUser.username}</h2>
               <p className="text-[#f42a41] font-bold uppercase tracking-widest text-[10px]">Lumina HD {callType === 'video' ? 'Video' : 'Voice'} Call</p>
            </div>

            {callType === 'video' && (
              <div className="w-full max-w-sm aspect-[9/16] bg-slate-900 rounded-[2.5rem] overflow-hidden relative shadow-2xl border border-white/5">
                <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
              </div>
            )}

            <div className="absolute bottom-16 flex items-center space-x-8">
              <button 
                onClick={() => setIsMuted(!isMuted)}
                className={`p-5 rounded-full backdrop-blur-md transition-all ${isMuted ? 'bg-white text-slate-950' : 'bg-white/10 text-white hover:bg-white/20'}`}
              >
                {isMuted ? <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.17l5.98 6zm3.97 7.11L3.27 3 2 4.27l7.03 7.03L9 11.5C9 13.16 10.34 14.5 12 14.5c.34 0 .67-.06.97-.16l1.29 1.29c-.7.45-1.52.75-2.42.84V20h-3v2h8v-2h-3v-2.87c.38-.04.74-.12 1.1-.24l4.28 4.28 1.27-1.27z"/></svg> : <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>}
              </button>
              
              <button 
                onClick={endCall}
                className="p-8 bg-[#f42a41] text-white rounded-full shadow-2xl shadow-[#f42a41]/40 hover:bg-[#d12437] active:scale-90 transition-all"
              >
                <svg className="w-8 h-8 rotate-[135deg]" fill="currentColor" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              </button>

              <button 
                onClick={() => setIsVideoOff(!isVideoOff)}
                className={`p-5 rounded-full backdrop-blur-md transition-all ${isVideoOff ? 'bg-white text-slate-950' : 'bg-white/10 text-white hover:bg-white/20'}`}
              >
                {isVideoOff ? <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z"/></svg> : <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>}
              </button>
            </div>
          </div>
        )}

        <main className={`flex-1 overflow-y-auto scroll-smooth no-scrollbar ${!isChatTab ? 'pb-[calc(70px+env(safe-area-inset-bottom))]' : ''}`}>
          <div className={`max-w-lg mx-auto ${!isChatTab ? 'md:max-w-4xl md:grid md:grid-cols-3 md:gap-8' : 'h-full'} p-0`}>
            <section className={!isChatTab ? 'md:col-span-2' : 'h-full'}>
              {activeTab === 'home' && (
                <div className="pt-2">
                  <div className="flex space-x-4 px-4 py-4 overflow-x-auto border-b border-gray-100 dark:border-slate-900 no-scrollbar bg-white dark:bg-slate-950">
                    <div className="flex flex-col items-center space-y-1 min-w-[75px]">
                      <div className="relative w-[68px] h-[68px]">
                        <img src={currentUser?.avatar} className="w-full h-full rounded-full object-cover border-2 border-white dark:border-slate-900 p-0.5" />
                        <div className="absolute bottom-0 right-0 bg-[#006a4e] text-white p-1 rounded-full border-2 border-white dark:border-slate-900 shadow-sm">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4"></path></svg>
                        </div>
                      </div>
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold truncate">You</span>
                    </div>
                    {stories.map(story => (
                      <div key={story.id} onClick={() => setActiveStory(story)} className="flex flex-col items-center space-y-1 min-w-[75px] cursor-pointer active:scale-95 transition-transform">
                        <div className={`w-[68px] h-[68px] rounded-full flex items-center justify-center story-ring shadow-lg shadow-[#006a4e]/20 dark:shadow-[#f42a41]/10`}>
                          <img src={story.user.avatar} className="w-[62px] h-[62px] rounded-full object-cover border-2 border-white dark:border-slate-900 bg-white dark:bg-slate-800" />
                        </div>
                        <span className="text-[10px] text-gray-700 dark:text-gray-300 font-bold truncate w-[70px] text-center">{story.user.username}</span>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-6 md:p-6">
                    {posts.map(post => (
                      <PostCard key={post.id} post={post} onLike={() => {}} onComment={() => {}} onUserClick={(u) => { setViewingUser(u); setActiveTab('profile'); }} />
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'chat' && (
                <div className="bg-white dark:bg-slate-950 h-full flex flex-col overflow-hidden transition-colors duration-300">
                  {!selectedChatUser ? (
                    <>
                      <div className="p-6 border-b dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-950 sticky top-0 z-10">
                        <div className="flex items-center space-x-4">
                          <button onClick={() => setActiveTab('home')} className="p-2 -ml-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors"><ICONS.ChevronLeft className="w-6 h-6" /></button>
                          <h2 className="font-bold text-2xl brand-text-gradient">Messages</h2>
                        </div>
                        <button onClick={() => setShowSearchModal(true)} className="p-3 bg-[#006a4e]/10 dark:bg-[#f42a41]/10 rounded-2xl text-[#006a4e] dark:text-[#f42a41]"><ICONS.Create className="w-6 h-6" /></button>
                      </div>
                      <div className="flex-1 overflow-y-auto no-scrollbar">
                        {conversations.map(user => (
                          <div key={user.id} onClick={() => setSelectedChatUser(user)} className="flex items-center p-5 hover:bg-gray-50 dark:hover:bg-slate-900 cursor-pointer space-x-4 border-b border-gray-50 dark:border-slate-900 transition-colors">
                              <img src={user.avatar} className="w-14 h-14 rounded-full object-cover shadow-sm" />
                              <div className="flex-1">
                                  <p className="font-bold text-gray-900 dark:text-gray-200">{user.username}</p>
                                  <p className="text-gray-400 dark:text-gray-500 text-xs truncate font-medium">Active now</p>
                              </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col h-full bg-white dark:bg-slate-950 animate-in slide-in-from-right duration-300">
                      <div className="p-4 border-b dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-950 sticky top-0 z-10 pt-[calc(1rem+env(safe-area-inset-top))]">
                        <div className="flex items-center">
                          <button onClick={() => setSelectedChatUser(null)} className="p-2 mr-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors"><ICONS.ChevronLeft className="w-6 h-6" /></button>
                          <img src={selectedChatUser.avatar} className="w-10 h-10 rounded-full object-cover shadow-sm" />
                          <div className="ml-3">
                            <span className="font-bold text-gray-900 dark:text-gray-100 block leading-tight">{selectedChatUser.username}</span>
                            <span className="text-[10px] text-[#006a4e] dark:text-[#f42a41] font-bold uppercase tracking-widest">Online</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                           <button onClick={() => startCall('audio')} className="p-2 text-gray-600 dark:text-gray-400 hover:text-[#f42a41] transition-colors"><ICONS.Phone className="w-6 h-6" /></button>
                           <button onClick={() => startCall('video')} className="p-2 text-gray-600 dark:text-gray-400 hover:text-[#f42a41] transition-colors"><ICONS.VideoCall className="w-6 h-6" /></button>
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
                          {chatMessages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.sender === currentUser.id ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] px-5 py-3 rounded-2xl text-sm shadow-sm ${msg.sender === currentUser.id ? 'bg-[#006a4e] text-white rounded-tr-none' : 'bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200 rounded-tl-none border border-gray-100 dark:border-slate-700'}`}>
                                  {msg.text}
                                  <p className={`text-[9px] mt-2 font-bold ${msg.sender === currentUser.id ? 'text-white/60' : 'text-gray-400 dark:text-gray-500'}`}>{msg.time}</p>
                                </div>
                            </div>
                          ))}
                          <div ref={chatEndRef} />
                      </div>
                      <form onSubmit={handleSendMessage} className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t dark:border-slate-800 flex space-x-3 bg-white dark:bg-slate-950">
                          <input type="text" placeholder="Start typing..." className="flex-1 bg-gray-100 dark:bg-slate-800 dark:text-white rounded-full px-5 py-3 text-sm outline-none focus:ring-2 focus:ring-[#006a4e]" value={messageInput} onChange={(e) => setMessageInput(e.target.value)} />
                          <button type="submit" className="bg-brand-gradient text-white p-3 rounded-full shadow-lg active:scale-95 transition-transform">
                            <ICONS.Share className="w-5 h-5 -rotate-45" />
                          </button>
                      </form>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        </main>

        {!isChatTab && (
          <Navbar onTabChange={handleTabChange} activeTab={activeTab} />
        )}
      </div>
    </Router>
  );
};

export default App;
