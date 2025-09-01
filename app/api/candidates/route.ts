import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Forward request to FastAPI backend
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    
    // Get authorization header from the request
    const authHeader = request.headers.get('authorization');
    
    // Build the backend URL with query parameters
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const backendEndpoint = `${backendUrl}/admin/candidates?${searchParams.toString()}`;
    
    const response = await fetch(backendEndpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader && { 'Authorization': authHeader }),
      },
    });

    if (!response.ok) {
      console.error('Backend candidates error:', response.status, response.statusText);
      return NextResponse.json([], { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Candidates API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Forward request to FastAPI backend
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    
    // Get authorization header from the request
    const authHeader = request.headers.get('authorization');
    const body = await request.json();
    
    const response = await fetch(`${backendUrl}/admin/candidates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader && { 'Authorization': authHeader }),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error('Backend create candidate error:', response.status, response.statusText);
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Create candidate API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}