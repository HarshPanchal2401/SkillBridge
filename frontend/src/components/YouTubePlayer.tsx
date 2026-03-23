'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import YouTube, { YouTubeProps } from 'react-youtube';
import { Loader2, AlertCircle, ListVideo, Play, CheckCircle2, Clock } from 'lucide-react';

interface PlaylistVideo {
    video_id: string;
    title: string;
    thumbnail: string;
    position: number;
}

interface YouTubePlayerProps {
    videoId: string;
    playlistId?: string;
    videos?: PlaylistVideo[];
    userId: number | string;
    milestoneId: string;
    initialTime?: number;
    onProgressUpdate?: (percent: number) => void;
    onVideoSwitch?: (video: PlaylistVideo) => void;
    onReady?: YouTubeProps['onReady'];
    onStateChange?: YouTubeProps['onStateChange'];
    // Progress API functions
    saveProgress?: (videoId: string, data: any) => Promise<any>;
    getProgress?: (videoId: string) => Promise<any>;
}

export default function YouTubePlayer({
    videoId: initialVideoId,
    playlistId: initialPlaylistId,
    videos = [],
    userId,
    milestoneId,
    initialTime = 0,
    onProgressUpdate,
    onVideoSwitch,
    onReady: parentOnReady,
    onStateChange: parentOnStateChange,
    saveProgress,
    getProgress,
}: YouTubePlayerProps) {
    const [player, setPlayer] = useState<any>(null);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(initialTime);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeVId, setActiveVId] = useState<string>(initialVideoId);
    const [showPlaylist, setShowPlaylist] = useState(videos.length > 0);
    const [resumeTime, setResumeTime] = useState<number>(initialTime);
    const [watchedVideos, setWatchedVideos] = useState<Set<string>>(new Set());
    const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const playerRef = useRef<any>(null);
    const lastTickTimestampRef = useRef<number>(Date.now());
    const isPlayingRef = useRef<boolean>(false);
    const [accumulatedPercent, setAccumulatedPercent] = useState<number>(0);

    // ── Sync activeVId when prop changes ──
    useEffect(() => {
        setActiveVId(initialVideoId);
        setResumeTime(initialTime);
    }, [initialVideoId, initialTime]);

    // ── Show/hide playlist sidebar when videos change ──
    useEffect(() => {
        setShowPlaylist(videos.length > 0);
    }, [videos]);

    // ── Fetch saved position for current video ──
    useEffect(() => {
        if (getProgress && activeVId) {
            getProgress(activeVId).then((data: any) => {
                const pos = data?.progress?.last_position_seconds;
                if (pos && pos > 5) {
                    setResumeTime(pos);
                    // If player is already loaded, seek to saved position
                    if (playerRef.current) {
                        playerRef.current.seekTo(pos, true);
                    }
                }
                // Mark as watched if completed
                if (data?.progress?.is_completed) {
                    setWatchedVideos(prev => new Set(prev).add(activeVId));
                }
            }).catch(() => { });
        }
    }, [activeVId, getProgress]);

    // ── Save progress function ──
    const doSaveProgress = useCallback(async (force = false) => {
        const p = playerRef.current;
        if (!p || !activeVId || !userId || !milestoneId) return;

        try {
            const now = Date.now();
            const realDeltaSeconds = (now - lastTickTimestampRef.current) / 1000;
            lastTickTimestampRef.current = now;

            const playbackRate = p.getPlaybackRate?.() || 1;

            // Collect delta if we were playing during this tick
            const contentDelta = isPlayingRef.current ? realDeltaSeconds * playbackRate : 0;

            const time = p.getCurrentTime?.() || 0;
            const dur = p.getDuration?.() || 0;
            if (dur === 0) return;

            // percent for display (currentTime based)
            const displayPercent = Math.min(100, Math.round((time / dur) * 100));
            setCurrentTime(time);

            if (saveProgress) {
                setIsSaving(true);
                const res = await saveProgress(activeVId, {
                    skill_name: milestoneId,
                    watch_time_seconds: time,
                    total_duration_seconds: dur,
                    completion_percentage: displayPercent,
                    last_position_seconds: time,
                    delta_seconds: contentDelta
                });
                setIsSaving(false);

                // Use the accumulated percent from backend for real progress
                const realPercent = res?.accumulated_percent || displayPercent;
                setAccumulatedPercent(realPercent);

                if (onProgressUpdate) {
                    onProgressUpdate(realPercent);
                }

                if (realPercent >= 90) {
                    setWatchedVideos(prev => new Set(prev).add(activeVId));
                }
            }
        } catch (err) {
            console.error('Failed to save progress:', err);
            setIsSaving(false);
        }
    }, [activeVId, userId, milestoneId, saveProgress, onProgressUpdate]);

    // ── Auto-save every 15 seconds ──
    useEffect(() => {
        if (playerRef.current) {
            syncIntervalRef.current = setInterval(() => {
                doSaveProgress();
            }, 15000);
        }
        return () => {
            if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
        };
    }, [doSaveProgress]);

    // ── Save on tab close / navigate away ──
    useEffect(() => {
        const handleBeforeUnload = () => {
            doSaveProgress(true);
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [doSaveProgress]);

    const onReady: YouTubeProps['onReady'] = (event) => {
        const p = event.target;
        setPlayer(p);
        playerRef.current = p;
        const dur = p.getDuration();
        setDuration(dur);

        // Resume from saved position
        if (resumeTime > 5) {
            p.seekTo(resumeTime, true);
        }

        if (parentOnReady) parentOnReady(event);
    };

    const onStateChange: YouTubeProps['onStateChange'] = (event) => {
        // State 1 = playing, State 2 = paused, State 0 = ended
        if (event.data === 1) {
            isPlayingRef.current = true;
            lastTickTimestampRef.current = Date.now();
        } else if (event.data === 2 || event.data === 0) {
            if (isPlayingRef.current) {
                doSaveProgress(true);
            }
            isPlayingRef.current = false;
        }
        if (parentOnStateChange) parentOnStateChange(event);
    };

    const handleVideoSelect = async (video: PlaylistVideo) => {
        // Save current video progress before switching
        await doSaveProgress(true);

        setActiveVId(video.video_id);
        setResumeTime(0); // Will be fetched by the useEffect
        setDuration(0);
        if (onVideoSwitch) onVideoSwitch(video);
    };

    const opts: YouTubeProps['opts'] = {
        height: '100%',
        width: '100%',
        playerVars: {
            autoplay: 1,
            modestbranding: 1,
            rel: 0,
            origin: typeof window !== 'undefined' ? window.location.origin : '',
        },
    };

    const isExternalLink = !initialVideoId && !initialPlaylistId && initialPlaylistId && !initialPlaylistId.includes('youtube.com');

    if (isExternalLink) {
        return (
            <div className="flex flex-col items-center justify-center h-[450px] bg-gradient-to-br from-gray-900 via-gray-800 to-black rounded-3xl border border-white/10 text-white p-8 text-center relative overflow-hidden group shadow-2xl">
                <div className="absolute inset-0 opacity-10 bg-[url('https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&q=80&w=800')] bg-cover bg-center group-hover:scale-105 transition-transform duration-1000"></div>
                <div className="relative z-10 space-y-6 max-w-md">
                    <div className="w-20 h-20 bg-blue-600/20 backdrop-blur-xl rounded-3xl flex items-center justify-center mx-auto border border-blue-500/30 shadow-2xl shadow-blue-500/10 mb-2">
                        <AlertCircle size={40} className="text-blue-400" />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-2xl font-bold tracking-tight">External Resource</h3>
                        <p className="text-gray-400 text-sm leading-relaxed font-medium">
                            We found high-quality documentation for this milestone. Open it to start learning.
                        </p>
                    </div>
                    <button
                        onClick={() => window.open(initialPlaylistId, '_blank')}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold shadow-xl transition-all transform hover:-translate-y-1 active:scale-[0.98]"
                    >
                        Study on Official Platform
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col lg:flex-row bg-black overflow-hidden shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] border border-white/5 relative group w-full h-full">

            {/* Main Player Area */}
            <div className="flex-1 relative bg-black flex items-center justify-center">
                <YouTube
                    videoId={activeVId}
                    opts={opts}
                    onReady={onReady}
                    onStateChange={onStateChange}
                    className="w-full h-full flex items-center justify-center p-0 m-0"
                    iframeClassName="w-full h-full border-none"
                />

                {isSaving && (
                    <div className="absolute bottom-6 right-6 flex items-center gap-2 px-4 py-2 bg-black/60 backdrop-blur-xl rounded-xl text-[10px] font-black uppercase tracking-widest text-white border border-white/10 animate-fade-in z-20">
                        <Loader2 size={12} className="animate-spin text-green-400" />
                        Saving...
                    </div>
                )}
            </div>

            {/* Playlist Sidebar */}
            {videos.length > 0 && (
                <div className={`flex-none lg:w-[320px] bg-zinc-900 border-l border-white/5 flex flex-col h-auto lg:h-auto max-h-[500px] lg:max-h-none overflow-hidden transition-all duration-500 ${showPlaylist ? 'opacity-100' : 'opacity-0 lg:w-0 pointer-events-none'}`}>
                    <div className="p-4 border-b border-white/5 flex items-center justify-between bg-zinc-900/50 backdrop-blur-sm">
                        <div className="flex items-center gap-2">
                            <ListVideo size={16} className="text-green-500" />
                            <h4 className="text-[11px] font-black text-white/50 uppercase tracking-widest">Learning Path</h4>
                        </div>
                        <span className="text-[10px] font-bold text-white/30 px-2 py-0.5 bg-white/5 rounded-md">{videos.length} Videos</span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
                        {videos.map((video, idx) => {
                            const isActive = activeVId === video.video_id;
                            const isWatched = watchedVideos.has(video.video_id);
                            return (
                                <button
                                    key={video.video_id || idx}
                                    onClick={() => handleVideoSelect(video)}
                                    className={`w-full flex items-start gap-3 p-2.5 rounded-xl transition-all group/item text-left ${isActive ? 'bg-green-600/10 border border-green-500/20 shadow-lg' : 'hover:bg-white/5 border border-transparent'}`}
                                >
                                    <div className="relative w-20 aspect-video rounded-lg overflow-hidden shrink-0 bg-black/40 border border-white/5">
                                        <img src={video.thumbnail || `https://img.youtube.com/vi/${video.video_id}/mqdefault.jpg`} className={`w-full h-full object-cover transition-transform duration-700 group-hover/item:scale-110 ${isActive ? 'opacity-100' : isWatched ? 'opacity-60' : 'opacity-40'}`} alt="" />
                                        {isActive ? (
                                            <div className="absolute inset-0 flex items-center justify-center bg-green-600/20">
                                                <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-lg"><Play size={10} fill="currentColor" className="text-green-600 ml-0.5" /></div>
                                            </div>
                                        ) : isWatched ? (
                                            <div className="absolute inset-0 flex items-center justify-center bg-green-900/30">
                                                <CheckCircle2 size={16} className="text-green-400" />
                                            </div>
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/item:opacity-100 transition-opacity">
                                                <div className="w-6 h-6 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20"><Play size={10} fill="currentColor" className="text-white ml-0.5" /></div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0 py-0.5">
                                        <p className={`text-[11px] font-bold leading-tight line-clamp-2 transition-colors ${isActive ? 'text-green-400' : isWatched ? 'text-green-600/60' : 'text-zinc-400 group-hover/item:text-white'}`}>
                                            {video.title}
                                        </p>
                                        <div className="flex items-center gap-1.5 mt-1.5">
                                            <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">
                                                {isWatched ? '✓ Done' : `Step ${idx + 1}`}
                                            </span>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Playlist Toggle Button */}
            {videos.length > 0 && (
                <button
                    onClick={() => setShowPlaylist(!showPlaylist)}
                    className="absolute top-4 right-4 z-40 p-2.5 bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl text-white shadow-2xl hover:bg-black/80 hover:scale-105 transition-all active:scale-95"
                    title={showPlaylist ? "Hide Playlist" : "Show Playlist"}
                >
                    <ListVideo size={18} className={showPlaylist ? "text-green-500" : "text-white"} />
                </button>
            )}
        </div>
    );
}
