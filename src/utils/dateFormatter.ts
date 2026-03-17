/**
 * Formats an ISO date string (e.g. from Go backend) into a readable string.
 * Usage: formatDate(order.updated) -> "Jan 21, 2026, 3:04 PM"
 */
export const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);

        // Check if date is valid
        if (isNaN(date.getTime())) {
            console.warn('Invalid date string received:', dateString);
            return 'Invalid Date';
        }
        // Use Intl.DateTimeFormat for consistent local formatting
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            hour12: true
        }).format(date);

    } catch (error) {
        console.error('Error parsing date:', error);
        return 'Error';
    }
};
