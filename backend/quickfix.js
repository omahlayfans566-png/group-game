const http = require('http');

// ── CHANGE THESE ──────────────────────────────────────────────────────────────
const ADMIN_EMAIL = 'admin@survivalgame.com';
const ADMIN_PASSWORD = 'Admin@2026!';

// Game closes at 10:20 PM tonight
const now = new Date();
const close = new Date();
close.setHours(22, 20, 0, 0); // 10:20 PM

// If it's already past 10:20 PM, set close to 30 min from now as fallback
if (close <= now) { close.setTime(now.getTime() + 30 * 60 * 1000); }
// ──────────────────────────────────────────────────────────────────────────────

function req(method, path, body, token) {
  return new Promise(function (resolve, reject) {
    var data = body ? JSON.stringify(body) : null;
    var opts = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method,
      headers: Object.assign(
        { 'Content-Type': 'application/json' },
        token ? { 'Authorization': 'Bearer ' + token } : {},
        data ? { 'Content-Length': Buffer.byteLength(data) } : {}
      )
    };
    var r = http.request(opts, function (res) {
      var raw = '';
      res.on('data', function (d) { raw += d; });
      res.on('end', function () {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch (e) { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function run() {
  console.log('⚡ Opening game — closes at', close.toLocaleTimeString());

  // 1. Login
  var loginRes = await req('POST', '/api/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  if (!loginRes.body.success) {
    console.error('❌ Login FAILED:', loginRes.body.message);
    console.error('   Edit ADMIN_EMAIL / ADMIN_PASSWORD at the top of quickfix.js');
    return;
  }
  var token = loginRes.body.token;
  console.log('✅ Admin logged in');

  // 2. Get active game
  var gamesRes = await req('GET', '/api/games', null, token);
  var games = gamesRes.body.games || [];
  var game = games.find(function (g) { return g.status === 'ACTIVE'; }) || games[0];
  if (!game) {
    // Create the game now
    var now2 = new Date();
    var createGame = await req('POST', '/api/games', {
      name: 'Survival Game',
      description: '7-Day Survival Puzzle Competition',
      startDate: now2.toISOString(),
      targetFinalists: 2,
      status: 'ACTIVE'
    }, token);
    if (!createGame.body.success) { console.error('❌ Could not create game:', createGame.body.message); return; }
    game = createGame.body.game;
    // Activate it
    await req('PATCH', '/api/games/' + game._id, { status: 'ACTIVE' }, token);
    console.log('✅ Game created + activated:', game.name, '(' + game._id + ')');
  }
  console.log('✅ Game:', game.name, '(' + game._id + ')');

  // 3. Activate game if needed
  if (game.status !== 'ACTIVE') {
    await req('PATCH', '/api/games/' + game._id, { status: 'ACTIVE' }, token);
    console.log('✅ Game set to ACTIVE');
  }

  // 4. Get days
  var daysRes = await req('GET', '/api/games/' + game._id + '/days', null, token);
  var days = (daysRes.body.days || []).sort(function (a, b) { return a.dayNumber - b.dayNumber; });

  // Find today's day or create it
  var today = days.find(function (d) { return d.status === 'OPEN'; })
    || days.find(function (d) { return d.status === 'UPCOMING'; })
    || days[0];

  if (!today) {
    // Create Day 1
    var cr = await req('POST', '/api/games/' + game._id + '/days', {
      dayNumber: 1,
      dayOfWeek: 'MONDAY',
      challengeStartTime: now.toISOString(),
      challengeEndTime: close.toISOString(),
      eliminationCount: 0
    }, token);
    today = cr.body.day;
    console.log('✅ Created Day 1');
  } else {
    // Update existing day: open it, set close time to 10:20 PM
    await req('PATCH', '/api/games/' + game._id + '/days/' + today._id, {
      status: 'OPEN',
      challengeStartTime: now.toISOString(),
      challengeEndTime: close.toISOString()
    }, token);
    console.log('✅ Day', today.dayNumber, 'OPENED — closes', close.toLocaleTimeString());
  }

  // 5. Set current day
  await req('PATCH', '/api/games/' + game._id, { currentDay: today.dayNumber, status: 'ACTIVE' }, token);
  console.log('✅ Current day set to', today.dayNumber);

  // 6. Get challenges for this day
  var challRes = await req('GET', '/api/challenges?gameId=' + game._id + '&dayNumber=' + today.dayNumber, null, token);
  var challenges = challRes.body.challenges || [];

  if (challenges.length === 0) {
    // Create a challenge automatically
    var newCh = await req('POST', '/api/challenges', {
      gameId: game._id,
      gameDayId: today._id,
      dayNumber: today.dayNumber,
      title: 'Day ' + today.dayNumber + ' — The Broken Machine',
      description: 'Repair the circuit and let the signal flow.',
      instructions: 'Rotate the nodes to connect SOURCE to SINK.',
      difficulty: 'HARD',
      challengeType: 'BROKEN_MACHINE',
      durationSeconds: 720,
      maxAttempts: 1,
      scoringMethod: 'TIME_BONUS',
      maxScore: 100,
      isActive: true,
      isOpen: true,
      puzzleConfig: {}
    }, token);
    if (newCh.body.success) {
      challenges = [newCh.body.challenge];
      console.log('✅ Challenge created:', newCh.body.challenge.title);
    } else {
      console.error('❌ Could not create challenge:', newCh.body.message);
    }
  } else {
    // Activate + open all existing challenges for this day
    for (var i = 0; i < challenges.length; i++) {
      var ch = challenges[i];
      await req('PATCH', '/api/challenges/' + ch._id, { isActive: true, isOpen: true }, token);
      console.log('✅ Challenge "' + ch.title + '" — ACTIVE + OPEN');
    }
  }

  // 7. Enroll all players who aren't enrolled yet
  var playersRes = await req('GET', '/api/players', null, token);
  var allPlayers = (playersRes.body.players || []).filter(function (p) { return p.role === 'player'; });
  var enrolledRes = await req('GET', '/api/games/' + game._id + '/players', null, token);
  var enrolledIds = new Set((enrolledRes.body.players || []).map(function (pg) {
    return typeof pg.userId === 'object' ? pg.userId._id : pg.userId;
  }));
  var toEnroll = allPlayers.filter(function (p) { return !enrolledIds.has(p._id); }).map(function (p) { return p._id; });
  if (toEnroll.length > 0) {
    await req('POST', '/api/games/' + game._id + '/enroll-bulk', { userIds: toEnroll }, token);
    console.log('✅ Enrolled', toEnroll.length, 'player(s)');
  } else {
    console.log('✅ All', allPlayers.length, 'player(s) already enrolled');
  }

  console.log('\n🎮 GAME IS LIVE!');
  console.log('   Opens:  NOW (' + now.toLocaleTimeString() + ')');
  console.log('   Closes: ' + close.toLocaleTimeString());
  console.log('   Players go to: http://localhost:5173');
}

run().catch(function (e) { console.error('Error:', e.message); });
