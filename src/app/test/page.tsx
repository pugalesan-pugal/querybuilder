'use client';

import { useState } from 'react';
import { testGeminiConnection } from '../utils/gemini';

export default function TestPage() {
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleTest = async () => {
    setLoading(true);
    setStatus('Testing connection...');
    
    try {
      const result = await testGeminiConnection();
      setStatus(result.success ? `✅ ${result.message}` : `❌ ${result.message}`);
    } catch (error: any) {
      setStatus(`❌ Error: ${error?.message || 'Unknown error occurred'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden md:max-w-2xl p-6">
        <h1 className="text-2xl font-bold mb-4">Gemini API Test Page</h1>
        
        <div className="mb-4 text-sm text-gray-600">
          <p>This page will test your Gemini API connection with automatic retry logic for rate limits.</p>
          <p className="mt-2">If you hit a rate limit, the test will automatically wait and retry.</p>
        </div>

        <button
          onClick={handleTest}
          disabled={loading}
          className={`w-full py-2 px-4 rounded ${
            loading 
              ? 'bg-gray-400'
              : 'bg-blue-500 hover:bg-blue-600'
          } text-white font-semibold transition-colors`}
        >
          {loading ? 'Testing...' : 'Test Gemini Connection'}
        </button>

        {status && (
          <div className={`mt-4 p-4 rounded ${
            status.includes('✅') 
              ? 'bg-green-100 text-green-700'
              : status.includes('❌')
                ? 'bg-red-100 text-red-700'
                : 'bg-blue-100 text-blue-700'
          }`}>
            {status}
          </div>
        )}
      </div>
    </div>
  );
} 