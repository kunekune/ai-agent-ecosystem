const winston = require('winston');
const fs = require('fs-extra');
const path = require('path');

class CostOptimizer {
  constructor(config) {
    this.config = config;
    this.dailyBudget = config.dailyBudget || 5.00; // $5/日デフォルト
    this.contextLimit = config.contextTokens || 80000; // 8万トークン上限
    this.cacheEnabled = config.cache || true;
    
    this.usageLog = {
      daily: {},
      models: {},
      cache: {},
      warnings: []
    };
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/cost-optimizer.log' }),
        new winston.transports.Console()
      ]
    });
  }

  /**
   * ① コンテキスト・コンパクション（文脈圧縮）
   */
  async compactContext(messages, currentTokens) {
    if (currentTokens < this.contextLimit) {
      return messages; // 圧縮不要
    }

    this.logger.info('Context compaction triggered', {
      currentTokens,
      limit: this.contextLimit
    });

    // 最新20%は保持、古い80%を要約圧縮
    const keepCount = Math.floor(messages.length * 0.2);
    const recentMessages = messages.slice(-keepCount);
    const oldMessages = messages.slice(0, -keepCount);

    // DeepSeek V3で高速要約（L2門番の役割）
    const summary = await this.summarizeMessages(oldMessages);
    
    const compactedMessages = [
      {
        role: 'system',
        content: `[圧縮済み履歴要約]\n${summary}`,
        timestamp: new Date().toISOString(),
        compressed: true
      },
      ...recentMessages
    ];

    this.logger.info('Context compaction completed', {
      originalCount: messages.length,
      compactedCount: compactedMessages.length,
      tokensReduced: currentTokens - this.estimateTokens(compactedMessages)
    });

    return compactedMessages;
  }

  /**
   * ② キャッシュ・ウォーミング（プロンプトキャッシュ最適化）
   */
  async enableCaching(request) {
    if (!this.cacheEnabled) return request;

    // Enhanced PARA構造、役割定義など頻繁使用要素をキャッシュ
    const cacheablePatterns = [
      'Enhanced PARA',
      '5段階エスカレーション',
      'L1工兵', 'L2門番', 'L3秘書', 'L4執筆官', 'L5編集長',
      'Obsidian統合',
      'Yokohama Bay',
      'システムプロンプト'
    ];

    let cacheKeys = [];
    for (const pattern of cacheablePatterns) {
      if (request.message?.includes(pattern) || request.context?.includes?.(pattern)) {
        cacheKeys.push(pattern);
      }
    }

    if (cacheKeys.length > 0) {
      request.cache = {
        enabled: true,
        keys: cacheKeys,
        ttl: 3600 // 1時間キャッシュ
      };

      this.logger.info('Cache enabled for request', { 
        cacheKeys,
        estimatedSavings: cacheKeys.length * 0.9 // 90%削減見込み
      });
    }

    return request;
  }

  /**
   * ③ 予算アラート・システムステータス反映
   */
  async trackUsage(modelUsed, tokens, cost) {
    const today = new Date().toISOString().split('T')[0];
    
    // 日次使用量記録
    if (!this.usageLog.daily[today]) {
      this.usageLog.daily[today] = {
        totalCost: 0,
        totalTokens: 0,
        requests: 0,
        models: {}
      };
    }

    this.usageLog.daily[today].totalCost += cost;
    this.usageLog.daily[today].totalTokens += tokens;
    this.usageLog.daily[today].requests += 1;

    if (!this.usageLog.daily[today].models[modelUsed]) {
      this.usageLog.daily[today].models[modelUsed] = { cost: 0, tokens: 0, count: 0 };
    }
    
    this.usageLog.daily[today].models[modelUsed].cost += cost;
    this.usageLog.daily[today].models[modelUsed].tokens += tokens;
    this.usageLog.daily[today].models[modelUsed].count += 1;

    // 予算監視・アラート
    await this.checkBudgetAlert(today);
  }

  async checkBudgetAlert(date) {
    const usage = this.usageLog.daily[date];
    if (!usage) return;

    const budgetPercentage = (usage.totalCost / this.dailyBudget) * 100;

    // アラートレベル設定
    if (budgetPercentage >= 90) {
      await this.triggerBudgetAlert('CRITICAL', usage, budgetPercentage);
      await this.enableEmergencyMode();
    } else if (budgetPercentage >= 70) {
      await this.triggerBudgetAlert('WARNING', usage, budgetPercentage);
    } else if (budgetPercentage >= 50) {
      await this.triggerBudgetAlert('INFO', usage, budgetPercentage);
    }
  }

  async triggerBudgetAlert(level, usage, percentage) {
    const alert = {
      level,
      date: new Date().toISOString(),
      usage,
      percentage: Math.round(percentage),
      dailyBudget: this.dailyBudget
    };

    this.logger.warn('Budget alert triggered', alert);

    // Dashboard更新
    await this.updateDashboardAlert(alert);
    
    // System-Status更新
    await this.updateSystemStatus(alert);
  }

  async updateDashboardAlert(alert) {
    try {
      const dashboardPath = path.join(this.config.obsidianPath, '00-Dashboard.md');
      const content = await fs.readFile(dashboardPath, 'utf-8');

      const alertSection = `
### ⚠️ **予算アラート** (${alert.level})
- **使用状況**: ${alert.percentage}% ($${alert.usage.totalCost.toFixed(2)}/$${alert.dailyBudget})
- **今日のリクエスト**: ${alert.usage.requests}回 (${alert.usage.totalTokens.toLocaleString()}トークン)
- **対策**: ${alert.level === 'CRITICAL' ? '緊急モード有効化' : 'モニタリング継続'}

`;

      // Dashboard上部に挿入
      const updatedContent = content.replace(
        /## 🌅 今日の状況/,
        `${alertSection}## 🌅 今日の状況`
      );

      await fs.writeFile(dashboardPath, updatedContent, 'utf-8');
      
      this.logger.info('Dashboard alert updated', { level: alert.level });

    } catch (error) {
      this.logger.error('Failed to update dashboard alert', { error: error.message });
    }
  }

  async updateSystemStatus(alert) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const statusPath = path.join(
        this.config.obsidianPath,
        '02-Areas/openclaw-systems/logs',
        `cost-usage-${today}.md`
      );

      const usageReport = `# コスト使用状況 - ${today}

## 📊 使用サマリー
- **総コスト**: $${alert.usage.totalCost.toFixed(4)} / $${this.dailyBudget} (${alert.percentage}%)
- **総トークン**: ${alert.usage.totalTokens.toLocaleString()}
- **リクエスト数**: ${alert.usage.requests}

## 🎯 モデル別詳細
${Object.entries(alert.usage.models).map(([model, stats]) => 
  `- **${model}**: $${stats.cost.toFixed(4)} (${stats.count}回, ${stats.tokens.toLocaleString()}tokens)`
).join('\n')}

## ⚡ 最適化効果
- **キャッシュ使用**: ${this.usageLog.cache.hits || 0}回
- **コンテキスト圧縮**: ${this.usageLog.cache.compressions || 0}回
- **推定削減コスト**: $${(this.usageLog.cache.savedCost || 0).toFixed(4)}

---
*自動生成: ${new Date().toISOString()}*
`;

      await fs.ensureDir(path.dirname(statusPath));
      await fs.writeFile(statusPath, usageReport, 'utf-8');

    } catch (error) {
      this.logger.error('Failed to update system status', { error: error.message });
    }
  }

  /**
   * 緊急モード: 予算上限近接時の自動縮退
   */
  async enableEmergencyMode() {
    this.logger.warn('Emergency mode activated - switching to cost-saving mode');

    // L2門番とL3秘書のみ使用、L4/L5を無効化
    this.config.emergencyMode = {
      enabled: true,
      allowedLevels: ['L1', 'L2', 'L3'],
      restrictedLevels: ['L4', 'L5'],
      activatedAt: new Date().toISOString()
    };

    // Dashboard緊急通知
    await this.updateEmergencyNotification();
  }

  async updateEmergencyNotification() {
    const dashboardPath = path.join(this.config.obsidianPath, '00-Dashboard.md');
    const content = await fs.readFile(dashboardPath, 'utf-8');

    const emergencyNotice = `
### 🚨 **緊急モード稼働中**
予算上限に近づいたため、コスト節約モードで動作中です。
- **利用可能**: L1工兵, L2門番, L3秘書
- **制限中**: L4執筆官, L5編集長
- **解除**: 明日00:00に自動解除予定

`;

    const updatedContent = content.replace(
      /## 🌅 今日の状況/,
      `${emergencyNotice}## 🌅 今日の状況`
    );

    await fs.writeFile(dashboardPath, updatedContent, 'utf-8');
  }

  // Helper methods
  async summarizeMessages(messages) {
    // DeepSeek V3による高速要約（実装は略）
    return `[${messages.length}件のメッセージを要約: 主なトピック、決定事項、重要な文脈]`;
  }

  estimateTokens(messages) {
    // トークン数概算（実装は略）
    return messages.reduce((total, msg) => total + (msg.content?.length || 0) * 0.25, 0);
  }

  /**
   * 週次自己評価・進化システム
   */
  async performWeeklyOptimization() {
    this.logger.info('Starting weekly optimization analysis');

    const lastWeek = this.getLastWeekUsage();
    
    // L5編集長による振り返り分析
    const analysisResult = await this.analyzeModelSelection(lastWeek);
    
    // ルール更新提案
    const optimizationSuggestions = await this.generateOptimizationSuggestions(analysisResult);
    
    // Claude Codeによるルール自動更新
    await this.updateRoutingRules(optimizationSuggestions);
    
    // レポート生成
    await this.generateWeeklyReport(analysisResult, optimizationSuggestions);
  }

  getLastWeekUsage() {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const weeklyUsage = {};
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      if (this.usageLog.daily[dateStr]) {
        weeklyUsage[dateStr] = this.usageLog.daily[dateStr];
      }
    }
    
    return weeklyUsage;
  }

  async analyzeModelSelection(weeklyUsage) {
    // L5編集長による高度分析（実装略）
    return {
      overusedModels: ['L4執筆官'],
      underusedModels: ['L2門番'],
      misclassifications: ['簡単なタスクをL4で処理'],
      potentialSavings: 1.2 // $1.2削減可能
    };
  }

  async generateOptimizationSuggestions(analysis) {
    return {
      adjustments: [
        {
          current: 'simple_writing -> L4',
          suggested: 'simple_writing -> L3',
          reason: '簡単な文章作成はL3秘書で十分',
          estimatedSaving: 0.8
        }
      ],
      newRules: [
        {
          pattern: 'bullet_list',
          currentLevel: 'L4',
          suggestedLevel: 'L2',
          reason: '箇条書きは門番レベルで処理可能'
        }
      ]
    };
  }

  async updateRoutingRules(suggestions) {
    // routing-rules.jsonの自動更新（Claude Code経由）
    this.logger.info('Updating routing rules based on analysis', { 
      suggestionsCount: suggestions.adjustments.length 
    });
  }

  async generateWeeklyReport(analysis, suggestions) {
    const reportPath = path.join(
      this.config.obsidianPath,
      '02-Areas/openclaw-systems/optimization',
      `weekly-optimization-${new Date().toISOString().split('T')[0]}.md`
    );

    const report = `# 週次最適化レポート

## 📊 分析結果
${JSON.stringify(analysis, null, 2)}

## 🎯 最適化提案
${JSON.stringify(suggestions, null, 2)}

## 💰 期待削減効果
推定週間削減: $${suggestions.adjustments.reduce((sum, adj) => sum + adj.estimatedSaving, 0).toFixed(2)}

---
*自動生成: ${new Date().toISOString()}*
`;

    await fs.ensureDir(path.dirname(reportPath));
    await fs.writeFile(reportPath, report, 'utf-8');
  }
}

module.exports = CostOptimizer;