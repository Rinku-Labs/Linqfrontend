import html2canvas from 'html2canvas';

/**
 * Captures an HTML element as a PNG image and triggers download
 */
export async function downloadReceiptAsImage(
    element: HTMLElement,
    filename: string = 'linq-receipt.png'
): Promise<void> {
    try {
        // Get computed background color from element or use fallback
        const computedStyle = window.getComputedStyle(element);
        const bgColor = computedStyle.backgroundColor || '#1a1a2e';

        const canvas = await html2canvas(element, {
            backgroundColor: bgColor === 'rgba(0, 0, 0, 0)' ? '#1a1a2e' : bgColor,
            scale: 2, // Higher quality for retina displays
            useCORS: true,
            logging: false,
        });

        const link = document.createElement('a');
        link.download = filename;
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch (error) {
        console.error('Failed to generate receipt image:', error);
        throw error;
    }
}
