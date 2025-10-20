import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import migrationService from '@/lib/migrationService';
import logger from '@/lib/logger';
import { getLocaleString } from '@/lib/locales';

export default function StorageMigrationPage() {
  const { toast } = useToast();
  const [currentLanguage] = useState('en');
  
  // State
  const [episodes, setEpisodes] = useState([]);
  const [selectedEpisodes, setSelectedEpisodes] = useState(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState(null);
  const [migrationResults, setMigrationResults] = useState(null);
  const [migrationStatus, setMigrationStatus] = useState(null);
  const [canStopMigration, setCanStopMigration] = useState(false);
  
  const stopMigrationRef = useRef(false);

  // Load episodes on mount
  useEffect(() => {
    loadEpisodes();
  }, []);

  // Load migration status on mount
  useEffect(() => {
    loadMigrationStatus();
  }, []);

  const loadEpisodes = async () => {
    setIsLoading(true);
    try {
      const result = await migrationService.getEpisodesToMigrate();
      if (result.success) {
        setEpisodes(result.episodes || []);
        logger.info(`[MigrationPage] Loaded ${result.count} episodes for migration`);
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      }
    } catch (error) {
      logger.error('[MigrationPage] Error loading episodes:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const loadMigrationStatus = async () => {
    try {
      const status = await migrationService.getMigrationStatus();
      if (status.success) {
        setMigrationStatus(status);
      }
    } catch (error) {
      logger.error('[MigrationPage] Error loading migration status:', error);
    }
  };

  const toggleEpisodeSelection = (slug) => {
    const newSelected = new Set(selectedEpisodes);
    if (newSelected.has(slug)) {
      newSelected.delete(slug);
    } else {
      newSelected.add(slug);
    }
    setSelectedEpisodes(newSelected);
  };

  const toggleAllEpisodes = () => {
    if (selectedEpisodes.size === episodes.length) {
      setSelectedEpisodes(new Set());
    } else {
      setSelectedEpisodes(new Set(episodes.map(ep => ep.slug)));
    }
  };

  const startMigration = async () => {
    if (selectedEpisodes.size === 0) {
      toast({ title: 'Warning', description: 'Please select at least one episode', variant: 'warning' });
      return;
    }

    // Confirmation dialog
    const confirmed = window.confirm(
      `Are you sure you want to migrate ${selectedEpisodes.size} episode(s)?\n\n` +
      'This will:\n' +
      '1. Download audio from R2\n' +
      '2. Upload to Hostinger SFTP\n' +
      '3. Update database links\n\n' +
      'This process may take several minutes.'
    );

    if (!confirmed) return;

    setIsMigrating(true);
    setCanStopMigration(true);
    stopMigrationRef.current = false;
    setMigrationResults(null);
    setMigrationProgress({ total: selectedEpisodes.size, current: 0, percentage: 0 });

    try {
      const episodesToMigrate = episodes.filter(ep => selectedEpisodes.has(ep.slug));

      const results = await migrationService.migrateMultipleEpisodes(
        episodesToMigrate,
        currentLanguage,
        (progress) => {
          if (stopMigrationRef.current) return;
          
          setMigrationProgress({
            total: progress.total,
            current: progress.current,
            percentage: progress.percentage,
            status: progress.status,
            episode: progress.episode,
          });
        }
      );

      setMigrationResults(results);
      setSelectedEpisodes(new Set());
      
      toast({
        title: 'Migration Complete',
        description: `${results.succeeded} succeeded, ${results.failed} failed`,
        variant: results.failed === 0 ? 'default' : 'destructive',
      });

      // Reload episodes to update list
      loadEpisodes();
      loadMigrationStatus();
    } catch (error) {
      logger.error('[MigrationPage] Migration error:', error);
      toast({ title: 'Migration Failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsMigrating(false);
      setCanStopMigration(false);
      setMigrationProgress(null);
    }
  };

  const stopMigration = () => {
    if (window.confirm('Stop current migration? Completed episodes will be kept.')) {
      stopMigrationRef.current = true;
      setIsMigrating(false);
      setCanStopMigration(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Storage Migration</h1>
          <p className="text-slate-400">Migrate episodes from R2 to Hostinger SFTP</p>
        </div>

        {/* Migration Status */}
        {migrationStatus && (
          <Card className="mb-6 bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Migration Status</CardTitle>
            </CardHeader>
            <CardContent className="text-slate-300">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-slate-400">Total Episodes</div>
                  <div className="text-2xl font-bold text-white">{migrationStatus.stats.total}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-400">On Hostinger</div>
                  <div className="text-2xl font-bold text-emerald-400">{migrationStatus.stats.hostinger}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-400">Still on R2</div>
                  <div className="text-2xl font-bold text-orange-400">{migrationStatus.stats.r2}</div>
                </div>
              </div>
              <div className="mt-4 bg-slate-700 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${migrationStatus.percentage}%` }}
                />
              </div>
              <div className="mt-2 text-sm text-center text-slate-400">
                {migrationStatus.percentage}% migrated
              </div>
            </CardContent>
          </Card>
        )}

        {/* Current Migration Progress */}
        {isMigrating && migrationProgress && (
          <Card className="mb-6 bg-blue-900 border-blue-700">
            <CardHeader>
              <CardTitle className="text-white">Migration in Progress</CardTitle>
            </CardHeader>
            <CardContent className="text-blue-100">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span>Episode: {migrationProgress.episode}</span>
                  <span>{migrationProgress.current}/{migrationProgress.total}</span>
                </div>
                <div className="bg-blue-800 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-blue-400 transition-all duration-300"
                    style={{ width: `${migrationProgress.percentage}%` }}
                  />
                </div>
                <div className="text-sm text-blue-300">{migrationProgress.percentage}% complete</div>
                <Button
                  onClick={stopMigration}
                  variant="destructive"
                  className="w-full"
                  disabled={!canStopMigration}
                >
                  Stop Migration
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Migration Results */}
        {migrationResults && (
          <Card className="mb-6 bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Migration Results</CardTitle>
            </CardHeader>
            <CardContent className="text-slate-300">
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <div className="text-sm text-slate-400">Total</div>
                  <div className="text-2xl font-bold text-white">{migrationResults.total}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-400">Succeeded</div>
                  <div className="text-2xl font-bold text-emerald-400">{migrationResults.succeeded}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-400">Failed</div>
                  <div className="text-2xl font-bold text-red-400">{migrationResults.failed}</div>
                </div>
              </div>
              <div className="text-sm text-slate-400">
                Duration: {migrationResults.duration} seconds
              </div>

              {migrationResults.details.length > 0 && (
                <div className="mt-4 max-h-60 overflow-y-auto border border-slate-700 rounded p-3 bg-slate-900">
                  {migrationResults.details.map((detail, idx) => (
                    <div key={idx} className="text-sm py-1 border-b border-slate-700 last:border-b-0">
                      <span className={detail.success ? 'text-emerald-400' : 'text-red-400'}>
                        {detail.success ? 'Γ£à' : 'Γ¥î'}
                      </span>
                      {' '}{detail.episode}
                      {detail.error && <span className="text-red-300"> - {detail.error}</span>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Episode Selection */}
        {!isMigrating && (
          <>
            <Card className="mb-6 bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Select Episodes</CardTitle>
                <CardDescription>
                  {episodes.length} episodes available for migration
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-slate-400 text-center py-8">Loading episodes...</div>
                ) : episodes.length === 0 ? (
                  <Alert>
                    <AlertDescription>All episodes have been migrated!</AlertDescription>
                  </Alert>
                ) : (
                  <>
                    <div className="mb-4 pb-4 border-b border-slate-700">
                      <Button
                        variant="outline"
                        onClick={toggleAllEpisodes}
                        className="text-slate-300 border-slate-600 hover:bg-slate-700"
                      >
                        {selectedEpisodes.size === episodes.length
                          ? 'Deselect All'
                          : 'Select All'}
                      </Button>
                      <span className="ml-3 text-slate-400">
                        {selectedEpisodes.size}/{episodes.length} selected
                      </span>
                    </div>

                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {episodes.map((episode) => (
                        <label
                          key={episode.slug}
                          className="flex items-center p-3 rounded bg-slate-700 hover:bg-slate-600 cursor-pointer transition"
                        >
                          <input
                            type="checkbox"
                            checked={selectedEpisodes.has(episode.slug)}
                            onChange={() => toggleEpisodeSelection(episode.slug)}
                            className="w-4 h-4 rounded"
                          />
                          <div className="ml-3 flex-1">
                            <div className="text-white font-medium">{episode.title}</div>
                            <div className="text-sm text-slate-400">{episode.slug}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Action Buttons */}
            {episodes.length > 0 && (
              <div className="flex gap-3">
                <Button
                  onClick={loadEpisodes}
                  variant="outline"
                  className="text-slate-300 border-slate-600 hover:bg-slate-700"
                >
                  Refresh
                </Button>
                <Button
                  onClick={startMigration}
                  disabled={selectedEpisodes.size === 0}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Start Migration ({selectedEpisodes.size} selected)
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
