import { S3Client, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getLocaleString } from '@/lib/locales';
import { supabase } from './supabaseClient';

let vkCloudConfig = null;
let vkCloudS3Client = null;

const initializeVKCloud = async () => {
  if (vkCloudConfig && vkCloudS3Client) return { config: vkCloudConfig, client: vkCloudS3Client };
  
  try {
    console.log("Attempting to fetch VK Cloud credentials via Edge Function...");
    const { data, error } = await supabase.functions.invoke('get-env-variables', {
      body: { variable_names: ['VK_ACCESS_KEY_ID', 'VK_SECRET_KEY', 'VK_BUCKET_NAME', 'VK_ENDPOINT', 'VK_REGION'] },
    });

    if (error) {
      console.error('Error invoking get-env-variables Edge Function for VK Cloud:', error);
      throw new Error(`Failed to fetch VK Cloud credentials: ${error.message || 'Edge Function invocation failed'}`);
    }
    
    if (!data || !data.VK_ACCESS_KEY_ID || !data.VK_SECRET_KEY || !data.VK_BUCKET_NAME || !data.VK_ENDPOINT) {
      console.error('VK Cloud credentials not found in Edge Function response:', data);
      throw new Error('VK Cloud credentials are not available from server.');
    }

    vkCloudConfig = {
      ACCESS_KEY_ID: data.VK_ACCESS_KEY_ID,
      SECRET_ACCESS_KEY: data.VK_SECRET_KEY,
      BUCKET: data.VK_BUCKET_NAME,
      ENDPOINT: data.VK_ENDPOINT,
      REGION: data.VK_REGION || 'ru-msk',
    };

    vkCloudS3Client = new S3Client({
      region: vkCloudConfig.REGION,
      endpoint: vkCloudConfig.ENDPOINT,
      credentials: {
        accessKeyId: vkCloudConfig.ACCESS_KEY_ID,
        secretAccessKey: vkCloudConfig.SECRET_ACCESS_KEY,
      },
      forcePathStyle: true, // VK Cloud requires path-style URLs
    });

    console.log("VK Cloud credentials fetched and client initialized successfully.");
    return { config: vkCloudConfig, client: vkCloudS3Client };
  } catch (error) {
    console.error('Error initializing VK Cloud:', error);
    throw error;
  }
};

const vkCloudService = {
  checkFileExists: async (originalFilename) => {
    try {
      const { config, client } = await initializeVKCloud();
      const fileKey = originalFilename.replace(/\s+/g, '_');
      
      try {
        const command = new HeadObjectCommand({ Bucket: config.BUCKET, Key: fileKey });
        await client.send(command);
        
        // Construct public URL for VK Cloud
        const fileUrl = `${config.ENDPOINT}/${config.BUCKET}/${fileKey}`;
        return { exists: true, fileUrl, bucketName: config.BUCKET };
      } catch (error) {
        if (error.name === 'NoSuchKey' || (error.$metadata && error.$metadata.httpStatusCode === 404)) {
          return { exists: false };
        }
        console.warn(`Error checking file in VK Cloud bucket ${config.BUCKET}:`, error);
        return { exists: false, error: error };
      }
    } catch (error) {
      console.error('Error initializing VK Cloud for file check:', error);
      return { exists: false, error: error };
    }
  },

  uploadFile: async (file, onProgress, currentLanguage, originalFilename) => {
    try {
      const { config, client } = await initializeVKCloud();
      const fileKey = originalFilename ? originalFilename.replace(/\s+/g, '_') : `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
      
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

      // Construct public URL for VK Cloud
      const fileUrl = `${config.ENDPOINT}/${config.BUCKET}/${fileKey}`;
      return { fileUrl, fileKey, bucketName: config.BUCKET };
    } catch (error) {
      console.error(`Error uploading to VK Cloud bucket:`, error);
      throw new Error(getLocaleString('errorUploadingToVKCloud', currentLanguage, {errorMessage: error.message}));
    }
  },

  deleteFile: async (fileKey, bucketName, currentLanguage) => {
    try {
      const { config, client } = await initializeVKCloud();
      
      // Verify bucket name matches
      if (bucketName !== config.BUCKET) {
        return { success: false, error: getLocaleString('unknownBucketError', currentLanguage, { bucketName: bucketName }) };
      }

      try {
        const command = new DeleteObjectCommand({ Bucket: config.BUCKET, Key: fileKey });
        await client.send(command);
        return { success: true };
      } catch (error) {
        console.error(`Error deleting file ${fileKey} from VK Cloud bucket ${config.BUCKET}:`, error);
        return { success: false, error: getLocaleString('errorDeletingVKCloudFile', currentLanguage, { fileName: fileKey, errorMessage: error.message }) };
      }
    } catch (error) {
      console.error('Error initializing VK Cloud for file deletion:', error);
      return { success: false, error: getLocaleString('errorDeletingVKCloudFile', currentLanguage, { fileName: fileKey, errorMessage: error.message }) };
    }
  },

  getPublicUrl: async (fileKey, bucketName) => {
    try {
      const { config } = await initializeVKCloud();
      
      // Verify bucket name matches
      if (bucketName !== config.BUCKET) {
        console.warn(`Bucket name mismatch: expected ${config.BUCKET}, got ${bucketName}`);
      }
      
      return `${config.ENDPOINT}/${config.BUCKET}/${fileKey}`;
    } catch (error) {
      console.error('Error getting VK Cloud public URL:', error);
      throw error;
    }
  }
};

export default vkCloudService; 