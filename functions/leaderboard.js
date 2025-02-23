const { getStore } = require('@netlify/blobs');

// Default leaderboard data
const DEFAULT_LEADERBOARD = [
    { name: "Scroggy", emoji: "🧙‍♂️", highScore: 1000000000 },
    { name: "WizardKing", emoji: "🧝‍♂️", highScore: 500000 },
    { name: "LuckyCharm", emoji: "🧚‍♀️", highScore: 250000 }
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
        return data ? JSON.parse(data) : DEFAULT_LEADERBOARD;
    } catch (error) {
        console.error('Error reading leaderboard:', error);
        return DEFAULT_LEADERBOARD;
    }
}

async function saveLeaderboard(store, scores) {
    try {
        console.log('Saving leaderboard data:', scores);
        await store.set('leaderboard', JSON.stringify(scores));
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
                const { name, emoji, score } = JSON.parse(event.body);
                const numericScore = Number(score);
                console.log('Received score update:', { name, emoji, numericScore });

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
                } else {
                    // Add new player
                    scores.push({ name, emoji: emoji || '🎲', highScore: numericScore });
                }
                
                // Sort by high score and keep top 100
                scores.sort((a, b) => b.highScore - a.highScore);
                scores = scores.slice(0, 100);
                
                // Save updated leaderboard
                const saved = await saveLeaderboard(store, scores);
                
                if (saved) {
                    return {
                        statusCode: 200,
                        headers: CORS_HEADERS,
                        body: JSON.stringify({
                            success: true,
                            scores: scores
                        })
                    };
                } else {
                    throw new Error('Failed to save leaderboard');
                }
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