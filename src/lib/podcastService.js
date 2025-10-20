const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

const parseTimeToSeconds = (timeStr) => {
  if (!timeStr) return 0;
  const parts = String(timeStr).split(':').map(Number);
  let seconds = 0;
  if (parts.length === 3) { // HH:MM:SS or H:MM:SS
    seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) { // MM:SS or M:SS
    seconds = parts[0] * 60 + parts[1];
  } else if (parts.length === 1 && !isNaN(parts[0])) { // Seconds
    seconds = parts[0];
  }
  return seconds;
};

export const parseQuestionsFromDescriptionString = (descriptionText, episodeLang, episodeSlug) => {
  if (!descriptionText) return [];
  const questions = [];
  
  const lineRegex = /^((\d{1,2}:)?\d{1,2}:\d{1,2})\s+(.*)/gm;
  let match;

  while ((match = lineRegex.exec(descriptionText)) !== null) {
    const time = parseTimeToSeconds(match[1]);
    let titleText = match[3].trim();

    const bilingualSeparator = " / ";
    const separatorIndex = titleText.indexOf(bilingualSeparator);

    if (separatorIndex !== -1) {
      const text1 = titleText.substring(0, separatorIndex).trim();
      const text2 = titleText.substring(separatorIndex + bilingualSeparator.length).trim();
      
      let lang1, lang2;
      if (episodeLang === 'ru') {
        lang1 = 'ru'; lang2 = 'es';
      } else if (episodeLang === 'es') {
        lang1 = 'es'; lang2 = 'ru';
      } else { 
        lang1 = 'ru'; lang2 = 'es';
      }
      
      if (text1) {
        questions.push({ 
          time, 
          title: text1, 
          lang: lang1, 
          episode_slug: episodeSlug, 
        });
      }
      if (text2) {
        questions.push({ 
          time, 
          title: text2, 
          lang: lang2, 
          episode_slug: episodeSlug, 
        });
      }
    } else {
      if (episodeLang === 'all' || episodeLang === 'neutral') {
        if (titleText) {
          questions.push({ 
            time, 
            title: titleText, 
            lang: 'ru', 
            episode_slug: episodeSlug, 
          });
          questions.push({ 
            time, 
            title: titleText, 
            lang: 'es', 
            episode_slug: episodeSlug, 
          });
        }
      } else {
        if (titleText) {
          questions.push({ 
            time, 
            title: titleText, 
            lang: episodeLang, 
            episode_slug: episodeSlug, 
          });
        }
      }
    }
  }
  
  // Сортируем вопросы по времени
  return questions.sort((a, b) => (a.time || 0) - (b.time || 0));
};


const parseDuration = (durationString) => {
  if (!durationString) return 0;
  if (typeof durationString === 'number') return durationString;

  const parts = String(durationString).split(':').map(Number);
  let seconds = 0;
  if (parts.length === 3) { // HH:MM:SS
    seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) { // MM:SS
    seconds = parts[0] * 60 + parts[1];
  } else if (parts.length === 1 && !isNaN(parts[0])) { // Seconds as string or number
    seconds = parts[0];
  } else {
    const isoMatch = String(durationString).match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (isoMatch) {
      const hours = parseInt(isoMatch[1] || 0);
      const minutes = parseInt(isoMatch[2] || 0);
      const secs = parseInt(isoMatch[3] || 0);
      return (hours * 3600) + (minutes * 60) + secs;
    }
  }
  return seconds;
};

const getElementTextContent = (element, tagName, namespace = null) => {
  const child = namespace ? element.getElementsByTagNameNS(namespace, tagName)[0] : element.getElementsByTagName(tagName)[0];
  return child ? child.textContent : null;
};

const getElementAttribute = (element, tagName, attributeName, namespace = null) => {
  const child = namespace ? element.getElementsByTagNameNS(namespace, tagName)[0] : element.getElementsByTagName(tagName)[0];
  return child ? child.getAttribute(attributeName) : null;
};

