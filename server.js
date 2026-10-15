// Local development server for Seolho Feeding 3D
// Serves static files AND executes /api/leaderboard with shared sync across all phones!

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'leaderboard_data.json');

// Initial default leaderboard
const defaultLeaderboard = [
  { rank: 1, name: '여의도_백호선생', score: 98500, weight: 485.5, victims: 52, stage: '국회의사당', date: '방금 전' },
  { rank: 2, name: '학점포기자', score: 76200, weight: 412.0, victims: 41, stage: '대학교', date: '10분 전' },
  { rank: 3, name: '부산상어친구', score: 64100, weight: 378.2, victims: 33, stage: '동물원', date: '30분 전' },
  { rank: 4, name: '대학원탈출넘버원', score: 51200, weight: 335.0, victims: 28, stage: '대학교', date: '1시간 전' },
  { rank: 5, name: '황금멧돼지사냥꾼', score: 43900, weight: 295.4, victims: 21, stage: '국회의사당', date: '2시간 전' },
  { rank: 6, name: '설호맘', score: 32000, weight: 268.0, victims: 14, stage: '동물원', date: '3시간 전' },
  { rank: 7, name: '치킨킬러', score: 21500, weight: 242.0, victims: 9, stage: '동물원', date: '5시간 전' },
];

function readLocalLeaderboard() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch (e) {}
  return [...defaultLeaderboard];
}

function saveLocalLeaderboard(list) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save leaderboard data:', e);
  }
}

const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // --- API: /api/leaderboard ---
  if (pathname === '/api/leaderboard') {
    if (req.method === 'GET') {
      const list = readLocalLeaderboard();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({
        success: true,
        isLiveServer: true,
        source: 'local_server_shared',
        message: '로컬 멀티 디바이스 공유 서버 연동됨',
        leaderboard: list
      }));
    }

    if (req.method === 'POST') {
      let bodyStr = '';
      req.on('data', chunk => { bodyStr += chunk; });
      req.on('end', () => {
        try {
          const body = JSON.parse(bodyStr || '{}');
          const { name, score, weight, victims, stage } = body;

          if (!score || Number(score) < 1) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: '점수가 유효하지 않습니다.' }));
          }

          const cleanName = (name || '익명 사육사').trim().slice(0, 15);
          const scoreVal = Math.floor(Number(score));
          const weightVal = Number(weight || 215.0);
          const victimsVal = Number(victims || 0);
          const stageVal = stage || '동물원';
          const dateVal = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

          const list = readLocalLeaderboard();
          const existingIdx = list.findIndex(item => item.name === cleanName);

          const newEntry = {
            name: cleanName,
            score: scoreVal,
            weight: weightVal,
            victims: victimsVal,
            stage: stageVal,
            date: dateVal,
            timestamp: Date.now()
          };

          if (existingIdx >= 0) {
            list[existingIdx] = {
              ...list[existingIdx],
              ...newEntry,
              score: Math.max(list[existingIdx].score || 0, scoreVal)
            };
          } else {
            list.push(newEntry);
          }

          list.sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));
          list.forEach((item, idx) => { item.rank = idx + 1; });

          saveLocalLeaderboard(list);

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({
            success: true,
            isLiveServer: true,
            source: 'local_server_shared',
            message: `🎉 [${cleanName}]님의 점수(${scoreVal.toLocaleString()}점)가 로컬 네트워크 순위표에 갱신되었습니다!`
          }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
  }

  // --- Static Files ---
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
  if (pathname === '/ranking' || pathname === '/leaderboard') {
    filePath = path.join(__dirname, 'ranking.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
  };

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      res.end(content);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`🐯 설호 먹이주기 3D 서버가 실행되었습니다! (포트: ${PORT})`);
  console.log(`- PC 브라우저: http://localhost:${PORT}`);

  // Print all network IP addresses
  const ifaces = os.networkInterfaces();
  Object.keys(ifaces).forEach(name => {
    ifaces[name].forEach(iface => {
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log(`- 📱 폰에서 접속 주소: http://${iface.address}:${PORT}`);
        console.log(`- 📱 폰에서 랭킹 주소: http://${iface.address}:${PORT}/ranking.html`);
      }
    });
  });
  console.log(`=======================================================`);
});
