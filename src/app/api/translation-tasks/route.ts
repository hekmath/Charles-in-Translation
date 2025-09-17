import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/db-service';
import { z } from 'zod';

// Validation schema for creating a translation task
const createTaskSchema = z.object({
  projectId: z.number().int().positive('Project ID must be a positive integer'),
  targetLanguage: z.string().min(1, 'Target language is required'),
  keys: z.array(z.string()).default([]),
});

// GET /api/translation-tasks - Get translation tasks for a project
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectIdParam = searchParams.get('projectId');

    if (!projectIdParam) {
      return NextResponse.json(
        {
          success: false,
          error: 'Project ID is required',
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

    const tasks = await dbService.translationTasks.getByProject(projectId);

    return NextResponse.json({
      success: true,
      data: tasks,
    });
  } catch (error) {
    console.error('Failed to fetch translation tasks:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch translation tasks',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// POST /api/translation-tasks - Create a new translation task
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const validatedData = createTaskSchema.parse(body);

    // Check if project exists
    const project = await dbService.projects.getById(validatedData.projectId);
    if (!project) {
      return NextResponse.json(
        {
          success: false,
          error: 'Project not found',
        },
        { status: 404 }
      );
    }

    // Create the translation task
    const task = await dbService.translationTasks.create(validatedData);

    return NextResponse.json(
      {
        success: true,
        data: task,
        message: 'Translation task created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to create translation task:', error);

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
        error: 'Failed to create translation task',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
