const moment = require('moment');
const fs = require('fs-extra');
const path = require('path');
const winston = require('winston');

class EmotionalContextEngine {
  constructor(obsidianPath) {
    this.obsidianPath = obsidianPath;
    this.emotionHistory = new Map(); // ユーザーの感情履歴
    this.contextMemory = new Map();  // コンテキスト記憶
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/emotion-engine.log' }),
        new winston.transports.Console()
      ]
    });
    
    // 感情パターンをロード
    this.loadEmotionPatterns();
  }

  /**
   * ユーザーの現在の感情状態を総合分析
   */
  async analyzeCurrentEmotionalState(message, timestamp = new Date()) {
    const analysis = {
      timestamp: timestamp.toISOString(),
      textualEmotion: this.analyzeTextEmotion(message),
      temporalContext: this.analyzeTemporalContext(timestamp),
      historicalPattern: await this.getHistoricalEmotionalPattern(timestamp),
      environmentalFactors: await this.analyzeEnvironmentalFactors(timestamp),
      stressIndicators: this.detectStressIndicators(message),
      energyLevel: this.estimateEnergyLevel(message, timestamp)
    };

    // 総合的な感情スコア算出
    const consolidatedState = this.consolidateEmotionalState(analysis);
    
    // 履歴に記録
    this.emotionHistory.set(timestamp.toISOString(), consolidatedState);
    
    // Obsidianに記録
    await this.recordEmotionalState(consolidatedState, timestamp);

    this.logger.info('Emotional state analyzed', {
      consolidatedState: consolidatedState.primaryEmotion,
      confidence: consolidatedState.confidence,
      recommendations: consolidatedState.adaptationRecommendations.length
    });

    return consolidatedState;
  }

  /**
   * テキストからの感情分析
   */
  analyzeTextEmotion(message) {
    const emotionPatterns = {
      joy: {
        patterns: /嬉しい|楽しい|最高|やった|良い|成功|達成|満足|幸せ|ワクワク/g,
        weight: 1.0
      },
      sadness: {
        patterns: /悲しい|辛い|落ち込|泣|残念|失望|寂し|憂鬱/g,
        weight: 1.0
      },
      anger: {
        patterns: /怒り|イライラ|ムカつく|腹立|不満|憤|怒|クソ/g,
        weight: 1.2
      },
      fear: {
        patterns: /怖い|不安|心配|恐れ|緊張|ビビ|ドキドキ|震/g,
        weight: 1.1
      },
      fatigue: {
        patterns: /疲れ|つかれ|だるい|眠い|しんどい|きつい|限界|もうダメ/g,
        weight: 1.3
      },
      stress: {
        patterns: /ストレス|忙しい|急|大変|追われ|余裕ない|パンク|オーバーワーク/g,
        weight: 1.2
      },
      excitement: {
        patterns: /興奮|テンション|燃える|やる気|モチベーション|エネルギッシュ/g,
        weight: 1.0
      },
      calm: {
        patterns: /落ち着|平穏|リラックス|穏やか|静か|安らか|余裕/g,
        weight: 0.8
      }
    };

    const results = {};
    let totalScore = 0;

    for (const [emotion, config] of Object.entries(emotionPatterns)) {
      const matches = (message.match(config.patterns) || []).length;
      const score = matches * config.weight;
      results[emotion] = {
        matches,
        score,
        intensity: Math.min(score / 3, 1.0) // 0-1に正規化
      };
      totalScore += score;
    }

    // 感情の強度を相対化
    if (totalScore > 0) {
      for (const emotion in results) {
        results[emotion].relative = results[emotion].score / totalScore;
      }
    }

    return {
      emotions: results,
      dominantEmotion: this.findDominantEmotion(results),
      emotionIntensity: Math.min(totalScore / 5, 1.0),
      neutrality: totalScore === 0 ? 1.0 : Math.max(0, 1 - totalScore / 10)
    };
  }

  /**
   * 時間的コンテキストの分析
   */
  analyzeTemporalContext(timestamp) {
    const hour = timestamp.getHours();
    const day = timestamp.getDay();
    const month = timestamp.getMonth();
    
    return {
      timeOfDay: this.categorizeTimeOfDay(hour),
      weekday: this.categorizeWeekday(day),
      season: this.categorizeSeason(month),
      biorhythm: this.estimateBiorhythm(hour, day),
      workingHours: this.isWorkingHours(hour, day),
      socialContext: this.getSocialContext(hour, day)
    };
  }

  /**
   * 過去の感情パターンを分析
   */
  async getHistoricalEmotionalPattern(currentTime) {
    // 過去7日間の同時間帯の感情を分析
    const patterns = {
      same_time_pattern: await this.getSameTimePattern(currentTime),
      daily_trend: await this.getDailyTrend(),
      weekly_pattern: await this.getWeeklyPattern(),
      stress_accumulation: await this.getStressAccumulation()
    };

    return patterns;
  }

  /**
   * 環境要因の分析
   */
  async analyzeEnvironmentalFactors(timestamp) {
    // カレンダーイベント、メール量、外部ストレス要因など
    const factors = {
      calendarPressure: await this.analyzeCalendarPressure(timestamp),
      communicationLoad: await this.analyzeCommunicationLoad(timestamp),
      projectDeadlines: await this.analyzeProjectDeadlines(timestamp),
      weatherImpact: this.estimateWeatherImpact(timestamp), // 実装時は天気APIと連携
      seasonalAffect: this.getSeasonalAffectFactor(timestamp.getMonth())
    };

    return factors;
  }

  /**
   * ストレス指標の検出
   */
  detectStressIndicators(message) {
    const indicators = {
      urgency: /急|すぐ|今すぐ|至急|緊急|早く/.test(message),
      overwhelm: /もう|限界|無理|できない|だめ|パンク/.test(message),
      timesPressure: /時間|間に合わ|遅れ|締切|デッドライン/.test(message),
      multipleTasks: message.split(/と|、|も/).length > 3,
      negativeLanguage: /ダメ|悪い|最悪|ひどい|やばい/.test(message),
      repetitiveThoughts: this.detectRepetitivePatterns(message)
    };

    const stressScore = Object.values(indicators).filter(Boolean).length / Object.keys(indicators).length;
    
    return {
      indicators,
      stressLevel: stressScore,
      category: this.categorizeStressLevel(stressScore)
    };
  }

  /**
   * エネルギーレベルの推定
   */
  estimateEnergyLevel(message, timestamp) {
    const hour = timestamp.getHours();
    
    // 時間帯による基礎エネルギー
    let baseEnergy = 0.5;
    if (hour >= 6 && hour < 10) baseEnergy = 0.8;      // 朝
    else if (hour >= 10 && hour < 14) baseEnergy = 0.9; // 午前中
    else if (hour >= 14 && hour < 16) baseEnergy = 0.6; // 昼下がり
    else if (hour >= 16 && hour < 20) baseEnergy = 0.7; // 夕方
    else if (hour >= 20 && hour < 23) baseEnergy = 0.5; // 夜
    else baseEnergy = 0.2; // 深夜早朝

    // メッセージ内容による調整
    const energyIndicators = {
      high: /やる気|元気|エネルギー|頑張|積極|活動的|テンション高|燃える/g,
      low: /疲れ|だるい|眠い|無気力|やる気でない|しんどい|きつい/g
    };

    const highMatches = (message.match(energyIndicators.high) || []).length;
    const lowMatches = (message.match(energyIndicators.low) || []).length;
    
    const adjustment = (highMatches * 0.2) - (lowMatches * 0.3);
    const finalEnergy = Math.max(0, Math.min(1, baseEnergy + adjustment));

    return {
      base: baseEnergy,
      adjustment,
      final: finalEnergy,
      category: this.categorizeEnergyLevel(finalEnergy)
    };
  }

  /**
   * 感情状態の統合・決定
   */
  consolidateEmotionalState(analysis) {
    const weights = {
      textual: 0.4,
      temporal: 0.2,
      historical: 0.2,
      environmental: 0.1,
      stress: 0.1
    };

    // 主要感情の決定
    const primaryEmotion = analysis.textualEmotion.dominantEmotion || 'neutral';
    
    // 信頼度の算出
    const confidence = this.calculateConfidence(analysis);
    
    // 適応推奨事項の生成
    const adaptationRecommendations = this.generateAdaptationRecommendations(analysis);

    return {
      primaryEmotion,
      secondaryEmotions: this.getSecondaryEmotions(analysis),
      confidence,
      stressLevel: analysis.stressIndicators.category,
      energyLevel: analysis.energyLevel.category,
      adaptationRecommendations,
      responseStyle: this.determineResponseStyle(analysis),
      urgencyLevel: this.determineUrgencyLevel(analysis),
      supportNeeded: this.assessSupportNeeded(analysis),
      timestamp: analysis.timestamp
    };
  }

  /**
   * 応答スタイルの決定
   */
  determineResponseStyle(analysis) {
    const emotion = analysis.textualEmotion.dominantEmotion;
    const stress = analysis.stressIndicators.stressLevel;
    const energy = analysis.energyLevel.final;
    const hour = new Date(analysis.timestamp).getHours();

    // 基本スタイル決定ロジック
    if (stress > 0.7) return 'calming';
    if (energy < 0.3 || hour > 22 || hour < 6) return 'gentle';
    if (emotion === 'excitement' && energy > 0.7) return 'energetic';
    if (analysis.temporalContext.workingHours) return 'professional';
    if (analysis.temporalContext.weekday === 'weekend') return 'relaxed';
    
    return 'balanced';
  }

  /**
   * 適応推奨事項の生成
   */
  generateAdaptationRecommendations(analysis) {
    const recommendations = [];
    
    // ストレスレベルに応じた推奨
    if (analysis.stressIndicators.stressLevel > 0.6) {
      recommendations.push({
        type: 'stress_management',
        priority: 'high',
        action: 'provide_calming_response',
        reason: 'High stress indicators detected'
      });
    }

    // エネルギーレベルに応じた推奨
    if (analysis.energyLevel.final < 0.3) {
      recommendations.push({
        type: 'energy_conservation',
        priority: 'medium',
        action: 'minimize_cognitive_load',
        reason: 'Low energy level detected'
      });
    }

    // 時間的コンテキストに応じた推奨
    const hour = new Date(analysis.timestamp).getHours();
    if (hour > 22) {
      recommendations.push({
        type: 'circadian_respect',
        priority: 'medium', 
        action: 'suggest_rest_focus',
        reason: 'Late night timing detected'
      });
    }

    return recommendations;
  }

  // Obsidian記録
  async recordEmotionalState(state, timestamp) {
    try {
      const dailyNotePath = path.join(
        this.obsidianPath,
        '00-Inbox',
        `daily-emotions-${moment(timestamp).format('YYYY-MM-DD')}.md`
      );

      const record = `## ${moment(timestamp).format('HH:mm')} - Emotional State
- **Primary Emotion**: ${state.primaryEmotion}
- **Energy Level**: ${state.energyLevel}
- **Stress Level**: ${state.stressLevel}
- **Response Style**: ${state.responseStyle}
- **Confidence**: ${Math.round(state.confidence * 100)}%

`;

      await fs.appendFile(dailyNotePath, record);
    } catch (error) {
      this.logger.error('Failed to record emotional state', { error: error.message });
    }
  }

  // Helper methods
  findDominantEmotion(emotions) {
    let maxEmotion = 'neutral';
    let maxScore = 0;
    
    for (const [emotion, data] of Object.entries(emotions)) {
      if (data.score > maxScore) {
        maxScore = data.score;
        maxEmotion = emotion;
      }
    }
    
    return maxScore > 0.1 ? maxEmotion : 'neutral';
  }

  categorizeTimeOfDay(hour) {
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 22) return 'evening';
    return 'night';
  }

  categorizeWeekday(day) {
    if (day === 1) return 'monday';
    if (day === 5) return 'friday';
    if (day === 0 || day === 6) return 'weekend';
    return 'weekday';
  }

  categorizeStressLevel(score) {
    if (score > 0.7) return 'high';
    if (score > 0.4) return 'medium';
    return 'low';
  }

  categorizeEnergyLevel(level) {
    if (level > 0.7) return 'high';
    if (level > 0.4) return 'medium';
    return 'low';
  }

  calculateConfidence(analysis) {
    // 複数の分析結果の一貫性から信頼度を算出
    const factors = [
      analysis.textualEmotion.emotionIntensity,
      1 - analysis.textualEmotion.neutrality,
      analysis.energyLevel.final
    ];
    
    return factors.reduce((sum, factor) => sum + factor, 0) / factors.length;
  }

  loadEmotionPatterns() {
    // 感情パターンの学習データをロード
    // 実装時は過去のデータから学習
  }

  // 以下、詳細実装は必要に応じて追加
  async getSameTimePattern(time) { return {}; }
  async getDailyTrend() { return {}; }
  async getWeeklyPattern() { return {}; }
  async getStressAccumulation() { return {}; }
  async analyzeCalendarPressure(time) { return 0; }
  async analyzeCommunicationLoad(time) { return 0; }
  async analyzeProjectDeadlines(time) { return 0; }
  estimateWeatherImpact(time) { return 0; }
  getSeasonalAffectFactor(month) { return 0; }
  detectRepetitivePatterns(message) { return false; }
  getSecondaryEmotions(analysis) { return []; }
  determineUrgencyLevel(analysis) { return 'normal'; }
  assessSupportNeeded(analysis) { return false; }
  isWorkingHours(hour, day) { return hour >= 9 && hour < 18 && day >= 1 && day <= 5; }
  getSocialContext(hour, day) { return 'normal'; }
  estimateBiorhythm(hour, day) { return 0.5; }
  categorizeSeason(month) { 
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer'; 
    if (month >= 8 && month <= 10) return 'autumn';
    return 'winter';
  }
}

module.exports = EmotionalContextEngine;