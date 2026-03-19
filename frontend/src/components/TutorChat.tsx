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

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 animate-fade-in"
                onClick={onClose}
            />

            {/* Chat Panel */}
            <div className="fixed inset-y-0 right-0 w-full md:w-[420px] bg-white shadow-2xl z-50 flex flex-col border-l border-gray-100 animate-slide-in-right">
                {/* Header */}
                <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-emerald-500 to-teal-500 text-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg">
                                <Bot size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-sm">AI Video Tutor</h3>
                                <p className="text-[10px] text-emerald-100 font-medium truncate max-w-[200px]">
                                    {videoTitle}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="px-4 py-3 border-b border-gray-50 flex gap-2 overflow-x-auto no-scrollbar">
                    {[
                        { label: '📝 Summarize', action: 'Give me a concise summary of this video.' },
                        { label: '🧠 Quiz Me', action: 'Quiz me with 3 questions about this video.' },
                        { label: '💡 Key Concepts', action: 'What are the key concepts explained in this video?' },
                    ].map((qa, i) => (
                        <button
                            key={i}
                            onClick={() => handleQuickAction(qa.action)}
                            disabled={isLoading}
                            className="px-3 py-1.5 bg-gray-50 hover:bg-emerald-50 text-gray-600 hover:text-emerald-700 text-[11px] font-semibold rounded-full border border-gray-100 hover:border-emerald-200 whitespace-nowrap transition-all disabled:opacity-40"
                        >
                            {qa.label}
                        </button>
                    ))}
                </div>

                {/* Messages */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50 custom-scrollbar">
                    {messages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'assistant' && (
                                <div className="w-7 h-7 bg-emerald-500 rounded-lg flex items-center justify-center text-white shrink-0 mr-2 mt-1 shadow-sm">
                                    <Bot size={14} />
                                </div>
                            )}
                            <div className={`max-w-[82%] p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${msg.role === 'user'
                                ? 'bg-gray-900 text-white rounded-tr-sm'
                                : 'bg-white text-gray-700 border border-gray-100 rounded-tl-sm'
                                }`}
                                style={{ whiteSpace: 'pre-wrap' }}
                            >
                                {msg.content}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="w-7 h-7 bg-emerald-500 rounded-lg flex items-center justify-center text-white shrink-0 mr-2">
                                <Bot size={14} />
                            </div>
                            <div className="bg-white border border-gray-100 p-3 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-2 text-gray-400 text-xs">
                                <Loader2 size={14} className="animate-spin text-emerald-500" />
                                <span className="animate-pulse">Analyzing video content...</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Input */}
                <div className="p-4 border-t border-gray-100 bg-white">
                    <div className="relative">
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder={language === 'Hindi' ? 'हिंदी या English में पूछें...' : 'Ask anything about the video...'}
                            className="w-full pl-4 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none"
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || isLoading}
                            className="absolute right-2 top-1.5 p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        >
                            <Send size={16} />
                        </button>
                    </div>
                    <div className="mt-2 flex items-center gap-2 justify-center">
                        <Sparkles size={10} className="text-amber-400" />
                        <span className="text-[10px] text-gray-400 font-medium">Powered by SkillBridge RAG Engine • Groq LLM</span>
                    </div>
                </div>
            </div>
        </>
    );
}
