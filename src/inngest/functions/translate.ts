import { inngest } from '../client';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { getLanguageByCode } from '@/lib/constants/languages';
import { dbService } from '@/lib/db-service';

const translationChunkSchema = z.object({
  translations: z.array(
    z.object({
      key: z.string(),
      original: z.string(),
      translated: z.string(),
    })
  ),
});

interface TranslationEventData {
  projectId: number;
  taskId: number;
  data: Record<string, any>;
  sourceLanguage: string;
  targetLanguage: string;
  selectedKeys?: string[];
}

interface ChunkData {
  key: string;
  value: string;
}

// Helper functions remain the same...
function chunkObject(
  obj: Record<string, any>,
  chunkSize: number = 50
): Array<Array<ChunkData>> {
  const flattenObject = (obj: any, prefix = ''): Array<ChunkData> => {
    const items: Array<ChunkData> = [];
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
      ) {
        items.push(...flattenObject(value, fullKey));
      } else {
        items.push({ key: fullKey, value: String(value) });
      }
    }
    return items;
  };

  const flatItems = flattenObject(obj);
  const chunks: Array<Array<ChunkData>> = [];
  for (let i = 0; i < flatItems.length; i += chunkSize) {
    chunks.push(flatItems.slice(i, i + chunkSize));
  }
  return chunks;
}

function rebuildObject(
  translations: Array<{ key: string; value: string }>
): Record<string, any> {
  const result: Record<string, any> = {};
  for (const { key, value } of translations) {
    const keys = key.split('.');
    let current = result;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in current)) current[keys[i]] = {};
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
  }
  return result;
}

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

export const processTranslation = inngest.createFunction(
  {
    id: 'process-translation',
    name: 'Process Large Translation Job',
    concurrency: {
      limit: 5,
    },
    retries: 3,
  },
  { event: 'translation/process' },
  async ({ event, step }) => {
    const {
      projectId,
      taskId,
      data,
      sourceLanguage,
      targetLanguage,
      selectedKeys,
    } = event.data as TranslationEventData;

    // Step 1: Initialize and validate
    await step.run('initialize-translation', async () => {
      await dbService.translationTasks.update(taskId, {
        status: 'processing',
      });

      console.log(
        `Starting translation for project ${projectId}, task ${taskId}`
      );
      return { status: 'initialized' };
    });

    // Step 2: Chunk the data
    const { chunks, totalChunks } = await step.run('chunk-data', async () => {
      let dataToTranslate = data;

      // Filter data if specific keys are selected
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

      const chunks = chunkObject(dataToTranslate, 50);

      // Update task with total progress info
      await dbService.translationTasks.updateProgress(taskId, {
        totalChunks: chunks.length,
        completedChunks: 0,
        currentChunk: 0,
      });

      console.log(`Created ${chunks.length} chunks for translation`);
      return { chunks, totalChunks: chunks.length };
    });

    // Step 3: Process each chunk
    const translatedChunks: Array<{ key: string; value: string }> = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunkResult = await step.run(`translate-chunk-${i}`, async () => {
        const chunk = chunks[i];

        // Update progress
        await dbService.translationTasks.updateProgress(taskId, {
          currentChunk: i + 1,
          completedChunks: i,
        });

        const sourceLangContext = getLanguageContext(sourceLanguage);
        const targetLangContext = getLanguageContext(targetLanguage);
        const targetLanguageInfo = getLanguageByCode(targetLanguage);

        try {
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

          const result = await generateObject({
            model: openai('gpt-4o-mini'),
            schema: translationChunkSchema,
            messages: [
              { role: 'system', content: systemPrompt },
              {
                role: 'user',
                content: `Translate these ${
                  chunk.length
                } key-value pairs from ${sourceLangContext} to ${targetLangContext}:

${chunk.map((item) => `Key: "${item.key}" | Value: "${item.value}"`).join('\n')}

Respond with translations maintaining the exact key names and properly handling all template variables and technical elements.`,
              },
            ],
          });

          const chunkTranslations = result.object.translations.map(
            (translation) => ({
              key: translation.key,
              value: translation.translated,
            })
          );

          // Save individual translations to database
          for (const translation of chunkTranslations) {
            const originalValue =
              chunk.find((item) => item.key === translation.key)?.value || '';

            await dbService.translations.save({
              projectId,
              key: translation.key,
              sourceText: originalValue,
              translatedText: translation.value,
              sourceLanguage,
              targetLanguage,
            });
          }

          console.log(
            `Completed chunk ${i + 1}/${totalChunks} with ${
              chunkTranslations.length
            } translations`
          );
          return chunkTranslations;
        } catch (chunkError) {
          console.error(`Error processing chunk ${i + 1}:`, chunkError);
          // On error, return original values to prevent data loss
          return chunk.map((item) => ({ key: item.key, value: item.value }));
        }
      });

      translatedChunks.push(...chunkResult);

      // Small delay between chunks to avoid rate limiting
      if (i < chunks.length - 1) {
        await step.sleep('rate-limit-delay', '1s');
      }
    }

    // Step 4: Finalize and rebuild
    await step.run('finalize-translation', async () => {
      const translatedData = rebuildObject(translatedChunks);

      // Apply translations back to full object if only selected keys were translated
      let finalResult = translatedData;
      if (selectedKeys && selectedKeys.length > 0) {
        finalResult = { ...data };
        for (const { key, value } of translatedChunks) {
          const keys = key.split('.');
          let current = finalResult as any;
          for (let i = 0; i < keys.length - 1; i++) {
            current = current[keys[i]];
          }
          current[keys[keys.length - 1]] = value;
        }
      }

      // Mark task as completed
      await dbService.translationTasks.update(taskId, {
        status: 'completed',
        translatedData: finalResult,
      });

      // Update final progress
      await dbService.translationTasks.updateProgress(taskId, {
        completedChunks: totalChunks,
        currentChunk: totalChunks,
      });

      console.log(`Translation completed successfully for task ${taskId}`);
      return {
        success: true,
        translatedData: finalResult,
        totalTranslations: translatedChunks.length,
      };
    });

    return {
      success: true,
      message: 'Translation completed successfully',
      totalChunks,
      totalTranslations: translatedChunks.length,
    };
  }
);
