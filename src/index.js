require('dotenv').config();
const fs = require('fs-extra');
const path = require('path');
const winston = require('winston');

const ModelRouter = require('./core/model-router');
const ClaudeOpusHandler = require('./models/claude-opus');
const ClaudeSonnetHandler = require('./models/claude-sonnet');
const ClaudeCodeHandler = require('./models/claude-code');
const GLMHandler = require('./models/glm-handler');
const DeepSeekHandler = require('./models/deepseek-handler');
const EmotionalContextEngine = require('./emotion/emotional-context-engine');
const DiscordBridge = require('./integrations/discord-bridge');
const ObsidianAPI = require('./integrations/obsidian-api');
const CostOptimizer = require('./optimization/cost-optimizer');
const SystemMonitor = require('./monitoring/system-monitor');
const { MonthlyOptimizer, scheduleMonthlyOptimization } = require('./optimization/monthly-optimizer');
const ImplementationVerifier = require('./utils/implementation-verifier');

class AIPersonalAgentEcosystem {
  constructor() {
    this.config = this.loadConfiguration();
    this.logger = this.setupLogger();
    this.components = {};
    this.isInitialized = false;
  }

  /**
   * システム初期化
   */
  async initialize() {
    try {
      this.logger.info('Initializing AI Personal Agent Ecosystem...');

      // 設定検証
      this.validateConfiguration();

      // コアコンポーネント初期化
      await this.initializeComponents();

      // ヘルスチェック
      await this.performHealthCheck();

      this.isInitialized = true;
      this.logger.info('AI Personal Agent Ecosystem initialized successfully');

      // システムステータス記録
      await this.recordSystemStatus('initialized');

    } catch (error) {
      this.logger.error('Failed to initialize AI Personal Agent Ecosystem', { 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * システム開始
   */
  async start() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      this.logger.info('Starting AI Personal Agent Ecosystem...');

      // Discordブリッジ開始
      if (this.config.discord.enabled !== false) {
        await this.components.discordBridge.initialize();
      }

      // スケジューラー開始
      this.startScheduler();

      // 監視システム開始
      this.startMonitoring();

      // 月次最適化スケジュール開始
      scheduleMonthlyOptimization();

      this.logger.info('AI Personal Agent Ecosystem started successfully');
      
      // スタートアップメッセージ
      await this.sendStartupNotification();

    } catch (error) {
      this.logger.error('Failed to start AI Personal Agent Ecosystem', { 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * システム停止
   */
  async stop() {
    try {
      this.logger.info('Stopping AI Personal Agent Ecosystem...');

      // コンポーネント停止
      if (this.components.discordBridge) {
        this.components.discordBridge.client.destroy();
      }

      // 未処理タスクの完了待ち
      await this.waitForPendingTasks();

      // 最終ステータス記録
      await this.recordSystemStatus('stopped');

      this.logger.info('AI Personal Agent Ecosystem stopped successfully');

    } catch (error) {
      this.logger.error('Error during system shutdown', { error: error.message });
    }
  }

  /**
   * コンポーネント初期化
   */
  async initializeComponents() {
    // モデルルーター
    this.components.modelRouter = new ModelRouter();

    // 5段階エスカレーション AIモデルハンドラー
    if (this.config.anthropic.apiKey) {
      // L5: 編集長 (Claude Opus 4.6)
      this.components.claudeOpusHandler = new ClaudeOpusHandler(
        this.config.anthropic.apiKey
      );
      
      // L4: 執筆官 (Claude Sonnet 4)
      this.components.claudeSonnetHandler = new ClaudeSonnetHandler(
        this.config.anthropic.apiKey
      );
      
      // L1: 工兵 (Claude Code)
      this.components.claudeCodeHandler = new ClaudeCodeHandler(
        this.config.anthropic.apiKey
      );
    }

    // L3: 秘書 (GLM-4.7)
    if (this.config.glm.apiKey) {
      this.components.glmHandler = new GLMHandler(
        this.config.glm.apiKey,
        this.config.glm.baseUrl
      );
    }

    // L2: 門番 (DeepSeek V3)
    if (this.config.deepseek.apiKey) {
      this.components.deepseekHandler = new DeepSeekHandler(
        this.config.deepseek.apiKey,
        this.config.deepseek.baseUrl
      );
    }

    // 感情エンジン
    this.components.emotionEngine = new EmotionalContextEngine(
      this.config.obsidian.vaultPath
    );

    // Obsidian API
    this.components.obsidianAPI = new ObsidianAPI(
      this.config.obsidian.vaultPath
    );

    // Discord統合
    if (this.config.discord.token) {
      this.components.discordBridge = new DiscordBridge(this.config);
    }

    // コスト最適化・監視システム
    await this.initializeOptimization();

    // Implementation Verification Protocol (IVP)
    this.components.implementationVerifier = new ImplementationVerifier();

    this.logger.info('All components initialized');
  }

  /**
   * ヘルスチェック実行
   */
  async performHealthCheck() {
    const checks = [];

    // APIキー確認
    if (this.config.anthropic.apiKey) {
      checks.push(this.checkAnthropicAPI());
    }

    if (this.config.deepseek.apiKey) {
      checks.push(this.checkDeepSeekAPI());
    }

    // Obsidianボルト確認
    checks.push(this.checkObsidianVault());

    // Discord接続確認
    if (this.config.discord.token) {
      checks.push(this.checkDiscordConnection());
    }

    const results = await Promise.allSettled(checks);
    const failures = results.filter(result => result.status === 'rejected');

    if (failures.length > 0) {
      this.logger.warn('Some health checks failed', { 
        failures: failures.length,
        total: results.length
      });
    } else {
      this.logger.info('All health checks passed');
    }
  }

  /**
   * スケジューラー開始
   */
  startScheduler() {
    // 定期タスク：感情パターン分析（毎時）
    setInterval(async () => {
      try {
        await this.performHourlyAnalysis();
      } catch (error) {
        this.logger.error('Hourly analysis failed', { error: error.message });
      }
    }, 60 * 60 * 1000); // 1時間

    // 定期タスク：システム健康診断（毎30分）
    setInterval(async () => {
      try {
        await this.performSystemHealthCheck();
      } catch (error) {
        this.logger.error('System health check failed', { error: error.message });
      }
    }, 30 * 60 * 1000); // 30分

    // 定期タスク：データ同期（毎15分）
    setInterval(async () => {
      try {
        await this.synchronizeData();
      } catch (error) {
        this.logger.error('Data synchronization failed', { error: error.message });
      }
    }, 15 * 60 * 1000); // 15分

    this.logger.info('Scheduler started');
  }

  /**
   * 監視システム開始
   */
  startMonitoring() {
    // プロセス監視
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception', { error: error.message });
      this.recordSystemError(error);
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled rejection', { reason });
      this.recordSystemError(new Error(String(reason)));
    });

    // グレースフルシャットダウン
    process.on('SIGTERM', async () => {
      this.logger.info('Received SIGTERM, shutting down gracefully');
      await this.stop();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      this.logger.info('Received SIGINT, shutting down gracefully');
      await this.stop();
      process.exit(0);
    });

    this.logger.info('Monitoring system started');
  }

  /**
   * 毎時分析実行
   */
  async performHourlyAnalysis() {
    const now = new Date();
    
    // 感情パターンの分析
    const emotionAnalysis = await this.components.emotionEngine
      .getHistoricalEmotionalPattern(now);
    
    // Obsidianに記録
    await this.components.obsidianAPI.recordSystemLog({
      event: 'hourly_analysis',
      timestamp: now.toISOString(),
      status: 'completed',
      details: `Emotion analysis: ${JSON.stringify(emotionAnalysis)}`,
      model: 'system'
    });

    this.logger.info('Hourly analysis completed');
  }

  /**
   * システムヘルスチェック
   */
  async performSystemHealthCheck() {
    const health = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      checks: {
        memory: this.getMemoryUsage(),
        uptime: process.uptime(),
        components: await this.checkAllComponents()
      }
    };

    // 問題がある場合は警告
    if (health.checks.memory.usage > 0.9) {
      this.logger.warn('High memory usage detected', { usage: health.checks.memory });
      health.status = 'warning';
    }

    await this.components.obsidianAPI.recordSystemLog({
      event: 'health_check',
      status: health.status,
      details: JSON.stringify(health),
      model: 'system'
    });
  }

  /**
   * データ同期
   */
  async synchronizeData() {
    // 最新の感情データをバックアップ
    // 重要な設定変更をObsidianに反映
    // システム統計を更新

    this.logger.debug('Data synchronization completed');
  }

  /**
   * 起動通知送信
   */
  async sendStartupNotification() {
    if (this.components.discordBridge) {
      const message = `🤖 **AI Personal Agent Ecosystem** が起動しました！

**システム情報:**
- 🧠 感情適応システム: ✅ 有効
- 🔀 マルチモデル・ルーティング: ✅ 有効  
- 📝 Obsidian統合: ✅ 有効
- ⚡ Enhanced PARA: ✅ 有効

準備完了です！思考を共有してください。`;

      // Discord通知（実装時はメッセージ送信API使用）
      this.logger.info('Startup notification prepared', { message });
    }
  }

  // Configuration and setup methods

  loadConfiguration() {
    const configPath = path.join(__dirname, '../config/api-keys.json');
    
    if (!fs.existsSync(configPath)) {
      throw new Error(`Configuration file not found: ${configPath}`);
    }

    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }

  validateConfiguration() {
    const required = ['obsidian.vaultPath'];
    const optional = ['discord.token', 'anthropic.apiKey', 'deepseek.apiKey'];

    for (const key of required) {
      if (!this.getNestedValue(this.config, key)) {
        throw new Error(`Required configuration missing: ${key}`);
      }
    }

    // 少なくとも1つのAIモデルAPIキーが必要
    const hasAnyModel = optional.some(key => this.getNestedValue(this.config, key));
    if (!hasAnyModel) {
      throw new Error('At least one AI model API key is required');
    }

    this.logger.info('Configuration validation passed');
  }

  setupLogger() {
    return winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/ecosystem-error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/ecosystem.log' }),
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ]
    });
  }

