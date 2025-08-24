import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { getLocaleString } from '@/lib/locales';
import EpisodesList from '@/components/episodes/EpisodesList';
import EpisodesPageHeader from '@/components/episodes/EpisodesPageHeader';
import FilterAndSearchControls from '@/components/episodes/FilterAndSearchControls';
import EmptyState from '@/components/episodes/EmptyState';

const EpisodesPage = ({ currentLanguage }) => {
  const [episodes, setEpisodes] = useState([]);
  const [allQuestions, setAllQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [episodeQuestionsCount, setEpisodeQuestionsCount] = useState({});

  const [availableYears, setAvailableYears] = useState([]);
  const [availableMonths, setAvailableMonths] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);

  const monthLabels = [
    "january", "february", "march", "april", "may", "june", 
    "july", "august", "september", "october", "november", "december"
  ];


  const fetchEpisodesAndData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: episodesData, error: episodesError } = await supabase
        .from('episodes')
        .select('slug, title, lang, audio_url, duration, date, created_at, file_has_lang_suffix, r2_object_key, r2_bucket_name')
        .order('date', { ascending: false });

      if (episodesError) throw episodesError;
      
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('episode_slug, id, title, lang'); 
      
      if (questionsError) throw questionsError;
      setAllQuestions(questionsData || []);
      
      const langFilteredEpisodes = episodesData.filter(ep => 
        ep.lang === currentLanguage || ep.lang === 'all'
      );
      
      const counts = {};
      const years = new Set();
      langFilteredEpisodes.forEach(ep => {
        if (ep.date) {
          years.add(new Date(ep.date).getFullYear().toString());
        }
        counts[ep.slug] = counts[ep.slug] || {};
        ['ru', 'es', 'en'].forEach(lang => {
           counts[ep.slug][lang] = (questionsData || []).filter(q => 
             q.episode_slug === ep.slug && 
             q.lang === lang && 
             (q.is_intro || q.is_full_transcript || q.id === 'intro-virtual' || (q.title && q.title.trim() !== ''))
           ).length;
        });
      });
      
      setAvailableYears(Array.from(years).sort((a,b) => Number(b) - Number(a)));
      setEpisodeQuestionsCount(counts);
      setEpisodes(langFilteredEpisodes);

    } catch (err) {
      setError(getLocaleString('errorFetchingEpisodes', currentLanguage, { errorMessage: err.message }));
    } finally {
      setLoading(false);
    }
  }, [currentLanguage]);

  useEffect(() => {
    fetchEpisodesAndData();
    const channel = supabase
      .channel('episodes-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'episodes' }, fetchEpisodesAndData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'questions' }, fetchEpisodesAndData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };

  }, [fetchEpisodesAndData]);

  useEffect(() => {
    if (selectedYear) {
      const months = new Set();
      episodes.forEach(ep => {
        if (ep.date && new Date(ep.date).getFullYear().toString() === selectedYear) {
          months.add(new Date(ep.date).getMonth());
        }
      });
      const sortedMonths = Array.from(months).sort((a,b) => a - b);
      setAvailableMonths(sortedMonths.map(m => ({ value: (m + 1).toString(), labelKey: monthLabels[m] })));
    } else {
      setAvailableMonths([]);
      setSelectedMonth(null);
    }
  }, [selectedYear, episodes, monthLabels]);
  
  const handleResetFilters = () => {
    setSelectedYear(null);
    setSelectedMonth(null);
  };

  const filteredEpisodes = useMemo(() => {
    let tempEpisodes = episodes;

    if (selectedYear) {
      tempEpisodes = tempEpisodes.filter(ep => ep.date && new Date(ep.date).getFullYear().toString() === selectedYear);
      if (selectedMonth) {
        tempEpisodes = tempEpisodes.filter(ep => ep.date && (new Date(ep.date).getMonth() + 1).toString() === selectedMonth);
      }
    }
    
    return tempEpisodes;
  }, [episodes, selectedYear, selectedMonth]);


  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-purple-400" />
        <p className="mt-4 text-lg">{getLocaleString('loadingEpisodes', currentLanguage)}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8 bg-red-700/30 rounded-lg shadow-xl max-w-2xl mx-auto">
        <h2 className="text-xl font-bold mb-2">{getLocaleString('errorLoadingData', currentLanguage)}</h2>
        <p className="max-w-md mx-auto">{error}</p>
        <Button onClick={fetchEpisodesAndData} className="mt-4 bg-blue-500 hover:bg-blue-600">
          {getLocaleString('tryAgain', currentLanguage)}
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-2 sm:p-4 max-w-2xl">
      <EpisodesPageHeader 
        currentLanguage={currentLanguage}
      />
      <FilterAndSearchControls
        years={availableYears}
        months={availableMonths}
        selectedYear={selectedYear}
        setSelectedYear={setSelectedYear}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        currentLanguage={currentLanguage}
        onResetFilters={handleResetFilters}
      />

      {filteredEpisodes.length === 0 ? (
        <EmptyState currentLanguage={currentLanguage} />
      ) : (
        <EpisodesList 
          episodes={filteredEpisodes} 
          currentLanguage={currentLanguage} 
          episodeQuestionsCount={episodeQuestionsCount}
          allQuestions={allQuestions}
        />
      )}
    </div>
  );
};

export default EpisodesPage;
