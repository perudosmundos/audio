
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getLocaleString } from '@/lib/locales';

const EpisodeQuestionsList = React.memo(({ questions, episodeSlug, currentLanguage }) => {
  const navigate = useNavigate();

  if (!questions || questions.length === 0) {
    return (
      <div className="mt-3 pl-2 py-1 text-xs text-slate-400">
        {getLocaleString('noQuestionsAddedYet', currentLanguage)}
      </div>
    );
  }

  const handleQuestionClick = (questionId) => {
    navigate(`/episode/${episodeSlug}#question-${questionId}&play=true`);
  };

  return (
    <div className="mt-3 pl-2">
      <div className="text-xs text-purple-300 font-semibold mb-1 py-1">
        {getLocaleString('questions', currentLanguage)} ({questions.length})
      </div>
      <ul className="space-y-1.5 overflow-hidden pl-2 border-l-2 border-purple-500/20 animate-fade-in">
        {questions.map(question => (
          <li 
            key={question.id}
            className="animate-slide-in-left"
          >
            <button 
              onClick={() => handleQuestionClick(question.id)}
              className="text-xs text-slate-300 hover:text-purple-200 hover:underline flex items-start gap-1.5 text-left w-full"
            >
              <div className="text-purple-400 shrink-0 mt-0.5">💬</div>
              <span className="flex-grow" title={question.title}>{question.title || getLocaleString('untitledQuestion', currentLanguage)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
});

export default EpisodeQuestionsList;
