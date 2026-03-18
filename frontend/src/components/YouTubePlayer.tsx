'use client';

import { useState, useEffect, useRef } from 'react';
import YouTube, { YouTubeProps } from 'react-youtube';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Loader2, AlertCircle } from 'lucide-react';

interface YouTubePlayerProps {
    videoId: string;
    playlistId?: string;
    userId: number | string;
    milestoneId: string;
    initialTime?: number;
    onProgressUpdate?: (percent: number) => void;
}

export default function YouTubePlayer({
    videoId: initialVideoId,
    playlistId: initialPlaylistId,
    userId,
    milestoneId,
    initialTime = 0,
    onProgressUpdate
}: YouTubePlayerProps) {
    const [player, setPlayer] = useState<any>(null);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(initialTime);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Helper to extract ID from various YouTube URL formats
    const getIds = () => {
        let vId = initialVideoId;
        let pId = initialPlaylistId;

        const parseUrl = (str: string) => {
            if (!str) return { v: null, p: null };
            try {
                const url = new URL(str);
                let v = url.searchParams.get('v');
                const p = url.searchParams.get('list');

                // Handle youtu.be/VIDEO_ID
                if (!v && url.hostname === 'youtu.be') {
                    v = url.pathname.slice(1);
                }

                return { v, p };
            } catch {
                return { v: str.length === 11 ? str : null, p: str.length > 11 ? str : null };
            }
        };

        const fromVideo = parseUrl(initialVideoId);
        const fromPlaylist = parseUrl(initialPlaylistId || '');

        vId = fromVideo.v || fromPlaylist.v || (initialVideoId?.length === 11 ? initialVideoId : '');
        pId = fromPlaylist.p || fromVideo.p || (initialPlaylistId?.includes('PL') ? initialPlaylistId : '');

        return { vId, pId };
    };

    const { vId, pId } = getIds();

    const [activeVId, setActiveVId] = useState<string | null>(vId);

    // Sync progress to backend
    const syncWithVId = async (time: number, force = false, currentVId?: string) => {
        const targetVId = currentVId || activeVId || vId;
        if (!userId || !milestoneId || !targetVId) return;

        try {
            setIsSaving(true);
            // Roadmap feature removed - progress sync disabled
            if (onProgressUpdate && duration > 0) {
                onProgressUpdate(Math.min(100, Math.round((time / duration) * 100)));
            }
        } catch (err) {
            console.error('Failed to sync progress:', err);
        } finally {
            setIsSaving(false);
        }
    };

    // Set up periodic sync
    useEffect(() => {
        if (player) {
            syncIntervalRef.current = setInterval(() => {
                const time = player.getCurrentTime();
                const v = player.getVideoData()?.video_id;
                if (v && v !== activeVId) setActiveVId(v);
                setCurrentTime(time);
                syncWithVId(time, false, v);
            }, 30000);
        }

        return () => {
            if (syncIntervalRef.current) {
                clearInterval(syncIntervalRef.current);
            }
        };
    }, [player, duration, activeVId, vId]);

    const onReady: YouTubeProps['onReady'] = (event) => {
        setPlayer(event.target);
        setDuration(event.target.getDuration());
        const v = event.target.getVideoData()?.video_id;
        if (v) setActiveVId(v);

        if (initialTime > 0) {
            event.target.seekTo(initialTime, true);
        }
    };

    const onStateChange: YouTubeProps['onStateChange'] = (event) => {
        const v = event.target.getVideoData()?.video_id;
        if (v && v !== activeVId) setActiveVId(v);

        if (event.data === 0) {
            syncWithVId(duration, true, v);
        } else if (event.data === 2) {
            syncWithVId(event.target.getCurrentTime(), false, v);
        }
    };

    const opts: YouTubeProps['opts'] = {
        height: '390',
        width: '100%',
        playerVars: {
            autoplay: 0,
            modestbranding: 1,
            rel: 0,
            listType: !vId && pId ? 'playlist' : undefined,
            list: !vId && pId ? pId : undefined,
        },
    };

    const isYouTubeUrl = (url: string) => {
        return url.includes('youtube.com') || url.includes('youtu.be');
    };

    const isExternalLink = !vId && !pId && initialPlaylistId && !isYouTubeUrl(initialPlaylistId);

    if (isExternalLink) {
        return (
            <div className="flex flex-col items-center justify-center h-[390px] bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl border border-white/10 text-white p-8 text-center relative overflow-hidden group">
                <div className="absolute inset-0 opacity-10 bg-[url('https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&q=80&w=800')] bg-cover bg-center group-hover:scale-110 transition-transform duration-700"></div>
                <div className="relative z-10 space-y-6 max-w-md">
                    <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-blue-500/20">
                        <AlertCircle size={32} />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-xl font-bold">External Learning Resource</h3>
                        <p className="text-gray-400 text-sm leading-relaxed">
                            We found high-quality documentation for this milestone on an external platform.
                            Click below to open and study the material.
                        </p>
                    </div>
                    <button
                        onClick={() => {
                            window.open(initialPlaylistId, '_blank');
                            syncWithVId(100, true, 'external_link'); // Mark as completed when clicked
                        }}
                        className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg transition-all transform hover:-translate-y-1"
                    >
                        Study on Official Platform
                    </button>
                    <p className="text-[10px] font-mono text-gray-500 truncate opacity-40">
                        {initialPlaylistId}
                    </p>
                </div>
            </div>
        );
    }

    if (!vId && !pId) {
        return (
            <div className="flex flex-col items-center justify-center h-[390px] bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 text-gray-400 p-8 text-center">
                <AlertCircle size={48} className="mb-4 opacity-20" />
                <h3 className="text-lg font-bold text-gray-900 mb-2">No Video Content Found</h3>
                <p className="text-sm max-w-[280px]">We couldn't find a direct video or playlist. Try searching manually or check the official documentation.</p>
                <button
                    onClick={() => window.open(`https://www.google.com/search?q=${milestoneId} tutorial`, '_blank')}
                    className="mt-6 px-6 py-2 bg-gray-900 text-white rounded-xl font-bold text-xs uppercase"
                >
                    Search Google
                </button>
            </div>
        );
    }

    return (
        <div className="relative group rounded-2xl overflow-hidden shadow-2xl bg-black">
            <YouTube
                videoId={vId || undefined}
                opts={opts}
                onReady={onReady}
                onStateChange={onStateChange}
                className="aspect-video w-full"
            />

            {isSaving && (
                <div className="absolute bottom-4 right-4 flex items-center gap-2 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-lg text-[10px] font-bold text-white border border-white/10 animate-fade-in">
                    <Loader2 size={12} className="animate-spin text-green-400" />
                    SYNCING PROGRESS...
                </div>
            )}

            {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white p-6 text-center">
                    <div className="space-y-4">
                        <AlertCircle size={32} className="mx-auto text-red-500" />
                        <p className="text-sm font-medium">{error}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
