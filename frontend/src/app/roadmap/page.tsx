'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Sparkles, Map, Rocket, Clock, ShieldCheck, Zap,
    ChevronRight, ChevronDown, Play, CheckCircle2, Circle,
    MessageSquare, Layout, BarChart, BookOpen,
    ArrowRight, Award, BrainCircuit, Globe,
    X, MonitorPlay, Bot, Languages, ListVideo,
    Eye, Timer, TrendingUp, PlayCircle, Milestone,
    Trophy, Flag, Construction, Target, Star, RefreshCw,
    MessageCircle
} from 'lucide-react';
import Link from 'next/link';
import YouTube, { YouTubeProps } from 'react-youtube';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import TutorChat from '@/components/TutorChat';

// ── Types ──

interface PlaylistVideo {
    video_id: string;
    title: string;
    thumbnail: string;
    position: number;
}

interface Playlist {
    playlist_id: string;
    title: string;
    channel: string;
    thumbnail: string;
    video_count: number;
    videos: PlaylistVideo[];
}

interface Oneshot {
    video_id: string;
    title: string;
    channel: string;
    thumbnail: string;
    duration: string;
    duration_text: string;
    view_count: number;
    view_count_text: string;
}

interface SkillItem {
    skill: string;
    importance: string;
    difficulty: string;
    estimated_time: string;
    target_proficiency: number;
    playlist?: Playlist | null;
    oneshot?: Oneshot | null;
}

