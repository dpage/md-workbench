//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

import * as https from 'https';
import * as http from 'http';
import { BrowserWindow } from 'electron';
import {
  AIProvider,
  AIOptions,
  PROVIDER_CHAT_ENDPOINTS,
  PROVIDER_REQUIRES_API_KEY,
  PROVIDER_MAX_TOKENS,
  PROVIDER_SUPPORTS_TOOLS,
} from '../shared/aiProviders';
import {
  ChatMessage,
  ChatStreamRequest,
  ToolCall,
  ToolResult,
  ToolDefinition,
  StreamCallbacks,
} from '../shared/chatTypes';
import { resolveApiKey } from './aiService';

// Active requests for abort functionality
const activeRequests = new Map<string, http.ClientRequest>();

/**
 * Get the chat endpoint URL for a provider
 */
function getChatEndpoint(
  provider: AIProvider,
  options: AIOptions,
  model: string
): string {
  const endpoint = PROVIDER_CHAT_ENDPOINTS[provider];

  switch (provider) {
    case 'anthropic':
    case 'openai':
      return endpoint;
    case 'gemini':
      // Gemini requires model in URL
      return endpoint.replace('{model}', model);
    case 'ollama':
      return options.ollamaEndpoint + endpoint;
    case 'dmr':
      return options.dmrEndpoint + endpoint;
    default:
      return endpoint;
  }
}

/**
 * Get authentication headers for chat requests
 */
function getChatAuthHeaders(
  provider: AIProvider,
  apiKey: string | null
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  switch (provider) {
    case 'anthropic':
      if (apiKey) {
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
      }
      break;
    case 'openai':
    case 'dmr':
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      break;
    // Gemini uses query parameter, Ollama doesn't need auth
  }

  return headers;
}

/**
 * Get the key file path for a provider
 */
function getKeyFileForProvider(
  provider: AIProvider,
  options: AIOptions
): string {
  switch (provider) {
    case 'anthropic':
      return options.anthropicKeyFile;
    case 'openai':
      return options.openaiKeyFile;
    case 'gemini':
      return options.geminiKeyFile;
    default:
      return '';
  }
}

/**
 * Get the selected model for a provider
 */
function getModelForProvider(
  provider: AIProvider,
  options: AIOptions
): string {
  switch (provider) {
    case 'anthropic':
      return options.anthropicModel || 'claude-sonnet-4-20250514';
    case 'openai':
      return options.openaiModel || 'gpt-4o';
    case 'gemini':
      return options.geminiModel || 'gemini-1.5-pro';
    case 'ollama':
      return options.ollamaModel || 'llama3.2';
    case 'dmr':
      return options.dmrModel || 'ai/llama3.2';
    default:
      return '';
  }
}

/**
 * Build the request body for each provider
 */
