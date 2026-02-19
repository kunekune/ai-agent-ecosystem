const fs = require('fs-extra');
const path = require('path');
const winston = require('winston');
const LightweightMonitor = require('../optimization/lightweight-monitor');

class LightweightRouter {
  constructor() {
    this.config = JSON.parse(fs.readFileSync(path.join(__dirname, '../../config/routing-rules.json')));
    this.lightweightMonitor = new LightweightMonitor({
      dailyBudget: 5.0,
      obsidianPath: '/home/kunekune/Dropbox/obsidian-vault'
    });
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/lightweight-router.log' }),
        new winston.transports.Console()
      ]
    });
  }

  /**
   * 軽量複雑度分析（最小処理）
   */
  analyzeComplexity(message) {
    let score = 0;

    // シンプルなキーワードマッチング（正規表現最小化）
    const patterns = {
      10: ['人生', '相談', '重要', '戦略', '最終', '仕上げ', '決断', '判断'],    // L5
      7: ['ブログ', '初稿', '記事', '文章', '執筆', 'メール', '返信', '作成'],   // L4  
      5: ['カレンダー', 'Gmail', 'スケジュール', '会議', '予定', '設定'],        // L3
      3: ['アイデア', 'まとめ', '整理', 'チャット', '要約', '分類'],            // L2
      1: ['ファイル', 'デバッグ', 'Ubuntu', '設定', 'システム', '修正']        // L1
    };

    for (const [level, keywords] of Object.entries(patterns)) {
      if (keywords.some(keyword => message.includes(keyword))) {
        score = Math.max(score, parseInt(level));
      }
    }

    // メッセージ長による簡易調整
    if (message.length > 500) score += 2;
    if (message.length > 1000) score += 2;

    return {
      totalScore: score,
      complexity: this.getComplexityLevel(score),
      lightweight: true
    };
  }

  getComplexityLevel(score) {
    if (score >= 10) return 'claude-opus-4.6';    // L5: 編集長
    if (score >= 7) return 'claude-sonnet-4';     // L4: 執筆官  
    if (score >= 5) return 'glm-4.7';             // L3: 秘書
    if (score >= 3) return 'deepseek-v3';         // L2: 門番
    return 'claude-code';                         // L1: 工兵
  }

  /**
   * 軽量モデル選択（緊急モード考慮）
   */
  selectModel(message) {
    // 緊急モードチェック（メモリ内フラグのみ）
    if (global.emergencyMode?.enabled) {
      return this.selectEmergencyModel(message);
    }

    const analysis = this.analyzeComplexity(message);
    return {
      model: analysis.complexity,
      analysis,
      emergency: false
    };
  }

  selectEmergencyModel(message) {
    const analysis = this.analyzeComplexity(message);
    
    // 緊急モード: L4/L5をL3にダウングレード
    const emergencyMap = {
      'claude-opus-4.6': 'glm-4.7',      // L5 → L3
      'claude-sonnet-4': 'glm-4.7',      // L4 → L3  
      'glm-4.7': 'glm-4.7',              // L3 → L3
      'deepseek-v3': 'deepseek-v3',      // L2 → L2
      'claude-code': 'claude-code'       // L1 → L1
    };

    const emergencyModel = emergencyMap[analysis.complexity] || 'deepseek-v3';
    
    return {
      model: emergencyModel,
      analysis,
      emergency: true,
      downgraded: analysis.complexity !== emergencyModel
    };
  }

  /**
   * 超軽量使用量追跡（オーバーヘッド最小）
   */
  trackUsage(modelUsed, tokens, cost) {
    // LightweightMonitorに委譲（メモリ内処理のみ）
    this.lightweightMonitor.trackUsage(cost, tokens);
    
    // 最小ログ出力
    if (Math.random() < 0.1) { // 10%の確率でのみログ出力
      this.logger.info('Usage sampled', {
        model: modelUsed,
        level: this.getModelLevel(modelUsed),
        cost: cost.toFixed(4)
      });
    }
  }

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

  /**
   * 現在の使用状況取得（計算のみ）
   */
  getCurrentUsage() {
    return this.lightweightMonitor.getCurrentUsage();
  }

  /**
   * 緊急モード状態確認
   */
  isEmergencyMode() {
    return global.emergencyMode?.enabled || false;
  }

  /**
   * 週次最適化（低頻度実行）
   */
  runWeeklyOptimization() {
    // 軽量版では簡易統計のみ
    const usage = this.getCurrentUsage();
    console.log('📊 Weekly stats:', {
      avgCost: (usage.cost / Math.max(usage.requests, 1)).toFixed(4),
      efficiency: usage.percentage < 80 ? 'Good' : 'Review needed'
    });
  }
}

module.exports = LightweightRouter;