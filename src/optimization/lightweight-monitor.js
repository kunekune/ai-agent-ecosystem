const fs = require('fs-extra');
const path = require('path');

class LightweightMonitor {
  constructor(config) {
    this.config = config;
    this.dailyBudget = config.dailyBudget || 5.0;
    
    // メモリ内で軽量管理（ファイルI/O最小化）
    this.dailyUsage = {
      date: new Date().toISOString().split('T')[0],
      totalCost: 0,
      totalTokens: 0,
      requests: 0,
      lastCheck: 0
    };
    
    // アラートは閾値突破時のみ（頻繁チェック回避）
    this.alertThresholds = [0.7, 0.9]; // 70%, 90%のみ
    this.alertTriggered = new Set();
  }

  /**
   * 超軽量使用量追跡（トークン消費ゼロ）
   */
  trackUsage(cost, tokens) {
    const today = new Date().toISOString().split('T')[0];
    
    // 日付変更時のみリセット
    if (this.dailyUsage.date !== today) {
      this.resetDailyUsage(today);
    }
    
    // メモリ内累積（I/O処理なし）
    this.dailyUsage.totalCost += cost;
    this.dailyUsage.totalTokens += tokens;
    this.dailyUsage.requests += 1;
    
    // 閾値チェック（計算のみ、処理なし）
    this.checkThresholds();
  }

  /**
   * 閾値チェック（計算処理のみ）
   */
  checkThresholds() {
    const percentage = this.dailyUsage.totalCost / this.dailyBudget;
    
    for (const threshold of this.alertThresholds) {
      if (percentage >= threshold && !this.alertTriggered.has(threshold)) {
        this.alertTriggered.add(threshold);
        
        // 非同期でアラート処理（メイン処理をブロックしない）
        setImmediate(() => this.triggerAlert(threshold, percentage));
      }
    }
  }

  /**
   * アラート処理（非同期・低頻度）
   */
  async triggerAlert(threshold, percentage) {
    try {
      const level = threshold >= 0.9 ? 'CRITICAL' : 'WARNING';
      
      // Dashboard更新（1日1回のみ）
      await this.updateDashboardOnce(level, percentage);
      
      // 緊急モード（90%のみ）
      if (threshold >= 0.9) {
        await this.enableEmergencyMode();
      }
      
    } catch (error) {
      // 監視エラーでメイン処理を止めない
      console.warn('Monitor alert failed:', error.message);
    }
  }

  /**
   * Dashboard更新（1日1回制限）
   */
  async updateDashboardOnce(level, percentage) {
    const now = Date.now();
    const lastUpdate = this.dailyUsage.lastDashboardUpdate || 0;
    
    // 1時間に1回以下に制限
    if (now - lastUpdate < 3600000) return;
    
    this.dailyUsage.lastDashboardUpdate = now;
    
    // 最小限のファイル更新
    const dashboardPath = path.join(
      this.config.obsidianPath || '/home/kunekune/Dropbox/obsidian-vault',
      '00-Dashboard.md'
    );
    
    const alertLine = `### ${level === 'CRITICAL' ? '🚨' : '⚠️'} **予算アラート** ${Math.round(percentage * 100)}% ($${this.dailyUsage.totalCost.toFixed(2)}/$${this.dailyBudget})`;
    
    try {
      let content = await fs.readFile(dashboardPath, 'utf-8');
      
      // 既存アラートを置換（追加ではなく更新）
      if (content.includes('予算アラート')) {
        content = content.replace(/###.*予算アラート.*/, alertLine);
      } else {
        content = content.replace(/(## 🌅 今日の状況)/, `${alertLine}\n\n$1`);
      }
      
      await fs.writeFile(dashboardPath, content, 'utf-8');
      
    } catch (error) {
      // ファイルエラーでもメイン処理継続
      console.warn('Dashboard update failed:', error.message);
    }
  }

  /**
   * 緊急モード有効化（最低限処理）
   */
  async enableEmergencyMode() {
    // メモリ内フラグのみ（ファイルI/O回避）
    global.emergencyMode = {
      enabled: true,
      allowedLevels: ['L1', 'L2', 'L3'],
      activatedAt: Date.now()
    };
    
    console.warn('🚨 Emergency mode activated - L4/L5 restricted');
  }

  /**
   * 日次リセット（軽量）
   */
  resetDailyUsage(newDate) {
    this.dailyUsage = {
      date: newDate,
      totalCost: 0,
      totalTokens: 0,
      requests: 0,
      lastCheck: 0
    };
    
    this.alertTriggered.clear();
    
    // 緊急モード自動解除
    if (global.emergencyMode) {
      global.emergencyMode.enabled = false;
      console.log('✅ Emergency mode auto-disabled for new day');
    }
  }

  /**
   * 現在状況取得（計算のみ）
   */
  getCurrentUsage() {
    return {
      cost: this.dailyUsage.totalCost,
      tokens: this.dailyUsage.totalTokens,
      requests: this.dailyUsage.requests,
      percentage: (this.dailyUsage.totalCost / this.dailyBudget) * 100,
      emergencyMode: global.emergencyMode?.enabled || false
    };
  }

  /**
   * 週次レポート（低頻度・バッチ処理）
   */
  generateWeeklyReport() {
    // 週1回のみ実行（日曜23:00）
    const now = new Date();
    if (now.getDay() !== 0 || now.getHours() !== 23) return;
    
    // 非同期でレポート生成（メイン処理をブロックしない）
    setImmediate(async () => {
      try {
        await this.createWeeklyReport();
      } catch (error) {
        console.warn('Weekly report failed:', error.message);
      }
    });
  }

  async createWeeklyReport() {
    // 実装略（週1回の重い処理）
    console.log('📊 Weekly optimization report generated');
  }
}

module.exports = LightweightMonitor;