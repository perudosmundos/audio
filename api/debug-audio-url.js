// API для отладки формирования URL аудио
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { slug } = req.query;
  
  if (!slug) {
    return res.status(400).json({ error: 'Slug parameter is required' });
  }

  try {
    // Тестовые данные для отладки
    const testEpisode = {
      slug: "2025-01-29_ru",
      title: "Медитация 29 января",
      lang: "ru",
      date: "2025-01-29",
      r2_object_key: "2025-01-29_ru.mp3",
      r2_bucket_name: "audio-files",
      audio_url: "https://audio.alexbrin102.workers.dev/2025-01-29_ru.mp3"
    };

    // Симулируем логику из getCompatibleUrl
    const audioUrl = testEpisode.audio_url;
    const r2ObjectKey = testEpisode.r2_object_key;
    const r2BucketName = testEpisode.r2_bucket_name;

    let debugInfo = {
      requestedSlug: slug,
      episodeData: testEpisode,
      processingSteps: []
    };

    // Шаг 1: Проверяем audioUrl
    if (audioUrl) {
      debugInfo.processingSteps.push({
        step: 1,
        description: "Checking audioUrl",
        audioUrl: audioUrl,
        includesWorker: audioUrl.includes('alexbrin102.workers.dev')
      });

      if (audioUrl.includes('alexbrin102.workers.dev')) {
        const url = new URL(audioUrl);
        const filePath = url.pathname.substring(1);
        const isSecondary = audioUrl.includes('audio-secondary.alexbrin102.workers.dev');
        const bucketName = isSecondary ? 'audio-files-secondary' : 'audio-files';
        
        debugInfo.processingSteps.push({
          step: 2,
          description: "Extracting from Cloudflare Worker URL",
          url: url.toString(),
          filePath: filePath,
          isSecondary: isSecondary,
          bucketName: bucketName
        });

        // Генерируем прокси URL
        const proxyPath = isSecondary ? 'audio-secondary-proxy' : 'audio-proxy';
        const proxiedUrl = `/api/${proxyPath}/${filePath}`;
        
        debugInfo.processingSteps.push({
          step: 3,
          description: "Generated proxied URL",
          proxiedUrl: proxiedUrl
        });

        debugInfo.finalUrl = proxiedUrl;
      } else {
        debugInfo.processingSteps.push({
          step: 2,
          description: "Using direct URL (not Cloudflare Worker)",
          finalUrl: audioUrl
        });
        debugInfo.finalUrl = audioUrl;
      }
    } else if (r2ObjectKey) {
      debugInfo.processingSteps.push({
        step: 1,
        description: "No audioUrl, using r2ObjectKey",
        r2ObjectKey: r2ObjectKey,
        r2BucketName: r2BucketName
      });

      const proxyPath = r2BucketName === 'audio-files-secondary' ? 'audio-secondary-proxy' : 'audio-proxy';
      const generatedUrl = `/api/${proxyPath}/${r2ObjectKey}`;
      
      debugInfo.processingSteps.push({
        step: 2,
        description: "Generated URL from r2ObjectKey",
        generatedUrl: generatedUrl
      });

      debugInfo.finalUrl = generatedUrl;
    } else {
      debugInfo.processingSteps.push({
        step: 1,
        description: "No URL could be generated",
        error: "Missing both audioUrl and r2ObjectKey"
      });
      debugInfo.finalUrl = null;
    }

    // Тестируем разные варианты
    const testVariants = [
      "2025-01-29_ru",
      "2025-01-29_RU", 
      "2025-01-29_ru.mp3",
      "2025-01-29_RU.mp3"
    ];

    debugInfo.testVariants = testVariants.map(variant => {
      const proxyPath = 'audio-proxy';
      return {
        variant: variant,
        url: `/api/${proxyPath}/${variant}`,
        description: `Testing ${variant}`
      };
    });

    res.status(200).json(debugInfo);

  } catch (error) {
    console.error('Error in debug-audio-url:', error);
    res.status(500).json({ 
      error: 'Failed to debug audio URL',
      details: error.message
    });
  }
} 