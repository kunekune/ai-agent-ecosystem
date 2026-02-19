const { Client, GatewayIntentBits, Events } = require('discord.js');
const winston = require('winston');
const ModelRouter = require('../core/model-router');
const EmotionalContextEngine = require('../emotion/emotional-context-engine');
const ObsidianAPI = require('./obsidian-api');

class DiscordBridge {
  constructor(config) {
    this.config = config;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
      ]
    });
    
    this.modelRouter = new ModelRouter();
    this.emotionEngine = new EmotionalContextEngine(config.obsidian.vaultPath);
    this.obsidianAPI = new ObsidianAPI(config.obsidian.vaultPath);
    this.isProcessing = new Set(); // 重複処理防止
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/discord-bridge.log' }),
        new winston.transports.Console()
      ]
    });

    this.setupEventHandlers();
  }

  /**
   * Discord接続開始
   */
  async initialize() {
    try {
      await this.client.login(this.config.discord.token);
      this.logger.info('Discord bridge initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Discord bridge', { error: error.message });
      throw error;
    }
  }

  /**
   * イベントハンドラーの設定
   */
  setupEventHandlers() {
    this.client.once(Events.ClientReady, (client) => {
      this.logger.info(`Discord bot ready as ${client.user.tag}`);
    });

    this.client.on(Events.MessageCreate, async (message) => {
      await this.handleMessage(message);
    });

    this.client.on(Events.Error, (error) => {
      this.logger.error('Discord client error', { error: error.message });
    });
  }

  /**
   * メッセージ処理のメインハンドラー
   */
  async handleMessage(message) {
    // ボット自身のメッセージや重複処理をスキップ
    if (message.author.bot || this.isProcessing.has(message.id)) {
      return;
    }

    // 対象ギルドでない場合はスキップ
    if (message.guild && message.guild.id !== this.config.discord.guildId) {
      return;
    }

    this.isProcessing.add(message.id);

    try {
      const timestamp = new Date(message.createdTimestamp);
      
      // 感情コンテキスト分析
      const emotionalState = await this.emotionEngine.analyzeCurrentEmotionalState(
        message.content,
        timestamp
      );

      // メッセージ複雑度分析
      const complexity = this.modelRouter.analyzeComplexity(message.content);
      
      // 最適モデル選択
      const modelSelection = this.modelRouter.selectOptimalModel(
        complexity,
        emotionalState,
        { preferCheapModel: true }
      );

      this.logger.info('Processing Discord message', {
        messageId: message.id,
        selectedModel: modelSelection.model,
        emotion: emotionalState.primaryEmotion,
        complexity: complexity.complexity,
        author: message.author.username
      });

      // 思考処理実行
      const processedThought = await this.processThought({
        content: message.content,
        author: {
          id: message.author.id,
          username: message.author.username
        },
        timestamp,
        emotionalState,
        complexity,
        selectedModel: modelSelection.model,
        channel: {
          id: message.channel.id,
          name: message.channel.name || 'DM'
        }
      });

      // Obsidianに記録
      await this.recordToObsidian(processedThought);

      // 必要に応じて応答
      if (processedThought.requiresResponse) {
        await this.sendResponse(message, processedThought);
      }

    } catch (error) {
      this.logger.error('Error processing Discord message', {
        messageId: message.id,
        error: error.message
      });
      
      // エラー時は上位モデルでリトライ
      await this.handleErrorRetry(message, error);
      
    } finally {
      this.isProcessing.delete(message.id);
    }
  }

  /**
   * 思考処理の実行
   */
  async processThought(messageData) {
    const { content, emotionalState, selectedModel, timestamp } = messageData;

    // メッセージの分類
    const classification = await this.classifyMessage(content, emotionalState);
    
    // 選択されたモデルで処理（5段階エスカレーション）
    let processedContent;
    
    switch (selectedModel) {
      case 'claude-opus-4.6':   // L5: 編集長
        processedContent = await this.processWithClaudeOpus(content, emotionalState, classification);
        break;
      case 'claude-sonnet-4':   // L4: 執筆官
        processedContent = await this.processWithClaudeSonnet(content, emotionalState, classification);
        break;
      case 'glm-4.7':           // L3: 秘書
        processedContent = await this.processWithGLM(content, emotionalState, classification);
        break;
      case 'deepseek-v3':       // L2: 門番
        processedContent = await this.processWithDeepSeek(content, emotionalState, classification);
        break;
      case 'claude-code':       // L1: 工兵
        processedContent = await this.processWithClaudeCode(content, emotionalState, classification);
        break;
      default:
        processedContent = await this.processWithDeepSeek(content, emotionalState, classification);
    }

    return {
      original: messageData,
      processed: processedContent,
      classification,
      model: selectedModel,
      timestamp: timestamp.toISOString(),
      requiresResponse: this.shouldRespond(classification, emotionalState),
      obsidianSection: this.determineObsidianSection(classification)
    };
  }

  /**
   * メッセージ分類
   */
  async classifyMessage(content, emotionalState) {
    // DeepSeekで高速分類
    const deepseekHandler = this.getModelHandler('deepseek-v3');
    
    const result = await deepseekHandler.classifyDiscordMessage({
      message: content,
      availableCategories: [
        // L5: 編集長レベル
        'strategic_decision',   // 重要戦略・人生相談
        'blog_final_edit',     // ブログ最終仕上げ
        
        // L4: 執筆官レベル
        'blog_draft_request',  // ブログ初稿依頼
        'complex_writing',     // 複雑な文章作成
        'email_composition',   // メール返信案
        
        // L3: 秘書レベル
        'schedule_related',    // スケジュール関連
        'email_management',    // メール管理
        'api_operation',       // 外部ツール連携
        
        // L2: 門番レベル  
        'thought_fragment',    // 思考断片
        'casual_chat',         // 日常チャット
        'information_sharing', // 情報共有
        'simple_question',     // 簡単な質問
        
        // L1: 工兵レベル
        'system_request',      // システム操作
        'file_management',     // ファイル管理
        'debug_request',       // デバッグ依頼
        'config_change'        // 設定変更
      ],
      userContext: {
        emotionalState: emotionalState.primaryEmotion,
        energyLevel: emotionalState.energyLevel
      }
    });

    return JSON.parse(result.content);
  }

  /**
   * Claude Opus処理 (L5: 編集長)
   */
  async processWithClaudeOpus(content, emotionalState, classification) {
    const claudeHandler = this.getModelHandler('claude-opus-4.6');
    
    const taskType = this.mapClassificationToTaskType(classification.category);
    
    return await claudeHandler.processHighComplexityTask({
      message: content,
      context: {
        classification,
        userHistory: await this.getUserContext()
      },
      emotionalState,
      taskType
    });
  }

  /**
   * Claude Sonnet処理 (L4: 執筆官)
   */
  async processWithClaudeSonnet(content, emotionalState, classification) {
    const sonnetHandler = this.getModelHandler('claude-sonnet-4');
    
    const taskType = this.mapClassificationToTaskType(classification.category);
    
    return await sonnetHandler.processWritingTask({
      message: content,
      context: {
        classification,
        userHistory: await this.getUserContext()
      },
      emotionalState,
      taskType
    });
  }

  /**
   * GLM処理
   */
  async processWithGLM(content, emotionalState, classification) {
    const glmHandler = this.getModelHandler('glm-4.7');
    
    if (classification.category === 'schedule_related') {
      return await glmHandler.handleScheduleManagement({
        action: 'analyze_schedule_request',
        scheduleData: { request: content },
        userPreferences: await this.getUserPreferences()
      });
    }

    return await glmHandler.processBusinessTask({
      message: content,
      context: { classification, emotionalState },
      taskType: this.mapClassificationToBusinessTask(classification.category)
    });
  }

  /**
   * DeepSeek処理 (L2: 門番)
   */
  async processWithDeepSeek(content, emotionalState, classification) {
    const deepseekHandler = this.getModelHandler('deepseek-v3');
    
    switch (classification.category) {
      case 'thought_fragment':
        return await deepseekHandler.convertToObsidianFormat({
          rawData: {
            thought: content,
            emotion: emotionalState.primaryEmotion,
            timestamp: new Date().toISOString()
          },
          targetSection: 'daily-thoughts',
          linkReferences: await this.getRelevantLinks(content)
        });
        
      case 'information_sharing':
        return await deepseekHandler.extractFactsFromText({
          text: content,
          factTypes: ['entities', 'dates', 'actions', 'references'],
          outputFormat: 'structured_json'
        });
        
      default:
        return await deepseekHandler.processLightweightTask({
          message: content,
          context: { classification, emotionalState },
          taskType: 'quick'
        });
    }
  }

  /**
   * Claude Code処理 (L1: 工兵)
   */
  async processWithClaudeCode(content, emotionalState, classification) {
    const codeHandler = this.getModelHandler('claude-code');
    
    switch (classification.category) {
      case 'system_request':
        return await codeHandler.handleUbuntuConfiguration({
          operation: content,
          target: 'system',
          parameters: { emotionalState },
          dryRun: true // 安全のため常にドライランから開始
        });
        
      case 'file_management':
        return await codeHandler.handleFileManagement({
          operation: 'organize',
          sourcePath: this.extractPath(content),
          pattern: '**/*',
          dryRun: true
        });
        
      case 'debug_request':
        return await codeHandler.handleDebugTask({
          errorType: 'general',
          symptoms: content,
          systemInfo: await this.getSystemInfo()
        });
        
      default:
        return await codeHandler.processSystemTask({
          message: content,
          context: { classification, emotionalState },
          taskType: 'general_system',
          safeMode: true
        });
    }
  }

  /**
   * Obsidianに記録
   */
  async recordToObsidian(processedThought) {
    const section = processedThought.obsidianSection;
    const timestamp = new Date(processedThought.timestamp);
    
    try {
      switch (section) {
        case 'daily-thoughts':
          await this.obsidianAPI.appendToDailyNote(timestamp, {
            type: 'thought',
            content: processedThought.processed.content,
            emotion: processedThought.original.emotionalState.primaryEmotion,
            model: processedThought.model,
            classification: processedThought.classification.category
          });
          break;
          
        case 'inbox':
          await this.obsidianAPI.appendToInbox({
            type: 'discord_capture',
            original: processedThought.original.content,
            processed: processedThought.processed.content,
            metadata: {
              timestamp: processedThought.timestamp,
              model: processedThought.model,
              emotion: processedThought.original.emotionalState.primaryEmotion
            }
          });
          break;
          
        case 'projects':
          if (processedThought.classification.category === 'task_request') {
            await this.obsidianAPI.addToProjectNotes(
              this.extractProjectName(processedThought.processed.content),
              processedThought.processed.content
            );
          }
          break;
      }
      
      this.logger.info('Recorded to Obsidian', {
        section,
        model: processedThought.model,
        classification: processedThought.classification.category
      });
      
    } catch (error) {
      this.logger.error('Failed to record to Obsidian', { error: error.message });
    }
  }

  /**
   * 応答送信
   */
  async sendResponse(originalMessage, processedThought) {
    try {
      const responseStyle = processedThought.original.emotionalState.responseStyle;
      const response = this.formatResponse(processedThought, responseStyle);
      
      if (response && response.trim()) {
        await originalMessage.reply(response);
        
        this.logger.info('Sent Discord response', {
          messageId: originalMessage.id,
          responseStyle,
          model: processedThought.model
        });
      }
    } catch (error) {
      this.logger.error('Failed to send Discord response', { error: error.message });
    }
  }

  /**
   * エラー時のリトライ処理
   */
  async handleErrorRetry(message, originalError) {
    try {
      this.logger.info('Attempting error retry with higher model');
      
      // より上位のモデルでリトライ
      const emotionalState = await this.emotionEngine.analyzeCurrentEmotionalState(
        message.content,
        new Date(message.createdTimestamp)
      );
      
      const retryModel = this.modelRouter.escalateModel('deepseek-v3', 'error_retry');
      
      // 簡単な処理のみリトライ
      const simpleProcessing = await this.processWithDeepSeek(
        message.content,
        emotionalState,
        { category: 'thought_fragment', priority: 'low' }
      );
      
      await this.recordToObsidian({
        original: { content: message.content, emotionalState },
        processed: simpleProcessing,
        classification: { category: 'thought_fragment' },
        model: retryModel,
        timestamp: new Date().toISOString(),
        obsidianSection: 'inbox'
      });
      
    } catch (retryError) {
      this.logger.error('Error retry also failed', { retryError: retryError.message });
    }
  }

  // Helper methods
  getModelHandler(modelName) {
    // 5段階エスカレーション対応モデルハンドラー
    const handlers = {
      'claude-opus-4.6': require('../models/claude-opus'),      // L5: 編集長
      'claude-sonnet-4': require('../models/claude-sonnet'),    // L4: 執筆官
      'glm-4.7': require('../models/glm-handler'),              // L3: 秘書
      'deepseek-v3': require('../models/deepseek-handler'),     // L2: 門番
      'claude-code': require('../models/claude-code')           // L1: 工兵
    };
    
    const HandlerClass = handlers[modelName];
    if (!HandlerClass) {
      throw new Error(`Unknown model handler: ${modelName}`);
    }
    
    // APIキー設定は環境設定から取得
    const apiKey = this.getAPIKey(modelName);
    return new HandlerClass(apiKey);
  }

  getAPIKey(modelName) {
    const keyMap = {
      'claude-opus-4.6': this.config.anthropic.apiKey,  // L5: 編集長
      'claude-sonnet-4': this.config.anthropic.apiKey,  // L4: 執筆官 
      'glm-4.7': this.config.glm.apiKey,                // L3: 秘書
      'deepseek-v3': this.config.deepseek.apiKey,       // L2: 門番
      'claude-code': this.config.anthropic.apiKey       // L1: 工兵
    };
    return keyMap[modelName];
  }

  shouldRespond(classification, emotionalState) {
    // 応答が必要かどうかの判定
    const respondCategories = ['question', 'task_request'];
    const highEmotionStates = ['stress', 'sadness', 'anger'];
    
    return respondCategories.includes(classification.category) ||
           highEmotionStates.includes(emotionalState.primaryEmotion) ||
           classification.actionRequired;
  }

  determineObsidianSection(classification) {
    const sectionMap = {
      'thought_fragment': 'daily-thoughts',
      'creative_input': 'daily-thoughts',
      'emotional_expression': 'daily-thoughts',
      'task_request': 'projects',
      'schedule_related': 'projects',
      'question': 'inbox',
      'information_sharing': 'inbox',
      'casual_chat': 'inbox'
    };
    
    return sectionMap[classification.category] || 'inbox';
  }

  mapClassificationToTaskType(category) {
    const taskMap = {
      'creative_input': 'creative',
      'emotional_expression': 'analysis',
      'task_request': 'practical',
      'question': 'analysis'
    };
    return taskMap[category] || 'practical';
  }

  mapClassificationToBusinessTask(category) {
    const businessMap = {
      'schedule_related': 'schedule',
      'task_request': 'transform',
      'information_sharing': 'analysis'
    };
    return businessMap[category] || 'transform';
  }

  formatResponse(processedThought, responseStyle) {
    const content = processedThought.processed.content;
    
    // レスポンススタイルに応じたフォーマット調整
    switch (responseStyle) {
      case 'gentle':
        return `💭 ${content}`;
      case 'energetic':
        return `🚀 ${content}`;
      case 'calming':
        return `🌸 ${content}`;
      case 'professional':
        return content;
      default:
        return content;
    }
  }

  async getUserContext() {
    // ユーザーの最近のコンテキストを取得
    return {};
  }

  async getUserPreferences() {
    // ユーザー設定を取得
    return {};
  }

  async getRelevantLinks(content) {
    // コンテンツに関連するObsidianリンクを取得
    return [];
  }

  extractProjectName(content) {
    // プロジェクト名を抽出（実装時は自然言語処理）
    return 'general';
  }

  extractPath(content) {
    // コンテンツからファイルパスを抽出
    const pathPattern = /([\/~][\w\/\.-]+)/g;
    const matches = content.match(pathPattern);
    return matches ? matches[0] : '/tmp';
  }

  async getSystemInfo() {
    // システム情報を取得
    return {
      platform: process.platform,
      nodeVersion: process.version,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };
  }
}

module.exports = DiscordBridge;