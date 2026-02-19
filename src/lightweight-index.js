require('dotenv').config();
const fs = require('fs-extra');
const path = require('path');
const winston = require('winston');

// 軽量版コンポーネント
const LightweightRouter = require('./core/lightweight-router');
const DeepSeekHandler = require('./models/deepseek-handler');
const GLMHandler = require('./models/glm-handler');
const ObsidianAPI = require('./integrations/obsidian-api');
const EmotionalContextEngine = require('./emotion/emotional-context-engine');

class LightweightAIAgent {
  constructor() {
    this.config = this.loadConfiguration();
    this.logger = this.setupLogger();
    this.components = {};
    this.isInitialized = false;
  }

  async initialize() {
    try {
      this.logger.info('Initializing Lightweight AI Agent...');

      // 軽量ルーター
      this.components.router = new LightweightRouter();

      // 必要最小限のモデル
      if (this.config.deepseek.apiKey) {
        this.components.deepseekHandler = new DeepSeekHandler(
          this.config.deepseek.apiKey,
          this.config.deepseek.baseUrl
        );
      }

      if (this.config.glm.apiKey) {
        this.components.glmHandler = new GLMHandler(
          this.config.glm.apiKey,
          this.config.glm.baseUrl
        );
      }

      // 感情エンジン（軽量版）
      this.components.emotionEngine = new EmotionalContextEngine(
        this.config.obsidian.vaultPath,
        { lightweight: true }
      );

      // Obsidian API
      this.components.obsidianAPI = new ObsidianAPI(
        this.config.obsidian.vaultPath
      );

      this.isInitialized = true;
      this.logger.info('Lightweight AI Agent initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize Lightweight AI Agent', { 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * 軽量メッセージ処理
   */
  async processMessage(message, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();

    try {
      // 軽量モデル選択
      const selection = this.components.router.selectModel(message);
      
      // 軽量感情分析
      const emotion = this.quickEmotionAnalysis(message);
      
      // 選択されたモデルで処理
      let result;
      if (selection.model.includes('deepseek')) {
        result = await this.components.deepseekHandler.processLightweightTask({
          message,
          context: { emotion },
          taskType: 'quick'
        });
      } else if (selection.model.includes('glm')) {
        result = await this.components.glmHandler.processTask({
          message,
          taskType: 'structured'
        });
      }

      // 軽量使用量追跡
      const processingTime = Date.now() - startTime;
      this.components.router.trackUsage(
        selection.model, 
        result.tokens?.total || 0,
        result.cost || 0.001
      );

      // 最小限のObsidian記録
      if (Math.random() < 0.2) { // 20%の確率で記録
        await this.components.obsidianAPI.quickRecord({
          content: message.substring(0, 100),
          response: result.content.substring(0, 100),
          timestamp: new Date().toISOString()
        });
      }

      this.logger.info('Message processed (lightweight)', {
        model: selection.model,
        processingTime,
        emergency: selection.emergency
      });

      return {
        response: result.content,
        model: selection.model,
        emotion,
        processingTime,
        emergency: selection.emergency
      };

    } catch (error) {
      this.logger.error('Error processing message', { error: error.message });
      return {
        response: 'エラーが発生しました。少し時間をおいてからお試しください。',
        error: true
      };
    }
  }

  /**
   * 簡易感情分析（軽量版）
   */
  quickEmotionAnalysis(message) {
    if (/疲れ|つかれ|だるい/.test(message)) return 'tired';
    if (/楽しい|嬉しい|やった/.test(message)) return 'excited';
    if (/忙しい|急い|ストレス/.test(message)) return 'stressed';
    return 'neutral';
  }

  /**
   * 現在の使用状況
   */
  getUsageStatus() {
    return this.components.router.getCurrentUsage();
  }

  /**
   * システム状態
   */
  getSystemStatus() {
    const usage = this.getUsageStatus();
    return {
      initialized: this.isInitialized,
      emergencyMode: this.components.router.isEmergencyMode(),
      usage,
      uptime: process.uptime()
    };
  }

  // Private methods
  loadConfiguration() {
    return {
      anthropic: { apiKey: process.env.ANTHROPIC_API_KEY || '' },
      glm: {
        apiKey: process.env.GLM_API_KEY || '',
        baseUrl: process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4/'
      },
      deepseek: {
        apiKey: process.env.DEEPSEEK_API_KEY || '',
        baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
      },
      discord: {
        token: process.env.DISCORD_TOKEN || '',
        clientId: process.env.DISCORD_CLIENT_ID || '',
        guildId: process.env.DISCORD_GUILD_ID || ''
      },
      obsidian: { vaultPath: process.env.OBSIDIAN_VAULT_PATH || '' }
    };
  }

  setupLogger() {
    return winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/lightweight-agent.log' }),
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ]
    });
  }
}

// メイン実行
async function main() {
  const agent = new LightweightAIAgent();
  
  const args = process.argv.slice(2);
  
  if (args.includes('--status')) {
    // ステータス確認
    const status = agent.getSystemStatus();
    console.log('📊 System Status:', JSON.stringify(status, null, 2));
    return;
  }

  if (args.includes('--interactive')) {
    // 対話モード
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('⚡ Lightweight AI Agent - Interactive Mode');
    console.log('Type \"exit\" to quit, \"status\" for usage info\\n');

    const askQuestion = () => {
      rl.question('💭 You: ', async (input) => {
        if (input.toLowerCase() === 'exit') {
          console.log('👋 Goodbye!');
          rl.close();
          return;
        }

        if (input.toLowerCase() === 'status') {
          const status = agent.getUsageStatus();
          console.log(`📊 Usage: $${status.cost.toFixed(4)} (${status.percentage.toFixed(1)}%), ${status.requests} requests`);
          askQuestion();
          return;
        }

        try {
          const result = await agent.processMessage(input);
          console.log(`\\n⚡ AI (${result.model}, ${result.emotion}, ${result.processingTime}ms):`);\n          console.log(result.response);\n        } catch (error) {\n          console.log(`❌ Error: ${error.message}`);\n        }\n\n        askQuestion();\n      });\n    };\n\n    askQuestion();\n    return;\n  }\n\n  // 単発テスト\n  const testMessage = args.join(' ') || 'こんにちは！軽量版テストです。';\n  \n  try {\n    const result = await agent.processMessage(testMessage);\n    \n    console.log('\\n⚡ Lightweight AI Agent Test Result:');\n    console.log(`Input: \"${testMessage}\"`);\n    console.log(`Response: ${result.response}`);\n    console.log(`Model: ${result.model} | Emotion: ${result.emotion}`);\n    console.log(`Processing Time: ${result.processingTime}ms`);\n    \n    const usage = agent.getUsageStatus();\n    console.log(`Usage: $${usage.cost.toFixed(4)} (${usage.percentage.toFixed(1)}%)`);\n    \n  } catch (error) {\n    console.error('❌ Error:', error.message);\n  }\n}\n\n// スクリプトとして実行された場合\nif (require.main === module) {\n  main();\n}\n\nmodule.exports = LightweightAIAgent;"