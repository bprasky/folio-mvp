import { prisma } from './prisma';

export async function logPassiveEvent(params: {
  projectId: string;
  type: 'project_create' | 'save' | 'sample_request' | 'tag_add' | 'spec_lock';
  actorId?: string;
  payload?: Record<string, any>;
}): Promise<void> {
  const { projectId, type, actorId, payload } = params;

  // Try database first
  try {
    // Defensive guard: check if analytics model exists
    if (!(prisma as any)?.analyticsEvent?.create) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Analytics disabled: prisma.analyticsEvent.create unavailable');
      }
      return; // Exit early if model doesn't exist
    }

    await prisma.analyticsEvent.create({
      data: {
        projectId,
        type,
        actorId,
        payload: payload ? JSON.stringify(payload) : null,
        createdAt: new Date(),
      },
    });
    return; // Success, exit early
  } catch (error: any) {
    const errorMsg = String(error?.message || '');
    // If it's not a schema issue (unknown model/table), rethrow
    if (!/Unknown argument|does not exist|table.*does not exist/i.test(errorMsg)) {
      console.warn('Analytics DB error (non-schema):', errorMsg);
      throw error;
    }
    // Schema issue, fall through to Storage fallback
  }

  // Fallback to Supabase Storage
  try {
    const { supabaseAdmin } = await import('./supabaseAdmin');
    
    // Ensure analytics bucket exists
    try {
      await supabaseAdmin.storage.createBucket('analytics', {
        public: false,
        allowedMimeTypes: ['application/json'],
      });
    } catch (bucketError: any) {
      // Ignore "already exists" errors
      if (!/already exists/i.test(String(bucketError?.message || ''))) {
        console.warn('Analytics bucket creation error:', bucketError);
      }
    }

    const filePath = `project-${projectId}.jsonl`;
    const eventLine = JSON.stringify({
      ts: new Date().toISOString(),
      type,
      actorId,
      payload,
    }) + '\n';

    // Read existing file if it exists
    let existingContent = '';
    try {
      const { data: existingFile } = await supabaseAdmin.storage
        .from('analytics')
        .download(filePath);
      if (existingFile) {
        existingContent = await existingFile.text();
      }
    } catch (readError) {
      // File doesn't exist, that's fine
    }

    // Upload with new event appended
    const newContent = existingContent + eventLine;
    await supabaseAdmin.storage
      .from('analytics')
      .upload(filePath, newContent, {
        upsert: true,
        contentType: 'application/json',
      });
  } catch (storageError) {
    console.warn('Analytics Storage fallback failed:', storageError);
    // Don't throw - analytics is non-critical
  }
}

// Export ready-to-use helpers
export const Analytics = {
  projectCreate: (args: Omit<Parameters<typeof logPassiveEvent>[0], 'type'>) => 
    logPassiveEvent({ ...args, type: 'project_create' }),
  save: (args: Omit<Parameters<typeof logPassiveEvent>[0], 'type'>) => 
    logPassiveEvent({ ...args, type: 'save' }),
  sampleRequest: (args: Omit<Parameters<typeof logPassiveEvent>[0], 'type'>) => 
    logPassiveEvent({ ...args, type: 'sample_request' }),
  tagAdd: (args: Omit<Parameters<typeof logPassiveEvent>[0], 'type'>) => 
    logPassiveEvent({ ...args, type: 'tag_add' }),
  specLock: (args: Omit<Parameters<typeof logPassiveEvent>[0], 'type'>) => 
    logPassiveEvent({ ...args, type: 'spec_lock' }),
}; 