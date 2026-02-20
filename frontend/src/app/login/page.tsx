'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { Mail, AlertCircle, Sparkles, ArrowRight, RefreshCw } from 'lucide-react';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login, user, loading: authLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!authLoading && user) {
            router.push('/dashboard');
        }
    }, [user, authLoading, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!email.trim()) {
            setError('Please enter your email');
            return;
        }

        setLoading(true);

        try {
            await login(email.trim());
            router.push('/dashboard');
        } catch (err: any) {
            setError(err.message || 'Login failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-green-500 border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center p-6 animate-fade-in">
            <div className="w-full max-w-md space-y-8">
                {/* Logo */}
                <div className="text-center">
                    <Link href="/" className="inline-flex items-center gap-2 group">
                        <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                            <Sparkles className="text-white" size={20} />
                        </div>
                        <span className="text-2xl font-bold text-gray-900 tracking-tight">SkillBridge</span>
                    </Link>
                </div>

                {/* Form Card */}
                <div className="bg-white border border-gray-100 rounded-[2rem] p-8 md:p-10 shadow-sm border-b-4 border-b-green-500">
                    <div className="text-center mb-8">
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Welcome Back</h1>
                        <p className="text-gray-400 text-sm mt-1">Access your professional repository</p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-700">
                            <AlertCircle size={18} className="shrink-0 mt-0.5" />
                            <div className="text-xs font-bold leading-relaxed">
                                <p>{error}</p>
                                {error.includes('No account found') && (
                                    <Link href="/register" className="block mt-1 text-green-600 hover:text-green-700 underline">
                                        Create a new account
                                    </Link>
                                )}
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Email Address</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-transparent focus:border-green-500 focus:bg-white rounded-xl text-sm font-bold text-gray-900 placeholder:text-gray-300 outline-none transition-all"
                                    placeholder="your@email.com"
                                    required
                                    autoFocus
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 bg-gray-900 text-white rounded-xl font-bold text-xs uppercase tracking-[0.2em] hover:bg-gray-800 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {loading ? (
                                <RefreshCw className="animate-spin" size={18} />
                            ) : (
                                <>
                                    Enter Dashboard
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 text-center">
                        <p className="text-gray-400 text-xs font-medium">
                            Don&apos;t have an account?{' '}
                            <Link href="/register" className="text-green-600 hover:text-green-700 font-bold ml-1">
                                Create Identity
                            </Link>
                        </p>
                    </div>

                    {/* Helper Note */}
                    <div className="mt-10 p-4 bg-blue-50/50 border border-blue-100 rounded-xl">
                        <p className="text-blue-600 text-[10px] font-bold text-center leading-relaxed">
                            💡 NO PASSWORD REQUIRED. ENTER YOUR EMAIL TO GENERATE A SECURE SESSION LINK.
                        </p>
                    </div>
                </div>

                <div className="text-center">
                    <p className="text-gray-400 text-[10px] uppercase tracking-widest font-bold">
                        &copy; 2026 SkillBridge Intelligence Systems
                    </p>
                </div>
            </div>
        </div>
    );
}
