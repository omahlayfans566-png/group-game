/**
 * setup-game.js
 * Run: node setup-game.js
 * Creates the full 7-day game so players can play immediately.
 */
const http = require('http');

const ADMIN_EMAIL    = 'admin@survivalgame.com';
const ADMIN_PASSWORD = 'Admin@2026!';

const DAYS = [
  { dayNumber: 1, dayOfWeek: 'MONDAY',    title: 'Day 1 — The Broken Machine',  type: 'BROKEN_MACHINE',  diff: 'HARD',    dur: 660,  stages: 1, desc: 'Rotate circuit nodes to connect SOURCE to SINK.',         instr: 'Click any node to rotate 90° clockwise. Align all path nodes so the signal flows from SOURCE ⚡ to SINK 🎯.' },
  { dayNumber: 2, dayOfWeek: 'TUESDAY',   title: 'Day 2 — The Pattern Vault',   type: 'PATTERN_VAULT',  diff: 'HARD',    dur: 780,  stages: 1, desc: 'Discover 4 simultaneous rules and reconstruct States 5 & 6.', instr: 'Study the 4 example states. Four rules operate simultaneously. Build States 5 AND 6 by clicking cells.' },
  { dayNumber: 3, dayOfWeek: 'WEDNESDAY', title: 'Day 3 — The Memory Vault',    type: 'MEMORY_VAULT',   diff: 'HARD',    dur: 720,  stages: 3, desc: 'Memorise the room then answer from memory.',             instr: 'Study the room. Remember positions, colors and relationships. Then answer 3 stages of questions.' },
  { dayNumber: 4, dayOfWeek: 'THURSDAY',  title: 'Day 4 — The Cipher Room',     type: 'CIPHER_ROOM',    diff: 'EXTREME', dur: 900,  stages: 4, desc: 'Four connected locks. Each answer feeds the next.',      instr: 'Break each lock in sequence. Wrong earlier answers corrupt later ones.' },
  { dayNumber: 5, dayOfWeek: 'FRIDAY',    title: 'Day 5 — The Rule Trap',       type: 'RULE_TRAP',      diff: 'EXTREME', dur: 960,  stages: 1, desc: 'Discover the hidden compound rule using limited probes.', instr: 'Select objects and probe. 7 probes maximum. Deduce the compound rule then submit your final answer.' },
  { dayNumber: 6, dayOfWeek: 'SATURDAY',  title: 'Day 6 — The Black Vault',     type: 'BLACK_VAULT',    diff: 'EXTREME', dur: 1080, stages: 5, desc: 'Five connected stages. Earn every key.',                 instr: 'Complete stages in order. Each produces a key needed for the master synthesis.' },
  { dayNumber: 7, dayOfWeek: 'SUNDAY',    title: 'Day 7 — The Final Vault',     type: 'FINAL_VAULT',    diff: 'EXTREME', dur: 1140, stages: 5, desc: 'Championship. Five stages. One winner.',                 instr: 'All mechanics combined. Every stage answer feeds the next. Final synthesis requires all 4 keys.' },
];

