import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import logo from '../assets/logo.png';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import TermsModal from '../components/TermsModal';
import { useAuth } from '../context/AuthContext';

import { getGoogleLoginUrl, parseGoogleToken, computeGoogleAddress, derivePasswordFromSub } from '../utils/zkLogin';

type ViewType = 'welcome' | 'signup' | 'signin' | 'forgot';

export default function Onboarding() {
    const navigate = useNavigate();
    const location = useLocation();
    const { login, signup, requestSignupOtp, requestPasswordResetOtp, resetPassword, isAuthenticated } = useAuth();
    const [view, setView] = useState<ViewType>('welcome');

    // Redirect if already authenticated
    useEffect(() => {
        if (isAuthenticated) {
            navigate('/', { replace: true });
        }
    }, [isAuthenticated, navigate]);

    // Form states
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [password, setPassword] = useState('');
    const [signupConfirmPassword, setSignupConfirmPassword] = useState('');

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const [showTermsModal, setShowTermsModal] = useState(false);

    // OTP states
    const [otp, setOtp] = useState('');
    const [isOtpSent, setIsOtpSent] = useState(false);
    const [isRequestingOtp, setIsRequestingOtp] = useState(false);

    // Forgot password states
    const [resetEmail, setResetEmail] = useState('');
    const [resetOtp, setResetOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isResetOtpSent, setIsResetOtpSent] = useState(false);
    const [isRequestingResetOtp, setIsRequestingResetOtp] = useState(false);
    const [resetSuccess, setResetSuccess] = useState(false);

    // Check for Google Redirect
    useEffect(() => {
        const hash = location.hash; // Use router location consistently
        if (hash) {
            const params = new URLSearchParams(hash.substring(1)); // Remove #
            const idToken = params.get('id_token');
            if (idToken) {
                handleGoogleResponse(idToken);
                // Clean URL
                window.history.replaceState(null, '', window.location.pathname);
            }
        }
    }, [location]);

    const handleGoogleResponse = async (token: string) => {
        setIsLoading(true);
        try {
            const user = parseGoogleToken(token);
            if (!user) {
                setError("Failed to parse Google Account");
                return;
            }

            const derivedPassword = await derivePasswordFromSub(user.sub);
            const addr = await computeGoogleAddress(token);

            if (addr) {
                localStorage.setItem('zkLoginAddress', addr);
            }

            const intent = localStorage.getItem('auth_intent');
            if (intent === 'signin') {
                try {
                    await login(user.email, derivedPassword);
                    navigate('/');
                } catch (e: any) {
                    setError(e.response?.data?.message || "Google Sign In failed. Account might not exist.");
                }
            } else {
                // Default to signup or 'signup' intent
                const name = user.name || user.given_name || 'User';
                const splitName = name.split(' ');
                const fName = splitName[0] || 'User';
                const lName = splitName.slice(1).join(' ') || 'User';
                try {
                    await signup(user.email, name, fName, lName, derivedPassword, undefined, true); // OAuth verified
                    navigate('/');
                } catch (e: any) {
                    // If user already exists, try logging in
                    if (e.response?.data?.message?.includes('exist') || e.response?.status === 409) {
                        try {
                            await login(user.email, derivedPassword);
                            navigate('/');
                        } catch (loginErr: any) {
                            setError(loginErr.response?.data?.message || "Account exists but login failed.");
                        }
                    } else {
                        setError(e.response?.data?.message || "Google Sign Up failed");
                    }
                }
            }

        } catch (e: any) {
            setError(`Google Login Error: ${e.message || 'Unknown error'}`);
        } finally {
            setIsLoading(false);
            localStorage.removeItem('auth_intent');
        }
    };

    const handleRequestOtp = async () => {
        if (!email) {
            setError('Please enter your email first');
            return;
        }
        setIsRequestingOtp(true);
        setError('');
        try {
            await requestSignupOtp(email);
            setIsOtpSent(true);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to send OTP');
        } finally {
            setIsRequestingOtp(false);
        }
    };

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isOtpSent) {
            setError('Please request an OTP first');
            return;
        }
        if (!otp) {
            setError('Please enter the OTP');
            return;
        }

        if (password !== signupConfirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (!agreedToTerms) {
            setError('You must agree to the Terms and Conditions');
            return;
        }

        setIsLoading(true);
        setError('');
        try {
            await signup(email, username, firstName, lastName, password, otp);
            navigate('/');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to sign up');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleLogin = (intent: 'signup' | 'signin') => {
        localStorage.setItem('auth_intent', intent);
        window.location.href = getGoogleLoginUrl();
    };

    const handleRequestResetOtp = async () => {
        if (!resetEmail) {
            setError('Please enter your email first');
            return;
        }
        setIsRequestingResetOtp(true);
        setError('');
        try {
            await requestPasswordResetOtp(resetEmail);
            setIsResetOtpSent(true);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to send OTP');
        } finally {
            setIsRequestingResetOtp(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!resetOtp) {
            setError('Please enter the OTP');
            return;
        }
        if (newPassword.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            await resetPassword(resetEmail, resetOtp, newPassword);
            setResetSuccess(true);
            // Auto-redirect to sign in after 2 seconds
            setTimeout(() => {
                setView('signin');
                setResetSuccess(false);
                setResetEmail('');
                setResetOtp('');
                setNewPassword('');
                setConfirmPassword('');
                setIsResetOtpSent(false);
            }, 2000);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to reset password');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        try {
            await login(email, password);
            navigate('/');
        } catch (err: any) {
            // console.error(err);
            setError(err.response?.data?.message || 'Failed to sign in');
        } finally {
            setIsLoading(false);
        }
    };

    const containerStyle: React.CSSProperties = {
        maxWidth: '480px',
        margin: '0 auto',
        minHeight: '100vh',
        backgroundColor: 'var(--background)',
        display: 'flex',
        flexDirection: 'column',
        padding: 'clamp(20px, 5vw, 40px) clamp(16px, 4vw, 24px)',
        overflowY: 'auto' as any,
        width: '100%',
        transition: 'background-color 0.3s ease',
    };

    const cardStyle: React.CSSProperties = {
        background: 'var(--surface)',
        borderRadius: '24px',
        padding: '32px 24px',
        boxShadow: 'var(--card-shadow)',
        transition: 'background-color 0.3s ease, box-shadow 0.3s ease',
    };

    const logoContainerStyle: React.CSSProperties = {
        display: 'flex',
        justifyContent: 'center',
        marginBottom: '32px',
    };

    const logoStyle: React.CSSProperties = {
        width: '100px',
        height: '100px',
        borderRadius: '24px',
        objectFit: 'cover',
    };

    const titleStyle: React.CSSProperties = {
        fontSize: '20px',
        fontWeight: 700,
        textAlign: 'center',
        color: 'var(--text-main)',
        marginBottom: '8px',
    };

    const subtitleStyle: React.CSSProperties = {
        fontSize: '10px',
        color: 'var(--text-secondary)',
        textAlign: 'center',
        marginBottom: '32px',
    };

    const linkStyle: React.CSSProperties = {
        color: 'var(--primary)',
        fontWeight: 600,
        cursor: 'pointer',
        background: 'none',
        border: 'none',
        fontSize: '10px',
    };

    const errorStyle: React.CSSProperties = {
        color: 'red',
        fontSize: '10px',
        textAlign: 'center',
        marginBottom: '16px',
    };

    // Welcome View
    if (view === 'welcome') {
        return (
            <div style={containerStyle}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={logoContainerStyle}>
                        <img src={logo} alt="Linq Logo" style={logoStyle} className="glow-on-hover" />
                    </div>
                    {/* Status/Error Card for debugging */}
                    {isLoading && (
                        <div style={{ ...cardStyle, marginBottom: '16px', textAlign: 'center' }}>
                            <p>Verifying Google Account...</p>
                        </div>
                    )}
                    {error && !isLoading && (
                        <div style={{ ...cardStyle, marginBottom: '16px', textAlign: 'center' }}>
                            <p style={errorStyle}>{error}</p>
                        </div>
                    )}
                    <h1 style={titleStyle}>Welcome to Linq</h1>
                    <p style={subtitleStyle}>Your gateway to seamless crypto transfers</p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '24px' }}>
                        <Button
                            variant="primary"
                            fullWidth
                            onClick={() => setView('signup')}
                            style={{ borderRadius: '16px', height: '56px', fontSize: '13px' }}
                        >
                            Create Account
                        </Button>
                        <Button
                            variant="secondary"
                            fullWidth
                            onClick={() => handleGoogleLogin('signup')}
                            style={{ borderRadius: '16px', height: '56px', fontSize: '13px', display: 'flex', gap: '10px' }}
                        >
                            <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="G" style={{ width: '24px' }} />
                            Continue with Google
                        </Button>
                        <Button
                            variant="outline"
                            fullWidth
                            onClick={() => setView('signin')}
                            style={{ borderRadius: '16px', height: '56px', fontSize: '13px' }}
                        >
                            Sign In
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // Sign Up View
    if (view === 'signup') {
        return (
            <div style={containerStyle}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={logoContainerStyle}>
                        <img src={logo} alt="Linq Logo" style={{ ...logoStyle, width: '80px', height: '80px' }} className="glow-on-hover" />
                    </div>
                    <div style={cardStyle}>
                        <h2 style={{ ...titleStyle, fontSize: '17px', marginBottom: '24px' }}>Create Account</h2>
                        {error && <p style={errorStyle}>{error}</p>}

                        <Button
                            variant="secondary"
                            fullWidth
                            onClick={() => handleGoogleLogin('signup')}
                            style={{ borderRadius: '16px', height: '48px', fontSize: '11px', marginBottom: '24px', display: 'flex', gap: '10px' }}
                        >
                            <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="G" style={{ width: '20px' }} />
                            Sign Up with Google
                        </Button>

                        <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', color: 'var(--text-secondary)' }}>
                            <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
                            <span style={{ padding: '0 10px', fontSize: '9px' }}>OR</span>
                            <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
                        </div>

                        <form onSubmit={handleSignUp}>
                            <Input
                                label="Email"
                                type="email"
                                placeholder="Enter your email"
                                value={email}
                                onChange={(e) => {
                                    setEmail(e.target.value);
                                    if (isOtpSent) {
                                        setIsOtpSent(false);
                                        setOtp('');
                                    }
                                }}
                                required
                            />

                            {/* OTP Section */}
                            {!isOtpSent ? (
                                <Button
                                    type="button"
                                    variant="secondary"
                                    fullWidth
                                    onClick={handleRequestOtp}
                                    disabled={isRequestingOtp || !email}
                                    style={{ borderRadius: '16px', height: '48px', marginBottom: '16px' }}
                                >
                                    {isRequestingOtp ? 'Sending Code...' : 'Get Verification Code'}
                                </Button>
                            ) : (
                                <>
                                    <Input
                                        label="Verification Code"
                                        type="text"
                                        placeholder="Enter 6-digit code"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value)}
                                        required
                                        maxLength={6}
                                    />
                                    <button
                                        type="button"
                                        onClick={handleRequestOtp}
                                        disabled={isRequestingOtp}
                                        style={{
                                            ...linkStyle,
                                            marginBottom: '16px',
                                            display: 'block',
                                            opacity: isRequestingOtp ? 0.5 : 1
                                        }}
                                    >
                                        {isRequestingOtp ? 'Sending...' : 'Resend Code'}
                                    </button>

                                    <Input
                                        label="Username"
                                        type="text"
                                        placeholder="Enter your username"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        required
                                    />
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <div style={{ flex: 1 }}>
                                            <Input
                                                label="First Name"
                                                type="text"
                                                placeholder="First Name"
                                                value={firstName}
                                                onChange={(e) => setFirstName(e.target.value)}
                                                required
                                            />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <Input
                                                label="Last Name"
                                                type="text"
                                                placeholder="Last Name"
                                                value={lastName}
                                                onChange={(e) => setLastName(e.target.value)}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <Input
                                        label="Password"
                                        type="password"
                                        placeholder="Create a password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                    <Input
                                        label="Confirm Password"
                                        type="password"
                                        placeholder="Confirm your password"
                                        value={signupConfirmPassword}
                                        onChange={(e) => setSignupConfirmPassword(e.target.value)}
                                        required
                                    />

                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginTop: '16px', marginBottom: '8px' }}>
                                        <input
                                            type="checkbox"
                                            id="terms"
                                            checked={agreedToTerms}
                                            onChange={(e) => setAgreedToTerms(e.target.checked)}
                                            style={{ marginTop: '4px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                                        />
                                        <label htmlFor="terms" style={{ fontSize: '10px', color: 'var(--text-secondary)', lineHeight: '1.5', cursor: 'pointer' }}>
                                            I agree to the <button type="button" onClick={() => setShowTermsModal(true)} style={linkStyle}>Terms & Conditions</button> and <button type="button" onClick={() => navigate('/privacy-policy')} style={linkStyle}>Privacy Policy</button>
                                        </label>
                                    </div>

                                </>
                            )}

                            {isOtpSent && (
                                <Button
                                    type="submit"
                                    variant="primary"
                                    fullWidth
                                    disabled={isLoading}
                                    style={{ borderRadius: '16px', height: '56px', marginTop: '16px' }}
                                >
                                    {isLoading ? 'Creating Account...' : 'Sign Up'}
                                </Button>
                            )}
                        </form>
                        <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '10px', color: 'var(--text-secondary)' }}>
                            Already have an account?{' '}
                            <button style={linkStyle} onClick={() => setView('signin')}>
                                Sign In
                            </button>
                        </p>
                    </div>
                </div>
                <TermsModal 
                    isOpen={showTermsModal} 
                    onClose={() => setShowTermsModal(false)} 
                />
            </div>
        );
    }

    // Sign In View
    if (view === 'signin') {
        return (
            <div style={containerStyle}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={logoContainerStyle}>
                        <img src={logo} alt="Linq Logo" style={{ ...logoStyle, width: '80px', height: '80px' }} className="glow-on-hover" />
                    </div>
                    <div style={cardStyle}>
                        <h2 style={{ ...titleStyle, fontSize: '17px', marginBottom: '24px' }}>Welcome Back</h2>
                        {error && <p style={errorStyle}>{error}</p>}

                        <Button
                            variant="secondary"
                            fullWidth
                            onClick={() => handleGoogleLogin('signin')}
                            style={{ borderRadius: '16px', height: '48px', fontSize: '11px', marginBottom: '24px', display: 'flex', gap: '10px' }}
                        >
                            <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="G" style={{ width: '20px' }} />
                            Sign In with Google
                        </Button>

                        <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', color: 'var(--text-secondary)' }}>
                            <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
                            <span style={{ padding: '0 10px', fontSize: '9px' }}>OR</span>
                            <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
                        </div>

                        <form onSubmit={handleSignIn}>
                            <Input
                                label="Email"
                                type="email"
                                placeholder="Enter your email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                            <Input
                                label="Password"
                                type="password"
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            <Button
                                type="submit"
                                variant="primary"
                                fullWidth
                                disabled={isLoading}
                                style={{ borderRadius: '16px', height: '56px', marginTop: '16px' }}
                            >
                                {isLoading ? 'Signing In...' : 'Sign In'}
                            </Button>
                        </form>
                        <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '10px', color: 'var(--text-secondary)' }}>
                            Don't have an account?{' '}
                            <button style={linkStyle} onClick={() => setView('signup')}>
                                Create Account
                            </button>
                        </p>
                        <p style={{ textAlign: 'center', marginTop: '8px', fontSize: '10px', color: 'var(--text-secondary)' }}>
                            <button style={linkStyle} onClick={() => { setError(''); setView('forgot'); }}>
                                Forgot Password?
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Forgot Password View
    if (view === 'forgot') {
        return (
            <div style={containerStyle}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={logoContainerStyle}>
                        <img src={logo} alt="Linq Logo" style={{ ...logoStyle, width: '80px', height: '80px' }} className="glow-on-hover" />
                    </div>
                    <div style={cardStyle}>
                        <h2 style={{ ...titleStyle, fontSize: '17px', marginBottom: '8px' }}>Reset Password</h2>
                        <p style={subtitleStyle}>We'll send a verification code to your email</p>
                        {error && <p style={errorStyle}>{error}</p>}
                        {resetSuccess && (
                            <p style={{ color: '#4CAF50', fontSize: '10px', textAlign: 'center', marginBottom: '16px' }}>
                                Password reset successfully! Redirecting to sign in...
                            </p>
                        )}

                        <form onSubmit={handleResetPassword}>
                            <Input
                                label="Email"
                                type="email"
                                placeholder="Enter your email"
                                value={resetEmail}
                                onChange={(e) => {
                                    setResetEmail(e.target.value);
                                    if (isResetOtpSent) {
                                        setIsResetOtpSent(false);
                                        setResetOtp('');
                                    }
                                }}
                                required
                            />

                            {!isResetOtpSent ? (
                                <Button
                                    type="button"
                                    variant="secondary"
                                    fullWidth
                                    onClick={handleRequestResetOtp}
                                    disabled={isRequestingResetOtp || !resetEmail}
                                    style={{ borderRadius: '16px', height: '48px', marginBottom: '16px' }}
                                >
                                    {isRequestingResetOtp ? 'Sending Code...' : 'Send Verification Code'}
                                </Button>
                            ) : (
                                <>
                                    <Input
                                        label="Verification Code"
                                        type="text"
                                        placeholder="Enter 6-digit code"
                                        value={resetOtp}
                                        onChange={(e) => setResetOtp(e.target.value)}
                                        required
                                        maxLength={6}
                                    />
                                    <button
                                        type="button"
                                        onClick={handleRequestResetOtp}
                                        disabled={isRequestingResetOtp}
                                        style={{
                                            ...linkStyle,
                                            marginBottom: '16px',
                                            display: 'block',
                                            opacity: isRequestingResetOtp ? 0.5 : 1
                                        }}
                                    >
                                        {isRequestingResetOtp ? 'Sending...' : 'Resend Code'}
                                    </button>

                                    <Input
                                        label="New Password"
                                        type="password"
                                        placeholder="Enter new password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        required
                                    />
                                    <Input
                                        label="Confirm Password"
                                        type="password"
                                        placeholder="Confirm new password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                    />
                                </>
                            )}

                            {isResetOtpSent && (
                                <Button
                                    type="submit"
                                    variant="primary"
                                    fullWidth
                                    disabled={isLoading || resetSuccess}
                                    style={{ borderRadius: '16px', height: '56px', marginTop: '16px' }}
                                >
                                    {isLoading ? 'Resetting...' : 'Reset Password'}
                                </Button>
                            )}
                        </form>
                        <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '10px', color: 'var(--text-secondary)' }}>
                            Remember your password?{' '}
                            <button style={linkStyle} onClick={() => { setError(''); setView('signin'); }}>
                                Sign In
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        );
    }



    return null;
}
