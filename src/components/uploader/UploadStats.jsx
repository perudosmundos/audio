import React from 'react';
import { CheckCircle, Clock, AlertTriangle, Upload, FileAudio } from 'lucide-react';

const UploadStats = ({ filesToProcess, currentLanguage }) => {
  const totalFiles = filesToProcess.length;
  const completedFiles = filesToProcess.filter(f => f.uploadComplete && !f.uploadError).length;
  const processingFiles = filesToProcess.filter(f => f.isUploading).length;
  const errorFiles = filesToProcess.filter(f => f.uploadError).length;
  const pendingFiles = totalFiles - completedFiles - processingFiles - errorFiles;

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'text-green-400';
      case 'processing': return 'text-blue-400';
      case 'error': return 'text-red-400';
      case 'pending': return 'text-yellow-400';
      default: return 'text-slate-400';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'processing': return <Upload className="h-4 w-4 animate-pulse" />;
      case 'error': return <AlertTriangle className="h-4 w-4" />;
      case 'pending': return <Clock className="h-4 w-4" />;
      default: return <FileAudio className="h-4 w-4" />;
    }
  };

  if (totalFiles === 0) return null;

  return (
    <div className="mb-6 p-4 bg-slate-700/30 rounded-lg border border-slate-600">
      <h3 className="text-sm font-medium text-slate-300 mb-3">Upload Progress</h3>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center">
          <div className="flex items-center justify-center mb-1">
            <FileAudio className="h-4 w-4 text-slate-400" />
          </div>
          <div className="text-lg font-semibold text-slate-200">{totalFiles}</div>
          <div className="text-xs text-slate-400">Total</div>
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center mb-1">
            <Clock className="h-4 w-4 text-yellow-400" />
          </div>
          <div className="text-lg font-semibold text-yellow-400">{pendingFiles}</div>
          <div className="text-xs text-slate-400">Pending</div>
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center mb-1">
            <Upload className="h-4 w-4 text-blue-400" />
          </div>
          <div className="text-lg font-semibold text-blue-400">{processingFiles}</div>
          <div className="text-xs text-slate-400">Processing</div>
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center mb-1">
            <CheckCircle className="h-4 w-4 text-green-400" />
          </div>
          <div className="text-lg font-semibold text-green-400">{completedFiles}</div>
          <div className="text-xs text-slate-400">Completed</div>
        </div>
      </div>

      {errorFiles > 0 && (
        <div className="mt-3 text-center">
          <div className="flex items-center justify-center mb-1">
            <AlertTriangle className="h-4 w-4 text-red-400" />
          </div>
          <div className="text-lg font-semibold text-red-400">{errorFiles}</div>
          <div className="text-xs text-slate-400">Errors</div>
        </div>
      )}

      {totalFiles > 0 && (
        <div className="mt-4">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>Progress</span>
            <span>{Math.round((completedFiles / totalFiles) * 100)}%</span>
          </div>
          <div className="w-full bg-slate-600 rounded-full h-2">
            <div 
              className="bg-green-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(completedFiles / totalFiles) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadStats;

