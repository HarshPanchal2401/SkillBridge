'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { Mail, AlertCircle, Sparkles, ArrowRight } from 'lucide-react';

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
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-6">
            {/* Background decorations */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-green-500/20 rounded-full blur-3xl"></div>
                <div className="absolute bottom-20 -left-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl"></div>
            </div>

            <div className="relative w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <Link href="/" className="inline-flex items-center gap-2">
                        <div className="w-12 h-12 bg-gradient-to-r from-green-400 to-emerald-500 rounded-xl flex items-center justify-center">
                            <Sparkles className="text-white" size={28} />
                        </div>
                        <span className="text-3xl font-bold text-white">SkillPath</span>
                    </Link>
                </div>

                {/* Card */}
                <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700 rounded-2xl p-8">
                    <h1 className="text-2xl font-bold text-white text-center mb-2">Welcome Back</h1>
                    <p className="text-gray-400 text-center mb-8">Enter your email to continue</p>

                    {error && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3 text-red-400">
                            <AlertCircle size={20} className="shrink-0 mt-0.5" />
                            <div className="text-sm">
                                <p>{error}</p>
                                {error.includes('No account found') && (
                                    <Link href="/register" className="block mt-2 text-green-400 hover:text-green-300 font-medium">
                                        Create an account →
                                    </Link>
                                )}
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors"
                                    placeholder="you@example.com"
                                    required
                                    autoFocus
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-green-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    Signing in...
                                </>
                            ) : (
                                <>
                                    Continue
                                    <ArrowRight size={20} />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 text-center">
                        <p className="text-gray-400">
                            Don&apos;t have an account?{' '}
                            <Link href="/register" className="text-green-400 hover:text-green-300 font-medium">
                                Create one
                            </Link>
                        </p>
                    </div>

                    {/* Info note */}
                    <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                        <p className="text-blue-300 text-sm text-center">
                            💡 Simply enter the email you used to register. No password required.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
