/**
 * Performance Testing Suite
 * Đo lường các metrics: API latency, bundle size, TTI, Lighthouse score
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// ===============================
// 1. BUNDLE SIZE MEASUREMENT
// ===============================
async function measureBundleSize() {
  console.log('\n MEASURING BUNDLE SIZE...\n');
  
  const distPath = path.join(__dirname, 'packages/web-frontend/dist');
  
  if (!fs.existsSync(distPath)) {
    console.log('❌ dist/ folder not found. Running build...');
    try {
      await execAsync('npm run build -w web-frontend');
    } catch (e) {
      console.error('Build failed:', e.message);
      return null;
    }
  }

  let jsSize = 0;
  let cssSize = 0;
  let totalSize = 0;

  function walkDir(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        walkDir(filePath);
      } else {
        const size = stat.size;
        totalSize += size;
        if (file.endsWith('.js') || file.endsWith('.js.gz')) jsSize += size;
        if (file.endsWith('.css') || file.endsWith('.css.gz')) cssSize += size;
      }
    });
  }

  walkDir(distPath);

  const formatBytes = (bytes) => {
    const kb = (bytes / 1024).toFixed(2);
    return `${kb}KB`;
  };

  const results = {
    jsSize: formatBytes(jsSize),
    cssSize: formatBytes(cssSize),
    totalSize: formatBytes(totalSize),
    rawBytes: { js: jsSize, css: cssSize, total: totalSize }
  };

  console.log(' Bundle Size Results:');
  console.log(`   JS (gzipped):  ${results.jsSize}`);
  console.log(`   CSS (gzipped): ${results.cssSize}`);
  console.log(`   Total:         ${results.totalSize}`);
  
  return results;
}

// ===============================
// 2. API RESPONSE TIME MEASUREMENT
// ===============================
async function measureApiLatency() {
  console.log('\n MEASURING API RESPONSE TIME...\n');

  const baseUrl = 'http://localhost:3000';
  const endpoints = [
    { method: 'GET', path: '/api/health', name: 'Health Check' },
    { method: 'GET', path: '/api/devices', name: 'Get Devices' },
    { method: 'POST', path: '/api/logs', name: 'Get Logs', body: { limit: 10 } }
  ];

  const results = [];

  for (const endpoint of endpoints) {
    const times = [];
    
    for (let i = 0; i < 5; i++) {
      const latency = await makeRequest(baseUrl, endpoint);
      if (latency) times.push(latency);
    }

    if (times.length > 0) {
      const avg = (times.reduce((a, b) => a + b) / times.length).toFixed(2);
      const min = Math.min(...times).toFixed(2);
      const max = Math.max(...times).toFixed(2);
      
      results.push({
        endpoint: endpoint.name,
        path: endpoint.path,
        avgLatency: `${avg}ms`,
        minLatency: `${min}ms`,
        maxLatency: `${max}ms`,
        rawMs: { avg: parseFloat(avg), min: parseFloat(min), max: parseFloat(max) }
      });

      console.log(` ${endpoint.name}`);
      console.log(`   Avg: ${avg}ms | Min: ${min}ms | Max: ${max}ms`);
    }
  }

  return results;
}

function makeRequest(baseUrl, endpoint) {
  return new Promise((resolve) => {
    const start = Date.now();
    const url = new URL(baseUrl + endpoint.path);

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: endpoint.method,
      headers: { 'Content-Type': 'application/json' }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const latency = Date.now() - start;
        resolve(latency);
      });
    });

    req.on('error', () => resolve(null));
    req.setTimeout(5000, () => {
      req.destroy();
      resolve(null);
    });

    if (endpoint.body) {
      req.write(JSON.stringify(endpoint.body));
    }
    req.end();
  });
}

// ===============================
// 3. LIGHTHOUSE AUDIT
// ===============================
async function runLighthouse() {
  console.log('\n🔍 RUNNING LIGHTHOUSE AUDIT...\n');

  try {
    const { stdout } = await execAsync(
      'npx lighthouse http://localhost:4173 --output=json --output-path=./lighthouse.json --chrome-flags="--headless --no-sandbox"',
      { timeout: 120000 }
    );

    const reportPath = './lighthouse.json';
    if (fs.existsSync(reportPath)) {
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      const scores = report.categories;

      const results = {
        performance: scores.performance.score * 100,
        accessibility: scores.accessibility.score * 100,
        bestPractices: scores['best-practices'].score * 100,
        seo: scores.seo.score * 100
      };

      console.log(' Lighthouse Scores:');
      console.log(`   Performance:     ${results.performance.toFixed(0)}/100`);
      console.log(`   Accessibility:   ${results.accessibility.toFixed(0)}/100`);
      console.log(`   Best Practices:  ${results.bestPractices.toFixed(0)}/100`);
      console.log(`   SEO:             ${results.seo.toFixed(0)}/100`);

      return results;
    }
  } catch (e) {
    console.log('⚠️  Lighthouse not available:', e.message);
    return null;
  }
}

// ===============================
// 4. FRONTEND LOAD TIME (TTI)
// ===============================
async function measureFrontendPerformance() {
  console.log('\n MEASURING FRONTEND LOAD TIME...\n');

  return new Promise((resolve) => {
    const start = Date.now();

    const req = http.get('http://localhost:4173', (res) => {
      let html = '';
      res.on('data', chunk => html += chunk);
      res.on('end', () => {
        const loadTime = Date.now() - start;
        const hasReact = html.includes('react');
        
        console.log(` Frontend Load Time: ${loadTime}ms`);
        console.log(`   Page size: ${(html.length / 1024).toFixed(2)}KB`);
      

        resolve({
          loadTime: `${loadTime}ms`,
          pageSize: `${(html.length / 1024).toFixed(2)}KB`,
          rawMs: loadTime
        });
      });
    });

    req.on('error', () => {
      console.log('❌ Could not reach frontend');
      resolve(null);
    });

    req.setTimeout(10000);
  });
}

// ===============================
// 5. GENERATE REPORT
// ===============================
async function generateReport() {
  console.log('='.repeat(60));
  console.log(' SMART HOME PERFORMANCE TEST REPORT');
  console.log('='.repeat(60));

  const timestamp = new Date().toISOString();
  const report = { timestamp };

  // Run all tests
  report.bundleSize = await measureBundleSize();
  report.apiLatency = await measureApiLatency();
  report.lighthouse = await runLighthouse();
  report.frontendPerformance = await measureFrontendPerformance();

  // Save report
  const reportPath = path.join(__dirname, 'performance-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(` Report saved to: ${reportPath}`);
  console.log(` Timestamp: ${timestamp}`);

  return report;
}

// Run all tests
if (require.main === module) {
  generateReport().catch(console.error);
}

module.exports = { measureBundleSize, measureApiLatency, runLighthouse, measureFrontendPerformance };
