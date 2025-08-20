import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const IA_ENDPOINT = 'https://s3.us.archive.org';
const IA_REGION = 'us-east-1';

const getEnv = (key, def = '') => process.env[key] || def;

const s3 = new S3Client({
  region: IA_REGION,
  endpoint: IA_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: getEnv('VITE_IA_ACCESS_KEY', getEnv('IA_ACCESS_KEY')),
    secretAccessKey: getEnv('VITE_IA_SECRET_KEY', getEnv('IA_SECRET_KEY')),
  },
});

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const bucket = getEnv('VITE_IA_BUCKET', getEnv('IA_BUCKET')) || 'dosmundos-audio';
    const key = (req.query.key || '').toString();
    const contentType = (req.query.contentType || 'application/octet-stream').toString();
    if (!key) {
      res.status(400).json({ error: 'Missing key' });
      return;
    }

    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks);

    const command = () => new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType });
    const maxAttempts = 3;
    let lastErr = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await s3.send(command());
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        if (attempt < maxAttempts) {
          const delay = 500 * attempt;
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
      }
    }
    if (lastErr) throw lastErr;

    const url = `https://archive.org/download/${bucket}/${encodeURIComponent(key)}`;
    res.status(200).json({ url, key, bucket });
  } catch (error) {
    console.error('IA upload API error:', error);
    res.status(500).json({ error: error.message || 'Upload failed' });
  }
}


