const Anthropic = require('@anthropic-ai/sdk');
const winston = require('winston');
const { withRetry } = require('../utils/api-retry');

class ClaudeSonnetHandler {
  constructor(apiKey) {
    this.client = new Anthropic({
      apiKey: apiKey
    });
    this.model = 'claude-3-5-sonnet-20241022'; // 執筆官用モデル
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/claude-sonnet.log' }),
        new winston.transports.Console()
      ]
    });
  }

  /**
   * L4: 執筆官としての文章作成タスクを実行
   */
  async processWritingTask(request) {
    const { message, context, emotionalState, taskType } = request;
    const systemPrompt = this.buildWritingPrompt(taskType, emotionalState, context);

    try {
      const response = await withRetry(() =>
        this.client.messages.create({
          model: this.model,
          max_tokens: 3000,
          temperature: taskType === 'creative' ? 0.7 : 0.4, // 執筆官は適度な創造性
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
        level: 'L4 (執筆官)',
        tokens: {
          input: response.usage?.input_tokens || 0,
          output: response.usage?.output_tokens || 0,
          total: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
        },
        emotionalAdaptation: emotionalState,
        timestamp: new Date().toISOString()
      };

      this.logger.info('Claude Sonnet writing task completed', {
        taskType,
        tokenUsage: result.tokens,
        emotionalState: emotionalState?.recommended,
        level: 'L4'
      });

      return result;

    } catch (error) {
      this.logger.warn('Claude Sonnet all retries failed, falling back to GLM', {
        error: error.message,
        fallback_triggered: true,
        reason: error.type || error.code || 'api_error'
      });

      // フォールバック: GLMHandlerで再試行
      const GLMHandler = require('./glm-handler');
      const fallbackHandler = new GLMHandler(process.env.GLM_API_KEY);
      const result = await fallbackHandler.processBusinessTask(request);

      this.logger.info('Fallback to GLM succeeded', {
        fallback_triggered: true,
        reason: error.type || error.code || 'api_error'
      });

      return {
        ...result,
        level: 'L3 (秘書) [fallback]'
      };
    }
  }

  /**
   * ブログ初稿作成
   */
  async createBlogDraft(request) {
    const { topic, style, targetAudience, keyPoints, sources } = request;
    
    const systemPrompt = `あなたは優秀な執筆官として、ブログの初稿を作成します。

# 執筆方針
- 読みやすく構造化された文章
- ターゲット読者を意識した内容  
- SEOを考慮しつつ自然な文体
- 情報の正確性と魅力的な表現の両立

# 今回の執筆条件
対象読者: ${targetAudience}
文体・スタイル: ${style}
重要ポイント: ${keyPoints?.join(', ')}
参考情報: ${sources ? JSON.stringify(sources) : 'なし'}

構成要素:
1. 魅力的な導入
2. 論理的な本文（2-3セクション）
3. 具体例・体験談の組み込み
4. 行動喚起のある結論

2000-2500文字程度で執筆してください。`;

    return await this.processWritingTask({
      message: `以下のトピックでブログ初稿を作成してください: ${topic}`,
      context: { topic, style, targetAudience, keyPoints },
      taskType: 'blog_draft',
      emotionalState: { recommended: 'focused' }
    });
  }

  /**
   * 複雑な文章作成（レポート、プレゼン資料等）
   */
  async createComplexDocument(request) {
    const { documentType, purpose, audience, data, format } = request;
    
    const systemPrompt = `あなたは文書作成のプロフェッショナルです。
指定された目的と読者に最適化された${documentType}を作成してください。

目的: ${purpose}
対象読者: ${audience}
出力形式: ${format}

文書作成の原則:
1. 目的に応じた適切な構造
2. 読者の理解レベルに合わせた説明
3. データの効果的な可視化・表現
4. アクションにつながる具体性

専門性と分かりやすさを両立させてください。`;

    return await this.processWritingTask({
      message: `以下のデータを基に${documentType}を作成してください:\n\n${JSON.stringify(data, null, 2)}`,
      context: { documentType, purpose, audience, format },
      taskType: 'complex_document',
      emotionalState: { recommended: 'professional' }
    });
  }

  /**
   * メール返信案作成
   */
  async createEmailReply(request) {
    const { originalEmail, replyPurpose, tone, keyMessages, constraints } = request;
    
    const systemPrompt = `あなたはビジネスコミュニケーションの専門家です。
適切なトーンと内容でメール返信案を作成してください。

返信の目的: ${replyPurpose}
望ましいトーン: ${tone}
必須メッセージ: ${keyMessages?.join(', ')}
制約事項: ${constraints || 'なし'}

メール作成の原則:
1. 明確で簡潔な表現
2. 相手への配慮と敬意
3. 必要な情報の網羅  
4. 次のアクションの明確化

適切なビジネスマナーを保ちつつ、効果的な返信を作成してください。`;

    return await this.processWritingTask({
      message: `以下のメールへの返信案を作成してください:\n\n${originalEmail}`,
      context: { replyPurpose, tone, keyMessages },
      taskType: 'email_reply',
      emotionalState: { recommended: 'professional' }
    });
  }

  /**
   * 記事編集・改善
   */
  async improveArticle(request) {
    const { originalArticle, improvementAreas, targetQuality, styleGuide } = request;
    
    const systemPrompt = `あなたは記事編集の専門家です。
提供された記事を指定された観点で改善してください。

改善重点エリア: ${improvementAreas?.join(', ')}
目標品質レベル: ${targetQuality}
スタイルガイド: ${styleGuide || '一般的なWebライティング'}

改善の観点:
1. 構造と論理的流れの最適化
2. 表現の明確化と魅力度向上
3. SEO要素の強化
4. 読者エンゲージメントの向上

元記事の良い部分は活かしつつ、全体的な品質向上を図ってください。`;

    return await this.processWritingTask({
      message: `以下の記事を改善してください:\n\n${originalArticle}`,
      context: { improvementAreas, targetQuality, styleGuide },
      taskType: 'article_improvement',
      emotionalState: { recommended: 'analytical' }
    });
  }

  /**
   * 創作的文章生成
   */
  async createCreativeContent(request) {
    const { contentType, theme, mood, constraints, inspiration } = request;
    
    const systemPrompt = `あなたは創造的な文章作成の専門家です。
指定されたテーマとムードで${contentType}を作成してください。

テーマ: ${theme}
求められるムード: ${mood}
制約条件: ${constraints || 'なし'}
インスピレーション: ${inspiration || 'なし'}

創作の方針:
1. テーマの独創的な解釈
2. 読者の感情に響く表現
3. 具体的で生き生きとした描写
4. 記憶に残る印象的な結末

創造性と読みやすさを両立させてください。`;

    return await this.processWritingTask({
      message: `${theme}をテーマに${contentType}を創作してください。`,
      context: { contentType, theme, mood },
      taskType: 'creative_writing',
      emotionalState: { recommended: 'creative' }
    });
  }

  // Private methods
  buildWritingPrompt(taskType, emotionalState, context) {
    const basePrompt = `あなたはL4レベルの執筆官です。高品質な文章作成を専門とし、読者に価値を提供する魅力的なコンテンツを生み出します。`;
    
    const emotionalPrompts = {
      'tired': '疲れているユーザーに配慮し、簡潔で負担の少ない文章を心がけてください。',
      'stressed': 'ストレスを感じているユーザーのために、落ち着いた安心感のある文章を書いてください。',
      'excited': 'ユーザーの興奮を適切に活かし、エネルギッシュで魅力的な文章を作成してください。',
      'focused': 'ユーザーの集中状態を活かし、効率的で要点を押さえた文章を作成してください。'
    };

    const taskPrompts = {
      'blog_draft': '読者に価値を提供する魅力的なブログ記事の初稿を作成してください。SEOと読みやすさを両立させてください。',
      'complex_document': '専門性と分かりやすさを両立した、目的に最適化された文書を作成してください。',
      'email_reply': '適切なビジネスマナーと効果的なコミュニケーションを両立したメール返信を作成してください。',
      'article_improvement': '元記事の良さを活かしつつ、全体的な品質向上を図ってください。',
      'creative_writing': '創造性と読みやすさを両立した、印象に残る作品を創作してください。'
    };

    let fullPrompt = basePrompt;
    
    if (emotionalState?.recommended && emotionalPrompts[emotionalState.recommended]) {
      fullPrompt += '\n\n' + emotionalPrompts[emotionalState.recommended];
    }
    
    if (taskType && taskPrompts[taskType]) {
      fullPrompt += '\n\n' + taskPrompts[taskType];
    }

    if (context) {
      fullPrompt += `\n\nコンテキスト情報:\n${JSON.stringify(context, null, 2)}`;
    }

    return fullPrompt;
  }
}

module.exports = ClaudeSonnetHandler;