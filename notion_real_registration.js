const { Client } = require('@notionhq/client');
const fs = require('fs');

async function registerToNotionReal() {
    try {
        console.log('🔗 Notion実API登録開始');
        console.log('⏰ 登録開始時刻:', new Date().toLocaleString('ja-JP'));
        
        // 発見イベントデータ読み込み
        const discoveredEvents = JSON.parse(fs.readFileSync('data/discovered-live-events.json', 'utf8'));
        console.log(`✅ 発見イベントデータ読み込み: ${discoveredEvents.length}組のアーティスト`);
        
        // 全イベント数計算
        const totalEvents = discoveredEvents.reduce((sum, artist) => sum + artist.events.length, 0);
        console.log(`📊 登録予定イベント数: ${totalEvents}件`);
        
        // Notion API初期化
        console.log('\n🔗 Notion API初期化');
        const notion = new Client({
            auth: process.env.NOTION_API_KEY
        });
        
        const databaseId = '30b5f787-9a25-8119-859f-d4f0fdd98b39'; // Live Events DB
        
        // API接続テスト
        console.log('  📡 Notion API接続テスト');
        try {
            const database = await notion.databases.retrieve({ database_id: databaseId });
            console.log(`  ✅ データベース接続成功: ${database.title[0].plain_text}`);
        } catch (testError) {
            console.log(`  ❌ データベース接続失敗: ${testError.message}`);
            return null;
        }
        
        // 実際のイベント登録実行
        console.log('\n📝 実際のNotion登録実行開始');
        const registrationResults = await executeRealRegistration(discoveredEvents, notion, databaseId);
        
        // 結果サマリー
        console.log('\n📊 登録結果サマリー');
        const summary = generateRegistrationSummary(registrationResults, discoveredEvents);
        
        // 結果保存
        const finalResults = {
            registration: registrationResults,
            summary: summary,
            timestamp: new Date().toISOString()
        };
        
        fs.writeFileSync('data/notion-real-registration-results.json', JSON.stringify(finalResults, null, 2));
        
        console.log('\n🎉 Notion実登録完了！');
        console.log(`  📊 登録結果: data/notion-real-registration-results.json`);
        console.log(`  ✅ 成功: ${summary.successCount}件`);
        console.log(`  ❌ エラー: ${summary.errorCount}件`);
        console.log(`  📈 成功率: ${summary.successRate}%`);
        
        return finalResults;
        
    } catch (error) {
        console.error('❌ Notion実登録エラー:', error.message);
        return null;
    }
}

// 実際のNotion登録実行
async function executeRealRegistration(discoveredEvents, notion, databaseId) {
    console.log(`  📝 ${discoveredEvents.length}組のアーティストイベント登録開始`);
    
    const results = {
        successful: [],
        failed: [],
        totalAttempts: 0,
        progress: {
            processedArtists: 0,
            processedEvents: 0
        }
    };
    
    for (let i = 0; i < discoveredEvents.length; i++) {
        const artistData = discoveredEvents[i];
        const artist = artistData.artist;
        const events = artistData.events;
        
        console.log(`    ${i + 1}/${discoveredEvents.length}: ${artist.name} (${events.length}件)`);
        
        // アーティストの各イベントを登録
        for (let j = 0; j < events.length; j++) {
            const event = events[j];
            results.totalAttempts++;
            
            try {
                // Notionページプロパティ作成（ユーザー提案: アーティスト名→公演日順）
                const pageProperties = createNotionPageProperties(artist, event);
                
                // Notion API実行
                const response = await notion.pages.create({
                    parent: { database_id: databaseId },
                    properties: pageProperties
                });
                
                console.log(`      ✅ ${event.eventName} 登録成功`);
                
                results.successful.push({
                    artist: artist.name,
                    event: event,
                    notionId: response.id,
                    registeredAt: new Date().toISOString()
                });
                
                results.progress.processedEvents++;
                
                // API制限対策（Notion API: 3 requests per second）
                await new Promise(resolve => setTimeout(resolve, 350));
                
            } catch (error) {
                console.log(`      ❌ ${event.eventName} 登録失敗: ${error.message}`);
                
                results.failed.push({
                    artist: artist.name,
                    event: event,
                    error: error.message,
                    failedAt: new Date().toISOString()
                });
            }
        }
        
        results.progress.processedArtists++;
        
        // 進捗表示
        if ((i + 1) % 20 === 0 || i === discoveredEvents.length - 1) {
            const progressPercent = Math.round(((i + 1) / discoveredEvents.length) * 100);
            console.log(`    📊 進捗: ${i + 1}/${discoveredEvents.length} (${progressPercent}%)`);
        }
    }
    
    console.log(`  ✅ 全アーティスト処理完了`);
    console.log(`    試行: ${results.totalAttempts}件`);
    console.log(`    成功: ${results.successful.length}件`);
    console.log(`    失敗: ${results.failed.length}件`);
    
    return results;
}

