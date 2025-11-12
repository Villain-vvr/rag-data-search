
import React, { useState, useCallback } from 'react';
import { profiles as initialProfiles } from './data/profiles';
import { generateSummary } from './services/geminiService';
import { SearchBar } from './components/SearchBar';
import { DataItemCard } from './components/ProfileCard';
import { LoadingSpinner } from './components/LoadingSpinner';

// Import libraries for file parsing
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import * as JSZip from 'jszip';

// Configure the PDF.js worker to enable PDF parsing in the browser.
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.3.136/pdf.worker.min.mjs`;

const App: React.FC = () => {
  const [query, setQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedAnswer, setGeneratedAnswer] = useState<string>('');
  const [retrievedItems, setRetrievedItems] = useState<any[]>([]);

  // State for dynamic dataset loading
  const [dataset, setDataset] = useState<any[]>(initialProfiles);
  const [datasetUrl, setDatasetUrl] = useState<string>('');
  const [githubUrl, setGithubUrl] = useState<string>('');
  const [isFetchingDataset, setIsFetchingDataset] = useState<boolean>(false);
  const [datasetError, setDatasetError] = useState<string | null>(null);
  const [loadMethod, setLoadMethod] = useState<'url' | 'github' | 'file'>('file');
  const [fileName, setFileName] = useState<string>('');

  const processAndSetDataset = (data: any, source: string) => {
    let processedData: any[];

    if (Array.isArray(data)) {
      processedData = data;
    } else if (data && typeof data === 'object' && !Array.isArray(data)) {
      processedData = [data];
    } else {
      throw new Error('Invalid data format. Expected an array of objects or a single JSON object.');
    }

    if (processedData.length === 0) {
      throw new Error('The loaded dataset is empty. Please provide data with at least one item.');
    }

    setDataset(processedData);
    setDatasetError(null);
    setGeneratedAnswer('');
    setRetrievedItems([]);
    setFileName(source);
  };

  const parseCsvToObjects = (csvText: string): any[] => {
    const lines = csvText.trim().replace(/\r\n/g, '\n').split('\n');
    if (lines.length < 2) throw new Error("CSV must have a header and at least one data row.");

    const parseLine = (row: string) => {
        const values = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < row.length; i++) {
            const char = row[i];
            if (char === '"') {
                if (inQuotes && i < row.length - 1 && row[i+1] === '"') {
                    current += '"';
                    i++; 
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current.trim());
        return values;
    };
    
    const headerLine = lines[0].startsWith('\uFEFF') ? lines[0].substring(1) : lines[0];
    const header = parseLine(headerLine);

    return lines.slice(1).map(line => {
      if (!line.trim()) return null;
      const values = parseLine(line);
      if (values.length !== header.length) {
          console.warn(`Skipping malformed CSV row (column count mismatch): ${line}`);
          return null;
      }
      const obj: { [key: string]: string } = {};
      header.forEach((key, i) => {
        obj[key] = values[i];
      });
      return obj;
    }).filter((p): p is { [key: string]: string; } => p !== null);
  };
  
  const fetchAndProcessDataset = async (url: string, source: string) => {
    setIsFetchingDataset(true);
    setDatasetError(null);
    let parsedUrl;
    try {
        parsedUrl = new URL(url);
    } catch(e) {
        setDatasetError(`Invalid URL format. Please enter a valid, complete URL (e.g., "https://...").`);
        setIsFetchingDataset(false);
        setDataset(initialProfiles);
        return;
    }
    const isGithubRawUrl = parsedUrl.hostname === 'raw.githubusercontent.com';
    const proxyUrl = 'https://api.allorigins.win/raw?url=';
    const fetchUrl = isGithubRawUrl ? url : `${proxyUrl}${encodeURIComponent(url)}`;
    try {
      const response = await fetch(fetchUrl);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const text = await response.text();
      let data: any;
      const pathname = new URL(url).pathname;
      if (pathname.endsWith('.json')) {
        try {
          data = JSON.parse(text);
        } catch (e) {
          throw new Error('The resource was fetched, but it is not valid JSON. Please check the file content.');
        }
      } else if (pathname.endsWith('.csv')) {
        data = parseCsvToObjects(text);
      } else {
        try {
            data = JSON.parse(text);
        } catch (jsonError) {
            throw new Error('Could not determine file type. Please use a URL ending in .json or .csv, or one that returns raw JSON content.');
        }
      }
      processAndSetDataset(data, source);
    } catch (err: any) {
      console.error(`Failed to fetch or parse dataset from ${source}:`, err);
      let userFriendlyError = `Could not process data from ${source}.`;
      if (err.message?.includes('HTTP error! status: 404')) {
          userFriendlyError = `Failed to load from ${source}: The file was not found at the provided URL (Error 404). Please double-check the URL.`;
      } else if (err instanceof TypeError && err.message.toLowerCase().includes('failed to fetch')) {
          const commonAdvice = "Please check your internet connection, any firewalls, and ensure the URL is correct and publicly accessible."
          userFriendlyError = isGithubRawUrl ? `A network error occurred while fetching from GitHub. ${commonAdvice}` : `A network error occurred. For non-GitHub URLs, this is often due to Cross-Origin (CORS) restrictions on the server, which the proxy could not bypass. ${commonAdvice}`;
      } else if (err.message) {
          userFriendlyError = `Failed to load data from ${source}: ${err.message}`;
      }
      setDatasetError(userFriendlyError);
      setDataset(initialProfiles);
    } finally {
      setIsFetchingDataset(false);
    }
  };

  const handleFetchDataset = () => fetchAndProcessDataset(datasetUrl, 'URL');
  
  const transformGithubUrl = (url: string) => {
    const newUrl = new URL(url);
    if (newUrl.hostname !== 'github.com' || !newUrl.pathname.includes('/blob/')) {
      throw new Error("Invalid GitHub file URL. It must point to a specific file and contain '/blob/'.");
    }
    newUrl.hostname = 'raw.githubusercontent.com';
    newUrl.pathname = newUrl.pathname.replace('/blob/', '/');
    return newUrl.toString();
  };
  
  const handleFetchFromGithub = async () => {
    try {
      const rawUrl = transformGithubUrl(githubUrl);
      await fetchAndProcessDataset(rawUrl, 'GitHub');
    } catch (err: any) {
      setDatasetError(err.message);
      setDataset(initialProfiles);
    }
  };

  const processSingleFile = async (file: File, originalFileName?: string) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    let data: any;

    switch (extension) {
      case 'json':
        data = JSON.parse(await file.text());
        break;
      case 'csv':
        data = parseCsvToObjects(await file.text());
        break;
      case 'xlsx':
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        data = XLSX.utils.sheet_to_json(worksheet);
        break;
      case 'pdf':
        const pdfBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: pdfBuffer }).promise;
        const allText = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          allText.push(pageText);
        }
        const fullText = allText.join('\n\n');
        data = fullText.split(/\n\s*\n/).filter(p => p.trim().length > 10).map((p, i) => ({ id: i + 1, text_chunk: p.trim() }));
        break;
      default:
        throw new Error("Unsupported file type. Please provide a .json, .csv, .xlsx, or .pdf file.");
    }

    const sourceName = originalFileName ? `${originalFileName} > ${file.name}` : file.name;
    processAndSetDataset(data, sourceName);
  };
  
  const processZipFile = async (zipFile: File) => {
    const buffer = await zipFile.arrayBuffer();
    const zip = await JSZip.default.loadAsync(buffer);
    
    const supportedExtensions = ['json', 'csv', 'xlsx', 'pdf'];
    let foundFile: any = null;

    // Fix: Use a for...in loop to iterate over the files in the zip archive.
    // This approach avoids type inference issues with `Object.values` and ensures
    // that properties like `dir` and `name` on the file object are accessible.
    for (const filename in zip.files) {
      if (Object.prototype.hasOwnProperty.call(zip.files, filename)) {
        const file = zip.files[filename];
        if (!file.dir) {
            const ext = file.name.split('.').pop()?.toLowerCase();
            if (ext && supportedExtensions.includes(ext)) {
                foundFile = file;
                break;
            }
        }
      }
    }

    if (!foundFile) {
        throw new Error("No supported files (.json, .csv, .xlsx, .pdf) found in the ZIP archive.");
    }
    
    const fileContent = await foundFile.async('blob');
    const innerFile = new File([fileContent], foundFile.name);
    
    await processSingleFile(innerFile, zipFile.name);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsFetchingDataset(true);
    setDatasetError(null);
    setGeneratedAnswer('');
    setRetrievedItems([]);
    setFileName(file.name);

    try {
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (extension === 'zip') {
        await processZipFile(file);
      } else {
        await processSingleFile(file);
      }
    } catch (err: any) {
      console.error('Failed to parse file:', err);
      setDatasetError(`Failed to load file. ${err.message}`);
      setDataset(initialProfiles);
    } finally {
      setIsFetchingDataset(false);
    }
  };

  const retrieveRelevantItems = useCallback((searchQuery: string): any[] => {
    if (!searchQuery.trim() || dataset.length === 0) return [];
    const queryWords = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
    const scoredItems = dataset.map(item => {
      let score = 0;
      const itemText = JSON.stringify(item).toLowerCase();
      queryWords.forEach(word => {
        if (itemText.includes(word)) {
          score++;
        }
      });
      return { item, score };
    });
    return scoredItems
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(item => item.item);
  }, [dataset]);

  const handleSearch = async () => {
    if (!query.trim() || dataset.length === 0) return;
    setIsLoading(true);
    setError(null);
    setGeneratedAnswer('');
    setRetrievedItems([]);
    try {
      const relevantItems = retrieveRelevantItems(query);
      setRetrievedItems(relevantItems);
      if (relevantItems.length === 0) {
        setGeneratedAnswer("I couldn't find any items that matched your search query in the current dataset.");
        setIsLoading(false);
        return;
      }
      const summary = await generateSummary(query, relevantItems);
      setGeneratedAnswer(summary);
    } catch (err) {
      console.error(err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
      <main className="container mx-auto px-4 py-8 md:py-12">
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-extrabold text-white">
            RAG Data <span className="text-indigo-400">Search</span>
          </h1>
          <p className="mt-4 max-w-2xl mx-auto text-lg text-gray-400">
            Use natural language to search any structured dataset, powered by Retrieval-Augmented Generation.
          </p>
        </div>

        <div className="max-w-3xl mx-auto mb-10 p-6 bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700">
          <div className="flex border-b border-gray-700 mb-4">
            <button onClick={() => setLoadMethod('file')} className={`px-4 py-2 text-sm font-medium ${loadMethod === 'file' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-400 hover:text-white'}`}>Upload File</button>
            <button onClick={() => setLoadMethod('url')} className={`px-4 py-2 text-sm font-medium ${loadMethod === 'url' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-400 hover:text-white'}`}>Load from URL</button>
            <button onClick={() => setLoadMethod('github')} className={`px-4 py-2 text-sm font-medium ${loadMethod === 'github' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-400 hover:text-white'}`}>Load from GitHub</button>
          </div>
          
          {loadMethod === 'file' && (
            <div>
              <h2 className="text-lg font-semibold text-white mb-3 text-center">Upload Dataset File</h2>
              <div className="flex items-center justify-center w-full">
                <label htmlFor="file-upload" className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-600 border-dashed rounded-lg cursor-pointer bg-gray-800 hover:bg-gray-700/50">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <svg className="w-8 h-8 mb-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/></svg>
                        <p className="mb-2 text-sm text-gray-400"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                        <p className="text-xs text-gray-500">XLSX, PDF, JSON, CSV, or ZIP file</p>
                        {fileName && <p className="text-xs text-indigo-400 mt-1">{fileName}</p>}
                    </div>
                    <input id="file-upload" type="file" className="hidden" onChange={handleFileChange} accept=".json,.csv,.xlsx,.pdf,.zip" disabled={isFetchingDataset} />
                </label>
              </div>
            </div>
          )}

          {loadMethod === 'url' && (
            <div>
                <h2 className="text-lg font-semibold text-white mb-3 text-center">Load Dataset from URL</h2>
                <div className="flex items-center space-x-2">
                <input
                    type="text"
                    value={datasetUrl}
                    onChange={(e) => setDatasetUrl(e.target.value)}
                    placeholder="Paste URL to a raw JSON or CSV file..."
                    className="flex-grow bg-gray-700 text-white placeholder-gray-400 border border-gray-600 rounded-md shadow-sm px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                    disabled={isFetchingDataset}
                />
                <button
                    onClick={handleFetchDataset}
                    disabled={isFetchingDataset || !datasetUrl}
                    className="inline-flex items-center justify-center px-5 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
                >
                    {isFetchingDataset ? <LoadingSpinner /> : 'Load'}
                </button>
                </div>
            </div>
          )}

          {loadMethod === 'github' && (
            <div>
                <h2 className="text-lg font-semibold text-white mb-3 text-center">Load Dataset from GitHub</h2>
                <div className="flex items-center space-x-2">
                <input
                    type="text"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    placeholder="Paste GitHub file URL (e.g., .../blob/main/...)"
                    className="flex-grow bg-gray-700 text-white placeholder-gray-400 border border-gray-600 rounded-md shadow-sm px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                    disabled={isFetchingDataset}
                />
                <button
                    onClick={handleFetchFromGithub}
                    disabled={isFetchingDataset || !githubUrl}
                    className="inline-flex items-center justify-center px-5 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
                >
                    {isFetchingDataset ? <LoadingSpinner /> : 'Load'}
                </button>
                </div>
            </div>
          )}

          {isFetchingDataset && <div className="flex justify-center mt-4"><LoadingSpinner /></div>}
          {datasetError && <p className="text-center text-red-500 mt-3 text-sm">{datasetError}</p>}
          <p className="text-center text-gray-400 mt-3 text-sm">
            {dataset.length} items currently loaded.
          </p>
        </div>


        <div className="flex justify-center mb-12">
          <SearchBar query={query} setQuery={setQuery} onSearch={handleSearch} isLoading={isLoading || dataset.length === 0} />
        </div>

        {isLoading && (
          <div className="flex justify-center items-center my-8">
            <LoadingSpinner />
          </div>
        )}
        
        {error && <p className="text-center text-red-500">{error}</p>}
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {generatedAnswer && (
            <div className="lg:col-span-3 bg-gray-800/50 backdrop-blur-sm rounded-lg shadow-xl p-6 border border-gray-700">
              <h2 className="text-2xl font-bold text-indigo-400 mb-4">AI-Generated Summary</h2>
              <div className="prose prose-invert max-w-none text-gray-300">
                {generatedAnswer.split('\n').map((line, index) => (
                  <p key={index}>{line}</p>
                ))}
              </div>
            </div>
          )}

          {retrievedItems.length > 0 && (
            <div className="lg:col-span-3">
              <h2 className="text-2xl font-bold text-white mb-6 text-center">
                Retrieved Items (Context for AI)
              </h2>
              <div className="space-y-6">
                {retrievedItems.map((item, index) => (
                  <DataItemCard key={item.id || index} item={item} />
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
