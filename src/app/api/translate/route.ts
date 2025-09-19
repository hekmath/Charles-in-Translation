import { NextRequest, NextResponse } from 'next/server';
import { getLanguageByCode } from '@/lib/constants/languages';
import { inngest } from '@/inngest/client';
import { dbService } from '@/lib/db-service';
import { isJsonObject, type JsonObject, type JsonValue } from '@/types/json';

interface TranslateRequestBody {
  data: JsonObject;
  sourceLanguage?: string;
  targetLanguage: string;
  selectedKeys?: string[];
  projectId?: number | string;
  taskId?: number | string;
}

const isStringArray = (value: unknown): value is string[] => {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
};

const isTranslateRequestBody = (value: unknown): value is TranslateRequestBody => {
  if (!isJsonObject(value)) {
    return false;
  }

  const {
    data,
    sourceLanguage,
    targetLanguage,
    selectedKeys,
    projectId,
    taskId,
  } = value as Record<string, unknown>;

  if (!isJsonObject(data)) {
    return false;
  }

  if (typeof targetLanguage !== 'string') {
    return false;
  }

  if (
    sourceLanguage !== undefined &&
    typeof sourceLanguage !== 'string'
  ) {
    return false;
  }

  if (selectedKeys !== undefined && !isStringArray(selectedKeys)) {
    return false;
  }

  if (
    projectId !== undefined &&
    typeof projectId !== 'string' &&
    typeof projectId !== 'number'
  ) {
    return false;
  }

  if (taskId !== undefined && typeof taskId !== 'string' && typeof taskId !== 'number') {
    return false;
  }

  return true;
};

const countKeys = (obj: JsonObject): number => {
  let count = 0;

  for (const value of Object.values(obj)) {
    if (isJsonObject(value)) {
      count += countKeys(value);
    } else {
      count += 1;
    }
  }

  return count;
};

export async function POST(request: NextRequest) {
  let body: TranslateRequestBody | null = null;

  try {
    const rawBody = (await request.json()) as unknown;

    if (!isTranslateRequestBody(rawBody)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request payload',
        },
        { status: 400 }
      );
    }

    body = rawBody;

    const {
      data,
      sourceLanguage,
      targetLanguage,
      selectedKeys,
      projectId,
      taskId,
    } = body;

    // Parse and validate project ID
    const projectIdValue =
      typeof projectId === 'string'
        ? Number.parseInt(projectId, 10)
        : typeof projectId === 'number'
        ? projectId
        : null;

    if (projectIdValue === null || Number.isNaN(projectIdValue)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing or invalid project ID',
        },
        { status: 400 }
      );
    }

    // Parse and validate task ID
    const taskIdValue =
      typeof taskId === 'string'
        ? Number.parseInt(taskId, 10)
        : typeof taskId === 'number'
        ? taskId
        : null;

    if (taskIdValue === null || Number.isNaN(taskIdValue)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing or invalid task ID',
        },
        { status: 400 }
      );
    }

    // Verify project exists
    const project = await dbService.projects.getById(projectIdValue);
    if (!project) {
      return NextResponse.json(
        {
          success: false,
          error: 'Project not found',
        },
        { status: 404 }
      );
    }

    // Verify task exists
    const task = await dbService.translationTasks.getById(taskIdValue);
    if (!task) {
      return NextResponse.json(
        {
          success: false,
          error: 'Translation task not found',
        },
        { status: 404 }
      );
    }

    // Validate target language
    const targetLanguageInfo = getLanguageByCode(targetLanguage);
    if (!targetLanguageInfo) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported target language: ${targetLanguage}`,
        },
        { status: 400 }
      );
    }

    // Prepare data for translation
    let dataToTranslate: JsonObject = data;

    if (selectedKeys && selectedKeys.length > 0) {
      dataToTranslate = {};
      const flatData: Record<string, JsonValue> = {};

      const flattenForSelection = (obj: JsonObject, prefix = ''): void => {
        for (const [key, value] of Object.entries(obj) as Array<[
          string,
          JsonValue,
        ]>) {
          const fullKey = prefix ? `${prefix}.${key}` : key;
          if (isJsonObject(value)) {
            flattenForSelection(value, fullKey);
          } else {
            flatData[fullKey] = value;
          }
        }
      };

      flattenForSelection(data);

      for (const selectedKey of selectedKeys) {
        if (!Object.prototype.hasOwnProperty.call(flatData, selectedKey)) {
          continue;
        }

        const keys = selectedKey.split('.');
        let current: JsonObject = dataToTranslate;

        for (let i = 0; i < keys.length - 1; i += 1) {
          const segment = keys[i];
          const existingValue = current[segment];

          if (!isJsonObject(existingValue)) {
            const nextLevel: JsonObject = {};
            current[segment] = nextLevel;
            current = nextLevel;
          } else {
            current = existingValue;
          }
        }

        current[keys[keys.length - 1]] = flatData[selectedKey];
      }
    }

    const totalKeys = countKeys(dataToTranslate);

    console.log(`Starting translation coordination for ${totalKeys} keys`);

    // Send to new Inngest coordinator instead of the old single function
    await inngest.send({
      name: 'translation/coordinate', // Changed from 'translation/process'
      data: {
        projectId: projectIdValue,
        taskId: taskIdValue,
        data: dataToTranslate,
        sourceLanguage,
        targetLanguage,
        selectedKeys,
      },
    });

    // Update task status to indicate it's been queued for coordination
    try {
      await dbService.translationTasks.update(taskIdValue, {
        status: 'pending', // Will change to 'processing' when coordinator starts
      });
    } catch (error) {
      console.error('Failed to update task status to pending:', error);
    }

    return NextResponse.json({
      success: true,
      message: 'Translation job queued for processing',
      workflow: 'coordinator-worker', // Indicate new workflow
      totalKeys,
      taskId: taskIdValue,
      metadata: {
        sourceLanguage,
        targetLanguage,
        selectedKeysOnly: Boolean(selectedKeys && selectedKeys.length > 0),
        isRTL: targetLanguageInfo.rtl || false,
        chunkingStrategy: 'parallel-chunks', // Indicate new chunking approach
        maxChunkSize: 25, // Document the chunk size
      },
    });
  } catch (error) {
    console.error('Translation API error:', error);

    // Try to update task status on error if we have the task ID
    if (body?.taskId !== undefined) {
      try {
        const taskIdValue =
          typeof body.taskId === 'string'
            ? Number.parseInt(body.taskId, 10)
            : body.taskId;

        if (typeof taskIdValue === 'number' && !Number.isNaN(taskIdValue)) {
          await dbService.translationTasks.update(taskIdValue, {
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      } catch (updateError) {
        console.error('Failed to update task status to failed:', updateError);
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to queue translation job',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