function buildRequestBody(
  provider: AIProvider,
  model: string,
  messages: ChatMessage[],
  systemPrompt: string,
  tools: ToolDefinition[]
): string {
  const maxTokens = PROVIDER_MAX_TOKENS[provider];
  const supportsTools = PROVIDER_SUPPORTS_TOOLS[provider] && tools.length > 0;

  // Filter out messages with empty content (except tool calls which may have empty text)
  const validMessages = messages.filter((m) => {
    if (m.toolCalls && m.toolCalls.length > 0) return true;
    if (m.role === 'tool') return true;
    return m.content && m.content.trim().length > 0;
  });

  console.log('[Chat] Original messages:', messages.length, '-> Valid messages:', validMessages.length);

  switch (provider) {
    case 'anthropic': {
      const anthropicMessages = validMessages
        .filter((m) => m.role !== 'system')
        .map((m) => {
          if (m.role === 'tool') {
            const toolResult: Record<string, unknown> = {
              type: 'tool_result',
              tool_use_id: m.toolCallId,
              content: m.content,
            };
            // Include is_error flag so Claude knows the tool execution failed
            if (m.isError) {
              toolResult.is_error = true;
            }
            return {
              role: 'user',
              content: [toolResult],
            };
          }
          if (m.toolCalls && m.toolCalls.length > 0) {
            return {
              role: 'assistant',
              content: [
                ...(m.content ? [{ type: 'text', text: m.content }] : []),
                ...m.toolCalls.map((tc) => ({
                  type: 'tool_use',
                  id: tc.id,
                  name: tc.name,
                  input: tc.arguments,
                })),
              ],
            };
          }
          return { role: m.role, content: m.content };
        });

      const body: Record<string, unknown> = {
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: anthropicMessages,
        stream: true,
      };

      if (supportsTools) {
        body.tools = tools.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.parameters,
        }));
      }

      return JSON.stringify(body);
    }

    case 'openai':
    case 'dmr': {
      const openaiMessages = [
        { role: 'system', content: systemPrompt },
        ...validMessages.map((m) => {
          if (m.role === 'tool') {
            // OpenAI doesn't have is_error flag, so prefix error messages clearly
            const content = m.isError ? `ERROR: ${m.content}` : m.content;
            return {
              role: 'tool',
              content,
              tool_call_id: m.toolCallId,
            };
          }
          if (m.toolCalls && m.toolCalls.length > 0) {
            return {
              role: 'assistant',
              content: m.content || null,
              tool_calls: m.toolCalls.map((tc) => ({
                id: tc.id,
                type: 'function',
                function: {
                  name: tc.name,
                  arguments: JSON.stringify(tc.arguments),
                },
              })),
            };
          }
          return { role: m.role, content: m.content };
        }),
      ];

      const body: Record<string, unknown> = {
        model,
        messages: openaiMessages,
        stream: true,
      };

      if (supportsTools) {
        body.tools = tools.map((t) => ({
          type: 'function',
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          },
        }));
      }

      return JSON.stringify(body);
    }

    case 'gemini': {
      // Convert messages for Gemini, handling tool messages specially
      // Gemini requires alternating user/model roles, so merge consecutive same-role messages
      const geminiContents: { role: string; parts: { text: string }[] }[] = [];

      for (const m of validMessages) {
        if (m.role === 'system') continue; // Skip system messages (handled separately)

        // Determine role: assistant → model, everything else → user
        const role = m.role === 'assistant' ? 'model' : 'user';
        // Prefix error messages clearly for tool results
        const content = m.role === 'tool' && m.isError ? `ERROR: ${m.content}` : m.content;

        // If we have consecutive messages with the same role, merge them
        if (geminiContents.length > 0 && geminiContents[geminiContents.length - 1].role === role) {
          geminiContents[geminiContents.length - 1].parts[0].text += '\n\n' + content;
        } else {
          geminiContents.push({ role, parts: [{ text: content }] });
        }
      }

      const body: Record<string, unknown> = {
        contents: geminiContents,
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          maxOutputTokens: maxTokens,
        },
      };

      if (supportsTools) {
        body.tools = [
          {
            functionDeclarations: tools.map((t) => ({
              name: t.name,
              description: t.description,
              parameters: t.parameters,
            })),
          },
        ];
      }

      return JSON.stringify(body);
    }

    case 'ollama': {
      // Convert messages for Ollama, handling tool messages specially
      // Some models don't support 'tool' role, so convert to user messages
      const convertedMessages: { role: string; content: string }[] = [];

      for (const m of validMessages) {
        let role = m.role;
        let content = m.content;

        // Convert tool role to user (tool results are like user providing info)
        if (m.role === 'tool') {
          role = 'user';
          content = m.isError ? `Tool Error: ${m.content}` : `Tool Result: ${m.content}`;
        }

        // If we have consecutive messages with the same role, merge them
        if (convertedMessages.length > 0 && convertedMessages[convertedMessages.length - 1].role === role) {
          convertedMessages[convertedMessages.length - 1].content += '\n\n' + content;
        } else {
          convertedMessages.push({ role, content });
        }
      }

      const ollamaMessages = [
        { role: 'system', content: systemPrompt },
        ...convertedMessages,
      ];

      const body: Record<string, unknown> = {
        model,
        messages: ollamaMessages,
        stream: true,
      };

      if (supportsTools) {
        body.tools = tools.map((t) => ({
          type: 'function',
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          },
        }));
      }

      return JSON.stringify(body);
    }

    default:
      return '{}';
  }
}

// Content tracking for streaming with per-request tool argument buffers
interface StreamingContent {
  text: string;
  toolCalls: ToolCall[];
  toolArgBuffers: Map<number, string>;
  toolIndexMap: Map<number, number>; // Maps content block index to tool call index
}

/**
 * Create a new streaming content tracker
 */
