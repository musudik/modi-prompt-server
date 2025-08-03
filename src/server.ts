import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// API Key Management
const FREE_OPENAI_KEYS: string[] = process.env.FREE_OPENAI_KEYS?.split(',') || [];
const failedKeys = new Set<string>();
let currentKeyIndex = 0;

const getNextAvailableOpenAIKey = (): string | null => {
  const availableKeys = FREE_OPENAI_KEYS.filter(key => !failedKeys.has(key));
  
  if (availableKeys.length === 0) {
    return null;
  }
  
  const key = availableKeys[currentKeyIndex % availableKeys.length];
  currentKeyIndex++;
  return key;
};

const markKeyAsFailed = (apiKey: string): void => {
  failedKeys.add(apiKey);
};

// AI Provider Configurations
interface AIProvider {
  name: string;
  icon: string;
  apiEndpoint: string;
  headers: (apiKey: string) => Record<string, string>;
  formatRequest: (prompt: string, options: any) => any;
  parseResponse: (response: any) => string;
}

const AI_PROVIDERS: Record<string, AIProvider> = {
  'Claude Sonnet 4 Thinking': {
    name: 'Claude Sonnet 4 Thinking',
    icon: '/chatllm/staticllm/claude.webp',
    apiEndpoint: 'https://api.anthropic.com/v1/messages',
    headers: (apiKey: string) => ({
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    }),
    formatRequest: (prompt: string, options: any) => ({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: `Generate a detailed video prompt based on: ${prompt}

Style: ${options.style}
Camera Style: ${options.cameraStyle}
Camera Direction: ${options.cameraDirection}
Pacing: ${options.pacing}
Special Effects: ${options.specialEffects}
Target Length: ${options.promptLength} words
Custom Elements: ${options.customElements}

Please generate a video prompt that is approximately ${options.promptLength} words in length. Be precise with the word count.`
      }]
    }),
    parseResponse: (response: any) => response.content[0].text
  },
  'Claude Sonnet 3.7': {
    name: 'Claude Sonnet 3.7',
    icon: '/chatllm/staticllm/claude.webp',
    apiEndpoint: 'https://api.anthropic.com/v1/messages',
    headers: (apiKey: string) => ({
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    }),
    formatRequest: (prompt: string, options: any) => ({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: `Generate a detailed video prompt based on: ${prompt}\n\nStyle: ${options.style}\nCamera Style: ${options.cameraStyle}\nCamera Direction: ${options.cameraDirection}\nPacing: ${options.pacing}\nSpecial Effects: ${options.specialEffects}\nPrompt Length: ${options.promptLength}\nCustom Elements: ${options.customElements}`
      }]
    }),
    parseResponse: (response: any) => response.content[0].text
  },
  'Claude Opus 4 Thinking': {
    name: 'Claude Opus 4 Thinking',
    icon: '/chatllm/staticllm/claude.webp',
    apiEndpoint: 'https://api.anthropic.com/v1/messages',
    headers: (apiKey: string) => ({
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    }),
    formatRequest: (prompt: string, options: any) => ({
      model: 'claude-3-opus-20240229',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: `Generate a detailed video prompt based on: ${prompt}\n\nStyle: ${options.style}\nCamera Style: ${options.cameraStyle}\nCamera Direction: ${options.cameraDirection}\nPacing: ${options.pacing}\nSpecial Effects: ${options.specialEffects}\nPrompt Length: ${options.promptLength}\nCustom Elements: ${options.customElements}`
      }]
    }),
    parseResponse: (response: any) => response.content[0].text
  },
  'Gemini 2.5 Pro': {
    name: 'Gemini 2.5 Pro',
    icon: '/chatllm/staticllm/gemini.webp',
    apiEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent',
    headers: (apiKey: string) => ({
      'Content-Type': 'application/json'
    }),
    formatRequest: (prompt: string, options: any) => ({
      contents: [{
        parts: [{
          text: `Generate a detailed video prompt based on: ${prompt}\n\nStyle: ${options.style}\nCamera Style: ${options.cameraStyle}\nCamera Direction: ${options.cameraDirection}\nPacing: ${options.pacing}\nSpecial Effects: ${options.specialEffects}\nPrompt Length: ${options.promptLength}\nCustom Elements: ${options.customElements}`
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4000
      }
    }),
    parseResponse: (response: any) => response.candidates[0].content.parts[0].text
  },
  'Gemini 2.5 Flash': {
    name: 'Gemini 2.5 Flash',
    icon: '/chatllm/staticllm/gemini.webp',
    apiEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent',
    headers: (apiKey: string) => ({
      'Content-Type': 'application/json'
    }),
    formatRequest: (prompt: string, options: any) => ({
      contents: [{
        parts: [{
          text: `Generate a detailed video prompt based on: ${prompt}\n\nStyle: ${options.style}\nCamera Style: ${options.cameraStyle}\nCamera Direction: ${options.cameraDirection}\nPacing: ${options.pacing}\nSpecial Effects: ${options.specialEffects}\nPrompt Length: ${options.promptLength}\nCustom Elements: ${options.customElements}`
        }]
      }],
      generationConfig: {
        temperature: 0.9,
        maxOutputTokens: 4000
      }
    }),
    parseResponse: (response: any) => response.candidates[0].content.parts[0].text
  },
  'o4 Mini High': {
    name: 'o4 Mini High',
    icon: '/chatllm/staticllm/gpt.webp',
    apiEndpoint: 'https://api.openai.com/v1/chat/completions',
    headers: (apiKey: string) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    }),
    formatRequest: (prompt: string, options: any) => ({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Generate a detailed video prompt based on: ${prompt}\n\nStyle: ${options.style}\nCamera Style: ${options.cameraStyle}\nCamera Direction: ${options.cameraDirection}\nPacing: ${options.pacing}\nSpecial Effects: ${options.specialEffects}\nPrompt Length: ${options.promptLength}\nCustom Elements: ${options.customElements}`
      }],
      max_tokens: 4000,
      temperature: 0.7
    }),
    parseResponse: (response: any) => response.choices[0].message.content
  },
  'GPT-4o': {
    name: 'GPT-4o',
    icon: '/chatllm/staticllm/gpt.webp',
    apiEndpoint: 'https://api.openai.com/v1/chat/completions',
    headers: (apiKey: string) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    }),
    formatRequest: (prompt: string, options: any) => ({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: `Generate a detailed video prompt based on: ${prompt}\n\nStyle: ${options.style}\nCamera Style: ${options.cameraStyle}\nCamera Direction: ${options.cameraDirection}\nPacing: ${options.pacing}\nSpecial Effects: ${options.specialEffects}\nPrompt Length: ${options.promptLength}\nCustom Elements: ${options.customElements}`
      }],
      max_tokens: 4000,
      temperature: 0.7
    }),
    parseResponse: (response: any) => response.choices[0].message.content
  },
  // GROQ Models
  'Llama 3.3 70B Instruct (Groq)': {
    name: 'Llama 3.3 70B Instruct (Groq)',
    icon: '/chatllm/staticllm/llama.webp',
    apiEndpoint: 'https://api.groq.com/openai/v1/chat/completions',
    headers: (apiKey: string) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    }),
    formatRequest: (prompt: string, options: any) => ({
      model: 'llama3-70b-8192',
      messages: [{
        role: 'user',
        content: `Generate a detailed video prompt based on: ${prompt}\n\nStyle: ${options.style}\nCamera Style: ${options.cameraStyle}\nCamera Direction: ${options.cameraDirection}\nPacing: ${options.pacing}\nSpecial Effects: ${options.specialEffects}\nPrompt Length: ${options.promptLength}\nCustom Elements: ${options.customElements}`
      }],
      max_tokens: options?.max_tokens || 4000
    }),
    parseResponse: (response: any) => response.choices?.[0]?.message?.content
  },
  'Qwen3-32B (Groq)': {
    name: 'Qwen3-32B (Groq)',
    icon: '/chatllm/staticllm/qwen.webp',
    apiEndpoint: 'https://api.groq.com/openai/v1/chat/completions',
    headers: (apiKey: string) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    }),
    formatRequest: (prompt: string, options: any) => ({
      model: 'qwen3-32b',
      messages: [{
        role: 'user',
        content: `Generate a detailed video prompt based on: ${prompt}\n\nStyle: ${options.style}\nCamera Style: ${options.cameraStyle}\nCamera Direction: ${options.cameraDirection}\nPacing: ${options.pacing}\nSpecial Effects: ${options.specialEffects}\nPrompt Length: ${options.promptLength}\nCustom Elements: ${options.customElements}`
      }],
      max_tokens: options?.max_tokens || 4000
    }),
    parseResponse: (response: any) => response.choices?.[0]?.message?.content
  },
  // OpenRouter Models
  'Llama 3.3 70B Instruct (OpenRouter)': {
    name: 'Llama 3.3 70B Instruct (OpenRouter)',
    icon: '/chatllm/staticllm/llama.webp',
    apiEndpoint: 'https://openrouter.ai/api/v1/chat/completions',
    headers: (apiKey: string) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'http://localhost:5173',
      'X-Title': 'Modi-Prompt'
    }),
    formatRequest: (prompt: string, options: any) => ({
      model: 'meta-llama/llama-3-70b-instruct',
      messages: [{
        role: 'user',
        content: `Generate a detailed video prompt based on: ${prompt}\n\nStyle: ${options.style}\nCamera Style: ${options.cameraStyle}\nCamera Direction: ${options.cameraDirection}\nPacing: ${options.pacing}\nSpecial Effects: ${options.specialEffects}\nPrompt Length: ${options.promptLength}\nCustom Elements: ${options.customElements}`
      }],
      max_tokens: options?.max_tokens || 4000
    }),
    parseResponse: (response: any) => response.choices?.[0]?.message?.content
  },
  'Gemma 3 27B Instruct (OpenRouter)': {
    name: 'Gemma 3 27B Instruct (OpenRouter)',
    icon: '/chatllm/staticllm/gemma.webp',
    apiEndpoint: 'https://openrouter.ai/api/v1/chat/completions',
    headers: (apiKey: string) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'http://localhost:5173',
      'X-Title': 'Modi-Prompt'
    }),
    formatRequest: (prompt: string, options: any) => ({
      model: 'google/gemma-3n-e2b-it',
      messages: [{
        role: 'user',
        content: `Generate a detailed video prompt based on: ${prompt}\n\nStyle: ${options.style}\nCamera Style: ${options.cameraStyle}\nCamera Direction: ${options.cameraDirection}\nPacing: ${options.pacing}\nSpecial Effects: ${options.specialEffects}\nPrompt Length: ${options.promptLength}\nCustom Elements: ${options.customElements}`
      }],
      max_tokens: options?.max_tokens || 4000
    }),
    parseResponse: (response: any) => response.choices?.[0]?.message?.content
  },
  'DeepSeek R1 (OpenRouter)': {
    name: 'DeepSeek R1 (OpenRouter)',
    icon: '/chatllm/staticllm/deepseek.webp',
    apiEndpoint: 'https://openrouter.ai/api/v1/chat/completions',
    headers: (apiKey: string) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'http://localhost:5173',
      'X-Title': 'Modi-Prompt'
    }),
    formatRequest: (prompt: string, options: any) => ({
      model: 'deepseek-ai/deepseek-r1-0528',
      messages: [{
        role: 'user',
        content: `Generate a detailed video prompt based on: ${prompt}\n\nStyle: ${options.style}\nCamera Style: ${options.cameraStyle}\nCamera Direction: ${options.cameraDirection}\nPacing: ${options.pacing}\nSpecial Effects: ${options.specialEffects}\nPrompt Length: ${options.promptLength}\nCustom Elements: ${options.customElements}`
      }],
      max_tokens: options?.max_tokens || 4000
    }),
    parseResponse: (response: any) => response.choices?.[0]?.message?.content
  }
};


// const AI_PROVIDERS: Record<string, AIProvider> = {
//   'o4 Mini High': {
//     name: 'o4 Mini High',
//     icon: '/chatllm/staticllm/gpt.webp',
//     apiEndpoint: 'https://api.openai.com/v1/chat/completions',
//     headers: (apiKey: string) => ({
//       'Content-Type': 'application/json',
//       'Authorization': `Bearer ${apiKey}`
//     }),
//     formatRequest: (prompt: string, options: any) => ({
//       model: 'gpt-4o-mini',
//       messages: [{
//         role: 'user',
//         content: `Generate a detailed video prompt based on: ${prompt}\n\nStyle: ${options.style}\nCamera Style: ${options.cameraStyle}\nCamera Direction: ${options.cameraDirection}\nPacing: ${options.pacing}\nSpecial Effects: ${options.specialEffects}\nPrompt Length: ${options.promptLength}\nCustom Elements: ${options.customElements}`
//       }],
//       max_tokens: 4000,
//       temperature: 0.7
//     }),
//     parseResponse: (response: any) => response.choices[0].message.content
//   },
//   'GPT-4o': {
//     name: 'GPT-4o',
//     icon: '/chatllm/staticllm/gpt.webp',
//     apiEndpoint: 'https://api.openai.com/v1/chat/completions',
//     headers: (apiKey: string) => ({
//       'Content-Type': 'application/json',
//       'Authorization': `Bearer ${apiKey}`
//     }),
//     formatRequest: (prompt: string, options: any) => ({
//       model: 'gpt-4o',
//       messages: [{
//         role: 'user',
//         content: `Generate a detailed video prompt based on: ${prompt}\n\nStyle: ${options.style}\nCamera Style: ${options.cameraStyle}\nCamera Direction: ${options.cameraDirection}\nPacing: ${options.pacing}\nSpecial Effects: ${options.specialEffects}\nPrompt Length: ${options.promptLength}\nCustom Elements: ${options.customElements}`
//       }],
//       max_tokens: 4000,
//       temperature: 0.7
//     }),
//     parseResponse: (response: any) => response.choices[0].message.content
//   }
// };

// API Routes
app.post('/api/generate-prompt', async (req, res) => {
  try {
    const { model, prompt, options, apiKey: userApiKey } = req.body;
    
    const provider = AI_PROVIDERS[model];
    if (!provider) {
      return res.status(400).json({ error: 'Invalid model selected' });
    }

    let apiKey = userApiKey;
    
    // Use free keys for OpenAI models if no user key provided
    if (!apiKey && (model.includes('GPT') || model.includes('o4'))) {
      apiKey = getNextAvailableOpenAIKey();
      if (!apiKey) {
        return res.status(429).json({ 
          error: 'All free OpenAI keys are currently unavailable. Please provide your own API key.' 
        });
      }
    }

    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required for this model' });
    }

    const requestData = provider.formatRequest(prompt, options);
    const headers = provider.headers(apiKey);
    let apiEndpoint = provider.apiEndpoint;
    if (model.includes('Gemini')) {
      apiEndpoint = `${provider.apiEndpoint}?key=${apiKey}`;
    }

    try {
      const response = await axios.post(apiEndpoint, requestData, {
        headers,
        timeout: 30000
      });

      const generatedPrompt = provider.parseResponse(response.data);
      return res.json({ prompt: generatedPrompt });
    } catch (apiError: any) {
      // Mark key as failed if it's a free key and the error suggests key issues
      if (!userApiKey && apiError.response?.status === 401) {
        markKeyAsFailed(apiKey);
      }
      
      throw apiError;
    }
  } catch (error: any) {
    console.error('Error generating prompt:', error.response?.data || error.message);
    return res.status(500).json({ 
      error: 'Failed to generate prompt',
      details: error.response?.data?.error?.message || error.message
    });
  }
});

app.get('/api/models', (req, res) => {
  const models = Object.keys(AI_PROVIDERS).map(key => ({
    name: AI_PROVIDERS[key].name,
    icon: AI_PROVIDERS[key].icon
  }));
  res.json(models);
});

app.get('/api/key-stats', (req, res) => {
  res.json({
    totalKeys: FREE_OPENAI_KEYS.length,
    failedKeys: failedKeys.size,
    availableKeys: FREE_OPENAI_KEYS.length - failedKeys.size
  });
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});