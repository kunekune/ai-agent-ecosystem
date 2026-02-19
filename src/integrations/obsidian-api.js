const fs = require('fs-extra');
const path = require('path');
const moment = require('moment');
const winston = require('winston');

class ObsidianAPI {
  constructor(vaultPath) {
    this.vaultPath = vaultPath;
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/obsidian-api.log' }),
        new winston.transports.Console()
      ]
    });
  }

  /**
   * Daily Noteに追記
   */
  async appendToDailyNote(date, content) {
    const dateStr = moment(date).format('YYYY-MM-DD');
    const dailyNotePath = path.join(this.vaultPath, '00-Inbox', `daily-notes-${dateStr}.md`);
    
    try {
      // Daily Noteが存在しない場合は作成
      if (!await fs.pathExists(dailyNotePath)) {
        await this.createDailyNote(dateStr);
      }
      
      const formattedContent = this.formatContentForDailyNote(content, date);
      await fs.appendFile(dailyNotePath, formattedContent + '\n');
      
      this.logger.info('Appended to daily note', { date: dateStr, type: content.type });
      
    } catch (error) {
      this.logger.error('Failed to append to daily note', { error: error.message, date: dateStr });
      throw error;
    }
  }

  /**
   * Daily Note作成
   */
  async createDailyNote(dateStr) {
    const dailyNotePath = path.join(this.vaultPath, '00-Inbox', `daily-notes-${dateStr}.md`);
    const template = `# Daily Notes - ${dateStr}

**Date**: ${dateStr}  
**Day**: ${moment(dateStr).format('dddd')}

---

## 🌅 Morning Capture

## 💭 Thoughts & Ideas

## ✅ Tasks & Actions

## 🔗 Links & References

## 📊 Emotional Journey

## 🌙 Evening Reflection

---

**Created**: ${moment().format('YYYY-MM-DD HH:mm:ss')}
`;

    await fs.writeFile(dailyNotePath, template);
    this.logger.info('Created new daily note', { date: dateStr });
  }

  /**
   * Inboxに追記
   */
  async appendToInbox(content) {
    const inboxPath = path.join(this.vaultPath, '00-Inbox', 'quick-notes.md');
    
    try {
      const formattedContent = this.formatContentForInbox(content);
      
      // Inboxファイルが存在しない場合は作成
      if (!await fs.pathExists(inboxPath)) {
        await this.createInboxFile();
      }
      
      // 既存内容を読み取り
      const existingContent = await fs.readFile(inboxPath, 'utf-8');
      
      // 新しい内容を先頭に挿入（最新が上に）
      const lines = existingContent.split('\n');
      const headerEndIndex = lines.findIndex(line => line.startsWith('---')) + 1;
      
      lines.splice(headerEndIndex, 0, '', formattedContent);
      
      await fs.writeFile(inboxPath, lines.join('\n'));
      
      this.logger.info('Appended to inbox', { type: content.type });
      
    } catch (error) {
      this.logger.error('Failed to append to inbox', { error: error.message });
      throw error;
    }
  }

  /**
   * プロジェクトノートに追記
   */
  async addToProjectNotes(projectName, content) {
    const sanitizedName = this.sanitizeFileName(projectName);
    const projectPath = path.join(
      this.vaultPath,
      '01-Projects',
      sanitizedName,
      'notes.md'
    );
    
    try {
      // プロジェクトディレクトリが存在しない場合は作成
      await fs.ensureDir(path.dirname(projectPath));
      
      // プロジェクトノートが存在しない場合は作成
      if (!await fs.pathExists(projectPath)) {
        await this.createProjectNote(sanitizedName, projectName);
      }
      
      const timestamp = moment().format('YYYY-MM-DD HH:mm');
      const formattedContent = `\n## ${timestamp}\n\n${content}\n`;
      
      await fs.appendFile(projectPath, formattedContent);
      
      this.logger.info('Added to project notes', { project: projectName });
      
    } catch (error) {
      this.logger.error('Failed to add to project notes', { 
        error: error.message, 
        project: projectName 
      });
      throw error;
    }
  }

  /**
   * リソースファイルに追記
   */
  async addToResources(category, subcategory, content) {
    const resourcePath = path.join(
      this.vaultPath,
      '03-Resources',
      category,
      `${subcategory}.md`
    );
    
    try {
      await fs.ensureDir(path.dirname(resourcePath));
      
      if (!await fs.pathExists(resourcePath)) {
        await this.createResourceFile(category, subcategory);
      }
      
      const timestamp = moment().format('YYYY-MM-DD HH:mm');
      const formattedContent = `\n### ${timestamp}\n\n${content}\n`;
      
      await fs.appendFile(resourcePath, formattedContent);
      
      this.logger.info('Added to resources', { category, subcategory });
      
    } catch (error) {
      this.logger.error('Failed to add to resources', { 
        error: error.message,
        category,
        subcategory
      });
      throw error;
    }
  }

  /**
   * 感情データの記録
   */
  async recordEmotionalData(emotionalState, timestamp) {
    const dateStr = moment(timestamp).format('YYYY-MM-DD');
    const emotionPath = path.join(
      this.vaultPath,
      '02-Areas',
      'personal-analytics',
      'emotions',
      `emotions-${dateStr}.md`
    );
    
    try {
      await fs.ensureDir(path.dirname(emotionPath));
      
      const emotionRecord = {
        timestamp: timestamp.toISOString(),
        primary: emotionalState.primaryEmotion,
        energy: emotionalState.energyLevel,
        stress: emotionalState.stressLevel,
        confidence: emotionalState.confidence,
        adaptations: emotionalState.adaptationRecommendations
      };
      
      const formattedRecord = `## ${moment(timestamp).format('HH:mm')} - ${emotionalState.primaryEmotion}
- **Energy**: ${emotionalState.energyLevel}
- **Stress**: ${emotionalState.stressLevel} 
- **Response Style**: ${emotionalState.responseStyle}
- **Confidence**: ${Math.round(emotionalState.confidence * 100)}%

`;
      
      if (!await fs.pathExists(emotionPath)) {
        const header = `# Emotional Journey - ${dateStr}

Track emotional states, energy levels, and context throughout the day.

---

`;
        await fs.writeFile(emotionPath, header);
      }
      
      await fs.appendFile(emotionPath, formattedRecord);
      
      this.logger.info('Recorded emotional data', { 
        date: dateStr, 
        emotion: emotionalState.primaryEmotion 
      });
      
    } catch (error) {
      this.logger.error('Failed to record emotional data', { error: error.message });
      throw error;
    }
  }

  /**
   * システムログの記録
   */
  async recordSystemLog(logData) {
    const dateStr = moment().format('YYYY-MM-DD');
    const logPath = path.join(
      this.vaultPath,
      '02-Areas',
      'openclaw-systems',
      'logs',
      `system-log-${dateStr}.md`
    );
    
    try {
      await fs.ensureDir(path.dirname(logPath));
      
      if (!await fs.pathExists(logPath)) {
        const header = `# System Log - ${dateStr}

AI Agent Ecosystem operation logs and analytics.

---

`;
        await fs.writeFile(logPath, header);
      }
      
      const logEntry = `## ${moment().format('HH:mm:ss')} - ${logData.event}
- **Model**: ${logData.model || 'unknown'}
- **Tokens**: ${logData.tokens || 'N/A'}
- **Cost**: $${logData.cost || '0.00'}
- **Status**: ${logData.status}
- **Details**: ${logData.details}

`;
      
      await fs.appendFile(logPath, logEntry);
      
    } catch (error) {
      this.logger.error('Failed to record system log', { error: error.message });
    }
  }

  /**
   * 最近のノートを検索
   */
  async getRecentNotes(days = 7, category = null) {
    const cutoffDate = moment().subtract(days, 'days');
    const notes = [];
    
    try {
      const searchPath = category ? 
        path.join(this.vaultPath, category) : 
        this.vaultPath;
      
      const files = await this.findMarkdownFiles(searchPath);
      
      for (const file of files) {
        const stats = await fs.stat(file);
        if (moment(stats.mtime).isAfter(cutoffDate)) {
          const content = await fs.readFile(file, 'utf-8');
          const relativePath = path.relative(this.vaultPath, file);
          
          notes.push({
            path: relativePath,
            modified: stats.mtime,
            content: content.substring(0, 500), // 最初の500文字のみ
            size: stats.size
          });
        }
      }
      
      // 更新日時でソート（新しい順）
      notes.sort((a, b) => moment(b.modified).valueOf() - moment(a.modified).valueOf());
      
      return notes;
      
    } catch (error) {
      this.logger.error('Failed to get recent notes', { error: error.message });
      return [];
    }
  }

  /**
   * ノートの検索
   */
  async searchNotes(query, category = null) {
    const results = [];
    
    try {
      const searchPath = category ? 
        path.join(this.vaultPath, category) : 
        this.vaultPath;
      
      const files = await this.findMarkdownFiles(searchPath);
      
      for (const file of files) {
        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n');
        
        const matchingLines = lines
          .map((line, index) => ({ line, number: index + 1 }))
          .filter(({ line }) => line.toLowerCase().includes(query.toLowerCase()));
        
        if (matchingLines.length > 0) {
          const relativePath = path.relative(this.vaultPath, file);
          results.push({
            path: relativePath,
            matches: matchingLines.slice(0, 5), // 最大5行まで
            totalMatches: matchingLines.length
          });
        }
      }
      
      return results;
      
    } catch (error) {
      this.logger.error('Failed to search notes', { error: error.message });
      return [];
    }
  }

  /**
   * バックアップ作成
   */
  async createBackup(backupPath) {
    try {
      const timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
      const backupDir = path.join(backupPath, `obsidian-backup-${timestamp}`);
      
      await fs.copy(this.vaultPath, backupDir, {
        filter: (src) => {
          // .obsidian/workspace などの一時ファイルを除外
          return !src.includes('.obsidian/workspace');
        }
      });
      
      this.logger.info('Backup created', { backupDir });
      return backupDir;
      
    } catch (error) {
      this.logger.error('Failed to create backup', { error: error.message });
      throw error;
    }
  }

  // Private methods

  formatContentForDailyNote(content, timestamp) {
    const time = moment(timestamp).format('HH:mm');
    
    switch (content.type) {
      case 'thought':
        return `### ${time} - 💭 Thought\n${content.content}\n*Emotion: ${content.emotion} | Model: ${content.model}*`;
        
      case 'task':
        return `### ${time} - ✅ Task\n- [ ] ${content.content}\n*Priority: ${content.priority || 'medium'}*`;
        
      case 'link':
        return `### ${time} - 🔗 Reference\n[${content.title || 'Link'}](${content.url})\n${content.description || ''}`;
        
      case 'emotion':
        return `### ${time} - 😊 Emotion\n**${content.emotion}** (${content.intensity}/10)\n${content.context || ''}`;
        
      default:
        return `### ${time} - ${content.content}`;
    }
  }

  formatContentForInbox(content) {
    const timestamp = moment().format('YYYY-MM-DD HH:mm');
    
    switch (content.type) {
      case 'discord_capture':
        return `**${timestamp}** - Discord: ${content.original}\n*→ Processed: ${content.processed}*\n*Model: ${content.metadata.model} | Emotion: ${content.metadata.emotion}*`;
        
      case 'quick_note':
        return `**${timestamp}** - ${content.content}`;
        
      case 'link':
        return `**${timestamp}** - [${content.title}](${content.url})\n${content.description}`;
        
      default:
        return `**${timestamp}** - ${JSON.stringify(content)}`;
    }
  }

  async createInboxFile() {
    const inboxPath = path.join(this.vaultPath, '00-Inbox', 'quick-notes.md');
    const template = `# ⚡ Quick Notes

**{{date:YYYY-MM-DD}} {{time:HH:mm}}** からの記録

---

## 💡 Recent Captures

`;
    
    await fs.writeFile(inboxPath, template);
  }

  async createProjectNote(sanitizedName, originalName) {
    const projectPath = path.join(
      this.vaultPath,
      '01-Projects',
      sanitizedName,
      'notes.md'
    );
    
    const template = `# ${originalName} - Project Notes

**Created**: ${moment().format('YYYY-MM-DD HH:mm:ss')}

---

`;
    
    await fs.writeFile(projectPath, template);
  }

  async createResourceFile(category, subcategory) {
    const resourcePath = path.join(
      this.vaultPath,
      '03-Resources',
      category,
      `${subcategory}.md`
    );
    
    const template = `# ${subcategory} - ${category}

**Created**: ${moment().format('YYYY-MM-DD HH:mm:ss')}

---

`;
    
    await fs.writeFile(resourcePath, template);
  }

  async findMarkdownFiles(searchPath) {
    const files = [];
    
    const processDirectory = async (dir) => {
      const items = await fs.readdir(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stats = await fs.stat(fullPath);
        
        if (stats.isDirectory()) {
          await processDirectory(fullPath);
        } else if (path.extname(item) === '.md') {
          files.push(fullPath);
        }
      }
    };
    
    await processDirectory(searchPath);
    return files;
  }

  sanitizeFileName(name) {
    return name
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase()
      .substring(0, 50);
  }
}

module.exports = ObsidianAPI;