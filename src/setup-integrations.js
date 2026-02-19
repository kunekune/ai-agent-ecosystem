#!/usr/bin/env node

const NotionIntegration = require('./integrations/notion-integration');
const SpotifyIntegration = require('./integrations/spotify-integration');
const LiveEventsIntegration = require('./integrations/live-events-integration');
const fs = require('fs-extra');
const path = require('path');

async function main() {
  console.log('🚀 AI Personal Agent - Integration Setup');
  console.log('=====================================\\n');

  // ログディレクトリ作成
  await fs.ensureDir('logs');
  await fs.ensureDir('data');

  try {
    // 1. Notion接続テスト
    console.log('📝 Testing Notion integration...');
    const notionIntegration = new NotionIntegration();
    const notionTest = await notionIntegration.testConnection();
    
    if (notionTest.success) {
      console.log('✅ Notion connection successful!');
      console.log(`   User: ${notionTest.user.name || 'Unknown'}`);
      
      // データベース作成は手動設定が必要なのでスキップ
      console.log('⚠️  Database creation requires manual Notion page setup');
      console.log('   Please create a Notion page and share it with the integration');
    } else {
      console.log('❌ Notion connection failed:', notionTest.error);
    }

    console.log('');

    // 2. Spotify接続テスト
    console.log('🎵 Testing Spotify integration...');
    const spotifyIntegration = new SpotifyIntegration();
    const spotifyTest = await spotifyIntegration.testConnection();
    
    if (spotifyTest.success) {
      console.log('✅ Spotify connection successful!');
      console.log(`   Test search result: ${spotifyTest.testArtist}`);
      
      // 認証URLを表示
      const authUrl = spotifyIntegration.getAuthorizationUrl();
      console.log('');
      console.log('🔐 For full access to your followed artists:');
      console.log('   1. Visit this URL in your browser:');
      console.log(`   ${authUrl}`);
      console.log('   2. Accept permissions and copy the authorization code');
      console.log('   3. Run: node src/auth-spotify.js <authorization-code>');
    } else {
      console.log('❌ Spotify connection failed:', spotifyTest.error);
    }

    console.log('');

    // 3. Live Events API テスト
    console.log('🎤 Testing Live Events APIs...');
    const liveEventsIntegration = new LiveEventsIntegration();
    const liveEventsTest = await liveEventsIntegration.testAPIs();
    
    console.log('Live Events API Test Results:');
    Object.entries(liveEventsTest).forEach(([api, result]) => {
      if (result.success) {
        console.log(`✅ ${api}: Working (${result.eventCount || 0} test events)`);
      } else {
        console.log(`❌ ${api}: Failed - ${result.error}`);
      }
    });

    console.log('');

    // 4. テストデータ作成
    console.log('📊 Creating test data...');
    
    const sampleArtists = [
      { 
        id: 'test1', 
        name: 'Queen', 
        spotifyUrl: 'https://open.spotify.com/artist/1dfeR4HaWDbWqFHLkxsg1d' 
      },
      { 
        id: 'test2', 
        name: 'The Beatles', 
        spotifyUrl: 'https://open.spotify.com/artist/3WrFJ7ztbogyGnTHbHJFl2' 
      }
    ];
    
    // ライブイベント検索テスト
    const testEvents = await liveEventsIntegration.getMultipleArtistEvents(sampleArtists, 2);
    
    if (testEvents.length > 0) {
      console.log(`✅ Found ${testEvents.length} test events`);
      testEvents.slice(0, 3).forEach(event => {
        console.log(`   - ${event.artist} at ${event.venue}, ${event.city} (${event.date})`);
      });
    } else {
      console.log('⚠️  No test events found (this is normal if no upcoming concerts)');
    }

    console.log('');

    // 5. 設定ファイル確認
    console.log('⚙️  Configuration Status:');
    const configs = [
      { name: 'Notion API', path: 'config/notion-config.json' },
      { name: 'Spotify API', path: 'config/spotify-config.json' }
    ];
    
    for (const config of configs) {
      const exists = await fs.pathExists(config.path);
      console.log(`   ${exists ? '✅' : '❌'} ${config.name}: ${exists ? 'Configured' : 'Missing'}`);
    }

    console.log('');
    console.log('🎯 Next Steps:');
    console.log('1. Complete Spotify OAuth (see URL above)');
    console.log('2. Create Notion page and share with integration');
    console.log('3. Run daily live event monitoring');
    console.log('4. Set up blog article management workflow');
    
    console.log('');
    console.log('🏃‍♂️ Setup completed! Ready for full integration testing.');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}