import { useState, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { getLocaleString } from '@/lib/locales';
import { supabase } from '@/lib/supabaseClient';

const useEpisodePublishing = (currentLanguage) => {
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedEpisodes, setPublishedEpisodes] = useState(new Set());
  const { toast } = useToast();

  const publishEpisode = useCallback(async (itemData) => {
    if (!itemData || !itemData.episodeSlug) {
      toast({
        title: getLocaleString('errorGeneric', currentLanguage),
        description: 'Episode data is incomplete',
        variant: 'destructive'
      });
      return false;
    }

    setIsPublishing(true);

    try {
      // Проверяем, существует ли уже эпизод в основной таблице
      const { data: existingEpisode, error: checkError } = await supabase
        .from('episodes')
        .select('id, slug, lang')
        .eq('slug', itemData.episodeSlug)
        .eq('lang', itemData.lang)
        .maybeSingle();

      if (checkError) {
        throw new Error(`Failed to check existing episode: ${checkError.message}`);
      }

      if (existingEpisode) {
        // Обновляем существующий эпизод
        const { error: updateError } = await supabase
          .from('episodes')
          .update({
            title: itemData.episodeTitle,
            updated_at: new Date().toISOString()
            // Временно убираем поля is_published и published_at
            // is_published: true,
            // published_at: new Date().toISOString()
          })
          .eq('id', existingEpisode.id);

        if (updateError) {
          throw new Error(`Failed to update episode: ${updateError.message}`);
        }
      } else {
        // Создаем новый эпизод в основной таблице
        const { error: insertError } = await supabase
          .from('episodes')
          .insert([{
            slug: itemData.episodeSlug,
            title: itemData.episodeTitle,
            lang: itemData.lang,
            date: itemData.episodeDate || new Date().toISOString().split('T')[0],
            audio_url: itemData.audioUrl,
            r2_object_key: itemData.r2ObjectKey,
            r2_bucket_name: itemData.r2BucketName,
            duration: itemData.duration || 0,
            // Временно убираем поля is_published и published_at
            // is_published: true,
            // published_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }]);

        if (insertError) {
          throw new Error(`Failed to create episode: ${insertError.message}`);
        }
      }

      // Обновляем статус транскрипции если есть
      if (itemData.transcriptionStatus === 'completed') {
        const { error: transcriptError } = await supabase
          .from('transcripts')
          .upsert([{
            episode_slug: itemData.episodeSlug,
            lang: itemData.lang,
            status: 'completed',
            content: itemData.transcriptContent || '',
            updated_at: new Date().toISOString()
          }], {
            onConflict: 'episode_slug,lang'
          });

        if (transcriptError) {
          console.warn('Warning: Failed to update transcript status:', transcriptError);
        }
      }

      // Помечаем эпизод как опубликованный
      setPublishedEpisodes(prev => new Set([...prev, itemData.id]));

      toast({
        title: getLocaleString('episodePublishedTitle', currentLanguage) || 'Episode Published',
        description: `${itemData.episodeTitle} has been published to episodes list`,
        duration: 3000
      });

      return true;

    } catch (error) {
      console.error('Error publishing episode:', error);
      toast({
        title: getLocaleString('episodePublishErrorTitle', currentLanguage) || 'Publish Error',
        description: `Failed to publish episode: ${error.message}`,
        variant: 'destructive',
        duration: 5000
      });
      return false;
    } finally {
      setIsPublishing(false);
    }
  }, [currentLanguage, toast]);

  const unpublishEpisode = useCallback(async (itemData) => {
    if (!itemData || !itemData.episodeSlug) {
      return false;
    }

    try {
      // Временно отключаем функционал unpublish
      // const { error: updateError } = await supabase
      //   .from('episodes')
      //   .update({
      //     is_published: false,
      //     published_at: null,
      //     updated_at: new Date().toISOString()
      //   })
      //   .eq('slug', itemData.episodeSlug)
      //   .eq('lang', itemData.lang);
      
      // Пока просто возвращаем true
      return true;

      if (updateError) {
        throw new Error(`Failed to unpublish episode: ${updateError.message}`);
      }

      // Убираем из списка опубликованных
      setPublishedEpisodes(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemData.id);
        return newSet;
      });

      toast({
        title: 'Episode Unpublished',
        description: `${itemData.episodeTitle} has been unpublished`,
        duration: 3000
      });

      return true;

    } catch (error) {
      console.error('Error unpublishing episode:', error);
      toast({
        title: 'Unpublish Error',
        description: `Failed to unpublish episode: ${error.message}`,
        variant: 'destructive',
        duration: 5000
      });
      return false;
    }
  }, [toast]);

  const isEpisodePublished = useCallback((itemId) => {
    return publishedEpisodes.has(itemId);
  }, [publishedEpisodes]);

  return {
    publishEpisode,
    unpublishEpisode,
    isEpisodePublished,
    isPublishing,
    publishedEpisodes: Array.from(publishedEpisodes)
  };
};

export default useEpisodePublishing;
