'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, X, Sparkles, Loader2, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface TutorChatProps {
    videoId: string;
    videoTitle: string;
    isOpen: boolean;
    onClose: () => void;
    language?: string;
}

export default function TutorChat({ videoId, videoTitle, isOpen, onClose, language = 'English' }: TutorChatProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Reset chat when video changes
    useEffect(() => {
        if (isOpen && videoId) {
            setMessages([
                {
                    role: 'assistant',
                    content: `👋 Hi! I'm your **AI Tutor** for this video.\n\n📺 **"${videoTitle}"**\n\nI've loaded the transcript and I'm ready to help! You can:\n- Ask me to **explain** any concept from the video\n- Request a **summary** of the key points\n- Ask me to **quiz you** on the material\n\nWhat would you like to know?`
                }
            ]);
            setSessionId(null);
            setInput('');

            // Focus input after animation
            setTimeout(() => inputRef.current?.focus(), 400);
        }
    }, [videoId, isOpen]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setIsLoading(true);

        try {
            const response = await api.tutorChat(videoId, videoTitle, userMsg, sessionId || undefined, language);

            setSessionId(response.session_id);
            setMessages(prev => [...prev, { role: 'assistant', content: response.reply }]);
        } catch (error) {
            console.error('Tutor chat error:', error);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: "I'm sorry, I encountered an error. Please try again."
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleQuickAction = (action: string) => {
        setInput(action);
        setTimeout(() => handleSend(), 50);
    };

    return (
        <div className="flex flex-col h-full bg-[#0a0a0a] text-white">
            {/* Header - Already handled by parent in roadmap/page.tsx for theater mode, 
                but keeping a compact one for standalone use if needed */}
            <div className="px-6 py-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Neural Analysis Active</span>
                </div>
                <div className="flex items-center gap-2">
                    <Sparkles size={12} className="text-green-500" />
                    <span className="text-[9px] font-black text-white/20 uppercase tracking-widest leading-none">RAG-v2 Engine</span>
                </div>
            </div>

            {/* Quick Actions - Glassy Pills */}
            <div className="px-6 py-4 border-b border-white/5 flex gap-2 overflow-x-auto no-scrollbar bg-black/20">
                {[
                    { label: 'Summary', icon: '📝', action: 'Give me a executive summary of this video.' },
                    { label: 'Quiz Me', icon: '🧠', action: 'I\'m ready for a quick 3-question challenge on this topic.' },
                    { label: 'Key Points', icon: '💡', action: 'Identify the most critical concepts for my career track.' },
                ].map((qa, i) => (
                    <button
                        key={i}
                        onClick={() => handleQuickAction(qa.action)}
                        disabled={isLoading}
                        className="px-3 py-1.5 bg-white/5 hover:bg-green-600/20 text-white/70 hover:text-green-400 text-[9px] font-black uppercase tracking-widest rounded-xl border border-white/5 hover:border-green-500/30 whitespace-nowrap transition-all duration-300 disabled:opacity-40 flex items-center gap-2"
                    >
                        <span>{qa.icon}</span>
                        {qa.label}
                    </button>
                ))}
            </div>

            {/* Messages - Premium Bubbles */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-gradient-to-b from-transparent to-black/20">
                {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                        {msg.role === 'assistant' && (
                            <div className="w-9 h-9 bg-gradient-to-br from-green-600 to-emerald-500 rounded-xl flex items-center justify-center text-white shrink-0 mr-3 mt-1 shadow-2xl shadow-green-500/20 border border-white/10">
                                <Bot size={18} />
                            </div>
                        )}
                        <div className={`max-w-[85%] p-4 rounded-2xl text-[13px] leading-relaxed shadow-2xl ${msg.role === 'user'
                            ? 'bg-white text-black font-semibold rounded-tr-sm'
                            : 'bg-white/5 text-white/90 border border-white/10 rounded-tl-sm backdrop-blur-3xl'
                            }`}
                            style={{ whiteSpace: 'pre-wrap' }}
                        >
                            {msg.content.replace(/\*\*/g, '')}
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex justify-start animate-fade-in">
                        <div className="w-9 h-9 bg-gradient-to-br from-green-600 to-emerald-500 rounded-xl flex items-center justify-center text-white shrink-0 mr-3 shadow-2xl shadow-green-500/10 border border-white/10">
                            <Bot size={18} className="animate-pulse" />
                        </div>
                        <div className="bg-white/5 border border-white/10 p-4 rounded-2xl rounded-tl-sm shadow-2xl flex items-center gap-3 text-white/40 text-[11px] font-black uppercase tracking-widest">
                            <RefreshCw size={14} className="animate-spin text-green-500" />
                            <span className="animate-pulse">Processing Neural Context...</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Input - Modern Integrated Design */}
            <div className="p-6 border-t border-white/5 bg-black/40 backdrop-blur-3xl">
                <div className="relative group">
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder={language === 'Hindi' ? 'Neural Link Ready (हिंदी/English)...' : 'Ask anything...'}
                        className="w-full pl-5 pr-14 py-4 bg-white/5 border border-white/10 rounded-2xl text-sm text-white placeholder-white/20 focus:ring-2 focus:ring-green-500/50 focus:border-transparent transition-all outline-none shadow-inner group-hover:border-white/20"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading}
                        className="absolute right-2 top-2 p-2.5 bg-green-600 text-white rounded-xl hover:bg-green-500 transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed shadow-xl shadow-green-600/20 active:scale-90"
                    >
                        <Send size={18} />
                    </button>
                </div>
                <div className="mt-4 flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                        <div className="w-1 h-1 bg-green-500 rounded-full animate-ping" />
                        <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em]">Neural Engine v2.4</span>
                    </div>
                    <span className="text-[9px] font-bold text-white/10 uppercase tracking-widest">Groq Llama-3 Powered</span>
                </div>
            </div>
        </div>
    );
}
