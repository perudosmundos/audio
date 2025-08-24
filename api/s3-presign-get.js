const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const getEnv = (key, def = '') => process.env[key] || def;

const s3 = new S3Client({
  region: getEnv('VITE_S3_REGION', 'kz-1'),
  endpoint: getEnv('VITE_S3_ENDPOINT', 'https://s3.kz-1.srvstorage.kz'),
  forcePathStyle: false,
  credentials: {
    accessKeyId: getEnv('VITE_S3_ACCESS_KEY', getEnv('S3_ACCESS_KEY')),
    secretAccessKey: getEnv('VITE_S3_SECRET_KEY', getEnv('S3_SECRET_KEY')),
  },
});

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    const bucket = getEnv('VITE_S3_BUCKET', getEnv('S3_BUCKET')) || 'dosmundos-audio';
    const key = (req.query.key || '').toString();
    if (!key) {
      res.status(400).json({ error: 'Missing key' });
      return;
    }
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 }); // 1 hour
    res.status(200).json({ url });
  } catch (error) {
    console.error('S3 presign GET error:', error);
    res.status(500).json({ error: error.message || 'Presign GET failed' });
  }
}


