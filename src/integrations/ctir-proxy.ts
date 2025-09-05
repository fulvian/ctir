import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { TaskClassifier } from '@/core/classifier';
import { RoutingEngine } from '@/core/router';
import { CTIRTask, TaskCategory } from '@/models/task';
import { CTIRSession } from '@/models/session';
import { logger } from '@/utils/logger';

export class CTIRProxy {
  private app = express();
  private classifier = new TaskClassifier();
  private router = new RoutingEngine();
  private port = 3001;

  constructor() {
    this.setupMiddleware();
    this.setupRoutes();
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

    // Proxy to Claude API with routing
    this.app.post('/v1/messages', async (req, res) => {
      try {
        const { messages, model } = req.body;
        
        // Analyze task
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

        logger.info('🎯 CTIR Proxy: Routing request', {
          strategy: decision.strategy,
          task: taskDescription.slice(0, 100) + '...'
        });

        // Route based on decision
        if (decision.strategy === 'claude_direct') {
          // Proxy to Claude API
          await this.proxyToClaude(req, res);
        } else if (decision.strategy === 'gemini_flash') {
          // Route to Gemini Flash
          await this.proxyToGemini(req, res, 'gemini-1.5-flash');
        } else if (decision.strategy === 'gemini_pro') {
          // Route to Gemini Pro
          await this.proxyToGemini(req, res, 'gemini-1.5-pro');
        } else if (decision.strategy === 'ccr_local') {
          // Route to CCR local model
          await this.proxyToCCR(req, res);
        } else if (decision.strategy === 'mcp_delegate') {
          // Route to MCP agent
          await this.proxyToMCP(req, res);
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

  private async proxyToGemini(req: any, res: any, model: string) {
    logger.info(`🎯 Routing to Gemini ${model}`);
    
    try {
      // Forward to Gemini API
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: this.extractTaskDescription(req.body.messages)
            }]
          }]
        })
      });

      const data = await response.json();
      
      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        const text = data.candidates[0].content.parts[0].text;
        res.json({
          content: [{ type: 'text', text: text }],
          model: model,
          usage: { input_tokens: 0, output_tokens: 0 }
        });
      } else {
        throw new Error('Invalid Gemini response format');
      }
    } catch (error) {
      logger.error('❌ Gemini API error:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: 'Gemini API request failed' });
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
      
      // Forward to actual Claude API
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY || '',
          'anthropic-version': '2023-06-01'
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

  private async proxyToCCR(req: any, res: any) {
    logger.info('🎯 Routing to CCR local model');
    
    try {
      // Use Ollama REST API directly for better performance
      const taskDescription = this.extractTaskDescription(req.body.messages);

      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'phi4-mini:3.8b',
          prompt: taskDescription,
          stream: false
        })
      });

      const data = await response.json();
      
      res.json({
        content: [{ type: 'text', text: data.response }],
        model: 'phi4-mini:3.8b',
        usage: { input_tokens: 0, output_tokens: 0 }
      });
    } catch (error) {
      logger.error('❌ CCR local model error:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: 'CCR local model request failed' });
    }
  }

  private async proxyToMCP(req: any, res: any) {
    logger.info('🎯 Routing to MCP agent');
    
    try {
      // Use Ollama REST API directly for MCP agent
      const taskDescription = this.extractTaskDescription(req.body.messages);

      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'phi4-mini:3.8b',
          prompt: taskDescription,
          stream: false
        })
      });

      const data = await response.json();
      
      res.json({
        content: [{ type: 'text', text: data.response }],
        model: 'phi4-mini:3.8b',
        usage: { input_tokens: 0, output_tokens: 0 }
      });
    } catch (error) {
      logger.error('❌ MCP agent error:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: 'MCP agent request failed' });
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