// Notionページプロパティ作成（アーティスト名→公演日順）
function createNotionPageProperties(artist, event) {
    return {
        // 1. アーティスト名（ユーザー提案順序）
        'アーティスト名': {
            title: [
                {
                    text: {
                        content: artist.name
                    }
                }
            ]
        },
        
        // 2. 公演日（ユーザー提案：アーティスト名の次）
        '公演日': {
            date: {
                start: event.date || '2026-06-01' // デフォルト日付
            }
        },
        
        // 3. イベント名
        'イベント名': {
            rich_text: [
                {
                    text: {
                        content: event.eventName || `${artist.name} Live Concert`
                    }
                }
            ]
        },
        
        // 4. 会場
        '会場': {
            rich_text: [
                {
                    text: {
                        content: event.venue || 'TBD'
                    }
                }
            ]
        },
        
        // 5. チケットURL
        'チケットURL': {
            url: event.ticketUrl || null
        },
        
        // 6. データソース
        'データソース': {
            select: {
                name: mapSourceToSelectOption(event.source)
            }
        },
        
        // 7. 信頼度スコア
        '信頼度スコア': {
            select: {
                name: event.confidence || 'medium'
            }
        },
        
        // 8. 発見日時
        '発見日時': {
            date: {
                start: new Date().toISOString()
            }
        },
        
        // 9. ツアー名（あれば）
        'ツアー名': {
            rich_text: [
                {
                    text: {
                        content: event.tour || ''
                    }
                }
            ]
        },
        
        // 10. 更新回数（初回は1）
        '更新回数': {
            number: 1
        }
    };
}

// データソースをNotion Selectオプションにマッピング
function mapSourceToSelectOption(source) {
    const mapping = {
        'advanced-ticket-search': 'チケット検索',
        'advanced-venue-search': '会場検索',
        'artist-attribute-search': 'アーティスト属性',
        'ticket-simulation': 'チケット検索',
        'venue-simulation': '会場検索',
        'default': 'その他'
    };
    
    return mapping[source] || mapping['default'];
}

// 登録結果サマリー生成
function generateRegistrationSummary(registrationResults, originalData) {
    const summary = {
        totalArtists: originalData.length,
        totalEventsAttempted: registrationResults.totalAttempts,
        successCount: registrationResults.successful.length,
        errorCount: registrationResults.failed.length,
        successRate: Math.round((registrationResults.successful.length / registrationResults.totalAttempts) * 100),
        topArtists: [],
        errorAnalysis: {}
    };
    
    // トップアーティスト（イベント数順）
    const artistEventCounts = {};
    registrationResults.successful.forEach(success => {
        artistEventCounts[success.artist] = (artistEventCounts[success.artist] || 0) + 1;
    });
    
    summary.topArtists = Object.entries(artistEventCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([artist, count]) => ({ artist, events: count }));
    
    // エラー分析
    const errorTypes = {};
    registrationResults.failed.forEach(failure => {
        const errorType = failure.error.split(':')[0] || 'Unknown';
        errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
    });
    summary.errorAnalysis = errorTypes;
    
    return summary;
}

registerToNotionReal().then(result => {
    if (result) {
        console.log('\n📈 Notion実登録完了');
    }
}).catch(console.error);
