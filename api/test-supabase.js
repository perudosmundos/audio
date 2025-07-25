// API для тестирования подключения к Supabase
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabaseUrl = 'https://xvfopfzdmuiyoubamotb.supabase.co';
    const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2Zm9wZnpkbXVpeW91YmFtb3RiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyODExMzMsImV4cCI6MjA2NDg1NzEzM30.b0nq4Bujm9z5feMhqiXUWahYL0bFjRf2hkoPrutvN8o';

    // Тест 1: Проверка подключения к Supabase
    console.log('Testing Supabase connection...');
    
    const testResponse = await fetch(`${supabaseUrl}/rest/v1/episodes?select=count&limit=1`, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json'
      }
    });

    let connectionTest = {
      status: testResponse.status,
      ok: testResponse.ok,
      statusText: testResponse.statusText
    };

    // Тест 2: Получение количества эпизодов
    let episodesCount = 0;
    if (testResponse.ok) {
      const countResponse = await fetch(`${supabaseUrl}/rest/v1/episodes?select=count`, {
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (countResponse.ok) {
        const countData = await countResponse.json();
        episodesCount = countData.length;
      }
    }

    // Тест 3: Получение последних эпизодов
    let recentEpisodes = [];
    if (testResponse.ok) {
      const episodesResponse = await fetch(`${supabaseUrl}/rest/v1/episodes?select=slug,title,lang,date&order=created_at.desc&limit=5`, {
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (episodesResponse.ok) {
        recentEpisodes = await episodesResponse.json();
      }
    }

    res.status(200).json({
      connectionTest,
      episodesCount,
      recentEpisodes,
      supabaseUrl,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error testing Supabase:', error);
    res.status(500).json({ 
      error: 'Failed to test Supabase connection',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
} 