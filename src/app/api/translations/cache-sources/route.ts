import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { dbService } from '@/lib/db-service';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const sourceLanguage = searchParams.get('sourceLanguage');
    const targetLanguage = searchParams.get('targetLanguage');

    if (!sourceLanguage || !targetLanguage) {
      return NextResponse.json(
        {
          success: false,
          error: 'sourceLanguage and targetLanguage are required',
        },
        { status: 400 }
      );
    }

    const projectIds = await dbService.translations.getProjectIdsWithLanguage(
      sourceLanguage,
      targetLanguage
    );

    return NextResponse.json({
      success: true,
      data: { projectIds },
    });
  } catch (error) {
    console.error('Failed to fetch cache sources:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch cache sources',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
