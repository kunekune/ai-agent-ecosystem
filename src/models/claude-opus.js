const Anthropic = require('@anthropic-ai/sdk');
const winston = require('winston');
const { withRetry } = require('../utils/api-retry');

class ClaudeOpusHandler {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.client = new Anthropic({
      apiKey: apiKey
    });
    this.model = 'claude-3-5-sonnet-20241022'; // 最新モデル使用
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/claude-opus.log' }),
        new winston.transports.Console()
      ]
    });
  }

  /**
   * 高度な推論・創作タスクを実行
   */
  async processHighComplexityTask(request) {
    const { message, context, emotionalState, taskType } = request;
    const systemPrompt = this.buildSystemPrompt(taskType, emotionalState, context);

    try {
      const response = await withRetry(() =>
        this.client.messages.create({
          model: this.model,
          max_tokens: 4000,
          temperature: taskType === 'creative' ? 0.8 : 0.3,
          system: systemPrompt,
          messages: [{
            role: 'user',
            content: message
          }]
        })
      );

      const result = {
        content: response.content[0].text,
        model: this.model,
        tokens: {
          input: response.usage?.input_tokens || 0,
          output: response.usage?.output_tokens || 0,
          total: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
        },
        emotionalAdaptation: emotionalState,
        timestamp: new Date().toISOString()
      };

      this.logger.info('Claude Opus task completed', {
        taskType,
        tokenUsage: result.tokens,
        emotionalState: emotionalState?.recommended
      });

      return result;

    } catch (error) {
      this.logger.warn('Claude Opus all retries failed, falling back to ClaudeSonnet', {
        error: error.message,
        fallback_triggered: true,
        reason: error.type || error.code || 'api_error'
      });

      // フォールバック: ClaudeSonnetHandlerで再試行
      const ClaudeSonnetHandler = require('./claude-sonnet');
      const fallbackHandler = new ClaudeSonnetHandler(this.apiKey);
      const result = await fallbackHandler.processWritingTask(request);

      this.logger.info('Fallback to ClaudeSonnet succeeded', {
        fallback_triggered: true,
        reason: error.type || error.code || 'api_error'
      });

      return result;
    }
  }

  /**
   * 個人化されたブログ記事生成
   */
  async generatePersonalizedBlog(request) {
    const { thoughts, values, style, previousArticles } = request;
    
    const systemPrompt = `あなたは優秀なゴーストライターです。ユーザーの思考パターン、価値観、文体を完璧に理解し、そのユーザーらしい記事を書きます。

# ユーザーの価値観プロファイル
${JSON.stringify(values, null, 2)}

# ユーザーの文体的特徴
${JSON.stringify(style, null, 2)}

# 参考となる過去記事（トーン参考用）
${previousArticles}

# 今回の記事化対象の思考データ
${JSON.stringify(thoughts, null, 2)}

指示：
1. ユーザーの価値観を自然に反映させた記事を書いてください
2. ユーザーの文体・トーンを維持してください  
3. 思考データを整理し、読みやすい構成にしてください
4. SEOを考慮しつつ、個性を失わないでください
5. 2000-3000文字程度で執筆してください`;

    return await this.processHighComplexityTask({
      message: '上記の思考データから、私らしいブログ記事を書いてください。',
      context: { thoughts, values, style },
      taskType: 'creative',
      emotionalState: { recommended: 'creative' }
    });
  }

  /**
   * 深い自己分析・価値観抽出
   */
  async analyzeUserValues(thoughtHistory) {
    const systemPrompt = `あなたはユーザーの価値観を深く分析する心理アナリストです。
日々の思考記録から、ユーザーの核となる価値観、思考パターン、行動傾向を抽出してください。

分析観点：
1. 核心的価値観（最も大切にしていること）
2. 思考パターン（どのように物事を考えるか）
3. 感情的傾向（どんな状況で何を感じやすいか）
4. 行動特性（どのような行動を取りがちか）
5. 成長・変化の方向性

出力形式：JSON形式で、各観点について具体例と共に記述してください。`;

    return await this.processHighComplexityTask({
      message: `以下の思考履歴を分析し、私の価値観プロファイルを作成してください:\n\n${JSON.stringify(thoughtHistory, null, 2)}`,
      context: { analysisType: 'values' },
      taskType: 'analysis',
      emotionalState: { recommended: 'analytical' }
    });
  }

  /**
   * 予測的提案生成
   */
  async generateProactiveSuggestions(userPatterns, currentContext) {
    const systemPrompt = `あなたはユーザーのパターンを学習した予測アシスタントです。
ユーザーの行動パターンと現在の状況から、役立つ提案を生成してください。

提案の種類：
1. タスク・スケジュール提案
2. 創作・アウトプット提案  
3. 健康・生活改善提案
4. 学習・成長提案

提案は具体的で実行可能なものにし、押し付けがましくない自然なトーンで。`;

    return await this.processHighComplexityTask({
      message: `現在の状況とパターンから、私に合った提案をしてください。\n\nパターン: ${JSON.stringify(userPatterns)}\n\n現在状況: ${JSON.stringify(currentContext)}`,
      context: { userPatterns, currentContext },
      taskType: 'prediction',
      emotionalState: { recommended: 'helpful' }
    });
  }

  // Private methods
  buildSystemPrompt(taskType, emotionalState, context) {
    const basePrompt = `あなたは非常に優秀なAIアシスタントです。ユーザーの外部脳として機能し、思考を整理し、価値観を反映した応答をします。`;
    
    const emotionalPrompts = {
      'tired': '今ユーザーは疲れているようです。優しく、簡潔に、負担にならないように応答してください。',
      'stressed': 'ユーザーはストレスを感じているようです。落ち着いた、解決策重視の応答をしてください。',
      'excited': 'ユーザーは興奮・高揚状態です。そのエネルギーを活かす建設的な応答をしてください。',
      'focused': 'ユーザーは集中モードです。効率的で要点を押さえた応答をしてください。'
    };

    const taskPrompts = {
      'creative': '創造的思考を活かし、独創的で魅力的な内容を生成してください。',
      'analysis': '深く分析的に考察し、洞察に富んだ回答をしてください。', 
      'practical': '実用的で即座に行動できる具体的な回答をしてください。'
    };

    let fullPrompt = basePrompt;
    
    if (emotionalState?.recommended && emotionalPrompts[emotionalState.recommended]) {
      fullPrompt += '\n\n' + emotionalPrompts[emotionalState.recommended];
    }
    
    if (taskType && taskPrompts[taskType]) {
      fullPrompt += '\n\n' + taskPrompts[taskType];
    }

    return fullPrompt;
  }
}

module.exports = ClaudeOpusHandler;