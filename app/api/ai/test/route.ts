import { NextRequest, NextResponse } from 'next/server';
import { testAIConnection, generateGame, analyzeJobRole } from '../../../../utils/ai-api';

export async function GET(request: NextRequest) {
  try {
    // Test the AI connection
    const connectionTest = await testAIConnection();

    if (!connectionTest.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'AI connection failed',
          details: connectionTest.error
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Mistral AI integration is working correctly',
      connectionStatus: connectionTest.data,
      apiKeyConfigured: true,
      availableFeatures: [
        'Game Generation',
        'Job Role Analysis',
        'Content Generation',
        'Report Generation',
        'Cognitive Assessment Creation'
      ]
    });
  } catch (error) {
    console.error('AI test endpoint error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    switch (action) {
      case 'test_connection':
        return NextResponse.json(await testAIConnection());

      case 'generate_game':
        return NextResponse.json(await generateGame(params));

      case 'analyze_job':
        return NextResponse.json(await analyzeJobRole(params));

      default:
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid action. Supported actions: test_connection, generate_game, analyze_job'
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('AI API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}