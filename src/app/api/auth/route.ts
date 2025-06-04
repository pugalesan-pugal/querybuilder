import { NextResponse } from 'next/server';

// This is a mock user database - in a real app, you would use a proper database
const MOCK_USERS = [
  {
    email: 'admin@example.com',
    // In a real app, this would be a hashed password
    password: 'admin123',
  },
  {
    email: 'pugalesan2004@gmail.com',
    password: 'PUGAL123',
  },
];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Basic input validation
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Mock authentication
    const user = MOCK_USERS.find(
      (u) => u.email === email && u.password === password
    );

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // In a real app, you would:
    // 1. Hash and compare passwords
    // 2. Generate a JWT token
    // 3. Set up proper session management
    
    return NextResponse.json({
      success: true,
      user: { email: user.email },
    });
  } catch (error) {
    console.error('Authentication error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 