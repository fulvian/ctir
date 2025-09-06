import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { TaskClassifier } from '@/core/classifier';
import { SimpleRoutingEngine } from '@/core/router-simple';
import { CTIRTask, TaskCategory } from '@/models/task';
import { CTIRSession } from '@/models/session';
import { logger } from '@/utils/logger';
import type { CTIRCore } from '@/core/engine';
import { ClaudeSessionMonitor, OpenRouterConfig } from '@/core/claude-session-monitor';

export class CTIRProxy {
  private app = express();
  private classifier = new TaskClassifier();
  private router = new SimpleRoutingEngine();
  private port = 3001;
  private ctirCore?: CTIRCore;
  private sessionMonitor?: ClaudeSessionMonitor;

  constructor() {
    this.setupMiddleware();
    this.setupRoutes();
  }

  setCTIRCore(core: CTIRCore): void {
    this.ctirCore = core;
    
    // Inizializza il monitor della sessione Claude
    const openRouterConfig: OpenRouterConfig = {
      apiKey: process.env.OPEN_ROUTER_API_KEY || "",
      baseURL: "https://openrouter.ai/api/v1",
      models: {
        default: "anthropic/claude-3.5-sonnet",
        longContext: "anthropic/claude-3.5-sonnet",
        background: "meta-llama/llama-3.1-8b-instruct"
      }
    };
    
    this.sessionMonitor = new ClaudeSessionMonitor(
      openRouterConfig,
      process.env.CLAUDE_API_KEY
    );
    
    logger.info("CTIR Proxy: Session monitor initialized");
  }

  private setupMiddleware() {
    // Parse JSON bodies
    this.app.use(express.json({ limit: '50mb' }));
    
    // Log all requests
    this.app.use((req, res, next) => {
      logger.info(`🌐 CTIR Proxy: ${req.method} ${req.path}`, {
        headers: req.headers,
        bodySize: req.body ? JSON.stringify(req.body).length : 0
      });
      next();
    });
  }

