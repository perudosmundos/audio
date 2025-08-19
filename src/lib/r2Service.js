import { S3Client, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getLocaleString } from '@/lib/locales';

// Primary and secondary R2 public endpoints (Cloudflare Workers)
const R2_PRIMARY_CONFIG = {
  ACCESS_KEY_ID: "9725f0f870623b4acdd984d5863343be",
  SECRET_ACCESS_KEY: "d866515b4eda43f69b8ed97036227222c73be8ff1dcd4b9450f945625f9eceae",
  BUCKET: "audio-files",
  ACCOUNT_ID: "b673708f9f9609c4d372573207f830ce",
  ENDPOINT_SUFFIX: "r2.cloudflarestorage.com",
  WORKER_PUBLIC_URL: "https://audio.alexbrin102.workers.dev"
};

const R2_SECONDARY_CONFIG = {
  ACCESS_KEY_ID: "fdd9df8e8e4963564e4264b2bc8250c6",
  SECRET_ACCESS_KEY: "ada4a9cd24c77795f0df4d3c3fd2f41ec293f167777746134fd695fbd5248907",
  BUCKET: "audio-files-secondary",
  ACCOUNT_ID: "b673708f9f9609c4d372573207f830ce",
  ENDPOINT_SUFFIX: "r2.cloudflarestorage.com",
  WORKER_PUBLIC_URL: "https://audio-secondary.alexbrin102.workers.dev"
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

let primaryS3Client = createS3Client(R2_PRIMARY_CONFIG);
let secondaryS3Client = createS3Client(R2_SECONDARY_CONFIG);

const r2Service = {
  checkFileExists: async (originalFilename) => {
    const fileKey = originalFilename.replace(/\s+/g, '_');

    const attemptCheck = async (client, config) => {
      try {
        const command = new HeadObjectCommand({ Bucket: config.BUCKET, Key: fileKey });
        await client.send(command);
        const fileUrl = `${config.WORKER_PUBLIC_URL}/${fileKey}`;
        return { exists: true, fileUrl, bucketName: config.BUCKET };
      } catch (error) {
        if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
          return { exists: false };
        }
        console.warn(`Error checking file in R2 bucket ${config.BUCKET}:`, error);
        return { exists: false, error };
      }
    };

    const primaryCheck = await attemptCheck(primaryS3Client, R2_PRIMARY_CONFIG);
    if (primaryCheck.exists) return primaryCheck;
    const secondaryCheck = await attemptCheck(secondaryS3Client, R2_SECONDARY_CONFIG);
    if (secondaryCheck.exists) return secondaryCheck;
    return { exists: false };
  },

  uploadFile: async (file, onProgress, currentLanguage, originalFilename) => {
    const fileKey = originalFilename ? originalFilename.replace(/\s+/g, '_') : `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;

    const attemptUpload = async (client, config, isPrimaryAttempt) => {
      try {
        if (onProgress) onProgress(0);
        const arrayBuffer = await file.arrayBuffer();
        if (onProgress) onProgress(25);

        const params = {
          Bucket: config.BUCKET,
          Key: fileKey,
          Body: arrayBuffer,
          ContentType: file.type,
        };

        if (onProgress) onProgress(50);
        const command = new PutObjectCommand(params);
        await client.send(command);
        if (onProgress) onProgress(100);

        const fileUrl = `${config.WORKER_PUBLIC_URL}/${fileKey}`;
        return { fileUrl, fileKey, bucketName: config.BUCKET };
      } catch (error) {
        console.error(`Error uploading to R2 bucket ${config.BUCKET}:`, error);
        if (isPrimaryAttempt) {
          return attemptUpload(secondaryS3Client, R2_SECONDARY_CONFIG, false);
        }
        throw new Error(getLocaleString('errorUploadingToR2', currentLanguage, { errorMessage: `Bucket ${config.BUCKET}: ${error.message}` }));
      }
    };

    return attemptUpload(primaryS3Client, R2_PRIMARY_CONFIG, true);
  },

  deleteFile: async (fileKey, bucketName, currentLanguage) => {
    try {
      const { client, config } = bucketName === R2_SECONDARY_CONFIG.BUCKET
        ? { client: secondaryS3Client, config: R2_SECONDARY_CONFIG }
        : { client: primaryS3Client, config: R2_PRIMARY_CONFIG };

      const command = new DeleteObjectCommand({ Bucket: config.BUCKET, Key: fileKey });
      await client.send(command);
      return { success: true };
    } catch (error) {
      console.error('R2: deleteFile error', error);
      return { success: false, error: getLocaleString('errorDeletingR2File', currentLanguage, { fileName: fileKey, errorMessage: error.message }) };
    }
  },

  getPublicUrl: (fileKey, bucketName) => {
    const baseUrl = bucketName === R2_SECONDARY_CONFIG.BUCKET
      ? R2_SECONDARY_CONFIG.WORKER_PUBLIC_URL
      : R2_PRIMARY_CONFIG.WORKER_PUBLIC_URL;
    return `${baseUrl}/${fileKey}`;
  },

  getCompatibleUrl: (audioUrl, r2ObjectKey, r2BucketName) => {
    console.log('R2: getCompatibleUrl called with:', { audioUrl, r2ObjectKey, r2BucketName });
    if (audioUrl) {
      console.log('R2: Using provided URL as-is:', audioUrl);
      return audioUrl;
    }
    if (r2ObjectKey) {
      const baseUrl = r2BucketName === R2_SECONDARY_CONFIG.BUCKET
        ? R2_SECONDARY_CONFIG.WORKER_PUBLIC_URL
        : R2_PRIMARY_CONFIG.WORKER_PUBLIC_URL;
      const generatedUrl = `${baseUrl}/${r2ObjectKey}`;
      console.log('R2: Generated direct Worker URL from key:', generatedUrl);
      return generatedUrl;
    }
    console.log('R2: No URL could be generated');
    return null;
  },

  getWorkingAudioUrl: async (audioUrl, r2ObjectKey, r2BucketName) => {
    console.log('R2: getWorkingAudioUrl called with:', { audioUrl, r2ObjectKey, r2BucketName });
    const url = r2Service.getCompatibleUrl(audioUrl, r2ObjectKey, r2BucketName);
    if (!url) {
      return { url: null, error: 'No URL could be generated' };
    }
    return { url, source: 'direct' };
  },

  uploadFileSimple: async (file, onProgress, currentLanguage, originalFilename) => {
    return r2Service.uploadFile(file, onProgress, currentLanguage, originalFilename);
  }
};

export default r2Service;
