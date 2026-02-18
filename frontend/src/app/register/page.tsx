'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { Mail, User, GraduationCap, Target, MapPin, AlertCircle, Sparkles, Building } from 'lucide-react';

export default function RegisterPage() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        education: '',
        university: '',
        graduation_year: new Date().getFullYear(),
        location: '',
        target_role: '',
        target_sector: 'healthcare',
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { register } = useAuth();
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!formData.name.trim() || !formData.email.trim()) {
            setError('Name and email are required');
            return;
        }

        setLoading(true);

        try {
            await register({
                name: formData.name.trim(),
                email: formData.email.trim(),
                education: formData.education.trim() || undefined,
                university: formData.university.trim() || undefined,
                graduation_year: formData.graduation_year || undefined,
                location: formData.location.trim() || undefined,
                target_role: formData.target_role.trim() || undefined,
                target_sector: formData.target_sector || 'healthcare',
            });
            router.push('/onboarding');
        } catch (err: any) {
            setError(err.message || 'Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const updateField = (field: string, value: string | number) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-6">
            {/* Background decorations */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-green-500/20 rounded-full blur-3xl"></div>
                <div className="absolute bottom-20 -left-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl"></div>
            </div>

            <div className="relative w-full max-w-lg">
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
                    <h1 className="text-2xl font-bold text-white text-center mb-2">Create Account</h1>
                    <p className="text-gray-400 text-center mb-8">Start your career journey in healthcare</p>

                    {error && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3 text-red-400">
                            <AlertCircle size={20} />
                            <span className="text-sm">{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Name & Email Row */}
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Full Name *</label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => updateField('name', e.target.value)}
                                        className="w-full pl-12 pr-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors"
                                        placeholder="John Doe"
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Email *</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => updateField('email', e.target.value)}
                                        className="w-full pl-12 pr-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors"
                                        placeholder="you@example.com"
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Education Row */}
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Education</label>
                                <div className="relative">
                                    <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                                    <input
                                        type="text"
                                        value={formData.education}
                                        onChange={(e) => updateField('education', e.target.value)}
                                        className="w-full pl-12 pr-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors"
                                        placeholder="B.Tech in Computer Science"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">University</label>
                                <div className="relative">
                                    <Building className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                                    <input
                                        type="text"
                                        value={formData.university}
                                        onChange={(e) => updateField('university', e.target.value)}
                                        className="w-full pl-12 pr-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors"
                                        placeholder="MIT"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Location & Target Role */}
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Location</label>
                                <div className="relative">
                                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                                    <input
                                        type="text"
                                        value={formData.location}
                                        onChange={(e) => updateField('location', e.target.value)}
                                        className="w-full pl-12 pr-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors"
                                        placeholder="New York, USA"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Target Role</label>
                                <div className="relative">
                                    <Target className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                                    <input
                                        type="text"
                                        value={formData.target_role}
                                        onChange={(e) => updateField('target_role', e.target.value)}
                                        className="w-full pl-12 pr-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors"
                                        placeholder="Healthcare Data Analyst"
                                    />
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-green-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    Creating account...
                                </span>
                            ) : (
                                'Create Account'
                            )}
                        </button>
                    </form>

                    <div className="mt-8 text-center">
                        <p className="text-gray-400">
                            Already have an account?{' '}
                            <Link href="/login" className="text-green-400 hover:text-green-300 font-medium">
                                Sign in
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
