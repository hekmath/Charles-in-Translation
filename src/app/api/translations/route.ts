import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/db-service';
import { z } from 'zod';
import { auth } from '@clerk/nextjs/server';

// Validation schema for saving a translation
const saveTranslationSchema = z.object({
  projectId: z.number().int().positive('Project ID must be a positive integer'),
  key: z.string().min(1, 'Translation key is required'),
  sourceText: z.string().min(1, 'Source text is required'),
  translatedText: z.string().min(1, 'Translated text is required'),
  sourceLanguage: z.string().min(1, 'Source language is required'),
  targetLanguage: z.string().min(1, 'Target language is required'),
});

// GET /api/translations - Get cached translations for a project and target language
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

    const translations = await dbService.translations.getCached(
      projectId,
      targetLanguage
    );

    return NextResponse.json({
      success: true,
      data: translations,
    });
  } catch (error) {
    console.error('Failed to fetch cached translations:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch cached translations',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// POST /api/translations - Save an individual translation
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

    // Validate request body
    const validatedData = saveTranslationSchema.parse(body);

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

    // Save the translation (upserts automatically)
    const translation = await dbService.translations.save(validatedData);

    return NextResponse.json({
      success: true,
      data: translation,
      message: 'Translation saved successfully',
    });
  } catch (error) {
    console.error('Failed to save translation:', error);

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
        error: 'Failed to save translation',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
