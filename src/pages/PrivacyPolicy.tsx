import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';

export default function PrivacyPolicy() {
    const navigate = useNavigate();

    const sectionStyle: React.CSSProperties = {
        marginBottom: '28px',
    };

    const headingStyle: React.CSSProperties = {
        fontSize: '12px',
        fontWeight: 700,
        color: 'var(--text-main)',
        marginBottom: '10px',
        letterSpacing: '-0.01em',
    };

    const textStyle: React.CSSProperties = {
        fontSize: '10px',
        lineHeight: '1.7',
        color: 'var(--text-secondary)',
    };

    const listStyle: React.CSSProperties = {
        ...textStyle,
        paddingLeft: '20px',
        listStyleType: 'disc',
    };

    return (
        <div className="page-enter" style={{ maxWidth: '600px', margin: '0 auto', padding: '20px 16px 40px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '28px', position: 'relative' }}>
                <button
                    onClick={() => navigate(-1)}
                    style={{
                        background: 'var(--surface)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '12px',
                        width: '40px',
                        height: '40px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        position: 'relative',
                        zIndex: 1
                    }}
                >
                    <ArrowLeft size={20} color="var(--text-main)" />
                </button>
                <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    position: 'absolute',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none'
                }}>
                    <Shield size={22} color="var(--primary)" />
                    <h1 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
                        Privacy Policy
                    </h1>
                </div>
            </div>

            {/* Content Card */}
            <div className="glass-card" style={{ borderRadius: '24px', padding: '28px 24px' }}>
                <p style={{ ...textStyle, marginBottom: '24px', fontStyle: 'italic', opacity: 0.8 }}>
                    Last updated: February 11, 2026
                </p>

                {/* 1. Introduction */}
                <div style={sectionStyle}>
                    <h2 style={headingStyle}>1. Introduction</h2>
                    <p style={textStyle}>
                        Linq ("we", "our", "us") is a cross-chain cryptocurrency payment and transfer
                        platform operated by Rinku Technology Limited. This Privacy Policy describes
                        how we handle information when you use the Linq application. We are committed
                        to protecting your privacy and operating with a minimal-data philosophy —
                        we do not store personal data beyond what is strictly necessary for the
                        service to function.
                    </p>
                </div>

                {/* 2. Information We Collect */}
                <div style={sectionStyle}>
                    <h2 style={headingStyle}>2. Information We Collect</h2>
                    <p style={{ ...textStyle, marginBottom: '8px' }}>
                        We collect only the minimum information required to provide our services:
                    </p>
                    <ul style={listStyle}>
                        <li style={{ marginBottom: '6px' }}>
                            <strong>Account credentials</strong> — Email address and a securely hashed
                            password (SHA-256). We never store or have access to your plaintext password.
                        </li>
                        <li style={{ marginBottom: '6px' }}>
                            <strong>Wallet addresses</strong> — Public blockchain addresses you connect
                            (SUI, Solana, Aptos, BSC). These are public by nature and are used solely
                            to execute transactions you initiate.
                        </li>
                        <li style={{ marginBottom: '6px' }}>
                            <strong>Transaction records</strong> — Order IDs, amounts, status, and
                            blockchain transaction hashes for transactions you create through the
                            platform. These are required for order tracking and dispute resolution.
                        </li>
                        <li style={{ marginBottom: '6px' }}>
                            <strong>Information for Government Compliance (KYC)</strong> — To comply with
                            government regulations, we are required to collect your National Identification
                            Number (NIN) if you choose to verify your identity. This information is
                            securely processed and stored for regulatory compliance.
                        </li>
                    </ul>
                </div>

                {/* 3. Information We Do NOT Collect or Store */}
                <div style={sectionStyle}>
                    <h2 style={headingStyle}>3. Information We Do NOT Collect or Store</h2>
                    <ul style={listStyle}>
                        <li style={{ marginBottom: '6px' }}>Private keys or seed phrases</li>
                        <li style={{ marginBottom: '6px' }}>Plaintext passwords</li>
                        <li style={{ marginBottom: '6px' }}>Identity documents, photos, or biometric data</li>
                        <li style={{ marginBottom: '6px' }}>Browsing history or device fingerprints</li>
                        <li style={{ marginBottom: '6px' }}>Location data</li>
                        <li style={{ marginBottom: '6px' }}>
                            Analytics or tracking cookies — we use no third-party analytics
                        </li>
                    </ul>
                </div>

                {/* 4. How We Protect Your Data */}
                <div style={sectionStyle}>
                    <h2 style={headingStyle}>4. How We Protect Your Data</h2>
                    <ul style={listStyle}>
                        <li style={{ marginBottom: '6px' }}>
                            <strong>Password hashing</strong> — All passwords are hashed using SHA-256
                            before storage. We cannot reverse or read your password.
                        </li>
                        <li style={{ marginBottom: '6px' }}>
                            <strong>Encrypted transport</strong> — All communication between your
                            device and our servers is encrypted via TLS (HTTPS).
                        </li>
                        <li style={{ marginBottom: '6px' }}>
                            <strong>JWT authentication</strong> — Sessions are managed using
                            JSON Web Tokens with short expiry windows. Tokens are stored locally
                            on your device and are never shared with third parties.
                        </li>
                        <li style={{ marginBottom: '6px' }}>
                            <strong>Transaction PIN</strong> — An optional client-side transaction PIN
                            is hashed (SHA-256) and stored only on your device's local storage. It
                            never leaves your browser.
                        </li>
                        <li style={{ marginBottom: '6px' }}>
                            <strong>Wallet encryption</strong> — ZkLogin wallet keys are encrypted using
                            AES-256-GCM with keys derived from scrypt key derivation. Encrypted data
                            is stored server-side; decryption only occurs in memory during transactions.
                        </li>
                    </ul>
                </div>

                {/* 5. Local Storage */}
                <div style={sectionStyle}>
                    <h2 style={headingStyle}>5. Local Storage</h2>
                    <p style={textStyle}>
                        The following data is stored in your browser's local storage for the app to function.
                        This data stays on your device and is never transmitted to us unless explicitly required
                        for a request (e.g., your auth token for API calls):
                    </p>
                    <ul style={{ ...listStyle, marginTop: '8px' }}>
                        <li style={{ marginBottom: '6px' }}>Authentication token (JWT)</li>
                        <li style={{ marginBottom: '6px' }}>Basic user profile (ID, username, email)</li>
                        <li style={{ marginBottom: '6px' }}>Transaction PIN hash (SHA-256, if set)</li>
                        <li style={{ marginBottom: '6px' }}>Active wallet source preference</li>
                        <li style={{ marginBottom: '6px' }}>ZkLogin address (if applicable)</li>
                    </ul>
                    <p style={{ ...textStyle, marginTop: '8px' }}>
                        You can clear all locally stored data at any time by signing out of the application
                        or by clearing your browser's site data.
                    </p>
                </div>

                {/* 6. Third-Party Services & Government Data Sharing */}
                <div style={sectionStyle}>
                    <h2 style={headingStyle}>6. Third-Party Services & Data Sharing</h2>
                    <p style={{ ...textStyle, marginBottom: '8px' }}>
                        We adhere to strict privacy standards but may share your data in the following circumstances:
                    </p>
                    <ul style={listStyle}>
                        <li style={{ marginBottom: '6px' }}>
                            <strong>Government & Regulatory Bodies</strong> — To comply with financial
                            regulations, we are required to maintain records of your National Identification
                            Number (NIN) and transaction history. We will share this information with
                            government authorities or law enforcement agencies only when legally mandated
                            by a valid court order, subpoena, or regulatory requirement.
                        </li>
                        <li style={{ marginBottom: '6px' }}>
                            <strong>SmileID</strong> — Identity verification (KYC). Verification is processed
                            securely by SmileID in accordance with their privacy policy.
                        </li>
                        <li style={{ marginBottom: '6px' }}>
                            <strong>Flutterwave</strong> — Fiat payment processing for on-ramp
                            transactions. Payment details are handled directly by Flutterwave.
                        </li>
                        <li style={{ marginBottom: '6px' }}>
                            <strong>Blockchain networks</strong> — SUI, Solana, Aptos, and BNB Chain.
                            Transactions on these networks are public and permanent by design.
                        </li>
                    </ul>
                </div>

                {/* 7. Cookies */}
                <div style={sectionStyle}>
                    <h2 style={headingStyle}>7. Cookies</h2>
                    <p style={textStyle}>
                        Linq does not use cookies for tracking, advertising, or analytics. The only
                        cookies that may be set are strictly functional session cookies required by
                        our authentication system. No third-party cookies are used.
                    </p>
                </div>

                {/* 8. Data Retention */}
                <div style={sectionStyle}>
                    <h2 style={headingStyle}>8. Data Retention</h2>
                    <p style={textStyle}>
                        Transaction records are retained for regulatory compliance and dispute
                        resolution purposes. Account data is retained only for as long as your
                        account is active. You may request deletion of your account and all
                        associated data at any time by contacting us.
                    </p>
                </div>

                {/* 9. Your Rights */}
                <div style={sectionStyle}>
                    <h2 style={headingStyle}>9. Your Rights</h2>
                    <p style={{ ...textStyle, marginBottom: '8px' }}>You have the right to:</p>
                    <ul style={listStyle}>
                        <li style={{ marginBottom: '6px' }}>Access any personal data we hold about you</li>
                        <li style={{ marginBottom: '6px' }}>Request correction of inaccurate data</li>
                        <li style={{ marginBottom: '6px' }}>Request deletion of your account and data</li>
                        <li style={{ marginBottom: '6px' }}>Withdraw consent for KYC verification</li>
                        <li style={{ marginBottom: '6px' }}>Export your transaction history</li>
                    </ul>
                </div>

                {/* 10. Children's Privacy */}
                <div style={sectionStyle}>
                    <h2 style={headingStyle}>10. Children's Privacy</h2>
                    <p style={textStyle}>
                        Linq is not intended for use by individuals under the age of 18. We do not
                        knowingly collect information from minors.
                    </p>
                </div>

                {/* 11. Changes */}
                <div style={sectionStyle}>
                    <h2 style={headingStyle}>11. Changes to This Policy</h2>
                    <p style={textStyle}>
                        We may update this policy from time to time. Any changes will be reflected
                        on this page with an updated "Last updated" date. Continued use of the
                        app after changes constitutes acceptance of the updated policy.
                    </p>
                </div>

                {/* 12. Contact */}
                <div style={{ ...sectionStyle, marginBottom: 0 }}>
                    <h2 style={headingStyle}>12. Contact</h2>
                    <p style={textStyle}>
                        If you have questions about this Privacy Policy or wish to exercise any of
                        your rights, please contact us at{' '}
                        <a
                            href="mailto:privacy@linq.pxxl.click"
                            style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}
                        >
                            privacy@linq.pxxl.click
                        </a>
                    </p>
                </div>
            </div>

            {/* Bottom spacer */}
            <div style={{ height: '40px' }} />
        </div>
    );
}
