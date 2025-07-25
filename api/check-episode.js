import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bqjqjqjqjqjqjqjqjqj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxanFqcWpxanFqcWpxanFqcWpxanFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU5NzI5NzQsImV4cCI6MjA1MTU0ODk3NH0.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8';

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { slug } = req.query;
  
  if (!slug) {
    return res.status(400).json({ error: 'Slug parameter is required' });
  }

  try {
    // Ищем эпизод по точному slug
    const { data: exactEpisode, error: exactError } = await supabase
      .from('episodes')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (exactError) {
      throw exactError;
    }

    // Если точного совпадения нет, ищем похожие
    let similarEpisodes = [];
    if (!exactEpisode) {
      const { data: similar, error: similarError } = await supabase
        .from('episodes')
        .select('*')
        .ilike('slug', `%${slug}%`)
        .limit(10);

      if (similarError) {
        throw similarError;
      }
      similarEpisodes = similar || [];
    }

    // Получаем все эпизоды с похожей датой
    const datePart = slug.split('_')[0];
    const { data: dateEpisodes, error: dateError } = await supabase
      .from('episodes')
      .select('*')
      .ilike('slug', `${datePart}%`)
      .limit(10);

    if (dateError) {
      throw dateError;
    }

    res.status(200).json({
      requestedSlug: slug,
      exactMatch: exactEpisode,
      similarEpisodes,
      episodesWithSameDate: dateEpisodes || [],
      allEpisodes: exactEpisode ? [exactEpisode] : similarEpisodes
    });

  } catch (error) {
    console.error('Error checking episode:', error);
    res.status(500).json({ 
      error: 'Failed to check episode',
      details: error.message
    });
  }
} 