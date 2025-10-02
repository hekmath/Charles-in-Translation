import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/db-service';
import { auth } from '@clerk/nextjs/server';
import type {
  ChunkStatus,
  TranslationProgressDetail,
} from '@/db/types';

type ProgressSummary = {
  keysRemaining: number;
  chunksRemaining: number;
  successRate: number;
  chunkSuccessRate: number;
};

type ProgressChunkResponse = {
  index: number;
  status: ChunkStatus;
  itemsCount: number;
  translatedCount: number;
  error?: string;
  successRate: number;
};

type ProgressResponseData = Omit<TranslationProgressDetail, 'chunks'> & {
  summary: ProgressSummary;
  chunks?: ProgressChunkResponse[];
};

// GET /api/translation-progress - Get enhanced translation progress
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const projectIdParam = searchParams.get('projectId');
    const targetLanguage = searchParams.get('targetLanguage');
    const includeChunkDetails =
      searchParams.get('includeChunkDetails') === 'true';

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

    // Get enhanced progress with chunk details
    const progress = await dbService.translationTasks.getProjectProgress(
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

    // Optionally include detailed chunk information
    let responseData: ProgressResponseData = {
      taskId: progress.taskId,
      status: progress.status,
      totalKeys: progress.totalKeys,
      translatedKeys: progress.translatedKeys,
      progressPercentage: progress.progressPercentage,
      totalChunks: progress.totalChunks,
      completedChunks: progress.completedChunks,
      failedChunks: progress.failedChunks,
      estimatedTimeRemaining: progress.estimatedTimeRemaining,
      context: progress.context,
      error: progress.error,
      startedAt: progress.startedAt,
      completedAt: progress.completedAt,
      summary: {
        keysRemaining: progress.totalKeys - progress.translatedKeys,
        chunksRemaining:
          progress.totalChunks -
          progress.completedChunks -
          progress.failedChunks,
        successRate:
          progress.totalKeys > 0
            ? Math.round((progress.translatedKeys / progress.totalKeys) * 100)
            : 0,
        chunkSuccessRate:
          progress.totalChunks > 0
            ? Math.round(
                (progress.completedChunks / progress.totalChunks) * 100
              )
            : 0,
      },
    };

    // Include chunk details if requested (useful for debugging or detailed progress views)
    if (includeChunkDetails && progress.chunks) {
      responseData = {
        ...responseData,
        chunks: progress.chunks.map<ProgressChunkResponse>((chunk) => ({
          index: chunk.index,
          status: chunk.status,
          itemsCount: chunk.itemsCount,
          translatedCount: chunk.translatedCount,
          error: chunk.error,
          successRate:
            chunk.itemsCount > 0
              ? Math.round((chunk.translatedCount / chunk.itemsCount) * 100)
              : 0,
        })),
      };
    }

    return NextResponse.json({
      success: true,
      data: responseData,
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

// POST /api/translation-progress - Manual progress update (for testing/admin)
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { taskId, action, data } = body;

    if (!taskId || !action) {
      return NextResponse.json(
        {
          success: false,
          error: 'Task ID and action are required',
        },
        { status: 400 }
      );
    }

    // Check if task exists
    const task = await dbService.translationTasks.getById(taskId);
    if (!task) {
      return NextResponse.json(
        {
          success: false,
          error: 'Translation task not found',
        },
        { status: 404 }
      );
    }

    let result;

    switch (action) {
      case 'updateTranslatedKeys':
        if (typeof data?.increment !== 'number') {
          return NextResponse.json(
            { success: false, error: 'Increment value required' },
            { status: 400 }
          );
        }
        result = await dbService.translationTasks.updateTranslatedKeys(
          taskId,
          data.increment
        );
        break;

      case 'incrementCompletedChunks':
        result = await dbService.translationTasks.incrementCompletedChunks(
          taskId
        );
        break;

      case 'incrementFailedChunks':
        result = await dbService.translationTasks.incrementFailedChunks(taskId);
        break;

      case 'updateStatus':
        if (!data?.status) {
          return NextResponse.json(
            { success: false, error: 'Status value required' },
            { status: 400 }
          );
        }
        result = await dbService.translationTasks.update(taskId, {
          status: data.status,
          error: data.error,
          ...(data.status === 'processing' && { startedAt: new Date() }),
          ...(data.status === 'completed' && { completedAt: new Date() }),
          ...(data.status === 'failed' && { completedAt: new Date() }),
        });
        break;

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Unknown action: ${action}`,
          },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data: result,
      message: `Progress updated successfully (${action})`,
    });
  } catch (error) {
    console.error('Failed to update translation progress:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update translation progress',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
