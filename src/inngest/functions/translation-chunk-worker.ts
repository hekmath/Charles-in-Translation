// translation-chunk-worker.ts - Processes individual chunks in parallel
import { inngest } from '../client';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { getLanguageByCode } from '@/lib/constants/languages';
import { dbService } from '@/lib/db-service';
import type { TranslationChunkEventData, ChunkData } from '@/db/types';

const translationChunkSchema = z.object({
  translations: z.array(
    z.object({
      key: z.string(),
      original: z.string(),
      translated: z.string(),
    })
  ),
});

function getLanguageContext(code: string): string {
  const language = getLanguageByCode(code);
  if (!language) return code.toUpperCase();
  let context = language.name;
  if (language.nativeName && language.nativeName !== language.name) {
    context += ` (${language.nativeName})`;
  }
  if (language.rtl) {
    context += ' - Right-to-left language';
  }
  return context;
}

export const processTranslationChunk = inngest.createFunction(
  {
    id: 'process-translation-chunk',
    name: 'Process Translation Chunk',
    concurrency: {
      limit: 5, // Allow up to 15 chunks to process in parallel
    },
    retries: 3, // Retry failed chunks up to 3 times
  },
  { event: 'translation/process-chunk' },
  async ({ event, step }) => {
    const {
      projectId,
      taskId,
      chunkIndex,
      chunk,
      sourceLanguage,
      targetLanguage,
      totalChunks,
    } = event.data as TranslationChunkEventData;

    console.log(
      `Processing chunk ${chunkIndex + 1}/${totalChunks} for task ${taskId} (${
        chunk.length
      } items)`
    );

    const result = await step.run(`translate-chunk-${chunkIndex}`, async () => {
      try {
        // Mark chunk as processing
        await dbService.translationChunks.updateStatus(
          taskId,
          chunkIndex,
          'processing',
          chunk.length
        );

        // Get language context for better translations
        const sourceLangContext = getLanguageContext(sourceLanguage);
        const targetLangContext = getLanguageContext(targetLanguage);
        const targetLanguageInfo = getLanguageByCode(targetLanguage);

        // Build system prompt with language-specific considerations
        let systemPrompt = `You are a professional translator specializing in software localization. Your task is to translate JSON key-value pairs from ${sourceLangContext} to ${targetLangContext}.

CRITICAL RULES:
1. NEVER translate content within double curly braces like {{name}}, {{count}}, etc.
2. NEVER translate content within single curly braces like {username}, {date}, etc.
3. NEVER translate HTML tags like <b>, </b>, <span>, etc.
4. NEVER translate placeholder values like %s, %d, {0}, {1}, etc.
5. Preserve the exact key names - only translate the values
6. Maintain the same tone and context across all translations
7. Consider the context of UI/software applications
8. Keep translations concise and natural for the target language
9. For technical terms, use standard translations in the target language
10. If a value seems to be a proper noun (like a company name), keep it unchanged`;

        if (targetLanguageInfo?.rtl) {
          systemPrompt += `
11. The target language (${targetLangContext}) is written right-to-left. Ensure proper text direction handling.
12. Consider cultural context appropriate for RTL languages.`;
        }

        systemPrompt +=
          '\n\nTranslate accurately while preserving the technical integrity and user experience intent.';

        // Make AI translation request
        const translationResult = await generateObject({
          model: openai('gpt-5-mini'),
          schema: translationChunkSchema,
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: `Translate these ${
                chunk.length
              } key-value pairs from ${sourceLangContext} to ${targetLangContext}:

${chunk
  .map((item: ChunkData) => `Key: "${item.key}" | Value: "${item.value}"`)
  .join('\n')}

Respond with translations maintaining the exact key names and properly handling all template variables and technical elements.`,
            },
          ],
        });

        // Save individual translations to database
        const savedTranslations = [];
        for (const translation of translationResult.object.translations) {
          const originalValue =
            chunk.find((item: ChunkData) => item.key === translation.key)
              ?.value || '';

          const saved = await dbService.translations.save({
            projectId,
            taskId,
            chunkIndex,
            key: translation.key,
            sourceText: originalValue,
            translatedText: translation.translated,
            sourceLanguage,
            targetLanguage,
            failed: false,
          });

          savedTranslations.push(saved);
        }

        // Update chunk status to completed
        await dbService.translationChunks.updateStatus(
          taskId,
          chunkIndex,
          'completed',
          chunk.length,
          translationResult.object.translations.length
        );

        // Update overall task progress
        await dbService.translationTasks.updateTranslatedKeys(
          taskId,
          translationResult.object.translations.length
        );
        await dbService.translationTasks.incrementCompletedChunks(taskId);

        console.log(
          `Completed chunk ${
            chunkIndex + 1
          }/${totalChunks} for task ${taskId} (${
            translationResult.object.translations.length
          } translations)`
        );

        return {
          success: true,
          chunkIndex,
          translatedCount: translationResult.object.translations.length,
          itemsCount: chunk.length,
        };
      } catch (error) {
        console.error(
          `Error processing chunk ${chunkIndex} for task ${taskId}:`,
          error
        );

        // Mark chunk as failed
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        await dbService.translationChunks.updateStatus(
          taskId,
          chunkIndex,
          'failed',
          chunk.length,
          0,
          errorMessage
        );

        // Increment failed chunks count
        await dbService.translationTasks.incrementFailedChunks(taskId);

        // Save original values as fallback to prevent data loss
        for (const item of chunk) {
          await dbService.translations.save({
            projectId,
            taskId,
            chunkIndex,
            key: item.key,
            sourceText: item.value,
            translatedText: item.value, // Keep original as fallback
            sourceLanguage,
            targetLanguage,
            failed: true,
          });
        }

        throw error; // Re-throw to trigger retries
      }
    });

    // After processing this chunk, check if all chunks are complete
    await step.run('check-completion', async () => {
      const progress = await dbService.translationTasks.getProgress(taskId);

      if (!progress) {
        console.error(`Unable to get progress for task ${taskId}`);
        return;
      }

      const totalProcessed = progress.completedChunks + progress.failedChunks;

      console.log(
        `Task ${taskId} progress: ${totalProcessed}/${progress.totalChunks} chunks processed`
      );

      // If all chunks are processed (completed or failed), signal completion
      if (totalProcessed === progress.totalChunks) {
        console.log(
          `All chunks processed for task ${taskId}. Signaling completion.`
        );

        await inngest.send({
          name: 'translation/job-completed',
          data: {
            taskId,
            projectId,
            success: progress.failedChunks === 0,
            error:
              progress.failedChunks > 0
                ? `${progress.failedChunks} chunks failed`
                : undefined,
          },
        });
      }
    });

    return result;
  }
);

// Completion handler - runs when all chunks are done
export const handleTranslationCompletion = inngest.createFunction(
  {
    id: 'handle-translation-completion',
    name: 'Handle Translation Completion',
  },
  { event: 'translation/job-completed' },
  async ({ event, step }) => {
    const { taskId, projectId, success, error } = event.data;

    await step.run('log-completion', async () => {
      if (success) {
        console.log(
          `Translation job completed successfully for task ${taskId}`
        );
      } else {
        console.log(
          `Translation job completed with errors for task ${taskId}: ${error}`
        );
      }

      // Could add additional cleanup or notification logic here
      // For example:
      // - Send email notifications
      // - Clean up temporary files
      // - Update external systems
      // - Generate completion reports

      return { success, taskId, projectId };
    });
  }
);
