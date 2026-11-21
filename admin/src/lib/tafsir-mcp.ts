import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { GenerationError, type AyahContext, type TafsirSource } from './generation';
import { TAFSIR_SOURCES } from './generation-schema';

export type CallTool = (name: string, args: Record<string, unknown>) => Promise<unknown>;

type ToolResult = {
  isError?: boolean;
  structuredContent?: unknown;
  content?: { type: string; text?: string }[];
};

const MAX_PARTS = 20;

export function readToolPayload(result: ToolResult): unknown {
  const text = (result.content ?? []).find((c) => c.type === 'text')?.text ?? '';
  if (result.isError) throw new GenerationError(`خادم التفسير أعاد خطأ: ${text}`);
  if (result.structuredContent) return result.structuredContent;
  try {
    return JSON.parse(text);
  } catch {
    throw new GenerationError('رد خادم التفسير بصيغة غير متوقعة');
  }
}

type TafsirEntry = { source: string; attribution: string; text: string; has_more?: boolean };

export function createTafsirSource(call: CallTool): TafsirSource {
  return {
    async getAyah(surah, ayah) {
      const a = (await call('fetch_ayah', { surah, ayah })) as { text?: string; text_uthmani?: string };
      if (!a?.text) throw new GenerationError(`الآية ${surah}:${ayah} غير موجودة`);

      const tafsirs: AyahContext['tafsirs'] = [];
      for (const source of TAFSIR_SOURCES) {
        let text = '';
        let attribution = '';
        for (let part = 1; part <= MAX_PARTS; part++) {
          const r = (await call('fetch_tafsir', { surah, ayah, sources: [source], part })) as { tafsirs?: TafsirEntry[] };
          const entry = r?.tafsirs?.find((t) => t.source === source);
          if (!entry) break;
          attribution = entry.attribution;
          text += entry.text;
          if (!entry.has_more) break;
        }
        if (text) tafsirs.push({ source, attribution, text });
      }
      if (tafsirs.length === 0) throw new GenerationError(`لا يوجد تفسير للآية ${surah}:${ayah} في المختصر ولا السعدي`);

      return { surah, ayah, text: a.text_uthmani || a.text, tafsirs };
    },
  };
}

export async function connectTafsirMcp(url: string, token?: string) {
  const client = new Client({ name: 'quran-quiz-admin', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(
    new URL(url),
    token ? { requestInit: { headers: { Authorization: `Bearer ${token}` } } } : undefined,
  );
  await client.connect(transport);
  const call: CallTool = async (name, args) => readToolPayload((await client.callTool({ name, arguments: args })) as ToolResult);
  return { source: createTafsirSource(call), close: () => client.close() };
}
