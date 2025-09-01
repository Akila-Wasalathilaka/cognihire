import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Return mock candidate data
    const mockCandidates = [
      {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        status: 'active',
        created_at: '2024-01-15T10:00:00Z'
      },
      {
        id: 2,
        name: 'Jane Smith',
        email: 'jane@example.com',
        status: 'pending',
        created_at: '2024-01-16T14:30:00Z'
      }
    ];

    return NextResponse.json(mockCandidates);
  } catch (error) {
    console.error('Candidates API error:', error);
    return NextResponse.json({ error: 'Failed to fetch candidates' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Mock candidate creation
    const newCandidate = {
      id: Date.now(),
      name: body.name,
      email: body.email,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    return NextResponse.json(newCandidate, { status: 201 });
  } catch (error) {
    console.error('Create candidate error:', error);
    return NextResponse.json({ error: 'Failed to create candidate' }, { status: 500 });
  }
}
