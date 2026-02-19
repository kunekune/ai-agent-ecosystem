const axios = require('axios');
const winston = require('winston');
const { withRetry } = require('../utils/api-retry');

class DeepSeekHandler {
  constructor(apiKey, baseUrl) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl || 'https://api.deepseek.com';
    this.model = 'deepseek-chat'; // コスト効率最優先モデル
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/deepseek-handler.log' }),
        new winston.transports.Console()
      ]
    });
  }

  /**
   * 軽量・高速タスクを実行
   */
  async processLightweightTask(request) {
    const { message, context, taskType } = request;
    const systemPrompt = this.buildLightweightPrompt(taskType, context);

    try {
      const response = await withRetry(() =>
        axios.post(`${this.baseUrl}/v1/chat/completions`, {
          model: this.model,
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: message
            }
          ],
          temperature: 0.1, // 事務作業は安定性重視
          max_tokens: 1000,
          stream: false
        }, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        })
      );

      const result = {
        content: response.data.choices[0].message.content,
        model: this.model,
        tokens: {
          input: response.data.usage?.prompt_tokens || 0,
          output: response.data.usage?.completion_tokens || 0,
          total: response.data.usage?.total_tokens || 0
        },
        cost: this.calculateCost(response.data.usage?.total_tokens || 0),
        timestamp: new Date().toISOString()
      };

      this.logger.info('DeepSeek lightweight task completed', {
        taskType,
        tokenUsage: result.tokens,
        cost: result.cost
      });

      return result;

    } catch (error) {
      // DeepSeekは最下位フォールバック。エラーをそのままthrow。
      this.logger.error('DeepSeek handler error (no further fallback)', {
        error: error.message,
        response: error.response?.data
      });
      throw error;
    }
  }

  /**
   * 大量ログの構造化処理
   */
  async structureLargeData(request) {
    const { data, outputFormat, categories } = request;
    
    // 大量データを分割処理
    const chunks = this.chunkData(data, 5000); // 5000文字ずつ分割
    const processedChunks = [];

    for (const chunk of chunks) {
      const result = await this.processLightweightTask({
        message: `以下のデータを指定された形式で構造化してください:\n\n${chunk}`,
        context: { outputFormat, categories },
        taskType: 'structure'
      });
      
      processedChunks.push(result.content);
    }

    // 結果を統合
    const finalResult = await this.processLightweightTask({
      message: `以下の分割処理結果を統合し、最終的な構造化データを作成してください:\n\n${processedChunks.join('\n---\n')}`,
      context: { outputFormat, categories },
      taskType: 'integrate'
    });

    return finalResult;
  }

  /**
   * 日次ログの要約作成
   */
  async createDailySummary(request) {
    const { dailyLogs, summaryType, focusAreas } = request;
    
    const systemPrompt = `あなたは効率的なログ要約の専門家です。
大量の日次ログから重要なポイントを抽出し、読みやすい要約を作成してください。

要約タイプ: ${summaryType}
注目エリア: ${focusAreas.join(', ')}

出力形式:
1. 重要な出来事・決定事項
2. タスクの進捗状況
3. 感情・体調の変化
4. 明日への引き継ぎ事項
5. 学び・気づき`;

    return await this.processLightweightTask({
      message: `以下の日次ログを要約してください:\n\n${JSON.stringify(dailyLogs, null, 2)}`,
      context: { summaryType, focusAreas },
      taskType: 'summary'
    });
  }

  /**
   * 簡単な事実抽出
   */
  async extractFactsFromText(request) {
    const { text, factTypes, outputFormat } = request;
    
    const systemPrompt = `あなたは事実抽出の専門家です。
テキストから指定された種類の事実情報を正確に抽出してください。

抽出対象: ${factTypes.join(', ')}
出力形式: ${outputFormat}

正確性を最優先とし、推測や解釈は含めないでください。`;

    return await this.processLightweightTask({
      message: `以下のテキストから事実情報を抽出してください:\n\n${text}`,
      context: { factTypes, outputFormat },
      taskType: 'extract'
    });
  }

  /**
   * Discordメッセージの初期分類
   */
  async classifyDiscordMessage(request) {
    const { message, availableCategories, userContext } = request;
    
    const systemPrompt = `あなたはメッセージ分類の専門家です。
Discordメッセージを適切なカテゴリに分類し、必要な前処理を実行してください。

利用可能カテゴリ: ${availableCategories.join(', ')}

出力形式:
{
  "category": "分類結果",
  "priority": "low|medium|high",
  "actionRequired": true|false,
  "suggestedModel": "deepseek-v3|glm-4.7|claude-opus",
  "extractedInfo": {
    "keywords": [],
    "entities": [],
    "emotion": "",
    "urgency": ""
  }
}`;

    return await this.processLightweightTask({
      message: `以下のDiscordメッセージを分類してください:\n\n"${message}"`,
      context: { availableCategories, userContext },
      taskType: 'classify'
    });
  }

  /**
   * Obsidian形式のデータ変換
   */
  async convertToObsidianFormat(request) {
    const { rawData, targetSection, linkReferences } = request;
    
    const systemPrompt = `あなたはObsidian形式変換の専門家です。
生データをObsidian Markdownに変換し、適切なリンクと構造を作成してください。

対象セクション: ${targetSection}
リンク参照: ${linkReferences}

Obsidianの記法:
- [[Page Link]] 形式でのリンク
- タグは #tag 形式
- Daily Notesの場合は日付ヘッダーを使用
- 適切な階層構造を維持`;

    return await this.processLightweightTask({
      message: `以下のデータをObsidian形式に変換してください:\n\n${JSON.stringify(rawData, null, 2)}`,
      context: { targetSection, linkReferences },
      taskType: 'obsidian'
    });
  }

  // Private methods
  chunkData(data, chunkSize) {
    const text = typeof data === 'string' ? data : JSON.stringify(data);
    const chunks = [];
    
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.slice(i, i + chunkSize));
    }
    
    return chunks;
  }

  calculateCost(tokens) {
    // DeepSeekの料金体系（例: $0.0014 / 1K tokens）
    const costPer1KTokens = 0.0014;
    return (tokens / 1000) * costPer1KTokens;
  }

  buildLightweightPrompt(taskType, context) {
    const basePrompt = `あなたは高効率な事務処理AIです。正確性と速度を両立し、コスト効率を重視して作業を実行します。`;
    
    const taskPrompts = {
      'structure': '構造化データ処理の専門家として、入力データを指定された形式に整理してください。',
      'summary': '要約作成の専門家として、重要ポイントを漏らさず簡潔にまとめてください。',
      'extract': '事実抽出の専門家として、正確な情報のみを抽出してください。推測は含めないでください。',
      'classify': 'メッセージ分類の専門家として、適切なカテゴリと優先度を判定してください。',
      'obsidian': 'Obsidian形式変換の専門家として、適切なMarkdown構造を作成してください。',
      'integrate': 'データ統合の専門家として、分割された結果を一貫性を保って統合してください。',
      'quick': '高速応答の専門家として、簡潔で要点を押さえた回答をしてください。'
    };

    let fullPrompt = basePrompt;
    
    if (taskType && taskPrompts[taskType]) {
      fullPrompt += '\n\n' + taskPrompts[taskType];
    }

    if (context) {
      fullPrompt += `\n\nコンテキスト情報:\n${JSON.stringify(context, null, 2)}`;
    }

    fullPrompt += '\n\n効率性と正確性を両立した簡潔な処理を心がけてください。';

    return fullPrompt;
  }
}

module.exports = DeepSeekHandler;