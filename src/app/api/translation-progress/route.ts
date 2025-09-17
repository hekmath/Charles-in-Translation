import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/db-service';

// GET /api/translation-progress - Get translation progress for a project and target language
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectIdParam = searchParams.get('projectId');
    const targetLanguage = searchParams.get('targetLanguage');

    if (!projectIdParam) {
      return NextResponse.json(
        {
          success: false,
          error: 'Project ID is required',
        },
        { status: 400 }
      );
    }

    if (!targetLanguage) {
      return NextResponse.json(
        {
          success: false,
          error: 'Target language is required',
        },
        { status: 400 }
      );
    }

    const projectId = parseInt(projectIdParam);
    if (isNaN(projectId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid project ID',
        },
        { status: 400 }
      );
    }

    // Check if project exists
    const project = await dbService.projects.getById(projectId);
    if (!project) {
      return NextResponse.json(
        {
          success: false,
          error: 'Project not found',
        },
        { status: 404 }
      );
    }

    const progress = await dbService.translationTasks.getProgress(
      projectId,
      targetLanguage
    );

    if (!progress) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'No translation progress found for this project and language',
      });
    }

    return NextResponse.json({
      success: true,
      data: progress,
    });
  } catch (error) {
    console.error('Failed to fetch translation progress:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch translation progress',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
