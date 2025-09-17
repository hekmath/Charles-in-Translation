import { NextRequest, NextResponse } from 'next/server';
import { getLanguageByCode } from '@/lib/constants/languages';
import { inngest } from '@/inngest/client';
import { dbService } from '@/lib/db-service';

export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
    const {
      data,
      sourceLanguage,
      targetLanguage,
      selectedKeys,
      projectId,
      taskId,
    } = body;

    // Validation
    if (!data || !targetLanguage) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: data, targetLanguage',
        },
        { status: 400 }
      );
    }

    // Parse and validate project ID
    const projectIdValue =
      typeof projectId === 'string'
        ? parseInt(projectId)
        : typeof projectId === 'number'
        ? projectId
        : null;

    if (!projectIdValue || isNaN(projectIdValue)) {
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
        ? parseInt(taskId)
        : typeof taskId === 'number'
        ? taskId
        : null;

    if (!taskIdValue || isNaN(taskIdValue)) {
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

    // Count total keys for reporting
    const countKeys = (obj: any): number => {
      let count = 0;
      for (const [key, value] of Object.entries(obj)) {
        if (
          typeof value === 'object' &&
          value !== null &&
          !Array.isArray(value)
        ) {
          count += countKeys(value);
        } else {
          count++;
        }
      }
      return count;
    };

    // Prepare data for translation
    let dataToTranslate = data;
    if (selectedKeys && selectedKeys.length > 0) {
      dataToTranslate = {};
      const flatData: Record<string, any> = {};

      const flattenForSelection = (obj: any, prefix = '') => {
        for (const [key, value] of Object.entries(obj)) {
          const fullKey = prefix ? `${prefix}.${key}` : key;
          if (
            typeof value === 'object' &&
            value !== null &&
            !Array.isArray(value)
          ) {
            flattenForSelection(value, fullKey);
          } else {
            flatData[fullKey] = value;
          }
        }
      };
      flattenForSelection(data);

      for (const selectedKey of selectedKeys) {
        if (flatData[selectedKey] !== undefined) {
          const keys = selectedKey.split('.');
          let current = dataToTranslate as any;
          for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) current[keys[i]] = {};
            current = current[keys[i]];
          }
          current[keys[keys.length - 1]] = flatData[selectedKey];
        }
      }
    }

    const totalKeys = countKeys(dataToTranslate);

    console.log(`Sending translation job to Inngest: ${totalKeys} keys`);

    // Send to Inngest for background processing
    await inngest.send({
      name: 'translation/process',
      data: {
        projectId: projectIdValue,
        taskId: taskIdValue,
        data: dataToTranslate,
        sourceLanguage,
        targetLanguage,
        selectedKeys,
      },
    });

    // Update task status to indicate it's been queued
    try {
      await dbService.translationTasks.update(taskIdValue, {
        status: 'processing',
      });
    } catch (error) {
      console.error('Failed to update task status to processing:', error);
    }

    return NextResponse.json({
      success: true,
      message: 'Translation job queued for background processing',
      usingInngest: true,
      totalKeys,
      taskId: taskIdValue,
      metadata: {
        sourceLanguage,
        targetLanguage,
        selectedKeysOnly: !!(selectedKeys && selectedKeys.length > 0),
        isRTL: targetLanguageInfo.rtl || false,
      },
    });
  } catch (error) {
    console.error('Translation API error:', error);

    // Try to update task status on error if we have the task ID
    if (body?.taskId) {
      try {
        const taskIdValue =
          typeof body.taskId === 'string' ? parseInt(body.taskId) : body.taskId;

        if (!isNaN(taskIdValue)) {
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
