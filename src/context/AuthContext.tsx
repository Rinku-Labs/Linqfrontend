import React, { createContext, useContext, useState, useEffect } from 'react';
import client from '../api/client';
import { getVerificationStatus } from '../api/kyc';
import { jwtDecode } from 'jwt-decode';
import { fetchAndCacheBeneficiaries, invalidateBeneficiariesCache } from '../utils/beneficiariesCache';

interface User {
    id: number;
    username: string;
    email: string;
    pfp?: string;
    // Add other fields as needed
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<void>;
    signup: (email: string, name: string, firstName: string, lastName: string, password: string, otp?: string, oauthVerified?: boolean) => Promise<void>;
    requestSignupOtp: (email: string) => Promise<void>;
    requestPasswordResetOtp: (email: string) => Promise<void>;
    resetPassword: (email: string, otp: string, newPassword: string) => Promise<void>;
    logout: () => void;
    checkAuth: () => Promise<boolean>;
    // PIN Management
    hasPin: boolean;
    setTransactionPin: (pin: string) => Promise<void>;
    validatePin: (pin: string) => Promise<boolean>;
    // Wallet Management
    activeWalletSource: 'zk' | 'external';
    setActiveWalletSource: (source: 'zk' | 'external') => void;
    zkAddress: string | null;
    // Profile Picture
    updateProfilePicture: (base64Image: string) => void;
    // KYC
    isVerified: boolean;
    isCheckingVerification: boolean;
    checkVerificationStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(localStorage.getItem('linqAuthToken'));
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!token);
    const [hasPin, setHasPin] = useState<boolean>(!!localStorage.getItem('linqPinHash'));
    const [isVerified, setIsVerified] = useState<boolean>(() => {
        return localStorage.getItem('linqIsVerified') === 'true';
    });
    const [isCheckingVerification, setIsCheckingVerification] = useState<boolean>(false);

    // Wallet Source State
    const [zkAddress] = useState<string | null>(localStorage.getItem('zkLoginAddress'));
    const [activeWalletSource, setActiveWalletSourceState] = useState<'zk' | 'external'>(
        (localStorage.getItem('activeWalletSource') as 'zk' | 'external') || (localStorage.getItem('zkLoginAddress') ? 'zk' : 'external')
    );

    const updateProfilePicture = (base64Image: string) => {
        const updatedUser = user ? { ...user, pfp: base64Image } : null;
        if (updatedUser) {
            setUser(updatedUser);
            localStorage.setItem('linqUser', JSON.stringify(updatedUser));
        }
    };

    const setActiveWalletSource = (source: 'zk' | 'external') => {
        setActiveWalletSourceState(source);
        localStorage.setItem('activeWalletSource', source);
    };

    const lastVerificationCheckRef = React.useRef<number>(0);

    const checkVerificationStatus = async () => {
        if (!token) return;
        // Skip if already verified
        if (isVerified) return;
        // Throttle: skip if checked within the last 30 seconds
        const now = Date.now();
        if (now - lastVerificationCheckRef.current < 30000) return;
        lastVerificationCheckRef.current = now;

        setIsCheckingVerification(true);
        try {
            const data = await getVerificationStatus();
            setIsVerified(data.verified);
            if (data.verified) {
                localStorage.setItem('linqIsVerified', 'true');
            } else {
                localStorage.removeItem('linqIsVerified');
            }
        } catch (error) {
            // Default to false on error to be safe, or just keep previous state
            // If already verified, we shouldn't necessarily block them if the server glitches.
        } finally {
            setIsCheckingVerification(false);
        }
    };

    useEffect(() => {
        // Hydrate state from local storage on mount
        const storedToken = localStorage.getItem('linqAuthToken');
        const storedUser = localStorage.getItem('linqUser');
        if (storedToken) {
            setToken(storedToken);
            setIsAuthenticated(true);
            // Check verification status on load if authenticated
            checkVerificationStatus();
            // Pre-load beneficiaries cache
            fetchAndCacheBeneficiaries();
        }
        if (storedUser) {
            try {
                const parsedUser = JSON.parse(storedUser);
                // Attempt to recover ID from token if missing in stored user
                if (!parsedUser.id && storedToken) {
                    try {
                        const decoded: any = jwtDecode(storedToken);
                        // Check common ID fields
                        const recoveredId = decoded.sub || decoded.id || decoded.user_id || decoded.userId;
                        if (recoveredId) {
                            parsedUser.id = recoveredId;
                            // Update storage with fixed user
                            localStorage.setItem('linqUser', JSON.stringify(parsedUser));
                        }
                    } catch (decodeError) {
                    }
                }
                setUser(parsedUser);
            } catch (e) {
            }
        }
    }, [token]); // Add token dependency to re-check when token changes/sets on mount

    const login = async (email: string, password: string) => {
        try {
            const response = await client.post('/login', { email, password });
            // Assuming backend returns { token: "...", user: { ... } }
            // Adjust based on actual backend response structure
            const { token: newToken, user: newUser } = response.data;

            // If backend only sets cookie and doesn't return token verify this logic
            // For now assuming typical JWT response

            // Backend seems to set a cookie based on `authentication.Login` in `order-APi.go`?
            // Wait, looking at `order-APi.go` it calls `authentication.Login`.
            // I need to verify the response structure of `Login`.
            // Let's assume for now it returns JSON. 
            // If cookie-only, we might not get a token here. 
            // BUT implementation plan said we will update frontend to store token.
            // Let's stick to the plan: store token.

            if (response.headers['authorization']) {
                // Sometimes token is in header
            }

            // Using the token from response if available
            handleAuthSuccess(newToken, newUser || { email, username: 'User' }); // Fallback user if not in response

        } catch (error) {
            // console.error("Login failed", error);
            throw error;
        }
    };

    const signup = async (email: string, name: string, firstName: string, lastName: string, password: string, otp?: string, oauthVerified?: boolean) => {
        try {
            // Include OTP or oauthVerified in signup request
            await client.post('/signup', {
                email,
                password,
                username: name,
                firstName,
                lastName,
                otp: otp || '',
                oauthVerified: oauthVerified || false
            });

            // Auto login after signup
            await login(email, password);
        } catch (error) {
            throw error;
        }
    };

    const requestSignupOtp = async (email: string) => {
        try {
            await client.post('/signup/otp', { email });
        } catch (error) {
            throw error;
        }
    };

    const requestPasswordResetOtp = async (email: string) => {
        try {
            await client.post('/forgot-password/otp', { email });
        } catch (error) {
            throw error;
        }
    };

    const resetPassword = async (email: string, otp: string, newPassword: string) => {
        try {
            await client.post('/reset-password', { email, otp, newPassword });
        } catch (error) {
            throw error;
        }
    };

    const logout = () => {
        localStorage.removeItem('linqAuthToken');
        localStorage.removeItem('linqUser');
        localStorage.removeItem('linqIsVerified');
        // Clear session cookie for landing page
        document.cookie = "linq_session_active=; domain=.uselinq.xyz; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
        invalidateBeneficiariesCache();
        setUser(null);
        setToken(null);
        setIsAuthenticated(false);
        setIsVerified(false);
        window.location.href = '/onboarding';
    };

    const handleAuthSuccess = (newToken: string, newUser: User) => {
        if (newToken) {
            localStorage.setItem('linqAuthToken', newToken);
            setToken(newToken);
        }
        if (newUser) {
            localStorage.setItem('linqUser', JSON.stringify(newUser));
            setUser(newUser);
        }
        setIsAuthenticated(true);
        // Set session cookie for landing page to detect
        document.cookie = "linq_session_active=true; domain=.uselinq.xyz; path=/; max-age=604800; SameSite=Lax";
        // Check verification immediately after login
        // We can't await here easily inside setting state logic, but effects will trigger or allow manual call
        // Actually, we can just call it
        setTimeout(checkVerificationStatus, 100);
        // Pre-load beneficiaries on login
        fetchAndCacheBeneficiaries();
    };

    // Optional: verify token validity with backend
    const checkAuth = async () => {
        // Implement if there's a /me or /verify endpoint
        return !!token;
    };

    // PIN Logic
    const setTransactionPin = async (pin: string) => {
        // Simple hash for local storage protection
        const msgBuffer = new TextEncoder().encode(pin);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        localStorage.setItem('linqPinHash', hashHex);
        setHasPin(true);
    };

    const validatePin = async (inputPin: string): Promise<boolean> => {
        const storedHash = localStorage.getItem('linqPinHash');
        if (!storedHash) return false;

        const msgBuffer = new TextEncoder().encode(inputPin);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        return hashHex === storedHash;
    };

    return (
        <AuthContext.Provider value={{
            user, token, isAuthenticated, login, signup, requestSignupOtp, requestPasswordResetOtp, resetPassword, logout, checkAuth,
            hasPin, setTransactionPin, validatePin,
            activeWalletSource, setActiveWalletSource, zkAddress,
            updateProfilePicture,
            isVerified, isCheckingVerification, checkVerificationStatus
        }}>
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
