import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, hasApiKey: Boolean(process.env.GEMINI_API_KEY) });
  });

  app.post('/api/advisor/analyze', async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
        res.status(400).json({
          error:
            'GEMINI_API_KEY is not configured. Please add your Gemini API key in Settings > Secrets.',
        });
        return;
      }

      const { question, lang, citySnapshot } = req.body ?? {};
      if (!question || typeof question !== 'string' || !question.trim()) {
        res.status(400).json({ error: 'A question or policy prompt is required.' });
        return;
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const responseLang = lang === 'en' ? 'English' : 'Persian (فارسی)';

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: [
          `Mayor Question: ${question.trim()}`,
          `Live City Telemetry JSON:\n${JSON.stringify(citySnapshot ?? {}, null, 2)}`,
        ].join('\n\n'),
        config: {
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.HIGH,
          },
          systemInstruction: [
            `You are the Chief Urban Strategist, Macro-Economist, and Civil Engineering Advisor for ShahrSaz 3D, a realistic open-world city builder.`,
            `Respond in ${responseLang}.`,
            `Analyze the live city telemetry (treasury, cashflow, tax rates, ordinances, resource stocks, power/water balance, population, jobs, happiness, pollution, approval, active constructions) carefully.`,
            `Provide concrete, high-impact, realistic recommendations grounded in the actual numbers from the telemetry. Keep each field concise, clear, and actionable.`,
          ].join(' '),
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              diagnosis: {
                type: Type.STRING,
                description: 'Root-cause assessment of the city state and the mayor question.',
              },
              strategicRiskLevel: {
                type: Type.STRING,
                description: 'One of: LOW, MODERATE, HIGH, CRITICAL',
              },
              recommendations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    action: { type: Type.STRING },
                    expectedImpact: { type: Type.STRING },
                  },
                  required: ['title', 'action', 'expectedImpact'],
                },
              },
              suggestedTaxAdjustment: {
                type: Type.STRING,
                description: 'Concrete tax or budget allocation suggestion.',
              },
              priorityBuildFocus: {
                type: Type.STRING,
                description: 'Which building categories to construct next.',
              },
            },
            required: [
              'diagnosis',
              'strategicRiskLevel',
              'recommendations',
              'suggestedTaxAdjustment',
              'priorityBuildFocus',
            ],
          },
        },
      });

      const rawText = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawText);
      res.json({ analysis: parsed, model: 'gemini-4-hydrogen', thinkingLevel: 'HIGH' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to analyze city policy.';
      console.error('Advisor API error:', message);
      res.status(500).json({ error: message });
    }
  });

  if (isProduction) {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ShahrSaz 3D server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
