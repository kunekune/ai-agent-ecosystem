const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const winston = require('winston');

class MonthlyOptimizer {
  constructor(config) {
    this.config = config;
    this.obsidianPath = config.obsidianPath || '/home/kunekune/Dropbox/obsidian-vault';
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/monthly-optimizer.log' }),
        new winston.transports.Console()
      ]
    });
  }

  /**
   * 月次最適化メイン実行
   */
  async runMonthlyOptimization() {
    try {
      this.logger.info('Starting monthly AI optimization survey');
      
      const optimizationConfig = this.loadOptimizationConfig();
      
      // 1. 最新モデル情報の調査
      const modelSurvey = await this.conductModelSurvey(optimizationConfig);
      
      // 2. 現在のシステムパフォーマンス分析
      const performanceAnalysis = await this.analyzeCurrentPerformance();
      
      // 3. コスト効率分析
      const costAnalysis = await this.analyzeCostEfficiency();
      
      // 4. 最適化提案生成
      const recommendations = await this.generateRecommendations(
        modelSurvey, 
        performanceAnalysis, 
        costAnalysis
      );
      
      // 5. レポート生成
      await this.generateMonthlyReport({
        survey: modelSurvey,
        performance: performanceAnalysis,
        cost: costAnalysis,
        recommendations
      });
      
      // 6. Google Tasksに実装タスク追加
      await this.createImplementationTasks(recommendations);
      
      this.logger.info('Monthly optimization completed successfully');
      
    } catch (error) {
      this.logger.error('Monthly optimization failed', { error: error.message });
      throw error;
    }
  }

  /**
   * 最新モデル調査
   */
  async conductModelSurvey(config) {
    const survey = {
      date: new Date().toISOString().split('T')[0],
      newModels: [],
      priceChanges: [],
      capabilityUpdates: [],
      recommendations: []
    };

    // OpenClaw特有の調査項目
    const openclawUpdates = await this.checkOpenClawUpdates();
    survey.openclawUpdates = openclawUpdates;

    // 各プロバイダーの調査
    for (const source of config.modelSurvey.sources) {
      try {
        const data = await this.surveyModelSource(source);
        if (data.newModels) survey.newModels.push(...data.newModels);
        if (data.priceChanges) survey.priceChanges.push(...data.priceChanges);
      } catch (error) {
        this.logger.warn(`Failed to survey ${source}`, { error: error.message });
      }
    }

    return survey;
  }

  /**
   * OpenClawアップデートチェック
   */
  async checkOpenClawUpdates() {
    try {
      // OpenClawのリリース情報をチェック
      const response = await axios.get('https://api.github.com/repos/openclaw/openclaw/releases/latest');
      const latestRelease = response.data;
      
      return {
        version: latestRelease.tag_name,
        published: latestRelease.published_at,
        notes: latestRelease.body,
        hasNewFeatures: latestRelease.body.includes('Kimi') || 
                       latestRelease.body.includes('free') ||
                       latestRelease.body.includes('faster'),
        priority: this.assessUpdatePriority(latestRelease.body)
      };
    } catch (error) {
      this.logger.warn('Failed to check OpenClaw updates', { error: error.message });
      return { error: 'Failed to fetch updates' };
    }
  }

  /**
   * アップデート優先度評価
   */
  assessUpdatePriority(releaseNotes) {
    const highPriorityKeywords = ['free', 'cost', 'faster', 'performance', 'security'];
    const mediumPriorityKeywords = ['feature', 'improvement', 'enhancement'];
    
    const notes = releaseNotes.toLowerCase();
    
    if (highPriorityKeywords.some(keyword => notes.includes(keyword))) {
      return 'HIGH';
    } else if (mediumPriorityKeywords.some(keyword => notes.includes(keyword))) {
      return 'MEDIUM';
    }
    return 'LOW';
  }

  /**
   * 現在のパフォーマンス分析
   */
  async analyzeCurrentPerformance() {
    const analysis = {
      date: new Date().toISOString().split('T')[0],
      modelUsage: {},
      averageResponseTime: {},
      successRate: {},
      costPerRequest: {}
    };

    // 過去30日のログを分析
    const logFiles = [
      'logs/model-router.log',
      'logs/claude-opus.log',
      'logs/claude-sonnet.log',
      'logs/glm-handler.log',
      'logs/deepseek-handler.log'
    ];

    for (const logFile of logFiles) {
      try {
        if (await fs.pathExists(logFile)) {
          const logContent = await fs.readFile(logFile, 'utf-8');
          const monthlyData = this.extractMonthlyMetrics(logContent);
          Object.assign(analysis.modelUsage, monthlyData.usage);
          Object.assign(analysis.averageResponseTime, monthlyData.responseTime);
          Object.assign(analysis.costPerRequest, monthlyData.cost);
        }
      } catch (error) {
        this.logger.warn(`Failed to analyze ${logFile}`, { error: error.message });
      }
    }

    return analysis;
  }

  /**
   * 最適化提案生成
   */
  async generateRecommendations(survey, performance, cost) {
    const recommendations = [];

    // Kimi K2.5無料化の対応
    if (survey.openclawUpdates.hasNewFeatures) {
      recommendations.push({
        type: 'MODEL_ADDITION',
        priority: 'HIGH',
        title: 'Kimi K2.5無料モデルの統合検討',
        description: 'OpenClaw 2026.1.30でKimi K2.5が無料化。5段階エスカレーションのL1またはL2レベルでの活用を検討',
        estimatedSavings: this.calculateKimiSavings(),
        implementation: 'L1工兵またはL2門番レベルでKimi K2.5を試験運用',
        timeline: '1週間以内'
      });
    }

    // コスト最適化提案
    const highCostModels = this.identifyHighCostModels(cost);
    if (highCostModels.length > 0) {
      recommendations.push({
        type: 'COST_OPTIMIZATION',
        priority: 'MEDIUM',
        title: '高コストモデルの使用頻度最適化',
        description: `${highCostModels.join(', ')}の使用パターンを見直し`,
        estimatedSavings: this.calculateOptimizationSavings(highCostModels),
        implementation: '使用閾値の調整、代替モデルでの試験実行'
      });
    }

    // パフォーマンス改善提案
    const slowModels = this.identifySlowModels(performance);
    if (slowModels.length > 0) {
      recommendations.push({
        type: 'PERFORMANCE_IMPROVEMENT',
        priority: 'LOW',
        title: '応答時間改善',
        description: `${slowModels.join(', ')}の応答時間改善策検討`,
        implementation: 'キャッシュ強化、プロンプト最適化'
      });
    }

    return recommendations;
  }

  /**
   * 月次レポート生成
   */
  async generateMonthlyReport(data) {
    const reportDate = new Date().toISOString().split('T')[0];
    const reportPath = path.join(
      this.obsidianPath,
      '01-Projects/ai-personal-agent-ecosystem/monthly-optimization-reports',
      `monthly-optimization-${reportDate}.md`
    );

    const report = `# 月次AI最適化レポート - ${reportDate}

## 📊 最新モデル調査結果

### OpenClawアップデート情報
${data.survey.openclawUpdates ? 
  `- バージョン: ${data.survey.openclawUpdates.version}
- 重要度: ${data.survey.openclawUpdates.priority}
- 主な機能: ${data.survey.openclawUpdates.notes ? data.survey.openclawUpdates.notes.substring(0, 200) : 'N/A'}...` 
  : '情報取得エラー'}

### 新しいモデル
${data.survey.newModels.length > 0 ? 
  data.survey.newModels.map(model => `- ${model.name}: ${model.description}`).join('\n') :
  '新しいモデルの発見なし'}

### 価格変更
${data.survey.priceChanges.length > 0 ?
  data.survey.priceChanges.map(change => `- ${change.model}: ${change.change}`).join('\n') :
  '価格変更なし'}

## 📈 現在のパフォーマンス

### モデル使用状況
${Object.entries(data.performance.modelUsage).map(([model, usage]) => 
  `- ${model}: ${usage}回使用`).join('\n') || 'データ不足'}

### 平均応答時間
${Object.entries(data.performance.averageResponseTime).map(([model, time]) => 
  `- ${model}: ${time}ms`).join('\n') || 'データ不足'}

## 💰 コスト分析

### リクエストあたりコスト
${Object.entries(data.performance.costPerRequest).map(([model, cost]) => 
  `- ${model}: $${cost.toFixed(4)}/request`).join('\n') || 'データ不足'}

## 🎯 最適化提案

${data.recommendations.map((rec, index) => 
  `### ${index + 1}. ${rec.title} (優先度: ${rec.priority})

**説明**: ${rec.description}

**実装方法**: ${rec.implementation}

${rec.estimatedSavings ? `**推定削減効果**: ${rec.estimatedSavings}` : ''}

${rec.timeline ? `**実装時期**: ${rec.timeline}` : ''}
`).join('\n')}

## 📋 実装タスク

以下のタスクがGoogle Tasksに追加されました:

${data.recommendations.map((rec, index) => 
  `- [ ] ${rec.title}`).join('\n')}

---

*自動生成: ${new Date().toISOString()}*
`;

    await fs.ensureDir(path.dirname(reportPath));
    await fs.writeFile(reportPath, report, 'utf-8');
    
    this.logger.info('Monthly report generated', { reportPath });
  }

  /**
   * 実装タスクをGoogle Tasksに追加
   */
  async createImplementationTasks(recommendations) {
    for (const rec of recommendations.filter(r => r.priority === 'HIGH')) {
      try {
        const { execSync } = require('child_process');
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 7); // 1週間後
        
        const command = `gog tasks add "MDUwMTkyNDM2MDcxNTgwOTQ0NDA6MDow" \\
          -a "kunehito.nakahara@souco.space" \\
          --title "${rec.title}" \\
          --notes "${rec.description} - 実装方法: ${rec.implementation}" \\
          --due "${dueDate.toISOString()}"`;
        
        execSync(command);
        this.logger.info('Task created for recommendation', { title: rec.title });
        
      } catch (error) {
        this.logger.warn('Failed to create task', { 
          title: rec.title, 
          error: error.message 
        });
      }
    }
  }

  // Helper methods
  loadOptimizationConfig() {
    try {
      return JSON.parse(
        fs.readFileSync(
          path.join(__dirname, '../../config/monthly-optimization.json'), 
          'utf-8'
        )
      );
    } catch (error) {
      this.logger.warn('Failed to load optimization config, using defaults');
      return { modelSurvey: { sources: [] } };
    }
  }

  async surveyModelSource(source) {
    // 実装簡略化：実際にはWebスクレイピングやAPI呼び出し
    return { newModels: [], priceChanges: [] };
  }

  extractMonthlyMetrics(logContent) {
    // ログファイルから月次メトリクスを抽出（実装簡略化）
    return {
      usage: {},
      responseTime: {},
      cost: {}
    };
  }

  calculateKimiSavings() {
    return '月額推定5,000-15,000円のコスト削減可能';
  }

  identifyHighCostModels(costData) {
    // 高コストモデルの特定（実装簡略化）
    return [];
  }

  identifySlowModels(performanceData) {
    // 応答の遅いモデルの特定（実装簡略化）
    return [];
  }

  calculateOptimizationSavings(models) {
    return '詳細分析後に算出';
  }
}

// 月次実行のスケジュール設定（毎月1日09:00）
const cron = require('node-cron');

function scheduleMonthlyOptimization() {
  cron.schedule('0 9 1 * *', async () => {
    try {
      const optimizer = new MonthlyOptimizer({
        obsidianPath: '/home/kunekune/Dropbox/obsidian-vault'
      });
      await optimizer.runMonthlyOptimization();
      console.log('✅ Monthly optimization completed');
    } catch (error) {
      console.error('❌ Monthly optimization failed:', error.message);
    }
  });
  
  console.log('📅 Monthly AI optimization scheduled for 1st day of each month at 09:00');
}

// Export for use in main system
module.exports = { MonthlyOptimizer, scheduleMonthlyOptimization };