export const extractEpisodeDetails = (title) => {
  if (!title) return { lang: 'all', date: null, titleIdentifier: 'unknown', cleanTitle: 'Без названия' };

  let cleanTitle = title;
  let lang = 'all'; 
  let date = null;
  let titleIdentifier = title; 

  const langMatchRU = title.match(/(.*)\sRU$/i);
  if (langMatchRU) {
    lang = 'ru';
    cleanTitle = langMatchRU[1].trim();
    titleIdentifier = cleanTitle;
  } else {
    const langMatchES = title.match(/(.*)\sES$/i);
    if (langMatchES) {
      lang = 'es';
      cleanTitle = langMatchES[1].trim();
      titleIdentifier = cleanTitle;
    }
  }
  
  const dateRegex = /(.*?)(\s*\d{1,2}\.\d{1,2}\.(?:\d{2}|\d{4}))$/;
  const dateMatch = titleIdentifier.match(dateRegex); 

  if (dateMatch) {
    titleIdentifier = dateMatch[1].trim(); 
    const dateString = dateMatch[2].trim();
    const dateParts = dateString.split('.');
    const day = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10); 
    let year = parseInt(dateParts[2], 10);
    if (year < 100) { 
      year += 2000;
    }
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        const d = new Date(Date.UTC(year, month - 1, day));
        if (!isNaN(d.getTime())) {
          date = d.toISOString().split('T')[0];
        } else {
          console.warn("Invalid date created for:", title, dateString);
        }
    } else {
       console.warn("Could not parse date parts for:", title, dateString);
    }
  } 
  return { lang, date, titleIdentifier, cleanTitle: title }; 
};


export const fetchPodcastData = async (rssUrl = 'https://anchor.fm/s/49ced044/podcast/rss') => {
  try {
    const response = await fetch(`${CORS_PROXY}${encodeURIComponent(rssUrl)}`);
    if (!response.ok) {
      throw new Error(`Network response was not ok: ${response.statusText}`);
    }
    const text = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, "application/xml");

    const errorNode = xmlDoc.querySelector("parsererror");
    if (errorNode) {
      console.error("Error parsing XML:", errorNode.textContent);
      throw new Error("Ошибка парсинга XML-фида.");
    }
    
    const channel = xmlDoc.querySelector("channel");
    if (!channel) {
        throw new Error("Не найден 'channel' тег в RSS-фиде.");
    }

    const itunesNS = "http://www.itunes.com/dtds/podcast-1.0.dtd";
    const contentNS = "http://purl.org/rss/1.0/modules/content/";

    const podcastTitle = getElementTextContent(channel, 'title') || 'Подкаст без названия';
    const podcastAuthor = getElementTextContent(channel, 'author', itunesNS) || getElementTextContent(channel, 'author') || 'Неизвестный автор';
    
    let podcastDescription = getElementTextContent(channel, 'description');
    if (!podcastDescription || podcastDescription.length < 50) { 
        podcastDescription = getElementTextContent(channel, 'summary', itunesNS) || podcastDescription || 'Описание отсутствует.';
    }


    const podcastImage = getElementAttribute(channel, 'image', 'href', itunesNS) 
                        || (channel.querySelector('image') ? getElementTextContent(channel.querySelector('image'), 'url') : null)
                        || null;

    const episodes = Array.from(channel.querySelectorAll("item")).map(item => {
      const enclosure = item.querySelector("enclosure");
      const guid = getElementTextContent(item, 'guid') || (enclosure ? enclosure.getAttribute('url') : null);
      const link = getElementTextContent(item, 'link');
      const originalTitle = getElementTextContent(item, 'title') || 'Эпизод без названия';
      
      let episodeDescriptionText = getElementTextContent(item, 'description');
      if (!episodeDescriptionText || episodeDescriptionText.length < 10) { 
          episodeDescriptionText = getElementTextContent(item, 'summary', itunesNS) || episodeDescriptionText;
      }
      if (!episodeDescriptionText || episodeDescriptionText.length < 10) {
         episodeDescriptionText = getElementTextContent(item, 'encoded', contentNS) || episodeDescriptionText;
      }
      episodeDescriptionText = episodeDescriptionText || ''; 

      return {
        id: guid || link || originalTitle, 
        title: originalTitle, 
        description: episodeDescriptionText,
        pubDate: getElementTextContent(item, 'pubDate') ? new Date(getElementTextContent(item, 'pubDate')).toISOString() : new Date().toISOString(),
        duration: parseDuration(getElementTextContent(item, 'duration', itunesNS) || '0'),
        audioUrl: enclosure ? enclosure.getAttribute('url') : null,
        image: getElementAttribute(item, 'image', 'href', itunesNS) || podcastImage,
        questions: [], 
      };
    });

    return {
      title: podcastTitle,
      author: podcastAuthor,
      description: podcastDescription,
      image: podcastImage,
      episodes: episodes,
    };

  } catch (error) {
    console.error('Error fetching or parsing podcast data:', error);
    if (error.message.includes('Non-UTF-8 encoding')) {
        throw new Error('Ошибка кодировки RSS-канала. Пожалуйста, проверьте корректность RSS.');
    }
    if (error.message.toLowerCase().includes('failed to fetch') || error.message.toLowerCase().includes('networkerror') || error.message.toLowerCase().includes('network response was not ok')) {
        throw new Error('Сетевая ошибка при загрузке RSS. Проверьте ваше интернет-соединение или доступность прокси-сервера.');
    }
    throw new Error(`Не удалось загрузить данные подкаста: ${error.message}`);
  }
};