export default function RoadmapPage() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [roadmap, setRoadmap] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'fast-track' | 'full'>('fast-track');
    const [language, setLanguage] = useState<'English' | 'Hindi'>('English');

    // Video player state
    const [playerOpen, setPlayerOpen] = useState(false);
    const [activeVideo, setActiveVideo] = useState<{ id: string; title: string; skillName?: string } | null>(null);
    const [currentPlaylist, setCurrentPlaylist] = useState<Playlist | null>(null);
    const playerRef = useRef<any>(null);
    const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // UI Panels
    const [playerSidebarOpen, setPlayerSidebarOpen] = useState(true);
    const [tutorOverlayOpen, setTutorOverlayOpen] = useState(false);

    // Analytics
    const [analytics, setAnalytics] = useState<any>(null);
    const [videoProgressMap, setVideoProgressMap] = useState<Record<string, any>>({});

    useEffect(() => {
        if (user?.id) {
            fetchRoadmap();
            fetchAnalytics();
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
                if (data.roadmap_data.language) {
                    setLanguage(data.roadmap_data.language === 'Hindi' ? 'Hindi' : 'English');
                }
            }
        } catch (err) {
            setError('Failed to load roadmap.');
        } finally {
            setLoading(false);
        }
    };

    const fetchAnalytics = async () => {
        try {
            const userId = user?.id;
            if (!userId) return;
            const data = await api.getVideoAnalytics(String(userId));
            setAnalytics(data.analytics);
            const progressData = await api.getVideoProgress(String(userId));
            const map: Record<string, any> = {};
            for (const p of progressData.progress || []) {
                map[p.video_id] = p;
            }
            setVideoProgressMap(map);
        } catch (err) { }
    };

    const handleGenerate = async () => {
        setGenerating(true);
        setError(null);
        try {
            const data = await api.generateRoadmap(String(user?.id), language);
            setRoadmap(data.roadmap);
            fetchAnalytics();
        } catch (err) {
            setError('Generation failed.');
        } finally {
            setGenerating(false);
        }
    };

    const handlePlayPlaylist = (playlist: Playlist, skillName: string) => {
        if (!playlist?.videos?.length) return;
        const firstVideo = playlist.videos[0];
        setCurrentPlaylist(playlist);
        setActiveVideo({ id: firstVideo.video_id, title: firstVideo.title, skillName });
        setPlayerOpen(true);
        setPlayerSidebarOpen(true);
        setTutorOverlayOpen(false);
        if (user?.id) api.incrementPlayCount(String(user.id), firstVideo.video_id).catch(() => { });
    };

    const handlePlayOneshot = (oneshot: Oneshot, skillName: string) => {
        if (!oneshot?.video_id) return;
        setCurrentPlaylist(null);
        setActiveVideo({ id: oneshot.video_id, title: oneshot.title, skillName });
        setPlayerOpen(true);
        setPlayerSidebarOpen(false);
        setTutorOverlayOpen(false);
        if (user?.id) api.incrementPlayCount(String(user.id), oneshot.video_id).catch(() => { });
    };

    const handleSwitchVideo = (video: PlaylistVideo) => {
        syncProgress();
        setActiveVideo({ id: video.video_id, title: video.title, skillName: activeVideo?.skillName });
        if (user?.id) api.incrementPlayCount(String(user.id), video.video_id).catch(() => { });
    };

    const handleClosePlayer = () => {
        syncProgress();
        setPlayerOpen(false);
        setActiveVideo(null);
        setCurrentPlaylist(null);
        setTutorOverlayOpen(false);
        if (syncIntervalRef.current) {
            clearInterval(syncIntervalRef.current);
            syncIntervalRef.current = null;
        }
        fetchAnalytics();
    };

    const syncProgress = useCallback(() => {
        if (!playerRef.current || !activeVideo?.id || !user?.id) return;
        try {
            const currentTime = playerRef.current.getCurrentTime?.() || 0;
            const duration = playerRef.current.getDuration?.() || 0;
            if (duration === 0) return;
            const percent = Math.min(100, Math.round((currentTime / duration) * 100));

            api.saveVideoProgress(String(user.id), activeVideo.id, {
                skill_name: activeVideo.skillName,
                watch_time_seconds: currentTime,
                total_duration_seconds: duration,
                completion_percentage: percent,
                last_position_seconds: currentTime,
            }).catch(() => { });
        } catch { }
    }, [activeVideo, user]);

    const onPlayerReady: YouTubeProps['onReady'] = (event) => {
        playerRef.current = event.target;
        syncIntervalRef.current = setInterval(syncProgress, 20000);
    };

    const toggleTutor = () => {
        if (!tutorOverlayOpen) {
            playerRef.current?.pauseVideo();
        }
        setTutorOverlayOpen(!tutorOverlayOpen);
    };

    const getSkillProgress = (item: SkillItem) => {
        let total = 0, count = 0;
        if (item.playlist?.videos) {
            item.playlist.videos.forEach(v => {
                total += videoProgressMap[v.video_id]?.completion_percentage || 0;
                count++;
            });
        }
        if (item.oneshot) {
            total += videoProgressMap[item.oneshot.video_id]?.completion_percentage || 0;
            count++;
        }
        return count > 0 ? total / count : 0;
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-green-500 border-t-transparent"></div>
            <p className="text-gray-400 text-sm animate-pulse">Syncing your journey...</p>
        </div>
    );

    if (!roadmap) return (
        <div className="max-w-4xl mx-auto py-12 px-6">
            <div className="bg-white border border-gray-100 rounded-3xl p-12 text-center shadow-sm">
                <div className="w-16 h-16 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Map size={32} />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Build Your AI Roadmap</h1>
                <p className="text-gray-500 mb-8 max-w-sm mx-auto text-sm">We'll map out a professional learning path based on your target role and skill gaps.</p>
                <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
                    <button onClick={() => setLanguage('English')} className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${language === 'English' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200'}`}>🇬🇧 English</button>
                    <button onClick={() => setLanguage('Hindi')} className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${language === 'Hindi' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200'}`}>🇮🇳 Hindi</button>
                </div>
                <button onClick={handleGenerate} disabled={generating} className="px-8 py-3.5 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 transition-all shadow-sm flex items-center gap-2 mx-auto disabled:opacity-50">
                    {generating ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} className="text-green-200" />}
                    {generating ? 'Mapping Journey...' : 'Generate Roadmap'}
                </button>
            </div>
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto py-6 px-6 animate-fade-in space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
                <div>
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-green-50 text-green-700 rounded-lg text-[11px] font-bold uppercase tracking-wider mb-3">
                        <Map size={12} />
                        Personalized Journey
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Skill <span className="text-green-600">Roadmap</span></h1>
                    <p className="text-gray-500 mt-1">Strategic learning path for {roadmap.readiness_summary?.top_gap_category || "Industry Success"}.</p>
                </div>
                <div className="flex bg-gray-100 p-1 rounded-xl shadow-inner shrink-0">
                    <button onClick={() => setActiveTab('fast-track')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'fast-track' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Target Gaps</button>
                    <button onClick={() => setActiveTab('full')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'full' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Full Path</button>
                </div>
            </div>

            {activeTab === 'fast-track' ? (
                <div className="grid lg:grid-cols-12 gap-8">
                    {/* ── PATH COLUMN (Left) ── */}
                    <div className="lg:col-span-8 relative pl-12 md:pl-20 py-4">
                        <div className="absolute left-6 md:left-10 top-0 bottom-0 w-[2px] bg-gray-200 rounded-full" />
                        <div className="space-y-16">
                            {roadmap.fast_track_roadmap?.map((item: SkillItem, idx: number) => {
                                const skillProgress = getSkillProgress(item);
                                const isReady = skillProgress >= 90;
                                return (
                                    <div key={idx} className="relative group">
                                        <div className={`absolute -left-6 md:-left-10 top-2 w-10 h-10 -ml-5 rounded-full border-2 z-10 flex items-center justify-center transition-all bg-white shadow-sm ${isReady ? 'border-green-500 text-green-600' : 'border-gray-200 text-gray-400'}`}>
                                            {isReady ? <CheckCircle2 size={18} /> : <span className="text-xs font-bold">{idx + 1}</span>}
                                        </div>
                                        <div className="card-simple p-6 hover:border-green-200 transition-all group-hover:shadow-md">
                                            <div className="flex flex-col md:flex-row gap-4 mb-5 pb-5 border-b border-gray-50">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-1">
                                                        <h3 className="text-lg font-bold text-gray-900 group-hover:text-green-600 transition-colors uppercase tracking-tight">{item.skill}</h3>
                                                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${item.difficulty === 'Advanced' ? 'bg-rose-50 text-rose-600' : 'bg-green-50 text-green-600'}`}>{item.difficulty}</span>
                                                    </div>
                                                    <p className="text-gray-500 text-xs leading-relaxed line-clamp-2 md:line-clamp-none">{item.importance}</p>
                                                </div>
                                                <div className="flex md:flex-col gap-2 shrink-0">
                                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 rounded-lg text-[10px] font-bold text-gray-600">
                                                        <Clock size={12} /> {item.estimated_time || "24h"}
                                                    </div>
                                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 rounded-lg text-[10px] font-bold text-green-600">
                                                        <TrendingUp size={12} /> {Math.round(skillProgress)}%
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                {item.playlist && (item.playlist.playlist_id || item.playlist.videos?.length > 0) && (
                                                    <button onClick={() => handlePlayPlaylist(item.playlist!, item.skill)} className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-green-50 hover:border-green-100 border border-transparent transition-all group/row">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 bg-white rounded-lg shadow-sm flex items-center justify-center text-green-600 group-hover/row:bg-green-600 group-hover/row:text-white transition-all"><ListVideo size={16} /></div>
                                                            <div className="text-left">
                                                                <p className="text-xs font-bold text-gray-900 line-clamp-1">{item.playlist.title}</p>
                                                                <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Mastery Course • {item.playlist.video_count || item.playlist.videos.length} Lectures</p>
                                                            </div>
                                                        </div>
                                                        <Play className="text-gray-300 group-hover/row:text-green-500" size={14} fill="currentColor" />
                                                    </button>
                                                )}
                                                {item.oneshot?.video_id && (
                                                    <button onClick={() => handlePlayOneshot(item.oneshot!, item.skill)} className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-amber-50 hover:border-amber-100 border border-transparent transition-all group/row">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 bg-white rounded-lg shadow-sm flex items-center justify-center text-amber-600 group-hover/row:bg-amber-500 group-hover/row:text-white transition-all"><Zap size={16} /></div>
                                                            <div className="text-left">
                                                                <p className="text-xs font-bold text-gray-900 line-clamp-1">{item.oneshot.title}</p>
                                                                <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Quick One-Shot • {item.oneshot.view_count_text || "Popular"}</p>
                                                            </div>
                                                        </div>
                                                        <Play className="text-gray-300 group-hover/row:text-amber-500" size={14} fill="currentColor" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div className="relative pt-4">
                                <div className="absolute -left-6 md:-left-10 top-0 w-10 h-10 -ml-5 bg-green-600 text-white rounded-full shadow-lg flex items-center justify-center animate-bounce-slow"><Trophy size={18} /></div>
                                <div className="pl-6">
                                    <h4 className="text-sm font-bold text-gray-900 uppercase tracking-tight">Market Readiness Target</h4>
                                    <p className="text-xs text-gray-400">Complete the course work to unlock the certification exam.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── SIDEBAR (Right) ── */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="card-simple space-y-6">
                            <div className="flex items-center gap-2 text-green-600">
                                <Award size={18} />
                                <h4 className="text-[10px] font-bold uppercase tracking-widest">Market Preparedness</h4>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <p className="text-4xl font-bold text-gray-900">{(roadmap.readiness_summary?.current_score || 65).toFixed(0)}%</p>
                                    <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Overall Score</p>
                                </div>
                                <div className="relative w-20 h-20">
                                    <svg className="w-full h-full transform -rotate-90">
                                        <circle cx="50%" cy="50%" r="40%" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-gray-100" />
                                        <circle cx="50%" cy="50%" r="40%" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray="251" strokeDashoffset={251 - (251 * (roadmap.readiness_summary?.current_score || 0.65) / 100)} strokeLinecap="round" className="text-green-500 transition-all duration-1000" />
                                    </svg>
                                </div>
                            </div>
                            <button onClick={handleGenerate} disabled={generating} className="w-full py-3 bg-gray-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-800 transition-all flex items-center justify-center gap-2">
                                {generating ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh Roadmap
                            </button>
                        </div>

                        {analytics && (
                            <div className="card-simple">
                                <div className="flex items-center gap-2 text-blue-600 mb-6 font-black uppercase tracking-widest text-[10px]"><BarChart size={16} /> Learning Metrics</div>
                                <div className="grid grid-cols-2 gap-3 mb-6">
                                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                        <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Time</p>
                                        <p className="text-sm font-bold text-gray-900">{analytics.total_watch_time_text || '0m'}</p>
                                    </div>
                                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                        <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Items</p>
                                        <p className="text-sm font-bold text-gray-900">{analytics.total_completed || 0}</p>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Skill Progress</p>
                                    <div className="space-y-3">
                                        {analytics.per_skill?.slice(0, 4).map((s: any, i: number) => (
                                            <div key={i} className="space-y-1.5">
                                                <div className="flex justify-between text-[10px] font-bold uppercase"><span className="text-gray-700 truncate">{s.skill_name}</span><span className="text-green-600">{s.avg_completion.toFixed(0)}%</span></div>
                                                <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-green-500" style={{ width: `${s.avg_completion}%` }} /></div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {['beginner_milestones', 'intermediate_milestones', 'advanced_milestones'].map((phase, pIdx) => (
                        <div key={phase} className="space-y-4">
                            <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest flex items-center gap-2 mb-4"><span className={`w-2 h-2 rounded-full ${pIdx === 0 ? 'bg-green-500' : pIdx === 1 ? 'bg-blue-500' : 'bg-purple-500'}`}></span>{phase.replace('_', ' ')}</h3>
                            {roadmap.full_roadmap?.[phase]?.map((milestone: any, mIdx: number) => (
                                <div key={mIdx} className="card-simple p-5 group flex flex-col h-full bg-gray-50 hover:bg-white transition-all border-none shadow-none hover:shadow-sm">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 group-hover:text-green-600 transition-colors">{milestone.milestone || milestone.skill}</p>
                                    <p className="text-xs text-gray-500 leading-relaxed font-medium line-clamp-2 md:line-clamp-none">{milestone.outcome || "Achieving core competencies."}</p>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            )}

            {/* ====== IMMERSIVE PLAYER MODAL (Restructured to avoid overlap) ====== */}
            {playerOpen && activeVideo && (
                <div className="fixed inset-0 z-[100] bg-black flex flex-col overflow-hidden animate-fade-in font-sans">

                    {/* Dedicated Top Header (Solid background to prevent overlap) */}
                    <div className="flex-none h-16 bg-gray-900 border-b border-white/10 z-50 flex items-center justify-between px-6">
                        <div className="flex items-center gap-4">
                            <button onClick={handleClosePlayer} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-white transition-all border border-white/5"><X size={20} /></button>
                            <div className="hidden md:block">
                                <h3 className="text-white font-bold text-sm tracking-tight">{activeVideo.skillName}</h3>
                                <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest truncate max-w-md">{activeVideo.title}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={toggleTutor}
                                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${tutorOverlayOpen ? 'bg-green-600 text-white shadow-[0_0_20px_rgba(22,163,74,0.4)]' : 'bg-green-600/10 text-green-400 border border-green-500/30 hover:bg-green-600 hover:text-white'}`}
                            >
                                <Bot size={18} /> {tutorOverlayOpen ? 'Dismiss Tutor' : 'Ask AI Tutor'}
                            </button>
                            {currentPlaylist && (
                                <button onClick={() => setPlayerSidebarOpen(!playerSidebarOpen)} className={`p-2.5 rounded-xl transition-all ${playerSidebarOpen ? 'bg-white/20 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}>
                                    <ListVideo size={20} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* MAIN CONTENT AREA */}
                    <div className="flex-1 flex flex-row overflow-hidden relative">
                        {/* MAIN STAGE (Blurred when Tutor is open) */}
                        <div className={`flex-1 relative bg-black transition-all duration-700`}>
                            <div className={`absolute inset-0 z-10 transition-all duration-500 pointer-events-none ${tutorOverlayOpen ? 'backdrop-blur-[12px] bg-black/40' : 'backdrop-blur-none bg-black/0'}`} />
                            <YouTube
                                videoId={activeVideo.id}
                                opts={{ height: '100%', width: '100%', playerVars: { autoplay: 1, modestbranding: 1 } }}
                                onReady={onPlayerReady}
                                className={`absolute inset-0 w-full h-full transition-all duration-500 ${tutorOverlayOpen ? 'scale-95 opacity-80' : 'scale-100 opacity-100'}`}
                                iframeClassName="w-full h-full"
                            />
                        </div>

                        {/* PLAYLIST SIDEBAR */}
                        {currentPlaylist && (
                            <div className={`flex-none bg-gray-900 border-l border-white/5 transition-all duration-500 z-30 ${playerSidebarOpen ? 'w-[320px]' : 'w-0 overflow-hidden'} flex flex-col pt-6 px-4`}>
                                <h4 className="text-white font-black text-[10px] uppercase tracking-widest mb-6 px-2 flex items-center gap-2 text-white/60"><ListVideo size={14} /> Course Path</h4>
                                <div className="flex-1 overflow-y-auto space-y-1 pb-10 custom-scrollbar pr-1">
                                    {currentPlaylist.videos.map((video, idx) => {
                                        const isActive = activeVideo.id === video.video_id;
                                        const progress = videoProgressMap[video.video_id];
                                        return (
                                            <button key={idx} onClick={() => handleSwitchVideo(video)} className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-all text-left group ${isActive ? 'bg-green-600/10 border-l-2 border-green-500' : 'hover:bg-white/5 border-l-2 border-transparent'}`}>
                                                <div className="relative w-16 h-10 bg-gray-800 rounded shrink-0 overflow-hidden border border-white/5">
                                                    <img src={`https://img.youtube.com/vi/${video.video_id}/mqdefault.jpg`} alt="" className="w-full h-full object-cover opacity-50" />
                                                    {isActive ? <div className="absolute inset-0 bg-green-600/20 flex items-center justify-center"><Play size={12} fill="white" className="text-white" /></div> : progress?.is_completed && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><CheckCircle2 size={12} className="text-green-500" /></div>}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-[11px] font-bold line-clamp-2 leading-tight ${isActive ? 'text-green-400' : 'text-gray-400 group-hover:text-white'}`}>{video.title}</p>
                                                    {progress?.completion_percentage > 0 && !progress.is_completed && <div className="mt-1.5 h-0.5 w-full bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-green-500" style={{ width: `${progress.completion_percentage}%` }} /></div>}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* TUTOR MODAL OVERLAY */}
                        {tutorOverlayOpen && (
                            <div className="absolute inset-0 z-50 flex items-center justify-center p-4 md:p-8 animate-scale-in">
                                <div className="w-full max-w-4xl h-[90%] bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border border-gray-100 ring-4 ring-black/5">
                                    <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-green-50/30">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-green-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-green-200"><Bot size={24} /></div>
                                            <div>
                                                <h4 className="text-lg font-bold text-gray-900 tracking-tight">AI Skills Tutor</h4>
                                                <p className="text-xs text-green-600 font-bold uppercase tracking-widest">{activeVideo.skillName} • Analysis Mode</p>
                                            </div>
                                        </div>
                                        <button onClick={toggleTutor} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-500 transition-colors shadow-sm"><X size={20} /></button>
                                    </div>
                                    <div className="flex-1 overflow-hidden relative">
                                        <TutorChat
                                            isOpen={true}
                                            onClose={toggleTutor}
                                            videoId={activeVideo.id}
                                            videoTitle={activeVideo.title}
                                            language={language}
                                        />
                                    </div>
                                    <div className="px-6 py-3 bg-gray-50 flex items-center justify-between">
                                        <div className="flex items-center gap-2"><Sparkles className="text-amber-500" size={14} /><span className="text-[10px] text-gray-400 font-bold uppercase">Enhanced by Groq LLM & RAG</span></div>
                                        <p className="text-[10px] text-gray-400 font-bold">Ask about any timestamp or concept in the video.</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
