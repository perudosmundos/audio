import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

const R2_PRIMARY_CONFIG = {
  ACCESS_KEY_ID: "9725f0f870623b4acdd984d5863343be",
  SECRET_ACCESS_KEY: "d866515b4eda43f69b8ed97036227222c73be8ff1dcd4b9450f945625f9eceae",
  BUCKET: "audio-files", 
  ACCOUNT_ID: "b673708f9f9609c4d372573207f830ce",
  ENDPOINT_SUFFIX: "r2.cloudflarestorage.com"
};

const R2_SECONDARY_CONFIG = {
  ACCESS_KEY_ID: "fdd9df8e8e4963564e4264b2bc8250c6",
  SECRET_ACCESS_KEY: "ada4a9cd24c77795f0df4d3c3fd2f41ec293f167777746134fd695fbd5248907",
  BUCKET: "audio-files-secondary", 
  ACCOUNT_ID: "b673708f9f9609c4d372573207f830ce", 
  ENDPOINT_SUFFIX: "r2.cloudflarestorage.com"
};

const createS3Client = (config) => {
  return new S3Client({
    region: "auto", 
    endpoint: `https://${config.ACCOUNT_ID}.${config.ENDPOINT_SUFFIX}`,
    credentials: {
      accessKeyId: config.ACCESS_KEY_ID,
      secretAccessKey: config.SECRET_ACCESS_KEY,
    },
    maxAttempts: 3,
    requestHandler: {
      httpOptions: {
        timeout: 30000,
        connectTimeout: 10000,
      }
    },
    customUserAgent: 'DosMundosPodcast/1.0',
  });
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { bucket = 'primary', prefix = '', limit = 50 } = req.query;
  
  const config = bucket === 'secondary' ? R2_SECONDARY_CONFIG : R2_PRIMARY_CONFIG;
  const client = createS3Client(config);

  try {
    const command = new ListObjectsV2Command({
      Bucket: config.BUCKET,
      Prefix: prefix,
      MaxKeys: parseInt(limit)
    });

    const response = await client.send(command);
    
    const files = response.Contents || [];
    const fileList = files.map(file => ({
      key: file.Key,
      size: file.Size,
      lastModified: file.LastModified,
      etag: file.ETag
    }));

    res.status(200).json({
      bucket: config.BUCKET,
      prefix,
      totalFiles: files.length,
      files: fileList,
      isTruncated: response.IsTruncated,
      nextContinuationToken: response.NextContinuationToken
    });

  } catch (error) {
    console.error('Error listing files:', error);
    res.status(500).json({ 
      error: 'Failed to list files',
      details: error.message,
      bucket: config.BUCKET
    });
  }
} 