function createStreamingContent(): StreamingContent {
  return {
    text: '',
    toolCalls: [],
    toolArgBuffers: new Map(),
    toolIndexMap: new Map(),
  };
}

/**
 * Parse SSE data for Anthropic streaming
 */
function parseAnthropicStream(
  data: string,
  currentContent: StreamingContent,
  callbacks: StreamCallbacks
): void {
  const lines = data.split('\n');

  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    const jsonStr = line.slice(6);
    if (jsonStr === '[DONE]') continue;

    try {
      const event = JSON.parse(jsonStr);

      if (event.type === 'content_block_delta') {
        if (event.delta?.type === 'text_delta') {
          currentContent.text += event.delta.text;
          callbacks.onToken(event.delta.text);
        } else if (event.delta?.type === 'input_json_delta') {
          // Accumulate tool argument JSON for this block index
          const index = event.index;
          const currentJson = currentContent.toolArgBuffers.get(index) || '';
          currentContent.toolArgBuffers.set(index, currentJson + (event.delta.partial_json || ''));
        }
      } else if (event.type === 'content_block_start') {
        if (event.content_block?.type === 'tool_use') {
          const toolCallIndex = currentContent.toolCalls.length;
          const toolCall: ToolCall = {
            id: event.content_block.id,
            name: event.content_block.name,
            arguments: {},
          };
          currentContent.toolCalls.push(toolCall);
          // Initialize the argument buffer and map block index to tool call index
          currentContent.toolArgBuffers.set(event.index, '');
          currentContent.toolIndexMap.set(event.index, toolCallIndex);
        }
      } else if (event.type === 'content_block_stop') {
        // Content block complete - parse accumulated arguments for tool calls
        const blockIndex = event.index;
        const toolCallIndex = currentContent.toolIndexMap.get(blockIndex);

        if (toolCallIndex !== undefined && currentContent.toolArgBuffers.has(blockIndex)) {
          const argJson = currentContent.toolArgBuffers.get(blockIndex);
          if (argJson) {
            try {
              currentContent.toolCalls[toolCallIndex].arguments = JSON.parse(argJson);
            } catch {
              console.error('[Chat] Failed to parse tool arguments:', argJson);
            }
          }
          currentContent.toolArgBuffers.delete(blockIndex);
          currentContent.toolIndexMap.delete(blockIndex);

          // Notify about the completed tool call
          callbacks.onToolCall(currentContent.toolCalls[toolCallIndex]);
        }
      }
    } catch {
      // Ignore parse errors for incomplete chunks
    }
  }
}

/**
 * Parse SSE data for OpenAI streaming
 */
function parseOpenAIStream(
  data: string,
  currentContent: { text: string; toolCalls: ToolCall[] },
  callbacks: StreamCallbacks
): void {
  const lines = data.split('\n');

  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    const jsonStr = line.slice(6);
    if (jsonStr === '[DONE]') continue;

    try {
      const chunk = JSON.parse(jsonStr);
      const delta = chunk.choices?.[0]?.delta;

      if (delta?.content) {
        currentContent.text += delta.content;
        callbacks.onToken(delta.content);
      }

      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          const index = tc.index;
          if (!currentContent.toolCalls[index]) {
            currentContent.toolCalls[index] = {
              id: tc.id || '',
              name: tc.function?.name || '',
              arguments: {},
            };
          }
          if (tc.id) {
            currentContent.toolCalls[index].id = tc.id;
          }
          if (tc.function?.name) {
            currentContent.toolCalls[index].name = tc.function.name;
          }
          if (tc.function?.arguments) {
            // Accumulate arguments (streamed as string)
            const existing = currentContent.toolCalls[index].arguments as {
              _raw?: string;
            };
            existing._raw = (existing._raw || '') + tc.function.arguments;
          }
        }
      }

      if (chunk.choices?.[0]?.finish_reason === 'tool_calls') {
        // Parse accumulated arguments
        for (const tc of currentContent.toolCalls) {
          const raw = (tc.arguments as { _raw?: string })._raw;
          if (raw) {
            try {
              tc.arguments = JSON.parse(raw);
            } catch {
              tc.arguments = {};
            }
          }
          callbacks.onToolCall(tc);
        }
      }
    } catch {
      // Ignore parse errors for incomplete chunks
    }
  }
}

/**
 * Parse NDJSON for Ollama streaming
 */
