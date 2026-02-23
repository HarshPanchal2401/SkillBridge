'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface User {
    name: string;
    email: string;
    // Extended properties for profile
    id?: string;
    education?: string;
    university?: string;
    location?: string;
    target_role?: string;
    github_url?: string;
    linkedin_url?: string;
    has_resume?: boolean;
    resume_filename?: string;
}

interface Profile {
    profile_completion: number;
    total_skills?: number;
    total_projects?: number;
    total_courses?: number;
}

interface AuthContextType {
    user: User | null;
    profile: Profile | null;
    loading: boolean;
    userId: string | null;
    login: (email: string) => Promise<void>;
    logout: () => void;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        // Check for existing session
        const storedUser = localStorage.getItem('user');
        const storedProfile = localStorage.getItem('profile');

        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
        if (storedProfile) {
            setProfile(JSON.parse(storedProfile));
        }

        // Validate user session with backend
        refreshUser().finally(() => {
            setLoading(false);
        });
    }, []);

    const login = async (email: string) => {
        const name = email.split('@')[0];

        try {
            let userData;

            // First try to find existing user by email
            const searchRes = await fetch(`${API_BASE_URL}/api/users?search=${encodeURIComponent(email)}`);

            if (searchRes.ok) {
                const users = await searchRes.json();
                // users is an array directly from backend
                if (Array.isArray(users) && users.length > 0) {
                    // Find exact email match
                    userData = users.find((u: any) => u.email === email);
                }
            }

            // If no user found, register a new one
            if (!userData) {
                const registerRes = await fetch(`${API_BASE_URL}/api/users/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email })
                });

                if (registerRes.ok) {
                    userData = await registerRes.json();
                } else {
                    // If registration fails (e.g., email exists), try to get by search again
                    const errorData = await registerRes.json().catch(() => ({}));
                    if (errorData.error_code === 'DUPLICATE_RESOURCE') {
                        // User exists, search again
                        const retryRes = await fetch(`${API_BASE_URL}/api/users?search=${encodeURIComponent(email)}`);
                        if (retryRes.ok) {
                            const retryUsers = await retryRes.json();
                            if (Array.isArray(retryUsers) && retryUsers.length > 0) {
                                userData = retryUsers.find((u: any) => u.email === email);
                            }
                        }
                    }

                    if (!userData) {
                        throw new Error(errorData.message || 'Failed to create user');
                    }
                }
            }

            const newUser: User = {
                id: String(userData.id),
                name: userData.name || name,
                email: userData.email || email,
                education: userData.education || '',
                university: userData.university || '',
                location: userData.location || '',
                target_role: userData.target_role || '',
                github_url: userData.github_url || '',
                linkedin_url: userData.linkedin_url || '',
                has_resume: userData.has_resume || !!(userData.resume_path || userData.resume_text),
                resume_filename: userData.resume_filename || '',
            };

            const newProfile: Profile = {
                profile_completion: 0,
                total_skills: 0,
                total_projects: 0,
                total_courses: 0
            };

            setUser(newUser);
            setProfile(newProfile);

            localStorage.setItem('user', JSON.stringify(newUser));
            localStorage.setItem('profile', JSON.stringify(newProfile));
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    };

    const logout = () => {
        setUser(null);
        setProfile(null);
        localStorage.removeItem('user');
        localStorage.removeItem('profile');
        router.push('/login');
    };

    const refreshUser = async () => {
        const storedUser = localStorage.getItem('user');
        if (!storedUser) return;

        const parsedUser = JSON.parse(storedUser);
        if (!parsedUser.id) return;

        try {
            const res = await fetch(`${API_BASE_URL}/api/users/${parsedUser.id}`);
            if (res.ok) {
                const userData = await res.json();

                const updatedUser: User = {
                    id: String(userData.id),
                    name: userData.name || parsedUser.name,
                    email: userData.email || parsedUser.email,
                    education: userData.education || '',
                    university: userData.university || '',
                    location: userData.location || '',
                    target_role: userData.target_role || '',
                    github_url: userData.github_url || '',
                    linkedin_url: userData.linkedin_url || '',
                    has_resume: userData.has_resume || !!(userData.resume_path || userData.resume_text),
                    resume_filename: userData.resume_filename || '',
                };

                setUser(updatedUser);
                localStorage.setItem('user', JSON.stringify(updatedUser));

                // Try to get full profile stats
                try {
                    const profileRes = await fetch(`${API_BASE_URL}/api/users/${parsedUser.id}/profile`);
                    if (profileRes.ok) {
                        const profileData = await profileRes.json();
                        const updatedProfile: Profile = {
                            profile_completion: profileData.profile_completion || 0,
                            total_skills: profileData.total_skills || 0,
                            total_projects: profileData.total_projects || 0,
                            total_courses: profileData.total_courses || 0
                        };
                        setProfile(updatedProfile);
                        localStorage.setItem('profile', JSON.stringify(updatedProfile));
                    }
                } catch (e) {
                    // Ignore profile fetch errors
                }
            } else if (res.status === 404) {
                // If user doesn't exist anymore (e.g. DB reset), log them out
                console.warn('Session user not found in database, logging out...');
                logout();
            }
        } catch (error) {
            console.error('Failed to refresh user:', error);
        }
    };

    return (
        <AuthContext.Provider value={{ user, profile, loading, userId: user?.id || null, login, logout, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
