// translation-coordinator.ts - Main orchestrator function
import { inngest } from '../client';
import { dbService } from '@/lib/db-service';
import type { TranslationCoordinatorEventData, ChunkData } from '@/db/types';
import { isJsonObject, type JsonObject, type JsonValue } from '@/types/json';

function flattenToChunkData(
  value: JsonObject,
  prefix = ''
): Array<ChunkData> {
  const items: Array<ChunkData> = [];

  for (const [key, entryValue] of Object.entries(value) as Array<[
    string,
    JsonValue,
  ]>) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (isJsonObject(entryValue)) {
      items.push(...flattenToChunkData(entryValue, fullKey));
    } else {
      items.push({ key: fullKey, value: String(entryValue) });
    }
  }

  return items;
}

function chunkEntries(
  entries: Array<ChunkData>,
  chunkSize: number = 25
): Array<Array<ChunkData>> {
  const chunks: Array<Array<ChunkData>> = [];
  for (let i = 0; i < entries.length; i += chunkSize) {
    chunks.push(entries.slice(i, i + chunkSize));
  }
  return chunks;
}

export const coordinateTranslation = inngest.createFunction(
  {
    id: 'coordinate-translation',
    name: 'Coordinate Translation Job',
    concurrency: {
      limit: 3, // Limit concurrent coordinators
    },
    retries: 2,
  },
  { event: 'translation/coordinate' },
  async ({ event, step }) => {
    const {
      projectId,
      taskId,
      data,
      sourceLanguage,
      targetLanguage,
      selectedKeys,
      context,
      skipCache,
      cacheProjectId,
    } = event.data as TranslationCoordinatorEventData;

    const cacheSourceProjectId = cacheProjectId ?? projectId;

    console.log(`Starting translation coordination for task ${taskId}`);

    // Step 1: Initialize and validate
    await step.run('initialize-translation', async () => {
      // Update task status to processing
      await dbService.translationTasks.update(taskId, {
        status: 'processing',
        startedAt: new Date(),
      });

      console.log(
        `Initialized translation for project ${projectId}, task ${taskId}`
      );
      return { status: 'initialized' };
    });

    // Step 2: Prepare and chunk the data
    const { chunks, totalKeys } = await step.run('prepare-chunks', async () => {
      let dataToTranslate: JsonObject = data;

      // Filter data if specific keys are selected
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
          const selectedValue = flatData[selectedKey];
          current[keys[keys.length - 1]] = selectedValue;
        }
      }

      const flatEntries = flattenToChunkData(dataToTranslate);
      const totalKeys = flatEntries.length;

      let entriesToTranslate = flatEntries;
      let reusedCount = 0;

      if (!skipCache && flatEntries.length > 0) {
        const existingTranslations = await dbService.translations.getByKeys(
          cacheSourceProjectId,
          targetLanguage,
          flatEntries.map((entry) => entry.key)
        );

        console.log(
          `Cache lookup for task ${taskId} (cache project ${cacheSourceProjectId}): ${existingTranslations.length} existing translation(s) found`
        );

        if (existingTranslations.length > 0) {
          const existingMap = new Map(
            existingTranslations.map((translation) => [translation.key, translation])
          );

          const filteredEntries: Array<ChunkData> = [];

          for (const entry of flatEntries) {
            const cached = existingMap.get(entry.key);

            if (
              cached &&
              cached.sourceText === entry.value &&
              cached.failed === false &&
              cached.sourceLanguage === sourceLanguage &&
              cached.targetLanguage === targetLanguage
            ) {
              reusedCount += 1;
              await dbService.translations.save({
                projectId,
                taskId,
                chunkIndex: undefined,
                key: entry.key,
                sourceText: cached.sourceText,
                translatedText: cached.translatedText,
                sourceLanguage: cached.sourceLanguage,
                targetLanguage: cached.targetLanguage,
                failed: false,
              });
            } else {
              filteredEntries.push(entry);
            }
          }

          entriesToTranslate = filteredEntries;
        }
      }

      const chunks = chunkEntries(entriesToTranslate, 25);

      // Initialize task progress with real counts
      await dbService.translationTasks.initializeProgress(
        taskId,
        totalKeys,
        chunks.length
      );

      if (reusedCount > 0) {
        await dbService.translationTasks.updateTranslatedKeys(taskId, reusedCount);
      }

      if (chunks.length > 0) {
        // Initialize chunk tracking only for remaining chunks
        await dbService.translationChunks.initializeChunks(taskId, chunks.length);
      }

      const cacheHits = totalKeys - entriesToTranslate.length;
      console.log(
        `Created ${chunks.length} chunks for ${totalKeys} total keys (cache hits: ${cacheHits})`
      );

      return { chunks, totalKeys, entriesToTranslate, reusedCount };
    });

    if (chunks.length === 0) {
      return await step.run('complete-from-cache', async () => {
        const cachedTranslations = await dbService.translations.getByTask(taskId);
        const translatedData = rebuildObject(
          cachedTranslations.map((translation) => ({
            key: translation.key,
            value: translation.translatedText,
          }))
        );

        await dbService.translationTasks.update(taskId, {
          status: 'completed',
          translatedData,
          completedAt: new Date(),
        });

        await inngest.send({
          name: 'translation/job-completed',
          data: {
            taskId,
            projectId,
            success: true,
          },
        });

        return {
          success: true,
          translatedData,
          totalTranslations: cachedTranslations.length,
          totalKeys,
          translatedKeys: totalKeys,
        };
      });
    }

    // Step 3: Dispatch chunk processing jobs in controlled batches
    await step.run('dispatch-chunk-jobs', async () => {
      const maxConcurrentChunks = 20; // Control concurrency
      const batchSize = Math.min(maxConcurrentChunks, chunks.length);

      console.log(
        `Dispatching ${chunks.length} chunks in batches of ${batchSize}`
      );

      // Send all chunk jobs at once (Inngest will handle concurrency)
      const dispatchPromises = chunks.map(async (chunk, chunkIndex) => {
        await inngest.send({
          name: 'translation/process-chunk',
          data: {
            projectId,
            taskId,
            chunkIndex,
            chunk,
            sourceLanguage,
            targetLanguage,
            totalChunks: chunks.length,
            context,
            skipCache,
            cacheProjectId: cacheSourceProjectId,
          },
        });
      });

      await Promise.all(dispatchPromises);
      console.log(`Dispatched all ${chunks.length} chunk processing jobs`);
    });

    // Step 4: Wait for completion signal
    const completionResult = await step.waitForEvent('wait-for-completion', {
      event: 'translation/job-completed',
      timeout: '30m', // 30 minute timeout for large jobs
      match: 'data.taskId',
    });

    // Step 5: Finalize the translation
    const result = await step.run('finalize-translation', async () => {
      // Handle timeout case
      if (!completionResult) {
        await dbService.translationTasks.update(taskId, {
          status: 'failed',
          error: 'Translation job timed out after 30 minutes',
          completedAt: new Date(),
        });
        throw new Error('Translation job timed out');
      }

      // Access the event data properties
      const { success, error } = completionResult.data;

      if (!success) {
        await dbService.translationTasks.update(taskId, {
          status: 'failed',
          error: error || 'Translation job failed',
          completedAt: new Date(),
        });
        throw new Error(`Translation failed: ${error}`);
      }

      // Get final progress status
      const progress = await dbService.translationTasks.getProgress(taskId);

      if (!progress) {
        throw new Error('Unable to get task progress');
      }

      // Check if we have failures
      if (progress.failedChunks > 0) {
        const errorMsg = `${progress.failedChunks} chunks failed to translate`;
        await dbService.translationTasks.update(taskId, {
          status: 'failed',
          error: errorMsg,
          completedAt: new Date(),
        });
        throw new Error(`Translation partially failed: ${errorMsg}`);
      }

      // Rebuild the final object from database translations
      const allTranslations = await dbService.translations.getByTask(taskId);
      const translatedData = rebuildObject(
        allTranslations.map((t) => ({ key: t.key, value: t.translatedText }))
      );

      // Apply translations back to full object if only selected keys were translated
      let finalResult: JsonObject = translatedData;
      if (selectedKeys && selectedKeys.length > 0) {
        finalResult = { ...data };
        for (const translation of allTranslations) {
          const keys = translation.key.split('.');
          let current: JsonObject = finalResult;
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
          current[keys[keys.length - 1]] = translation.translatedText;
        }
      }

      // Mark task as completed
      await dbService.translationTasks.update(taskId, {
        status: 'completed',
        translatedData: finalResult,
        completedAt: new Date(),
      });

      console.log(`Translation completed successfully for task ${taskId}`);
      return {
        success: true,
        translatedData: finalResult,
        totalTranslations: allTranslations.length,
        totalKeys,
        translatedKeys: progress.translatedKeys,
      };
    });

    return result;
  }
);

// Helper function to rebuild nested object from flat translations
function rebuildObject(translations: Array<{ key: string; value: string }>): JsonObject {
  const result: JsonObject = {};

  for (const { key, value } of translations) {
    const segments = key.split('.');
    let current: JsonObject = result;

    for (let i = 0; i < segments.length - 1; i += 1) {
      const segment = segments[i];
      const existingValue = current[segment];

      if (!isJsonObject(existingValue)) {
        const nextLevel: JsonObject = {};
        current[segment] = nextLevel;
        current = nextLevel;
      } else {
        current = existingValue;
      }
    }

    current[segments[segments.length - 1]] = value;
  }

  return result;
}
