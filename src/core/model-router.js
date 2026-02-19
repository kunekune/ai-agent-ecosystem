const fs = require('fs-extra');
const path = require('path');
const winston = require('winston');
const LightweightMonitor = require('../optimization/lightweight-monitor');

class ModelRouter {
  constructor() {
    this.config = JSON.parse(fs.readFileSync(path.join(__dirname, '../../config/routing-rules.json')));
    this.models = {};
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/model-router.log' }),
        new winston.transports.Console()
      ]
    });
    
    // コスト最適化システム初期化
    // this.initializeCostOptimizer(); // TODO: 実装予定
  }

  /**
   * メッセージの複雑度を分析
   */
  analyzeComplexity(message) {
    const indicators = this.config.complexityThresholds;
    let score = 0;
    let matchedIndicators = [];

    // 各複雑度レベルの指標をチェック
    for (const [level, config] of Object.entries(indicators)) {
      for (const indicator of config.indicators) {
        if (this.containsIndicator(message, indicator)) {
          score += config.score;
          matchedIndicators.push({ level, indicator, score: config.score });
        }
      }
    }

    // メッセージ長による調整
    const lengthBonus = Math.min(message.length / 200, 3);
    score += lengthBonus;

    return {
      totalScore: score,
      complexity: this.getComplexityLevel(score),
      indicators: matchedIndicators,
      lengthBonus
    };
  }

  /**
   * 感情コンテキストを分析
   */
  analyzeEmotionalContext(message, timestamp = new Date()) {
    const hour = timestamp.getHours();
    const day = timestamp.getDay();
    
    // 時間帯による調整
    let timeContext = 'balanced';
    if (hour >= 6 && hour < 12) timeContext = 'morning';
    else if (hour >= 12 && hour < 18) timeContext = 'afternoon';
    else if (hour >= 18 && hour < 22) timeContext = 'evening';
    else timeContext = 'night';

    // 曜日による調整
    let dayContext = 'balanced';
    if (day === 1) dayContext = 'monday';
    else if (day === 5) dayContext = 'friday';
    else if (day === 0 || day === 6) dayContext = 'weekend';

    // ユーザー気分の検出
    const mood = this.detectUserMood(message);

    return {
      timeOfDay: timeContext,
      weekday: dayContext,
      userMood: mood,
      recommended: this.config.emotionalContext.factors.userMood[mood] || 'balanced'
    };
  }

  /**
   * 最適なモデルを選択
   */
  selectOptimalModel(complexity, emotionalContext, costConstraints = {}) {
    let selectedModel = complexity.complexity;
    
    // コスト最適化チェック
    if (this.config.costOptimization.enabled) {
      if (this.config.costOptimization.preferCheapModel && complexity.totalScore < 6) {
        selectedModel = 'deepseek-v3';
      }
    }

    // 感情適応調整
    if (this.config.emotionalContext.enabled) {
      selectedModel = this.adjustForEmotion(selectedModel, emotionalContext);
    }

    this.logger.info('Model selection', {
      originalComplexity: complexity.complexity,
      selectedModel,
      emotionalContext: emotionalContext.recommended,
      score: complexity.totalScore
    });

    return {
      model: selectedModel,
      reasoning: {
        complexity: complexity,
        emotion: emotionalContext,
        finalChoice: selectedModel
      }
    };
  }

  /**
   * エスカレーション処理
   * reason='api_error' の場合はdowngradeチェーンを使用
   */
  escalateModel(currentModel, reason) {
    if (reason === 'api_error') {
      // APIエラー時はダウングレード（フォールバック）
      const downgradeMap = {
        'claude-opus-4.6': 'claude-sonnet-4',  // L5 → L4
        'claude-sonnet-4': 'glm-4.7',          // L4 → L3
        'glm-4.7': 'deepseek-v3',              // L3 → L2
        'deepseek-v3': null,                   // L2: フォールバック不可
        'claude-code': null,                   // L1: フォールバック不可
      };

      const newModel = downgradeMap[currentModel];
      if (!newModel) {
        this.logger.error('No fallback available for model', { currentModel, reason });
        throw new Error(`No fallback available for ${currentModel}`);
      }

      this.logger.warn('Model downgrade (api_error fallback)', {
        from: currentModel,
        to: newModel,
        reason,
        level: this.getModelLevel(newModel)
      });

      return newModel;
    }

    // 通常エスカレーション（複雑度超過などによるアップグレード）
    const escalationMap = {
      'claude-code': 'deepseek-v3',           // L1 → L2
      'deepseek-v3': 'glm-4.7',              // L2 → L3
      'glm-4.7': 'claude-sonnet-4',          // L3 → L4
      'claude-sonnet-4': 'claude-opus-4.6',  // L4 → L5
      'claude-opus-4.6': 'claude-opus-4.6'   // L5 → L5 (最高レベル)
    };

    const newModel = escalationMap[currentModel] || 'claude-opus-4.6';

    this.logger.warn('Model escalation', {
      from: currentModel,
      to: newModel,
      reason,
      level: this.getModelLevel(newModel)
    });

    return newModel;
  }

  /**
   * フォールバック付きルーティング
   * 選択したモデルが失敗した場合、自動でフォールバックチェーンを試みる
   */
  async routeWithFallback(message, context = {}) {
    const complexity = this.analyzeComplexity(message);
    const emotionalContext = this.analyzeEmotionalContext(message);
    const selection = this.selectOptimalModel(complexity, emotionalContext);

    let currentModel = selection.model;
    let lastError;

    while (currentModel) {
      try {
        this.logger.info('Attempting model', { model: currentModel });

        // モデルに応じたハンドラーを返す（実際の実行は呼び出し元が担う）
        return {
          model: currentModel,
          complexity,
          emotionalContext,
          execute: async (handler) => handler
        };
      } catch (error) {
        lastError = error;
        this.logger.warn('Model failed, trying fallback', {
          model: currentModel,
          error: error.message,
          fallback_triggered: true,
          reason: error.type || error.code || 'api_error'
        });

        try {
          currentModel = this.escalateModel(currentModel, 'api_error');
        } catch {
          break;
        }
      }
    }

    throw lastError || new Error('All models failed');
  }

  /**
   * モデルのレベルを取得
   */
  getModelLevel(modelName) {
    const levelMap = {
      'claude-code': 'L1 (工兵)',
      'deepseek-v3': 'L2 (門番)', 
      'glm-4.7': 'L3 (秘書)',
      'claude-sonnet-4': 'L4 (執筆官)',
      'claude-opus-4.6': 'L5 (編集長)'
    };
    
    return levelMap[modelName] || 'Unknown';
  }

  // Private methods
  containsIndicator(message, indicator) {
    const patterns = {
      '抽象的概念': /抽象|概念|哲学|思想|本質|意味/,
      '感情分析': /感情|気持ち|心理|ストレス|疲れ|嬉しい|悲しい/,
      '長文生成': message.length > 500,
      '価値観判定': /価値観|信念|大切|重要|意味|目的/,
      '創造的思考': /アイデア|クリエイティブ|創造|発想|ブレスト/,
      '複雑な推論': /分析|推論|考察|検討|判断|評価/,
      'スケジュール調整': /予定|スケジュール|会議|打ち合わせ|アポ/,
      'メール処理': /メール|連絡|返信|送信/,
      'API操作': /API|データ|取得|送信|更新/,
      '事実抽出': /事実|情報|データ|統計/,
      '短文要約': /要約|まとめ|概要/ && message.length < 200,
      '単純質問': /？|\?|教えて|何|いつ|どこ/
    };

    const pattern = patterns[indicator];
    if (typeof pattern === 'boolean') return pattern;
    if (pattern instanceof RegExp) return pattern.test(message);
    return false;
  }

  getComplexityLevel(score) {
    if (score >= 10) return 'claude-opus-4.6';    // L5: 編集長
    if (score >= 7) return 'claude-sonnet-4';     // L4: 執筆官  
    if (score >= 5) return 'glm-4.7';             // L3: 秘書
    if (score >= 3) return 'deepseek-v3';         // L2: 門番
    return 'claude-code';                         // L1: 工兵
  }

  detectUserMood(message) {
    if (/疲れ|つかれ|眠い|だるい/.test(message)) return 'tired';
    if (/忙しい|急い|ストレス|大変/.test(message)) return 'stressed';
    if (/楽しい|嬉しい|やった|最高/.test(message)) return 'excited';
    if (/集中|作業|仕事|タスク/.test(message)) return 'focused';
    return 'neutral';
  }

  adjustForEmotion(model, emotionalContext) {
    // 夜遅い時間や疲れている時は優しいモデルを選択
    if (emotionalContext.timeOfDay === 'night' || emotionalContext.userMood === 'tired') {
      return model === 'deepseek-v3' ? 'glm-4.7' : model;
    }
    
    // ストレス時はより配慮深いモデル
    if (emotionalContext.userMood === 'stressed') {
      return 'claude-opus';
    }

    return model;
  }

  /**
   * 最適化されたモデル選択（コスト考慮）
   */
  async selectOptimalModel(message, context = {}) {
    // 緊急モードチェック
    if (this.costOptimizer?.config.emergencyMode?.enabled) {
      return this.selectEmergencyModel(message);
    }

    // 通常の複雑度分析
    const analysis = this.analyzeComplexity(message);
    let selectedModel = analysis.complexity;

    // コンテキスト圧縮の必要性チェック
    if (context.messageHistory && context.tokens && this.costOptimizer) {
      context.messageHistory = await this.costOptimizer.compactContext(
        context.messageHistory, 
        context.tokens
      );
    }

    // キャッシュ最適化
    let optimizedRequest = { message, context, model: selectedModel };
    if (this.costOptimizer) {
      optimizedRequest = await this.costOptimizer.enableCaching(optimizedRequest);
    }

    this.logger.info('Optimal model selected', {
      original: analysis.complexity,
      selected: selectedModel,
      cached: optimizedRequest.cache?.enabled || false,
      emergency: false
    });

    return {
      model: selectedModel,
      analysis,
      optimizedRequest,
      costSavings: this.estimateCostSavings(optimizedRequest)
    };
  }

  /**
   * 緊急モード用モデル選択
   */
  selectEmergencyModel(message) {
    // 緊急モード: L1-L3のみ使用
    const analysis = this.analyzeComplexity(message);
    const emergencyMap = {
      'claude-opus-4.6': 'glm-4.7',      // L5 → L3
      'claude-sonnet-4': 'glm-4.7',      // L4 → L3  
      'glm-4.7': 'glm-4.7',              // L3 → L3
      'deepseek-v3': 'deepseek-v3',      // L2 → L2
      'claude-code': 'claude-code'       // L1 → L1
    };

    const emergencyModel = emergencyMap[analysis.complexity] || 'deepseek-v3';
    
    this.logger.warn('Emergency mode model selected', {
      original: analysis.complexity,
      emergency: emergencyModel,
      reason: 'Budget limit approaching'
    });

    return {
      model: emergencyModel,
      analysis,
      emergency: true,
      downgraded: analysis.complexity !== emergencyModel
    };
  }

  /**
   * 使用量追跡
   */
  async trackUsage(modelUsed, tokens, cost, metadata = {}) {
    if (this.costOptimizer) {
      await this.costOptimizer.trackUsage(modelUsed, tokens, cost);
    }
    
    this.logger.info('Usage tracked', {
      model: modelUsed,
      tokens,
      cost: cost.toFixed(4),
      level: this.getModelLevel(modelUsed),
      ...metadata
    });
  }

  /**
   * コスト削減効果の推定
   */
  estimateCostSavings(optimizedRequest) {
    let savings = 0;
    
    if (optimizedRequest.cache?.enabled) {
      // キャッシュによる削減: 90%
      savings += optimizedRequest.cache.keys.length * 0.9;
    }
    
    if (optimizedRequest.compressed) {
      // コンテキスト圧縮による削減: 推定50%
      savings += 0.5;
    }

    return {
      estimated: savings,
      cache: optimizedRequest.cache?.enabled || false,
      compressed: optimizedRequest.compressed || false
    };
  }

  /**
   * 週次最適化の実行
   */
  async runWeeklyOptimization() {
    if (this.costOptimizer) {
      await this.costOptimizer.performWeeklyOptimization();
      this.logger.info('Weekly optimization completed');
    }
  }
}

module.exports = ModelRouter;