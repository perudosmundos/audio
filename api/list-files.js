// Простая версия без импортов для совместимости с Vercel
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { bucket = 'primary', prefix = '', limit = 50 } = req.query;
  
  // Простая проверка - возвращаем тестовые данные
  // В реальном приложении здесь был бы код для работы с R2
  
  const testFiles = [
    {
      key: "2025-01-29_ru",
      size: 15000000,
      lastModified: new Date("2025-01-29T10:00:00Z"),
      etag: "test-etag-1"
    },
    {
      key: "2025-01-29_RU",
      size: 15000000,
      lastModified: new Date("2025-01-29T10:00:00Z"),
      etag: "test-etag-2"
    },
    {
      key: "test.mp3",
      size: 5000000,
      lastModified: new Date("2025-01-28T15:30:00Z"),
      etag: "test-etag-3"
    }
  ];

  // Фильтруем файлы по префиксу
  const filteredFiles = prefix 
    ? testFiles.filter(file => file.key.toLowerCase().includes(prefix.toLowerCase()))
    : testFiles;

  res.status(200).json({
    bucket: bucket === 'secondary' ? 'audio-files-secondary' : 'audio-files',
    prefix,
    totalFiles: filteredFiles.length,
    files: filteredFiles.slice(0, parseInt(limit)),
    isTruncated: false,
    nextContinuationToken: null,
    note: "Это тестовые данные. В продакшене здесь будет реальный список файлов из R2."
  });
} 