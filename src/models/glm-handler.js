const axios = require('axios');
const winston = require('winston');
const { withRetry } = require('../utils/api-retry');

class GLMHandler {
  constructor(apiKey, baseUrl) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl || 'https://open.bigmodel.cn/api/paas/v4/';
    this.model = 'glm-4-plus'; // 実務処理に最適なモデル
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/glm-handler.log' }),
        new winston.transports.Console()
      ]
    });
  }

  /**
   * 実務・秘書業務を実行
   */
  async processBusinessTask(request) {
    const { message, context, taskType, tools } = request;
    const systemPrompt = this.buildBusinessPrompt(taskType, context);

    try {
      const response = await withRetry(() =>
        axios.post(`${this.baseUrl}chat/completions`, {
          model: this.model,
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: message
            }
          ],
          temperature: 0.1, // 実務は正確性重視
          max_tokens: 2000,
          tools: tools || []
        }, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        })
      );

      const result = {
        content: response.data.choices[0].message.content,
        model: this.model,
        tokens: {
          input: response.data.usage?.prompt_tokens || 0,
          output: response.data.usage?.completion_tokens || 0,
          total: response.data.usage?.total_tokens || 0
        },
        toolCalls: response.data.choices[0].message.tool_calls || [],
        timestamp: new Date().toISOString()
      };

      this.logger.info('GLM business task completed', {
        taskType,
        tokenUsage: result.tokens,
        toolsUsed: result.toolCalls.length
      });

      return result;

    } catch (error) {
      this.logger.warn('GLM all retries failed, falling back to DeepSeek', {
        error: error.message,
        fallback_triggered: true,
        reason: error.code || error.response?.status || 'api_error'
      });

      // フォールバック: DeepSeekHandlerで再試行
      const DeepSeekHandler = require('./deepseek-handler');
      const fallbackHandler = new DeepSeekHandler(process.env.DEEPSEEK_API_KEY);
      const result = await fallbackHandler.processLightweightTask(request);

      this.logger.info('Fallback to DeepSeek succeeded', {
        fallback_triggered: true,
        reason: error.code || error.response?.status || 'api_error'
      });

      return result;
    }
  }

  /**
   * Google Calendar操作
   */
  async handleScheduleManagement(request) {
    const { action, scheduleData, userPreferences } = request;
    
    const tools = [
      {
        type: 'function',
        function: {
          name: 'google_calendar_operation',
          description: 'Google Calendarの操作を実行',
          parameters: {
            type: 'object',
            properties: {
              operation: {
                type: 'string',
                enum: ['create_event', 'update_event', 'delete_event', 'get_availability', 'list_events']
              },
              eventData: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  start: { type: 'string' },
                  end: { type: 'string' },
                  location: { type: 'string' },
                  description: { type: 'string' }
                }
              },
              timeRange: {
                type: 'object',
                properties: {
                  startDate: { type: 'string' },
                  endDate: { type: 'string' }
                }
              }
            },
            required: ['operation']
          }
        }
      }
    ];

    return await this.processBusinessTask({
      message: `スケジュール管理タスク: ${action}\n詳細: ${JSON.stringify(scheduleData, null, 2)}`,
      context: { userPreferences, action },
      taskType: 'schedule',
      tools
    });
  }

  /**
   * Gmail処理
   */
  async handleEmailProcessing(request) {
    const { action, emailData, searchQuery } = request;
    
    const tools = [
      {
        type: 'function',
        function: {
          name: 'gmail_operation',
          description: 'Gmail操作を実行',
          parameters: {
            type: 'object', 
            properties: {
              operation: {
                type: 'string',
                enum: ['search', 'read', 'send', 'reply', 'archive', 'label']
              },
              query: { type: 'string' },
              messageId: { type: 'string' },
              emailContent: {
                type: 'object',
                properties: {
                  to: { type: 'string' },
                  subject: { type: 'string' },
                  body: { type: 'string' }
                }
              }
            },
            required: ['operation']
          }
        }
      }
    ];

    return await this.processBusinessTask({
      message: `メール処理タスク: ${action}\nクエリ: ${searchQuery}\nデータ: ${JSON.stringify(emailData, null, 2)}`,
      context: { action, searchQuery },
      taskType: 'email',
      tools
    });
  }

  /**
   * データ変換・フォーマット処理
   */
  async handleDataTransformation(request) {
    const { inputData, outputFormat, transformationRules } = request;
    
    const systemPrompt = `あなたはデータ変換のエキスパートです。
指定されたルールに従って、入力データを適切な形式に変換してください。

変換ルール:
${JSON.stringify(transformationRules, null, 2)}

出力形式: ${outputFormat}

正確性と一貫性を最優先にしてください。`;

    return await this.processBusinessTask({
      message: `以下のデータを指定形式に変換してください:\n\n${JSON.stringify(inputData, null, 2)}`,
      context: { transformationRules, outputFormat },
      taskType: 'transform'
    });
  }

  /**
   * APIエンドポイント統合
   */
  async executeAPIIntegration(request) {
    const { endpoint, method, parameters, expectedResponse } = request;
    
    const tools = [
      {
        type: 'function',
        function: {
          name: 'api_call',
          description: '外部APIを呼び出し',
          parameters: {
            type: 'object',
            properties: {
              url: { type: 'string' },
              method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'] },
              headers: { type: 'object' },
              body: { type: 'object' }
            },
            required: ['url', 'method']
          }
        }
      }
    ];

    return await this.processBusinessTask({
      message: `API統合タスク: ${endpoint} (${method})\nパラメータ: ${JSON.stringify(parameters, null, 2)}`,
      context: { endpoint, method, expectedResponse },
      taskType: 'api',
      tools
    });
  }

  // Private methods
  buildBusinessPrompt(taskType, context) {
    const basePrompt = `あなたは高精度な実務処理AIです。正確性、効率性、信頼性を最優先に作業を実行します。`;
    
    const taskPrompts = {
      'schedule': 'スケジュール管理の専門家として、カレンダー操作を正確に実行してください。時間の重複や制約を常に確認してください。',
      'email': 'メール処理の専門家として、適切なビジネスマナーを保ちながら効率的に処理してください。',
      'transform': 'データ変換の専門家として、入力データを指定された形式に正確に変換してください。エラーハンドリングも考慮してください。',
      'api': 'API統合の専門家として、エラー処理と再試行ロジックを含めて実装してください。',
      'analysis': 'データ分析の専門家として、正確で洞察に富んだ分析を提供してください。'
    };

    let fullPrompt = basePrompt;
    
    if (taskType && taskPrompts[taskType]) {
      fullPrompt += '\n\n' + taskPrompts[taskType];
    }

    if (context && context.userPreferences) {
      fullPrompt += '\n\nユーザー設定:\n' + JSON.stringify(context.userPreferences, null, 2);
    }

    return fullPrompt;
  }
}

module.exports = GLMHandler;