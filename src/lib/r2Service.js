import { S3Client, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getLocaleString } from '@/lib/locales'; 

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
        return { exists: true, fileUrl: `${config.WORKER_PUBLIC_URL}/${fileKey}`, bucketName: config.BUCKET };
      } catch (error) {
        if (error.name === 'NoSuchKey' || (error.$metadata && error.$metadata.httpStatusCode === 404)) {
          return { exists: false };
        }
        console.warn(`Error checking file in R2 bucket ${config.BUCKET}:`, error);
        return { exists: false, error: error }; 
      }
    };

    let primaryCheck = await attemptCheck(primaryS3Client, R2_PRIMARY_CONFIG);
    if (primaryCheck.exists) return primaryCheck;
    if (primaryCheck.error && primaryCheck.error.name !== 'NoSuchKey' && (!primaryCheck.error.$metadata || primaryCheck.error.$metadata.httpStatusCode !== 404)) {
        console.warn("Primary R2 check failed with non-404 error. Trying secondary without assuming primary is full.");
    }

    let secondaryCheck = await attemptCheck(secondaryS3Client, R2_SECONDARY_CONFIG);
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
          console.warn(`Primary R2 upload failed for ${fileKey}. Attempting secondary.`);
          return attemptUpload(secondaryS3Client, R2_SECONDARY_CONFIG, false);
        }
        throw new Error(getLocaleString('errorUploadingToR2', currentLanguage, {errorMessage: `Bucket ${config.BUCKET}: ${error.message}`}));
      }
    };

    return attemptUpload(primaryS3Client, R2_PRIMARY_CONFIG, true);
  },

  deleteFile: async (fileKey, bucketName, currentLanguage) => {
    let client;
    let config;

    if (bucketName === R2_PRIMARY_CONFIG.BUCKET) {
      client = primaryS3Client;
      config = R2_PRIMARY_CONFIG;
    } else if (bucketName === R2_SECONDARY_CONFIG.BUCKET) {
      client = secondaryS3Client;
      config = R2_SECONDARY_CONFIG;
    } else {
      return { success: false, error: getLocaleString('unknownBucketError', currentLanguage, { bucketName: bucketName }) };
    }

    try {
      const command = new DeleteObjectCommand({ Bucket: config.BUCKET, Key: fileKey });
      await client.send(command);
      return { success: true };
    } catch (error) {
      console.error(`Error deleting file ${fileKey} from R2 bucket ${config.BUCKET}:`, error);
      return { success: false, error: getLocaleString('errorDeletingR2File', currentLanguage, { fileName: fileKey, errorMessage: error.message }) };
    }
  },

  getPublicUrl: (fileKey, bucketName) => {
    if (bucketName === R2_SECONDARY_CONFIG.BUCKET) {
      return `${R2_SECONDARY_CONFIG.WORKER_PUBLIC_URL}/${fileKey}`;
    }
    return `${R2_PRIMARY_CONFIG.WORKER_PUBLIC_URL}/${fileKey}`;
  }
};

export default r2Service;