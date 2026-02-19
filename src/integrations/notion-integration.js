const { Client } = require('@notionhq/client');
const fs = require('fs-extra');
const path = require('path');
const winston = require('winston');

class NotionIntegration {
  constructor() {
    this.config = this.loadConfig();
    this.notion = new Client({ 
      auth: this.config.api_key,
      notionVersion: this.config.version 
    });
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/notion-integration.log' }),
        new winston.transports.Console()
      ]
    });
  }

  loadConfig() {
    return {
      api_key: process.env.NOTION_API_KEY || '',
      version: process.env.NOTION_VERSION || '2022-06-28',
      databases: {
        blog_articles: process.env.NOTION_DB_BLOG || '',
        live_events: process.env.NOTION_DB_LIVE_EVENTS || '',
        automation_tasks: process.env.NOTION_DB_AUTOMATION || ''
      }
    };
  }

  /**
   * Notionページ作成・データベース設定
   */
  async setupNotionWorkspace() {
    try {
      this.logger.info('Setting up Notion workspace...');

      // 1. ブログ記事管理データベース
      const blogDB = await this.createBlogArticlesDatabase();
      
      // 2. ライブ情報管理データベース  
      const liveDB = await this.createLiveEventsDatabase();
      
      // 3. 自動化タスク管理データベース
      const automationDB = await this.createAutomationTasksDatabase();

      // 設定ファイルにデータベースID保存
      await this.updateConfigWithDatabaseIds({
        blog_articles: blogDB.id,
        live_events: liveDB.id,
        automation_tasks: automationDB.id
      });

      this.logger.info('Notion workspace setup completed');
      
      return {
        success: true,
        databases: {
          blogDB: blogDB.id,
          liveDB: liveDB.id,
          automationDB: automationDB.id
        }
      };

    } catch (error) {
      this.logger.error('Failed to setup Notion workspace', { error: error.message });
      throw error;
    }
  }

  /**
   * ブログ記事管理データベース作成
   */
  async createBlogArticlesDatabase() {
    const database = await this.notion.databases.create({
      parent: { type: 'page_id', page_id: await this.getOrCreateMainPage() },
      title: [{ type: 'text', text: { content: 'ブログ記事管理' } }],
      properties: {
        'タイトル': { title: {} },
        'ステータス': {
          select: {
            options: [
              { name: 'アイデア', color: 'gray' },
              { name: '執筆中', color: 'yellow' },
              { name: '校正中', color: 'orange' },
              { name: '投稿準備', color: 'blue' },
              { name: '投稿済み', color: 'green' },
              { name: '公開停止', color: 'red' }
            ]
          }
        },
        '投稿予定日': { date: {} },
        '実際の投稿日': { date: {} },
        'Obsidianパス': { rich_text: {} },
        'Ghostリンク': { url: {} },
        'カテゴリ': {
          multi_select: {
            options: [
              { name: '横浜', color: 'blue' },
              { name: '歴史', color: 'brown' },
              { name: 'ライフスタイル', color: 'green' },
              { name: 'ビジネス', color: 'red' },
              { name: 'テクノロジー', color: 'purple' }
            ]
          }
        },
        '文字数': { number: {} },
        'PV数': { number: {} },
        'メモ': { rich_text: {} }
      }
    });

    return database;
  }

  /**
   * ライブ情報管理データベース作成
   */
  async createLiveEventsDatabase() {
    const database = await this.notion.databases.create({
      parent: { type: 'page_id', page_id: await this.getOrCreateMainPage() },
      title: [{ type: 'text', text: { content: 'ライブ情報管理' } }],
      properties: {
        'アーティスト': { title: {} },
        '会場': { rich_text: {} },
        '開催日時': { date: {} },
        '都市': {
          select: {
            options: [
              { name: '横浜', color: 'blue' },
              { name: '東京', color: 'red' },
              { name: 'その他', color: 'gray' }
            ]
          }
        },
        'チケット販売状況': {
          select: {
            options: [
              { name: '未発売', color: 'gray' },
              { name: '発売中', color: 'green' },
              { name: 'SOLD OUT', color: 'red' },
              { name: '終了', color: 'default' }
            ]
          }
        },
        'Spotifyリンク': { url: {} },
        'チケットリンク': { url: {} },
        '通知済み': { checkbox: {} },
        '参加予定': { checkbox: {} },
        'メモ': { rich_text: {} },
        '発見日': { date: {} }
      }
    });

    return database;
  }

  /**
   * 自動化タスク管理データベース作成
   */
  async createAutomationTasksDatabase() {
    const database = await this.notion.databases.create({
      parent: { type: 'page_id', page_id: await this.getOrCreateMainPage() },
      title: [{ type: 'text', text: { content: '自動化タスク管理' } }],
      properties: {
        'タスク名': { title: {} },
        'カテゴリ': {
          select: {
            options: [
              { name: 'ライティング', color: 'green' },
              { name: 'システム改善', color: 'blue' },
              { name: '業務チェック', color: 'yellow' },
              { name: 'API連携', color: 'purple' },
              { name: 'その他', color: 'gray' }
            ]
          }
        },
        'ステータス': {
          select: {
            options: [
              { name: '計画中', color: 'gray' },
              { name: '開発中', color: 'yellow' },
              { name: 'テスト中', color: 'orange' },
              { name: '稼働中', color: 'green' },
              { name: '停止中', color: 'red' }
            ]
          }
        },
        '実行頻度': { rich_text: {} },
        '最終実行': { date: {} },
        '次回実行': { date: {} },
        '説明': { rich_text: {} },
        'スクリプトパス': { rich_text: {} },
        '関連システム': { rich_text: {} }
      }
    });

    return database;
  }

  /**
   * メインページの取得または作成
   */
  async getOrCreateMainPage() {
    // 暫定的に新しいページを作成（実際には既存のページIDを使用）
    try {
      const page = await this.notion.pages.create({
        parent: { type: 'database_id', database_id: 'temp' }, // 実際には親ページIDが必要
        properties: {}
      });
      return page.id;
    } catch (error) {
      // ページ作成に失敗した場合は、手動で作成されたページIDを使用
      this.logger.warn('Failed to create main page, using manual setup required');
      throw new Error('Main page setup required - please create a Notion page manually first');
    }
  }

  /**
   * 設定ファイルにデータベースID保存
   */
  async updateConfigWithDatabaseIds(databaseIds) {
    // データベースIDはランタイムのみ保持（ファイルには書き込まない）
    this.config.databases = {
      ...this.config.databases,
      ...databaseIds
    };
  }

  /**
   * ブログ記事をNotionに登録
   */
  async createBlogArticle(articleData) {
    try {
      const response = await this.notion.pages.create({
        parent: { database_id: this.config.databases.blog_articles },
        properties: {
          'タイトル': {
            title: [{ text: { content: articleData.title } }]
          },
          'ステータス': {
            select: { name: articleData.status || 'アイデア' }
          },
          '投稿予定日': articleData.scheduledDate ? {
            date: { start: articleData.scheduledDate }
          } : {},
          'Obsidianパス': {
            rich_text: [{ text: { content: articleData.obsidianPath || '' } }]
          },
          'カテゴリ': {
            multi_select: articleData.categories?.map(cat => ({ name: cat })) || []
          },
          'メモ': {
            rich_text: [{ text: { content: articleData.memo || '' } }]
          }
        }
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to create blog article in Notion', { 
        error: error.message,
        articleData 
      });
      throw error;
    }
  }

  /**
   * ライブ情報をNotionに登録
   */
  async createLiveEvent(eventData) {
    try {
      const response = await this.notion.pages.create({
        parent: { database_id: this.config.databases.live_events },
        properties: {
          'アーティスト': {
            title: [{ text: { content: eventData.artist } }]
          },
          '会場': {
            rich_text: [{ text: { content: eventData.venue || '' } }]
          },
          '開催日時': eventData.date ? {
            date: { start: eventData.date }
          } : {},
          '都市': {
            select: { name: eventData.city || 'その他' }
          },
          'チケット販売状況': {
            select: { name: eventData.ticketStatus || '未発売' }
          },
          'Spotifyリンク': eventData.spotifyUrl ? {
            url: eventData.spotifyUrl
          } : {},
          'チケットリンク': eventData.ticketUrl ? {
            url: eventData.ticketUrl
          } : {},
          '発見日': {
            date: { start: new Date().toISOString().split('T')[0] }
          },
          'メモ': {
            rich_text: [{ text: { content: eventData.memo || '' } }]
          }
        }
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to create live event in Notion', { 
        error: error.message,
        eventData 
      });
      throw error;
    }
  }

  /**
   * 自動化タスクをNotionに登録
   */
  async createAutomationTask(taskData) {
    try {
      const response = await this.notion.pages.create({
        parent: { database_id: this.config.databases.automation_tasks },
        properties: {
          'タスク名': {
            title: [{ text: { content: taskData.name } }]
          },
          'カテゴリ': {
            select: { name: taskData.category || 'その他' }
          },
          'ステータス': {
            select: { name: taskData.status || '計画中' }
          },
          '実行頻度': {
            rich_text: [{ text: { content: taskData.frequency || '' } }]
          },
          '説明': {
            rich_text: [{ text: { content: taskData.description || '' } }]
          },
          'スクリプトパス': {
            rich_text: [{ text: { content: taskData.scriptPath || '' } }]
          },
          '関連システム': {
            rich_text: [{ text: { content: taskData.relatedSystems || '' } }]
          }
        }
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to create automation task in Notion', { 
        error: error.message,
        taskData 
      });
      throw error;
    }
  }

  /**
   * テスト接続
   */
  async testConnection() {
    try {
      const response = await this.notion.users.me();
      this.logger.info('Notion connection test successful', { 
        user: response.name,
        type: response.type 
      });
      return { success: true, user: response };
    } catch (error) {
      this.logger.error('Notion connection test failed', { error: error.message });
      return { success: false, error: error.message };
    }
  }
}

module.exports = NotionIntegration;