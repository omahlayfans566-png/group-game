const http = require('http');
const ADMIN_EMAIL = 'admin@survivalgame.com';
const ADMIN_PASSWORD = 'Admin@2026!';

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
  var loginRes = await req('POST', '/api/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  var token = loginRes.body.token;
  console.log('✅ Logged in');

  var gamesRes = await req('GET', '/api/games', null, token);
  var game = (gamesRes.body.games || []).find(function(g) { return g.status === 'ACTIVE'; });
  if (!game) { console.error('No active game'); return; }

  var daysRes = await req('GET', '/api/games/' + game._id + '/days', null, token);
  var days = daysRes.body.days || [];
  var day1 = days.find(function(d) { return d.dayNumber === 1; });
  if (!day1) { console.error('Day 1 not found'); return; }

  // Open Day 1 via the new route
  var openRes = await req('POST', '/api/games/' + game._id + '/days/' + day1._id + '/open', { forceCloseOthers: true }, token);
  if (openRes.body.success) {
    console.log('✅ DAY 1 IS NOW OPEN! Players can play.');
  } else {
    // Fallback: direct PATCH
    await req('PATCH', '/api/games/' + game._id + '/days/' + day1._id, { status: 'OPEN' }, token);
    var challRes = await req('GET', '/api/challenges?gameId=' + game._id + '&dayNumber=1', null, token);
    var ch = (challRes.body.challenges || [])[0];
    if (ch) {
      await req('PATCH', '/api/challenges/' + ch._id, { isOpen: true, isActive: true }, token);
    }
    await req('PATCH', '/api/games/' + game._id, { currentDay: 1 }, token);
    console.log('✅ DAY 1 OPENED (fallback method). Players can play.');
    console.log('   Message:', openRes.body.message);
  }
}

run().catch(function(e) { console.error(e.message); });