  private setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        service: 'CTIR Proxy',
        timestamp: new Date().toISOString()
      });
    });

    // Model indicator endpoint
    this.app.get('/model-indicator', (req, res) => {
      try {
        if (!this.ctirCore) {
          return res.status(503).json({ 
            error: 'CTIR Core not initialized',
            indicator: '🎭 CTIR: Initializing...'
          });
        }

        const indicator = this.ctirCore.getFormattedModelIndicator();
        const data = this.ctirCore.getModelIndicator().getCurrentData();
        
        res.json({
          indicator,
          data,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error('Error getting model indicator', { error });
        res.status(500).json({ 
          error: 'Failed to get model indicator',
          indicator: '🎭 CTIR: Error'
        });
      }
    });

    // Route analysis endpoint
    this.app.post('/analyze-task', async (req, res) => {
      try {
        const { messages, model } = req.body;
        
        // Extract task description from messages
        const taskDescription = this.extractTaskDescription(messages);
        
        // Create CTIR task
        const task: CTIRTask = {
          id: `task-${Date.now()}`,
          description: taskDescription,
          category: TaskCategory.DOCUMENTATION,
          complexity: {
            fileCount: 1,
            lineCount: 100,
            contextDeps: 1,
            domainKnowledge: 1,
            totalScore: 0.5
          },
          estimatedTokens: this.estimateTokens(messages)
        };

        // Classify and route
        const enrichedTask = this.classifier.enrich(task);
        const session = this.createMockSession();
        const decision = this.router.decide(enrichedTask, session);

        logger.info('🎯 CTIR Proxy: Routing decision', {
          strategy: decision.strategy,
          confidence: decision.confidence,
          reasoning: decision.reasoning
        });

        res.json({
          success: true,
          routing_decision: decision,
          task_analysis: {
            category: enrichedTask.category,
            complexity_score: enrichedTask.complexity?.totalScore || 0.5,
            estimated_tokens: enrichedTask.estimatedTokens
          }
        });

      } catch (error) {
        logger.error('❌ CTIR Proxy: Analysis failed', { error: error instanceof Error ? error.message : String(error) });
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });

    // Proxy to Claude API with dynamic routing
    this.app.post('/v1/messages', async (req, res) => {
      try {
        const { messages, model } = req.body;
        // Extra debug to trace routing flow
        logger.info('🛰️  CTIR Proxy: /v1/messages received', {
          hasAuthHeader: Boolean(req.headers.authorization),
          anthropicVersion: req.headers['anthropic-version'] || 'missing',
          userAgent: req.headers['user-agent'] || 'unknown'
        });
        
        // Verifica lo stato della sessione Claude
        if (this.sessionMonitor) {
          const sessionStatus = await this.sessionMonitor.checkClaudeSessionStatus();
          const recommendedModel = await this.sessionMonitor.getRecommendedModel();
          
          logger.info('🎯 CTIR Proxy: Claude session status', {
            isActive: sessionStatus.isActive,
            tokenLimitReached: sessionStatus.tokenLimitReached,
            timeWindowReached: sessionStatus.timeWindowReached,
            recommendedModel: recommendedModel.model,
            reason: recommendedModel.reason
          });

          // Se Claude non è disponibile, instrada direttamente su OpenRouter
          if (!sessionStatus.isActive || sessionStatus.tokenLimitReached || sessionStatus.timeWindowReached) {
            logger.info('🔄 CTIR Proxy: Claude unavailable, routing to OpenRouter', {
              reason: recommendedModel.reason
            });
            
            // Instrada direttamente su OpenRouter senza passare per Claude
            await this.proxyToOpenRouterDirect(req, res, recommendedModel.model);
            return;
          }
        }

        // Se Claude è disponibile, usa il routing tradizionale
        const taskDescription = this.extractTaskDescription(messages);
        const task: CTIRTask = {
          id: `task-${Date.now()}`,
          description: taskDescription,
          category: TaskCategory.DOCUMENTATION,
          complexity: {
            fileCount: 1,
            lineCount: 100,
            contextDeps: 1,
            domainKnowledge: 1,
            totalScore: 0.5
          },
          estimatedTokens: this.estimateTokens(messages)
        };

        const enrichedTask = this.classifier.enrich(task);
        const session = this.createMockSession();
        const decision = this.router.decide(enrichedTask, session);

        logger.info('🎯 CTIR Proxy: Routing request (Claude available)', {
          strategy: decision.strategy,
          task: taskDescription.slice(0, 100) + '...'
        });

        // Route based on decision
        if (decision.strategy === 'claude_direct') {
          // Proxy to Claude API
          await this.proxyToClaude(req, res);
        } else if (decision.strategy.startsWith('openrouter_')) {
          // Route to OpenRouter models
          await this.proxyToOpenRouter(req, res, decision.strategy, decision.model);
        } else if (decision.strategy === 'ccr_local') {
          // Route to OpenRouter (CCR local is deprecated, use OpenRouter instead)
          const model = process.env.NODE_ENV === 'production' 
            ? 'agentica-org/deepcoder-14b-preview' 
            : 'agentica-org/deepcoder-14b-preview:free';
          await this.proxyToOpenRouter(req, res, 'openrouter_efficiency', model);
        } else if (decision.strategy === 'mcp_delegate') {
          // Route to OpenRouter (MCP delegate is deprecated, use OpenRouter instead)
          const model = process.env.NODE_ENV === 'production' 
            ? 'qwen/qwen2.5-coder-32b-instruct' 
            : 'qwen/qwen-2.5-coder-32b-instruct:free';
          await this.proxyToOpenRouter(req, res, 'openrouter_multilang', model);
        } else {
          // Default to Claude
          await this.proxyToClaude(req, res);
        }

      } catch (error) {
        logger.error('❌ CTIR Proxy: Routing failed', { error: error instanceof Error ? error.message : String(error) });
        res.status(500).json({
          error: 'CTIR routing failed',
          details: error instanceof Error ? error.message : String(error)
        });
      }
    });

    // Catch-all proxy for other endpoints
    this.app.use('/', createProxyMiddleware({
      target: 'https://api.anthropic.com',
      changeOrigin: true,
      onProxyReq: (proxyReq, req, res) => {
        logger.info(`🔄 CTIR Proxy: Proxying to Claude API`, {
          method: req.method,
          path: req.path
        });
      },
      onError: (err, req, res) => {
        logger.error('❌ CTIR Proxy: Proxy error', { error: err.message });
        res.status(500).json({ error: 'Proxy error' });
      }
    }));
  }

  private extractTaskDescription(messages: any[]): string {
    if (!messages || messages.length === 0) return 'Unknown task';
    
    // Get the last user message
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.content) {
      if (typeof lastMessage.content === 'string') {
        return lastMessage.content;
      } else if (Array.isArray(lastMessage.content)) {
        const textContent = lastMessage.content.find((c: any) => c.type === 'text');
        return textContent?.text || 'Unknown task';
      }
    }
    
    return 'Unknown task';
  }

  private estimateTokens(messages: any[]): number {
    // Simple token estimation
    const totalText = messages.map(m => {
      if (typeof m.content === 'string') return m.content;
      if (Array.isArray(m.content)) {
        return m.content.map((c: any) => c.text || '').join(' ');
      }
      return '';
    }).join(' ');
    
    return Math.ceil(totalText.length / 4); // Rough estimation
  }

  private createMockSession(): CTIRSession {
    return {
      id: 'proxy-session',
      tokenBudget: {
        used: 0,
        limit: 100000,
        remaining: 100000
      },
      startTime: new Date(),
      lastActivity: new Date(),
      routingHistory: [],
      contextWindow: {
        size: 200000,
        used: 0
      },
      modelPerformanceMetrics: []
    };
  }

  private async proxyToOpenRouter(req: any, res: any, strategy: string, model?: string) {
    logger.info(`🎯 Routing to OpenRouter ${strategy} (${model})`);
    
    try {
      // Forward to OpenRouter API
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPEN_ROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://ctir.dev',
          'X-Title': 'CTIR - Claude Task Intelligence Router'
        },
        body: JSON.stringify({
          model: model || this.getDefaultModelForStrategy(strategy),
          messages: req.body.messages || [{
            role: 'user',
            content: this.extractTaskDescription(req.body.messages)
          }],
          temperature: 0.2,
          max_tokens: 2048
        })
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.choices && data.choices[0] && data.choices[0].message) {
        const text = data.choices[0].message.content ?? '';
        const contentBlocks = Array.isArray(text)
          ? text
          : [{ type: 'text', text: String(text) }];

        // Respond using Anthropic Messages schema
        res.json({
          id: data.id || `ctir-${Date.now()}`,
          type: 'message',
          role: 'assistant',
          content: contentBlocks,
          model: model || this.getDefaultModelForStrategy(strategy),
          stop_reason: data.choices?.[0]?.finish_reason || 'end_turn',
          stop_sequence: null,
          usage: {
            input_tokens: data.usage?.prompt_tokens || 0,
            output_tokens: data.usage?.completion_tokens || 0
          }
        });
      } else {
        throw new Error('Invalid OpenRouter response format');
      }
    } catch (error) {
      logger.error('❌ OpenRouter API error:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: 'OpenRouter API request failed' });
    }
  }

  private getDefaultModelForStrategy(strategy: string): string {
    // Use free models for development, premium for production
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (isProduction) {
      // Premium models (require data policy configuration)
      switch (strategy) {
        case 'openrouter_technical':
          return 'qwen/qwen3-coder-480b-a35b-instruct';
        case 'openrouter_prototyping':
          return 'openai/gpt-oss-120b';
        case 'openrouter_research':
          return 'google/gemini-2.5-pro-experimental';
        case 'openrouter_multilang':
          return 'qwen/qwen2.5-coder-32b-instruct';
        case 'openrouter_efficiency':
          return 'agentica-org/deepcoder-14b-preview';
        default:
          return 'qwen/qwen2.5-coder-32b-instruct';
      }
    } else {
      // Free models for development
      switch (strategy) {
        case 'openrouter_technical':
          return 'qwen/qwen-2.5-coder-32b-instruct:free';
        case 'openrouter_prototyping':
          return 'openai/gpt-oss-120b:free';
        case 'openrouter_research':
          return 'qwen/qwen-2.5-coder-32b-instruct:free';
        case 'openrouter_multilang':
          return 'qwen/qwen-2.5-coder-32b-instruct:free';
        case 'openrouter_efficiency':
          return 'agentica-org/deepcoder-14b-preview:free';
        default:
          return 'qwen/qwen-2.5-coder-32b-instruct:free';
      }
    }
  }

  private async proxyToOpenRouterDirect(req: any, res: any, model: string) {
    logger.info('🔄 CTIR Proxy: Routing directly to OpenRouter', { model });
    
    try {
      const apiKey = process.env.OPEN_ROUTER_API_KEY;
      if (!apiKey) {
        throw new Error('OpenRouter API key not configured');
      }

      // Prepara la richiesta per OpenRouter
      const openRouterRequest = {
        model: model,
        messages: req.body.messages,
        max_tokens: req.body.max_tokens || 4000,
        temperature: req.body.temperature || 0.7,
        stream: false
      };

      logger.info('🔄 CTIR Proxy: Sending request to OpenRouter', {
        model: model,
        messageCount: req.body.messages?.length || 0
      });

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://ctir.local',
          'X-Title': 'CTIR Proxy'
        },
        body: JSON.stringify(openRouterRequest)
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('❌ CTIR Proxy: OpenRouter API error', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      logger.info('✅ CTIR Proxy: OpenRouter response received', {
        model: data.model,
        usage: data.usage
      });

      // Restituisci la risposta in formato compatibile con Claude (content come array di blocchi)
      const text = data.choices?.[0]?.message?.content ?? '';
      const contentBlocks = Array.isArray(text)
        ? text
        : [{ type: 'text', text: String(text) }];

      res.json({
        id: data.id || `ctir-${Date.now()}`,
        type: 'message',
        role: 'assistant',
        content: contentBlocks,
        model: data.model,
        stop_reason: data.choices?.[0]?.finish_reason || 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: data.usage?.prompt_tokens || 0,
          output_tokens: data.usage?.completion_tokens || 0
        }
      });

    } catch (error) {
      logger.error('❌ CTIR Proxy: OpenRouter direct routing failed', { error });
      res.status(500).json({
        error: 'OpenRouter routing failed',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async proxyToClaude(req: any, res: any) {
    logger.info('🎯 Routing to Claude API');
    
    try {
      // Use Claude Haiku for simple tasks, Sonnet for complex ones
      const taskDescription = this.extractTaskDescription(req.body.messages);
      const isSimpleTask = taskDescription.length < 50 && !taskDescription.includes('complex');
      
      const model = isSimpleTask ? 'claude-3-5-haiku-20241022' : 'claude-3-5-sonnet-20241022';
      
      logger.info(`🎯 Using ${model} for task: ${taskDescription.substring(0, 30)}...`);
      
      // Extract API key from Authorization header; fallback to env CLAUDE_API_KEY, then ANTHROPIC_API_KEY for compatibility
      const authHeader = req.headers.authorization;
      const apiKey = authHeader
        ? authHeader.replace('Bearer ', '')
        : (process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || '');
      
      if (!apiKey) {
        throw new Error('No API key found in request headers or environment');
      }
      
      // Ensure anthropic-version is present
      const anthropicVersion = (req.headers['anthropic-version'] as string) || '2023-06-01';

      // Forward to actual Claude API
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': anthropicVersion
        },
        body: JSON.stringify({
          ...req.body,
          model: model
        })
      });

      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error) {
      logger.error('❌ Claude API error:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: 'Claude API request failed' });
    }
  }


  start(): void {
    this.app.listen(this.port, () => {
      logger.info(`🚀 CTIR Proxy started on port ${this.port}`);
      logger.info(`📊 Health check: http://localhost:${this.port}/health`);
      logger.info(`🔍 Task analysis: http://localhost:${this.port}/analyze-task`);
    });
  }
}

// Start the proxy if this file is run directly
if (require.main === module) {
  const proxy = new CTIRProxy();
  proxy.start();
}
