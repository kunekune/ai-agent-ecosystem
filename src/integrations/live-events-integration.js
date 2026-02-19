require('dotenv').config();
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const winston = require('winston');

class LiveEventsIntegration {
  constructor() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/live-events.log' }),
        new winston.transports.Console()
      ]
    });
    
    // API設定（各サービスのAPIキーは後で追加）
    this.apis = {
      bandsintown: {
        baseUrl: 'https://rest.bandsintown.com',
        appId: 'ai-personal-agent' // Bandsintownは無料でアプリIDのみ必要
      },
      songkick: {
        baseUrl: 'https://api.songkick.com/api/3.0',
        // apiKey: '' // 要登録
      },
      ticketmaster: {
        baseUrl: 'https://app.ticketmaster.com/discovery/v2',
        apiKey: process.env.TICKETMASTER_CONSUMER_KEY || '9rmrkr6X95zmRVCkgD44O8eeFHFTA55M'
      },
      ticketpia: {
        baseUrl: 'https://api.ticketpia.jp',
        // apiKey: '' // 要登録
      }
    };
    
    // 地域設定
    this.targetCities = {
      横浜: { lat: 35.4437, lng: 139.6380 },
      東京: { lat: 35.6762, lng: 139.6503 }
    };
  }

  /**
   * アーティストのライブ情報を取得（複数ソース統合）
   */
  async getArtistEvents(artistName, artistSpotifyId = null) {
    const events = [];
    
    try {
      // 1. Bandsintown API（無料）
      const bandsintownEvents = await this.getBandsintownEvents(artistName);
      events.push(...bandsintownEvents);
      
      // 2. Ticketmaster API（無料枠あり）
      const ticketmasterEvents = await this.getTicketMasterEvents(artistName);
      events.push(...ticketmasterEvents);
      
      // 3. チケットぴあ API
      const ticketpiaEvents = await this.getTicketPiaEvents(artistName);
      events.push(...ticketpiaEvents);
      
      // 4. Songkick API（要APIキー）
      // const songkickEvents = await this.getSongkickEvents(artistName);
      // events.push(...songkickEvents);
      
      // 日本のイベントのみフィルタリング
      const japanEvents = events.filter(event => 
        event.country === 'Japan' || 
        this.isTargetCity(event.city)
      );
      
      // 重複除去
      const uniqueEvents = this.removeDuplicateEvents(japanEvents);
      
      this.logger.info(`Found ${uniqueEvents.length} Japan events for ${artistName}`, {
        artist: artistName,
        totalEvents: events.length,
        japanEvents: uniqueEvents.length
      });
      
      return uniqueEvents;
      
    } catch (error) {
      this.logger.error(`Failed to get events for ${artistName}`, { 
        error: error.message 
      });
      return [];
    }
  }

  /**
   * Bandsintown APIからイベント取得
   */
  async getBandsintownEvents(artistName) {
    try {
      const url = `${this.apis.bandsintown.baseUrl}/artists/${encodeURIComponent(artistName)}/events`;
      const params = {
        app_id: this.apis.bandsintown.appId,
        date: 'upcoming'
      };
      
      const response = await axios.get(url, { 
        params,
        headers: {
          'User-Agent': 'AI Personal Agent/1.0',
          'Accept': 'application/json'
        },
        timeout: 10000
      });
      
      if (response.data.length === 0) {
        return [];
      }
      
      const events = response.data.map(event => ({
        id: `bandsintown-${event.id}`,
        source: 'Bandsintown',
        artist: event.artist.name,
        venue: event.venue.name,
        city: event.venue.city,
        country: event.venue.country,
        date: event.datetime,
        ticketUrl: event.offers?.[0]?.url || event.url,
        description: event.description || '',
        rawData: event
      }));
      
      return events;
      
    } catch (error) {
      if (error.response?.status === 404) {
        // アーティストが見つからない場合
        return [];
      }
      
      this.logger.error(`Bandsintown API error for ${artistName}`, { 
        error: error.message,
        status: error.response?.status 
      });
      return [];
    }
  }

  /**
   * Songkick APIからイベント取得（要APIキー）
   */
  async getSongkickEvents(artistName) {
    try {
      // TODO: Songkick APIキー取得後に実装
      return [];
    } catch (error) {
      this.logger.error(`Songkick API error for ${artistName}`, { error: error.message });
      return [];
    }
  }

  /**
   * TicketMaster APIからイベント取得
   */
  async getTicketMasterEvents(artistName) {
    try {
      const url = `${this.apis.ticketmaster.baseUrl}/events.json`;
      const params = {
        keyword: artistName,
        countryCode: 'JP',
        city: 'Tokyo,Yokohama',
        size: 20,
        locale: 'ja',
        apikey: this.apis.ticketmaster.apiKey
      };
      
      const response = await axios.get(url, { 
        params,
        headers: {
          'User-Agent': 'AI Personal Agent/1.0',
          'Accept': 'application/json'
        },
        timeout: 10000
      });
      
      if (!response.data._embedded?.events) {
        return [];
      }
      
      const events = response.data._embedded.events
        .filter(event => this.isJapanEvent(event))
        .map(event => ({
          id: `ticketmaster-${event.id}`,
          source: 'Ticketmaster',
          artist: artistName,
          venue: event._embedded?.venues?.[0]?.name || 'Unknown Venue',
          city: event._embedded?.venues?.[0]?.city?.name || 'Unknown City',
          country: 'Japan',
          date: event.dates?.start?.dateTime || event.dates?.start?.localDate,
          ticketUrl: event.url,
          description: event.info || '',
          rawData: event
        }));
      
      return events;
      
    } catch (error) {
      if (error.response?.status === 401) {
        this.logger.error(`TicketMaster API authentication failed for ${artistName}`, {
          error: error.message,
          status: error.response?.status
        });
        return [];
      }
      
      this.logger.error(`TicketMaster API error for ${artistName}`, { 
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      return [];
    }
  }

  /**
   * チケットぴあ風のイベント取得（スクレイピングベース）
   */
  async getTicketPiaEvents(artistName) {
    try {
      // チケットぴあの検索API（公式APIではなくスクレイピング代替）
      const searchUrl = `https://t.pia.jp/api/search.json`;
      const params = {
        keyword: artistName,
        area: '東京,神奈川',
        genre: 'ライブ',
        sort: 'date'
      };
      
      // 注意: 実際のチケットぴあAPIは要申請のため、ここではプレースホルダー
      // 実装時は公式API取得または代替手段を使用
      
      this.logger.info(`チケットぴあ検索: ${artistName}（実装準備中）`);
      
      // とりあえず空配列を返す（後で実装）
      return [];
      
    } catch (error) {
      this.logger.error(`チケットぴあ検索エラー for ${artistName}`, { 
        error: error.message 
      });
      return [];
    }
  }

  /**
   * 日本のイベントかどうか判定
   */
  isJapanEvent(event) {
    const venue = event._embedded?.venues?.[0];
    if (!venue) return false;
    
    return venue.country?.countryCode === 'JP' || 
           venue.city?.name?.includes('Tokyo') ||
           venue.city?.name?.includes('Yokohama') ||
           venue.city?.name?.includes('横浜') ||
           venue.city?.name?.includes('東京');
  }

  /**
   * 対象都市かどうか判定
   */
  isTargetCity(cityName) {
    const targetCityNames = ['横浜', 'Yokohama', '東京', 'Tokyo'];
    return targetCityNames.some(targetCity => 
      cityName.toLowerCase().includes(targetCity.toLowerCase())
    );
  }

  /**
   * イベントの重複除去
   */
  removeDuplicateEvents(events) {
    const seen = new Map();
    
    return events.filter(event => {
      const key = `${event.artist}-${event.date}-${event.venue}`;
      if (seen.has(key)) {
        return false;
      }
      seen.set(key, true);
      return true;
    });
  }

  /**
   * 複数アーティストのイベント一括取得
   */
  async getMultipleArtistEvents(artists, maxConcurrent = 3) {
    const allEvents = [];
    
    // 並行処理数を制限して実行
    for (let i = 0; i < artists.length; i += maxConcurrent) {
      const batch = artists.slice(i, i + maxConcurrent);
      
      const batchPromises = batch.map(artist => 
        this.getArtistEvents(artist.name, artist.id)
      );
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const artistEvents = result.value.map(event => ({
            ...event,
            spotifyUrl: batch[index].spotifyUrl
          }));
          allEvents.push(...artistEvents);
        } else {
          this.logger.error(`Failed to get events for ${batch[index].name}`, {
            error: result.reason
          });
        }
      });
      
      // API制限を避けるため少し待機
      if (i + maxConcurrent < artists.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // 日付順にソート
    allEvents.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    return allEvents;
  }

  /**
   * イベントデータを保存
   */
  async saveEventData(events) {
    try {
      const dataPath = path.join(__dirname, '../../data/live-events.json');
      await fs.ensureDir(path.dirname(dataPath));
      
      const data = {
        events,
        lastUpdated: new Date().toISOString(),
        totalCount: events.length
      };
      
      await fs.writeJson(dataPath, data, { spaces: 2 });
      this.logger.info(`Saved ${events.length} events to file`);
      
    } catch (error) {
      this.logger.error('Failed to save event data', { error: error.message });
    }
  }

  /**
   * 保存されたイベントデータを読み込み
   */
  async loadSavedEventData() {
    try {
      const dataPath = path.join(__dirname, '../../data/live-events.json');
      if (await fs.pathExists(dataPath)) {
        const data = await fs.readJson(dataPath);
        this.logger.info(`Loaded ${data.totalCount} events from file`);
        return data.events;
      }
      return [];
    } catch (error) {
      this.logger.error('Failed to load saved event data', { error: error.message });
      return [];
    }
  }

  /**
   * 新しいイベントのみ取得（前回実行との差分）
   */
  async getNewEvents(artists) {
    const currentEvents = await this.getMultipleArtistEvents(artists);
    const savedEvents = await this.loadSavedEventData();
    
    // 新しいイベントを特定（IDベースで比較）
    const savedEventIds = new Set(savedEvents.map(event => event.id));
    const newEvents = currentEvents.filter(event => !savedEventIds.has(event.id));
    
    this.logger.info(`Found ${newEvents.length} new events`, {
      totalCurrent: currentEvents.length,
      totalSaved: savedEvents.length,
      newCount: newEvents.length
    });
    
    // 新しいデータを保存
    await this.saveEventData(currentEvents);
    
    return {
      newEvents,
      allEvents: currentEvents
    };
  }

  /**
   * APIテスト
   */
  async testAPIs() {
    const testResults = {};
    
    // Bandsintown テスト
    try {
      const testEvents = await this.getBandsintownEvents('Queen');
      testResults.bandsintown = { 
        success: true, 
        eventCount: testEvents.length 
      };
    } catch (error) {
      testResults.bandsintown = { 
        success: false, 
        error: error.message 
      };
    }

    // Ticketmaster テスト
    try {
      const testEvents = await this.getTicketMasterEvents('Queen');
      testResults.ticketmaster = { 
        success: true, 
        eventCount: testEvents.length 
      };
    } catch (error) {
      testResults.ticketmaster = { 
        success: false, 
        error: error.message 
      };
    }

    // チケットぴあ テスト
    try {
      const testEvents = await this.getTicketPiaEvents('Queen');
      testResults.ticketpia = { 
        success: true, 
        eventCount: testEvents.length 
      };
    } catch (error) {
      testResults.ticketpia = { 
        success: false, 
        error: error.message 
      };
    }
    
    this.logger.info('Live Events API test completed', { results: testResults });
    return testResults;
  }
}

module.exports = LiveEventsIntegration;