function parseOllamaStream(
  data: string,
  currentContent: { text: string; toolCalls: ToolCall[] },
  callbacks: StreamCallbacks
): void {
  const lines = data.split('\n').filter((l) => l.trim());

  for (const line of lines) {
    try {
      const chunk = JSON.parse(line);

      if (chunk.message?.content) {
        currentContent.text += chunk.message.content;
        callbacks.onToken(chunk.message.content);
      }

      if (chunk.message?.tool_calls) {
        for (const tc of chunk.message.tool_calls) {
          const toolCall: ToolCall = {
            id: tc.id || `tool-${Date.now()}`,
            name: tc.function?.name || '',
            arguments: tc.function?.arguments || {},
          };
          currentContent.toolCalls.push(toolCall);
          callbacks.onToolCall(toolCall);
        }
      }
    } catch {
      // Ignore parse errors
    }
  }
}

/**
 * Parse XML-style function calls from text content
 * Some models output function calls in XML format instead of using proper tool API
 * Supports formats like:
 *   <function=name><parameter=param>value</parameter></function>
 *   <function=name>...</function></tool_call>
 */
function parseXmlFunctionCalls(
  text: string,
  existingToolCalls: ToolCall[]
): { cleanedText: string; toolCalls: ToolCall[] } {
  const toolCalls: ToolCall[] = [...existingToolCalls];

  // Pattern to match XML-style function calls
  // Handles: <function=name>...</function> with optional </tool_call> after
  const functionPattern = /<function=(\w+)>\s*([\s\S]*?)<\/function>\s*(?:<\/tool_call>)?/gi;

  // Pattern to extract parameters
  const paramPattern = /<parameter=(\w+)>([\s\S]*?)<\/parameter>/gi;

  let cleanedText = text;
  let match;

  while ((match = functionPattern.exec(text)) !== null) {
    const fullMatch = match[0];
    const functionName = match[1];
    const paramsContent = match[2];

    // Extract parameters
    const args: Record<string, unknown> = {};
    let paramMatch;
    paramPattern.lastIndex = 0; // Reset regex

    while ((paramMatch = paramPattern.exec(paramsContent)) !== null) {
      const paramName = paramMatch[1];
      let paramValue: unknown = paramMatch[2].trim();

      // Try to parse as JSON for complex values, otherwise keep as string
      if (paramValue === 'true') paramValue = true;
      else if (paramValue === 'false') paramValue = false;
      else if (!isNaN(Number(paramValue)) && paramValue !== '') {
        paramValue = Number(paramValue);
      }

      args[paramName] = paramValue;
    }

    // Only create tool call if we found parameters
    if (Object.keys(args).length > 0) {
      const toolCall: ToolCall = {
        id: `xml-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: functionName,
        arguments: args,
      };

      toolCalls.push(toolCall);
      console.log('[Chat] Parsed XML function call:', functionName, args);

      // Remove the XML from the text
      cleanedText = cleanedText.replace(fullMatch, '').trim();
    }
  }

  return { cleanedText, toolCalls };
}

/**
 * Parse Gemini streaming response (SSE format when using alt=sse)
 */
function parseGeminiStream(
  data: string,
  currentContent: { text: string; toolCalls: ToolCall[] },
  callbacks: StreamCallbacks
): void {
  // Gemini with alt=sse returns SSE format like OpenAI
  const lines = data.split('\n');

  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    const jsonStr = line.slice(6).trim();
    if (!jsonStr || jsonStr === '[DONE]') continue;

    try {
      const chunk = JSON.parse(jsonStr);
      const parts = chunk.candidates?.[0]?.content?.parts || [];

      for (const part of parts) {
        if (part.text) {
          currentContent.text += part.text;
          callbacks.onToken(part.text);
        }
        if (part.functionCall) {
          const toolCall: ToolCall = {
            id: `gemini-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: part.functionCall.name,
            arguments: part.functionCall.args || {},
          };
          currentContent.toolCalls.push(toolCall);
          callbacks.onToolCall(toolCall);
        }
      }
    } catch {
      // Ignore parse errors for incomplete chunks
    }
  }
}

/**
 * Stream a chat completion from a provider
 */
