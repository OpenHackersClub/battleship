import type React from 'react';
import { useEffect, useState } from 'react';
import { checkBrowserAiAvailability, downloadBrowserAiModel } from '../util/browser-ai-provider';
import { Progress } from './ui/progress';

export type AiPlayerType = 'openai' | 'browserai';

interface AiPlayerTypeSelectorProps {
  value: AiPlayerType;
  onChange: (type: AiPlayerType) => void;
  disabled?: boolean;
}

export const AiPlayerTypeSelector: React.FC<AiPlayerTypeSelectorProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const [browserAiStatus, setBrowserAiStatus] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);

  // Check browser AI availability when component mounts
  useEffect(() => {
    const checkAvailability = async () => {
      try {
        const availability = await checkBrowserAiAvailability();
        console.log('Browser AI availability:', availability);
        setBrowserAiStatus(availability);

        // If already downloading, we should show that state
        if (availability === 'downloading') {
          setIsDownloading(true);
        }
      } catch (error) {
        console.warn('Browser AI availability check failed:', error);
        setBrowserAiStatus('unavailable');
      }
    };

    checkAvailability();
  }, []);

  const handleDownloadModel = async () => {
    try {
      setIsDownloading(true);
      setDownloadProgress(0);

      await downloadBrowserAiModel((progress) => {
        setDownloadProgress(Math.round(progress));
      });

      // Recheck availability after download
      const newAvailability = await checkBrowserAiAvailability();
      setBrowserAiStatus(newAvailability);

      if (newAvailability === 'available') {
        console.log('Model download completed successfully');
      }
    } catch (error) {
      console.error('Model download failed:', error);
      // Show error to user
      alert(`Model download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  const isBrowserAiAvailable = browserAiStatus === 'available';
  const isBrowserAiDownloadable = browserAiStatus === 'downloadable';
  const isBrowserAiDownloading = browserAiStatus === 'downloading';

  const aiOptions: Array<{
    value: AiPlayerType;
    label: string;
    description: string;
    isAvailable: boolean;
    isDownloadable?: boolean;
    isDownloading?: boolean;
  }> = [
    {
      value: 'openai' as const,
      label: '☁️ Cloudflare AI',
      description: 'Llama 3.3 - Cloud AI powered by Cloudflare Workers AI',
      isAvailable: true,
    },
    {
      value: 'browserai' as const,
      label: '🧠 Browser AI',
      description: 'Gemini Nano - Local AI (Chrome 138+)',
      isAvailable: isBrowserAiAvailable,
      isDownloadable: isBrowserAiDownloadable,
      isDownloading: isBrowserAiDownloading,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <h3 className="text-sm font-medium">🤖 AI Opponent Type</h3>
        <div className="grid gap-2">
          {aiOptions.map((option) => {
            const isDisabled = disabled || (option.isAvailable === false && !option.isDownloadable);
            const isSelected = value === option.value;
            const isUnselectedAndDisabled = disabled && !isSelected;
            return (
              <label
                key={option.value}
                className={`
                relative flex items-center space-x-3 p-3 border rounded-lg transition-colors
                ${option.isAvailable === false && !option.isDownloadable ? 'opacity-50 cursor-not-allowed' : ''}
                ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}
                ${isUnselectedAndDisabled ? 'cursor-not-allowed opacity-40 grayscale' : ''}
                ${disabled && isSelected ? 'cursor-default' : ''}
                ${!disabled && !isDisabled ? 'cursor-pointer' : ''}
              `}
                onClick={(e) => {
                  e.preventDefault();
                  if (!isDisabled) {
                    onChange(option.value);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (!isDisabled) {
                      onChange(option.value);
                    }
                  }
                }}
              >
                <input
                  type="radio"
                  name="aiPlayerType"
                  value={option.value}
                  checked={value === option.value}
                  onChange={(e) => onChange(e.target.value as AiPlayerType)}
                  disabled={isDisabled}
                  className="sr-only"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium">{option.label}</span>
                    {option.isDownloadable && (
                      <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                        Download Required
                      </span>
                    )}
                    {option.isDownloading && (
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                        Downloading...
                      </span>
                    )}
                    {option.value === 'browserai' && option.isAvailable && (
                      <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded">
                        Ready
                      </span>
                    )}
                    {option.isAvailable === false &&
                      !option.isDownloadable &&
                      !option.isDownloading &&
                      browserAiStatus !== null && (
                        <span className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded">
                          {browserAiStatus === 'unavailable' ? 'Unavailable' : 'Not Available'}
                        </span>
                      )}
                    {browserAiStatus === null && (
                      <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                        Checking...
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{option.description}</p>
                </div>
                {value === option.value && <div className="h-2 w-2 bg-blue-500 rounded-full" />}
              </label>
            );
          })}
        </div>
      </div>

      {value === 'browserai' && (isBrowserAiDownloadable || isBrowserAiDownloading) && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start space-x-2">
            <span className="text-blue-600">📥</span>
            <div className="text-xs text-blue-800 flex-1">
              <p className="font-medium">
                {isBrowserAiDownloading ? 'Model Download In Progress' : 'Model Download Required'}
              </p>
              <p className="mt-1 mb-3">
                {isBrowserAiDownloading
                  ? 'The Gemini Nano model is currently being downloaded to your browser. Please wait...'
                  : 'The Gemini Nano model needs to be downloaded to your browser. This is a one-time download.'}
              </p>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleDownloadModel}
                  disabled={isDownloading || isBrowserAiDownloading}
                  className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDownloading
                    ? 'Downloading...'
                    : isBrowserAiDownloading
                      ? 'Download in progress...'
                      : 'Download Model'}
                </button>
                {(isDownloading || isBrowserAiDownloading) && (
                  <div className="space-y-2">
                    <Progress value={downloadProgress} className="h-2" />
                    <p className="text-xs text-center text-gray-600">
                      {downloadProgress}% complete
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {value === 'browserai' &&
        !isBrowserAiAvailable &&
        !isBrowserAiDownloadable &&
        browserAiStatus !== null && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <span className="text-yellow-600">⚠️</span>
              <div className="text-xs text-yellow-800">
                <p className="font-medium">Browser AI not available</p>
                <p className="mt-1">
                  Requires Chrome 138+ with AI origin trial enabled. The game will use Cloudflare AI
                  as fallback.
                </p>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};
