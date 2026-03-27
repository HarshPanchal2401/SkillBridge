'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import {
    Briefcase,
    MapPin,
    Clock,
    Building,
    ExternalLink,
    Search,
    AlertCircle,
    RefreshCw,
    Target,
    ArrowUpRight,
    Sparkles,
    Sliders,
    Filter,
    Award
} from 'lucide-react';

interface Job {
    id: string;
    title: string;
    company: string;
    location: string;
    description: string;
    posted_date: string;
    url: string;
    employment_type: string;
    source?: string;
    match_score?: number;
}

export default function JobsPage() {
    const { user, loading: authLoading, userId } = useAuth();
    const router = useRouter();
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [targetRole, setTargetRole] = useState<string>('');
    const [searchLocation, setSearchLocation] = useState<string>('');
    const [isSearching, setIsSearching] = useState(false);

    const [minMatch, setMinMatch] = useState<number>(0);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/');
        } else if (userId) {
            loadInitialRecommendations();
        }
    }, [user, authLoading, userId, router]);

    const loadInitialRecommendations = async (refresh: boolean = false) => {
        if (!userId) return;
        setLoading(true);
        setError(null);
        try {
            const result = await api.getJobRecommendations(userId, refresh);
            setJobs(result.jobs || []);
            setTargetRole(result.target_role || '');
            setSearchLocation(result.location || '');
        } catch (err: any) {
            console.error('Failed to load jobs:', err);
            setError(err.message || 'Failed to fetch job recommendations');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async (e?: React.FormEvent, refresh: boolean = true) => {
        if (e) e.preventDefault();
        if (!targetRole.trim()) return;

        setLoading(true);
        setError(null);
        setIsSearching(true);
        try {
            const result = await api.searchJobs(
                targetRole,
                searchLocation || 'United States',
                refresh,
                '',
                minMatch > 0 ? minMatch : undefined,
                userId?.toString()
            );
            setJobs(result.jobs || []);
        } catch (err: any) {
            console.error('Search failed:', err);
            setError(err.message || 'Failed to search jobs');
        } finally {
            setLoading(false);
            setIsSearching(false);
        }
    };

    if (authLoading) {
        return (
            <>
                <div className="flex flex-col items-center justify-center h-[70vh] space-y-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-green-500 border-t-transparent"></div>
                    <p className="text-gray-400 text-sm animate-pulse">Scanning market...</p>
                </div>
            </>
        );
    }

    if (!targetRole && !loading && !error) {
        return (
            <>
                <div className="max-w-xl mx-auto space-y-8 py-20 animate-fade-in text-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <Target className="text-gray-300" size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Set Your Target Role</h2>
                    <p className="text-gray-500 text-sm leading-relaxed">
                        We need to know your target role to find the best opportunities for you in the global repository.
                    </p>
                    <button
                        onClick={() => router.push('/profile')}
                        className="px-6 py-2.5 bg-gray-900 text-white rounded-xl font-bold text-[11px] uppercase tracking-widest hover:bg-gray-800 transition-all shadow-sm active:scale-95 inline-flex items-center gap-2"
                    >
                        Define Identity
                        <ArrowUpRight size={14} />
                    </button>
                </div>
            </>
        );
    }

    return (
        <>
            <div className="space-y-8 animate-fade-in">
                {/* Header & Search */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-green-50 text-green-700 rounded-lg text-[11px] font-bold uppercase tracking-wider mb-3">
                            <Briefcase size={12} />
                            Market Intelligence
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                            Available Roles
                        </h1>
                        <p className="text-gray-500 mt-1">
                            Opportunities tailored to your verified technical competencies.
                        </p>
                    </div>
                </div>

                {/* Unified Search Bar */}
                <div className="card-simple">
                    <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
                        <div className="flex-1 relative group bg-white border border-gray-100 rounded-2xl shadow-sm hover:border-green-400/50 transition-all">
                            <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-green-600 transition-colors" size={18} />
                            <input
                                type="text"
                                value={targetRole}
                                onChange={(e) => setTargetRole(e.target.value)}
                                placeholder="Job Title (e.g. Data Scientist)"
                                className="w-full pl-12 pr-4 py-4 bg-transparent rounded-2xl font-bold text-gray-900 placeholder:text-gray-300 outline-none transition-all text-[14px] uppercase tracking-tight"
                            />
                        </div>

                        <div className="flex-1 relative group bg-white border border-gray-100 rounded-2xl shadow-sm hover:border-green-400/50 transition-all">
                            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-green-600 transition-colors" size={18} />
                            <input
                                type="text"
                                value={searchLocation}
                                onChange={(e) => setSearchLocation(e.target.value)}
                                placeholder="Location (e.g. Remote)"
                                className="w-full pl-12 pr-4 py-4 bg-transparent rounded-2xl font-bold text-gray-900 placeholder:text-gray-300 outline-none transition-all text-[14px] uppercase tracking-tight"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !targetRole}
                            className="px-8 py-3.5 bg-[#047857] text-white rounded-xl font-bold uppercase tracking-widest text-[11px] hover:bg-[#059669] transition-all shadow-lg shadow-emerald-900/10 active:scale-95 disabled:opacity-50 min-w-[140px] flex items-center justify-center gap-2"
                        >
                            {loading ? <RefreshCw className="animate-spin" size={16} /> : <Search size={16} />}
                            Sync Roles
                        </button>
                    </form>
                </div>


                {error && (
                    <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-700 animate-slide-down">
                        <AlertCircle size={18} />
                        <span className="text-sm font-bold">{error}</span>
                    </div>
                )}

                {/* Job Grid */}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {jobs.map((job) => (
                        <div key={job.id} className="glass-card p-6 flex flex-col group hover:border-green-100 transition-all">
                            <div className="flex-1">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:text-green-600 group-hover:bg-green-50 transition-colors">
                                        <Building size={20} />
                                    </div>
                                    <div className="flex gap-2">
                                        {job.source && (
                                            <span className="text-[9px] font-bold uppercase tracking-widest text-green-600 bg-green-50 px-2 py-0.5 rounded-lg border border-green-100">
                                                {job.source}
                                            </span>
                                        )}
                                        <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400 bg-gray-50 px-2 py-0.5 rounded-lg group-hover:bg-green-50 group-hover:text-green-600 transition-colors border border-transparent group-hover:border-green-100">
                                            {job.employment_type || 'Full-time'}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 mb-2">
                                    <h3 className="text-lg font-black text-gray-900 leading-tight line-clamp-2 flex-1 uppercase tracking-tight">
                                        {job.title}
                                    </h3>
                                    {job.match_score !== undefined && job.match_score > 0 && (
                                        <div className="flex flex-col items-center">
                                            <div className="text-[10px] font-black text-green-600 bg-green-50 px-2 py-1 rounded-lg border border-green-100 flex items-center gap-1 uppercase tracking-widest">
                                                <Award size={10} />
                                                {Math.round(job.match_score)}%
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="inline-block px-3 py-1 bg-green-50 text-green-600 rounded-lg border border-green-100/50 mb-6">
                                    <p className="text-[10px] font-black uppercase tracking-widest">{job.company}</p>
                                </div>

                                <div className="space-y-2.5">
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                        <MapPin size={14} className="opacity-50 text-green-600" />
                                        {job.location}
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                        <Clock size={14} className="opacity-50 text-green-600" />
                                        Posted {job.posted_date}
                                    </div>
                                </div>
                            </div>

                            <a
                                href={job.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-8 py-3.5 bg-[#047857] text-white hover:bg-[#059669] rounded-xl font-black text-[10px] uppercase tracking-[0.2em] text-center transition-all flex items-center justify-center gap-3 shadow-lg shadow-emerald-900/10 active:scale-95"
                            >
                                Apply Now
                                <ExternalLink size={14} />
                            </a>
                        </div>
                    ))}

                    {jobs.length === 0 && !loading && !error && (
                        <div className="col-span-full py-20 text-center">
                            <Search size={40} className="mx-auto mb-4 text-gray-100" />
                            <p className="text-xs font-bold text-gray-300 uppercase tracking-widest">Inert Signal Area</p>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
