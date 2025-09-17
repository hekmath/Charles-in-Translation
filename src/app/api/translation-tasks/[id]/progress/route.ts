import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/db-service';
import { z } from 'zod';

// Validation schema for updating progress
const updateProgressSchema = z.object({
  totalChunks: z.number().int().min(0).optional(),
  completedChunks: z.number().int().min(0).optional(),
  currentChunk: z.number().int().min(0).optional(),
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

    // Update the translation task progress
    const updatedTask = await dbService.translationTasks.updateProgress(
      taskId,
      validatedData
    );

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
