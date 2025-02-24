const { getStore } = require('@netlify/blobs');

// Default leaderboard data
const DEFAULT_LEADERBOARD = [
    { name: "Scroggy", emoji: "🧙‍♂️", highScore: 1000000000, jackpotHistory: [{ emoji: "🤑", prize: 10000000000000, timestamp: Date.now() }] },
    { name: "WizardKing", emoji: "🧝‍♂️", highScore: 500000, jackpotHistory: [{ emoji: "🌮", prize: 5000, timestamp: Date.now() - 86400000 }] },
    { name: "LuckyCharm", emoji: "🧚‍♀️", highScore: 250000, jackpotHistory: [] }
];

// CORS headers for all responses
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*', // Allow all origins during development
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
};

async function getLeaderboard(store) {
    try {
        console.log('Fetching leaderboard data from store');
        const data = await store.get('leaderboard');
        console.log('Raw leaderboard data:', data);
        return data ? JSON.parse(data) : JSON.parse(JSON.stringify(DEFAULT_LEADERBOARD));
    } catch (error) {
        console.error('Error reading leaderboard:', error);
        return DEFAULT_LEADERBOARD;
    }
}

async function saveLeaderboard(store, scores) {
    try {
        console.log('Saving leaderboard data:', scores);
        // Make sure we only save necessary fields
        const plainScores = scores.map(entry => ({
            name: entry.name,
            emoji: entry.emoji,
            highScore: entry.highScore,
            jackpotHistory: Array.isArray(entry.jackpotHistory) ? entry.jackpotHistory : []
        }));
        const safeData = JSON.stringify(JSON.parse(JSON.stringify(plainScores)));
        await store.set('leaderboard', safeData);
        console.log('Leaderboard saved successfully');
        return true;
    } catch (error) {
        console.error('Error saving leaderboard:', error);
        return false;
    }
}

exports.handler = async function(event, context) {
    console.log('Function invoked with method:', event.httpMethod);
    console.log('Headers:', event.headers);

    // Handle OPTIONS request for CORS
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers: CORS_HEADERS,
            body: ''
        };
    }

    try {
        // Initialize store options without token for public access
        const store = getStore({
            name: "leaderboard",
            siteID: context.site.id
        });

        console.log('Store initialized with siteID:', context.site.id);

        // GET request - return leaderboard
        if (event.httpMethod === 'GET') {
            try {
                const scores = await getLeaderboard(store);
                console.log('Returning scores:', scores);
                return {
                    statusCode: 200,
                    headers: CORS_HEADERS,
                    body: JSON.stringify(scores)
                };
            } catch (error) {
                console.error('Error loading leaderboard:', error);
                return {
                    statusCode: 500,
                    headers: CORS_HEADERS,
                    body: JSON.stringify({ error: 'Failed to load leaderboard', details: error.message })
                };
            }
        }

        // POST request - update score
        if (event.httpMethod === 'POST') {
            try {
                const { name, emoji, score, jackpotWin } = JSON.parse(event.body);
                const numericScore = Number(score);
                console.log('Received score update:', { name, emoji, numericScore, jackpotWin });

                if (!name || isNaN(numericScore)) {
                    return {
                        statusCode: 400,
                        headers: CORS_HEADERS,
                        body: JSON.stringify({ error: 'Missing name or valid score' })
                    };
                }

                // Get current leaderboard
                let scores = await getLeaderboard(store);
                
                // Find if player already exists
                const playerIndex = scores.findIndex(p => p.name === name);
                
                if (playerIndex !== -1) {
                    // Update existing score if new score is higher
                    if (numericScore > scores[playerIndex].highScore) {
                        scores[playerIndex].highScore = numericScore;
                        scores[playerIndex].emoji = emoji || scores[playerIndex].emoji || '🎲';
                    }
                    
                    // Add jackpot win to history if provided
                    if (jackpotWin && jackpotWin.emoji && jackpotWin.prize) {
                        // Initialize jackpotHistory if it doesn't exist
                        if (!Array.isArray(scores[playerIndex].jackpotHistory)) {
                            scores[playerIndex].jackpotHistory = [];
                        }
                        
                        // Add the new jackpot win with timestamp
                        scores[playerIndex].jackpotHistory.push({
                            emoji: jackpotWin.emoji,
                            prize: jackpotWin.prize,
                            timestamp: Date.now()
                        });
                        
                        // Keep only the most recent 50 jackpot wins
                        if (scores[playerIndex].jackpotHistory.length > 50) {
                            scores[playerIndex].jackpotHistory = scores[playerIndex].jackpotHistory
                                .sort((a, b) => b.timestamp - a.timestamp)
                                .slice(0, 50);
                        }
                    }
                } else {
                    // Add new player
                    const newPlayer = { 
                        name, 
                        emoji: emoji || '🎲', 
                        highScore: numericScore,
                        jackpotHistory: []
                    };
                    
                    // Add jackpot win if provided
                    if (jackpotWin && jackpotWin.emoji && jackpotWin.prize) {
                        newPlayer.jackpotHistory.push({
                            emoji: jackpotWin.emoji,
                            prize: jackpotWin.prize,
                            timestamp: Date.now()
                        });
                    }
                    
                    scores.push(newPlayer);
                }
                
                // Sort by high score and keep top 100
                scores.sort((a, b) => b.highScore - a.highScore);
                scores = scores.slice(0, 100);
                
                // Save updated leaderboard
                const saved = await saveLeaderboard(store, scores);
                
                return {
                    statusCode: 200,
                    headers: CORS_HEADERS,
                    body: JSON.stringify({
                        success: saved,
                        scores: scores,
                        message: saved ? 'Leaderboard updated successfully.' : 'Leaderboard update skipped due to storage restrictions.'
                    })
                };
            } catch (error) {
                console.error('Error updating score:', error);
                return {
                    statusCode: 500,
                    headers: CORS_HEADERS,
                    body: JSON.stringify({ error: 'Failed to update score', details: error.message })
                };
            }
        }

        // Invalid method
        return {
            statusCode: 405,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    } catch (error) {
        console.error('Unexpected error:', error);
        return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: 'Internal server error', details: error.message })
        };
    }
}; 