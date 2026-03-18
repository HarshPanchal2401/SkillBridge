'use client';

import React, { useState, useEffect } from 'react';
import {
    Sparkles, Map, Rocket, Clock, ShieldCheck, Zap,
    ChevronRight, Play, CheckCircle2, Circle,
    MessageSquare, Layout, BarChart, BookOpen,
    ArrowRight, Award, BrainCircuit, Globe,
    X, MonitorPlay, Bot
} from 'lucide-react';
import Link from 'next/link';
import YouTube, { YouTubeProps } from 'react-youtube';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import TutorChat from '@/components/TutorChat';

// Helper to extract YouTube video ID from various URL formats
function extractVideoId(url: string): string {
    if (!url) return '';
    try {
        const parsed = new URL(url);
        if (parsed.hostname === 'youtu.be') return parsed.pathname.slice(1);
        const v = parsed.searchParams.get('v');
        if (v) return v;
    } catch { }
    // Bare 11-char ID
    if (url.length === 11 && /^[a-zA-Z0-9_-]+$/.test(url)) return url;
    return '';
}

export default function RoadmapPage() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [roadmap, setRoadmap] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'fast-track' | 'full'>('fast-track');

    // Video player state
    const [playerOpen, setPlayerOpen] = useState(false);
    const [activeVideo, setActiveVideo] = useState<{ id: string; title: string; url: string; searchQuery?: string } | null>(null);
    const [hasWatched, setHasWatched] = useState(false);
    const [videoLoading, setVideoLoading] = useState(false);

    // Tutor chat state
    const [tutorOpen, setTutorOpen] = useState(false);

    useEffect(() => {
        if (user?.id) {
            fetchRoadmap();
        }
    }, [user]);

    const fetchRoadmap = async () => {
        setLoading(true);
        try {
            const userId = user?.id;
            if (!userId) return;
            const data = await api.getLatestRoadmap(userId);
            if (data.roadmap_data) {
                setRoadmap(data.roadmap_data);
            }
        } catch (err) {
            setError('Failed to load roadmap. Try generating a new one.');
        } finally {
            setLoading(false);
        }
    };

    const handleGenerate = async () => {
        setLoading(true);
        try {
            const userId = user?.id;
            if (!userId) {
                setError('User not authenticated');
                return;
            }
            const data = await api.generateRoadmap(userId);
            setRoadmap(data.roadmap);
        } catch (err) {
            setError('Generation failed. Please check your connection.');
        } finally {
            setLoading(false);
        }
    };

    const handleVideoClick = async (video: any) => {
        const url = video.url || '';
        let vid = extractVideoId(url);
        const title = video.title || 'Unknown Video';
        const channel = video.channel || '';

        setPlayerOpen(true);
        setHasWatched(false);
        setTutorOpen(false);
        setVideoLoading(true);

        // If no video ID from URL, search for it via backend
        if (!vid) {
            try {
                const result = await api.findVideo(title, channel);
                vid = result.video_id;
                setActiveVideo({
                    id: vid,
                    title: title,
                    url: url || `https://www.youtube.com/watch?v=${vid}`,
                    searchQuery: result.search_query
                });
            } catch (err) {
                console.error('Failed to find video:', err);
                setActiveVideo({
                    id: '',
                    title: title,
                    url: url,
                    searchQuery: `${title} ${channel}`
                });
            }
        } else {
            setActiveVideo({
                id: vid,
                title: title,
                url: url
            });
        }

        setVideoLoading(false);
    };

    const handleOpenTutor = () => {
        if (activeVideo) {
            setTutorOpen(true);
        }
    };

    const handleClosePlayer = () => {
        setPlayerOpen(false);
        setActiveVideo(null);
        setHasWatched(false);
        setTutorOpen(false);
    };

    const onPlayerStateChange: YouTubeProps['onStateChange'] = (event) => {
        // State 0 = ended, 2 = paused
        if (event.data === 0 || event.data === 2) {
            setHasWatched(true);
        }
    };

    const playerOpts: YouTubeProps['opts'] = {
        height: '100%',
        width: '100%',
        playerVars: {
            autoplay: 1,
            modestbranding: 1,
            rel: 0,
        },
    };

    if (loading) {
        return (
            <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 animate-pulse">
                <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mb-4">
                    <BrainCircuit size={32} className="text-green-500 animate-spin-slow" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Brainstorming your path...</h2>
                <p className="text-gray-400 text-sm mt-2">Connecting to AI Mentor & analyzing market trends</p>
            </div>
        );
    }

    if (!roadmap) {
        return (
            <div className="max-w-4xl mx-auto py-12 px-6 animate-fade-in">
                <div className="bg-white border-2 border-dashed border-gray-100 rounded-[3rem] p-12 text-center shadow-sm">
                    <div className="w-20 h-20 bg-green-50 text-green-600 rounded-3xl flex items-center justify-center mx-auto mb-6 transform hover:rotate-12 transition-transform duration-500">
                        <Map size={40} />
                    </div>
                    <h1 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">Personalized Career Roadmaps</h1>
                    <p className="text-gray-400 max-w-md mx-auto mb-8 leading-relaxed">
                        Ready to bridge the gap? Our AI will analyze your skills and create
                        a personalized learning path tailored for your target role.
                    </p>
                    <button
                        onClick={handleGenerate}
                        className="px-10 py-4 bg-gray-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-gray-800 transition-all shadow-xl active:scale-95 flex items-center gap-3 mx-auto"
                    >
                        <Sparkles size={18} className="text-amber-400" />
                        Generate My AI Roadmap
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto py-8 px-6 animate-fade-in">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-50 text-green-600 rounded-full text-[10px] font-black uppercase tracking-widest mb-4 border border-green-100">
                        <Zap size={12} />
                        Live AI Roadmap
                    </div>
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight">
                        Target: <span className="text-green-600 font-black">{roadmap.readiness_summary?.top_gap_category || "Industry Ready"}</span>
                    </h1>
                    <p className="text-gray-400 mt-2 font-medium flex items-center gap-2">
                        <Globe size={14} /> Market Analysis: {roadmap.readiness_summary?.market_analysis || "Optimized for 2024 Hiring"}
                    </p>
                </div>

                <div className="flex bg-gray-100 p-1 rounded-2xl">
                    <button
                        onClick={() => setActiveTab('fast-track')}
                        className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${activeTab === 'fast-track'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Skill-Gap (Fast)
                    </button>
                    <button
                        onClick={() => setActiveTab('full')}
                        className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${activeTab === 'full'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Full Journey (0-100)
                    </button>
                </div>
            </div>

            {activeTab === 'fast-track' ? (
                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-8">
                        {roadmap.fast_track_roadmap?.map((item: any, idx: number) => (
                            <div key={idx} className="group relative bg-white border border-gray-100 rounded-3xl p-8 hover:border-green-200 transition-all duration-300 shadow-sm hover:shadow-xl">
                                <div className="flex items-start gap-6">
                                    <div className="w-14 h-14 bg-gray-50 text-gray-300 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-green-500 group-hover:text-white transition-all duration-500">
                                        <span className="text-xl font-black">{idx + 1}</span>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="text-xl font-bold text-gray-900 group-hover:text-green-600 transition-colors uppercase tracking-tight">{item.skill}</h3>
                                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${item.gap_severity === 'Critical' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
                                                }`}>
                                                {item.gap_severity || "Mandatory"}
                                            </span>
                                        </div>
                                        <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                                            {item.importance || item.rationale}
                                        </p>

                                        <div className="grid md:grid-cols-3 gap-4 mb-6">
                                            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                                <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Estimated Time</p>
                                                <p className="text-sm font-bold text-gray-900">{item.estimated_time || "24h Total"}</p>
                                            </div>
                                            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                                <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Target Score</p>
                                                <p className="text-sm font-bold text-gray-900">{item.target_proficiency ? `${(item.target_proficiency * 100).toFixed(0)}%` : "0.85"}</p>
                                            </div>
                                            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                                <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Difficulty</p>
                                                <p className="text-sm font-bold text-gray-900">{item.difficulty}</p>
                                            </div>
                                        </div>

                                        {/* Video Cards */}
                                        <div className="space-y-3">
                                            {item.videos?.map((video: any, vIdx: number) => {
                                                const vid = extractVideoId(video.url || '');
                                                return (
                                                    <div
                                                        key={vIdx}
                                                        onClick={() => handleVideoClick(video)}
                                                        className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl hover:bg-gradient-to-r hover:from-emerald-50/50 hover:to-white cursor-pointer transition-all group/video active:scale-[0.98] hover:border-emerald-200 hover:shadow-md"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="relative w-12 h-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center group-hover/video:bg-rose-600 group-hover/video:text-white transition-all overflow-hidden shrink-0">
                                                                {vid ? (
                                                                    <>
                                                                        <img
                                                                            src={`https://img.youtube.com/vi/${vid}/default.jpg`}
                                                                            alt=""
                                                                            className="absolute inset-0 w-full h-full object-cover rounded-xl opacity-80 group-hover/video:opacity-40 transition-opacity"
                                                                        />
                                                                        <Play size={16} fill="currentColor" className="relative z-10 drop-shadow-lg" />
                                                                    </>
                                                                ) : (
                                                                    <Play size={16} fill="currentColor" />
                                                                )}
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-bold text-gray-900 group-hover/video:text-emerald-700 transition-colors line-clamp-1">{video.title}</p>
                                                                <p className="text-[10px] text-gray-400 font-medium">{video.channel} • {video.duration}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[8px] font-black bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full uppercase border border-emerald-100">▶ Watch & Learn</span>
                                                            <ChevronRight size={14} className="text-gray-300 group-hover/video:translate-x-1 transition-transform" />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Right Sidebar - Readiness Score */}
                    <div className="space-y-8">
                        <div className="bg-gray-900 text-white rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-green-500 opacity-20 blur-3xl -mr-16 -mt-16"></div>
                            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                                <Award className="text-green-400" size={20} />
                                Career Readiness
                            </h3>
                            <div className="flex items-center justify-center mb-8">
                                <div className="relative w-44 h-44 flex items-center justify-center">
                                    <svg className="w-full h-full transform -rotate-90">
                                        <circle
                                            cx="88"
                                            cy="88"
                                            r="75"
                                            stroke="currentColor"
                                            strokeWidth="14"
                                            fill="transparent"
                                            className="text-gray-800"
                                        />
                                        <circle
                                            cx="88"
                                            cy="88"
                                            r="75"
                                            stroke="currentColor"
                                            strokeWidth="14"
                                            fill="transparent"
                                            strokeDasharray={471}
                                            strokeDashoffset={471 - (471 * (roadmap.readiness_summary?.current_score || 0.65))}
                                            strokeLinecap="round"
                                            className="text-green-500 transition-all duration-1000 ease-out"
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-4xl font-black">{(roadmap.readiness_summary?.current_score * 100).toFixed(0)}%</span>
                                    </div>
                                </div>
                            </div>
                            <p className="text-sm text-gray-400 text-center italic">
                                You're almost there! Complete the {roadmap.fast_track_roadmap?.length || 0} modules above to hit 90%.
                            </p>
                        </div>

                        <div className="bg-white border border-gray-100 rounded-[2.5rem] p-8">
                            <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2 uppercase tracking-wide text-sm">
                                <Sparkles className="text-amber-400" size={16} />
                                SkillBridge Insights
                            </h4>
                            <ul className="space-y-4">
                                <li className="flex gap-3">
                                    <div className="w-5 h-5 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                                        <CheckCircle2 size={12} />
                                    </div>
                                    <p className="text-xs text-gray-500 leading-relaxed">Click any video to watch it and then chat with your AI tutor about the content.</p>
                                </li>
                                <li className="flex gap-3">
                                    <div className="w-5 h-5 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                                        <Bot size={12} />
                                    </div>
                                    <p className="text-xs text-gray-500 leading-relaxed">The AI Tutor reads the video transcript and can quiz you, explain concepts, or summarize key points.</p>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            ) : (
                /* Full Career Roadmap View */
                <div className="space-y-12">
                    {['beginner_milestones', 'intermediate_milestones', 'advanced_milestones'].map((phase, pIdx) => (
                        <div key={phase} className="animate-fade-in" style={{ animationDelay: `${pIdx * 150}ms` }}>
                            <h2 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-4 capitalize">
                                <div className="w-10 h-10 bg-gray-900 text-white rounded-xl flex items-center justify-center text-sm">
                                    {pIdx + 1}
                                </div>
                                {phase.replace('_', ' ')}
                            </h2>
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {roadmap.full_roadmap?.[phase]?.map((milestone: any, mIdx: number) => (
                                    <div key={mIdx} className="group bg-white border border-gray-100 p-6 rounded-3xl hover:border-green-200 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                                        <h4 className="font-bold text-gray-900 mb-2 truncate group-hover:text-green-600 transition-colors uppercase tracking-tight">{milestone.milestone || milestone.skill}</h4>
                                        <p className="text-xs text-gray-400 line-clamp-3 mb-4 leading-relaxed">{milestone.outcome || milestone.description || "Mastering the fundamental concepts."}</p>
                                        <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-50">
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{milestone.timeline || "2-3 Days"}</span>
                                            <div className="w-7 h-7 border-2 border-gray-100 rounded-full flex items-center justify-center text-gray-200 group-hover:bg-green-500 group-hover:border-green-500 group-hover:text-white transition-all duration-300">
                                                <CheckCircle2 size={16} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    {/* Project Phase */}
                    <div className="bg-green-50/50 rounded-[3.5rem] p-12 border border-green-100 animate-fade-in" style={{ animationDelay: '450ms' }}>
                        <h2 className="text-3xl font-black text-gray-900 mb-8 flex items-center gap-4">
                            <Rocket className="text-green-600" size={32} />
                            The Project Phase
                        </h2>
                        <div className="grid md:grid-cols-2 gap-8">
                            {roadmap.full_roadmap?.portfolio_projects?.map((proj: any, prIdx: number) => (
                                <div key={prIdx} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-white hover:border-green-200 transition-all duration-300 group">
                                    <h4 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-green-600 transition-colors uppercase tracking-tight">{proj.title}</h4>
                                    <p className="text-sm text-gray-500 mb-6 leading-relaxed">{proj.description || "Building a production-ready application to demonstrate mastery."}</p>
                                    <div className="flex flex-wrap gap-2">
                                        {proj.stack?.map((tech: string, tIdx: number) => (
                                            <span key={tIdx} className="px-3 py-1 bg-gray-50 text-gray-500 text-[10px] font-bold rounded-lg border border-gray-100 uppercase tracking-wider">
                                                {tech}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Career Preparation */}
                    <div className="bg-gray-900 text-white rounded-[3.5rem] p-12 border border-gray-800 animate-fade-in" style={{ animationDelay: '600ms' }}>
                        <div className="max-w-3xl mx-auto text-center">
                            <h2 className="text-3xl font-black mb-6 flex items-center justify-center gap-4">
                                <ShieldCheck className="text-green-400" size={32} />
                                Career Ready Phase
                            </h2>
                            <p className="text-gray-400 mb-10 leading-relaxed">
                                Transitioning from learning to performing. Focus on interview algorithms, system design patterns, and industrial behavioral competencies.
                            </p>
                            <div className="flex flex-wrap justify-center gap-4">
                                {roadmap.full_roadmap?.career_preparation?.map((item: any, iIdx: number) => (
                                    <div key={iIdx} className="px-6 py-3 bg-gray-800 rounded-2xl border border-gray-700 text-sm font-bold hover:bg-gray-700 transition-colors">
                                        {item.focus || item}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ====== VIDEO PLAYER MODAL ====== */}
            {playerOpen && activeVideo && (
                <>
                    {/* Modal Backdrop */}
                    <div
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-fade-in"
                        onClick={handleClosePlayer}
                    />

                    {/* Modal Content */}
                    <div className="fixed inset-4 md:inset-8 lg:inset-12 bg-gray-950 rounded-3xl z-50 flex flex-col overflow-hidden shadow-2xl animate-scale-in border border-white/10">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-gray-900 to-gray-950 border-b border-white/10">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-rose-600 rounded-lg flex items-center justify-center text-white">
                                    <MonitorPlay size={16} />
                                </div>
                                <div>
                                    <h3 className="text-white font-bold text-sm line-clamp-1 max-w-[400px]">{activeVideo.title}</h3>
                                    <p className="text-gray-500 text-[10px] font-mono">Video ID: {activeVideo.id || 'N/A'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleOpenTutor}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${hasWatched
                                        ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 animate-pulse-subtle'
                                        : 'bg-white/10 text-gray-300 hover:bg-white/20'
                                        }`}
                                >
                                    <Bot size={14} />
                                    {hasWatched ? '🧠 Ask AI Tutor' : 'Ask Tutor'}
                                </button>
                                <button
                                    onClick={handleClosePlayer}
                                    className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* YouTube Player */}
                        <div className="flex-1 bg-black flex items-center justify-center relative">
                            {videoLoading ? (
                                <div className="text-center text-gray-400 p-8 animate-pulse">
                                    <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                        <BrainCircuit size={32} className="text-emerald-400 animate-spin" />
                                    </div>
                                    <h3 className="text-lg font-bold text-white mb-2">Finding Video...</h3>
                                    <p className="text-sm">Searching YouTube for the best match</p>
                                </div>
                            ) : activeVideo?.id ? (
                                <YouTube
                                    videoId={activeVideo.id}
                                    opts={playerOpts}
                                    onStateChange={onPlayerStateChange}
                                    className="absolute inset-0 w-full h-full"
                                    iframeClassName="w-full h-full"
                                />
                            ) : (
                                /* Fallback: YouTube search embed via iframe */
                                <iframe
                                    src={`https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(activeVideo?.searchQuery || activeVideo?.title || '')}`}
                                    className="absolute inset-0 w-full h-full"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                />
                            )}
                        </div>

                        {/* Bottom Bar */}
                        <div className="px-6 py-3 bg-gradient-to-r from-gray-900 to-gray-950 border-t border-white/10 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                {hasWatched && (
                                    <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1 animate-fade-in">
                                        <CheckCircle2 size={12} />
                                        Video Watched
                                    </span>
                                )}
                            </div>
                            <p className="text-[10px] text-gray-500 font-medium">
                                Pause or finish the video, then chat with your AI Tutor about the content
                            </p>
                        </div>
                    </div>
                </>
            )}

            {/* ====== TUTOR CHAT SIDEBAR ====== */}
            <TutorChat
                isOpen={tutorOpen}
                onClose={() => setTutorOpen(false)}
                videoId={activeVideo?.id || ''}
                videoTitle={activeVideo?.title || ''}
            />
        </div>
    );
}
