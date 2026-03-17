import nineMobileLogo from '../assets/9mobile-logo.png';

export const NETWORK_LOGOS: Record<string, string> = {
    'MTN': 'https://upload.wikimedia.org/wikipedia/commons/9/93/New-mtn-logo.jpg',
    'Airtel': 'https://upload.wikimedia.org/wikipedia/commons/3/3a/Airtel_logo-01.png',
    'GLO': 'https://upload.wikimedia.org/wikipedia/commons/8/86/Glo_button.png',
    '9mobile': nineMobileLogo,
};

export const detectNetwork = (phoneNumber: string): string | null => {
    // Remove non-digit characters
    const cleanNumber = phoneNumber.replace(/\D/g, '');

    // We need at least 4 digits to determine the prefix (e.g., 0803)
    if (cleanNumber.length < 4) return null;

    let prefix = '';

    // Handle standard 0-start (e.g., 0803...)
    if (cleanNumber.startsWith('0')) {
        prefix = cleanNumber.substring(0, 4);
    }
    // Handle international format 234-start (e.g., 234803...)
    else if (cleanNumber.startsWith('234') && cleanNumber.length >= 6) {
        prefix = '0' + cleanNumber.substring(3, 6);
    }

    if (!prefix) return null;

    const mtnPrefixes = [
        '0703', '0706', '0803', '0806', '0810', '0813', '0814', '0816', '0903', '0906', '0913', '0916'
    ];

    const airtelPrefixes = [
        '0701', '0708', '0802', '0808', '0812', '0901', '0902', '0904', '0907', '0912'
    ];

    const gloPrefixes = [
        '0705', '0805', '0807', '0811', '0815', '0905', '0915'
    ];

    const mobile9Prefixes = [
        '0809', '0817', '0818', '0908', '0909'
    ];

    if (mtnPrefixes.includes(prefix)) return 'MTN';
    if (airtelPrefixes.includes(prefix)) return 'Airtel';
    if (gloPrefixes.includes(prefix)) return 'GLO';
    if (mobile9Prefixes.includes(prefix)) return '9mobile';

    return null;
};
