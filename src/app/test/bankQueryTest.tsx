import { useState } from 'react';
import { BankQueryService } from '../utils/bankQueryService';

const testQueries = [
  "hi",
  "what is my working capital",
  "give me npn report",
  "show me my loans",
  "what are my credit details"
];

const testCompanyId = "ABC123";
const testUserId = "test@example.com";

export default function BankQueryTest() {
  const [responses, setResponses] = useState<{query: string, response: string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bankQueryService = new BankQueryService(testCompanyId, testUserId);

  const runTests = async () => {
    setLoading(true);
    setError(null);
    const results: {query: string, response: string}[] = [];

    try {
      for (const query of testQueries) {
        console.log('Testing query:', query);
        const response = await bankQueryService.processQuery(query, 'test_chat');
        console.log('Response:', response);
        results.push({ query, response });
      }
      setResponses(results);
    } catch (err) {
      console.error('Error running tests:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Bank Query Test</h1>
      <button 
        onClick={runTests}
        disabled={loading}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          marginBottom: '20px'
        }}
      >
        {loading ? 'Running Tests...' : 'Run Tests'}
      </button>

      {error && (
        <div style={{ 
          color: 'red', 
          marginBottom: '20px',
          padding: '10px',
          border: '1px solid red',
          borderRadius: '4px'
        }}>
          {error}
        </div>
      )}

      {responses.map((result, index) => (
        <div 
          key={index}
          style={{
            marginBottom: '20px',
            padding: '15px',
            border: '1px solid #ddd',
            borderRadius: '4px'
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: '10px' }}>
            Query: {result.query}
          </div>
          <div style={{ whiteSpace: 'pre-wrap' }}>
            Response: {result.response}
          </div>
        </div>
      ))}
    </div>
  );
} 