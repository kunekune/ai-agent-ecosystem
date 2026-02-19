#!/usr/bin/env node

const SpotifyIntegration = require('./integrations/spotify-integration');

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('🎵 Spotify Authorization Helper');
    console.log('=============================\\n');
    
    const spotify = new SpotifyIntegration();
    const authUrl = spotify.getAuthorizationUrl();
    
    console.log('Please visit this URL to authorize access:');
    console.log(authUrl);
    console.log('');
    console.log('After authorization, run:');
    console.log('node src/auth-spotify.js <authorization-code>');
    
    return;
  }

  const authorizationCode = args[0];
  
  try {
    console.log('🔐 Exchanging authorization code for tokens...');
    
    const spotify = new SpotifyIntegration();
    const tokens = await spotify.setAccessToken(authorizationCode);
    
    console.log('✅ Authorization successful!');
    console.log(`Access token: ${tokens.accessToken.substring(0, 20)}...`);
    
    // テスト: フォローアーティスト取得
    console.log('\\n🎵 Testing followed artists access...');
    const followedArtists = await spotify.getFollowedArtists();
    
    console.log(`✅ Retrieved ${followedArtists.length} followed artists:`);
    followedArtists.slice(0, 5).forEach(artist => {
      console.log(`   - ${artist.name} (${artist.genres.join(', ') || 'No genre'}) - ${artist.followers} followers`);
    });
    
    if (followedArtists.length > 5) {
      console.log(`   ... and ${followedArtists.length - 5} more`);
    }
    
    console.log('\\n🎯 Spotify integration is ready for live event monitoring!');
    
  } catch (error) {
    console.error('❌ Authorization failed:', error.message);
    console.error('\\nPlease make sure:');
    console.error('1. You visited the authorization URL');
    console.error('2. You copied the correct authorization code from the callback URL');
    console.error('3. The authorization code is not expired (they expire quickly)');
  }
}

if (require.main === module) {
  main();
}