import { Client } from 'ssh2';

const HOSTINGER_CONFIG = {
  HOST: process.env.HOSTINGER_SFTP_HOST || '82.25.67.168',
  PORT: parseInt(process.env.HOSTINGER_SFTP_PORT || '21'),
  USERNAME: process.env.HOSTINGER_SFTP_USERNAME || 'u953185577',
  PASSWORD: process.env.HOSTINGER_SFTP_PASSWORD || '',
  UPLOAD_PATH: process.env.HOSTINGER_SFTP_UPLOAD_PATH || '/public_html/wp-content/uploads/Audio/',
  PUBLIC_URL: process.env.HOSTINGER_PUBLIC_URL || 'https://dosmundos.pe/wp-content/uploads/Audio/',
};

const createSFTPConnection = () => {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    
    conn.on('ready', () => {
      conn.sftp((err, sftp) => {
        if (err) {
          conn.end();
          reject(err);
        } else {
          resolve({ conn, sftp });
        }
      });
    });

    conn.on('error', (err) => {
      reject(err);
    });

    conn.connect({
      host: HOSTINGER_CONFIG.HOST,
      port: HOSTINGER_CONFIG.PORT,
      username: HOSTINGER_CONFIG.USERNAME,
      password: HOSTINGER_CONFIG.PASSWORD,
      readyTimeout: 30000,
    });

    setTimeout(() => {
      if (!conn.authenticated) {
        conn.end();
        reject(new Error('SFTP connection timeout'));
      }
    }, 35000);
  });
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const connection = await createSFTPConnection();
    const { conn, sftp } = connection;

    // Сканируем папку /Audio
    const files = await new Promise((resolve, reject) => {
      sftp.readdir(HOSTINGER_CONFIG.UPLOAD_PATH, (err, list) => {
        if (err) {
          reject(err);
        } else {
          resolve(list);
        }
      });
    });

    conn.end();

    // Фильтруем только .mp3 файлы
    const mp3Files = files
      .filter(file => file.filename.endsWith('.mp3'))
      .map(file => ({
        fileName: file.filename,
        fileUrl: `${HOSTINGER_CONFIG.PUBLIC_URL}${file.filename}`,
        size: file.attrs.size,
        modified: file.attrs.mtime
      }));

    return res.status(200).json({
      success: true,
      files: mp3Files,
      total: mp3Files.length
    });

  } catch (error) {
    console.error('Hostinger scan error:', error);
    return res.status(500).json({ 
      error: `SFTP error: ${error.message}` 
    });
  }
}