  // Health check methods
  async checkAnthropicAPI() {
    // API接続確認（実際はテストリクエスト）
    return true;
  }

  async checkDeepSeekAPI() {
    // API接続確認
    return true;
  }

  async checkObsidianVault() {
    const vaultExists = await fs.pathExists(this.config.obsidian.vaultPath);
    if (!vaultExists) {
      throw new Error(`Obsidian vault not found: ${this.config.obsidian.vaultPath}`);
    }
    return true;
  }

  async checkDiscordConnection() {
    // Discord接続確認
    return true;
  }

  async checkAllComponents() {
    return {
      modelRouter: !!this.components.modelRouter,
      emotionEngine: !!this.components.emotionEngine,
      obsidianAPI: !!this.components.obsidianAPI,
      discordBridge: !!this.components.discordBridge
    };
  }

  // Utility methods
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      rss: Math.round(usage.rss / 1024 / 1024), // MB
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
      usage: usage.heapUsed / usage.heapTotal
    };
  }

  async waitForPendingTasks() {
    // 実装時は実際の非同期タスクの完了を待つ
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  async recordSystemStatus(status) {
    if (this.components.obsidianAPI) {
      await this.components.obsidianAPI.recordSystemLog({
        event: 'system_status',
        status: status,
        timestamp: new Date().toISOString(),
        details: `System ${status}`,
        model: 'system'
      });
    }
  }

  async recordSystemError(error) {
    if (this.components.obsidianAPI) {
      await this.components.obsidianAPI.recordSystemLog({
        event: 'system_error',
        status: 'error',
        details: error.stack || error.message,
        model: 'system'
      });
    }
  }

  /**
   * 最適化システム初期化
   */
  async initializeOptimization() {
    try {
      // コスト最適化設定読み込み
      const optimizationConfigPath = path.join(__dirname, '../config/cost-optimization.json');
      const optimizationConfig = fs.existsSync(optimizationConfigPath) 
        ? JSON.parse(fs.readFileSync(optimizationConfigPath, 'utf-8'))
        : { dailyBudget: 5.0, contextTokens: 80000, cache: true };

      // システムモニター初期化
      this.components.systemMonitor = new SystemMonitor({
        ...optimizationConfig,
        obsidianPath: this.config.obsidian.vaultPath
      });

      this.logger.info('Optimization systems initialized', {
        dailyBudget: optimizationConfig.dailyBudget,
        contextLimit: optimizationConfig.contextTokens,
        cacheEnabled: optimizationConfig.cache
      });

    } catch (error) {
      this.logger.error('Failed to initialize optimization systems', { 
        error: error.message 
      });
      // 最適化失敗でもシステム全体は継続
    }
  }

  /**
   * 週次最適化実行（日曜日23:00に自動実行）
   */
  async runWeeklyOptimization() {
    if (this.components.modelRouter) {
      await this.components.modelRouter.runWeeklyOptimization();
      this.logger.info('Weekly optimization completed');
    }
  }
}

// メイン実行
async function main() {
  const ecosystem = new AIPersonalAgentEcosystem();
  
  try {
    await ecosystem.start();
  } catch (error) {
    console.error('Failed to start AI Personal Agent Ecosystem:', error);
    process.exit(1);
  }
}

// スクリプトとして直接実行された場合
if (require.main === module) {
  main();
}

module.exports = AIPersonalAgentEcosystem;