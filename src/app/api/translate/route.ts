// src/app/api/translate/route.ts - Simplified to always use Inngest
import { NextRequest, NextResponse } from 'next/server';
import { getLanguageByCode } from '@/lib/constants/languages';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../convex/_generated/api';
import { inngest } from '@/inngest/client';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

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
        { error: 'Missing required fields: data, targetLanguage' },
        { status: 400 }
      );
    }

    const projectIdValue =
      typeof projectId === 'string' ? projectId : projectId?._id ?? null;
    if (!projectIdValue) {
      return NextResponse.json(
        { error: 'Missing required field: projectId' },
        { status: 400 }
      );
    }

    if (!taskId) {
      return NextResponse.json(
        { error: 'Missing required field: taskId' },
        { status: 400 }
      );
    }

    const targetLanguageInfo = getLanguageByCode(targetLanguage);
    if (!targetLanguageInfo) {
      return NextResponse.json(
        { error: `Unsupported target language: ${targetLanguage}` },
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

    // Always send to Inngest for consistent processing
    await inngest.send({
      name: 'translation/process',
      data: {
        projectId: projectIdValue,
        taskId,
        data: dataToTranslate,
        sourceLanguage,
        targetLanguage,
        selectedKeys,
      },
    });

    // Update task status to indicate it's been queued
    try {
      await convex.mutation(api.translations.updateTranslationTask, {
        taskId,
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
      taskId,
      metadata: {
        sourceLanguage,
        targetLanguage,
        selectedKeysOnly: !!(selectedKeys && selectedKeys.length > 0),
        isRTL: targetLanguageInfo.rtl || false,
      },
    });
  } catch (error) {
    console.error('Translation API error:', error);

    // Try to update task status on error
    if (body?.taskId) {
      try {
        await convex.mutation(api.translations.updateTranslationTask, {
          taskId: body.taskId,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
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
