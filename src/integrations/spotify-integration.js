const SpotifyWebApi = require('spotify-web-api-node');
const fs = require('fs-extra');
const path = require('path');
const winston = require('winston');

class SpotifyIntegration {
  constructor() {
    this.config = this.loadConfig();
    
    this.spotifyApi = new SpotifyWebApi({
      clientId: this.config.client_id,
      clientSecret: this.config.client_secret,
      redirectUri: this.config.redirect_uri
    });
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/spotify-integration.log' }),
        new winston.transports.Console()
      ]
    });
  }

  loadConfig() {
    const configPath = path.join(__dirname, '../../config/spotify-config.json');
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }

  /**
   * Spotify認証URL取得
   */
  getAuthorizationUrl() {
    const scopes = this.config.scope.split(' ');
    const state = 'some-state-of-my-choice';
    
    const authorizeURL = this.spotifyApi.createAuthorizeURL(scopes, state);
    
    this.logger.info('Spotify authorization URL created', { url: authorizeURL });
    return authorizeURL;
  }

  /**
   * 認証コードからアクセストークン取得
   */
  async setAccessToken(authorizationCode) {
    try {
      const data = await this.spotifyApi.authorizationCodeGrant(authorizationCode);
      
      const accessToken = data.body['access_token'];
      const refreshToken = data.body['refresh_token'];
      
      this.spotifyApi.setAccessToken(accessToken);
      this.spotifyApi.setRefreshToken(refreshToken);
      
      // トークンを設定ファイルに保存
      await this.saveTokens(accessToken, refreshToken);
      
      this.logger.info('Spotify access token set successfully');
      return { accessToken, refreshToken };
      
    } catch (error) {
      this.logger.error('Failed to get Spotify access token', { error: error.message });
      throw error;
    }
  }

  /**
   * 保存されたトークンを読み込み
   */
  async loadSavedTokens() {
    try {
      const tokenPath = path.join(__dirname, '../../config/spotify-tokens.json');
      if (await fs.pathExists(tokenPath)) {
        const tokens = await fs.readJson(tokenPath);
        this.spotifyApi.setAccessToken(tokens.accessToken);
        if (tokens.refreshToken) {
          this.spotifyApi.setRefreshToken(tokens.refreshToken);
        }
        this.logger.info('Spotify tokens loaded from file');
        return true;
      }
      return false;
    } catch (error) {
      this.logger.warn('Failed to load saved tokens', { error: error.message });
      return false;
    }
  }

  /**
   * トークンをファイルに保存
   */
  async saveTokens(accessToken, refreshToken) {
    try {
      const tokenPath = path.join(__dirname, '../../config/spotify-tokens.json');
      await fs.writeJson(tokenPath, {
        accessToken,
        refreshToken,
        updatedAt: new Date().toISOString()
      }, { spaces: 2 });
    } catch (error) {
      this.logger.error('Failed to save tokens', { error: error.message });
    }
  }

  /**
   * フォローしているアーティスト取得
   */
  async getFollowedArtists() {
    try {
      await this.ensureValidToken();
      
      const artists = [];
      let after = null;
      const limit = 50; // Spotify API の最大値
      
      do {
        const options = { limit };
        if (after) options.after = after;
        
        const data = await this.spotifyApi.getFollowedArtists(options);
        
        artists.push(...data.body.artists.items);
        after = data.body.artists.cursors?.after;
        
        this.logger.info(`Retrieved ${data.body.artists.items.length} artists`, { 
          totalSoFar: artists.length 
        });
        
      } while (after);
      
      // アーティスト情報を整理
      const formattedArtists = artists.map(artist => ({
        id: artist.id,
        name: artist.name,
        genres: artist.genres,
        popularity: artist.popularity,
        spotifyUrl: artist.external_urls.spotify,
        imageUrl: artist.images[0]?.url,
        followers: artist.followers?.total || 0
      }));
      
      this.logger.info(`Retrieved total ${formattedArtists.length} followed artists`);
      
      // アーティスト情報をファイルに保存
      await this.saveArtistData(formattedArtists);
      
      return formattedArtists;
      
    } catch (error) {
      this.logger.error('Failed to get followed artists', { error: error.message });
      throw error;
    }
  }

  /**
   * 有効なトークンの確保
   */
  async ensureValidToken() {
    try {
      // 保存されたトークンを読み込み
      await this.loadSavedTokens();
      
      // トークンをリフレッシュ
      const data = await this.spotifyApi.refreshAccessToken();
      const accessToken = data.body['access_token'];
      
      this.spotifyApi.setAccessToken(accessToken);
      await this.saveTokens(accessToken, this.spotifyApi.getRefreshToken());
      
      this.logger.info('Access token refreshed successfully');
      
    } catch (error) {
      this.logger.error('Failed to ensure valid token', { error: error.message });
      throw new Error('Spotify authentication required. Please run authorization flow.');
    }
  }

  /**
   * アーティストデータをファイルに保存
   */
  async saveArtistData(artists) {
    try {
      const dataPath = path.join(__dirname, '../../data/followed-artists.json');
      await fs.ensureDir(path.dirname(dataPath));
      
      const data = {
        artists,
        lastUpdated: new Date().toISOString(),
        totalCount: artists.length
      };
      
      await fs.writeJson(dataPath, data, { spaces: 2 });
      this.logger.info(`Saved ${artists.length} artists to file`);
      
    } catch (error) {
      this.logger.error('Failed to save artist data', { error: error.message });
    }
  }

  /**
   * 保存されたアーティストデータを読み込み
   */
  async loadSavedArtistData() {
    try {
      const dataPath = path.join(__dirname, '../../data/followed-artists.json');
      if (await fs.pathExists(dataPath)) {
        const data = await fs.readJson(dataPath);
        this.logger.info(`Loaded ${data.totalCount} artists from file`);
        return data.artists;
      }
      return [];
    } catch (error) {
      this.logger.error('Failed to load saved artist data', { error: error.message });
      return [];
    }
  }

  /**
   * テスト接続（認証不要の公開情報で）
   */
  async testConnection() {
    try {
      // Client Credentials Grant で認証（フォロー情報は取得できないが、接続テストとして）
      const data = await this.spotifyApi.clientCredentialsGrant();
      this.spotifyApi.setAccessToken(data.body['access_token']);
      
      // テスト用に人気アーティストを検索
      const searchResult = await this.spotifyApi.searchArtists('Queen', { limit: 1 });
      
      this.logger.info('Spotify connection test successful', { 
        artist: searchResult.body.artists.items[0]?.name 
      });
      
      return { 
        success: true, 
        testArtist: searchResult.body.artists.items[0]?.name 
      };
      
    } catch (error) {
      this.logger.error('Spotify connection test failed', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * 認証が必要な操作のテスト
   */
  async testUserDataAccess() {
    try {
      await this.ensureValidToken();
      
      const userData = await this.spotifyApi.getMe();
      const followedArtists = await this.getFollowedArtists();
      
      return {
        success: true,
        user: userData.body.display_name,
        artistCount: followedArtists.length
      };
      
    } catch (error) {
      this.logger.error('User data access test failed', { error: error.message });
      return { success: false, error: error.message };
    }
  }
}

module.exports = SpotifyIntegration;