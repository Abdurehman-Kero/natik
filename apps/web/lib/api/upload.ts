'use client';

import { isApiErrorBody } from '@natik/shared';
import { ApiError, networkError } from './errors';
import { markDataChanged } from '@/lib/data-changes';

export interface UploadHandle<T> {
  promise: Promise<T>;
  abort: () => void;
}

/**
 * Sends a file with a progress callback (fetch cannot report upload progress). Errors come back
 * as ApiError, so they show the same plain-language messages as everything else.
 */
export function uploadFile<T>(
  path: string,
  file: File,
  fields: Record<string, string>,
  onProgress: (percent: number) => void,
): UploadHandle<T> {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<T>((resolve, reject) => {
    xhr.open('POST', `/api/v1${path}`);
    xhr.withCredentials = true;
    xhr.setRequestHeader('accept', 'application/json');
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onerror = () => reject(networkError(new Error('upload failed')));
    xhr.ontimeout = () => reject(networkError(new Error('upload timed out')));
    xhr.onabort = () => reject(new ApiError(0, 'ABORTED', 'Upload cancelled'));
    xhr.onload = () => {
      let body: unknown;
      try {
        body = xhr.responseText ? JSON.parse(xhr.responseText) : undefined;
      } catch {
        body = undefined;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        markDataChanged();
        resolve(body as T);
      } else if (isApiErrorBody(body)) {
        const { code, message, fields: f, params, requestId } = body.error;
        reject(new ApiError(xhr.status, code, message, f, params, requestId));
      } else {
        reject(
          new ApiError(
            xhr.status,
            xhr.status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST',
            'Upload failed',
          ),
        );
      }
    };
    const data = new FormData();
    for (const [key, value] of Object.entries(fields)) data.append(key, value);
    // Fields first, file last: the server reads the text fields before it reaches the file.
    data.append('file', file, file.name);
    xhr.send(data);
  });
  return { promise, abort: () => xhr.abort() };
}
