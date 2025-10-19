import { Client } from 'ssh2';

const HOSTINGER_CONFIG = {
  HOST: process.env.HOSTINGER_SFTP_HOST || '82.25.67.168',
  PORT: parseInt(process.env.HOSTINGER_SFTP_PORT || '21'),
  USERNAME: process.env.HOSTINGER_SFTP_USERNAME || 'u953185577',
  PASSWORD: process.env.HOSTINGER_SFTP_PASSWORD || '',
  UPLOAD_PATH: process.env.HOSTINGER_SFTP_UPLOAD_PATH || '/public_html/wp-content/uploads/Audio/',
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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fileKey } = req.body;

    if (!fileKey) {
      return res.status(400).json({ error: 'Missing fileKey' });
    }

    const remotePath = `${HOSTINGER_CONFIG.UPLOAD_PATH}${fileKey}`;
    let connection = null;

    try {
      connection = await createSFTPConnection();
      const { conn, sftp } = connection;

      return new Promise((resolve) => {
        sftp.unlink(remotePath, (err) => {
          conn.end();
          if (err) {
            if (err.code === 2) {
              // File not found is not an error
              return resolve(res.status(200).json({ success: true }));
            }
            return resolve(res.status(500).json({ error: `Delete failed: ${err.message}` }));
          }
          resolve(res.status(200).json({ success: true }));
        });
      });
    } catch (error) {
      if (connection) {
        try {
          connection.conn.end();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      return res.status(500).json({ error: `SFTP error: ${error.message}` });
    }
  } catch (error) {
    console.error('Delete handler error:', error);
    return res.status(500).json({ error: error.message });
  }
}
