'use client';

import { useState } from 'react';
import { useCustomAuth } from '../utils/customAuth';
import { CustomAuthService } from '../utils/customAuth';

export default function TestAuthPage() {
  const { user, loading } = useCustomAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleTestLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    try {
      const auth = CustomAuthService.getInstance();
      const user = await auth.login(email, password);
      setMessage(`✅ Login successful! Welcome ${user.name} from ${user.company.name}`);
    } catch (error: any) {
      setMessage(`❌ Login failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    const auth = CustomAuthService.getInstance();
    await auth.logout();
    setMessage('✅ Logged out successfully');
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h1>Custom Authentication Test</h1>
      
      {user ? (
        <div>
          <h2>✅ Currently Logged In</h2>
          <p><strong>Name:</strong> {user.name}</p>
          <p><strong>Email:</strong> {user.email}</p>
          <p><strong>Company:</strong> {user.company.name} ({user.companyId})</p>
          <p><strong>Role:</strong> {user.role}</p>
          <button onClick={handleLogout} style={{ padding: '10px 20px', marginTop: '10px' }}>
            Logout
          </button>
        </div>
      ) : (
        <div>
          <h2>🔐 Test Login</h2>
          <form onSubmit={handleTestLogin}>
            <div style={{ marginBottom: '15px' }}>
              <label>Email:</label><br />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                placeholder="Enter email"
                required
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label>Password:</label><br />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                placeholder="Enter password"
                required
              />
            </div>
            <button 
              type="submit" 
              disabled={isLoading}
              style={{ padding: '10px 20px', backgroundColor: '#007bff', color: 'white', border: 'none' }}
            >
              {isLoading ? 'Testing...' : 'Test Login'}
            </button>
          </form>
        </div>
      )}

      {message && (
        <div style={{ 
          marginTop: '20px', 
          padding: '10px', 
          backgroundColor: message.includes('✅') ? '#d4edda' : '#f8d7da',
          border: `1px solid ${message.includes('✅') ? '#c3e6cb' : '#f5c6cb'}`,
          borderRadius: '4px'
        }}>
          {message}
        </div>
      )}

      <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
        <h3>🔑 Test Credentials:</h3>
        <ul>
          <li><strong>alice@abcmanufacturing.com</strong> / <strong>ABC123</strong></li>
          <li><strong>bob@xyztrading.com</strong> / <strong>XYZ456</strong></li>
          <li><strong>emma@pqrindustries.com</strong> / <strong>PQR789</strong></li>
          <li><strong>john@abcmanufacturing.com</strong> / <strong>ABC123</strong></li>
          <li><strong>mike@pqrindustries.com</strong> / <strong>PQR789</strong></li>
          <li><strong>sarah@xyztrading.com</strong> / <strong>XYZ456</strong></li>
          <li><strong>pugalesan@gmail.com</strong> / <strong>ABC123</strong></li>
        </ul>
      </div>
    </div>
  );
} 