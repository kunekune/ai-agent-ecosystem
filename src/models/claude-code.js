const axios = require('axios');
const winston = require('winston');
const { exec } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

class ClaudeCodeHandler {
  constructor(apiKey) {
    this.apiKey = process.env.DEEPSEEK_API_KEY || apiKey;
    this.baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
    this.model = 'deepseek-chat'; // L1: コスト・スピード最優先
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/claude-code.log' }),
        new winston.transports.Console()
      ]
    });
  }

  /**
   * L1: 工兵としてのシステム・技術タスクを実行
   */
  async processSystemTask(request) {
    try {
      const { message, context, taskType, safeMode = true } = request;
      
      const systemPrompt = this.buildSystemPrompt(taskType, context, safeMode);
      
      const response = await axios.post(`${this.baseUrl}/v1/chat/completions`, {
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.1, // システム作業は正確性重視
        max_tokens: 2000,
        stream: false
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const result = {
        content: response.data.choices[0].message.content,
        model: this.model,
        level: 'L1 (工兵)',
        tokens: {
          input: response.data.usage?.prompt_tokens || 0,
          output: response.data.usage?.completion_tokens || 0,
          total: response.data.usage?.total_tokens || 0
        },
        safeMode,
        timestamp: new Date().toISOString()
      };

      this.logger.info('Claude Code system task completed', {
        taskType,
        tokenUsage: result.tokens,
        safeMode,
        level: 'L1'
      });

      return result;

    } catch (error) {
      this.logger.error('Claude Code error', { error: error.message });
      throw error;
    }
  }

  /**
   * Ubuntu設定・システム操作
   */
  async handleUbuntuConfiguration(request) {
    const { operation, target, parameters, dryRun = true } = request;
    
    const systemPrompt = `あなたはUbuntuシステム管理のエキスパートです。
安全で効率的なシステム操作を提供してください。

操作対象: ${target}
実行方式: ${dryRun ? 'ドライラン（安全確認）' : '実際実行'}

Ubuntu操作の原則:
1. セキュリティファーストの操作
2. データ破損リスクの最小化
3. バックアップの推奨
4. 段階的実行の提案

安全性を最優先に、具体的なコマンドと手順を提示してください。`;

    const result = await this.processSystemTask({
      message: `Ubuntu系統で以下の操作を実行したい: ${operation}\nパラメータ: ${JSON.stringify(parameters, null, 2)}`,
      context: { operation, target, parameters },
      taskType: 'ubuntu_config',
      safeMode: dryRun
    });

    // ドライランの場合は実行せず、手順のみ返す
    if (!dryRun && this.isExecutionSafe(result.content)) {
      result.executionResult = await this.executeSystemCommand(result.content);
    }

    return result;
  }

  /**
   * ファイル整理・管理
   */
  async handleFileManagement(request) {
    const { operation, sourcePath, targetPath, pattern, dryRun = true } = request;
    
    const systemPrompt = `あなたはファイル管理のスペシャリストです。
効率的で安全なファイル操作を設計してください。

ファイル操作の原則:
1. データ損失リスクの回避
2. 適切な権限管理
3. バックアップの実施
4. 操作ログの記録

具体的で安全な手順を提示し、リスクがある場合は警告してください。`;

    const result = await this.processSystemTask({
      message: `ファイル${operation}を実行: ${sourcePath} → ${targetPath}\nパターン: ${pattern}`,
      context: { operation, sourcePath, targetPath, pattern },
      taskType: 'file_management',
      safeMode: dryRun
    });

    if (!dryRun) {
      result.executionResult = await this.executeFileOperation(operation, sourcePath, targetPath, pattern);
    }

    return result;
  }

  /**
   * デバッグ・トラブルシューティング
   */
  async handleDebugTask(request) {
    const { errorType, symptoms, logFiles, systemInfo } = request;
    
    const systemPrompt = `あなたはシステムデバッグの専門家です。
問題の原因を特定し、解決策を提示してください。

デバッグアプローチ:
1. 症状の詳細分析
2. ログファイルの解析
3. システム状態の確認
4. 段階的解決策の提示

根本原因の特定と、安全で効果的な解決策を提供してください。`;

    return await this.processSystemTask({
      message: `以下のシステム問題をデバッグしてください:\nエラータイプ: ${errorType}\n症状: ${symptoms}\nログ情報: ${logFiles}\nシステム情報: ${JSON.stringify(systemInfo)}`,
      context: { errorType, symptoms, logFiles, systemInfo },
      taskType: 'debug',
      safeMode: true
    });
  }

  /**
   * コード修正・最適化
   */
  async handleCodeOptimization(request) {
    const { codeContent, language, issues, optimizationGoals } = request;
    
    const systemPrompt = `あなたはコード最適化の専門家です。
提供されたコードを分析し、改善案を提示してください。

最適化の観点:
1. パフォーマンスの向上
2. 可読性の改善  
3. セキュリティの強化
4. メンテナンス性の向上

言語: ${language}
既知の問題: ${issues?.join(', ') || 'なし'}
最適化目標: ${optimizationGoals?.join(', ') || '全般的改善'}

具体的な改善点と修正後のコードを提示してください。`;

    return await this.processSystemTask({
      message: `以下のコードを最適化してください:\n\n\`\`\`${language}\n${codeContent}\n\`\`\``,
      context: { language, issues, optimizationGoals },
      taskType: 'code_optimization',
      safeMode: true
    });
  }

  /**
   * 設定ファイル管理
   */
  async handleConfigurationManagement(request) {
    const { configType, currentConfig, desiredChanges, backupPath } = request;
    
    const systemPrompt = `あなたは設定管理のエキスパートです。
安全で効果的な設定変更を提案してください。

設定管理の原則:
1. 変更前のバックアップ確保
2. 段階的な変更実施
3. 変更内容の文書化
4. ロールバック手順の明確化

設定の種類: ${configType}
希望する変更: ${JSON.stringify(desiredChanges, null, 2)}

安全な変更手順と確認ポイントを提示してください。`;

    const result = await this.processSystemTask({
      message: `設定ファイル(${configType})の変更を実行してください。現在の設定:\n${currentConfig}`,
      context: { configType, desiredChanges, backupPath },
      taskType: 'config_management',
      safeMode: true
    });

    // バックアップ作成
    if (backupPath && currentConfig) {
      await this.createConfigBackup(backupPath, currentConfig, configType);
    }

    return result;
  }

  /**
   * 開発環境セットアップ
   */
  async handleDevEnvironmentSetup(request) {
    const { projectType, requirements, existingSetup } = request;
    
    const systemPrompt = `あなたは開発環境構築の専門家です。
効率的で標準的な開発環境のセットアップ手順を提供してください。

プロジェクト種別: ${projectType}
要件: ${requirements?.join(', ') || 'なし'}
既存セットアップ: ${existingSetup || 'なし'}

セットアップの要素:
1. 必要なツール・ライブラリのインストール
2. 設定ファイルの作成
3. ディレクトリ構造の構築
4. 初期テストの実行

ベストプラクティスに従った手順を提示してください。`;

    return await this.processSystemTask({
      message: `${projectType}プロジェクトの開発環境をセットアップしてください。`,
      context: { projectType, requirements, existingSetup },
      taskType: 'dev_setup',
      safeMode: true
    });
  }

  // Private methods
  buildSystemPrompt(taskType, context, safeMode) {
    const basePrompt = `あなたはL1レベルの工兵です。システム管理、ファイル操作、デバッグ作業を専門とし、安全で効率的な技術的解決策を提供します。`;
    
    const safetyPrompt = safeMode ? 
      '\n\n⚠️ セーフモード: 実際の実行は行わず、手順と確認事項のみ提示してください。' :
      '\n\n⚠️ 実行モード: 慎重に検証してから実行してください。';

    const taskPrompts = {
      'ubuntu_config': 'Ubuntu系統システムの安全な設定変更を提案してください。',
      'file_management': 'データ損失リスクを最小化したファイル操作を設計してください。',
      'debug': '体系的なデバッグアプローチで問題を解決してください。',
      'code_optimization': 'パフォーマンス・可読性・セキュリティを向上させてください。',
      'config_management': 'バックアップと段階的変更を重視した設定管理を提供してください。',
      'dev_setup': 'ベストプラクティスに従った開発環境構築を支援してください。'
    };

    let fullPrompt = basePrompt + safetyPrompt;
    
    if (taskType && taskPrompts[taskType]) {
      fullPrompt += '\n\n' + taskPrompts[taskType];
    }

    if (context) {
      fullPrompt += `\n\nコンテキスト:\n${JSON.stringify(context, null, 2)}`;
    }

    fullPrompt += '\n\n安全性と正確性を最優先に作業してください。';

    return fullPrompt;
  }

  isExecutionSafe(content) {
    // 危険なコマンドをチェック
    const dangerousPatterns = [
      /rm\s+-rf\s+\/(?!tmp|var\/tmp)/,
      /dd\s+.*\/dev\/sd/,
      /mkfs/,
      /fdisk/,
      /cfdisk/,
      /parted/
    ];

    return !dangerousPatterns.some(pattern => pattern.test(content));
  }

  async executeSystemCommand(command) {
    return new Promise((resolve, reject) => {
      exec(command, { timeout: 30000 }, (error, stdout, stderr) => {
        if (error) {
          this.logger.error('System command failed', { command, error: error.message });
          reject(error);
        } else {
          this.logger.info('System command executed', { command });
          resolve({ stdout, stderr });
        }
      });
    });
  }

  async executeFileOperation(operation, source, target, pattern) {
    try {
      switch (operation) {
        case 'copy':
          await fs.copy(source, target);
          break;
        case 'move':
          await fs.move(source, target);
          break;
        case 'delete':
          await fs.remove(source);
          break;
        default:
          throw new Error(`Unknown file operation: ${operation}`);
      }
      
      this.logger.info('File operation completed', { operation, source, target });
      return { success: true, operation, source, target };
      
    } catch (error) {
      this.logger.error('File operation failed', { operation, source, target, error: error.message });
      throw error;
    }
  }

  async createConfigBackup(backupPath, config, configType) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = path.join(backupPath, `${configType}-backup-${timestamp}.bak`);
      
      await fs.ensureDir(backupPath);
      await fs.writeFile(backupFile, config, 'utf-8');
      
      this.logger.info('Config backup created', { configType, backupFile });
      return backupFile;
      
    } catch (error) {
      this.logger.error('Config backup failed', { configType, error: error.message });
      throw error;
    }
  }
}

module.exports = ClaudeCodeHandler;