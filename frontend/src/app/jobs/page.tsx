'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { MainLayout } from '@/components/layout/Sidebar';
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
    ArrowUpRight
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

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        } else if (userId) {
            loadInitialRecommendations();
        }
    }, [user, authLoading, userId]);

    const loadInitialRecommendations = async () => {
        if (!userId) return;
        setLoading(true);
        setError(null);
        try {
            const result = await api.getJobRecommendations(userId);
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

    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!targetRole.trim()) return;

        setLoading(true);
        setError(null);
        setIsSearching(true);
        try {
            const result = await api.searchJobs(targetRole, searchLocation || 'United States');
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
            <MainLayout>
                <div className="flex flex-col items-center justify-center h-[70vh] space-y-4">
                    <div className="relative">
                        <div className="w-16 h-16 border-4 border-emerald-100 rounded-full animate-pulse"></div>
                        <div className="absolute inset-0 w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                </div>
            </MainLayout>
        );
    }

    if (!targetRole && !loading && !error) {
        return (
            <MainLayout>
                <div className="max-w-4xl mx-auto space-y-12 py-12 px-4 animate-fade-in text-center">
                    <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Target className="text-gray-400" size={48} />
                    </div>
                    <h2 className="text-3xl font-black text-gray-900 tracking-tight">Set Your Sights</h2>
                    <p className="text-gray-500 max-w-xl mx-auto text-lg">
                        We need to know your target role to find the best opportunities for you.
                    </p>
                    <button
                        onClick={() => router.push('/profile')}
                        className="px-8 py-4 bg-gray-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-gray-800 transition-all shadow-xl active:scale-95 inline-flex items-center gap-2"
                    >
                        Update Profile
                        <ArrowUpRight size={16} />
                    </button>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="max-w-7xl mx-auto space-y-8 pb-12 animate-fade-in px-4 md:px-6">

                {/* Header & Search */}
                <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-gray-100 overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-50 rounded-full mix-blend-multiply filter blur-3xl opacity-40 -mr-20 -mt-20"></div>

                    <div className="relative z-10">
                        <div className="mb-8">
                            <h1 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight mb-2">
                                Find Your Next Role
                            </h1>
                            <p className="text-gray-500">
                                Discover opportunities tailored to your skills and ambition.
                            </p>
                        </div>

                        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
                            <div className="flex-1 relative group">
                                <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors" size={20} />
                                <input
                                    type="text"
                                    value={targetRole}
                                    onChange={(e) => setTargetRole(e.target.value)}
                                    placeholder="Job Title (e.g. Data Scientist)"
                                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-bold text-gray-700 placeholder:text-gray-400 placeholder:font-medium"
                                />
                            </div>

                            <div className="flex-1 relative group">
                                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors" size={20} />
                                <input
                                    type="text"
                                    value={searchLocation}
                                    onChange={(e) => setSearchLocation(e.target.value)}
                                    placeholder="Location (e.g. New York, Remote)"
                                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-bold text-gray-700 placeholder:text-gray-400 placeholder:font-medium"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading || !targetRole}
                                className="px-8 py-4 bg-gray-900 hover:bg-gray-800 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[140px]"
                            >
                                {loading ? (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <Search size={16} />
                                        Search
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>

                {error && (
                    <div className="p-6 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-4 text-red-800 animate-slide-down">
                        <AlertCircle size={24} />
                        <span className="font-bold">{error}</span>
                    </div>
                )}

                {/* Job Grid */}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {jobs.map((job) => (
                        <div key={job.id} className="group bg-white rounded-[2rem] border border-gray-100 hover:border-emerald-200 shadow-sm hover:shadow-2xl transition-all duration-300 flex flex-col h-full overflow-hidden">
                            <div className="p-8 flex-1">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-colors">
                                        <Building size={24} />
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">
                                        {job.employment_type || 'Full-time'}
                                    </span>
                                </div>

                                <h3 className="text-xl font-black text-gray-900 leading-tight mb-2 line-clamp-2">
                                    {job.title}
                                </h3>
                                <p className="text-sm font-bold text-gray-500 mb-6">{job.company}</p>

                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                                        <MapPin size={14} className="text-gray-300" />
                                        {job.location}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                                        <Clock size={14} className="text-gray-300" />
                                        Posted {job.posted_date}
                                    </div>
                                </div>
                            </div>

                            <a
                                href={job.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block m-2 p-4 bg-gray-900 text-white rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest text-center hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
                            >
                                Apply Now
                                <ExternalLink size={14} />
                            </a>
                        </div>
                    ))}

                    {jobs.length === 0 && !error && (
                        <div className="col-span-full py-20 text-center opacity-50">
                            <Search size={48} className="mx-auto mb-4 text-gray-300" />
                            <p className="font-bold text-gray-400">No active listings found for this role directly.</p>
                            <p className="text-sm text-gray-400 mt-2">Try updating your location or target role.</p>
                        </div>
                    )}
                </div>

            </div>
        </MainLayout>
    );
}
