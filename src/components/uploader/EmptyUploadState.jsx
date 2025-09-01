import React from 'react';
import { UploadCloud, FileAudio, Play, Edit3 } from 'lucide-react';

const EmptyUploadState = ({ currentLanguage }) => {
  return (
    <div className="text-center py-12">
      <div className="mb-6">
        <UploadCloud className="mx-auto h-16 w-16 text-slate-400 mb-4" />
        <h3 className="text-xl font-semibold text-slate-200 mb-2">
          No files to process
        </h3>
        <p className="text-slate-400 max-w-md mx-auto">
          Drag and drop audio files here or click the select button to get started with your podcast uploads.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-2xl mx-auto">
        <div className="text-center p-4 bg-slate-700/30 rounded-lg border border-slate-600">
          <FileAudio className="mx-auto h-8 w-8 text-purple-400 mb-2" />
          <h4 className="font-medium text-slate-200 mb-1">Upload Audio</h4>
          <p className="text-xs text-slate-400">
            Support for MP3, WAV, M4A, AAC, OGG, FLAC
          </p>
        </div>

        <div className="text-center p-4 bg-slate-700/30 rounded-lg border border-slate-600">
          <Edit3 className="mx-auto h-8 w-8 text-blue-400 mb-2" />
          <h4 className="font-medium text-slate-200 mb-1">Edit & Review</h4>
          <p className="text-xs text-slate-400">
            Add titles, timings, and questions
          </p>
        </div>

        <div className="text-center p-4 bg-slate-700/30 rounded-lg border border-slate-600">
          <Play className="mx-auto h-8 w-8 text-green-400 mb-2" />
          <h4 className="font-medium text-slate-200 mb-1">Publish</h4>
          <p className="text-xs text-slate-400">
            Make episodes available to listeners
          </p>
        </div>
      </div>
    </div>
  );
};

export default EmptyUploadState;

