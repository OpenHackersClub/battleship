// Browser AI types (matching Chrome Prompt API)
interface LanguageModelSession {
  prompt(
    input: string,
    options?: {
      signal?: AbortSignal;
      outputLanguage?: string;
      responseConstraint?: {
        type: string;
        properties?: Record<string, any>;
        required?: string[];
        additionalProperties?: boolean;
        items?: any;
        maxItems?: number;
        pattern?: string;
      };
    }
  ): Promise<string>;
  promptStreaming(
    input: string,
    options?: { signal?: AbortSignal; outputLanguage?: string }
  ): ReadableStream;
  destroy(): void;
}

interface DownloadProgressEvent extends Event {
  loaded: number;
  total: number;
}

interface AIDownloadMonitor extends EventTarget {
  addEventListener(
    type: 'downloadprogress',
    listener: (event: DownloadProgressEvent) => void
  ): void;
}

interface LanguageModel {
  create(options?: {
    initialPrompts?: Array<{ role: string; content: string }>;
    temperature?: number;
    topK?: number;
    monitor?: (monitor: AIDownloadMonitor) => void;
    outputLanguage?: string;
    language?: string;
  }): Promise<LanguageModelSession>;
  availability(): Promise<string>;
}

declare global {
  // Expose global LanguageModel (provided by supported browsers)
  // eslint-disable-next-line no-var
  var LanguageModel: LanguageModel | undefined;
}

export const checkBrowserAiAvailability = async (): Promise<string> => {
  const LM = (globalThis as any).LanguageModel as LanguageModel | undefined;
  if (!LM) {
    throw new Error('Browser AI not available in this environment');
  }
  return await LM.availability();
};

export const downloadBrowserAiModel = async (
  onProgress?: (progress: number) => void
): Promise<void> => {
  const LM = (globalThis as any).LanguageModel as LanguageModel | undefined;
  if (!LM) {
    throw new Error('Browser AI not available in this environment');
  }

  console.log('Checking initial availability...');
  const availability = await LM.availability();
  console.log('Initial availability:', availability);

  if (availability === 'available') {
    console.log('Model already available, no download needed');
    if (onProgress) onProgress(100);
    return;
  }

  if (availability !== 'downloadable') {
    throw new Error(`Cannot download model, availability status: ${availability}`);
  }

  console.log('Starting model download...');
  let session: any = null;
  let downloadStarted = false;

  try {
    // Create session with monitor to trigger download
    console.log('Creating session to trigger download...');
    session = await LM.create({
      outputLanguage: 'en',
      language: 'en',
      initialPrompts: [{ role: 'system', content: 'Please respond in English.' }],
      monitor: (monitor) => {
        console.log('Download monitor attached');
        if (onProgress) {
          monitor.addEventListener('downloadprogress', (event) => {
            console.log('Download progress event:', { loaded: event.loaded, total: event.total });
            const progressPercent = event.total > 0 ? (event.loaded / event.total) * 100 : 0;
            onProgress(Math.round(progressPercent));
            downloadStarted = true;
          });
        }
      },
    });

    console.log('Session created, starting polling...');

    // Poll availability status and show progress until model is ready
    let attempts = 0;
    const maxAttempts = 150; // 5 minutes max wait time
    let lastProgress = 0;

    while (attempts < maxAttempts) {
      const currentAvailability = await LM.availability();
      console.log(`Polling attempt ${attempts + 1}: availability = ${currentAvailability}`);

      if (currentAvailability === 'available') {
        console.log('Download completed successfully');
        if (onProgress) {
          onProgress(100);
        }
        return;
      }

      // Show incremental progress while downloading
      if (currentAvailability === 'downloading' && onProgress && !downloadStarted) {
        // Fallback progress estimation when monitor events aren't working
        const progressEstimate = Math.min((attempts / maxAttempts) * 95, 95);
        const newProgress = Math.round(progressEstimate);
        if (newProgress > lastProgress) {
          console.log(`Estimated progress: ${newProgress}%`);
          onProgress(newProgress);
          lastProgress = newProgress;
        }
      }

      // Wait 2 seconds before checking again
      await new Promise((resolve) => setTimeout(resolve, 2000));
      attempts++;
    }

    throw new Error('Model download timeout - took longer than 5 minutes');
  } catch (error) {
    console.error('Error during model download:', error);
    throw error;
  } finally {
    if (session) {
      console.log('Destroying session...');
      session.destroy();
    }
  }
};

export const generateObjectWithBrowserAI = async <A>(options: {
  prompt: string;
  temperature?: number;
  topK?: number;
}): Promise<{ value: A }> => {
  const LM = (globalThis as any).LanguageModel as LanguageModel | undefined;
  if (!LM) {
    throw new Error('Browser AI not available');
  }

  const availability = await LM.availability();
  if (availability !== 'available') {
    throw new Error(`Browser AI not ready: ${availability}`);
  }

  const session = await LM.create({
    outputLanguage: 'en',
    language: 'en',
    initialPrompts: [{ role: 'system', content: 'Please respond in English.' }],
    temperature: options.temperature,
    topK: options.topK,
  });

  try {
    // JSON Schema for the expected response structure
    const schema = {
      type: 'object',
      properties: {
        x: {
          type: 'number',
        },
        y: {
          type: 'number',
        },
        reasoning: {
          type: 'string',
        },
      },
      required: ['x', 'y'],
      additionalProperties: false,
    };

    const response = await session.prompt(options.prompt, {
      outputLanguage: 'en',
      responseConstraint: schema,
    });

    // The API returns valid JSON directly when using responseConstraint
    const parsed = JSON.parse(response);
    return { value: parsed as A };
  } finally {
    session.destroy();
  }
};
