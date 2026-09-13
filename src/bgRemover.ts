import { pipeline, RawImage } from '@huggingface/transformers';

export type SoftenOptions = {
  feather?: number;
  blurAmount?: number;
  threshold?: number;
};

export type BilateralFilterOptions = {
  feather?: number;
  threshold?: number;
  spatialSigma?: number;
  colorSigma?: number;
};

export type KuwaharaOptions = {
  feather?: number;
  threshold?: number;
  kernelSize?: number;
};

export type EdgeSofteningMethod = 'box-blur' | 'bilateral' | 'kuwahara' | 'lanczos';

export type LanczosOptions = {
  feather?: number;
  threshold?: number;
  radius?: number;
};

// ponytail: single box pass per radius; upgrade to triple-pass for gaussian approx if needed
function boxBlurAlpha(data: Uint8ClampedArray, w: number, h: number, radius: number) {
  const r = Math.max(0, Math.floor(radius));
  if (r === 0) return;
  const wh = w * h;
  const src = new Uint8Array(wh);
  for (let i = 0; i < wh; i++) src[i] = data[i * 4 + 3];
  const tmp = new Uint8Array(wh);
  const div = 2 * r + 1;

  // horizontal
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let sum = 0;
    for (let x = -r; x <= r; x++) {
      const cx = x < 0 ? 0 : x >= w ? w - 1 : x;
      sum += src[row + cx];
    }
    for (let x = 0; x < w; x++) {
      tmp[row + x] = Math.round(sum / div);
      const outX = x - r;
      const inX = x + r + 1;
      sum -= src[row + (outX < 0 ? 0 : outX >= w ? w - 1 : outX)];
      sum += src[row + (inX < 0 ? 0 : inX >= w ? w - 1 : inX)];
    }
  }

  // vertical
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = -r; y <= r; y++) {
      const cy = y < 0 ? 0 : y >= h ? h - 1 : y;
      sum += tmp[cy * w + x];
    }
    for (let y = 0; y < h; y++) {
      data[(y * w + x) * 4 + 3] = Math.round(sum / div);
      const outY = y - r;
      const inY = y + r + 1;
      sum -= tmp[(outY < 0 ? 0 : outY >= h ? h - 1 : outY) * w + x];
      sum += tmp[(inY < 0 ? 0 : inY >= h ? h - 1 : inY) * w + x];
    }
  }
}

// Bilateral filter on alpha channel: smooths while preserving edges using spatial + range weights.
function bilateralFilterAlpha(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  radius: number,
  spatialSigma: number,
  colorSigma: number
) {
  const r = Math.max(0, Math.floor(radius));
  if (r === 0) return;
  const wh = w * h;
  const src = new Float64Array(wh);
  for (let i = 0; i < wh; i++) src[i] = data[i * 4 + 3];
  const out = new Float64Array(wh);
  const spatialDenom = -2 * spatialSigma * spatialSigma;
  const colorDenom = -2 * colorSigma * colorSigma;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      let sumW = 0;
      let sumV = 0;
      const centerVal = src[idx];

      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
          const nIdx = ny * w + nx;
          const nVal = src[nIdx];
          const spatialW = Math.exp((dx * dx + dy * dy) / spatialDenom);
          const rangeW = Math.exp(((nVal - centerVal) ** 2) / colorDenom);
          const wgt = spatialW * rangeW;
          sumW += wgt;
          sumV += nVal * wgt;
        }
      }
      out[idx] = sumW > 0 ? sumV / sumW : centerVal;
    }
  }

  for (let i = 0; i < wh; i++) data[i * 4 + 3] = Math.round(Math.min(255, Math.max(0, out[i])));
}