function req(method, path, body, token) {
  return new Promise(function(resolve, reject) {
    var data = body ? JSON.stringify(body) : null;
    var opts = {
      hostname: 'localhost', port: 5000, path: path, method: method,
      headers: Object.assign(
        { 'Content-Type': 'application/json' },
        token ? { 'Authorization': 'Bearer ' + token } : {},
        data ? { 'Content-Length': Buffer.byteLength(data) } : {}
      )
    };
    var r = http.request(opts, function(res) {
      var raw = '';
      res.on('data', function(d) { raw += d; });
      res.on('end', function() {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch(e) { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function run() {
  console.log('🚀 Setting up Survival Game...\n');

  // 1. Admin login
  var loginRes = await req('POST', '/api/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  if (!loginRes.body.success) {
    console.error('❌ Admin login failed:', loginRes.body.message);
    console.log('\nCreate admin first:');
    console.log('POST http://localhost:5000/api/auth/register-admin');
    console.log(JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, nickname: 'Admin', adminSecret: 'adm1n_s3cr3t_surv1val_2026' }, null, 2));
    return;
  }
  var token = loginRes.body.token;
  console.log('✅ Admin logged in as', loginRes.body.user.nickname || loginRes.body.user.email);

  // 2. Check for existing active game
  var gamesRes = await req('GET', '/api/games', null, token);
  var games = gamesRes.body.games || [];
  var game = games.find(function(g) { return g.status === 'ACTIVE'; });

  if (!game) {
    // Create new game
    var createRes = await req('POST', '/api/games', {
      name: 'Survival — Seven Days',
      description: '7-Day survival puzzle competition.',
      startDate: new Date().toISOString(),
      targetFinalists: 2
    }, token);
    if (!createRes.body.success) { console.error('❌ Could not create game:', createRes.body.message); return; }
    game = createRes.body.game;
    // Activate it
    await req('PATCH', '/api/games/' + game._id, { status: 'ACTIVE' }, token);
    console.log('✅ Game created:', game.name, '(' + game._id + ')');
  } else {
    console.log('✅ Using existing game:', game.name, '(' + game._id + ')');
  }

  // 3. Get existing days
  var daysRes = await req('GET', '/api/games/' + game._id + '/days', null, token);
  var existingDays = daysRes.body.days || [];
  console.log('   Existing days:', existingDays.length);

  // 4. Create missing days and challenges
  var far = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  var farEnd = new Date(Date.now() + 366 * 24 * 60 * 60 * 1000).toISOString();

  for (var i = 0; i < DAYS.length; i++) {
    var cfg = DAYS[i];
    var existingDay = existingDays.find(function(d) { return d.dayNumber === cfg.dayNumber; });

    var day = existingDay;
    if (!day) {
      var dayRes = await req('POST', '/api/games/' + game._id + '/days', {
        dayNumber: cfg.dayNumber,
        dayOfWeek: cfg.dayOfWeek,
        challengeStartTime: far,
        challengeEndTime: farEnd,
        eliminationCount: 0
      }, token);
      if (!dayRes.body.success) { console.error('❌ Day create failed:', dayRes.body.message); continue; }
      day = dayRes.body.day;
      console.log('✅ Created Day', cfg.dayNumber, '-', cfg.dayOfWeek);
    } else {
      console.log('   Day', cfg.dayNumber, 'already exists');
    }

    // Check if challenge exists
    var challRes = await req('GET', '/api/challenges?gameId=' + game._id + '&dayNumber=' + cfg.dayNumber, null, token);
    var existingChalls = challRes.body.challenges || [];

    if (existingChalls.length === 0) {
      var newCh = await req('POST', '/api/challenges', {
        gameId: game._id,
        gameDayId: day._id,
        dayNumber: cfg.dayNumber,
        title: cfg.title,
        description: cfg.desc,
        instructions: cfg.instr,
        difficulty: cfg.diff,
        challengeType: cfg.type,
        durationSeconds: cfg.dur,
        maxAttempts: 1,
        scoringMethod: 'TIME_BONUS',
        tieBreakerMethod: 'FASTEST_TIME',
        maxScore: cfg.stages > 1 ? cfg.stages * 50 : 100,
        totalStages: cfg.stages,
        isActive: true,
        isOpen: false,
        puzzleConfig: {}
      }, token);
      if (newCh.body.success) {
        console.log('✅ Created challenge: Day', cfg.dayNumber, '-', cfg.title);
      } else {
        console.error('❌ Challenge create failed for Day', cfg.dayNumber, ':', newCh.body.message);
      }
    } else {
      // Make sure it's active
      var ch = existingChalls[0];
      if (!ch.isActive) {
        await req('PATCH', '/api/challenges/' + ch._id, { isActive: true }, token);
      }
      console.log('   Challenge Day', cfg.dayNumber, 'already exists');
    }
  }

  // 5. Enroll all players
  var playersRes = await req('GET', '/api/players', null, token);
  var allPlayers = (playersRes.body.players || []).filter(function(p) { return p.role === 'player'; });
  var enrolledRes = await req('GET', '/api/games/' + game._id + '/players', null, token);
  var enrolledIds = new Set((enrolledRes.body.players || []).map(function(pg) {
    return typeof pg.userId === 'object' ? pg.userId._id : pg.userId;
  }));
  var toEnroll = allPlayers.filter(function(p) { return !enrolledIds.has(p._id); }).map(function(p) { return p._id; });
  if (toEnroll.length > 0) {
    await req('POST', '/api/games/' + game._id + '/enroll-bulk', { userIds: toEnroll }, token);
    console.log('✅ Enrolled', toEnroll.length, 'player(s)');
  } else {
    console.log('   All', allPlayers.length, 'player(s) already enrolled');
  }

  console.log('\n✅ GAME SETUP COMPLETE!');
  console.log('   Game ID:', game._id);
  console.log('\nNEXT STEPS:');
  console.log('1. Go to Admin Panel → Games tab');
  console.log('2. Click "OPEN DAY 1 FOR PLAYERS"');
  console.log('3. Players can now play!');
  console.log('\nAdmin: http://localhost:5173/admin/login');
}

run().catch(function(e) { console.error('Error:', e.message); });
