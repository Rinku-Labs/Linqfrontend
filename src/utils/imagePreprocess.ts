/**
 * In-browser image preprocessing for OCR. Cleaning the captured frame before it
 * reaches Tesseract is the single biggest accuracy lever for messy, low-light
 * phone photos — it costs nothing and runs on a <canvas>.
 *
 * Pipeline: grayscale -> Otsu automatic threshold -> binarize (pure black text
 * on white). This removes shadows and colour cast and gives the OCR crisp edges.
 */
export function preprocessForOcr(source: HTMLCanvasElement): HTMLCanvasElement {
    const ctx = source.getContext('2d', { willReadFrequently: true });
    if (!ctx) return source;

    const { width, height } = source;
    if (width === 0 || height === 0) return source;

    const image = ctx.getImageData(0, 0, width, height);
    const data = image.data;
    const pixelCount = width * height;

    // 1. Grayscale + build histogram.
    const gray = new Uint8ClampedArray(pixelCount);
    const histogram = new Array(256).fill(0);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        const g = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) | 0;
        gray[p] = g;
        histogram[g]++;
    }

    // 2. Otsu's method — find the threshold that best separates fore/background.
    let sumAll = 0;
    for (let t = 0; t < 256; t++) sumAll += t * histogram[t];

    let sumBackground = 0;
    let weightBackground = 0;
    let maxVariance = 0;
    let threshold = 127;
    for (let t = 0; t < 256; t++) {
        weightBackground += histogram[t];
        if (weightBackground === 0) continue;
        const weightForeground = pixelCount - weightBackground;
        if (weightForeground === 0) break;

        sumBackground += t * histogram[t];
        const meanBackground = sumBackground / weightBackground;
        const meanForeground = (sumAll - sumBackground) / weightForeground;
        const between =
            weightBackground * weightForeground *
            (meanBackground - meanForeground) * (meanBackground - meanForeground);
        if (between > maxVariance) {
            maxVariance = between;
            threshold = t;
        }
    }

    // 3. Binarize.
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        const v = gray[p] > threshold ? 255 : 0;
        data[i] = data[i + 1] = data[i + 2] = v;
        data[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    return source;
}