// Kuwahara filter: edge-preserving smoothing using local variance minimization over square kernels.
function kuwaharaFilterAlpha(data: Uint8ClampedArray, w: number, h: number, kernelSize: number) {
  const k = Math.max(1, Math.floor(kernelSize));
  if (k === 0) return;
  const half = Math.floor(k / 2);
  const wh = w * h;
  const src = new Float64Array(wh);
  for (let i = 0; i < wh; i++) src[i] = data[i * 4 + 3];
  const out = new Float64Array(wh);

  const regions = [
    (x: number, y: number) => ({ x0: x - half, y0: y - half, x1: x, y1: y }),
    (x: number, y: number) => ({ x0: x, y0: y - half, x1: x + half, y1: y }),
    (x: number, y: number) => ({ x0: x - half, y0: y, x1: x, y1: y + half }),
    (x: number, y: number) => ({ x0: x, y0: y, x1: x + half, y1: y + half }),
  ];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let bestMean = 0;
      let bestVar = Infinity;

      for (const region of regions) {
        const { x0, y0, x1, y1 } = region(x, y);
        let sum = 0;
        let count = 0;
        for (let ny = Math.max(0, y0); ny <= Math.min(h - 1, y1); ny++) {
          for (let nx = Math.max(0, x0); nx <= Math.min(w - 1, x1); nx++) {
            sum += src[ny * w + nx];
            count++;
          }
        }
        if (count === 0) continue;
        const mean = sum / count;
        let variance = 0;
        for (let ny = Math.max(0, y0); ny <= Math.min(h - 1, y1); ny++) {
          for (let nx = Math.max(0, x0); nx <= Math.min(w - 1, x1); nx++) {
            const diff = src[ny * w + nx] - mean;
            variance += diff * diff;
          }
        }
        variance /= count;
        if (variance < bestVar) {
          bestVar = variance;
          bestMean = mean;
        }
      }
      out[y * w + x] = bestMean;
    }
  }

  for (let i = 0; i < wh; i++) data[i * 4 + 3] = Math.round(Math.min(255, Math.max(0, out[i])));
}

// Lanczos resampling filter on alpha channel: edge-preserving using sinc-windowed kernel.
function lanczosFilterAlpha(data: Uint8ClampedArray, w: number, h: number, radius: number) {
  const r = Math.max(1, Math.floor(radius));
  const wh = w * h;
  const src = new Float64Array(wh);
  for (let i = 0; i < wh; i++) src[i] = data[i * 4 + 3];
  const out = new Float64Array(wh);

  // Lanczos kernel: L(x) = sinc(x) * sinc(x/a) for |x| < a, else 0
  const lanczos = (x: number) => {
    const ax = Math.abs(x);
    if (ax < 1e-10) return 1;
    if (ax >= r) return 0;
    const piX = Math.PI * x;
    return (Math.sin(piX) / piX) * (Math.sin(piX / r) / (piX / r));
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sumW = 0;
      let sumV = 0;
      for (let dy = -r + 0.5; dy < r; dy += 1) {
        for (let dx = -r + 0.5; dx < r; dx += 1) {
          const nx = Math.round(x + dx);
          const ny = Math.round(y + dy);
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
          const nIdx = ny * w + nx;
          const wgt = lanczos(dx) * lanczos(dy);
          sumW += wgt;
          sumV += src[nIdx] * wgt;
        }
      }
      out[y * w + x] = sumW > 0 ? sumV / sumW : src[y * w + x];
    }
  }

  for (let i = 0; i < wh; i++) data[i * 4 + 3] = Math.round(Math.min(255, Math.max(0, out[i])));
}