export async function streamChat(
  provider: AIProvider,
  options: AIOptions,
  messages: ChatMessage[],
  systemPrompt: string,
  tools: ToolDefinition[],
  callbacks: StreamCallbacks,
  requestId: string,
  mainWindow: BrowserWindow | null
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const model = getModelForProvider(provider, options);
      let apiKey: string | null = null;

      // Get API key for cloud providers
      if (PROVIDER_REQUIRES_API_KEY[provider]) {
        const keyFile = getKeyFileForProvider(provider, options);
        const keyResult = await resolveApiKey(provider, keyFile);
        if (!keyResult.key) {
          throw new Error(
            'No API key available. Please configure an API key.'
          );
        }
        apiKey = keyResult.key;
      }

      // Build endpoint URL
      let url = getChatEndpoint(provider, options, model);
      if (provider === 'gemini') {
        url += `?key=${apiKey}&alt=sse`;
      }

      // Parse URL
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === 'https:';
      const transport = isHttps ? https : http;

      // Build request body
      const body = buildRequestBody(
        provider,
        model,
        messages,
        systemPrompt,
        tools
      );

      // Build headers
      const headers = getChatAuthHeaders(provider, apiKey);

      // Make request
      const reqOptions: https.RequestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers: {
          ...headers,
          'Content-Length': Buffer.byteLength(body),
        },
      };

      const currentContent = createStreamingContent();

      const req = transport.request(reqOptions, (res) => {
        let buffer = '';

        // Check for HTTP errors
        if (res.statusCode && res.statusCode >= 400) {
          let errorBody = '';
          res.on('data', (chunk: Buffer) => {
            errorBody += chunk.toString();
          });
          res.on('end', () => {
            let errorMessage = `HTTP ${res.statusCode}: ${res.statusMessage}`;
            try {
              const errorJson = JSON.parse(errorBody);
              errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
            } catch {
              // Use the default error message
            }
            callbacks.onError(new Error(errorMessage));
            activeRequests.delete(requestId);
            reject(new Error(errorMessage));
          });
          return;
        }

        res.on('data', (chunk: Buffer) => {
          const data = chunk.toString();
          buffer += data;

          // Process based on provider
          switch (provider) {
            case 'anthropic':
              parseAnthropicStream(buffer, currentContent, callbacks);
              break;
            case 'openai':
            case 'dmr':
              parseOpenAIStream(buffer, currentContent, callbacks);
              break;
            case 'ollama':
              parseOllamaStream(buffer, currentContent, callbacks);
              break;
            case 'gemini':
              parseGeminiStream(buffer, currentContent, callbacks);
              break;
          }

          // Clear processed data from buffer
          const lastNewline = buffer.lastIndexOf('\n');
          if (lastNewline !== -1) {
            buffer = buffer.slice(lastNewline + 1);
          }
        });

        res.on('end', () => {
          // Check for XML-style function calls in the text content
          // Some models (e.g., qwen3-coder) output function calls as XML instead of using proper tool API
          const { cleanedText, toolCalls: parsedToolCalls } = parseXmlFunctionCalls(
            currentContent.text,
            currentContent.toolCalls
          );

          // If we found XML tool calls, notify about them
          if (parsedToolCalls.length > currentContent.toolCalls.length) {
            for (let i = currentContent.toolCalls.length; i < parsedToolCalls.length; i++) {
              callbacks.onToolCall(parsedToolCalls[i]);
            }
          }

          // Build final message
          const message: ChatMessage = {
            role: 'assistant',
            content: cleanedText,
            toolCalls:
              parsedToolCalls.length > 0
                ? parsedToolCalls
                : undefined,
            timestamp: Date.now(),
          };

          callbacks.onComplete(message);
          activeRequests.delete(requestId);
          resolve();
        });

        res.on('error', (err) => {
          callbacks.onError(err);
          activeRequests.delete(requestId);
          reject(err);
        });
      });

      req.on('error', (err) => {
        callbacks.onError(err);
        activeRequests.delete(requestId);
        reject(err);
      });

      // Store request for abort
      activeRequests.set(requestId, req);

      // Send body
      req.write(body);
      req.end();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      callbacks.onError(error);
      reject(error);
    }
  });
}

/**
 * Abort an active chat request
 */
export function abortChat(requestId: string): boolean {
  const req = activeRequests.get(requestId);
  if (req) {
    req.destroy();
    activeRequests.delete(requestId);
    return true;
  }
  return false;
}

/**
 * Check if a request is active
 */
export function isRequestActive(requestId: string): boolean {
  return activeRequests.has(requestId);
}
