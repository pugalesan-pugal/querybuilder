import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// In a real application, you would:
// 1. Use a proper database
// 2. Hash passwords
// 3. Implement proper validation
// 4. Handle concurrent writes properly
// 5. Use environment variables for sensitive data

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password } = body;

    // Basic validation
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Name, email and password are required' },
        { status: 400 }
      );
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Password length validation
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // Read existing users
    const usersFilePath = path.join(process.cwd(), 'src/app/api/auth/users.json');
    let users = [];
    
    try {
      if (fs.existsSync(usersFilePath)) {
        const fileContent = fs.readFileSync(usersFilePath, 'utf8');
        users = JSON.parse(fileContent);
      }
    } catch (error) {
      console.error('Error reading users file:', error);
    }

    // Check if user already exists
    if (users.some((user: any) => user.email === email)) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Add new user
    const newUser = {
      id: Date.now().toString(),
      name,
      email,
      password, // In a real app, this would be hashed
      createdAt: new Date().toISOString()
    };

    users.push(newUser);

    // Save updated users list
    try {
      fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
    } catch (error) {
      console.error('Error writing to users file:', error);
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      );
    }

    // Return success response (never send password back)
    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        createdAt: newUser.createdAt
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 