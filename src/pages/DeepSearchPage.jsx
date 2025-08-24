import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Search as SearchIcon, ArrowLeft, FileText, MessageSquare } from 'lucide-react';
import { getLocaleString, getPluralizedLocaleString } from '@/lib/locales';
import { formatShortDate } from '@/lib/utils';
import { motion } from 'framer-motion';
import Fuse from 'fuse.js';

const HighlightedText = ({ text, highlightParts }) => {
  if (!highlightParts || highlightParts.length === 0 || !text) return text;

  const regex = new RegExp(`(${highlightParts.map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) => {
        const isMatch = highlightParts.some(hp => part.toLowerCase() === hp.toLowerCase());
        return isMatch ? (
          <span key={i} className="bg-yellow-400/70 text-slate-900 px-0.5 rounded-sm">
            {part}
          </span>
        ) : (
          part
        );
      })}
    </>
  );
};

const SearchResultItem = ({ item, searchTerm, type, episodeTitle }) => {
  const Icon = type === 'question' ? MessageSquare : FileText;
  let displayTitle = '';
  let linkTarget = '';

  if (type === 'question') {
    displayTitle = `${item.questionTitle} (${episodeTitle})`;
    linkTarget = `/episode/${item.episodeSlug}#question-${item.questionId}&play=true`;
  } else { // textInEpisode
    if (item.questionContext) {
      displayTitle = `${getLocaleString('question', item.currentLanguage)}: ${item.questionContext} (${episodeTitle})`;
    } else {
      displayTitle = `(${episodeTitle})`; 
    }
    linkTarget = `/episode/${item.episodeSlug}#segment-${item.segmentStart}&play=true`;
  }
  
  const textToHighlight = type === 'question' ? item.questionTitle : item.segmentText;

  return (
     <motion.li
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="p-3 bg-slate-700/60 rounded-lg hover:bg-slate-600/70 transition-colors"
    >
      <Link 
        to={linkTarget}
        className="block group"
      >
        <div className="text-sm text-slate-200 flex items-start mb-1">
          <Icon className="inline h-4 w-4 mr-2 text-purple-400 flex-shrink-0 mt-0.5" />
          <span className="flex-grow font-semibold">
             <HighlightedText text={displayTitle} highlightParts={searchTerm.toLowerCase().split(/\s+/).filter(Boolean)} />
          </span>
        </div>
        {type === 'textInEpisode' && (
          <div className="text-xs text-slate-300 max-h-20 overflow-y-auto custom-scrollbar pl-6">
            <HighlightedText text={item.segmentText} highlightParts={searchTerm.toLowerCase().split(/\s+/).filter(Boolean)} />
          </div>
        )}
      </Link>
    </motion.li>
  )
}

