import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/db-service';
import { z } from 'zod';

// Updated validation schema for the new progress structure
const updateProgressSchema = z.object({
  // New key-based progress tracking
  totalKeys: z.number().int().min(0).optional(),
  translatedKeys: z.number().int().min(0).optional(),

  // Chunk-based tracking
  totalChunks: z.number().int().min(0).optional(),
  completedChunks: z.number().int().min(0).optional(),
  failedChunks: z.number().int().min(0).optional(),

  // Status updates
  status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
  error: z.string().optional(),

  // Time tracking
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
});

// PUT /api/translation-tasks/[id]/progress - Update task progress
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const taskId = parseInt(id);

    if (isNaN(taskId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid task ID',
        },
        { status: 400 }
      );
    }

    // Check if task exists
    const existingTask = await dbService.translationTasks.getById(taskId);
    if (!existingTask) {
      return NextResponse.json(
        {
          success: false,
          error: 'Translation task not found',
        },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Validate request body
    const validatedData = updateProgressSchema.parse(body);

    // Handle different types of updates based on what's provided
    let updatedTask;

    if (validatedData.status) {
      // Status update (with optional error message)
      updatedTask = await dbService.translationTasks.update(taskId, {
        status: validatedData.status,
        error: validatedData.error,
        ...(validatedData.status === 'processing' && { startedAt: new Date() }),
        ...(validatedData.status === 'completed' && {
          completedAt: new Date(),
        }),
        ...(validatedData.status === 'failed' && { completedAt: new Date() }),
      });
    } else if (
      validatedData.totalKeys !== undefined &&
      validatedData.totalChunks !== undefined
    ) {
      // Initialize progress (usually called at the start of translation)
      updatedTask = await dbService.translationTasks.initializeProgress(
        taskId,
        validatedData.totalKeys,
        validatedData.totalChunks
      );
    } else if (validatedData.translatedKeys !== undefined) {
      // Update translated keys count
      const currentTask = await dbService.translationTasks.getById(taskId);
      const increment =
        validatedData.translatedKeys - (currentTask?.translatedKeys || 0);
      updatedTask = await dbService.translationTasks.updateTranslatedKeys(
        taskId,
        increment
      );
    } else {
      // For other specific updates, we can add individual methods
      // This is a fallback for any remaining use cases
      return NextResponse.json(
        {
          success: false,
          error: 'No valid update fields provided',
        },
        { status: 400 }
      );
    }

    if (!updatedTask) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to update progress',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedTask,
      message: 'Progress updated successfully',
    });
  } catch (error) {
    console.error('Failed to update translation task progress:', error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    // Handle database errors
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update progress',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// GET /api/translation-tasks/[id]/progress - Get detailed task progress
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const taskId = parseInt(id);

    if (isNaN(taskId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid task ID',
        },
        { status: 400 }
      );
    }

    // Get detailed progress including chunk information
    const progress = await dbService.translationTasks.getProgress(taskId);

    if (!progress) {
      return NextResponse.json(
        {
          success: false,
          error: 'Translation task not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: progress,
    });
  } catch (error) {
    console.error('Failed to fetch translation task progress:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch progress',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
