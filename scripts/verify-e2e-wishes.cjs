const http = require('http');
const Database = require('better-sqlite3');
const path = require('path');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch(e) {
          resolve({ status: res.statusCode, text: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function run() {
  console.log('=== STEP 1: INITIAL STATE IN SQLITE DATABASE ===');
  const db = new Database(path.resolve('storage/db/app.sqlite'), { readonly: true });
  const beforeRows = db.prepare("SELECT id, guest_name, attendance_status, message, is_hidden, datetime(created_at/1000, 'unixepoch', 'localtime') as created_at_local FROM wishes WHERE invitation_id = ? ORDER BY created_at DESC").all('inv-raden-motion-demo');
  console.log(`Current wishes count in SQLite: ${beforeRows.length}`);
  beforeRows.forEach((r, idx) => console.log(`  ${idx+1}. [${r.attendance_status}] ${r.guest_name}: "${r.message}" (${r.created_at_local})`));

  console.log('\n=== STEP 2: VERIFY GET VIA VITE SERVER (PORT 5173) ===');
  const getBefore = await request({
    hostname: 'localhost',
    port: 5173,
    path: '/api/invitations/raden-motion/wishes?limit=10',
    method: 'GET'
  });
  console.log(`HTTP Status: ${getBefore.status}`);
  console.log(`Returned data count: ${getBefore.data?.data?.length}`);

  console.log('\n=== STEP 3: SUBMIT NEW WISH VIA POST TO VITE PROXY ===');
  const testGuest = 'Tamu Verifikasi Otomatis';
  const testMessage = 'Semoga langgeng dan bahagia selamanya (Verifikasi Database & Browser)';
  const postRes = await request({
    hostname: 'localhost',
    port: 5173,
    path: '/api/invitations/raden-motion/wishes',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  }, {
    guestName: testGuest,
    attendanceStatus: 'attending',
    message: testMessage
  });
  console.log(`POST Status: ${postRes.status}`);
  console.log('POST Response:', postRes.data);

  console.log('\n=== STEP 4: VERIFY NEW WISH STORED DIRECTLY IN SQLITE DB ===');
  const afterRows = db.prepare("SELECT id, guest_name, attendance_status, message, is_hidden, datetime(created_at/1000, 'unixepoch', 'localtime') as created_at_local FROM wishes WHERE invitation_id = ? ORDER BY created_at DESC").all('inv-raden-motion-demo');
  console.log(`New wishes count in SQLite: ${afterRows.length} (increased by ${afterRows.length - beforeRows.length})`);
  const newest = afterRows[0];
  console.log('Newest record in SQLite table:');
  console.log(`  ID: ${newest.id}`);
  console.log(`  Nama: ${newest.guest_name}`);
  console.log(`  Status Kehadiran: ${newest.attendance_status}`);
  console.log(`  Pesan: ${newest.message}`);
  console.log(`  Waktu Simpan: ${newest.created_at_local}`);
  console.log(`  is_hidden: ${newest.is_hidden}`);

  const isVerifiedInDb = newest.guest_name === testGuest && newest.message === testMessage;
  console.log(`Database match check: ${isVerifiedInDb ? 'VERIFIED (100% MATCH)' : 'MISMATCH'}`);

  console.log('\n=== STEP 5: VERIFY NEW WISH APPEARS AT TOP IN API RESPONSE ===');
  const getAfter = await request({
    hostname: 'localhost',
    port: 5173,
    path: '/api/invitations/raden-motion/wishes?limit=10',
    method: 'GET'
  });
  console.log(`HTTP Status: ${getAfter.status}`);
  console.log(`Returned data count: ${getAfter.data?.data?.length}`);
  const topApiItem = getAfter.data?.data?.[0];
  console.log(`Top item in API response: [${topApiItem?.attendanceStatus}] ${topApiItem?.guestName}: "${topApiItem?.message}"`);

  const isVerifiedInApi = topApiItem?.id === newest.id;
  console.log(`API response match check: ${isVerifiedInApi ? 'VERIFIED (APPEARS AT TOP)' : 'MISMATCH'}`);

  console.log('\n=== STEP 6: VERIFY SUMMARY IN PUBLIC INVITATION PAYLOAD ===');
  const invPayload = await request({
    hostname: 'localhost',
    port: 5173,
    path: '/api/invitations/raden-motion',
    method: 'GET'
  });
  console.log('Updated Wish Summary:', invPayload.data?.wishSummary);

  db.close();
}

run().catch(console.error);
