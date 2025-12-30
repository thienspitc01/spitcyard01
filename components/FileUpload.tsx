
import React, { useRef } from 'react';

interface FileUploadProps {
  onFileUpload: (file: File) => void;
  isLoading: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileUpload, isLoading }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileUpload(file);
    }
    // Reset file input to allow re-uploading the same file
    event.target.value = '';
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full flex justify-center">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
      />
      <button
        onClick={handleClick}
        disabled={isLoading}
        className="flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors duration-200"
      >
        {isLoading ? (
          <>
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing...
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Upload Container Excel File
          </>
        )}
      </button>
    </div>
  );
};

export default FileUpload;