async function canvasToBlob(canvas: HTMLCanvasElement | OffscreenCanvas): Promise<Blob> {
  if ('convertToBlob' in canvas) {
    return (canvas as OffscreenCanvas).convertToBlob({ type: 'image/png' });
  }
  return new Promise((resolve, reject) => {
    (canvas as HTMLCanvasElement).toBlob(
      (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
      'image/png'
    );
  });
}

export async function softenPngBlob(
  blob: Blob,
  method: EdgeSofteningMethod = 'box-blur',
  opts: SoftenOptions | BilateralFilterOptions | KuwaharaOptions = {}
): Promise<Blob> {
  console.log(method)
  const t = Math.min(255, Math.max(0, Math.floor((opts as any).threshold ?? 128)));

  let w: number;
  let h: number;
  let canvas: HTMLCanvasElement | OffscreenCanvas;
  let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

  let bitmap: ImageBitmap | null = null;
  try {
    if (typeof createImageBitmap !== 'undefined') bitmap = await createImageBitmap(blob);
  } catch { /* fallback to <img> */ }

  if (bitmap) {
    w = bitmap.width;
    h = bitmap.height;
    canvas =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(w, h)
        : Object.assign(document.createElement('canvas'), { width: w, height: h });
    (canvas as any).width = w;
    (canvas as any).height = h;
    ctx = (canvas as any).getContext('2d', { willReadFrequently: true })!;
    (ctx as any).drawImage(bitmap, 0, 0);
    bitmap.close?.();
  } else {
    const url = URL.createObjectURL(blob);
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const el = new Image();
      el.onload = () => res(el);
      el.onerror = () => rej(new Error('image load failed'));
      el.src = url;
    });
    URL.revokeObjectURL(url);
    w = img.naturalWidth || img.width;
    h = img.naturalHeight || img.height;
    canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    (ctx as CanvasRenderingContext2D).drawImage(img, 0, 0);
  }

  const imageData = (ctx as any).getImageData(0, 0, w, h) as ImageData;
  const d = imageData.data;

  if (t > 0) {
    for (let i = 3; i < d.length; i += 4) if (d[i] < t) d[i] = 0;
  }

  switch (method) {
    case 'bilateral': {
      const opts2 = opts as BilateralFilterOptions;
      bilateralFilterAlpha(d, w, h, opts2.feather ?? 2, opts2.spatialSigma ?? 10, opts2.colorSigma ?? 30);
      break;
    }
    case 'kuwahara': {
      const opts2 = opts as KuwaharaOptions;
      kuwaharaFilterAlpha(d, w, h, opts2.kernelSize ?? 5);
      break;
    }
    case 'lanczos': {
      const opts2 = opts as LanczosOptions;
      lanczosFilterAlpha(d, w, h, opts2.radius ?? 3);
      break;
    }
    default: {
      const opts2 = opts as SoftenOptions;
      boxBlurAlpha(d, w, h, opts2.blurAmount ?? 2);
      if ((opts2.feather ?? 2) > 0) boxBlurAlpha(d, w, h, opts2.feather ?? 2);
      break;
    }
  }

  (ctx as any).putImageData(imageData, 0, 0);
  return canvasToBlob(canvas);
}

export async function processImageWithHF(
  imageFile: File,
  onProgress: (status: string) => void
): Promise<string> {
  onProgress('Initializing Hugging Face Pipeline...');

  const segmenter = await pipeline('background-removal', 'onnx-community/ormbg-ONNX', {
    progress_callback: (data: any) => {
      if (data.status === 'progress') {
        onProgress(`Downloading Model: ${Math.round(data.progress)}%`);
      } else if (data.status === 'ready') {
        onProgress('Model loaded. Processing frames...');
      }
    },
  });

  const imageUrl = URL.createObjectURL(imageFile);
  const rawImage = await RawImage.fromURL(imageUrl);

  onProgress('Running neural network mask extraction...');
  const output = await segmenter(rawImage);

  URL.revokeObjectURL(imageUrl);

  const blob: Blob = await output.toBlob();
  return URL.createObjectURL(blob);
}

export async function softenImageUrl(
  inputUrl: string,
  method: EdgeSofteningMethod = 'box-blur',
  opts: SoftenOptions | BilateralFilterOptions | KuwaharaOptions | LanczosOptions = {}
): Promise<string> {
  const response = await fetch(inputUrl);
  const blob = await response.blob();
  const softenedBlob = await softenPngBlob(blob, method, opts);
  return URL.createObjectURL(softenedBlob);
}

