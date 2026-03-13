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
    videoId,
    playlistId,
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

    // Sync progress to backend
    const syncProgress = async (time: number, force = false) => {
        if (!userId || !milestoneId || !videoId) return;

        try {
            setIsSaving(true);
            await api.syncRoadmapProgress({
                user_id: userId,
                milestone_id: milestoneId,
                youtube_playlist_id: playlistId,
                current_video_id: videoId,
                current_video_time: Math.floor(time),
                watched_duration_seconds: Math.floor(time), // Simplified for now
                total_duration_seconds: Math.floor(duration),
                status: force && (time / duration > 0.9) ? 'completed' : 'in_progress'
            });
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
                setCurrentTime(time);
                syncProgress(time);
            }, 30000); // Sync every 30 seconds
        }

        return () => {
            if (syncIntervalRef.current) {
                clearInterval(syncIntervalRef.current);
            }
        };
    }, [player, duration]);

    const onReady: YouTubeProps['onReady'] = (event) => {
        setPlayer(event.target);
        setDuration(event.target.getDuration());
        if (initialTime > 0) {
            event.target.seekTo(initialTime, true);
        }
    };

    const onStateChange: YouTubeProps['onStateChange'] = (event) => {
        // 0 = ended, 1 = playing, 2 = paused
        if (event.data === 0) {
            syncProgress(duration, true);
        } else if (event.data === 2) {
            syncProgress(event.target.getCurrentTime());
        }
    };

    const opts: YouTubeProps['opts'] = {
        height: '390',
        width: '100%',
        playerVars: {
            autoplay: 0,
            modestbranding: 1,
            rel: 0,
        },
    };

    if (!videoId) {
        return (
            <div className="flex flex-col items-center justify-center h-[390px] bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 text-gray-400">
                <AlertCircle size={48} className="mb-4 opacity-20" />
                <p className="text-sm font-medium">No video content found for this milestone</p>
            </div>
        );
    }

    return (
        <div className="relative group rounded-2xl overflow-hidden shadow-2xl bg-black">
            <YouTube
                videoId={videoId}
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