const DeepSearchPage = ({ currentLanguage }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialQuery = searchParams.get('query') || '';
  
  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const [inputTerm, setInputTerm] = useState(initialQuery);
  
  const [allResults, setAllResults] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);
  const [episodeTitlesMap, setEpisodeTitlesMap] = useState({});


  const formatEpisodeTitleForDisplay = (title, episodeDate, episodeLang, langForDisplay) => {
    const effectiveLang = episodeLang === 'all' ? langForDisplay : episodeLang;
    const prefix = getLocaleString('meditationTitlePrefix', effectiveLang);
    let datePart = '';
    if (episodeDate) {
      datePart = formatShortDate(episodeDate, effectiveLang);
    }
    return datePart ? `${prefix} ${datePart}` : title || prefix;
  };

  const fetchDeepSearchResults = useCallback(async (query) => {
    if (!query || query.trim().length < 2) {
      setAllResults([]);
      setError(getLocaleString('deepSearchMinChars', currentLanguage));
      setLoading(false);
      setSearched(true);
      return;
    }

    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const { data: dbEpisodes, error: episodesError } = await supabase
        .from('episodes')
        .select('slug, title, date, lang')
        .or(`lang.eq.${currentLanguage},lang.eq.all`);
      if (episodesError) throw episodesError;

      const tempEpisodeTitlesMap = dbEpisodes.reduce((acc, ep) => {
        acc[ep.slug] = formatEpisodeTitleForDisplay(ep.title, ep.date, ep.lang, currentLanguage);
        return acc;
      }, {});
      setEpisodeTitlesMap(tempEpisodeTitlesMap);
      
      const { data: dbQuestions, error: questionsError } = await supabase
        .from('questions')
        .select('id, episode_slug, title, lang, time')
        .or(`lang.eq.${currentLanguage},lang.eq.all`);
      if (questionsError) throw questionsError;

      const { data: dbTranscripts, error: transcriptsError } = await supabase
        .from('transcripts')
        .select('episode_slug, lang, edited_transcript_data')
        .or(`lang.eq.${currentLanguage},lang.eq.all`);
      if (transcriptsError) throw transcriptsError;

      let combinedResults = [];

      const fuseOptionsQuestions = {
        keys: ['title'],
        includeScore: true,
        threshold: 0.4,
      };
      const fuseQuestions = new Fuse(dbQuestions.filter(q => {
          const episode = dbEpisodes.find(ep => ep.slug === q.episode_slug);
          return episode && 
                 (episode.lang === 'all' ? q.lang === currentLanguage : q.lang === episode.lang) &&
                 (q.is_intro || q.is_full_transcript || q.id === 'intro-virtual' || (q.title && q.title.trim() !== ''));
      }), fuseOptionsQuestions);
      
      const questionResults = fuseQuestions.search(query);

      questionResults.forEach(result => {
        const question = result.item;
        const episode = dbEpisodes.find(ep => ep.slug === question.episode_slug);
        if (!episode) return;

        combinedResults.push({
          type: 'question',
          id: `q-${question.id}`,
          episodeSlug: question.episode_slug,
          questionId: question.id,
          questionTitle: question.title,
          segmentStart: question.time * 1000,
          currentLanguage: currentLanguage,
          score: result.score 
        });
      });
      
      const allUtterancesForSearch = [];
      dbTranscripts.forEach(transcript => {
        const episode = dbEpisodes.find(ep => ep.slug === transcript.episode_slug);
        if (!episode || (episode.lang !== 'all' && episode.lang !== currentLanguage)) return;

        const utterances = transcript.edited_transcript_data?.utterances || [];
        utterances.forEach(utt => {
            allUtterancesForSearch.push({
                text: utt.text,
                start: utt.start,
                episodeSlug: transcript.episode_slug,
                episodeLang: episode.lang,
                id: `${transcript.episode_slug}-${utt.start}-${Math.random().toString(36).substring(7)}`
            });
        });
      });

      const fuseOptionsText = {
        keys: ['text'],
        includeScore: true,
        threshold: 0.4, 
        minMatchCharLength: Math.max(1, Math.floor(query.length / 2)),
      };
      const fuseText = new Fuse(allUtterancesForSearch, fuseOptionsText);
      const textResults = fuseText.search(query);

      textResults.forEach(result => {
        const segment = result.item;
        const episode = dbEpisodes.find(ep => ep.slug === segment.episodeSlug);
        if (!episode) return;
        
        const questionContext = dbQuestions.find(q => 
            q.episode_slug === segment.episodeSlug &&
            (episode.lang === 'all' ? q.lang === currentLanguage : q.lang === episode.lang) &&
            (q.is_intro || q.is_full_transcript || q.id === 'intro-virtual' || (q.title && q.title.trim() !== '')) &&
            segment.start >= (q.time * 1000) &&
            (dbQuestions.filter(nq => nq.episode_slug === segment.episodeSlug && (episode.lang === 'all' ? nq.lang === currentLanguage : nq.lang === episode.lang) && nq.time > q.time).sort((a,b) => a.time - b.time)[0]?.time * 1000 || Infinity) > segment.start
        )?.title;

        combinedResults.push({
          type: 'textInEpisode',
          episodeSlug: segment.episodeSlug,
          segmentStart: segment.start,
          segmentText: segment.text,
          id: segment.id,
          questionContext: questionContext,
          currentLanguage: currentLanguage,
          score: result.score
        });
      });
      
      combinedResults.sort((a, b) => (a.score ?? 1) - (b.score ?? 1));
      setAllResults(combinedResults);

    } catch (err) {
      console.error("Deep search error:", err);
      setError(getLocaleString('errorPerformingSearch', currentLanguage, { errorMessage: err.message }));
      setAllResults([]);
    } finally {
      setLoading(false);
    }
  }, [currentLanguage]);

  useEffect(() => {
    if (initialQuery) {
      fetchDeepSearchResults(initialQuery);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const handleSearch = (e) => {
    e.preventDefault();
    setSearchParams({ query: inputTerm });
    setSearchTerm(inputTerm); 
    fetchDeepSearchResults(inputTerm);
  };
  
  const totalResultCount = allResults.length;

  return (
    <div className="container mx-auto p-2 sm:p-4 max-w-2xl">
      <Button 
        variant="outline" 
        onClick={() => navigate('/episodes')} 
        className="mb-6 bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-300"
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> {getLocaleString('backToEpisodes', currentLanguage)}
      </Button>
      <div className="flex items-center mb-6">
        <h1 className="text-3xl font-bold text-purple-300">{getLocaleString('search', currentLanguage)}</h1>
      </div>
      <form onSubmit={handleSearch} className="mb-8">
        <div className="relative flex items-center gap-2">
          <Input
            type="search"
            value={inputTerm}
            onChange={(e) => setInputTerm(e.target.value)}
            placeholder={getLocaleString('deepSearchPlaceholder', currentLanguage)}
            className="pl-10 flex-grow bg-slate-800/70 border-slate-700 focus:border-purple-500 text-white placeholder-slate-400 h-11"
          />
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
          <Button type="submit" className="bg-purple-600 hover:bg-purple-700 h-11" disabled={loading}>
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <SearchIcon className="h-5 w-5" />}
            <span className="ml-2 hidden sm:inline">{getLocaleString('search', currentLanguage)}</span>
          </Button>
        </div>
      </form>

      {loading && (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-12 w-12 animate-spin text-purple-400" />
          <p className="ml-4 text-lg">{getLocaleString('searching', currentLanguage)}...</p>
        </div>
      )}

      {!loading && error && (
        <div className="text-center p-6 bg-red-700/20 rounded-lg">
          <p className="text-red-400">{error}</p>
        </div>
      )}
      
      {!loading && !error && searched && totalResultCount === 0 && (
         <div className="text-center py-10">
            <SearchIcon className="mx-auto h-16 w-16 text-gray-500" />
            <p className="mt-4 text-lg text-gray-400">
                {getLocaleString('noResultsFoundForQuery', currentLanguage, { query: searchTerm })}
            </p>
         </div>
      )}

      {!loading && !error && totalResultCount > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-slate-200 mb-6">
            {getPluralizedLocaleString('searchResultsCount', currentLanguage, totalResultCount, { count: totalResultCount, query: searchTerm })}
          </h2>
          
          <motion.ul
            initial="hidden"
            animate="visible"
            variants={{
              visible: { opacity: 1, transition: { staggerChildren: 0.07 } },
              hidden: { opacity: 0 },
            }}
            className="space-y-3"
          >
            {allResults.map((item) => (
              <SearchResultItem 
                key={item.id} 
                item={item} 
                searchTerm={searchTerm} 
                type={item.type}
                episodeTitle={episodeTitlesMap[item.episodeSlug] || item.episodeSlug}
              />
            ))}
          </motion.ul>
        </div>
      )}
    </div>
  );
};

export default DeepSearchPage;