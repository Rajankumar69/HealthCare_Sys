import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AiService {
  private gatewayUrl = 'http://localhost:5000/api/ai';

  private getAuthHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {
      'Accept': 'text/event-stream',
      ...extraHeaders
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  /**
   * Streams clinical summary token-by-token using Fetch and ReadableStream reader.
   * @param patientId Patient identifier
   * @param onChunk Callback triggered whenever a new text chunk is received
   * @param onDone Callback triggered when generation is complete
   * @param onError Callback triggered on error
   */
  async streamPatientSummary(
    patientId: number,
    onChunk: (text: string) => void,
    onDone: () => void,
    onError: (err: any) => void
  ): Promise<void> {
    try {
      const response = await fetch(`${this.gatewayUrl}/patient-summary/${patientId}/stream`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('ReadableStream not supported.');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data:')) {
            const dataStr = trimmed.substring(5).trim();
            if (dataStr === '[DONE]') {
              onDone();
              return;
            }

            let parsed: any = null;
            try {
              parsed = JSON.parse(dataStr);
            } catch {
              continue;
            }

            if (parsed && parsed.chunk !== undefined) {
              try {
                onChunk(parsed.chunk);
              } catch (chunkErr) {
                console.error('[AiService] Error in onChunk handler:', chunkErr);
              }
            } else if (parsed && parsed.error) {
              onError(new Error(parsed.error));
              return;
            }
          }
        }
      }

      onDone();
    } catch (err) {
      onError(err);
    }
  }

  /**
   * Streams Q&A response for a patient
   */
  async streamPatientChat(
    patientId: number,
    question: string,
    onChunk: (text: string) => void,
    onDone: () => void,
    onError: (err: any) => void
  ): Promise<void> {
    try {
      const response = await fetch(`${this.gatewayUrl}/patient-chat/stream`, {
        method: 'POST',
        headers: this.getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ patientId, question })
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('ReadableStream not supported.');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data:')) {
            const dataStr = trimmed.substring(5).trim();
            if (dataStr === '[DONE]') {
              onDone();
              return;
            }

            let parsed: any = null;
            try {
              parsed = JSON.parse(dataStr);
            } catch {
              continue;
            }

            if (parsed && parsed.chunk !== undefined) {
              try {
                onChunk(parsed.chunk);
              } catch (chunkErr) {
                console.error('[AiService] Error in onChunk handler:', chunkErr);
              }
            } else if (parsed && parsed.error) {
              onError(new Error(parsed.error));
              return;
            }
          }
        }
      }

      onDone();
    } catch (err) {
      onError(err);
    }
  }

  /**
   * Streams nurse shift summary (Work Done & Pending Work)
   */
  async streamNurseShiftSummary(
    onChunk: (text: string) => void,
    onDone: () => void,
    onError: (err: any) => void
  ): Promise<void> {
    try {
      const response = await fetch(`${this.gatewayUrl}/nurse/shift-summary/stream`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('ReadableStream not supported.');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data:')) {
            const dataStr = trimmed.substring(5).trim();
            if (dataStr === '[DONE]') {
              onDone();
              return;
            }

            let parsed: any = null;
            try {
              parsed = JSON.parse(dataStr);
            } catch {
              continue;
            }

            if (parsed && parsed.chunk !== undefined) {
              try {
                onChunk(parsed.chunk);
              } catch (chunkErr) {
                console.error('[AiService] Error in onChunk handler:', chunkErr);
              }
            } else if (parsed && parsed.error) {
              onError(new Error(parsed.error));
              return;
            }
          }
        }
      }

      onDone();
    } catch (err) {
      onError(err);
    }
  }
}
