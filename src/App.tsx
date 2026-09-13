import React, { useState, useRef } from 'react';
import {
  processImageWithHF,
  softenImageUrl,
  type EdgeSofteningMethod,
  type SoftenOptions,
  type BilateralFilterOptions,
  type KuwaharaOptions,
  type LanczosOptions,
} from './bgRemover';

const EDGE_METHODS: { value: EdgeSofteningMethod; label: string; description: string }[] = [
  { value: 'box-blur', label: 'Box Blur', description: 'Simple box blur feather' },
  { value: 'bilateral', label: 'Bilateral', description: 'Edge-preserving spatial + range filter' },
  { value: 'kuwahara', label: 'Kuwahara', description: 'Edge-preserving variance-minimizing filter' },
  { value: 'lanczos', label: 'Lanczos', description: 'Edge-preserving sinc-windowed resampling' },
];

export default function App() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [inputUrl, setInputUrl] = useState<string | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [lastResultUrl, setLastResultUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isSoftening, setIsSoftening] = useState<boolean>(false);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [edgeMethod, setEdgeMethod] = useState<EdgeSofteningMethod>('box-blur');
  const [feather, setFeather] = useState<string>('2');
  const [blurAmount, setBlurAmount] = useState<string>('2');
  const [threshold, setThreshold] = useState<string>('128');
  const [spatialSigma, setSpatialSigma] = useState<string>('10');
  const [colorSigma, setColorSigma] = useState<string>('30');
  const [kernelSize, setKernelSize] = useState<string>('5');
  const [lanczosRadius, setLanczosRadius] = useState<string>('3');

  const extractFIlepathMetadata = (path: string | null) => {
    let filename = "";
    let extension = "";

    if (path == null) {
      return { filename, extension }
    }

    // Extract the filename portion out of the path/URL string
    const fullFilename = path.split('/').pop() || '';
    const lastDotIndex = fullFilename.lastIndexOf('.');

    filename = lastDotIndex !== -1 ? fullFilename.substring(0, lastDotIndex) : fullFilename;
    extension = lastDotIndex !== -1 ? fullFilename.substring(lastDotIndex + 1) : '';

    return { filename, extension }; 
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setInputUrl(URL.createObjectURL(file));
      setOutputUrl(null);
    }
  };

  const handleProcessImage = async () => {
    if (!imageFile) return;
    setIsProcessing(true);
    setProgressMessage('Waking engine execution context...');
    setOutputUrl(null);
    setLastResultUrl(null);

    try {
      const resultUrl = await processImageWithHF(imageFile, setProgressMessage);
      setLastResultUrl(resultUrl);
      setOutputUrl(resultUrl);
    } catch (error) {
      console.error(error);
      alert('An error occurred during local browser processing.');
    } finally {
      setIsProcessing(false);
      setProgressMessage('');
    }
  };

  const handleSoftenEdges = async () => {
    if (!lastResultUrl) return;
    setIsSoftening(true);
    setProgressMessage('Softening edges...');

    try {
      const f = Number(feather);
      const bA = Number(blurAmount);
      const t = Number(threshold);

      let softenOpts: SoftenOptions | BilateralFilterOptions | KuwaharaOptions | LanczosOptions | undefined;
      switch (edgeMethod) {
        case 'bilateral':
          softenOpts = { feather: f, spatialSigma: Number(spatialSigma), colorSigma: Number(colorSigma), threshold: t };
          break;
        case 'kuwahara':
          softenOpts = { feather: f, kernelSize: Number(kernelSize), threshold: t };
          break;
        case 'lanczos':
          softenOpts = { feather: f, radius: Number(lanczosRadius), threshold: t };
          break;
        default:
          softenOpts = { feather: f, blurAmount: bA, threshold: t };
          break;
      }

      const softenedUrl = await softenImageUrl(lastResultUrl, edgeMethod, softenOpts);
      setOutputUrl(softenedUrl);
    } catch (error) {
      console.error(error);
      alert('An error occurred during edge softening.');
    } finally {
      setIsSoftening(false);
      setProgressMessage('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center py-10 px-4">
      <header className="max-w-4xl w-full text-center mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">
          ✨ Local AI Background Remover
        </h1>
        <p className="text-slate-400 text-sm">
          Powered entirely inside your browser via WASM. Zero API keys. Zero uploads.
        </p>
      </header>

      <main className="max-w-4xl w-full bg-slate-800 rounded-xl shadow-2xl p-6 border border-slate-700">
        {/* Selection Engine */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-slate-300 mb-2">Select AI Model Engine:</label>
          <div className="grid grid-cols-1 gap-4">
            <button
              className={`p-3 rounded-lg border text-left transition-all border-indigo-500 bg-indigo-500/10 text-indigo-400`}
            >
              <div className="font-bold">@huggingface/transformers</div>
              <div className="text-xs text-slate-400 mt-1">onnx-community/ormbg-ONNX open-source engine</div>
            </button>
          </div>
        </div>

        {/* Input Controls */}
        <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-600 rounded-xl p-8 mb-6 hover:border-slate-500 transition-colors">
          <input
            type="file"
            accept="image/jpeg,image/jpg"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors mb-2"
          >
            Choose Input Image
          </button>
          {imageFile && <p className="text-xs text-emerald-400">Target Selected: {imageFile.name}</p>}
          {imageFile && <span className='text-xs text-orange-400'>Target Output: {extractFIlepathMetadata(imageFile.name).filename}.png</span>}
        </div>

        {/* Edge Softening Method Selection */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-slate-300 mb-2">Select Edge Softening Method:</label>
          <div className="grid grid-cols-3 gap-4">
            {EDGE_METHODS.map((m) => (
              <label
                key={m.value}
                className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                  edgeMethod === m.value
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                    : 'border-slate-600 bg-slate-800 text-slate-400 hover:border-slate-500'
                }`}
              >
                <input
                  type="radio"
                  name="edgeMethod"
                  value={m.value}
                  checked={edgeMethod === m.value}
                  onChange={() => setEdgeMethod(m.value)}
                  className="sr-only"
                />
                <div className="font-bold">{m.label}</div>
                <div className="text-xs text-slate-500 mt-1">{m.description}</div>
              </label>
            ))}
          </div>
        </div>

        {/* Filter Parameters */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1">Feather</label>
            <input type="number" value={feather} onChange={(e) => setFeather(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-1 text-sm text-slate-100" />
          </div>
          {edgeMethod === 'box-blur' && (
            <>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1">Blur Amount</label>
                <input type="number" value={blurAmount} onChange={(e) => setBlurAmount(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-1 text-sm text-slate-100" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1">Threshold</label>
                <input type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-1 text-sm text-slate-100" />
              </div>
            </>
          )}
          {edgeMethod === 'bilateral' && (
            <>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1">Spatial Sigma</label>
                <input type="number" value={spatialSigma} onChange={(e) => setSpatialSigma(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-1 text-sm text-slate-100" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1">Color Sigma</label>
                <input type="number" value={colorSigma} onChange={(e) => setColorSigma(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-1 text-sm text-slate-100" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1">Threshold</label>
                <input type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-1 text-sm text-slate-100" />
              </div>
            </>
          )}
          {edgeMethod === 'kuwahara' && (
            <>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1">Kernel Size</label>
                <input type="number" value={kernelSize} onChange={(e) => setKernelSize(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-1 text-sm text-slate-100" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1">Threshold</label>
                <input type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-1 text-sm text-slate-100" />
              </div>
            </>
          )}
          {edgeMethod === 'lanczos' && (
            <>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1">Radius</label>
                <input type="number" value={lanczosRadius} onChange={(e) => setLanczosRadius(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-1 text-sm text-slate-100" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1">Threshold</label>
                <input type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-1 text-sm text-slate-100" />
              </div>
            </>
          )}
        </div>

        {/* Action Buttons & Progress */}
        {imageFile && (
          <div className="mb-6 text-center flex flex-col sm:flex-row gap-3 justify-center items-center">
            <button
              onClick={handleProcessImage}
              disabled={isProcessing}
              className="w-full sm:w-auto px-8 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 font-bold rounded-xl transition-all shadow-md"
            >
              {isProcessing ? 'Extracting Background...' : '1. Extract Background'}
            </button>
            <button
              onClick={handleSoftenEdges}
              disabled={isSoftening || !lastResultUrl}
              className="w-full sm:w-auto px-8 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 font-bold rounded-xl transition-all shadow-md"
            >
              {isSoftening ? 'Softening Edges...' : '2. Soften Edges'}
            </button>
          </div>
        )}
            
        {(isSoftening || isProcessing) && (
          <div className="mt-4 p-3 bg-slate-900/50 rounded-lg border border-slate-700 animate-pulse">
            <span className="text-sm font-mono text-indigo-400">{progressMessage}</span>
          </div>
        )}

        {/* Display Output Windows */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          {/* Input Side */}
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Original Context</span>
            <div className="flex-1 min-h-[250px] bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center border border-slate-700">
              {inputUrl ? (
                <img src={inputUrl} alt="Source input File" className="max-h-[350px] object-contain" />
              ) : (
                <span className="text-sm text-slate-500">No Image Uploaded</span>
              )}
            </div>
          </div>

          {/* Output Side */}
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Isolated Foreground</span>
            <div className="flex-1 min-h-[250px] bg-slate-900 checkerboard-bg rounded-lg overflow-hidden flex items-center justify-center border border-slate-700 relative">
              {outputUrl ? (
                <div className="flex flex-col items-center p-2 w-full h-full justify-center">
                  <img src={outputUrl} alt="Processed Transparent Output" className="max-h-[300px] object-contain" />
                  <a
                    href={outputUrl}
                    download={imageFile ? `${extractFIlepathMetadata(imageFile.name).filename}.png` : "removed_background.png"}
                    className="mt-3 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-xs font-medium rounded border border-slate-600 transition-colors"
                  >
                    💾 Download Transparent PNG
                  </a>
                </div>
              ) : (
                <span className="text-sm text-slate-500">
                  {isProcessing ? 'Computing alpha arrays...' : 'Awaiting Execution'}
                </span>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
