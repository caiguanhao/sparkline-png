const puppeteer = require('puppeteer');

let info = console.info;
console.info = function () {
  let args = Array.prototype.slice.call(arguments, 0);
  args[0] = (new Date).toJSON() + ' ' + args[0];
  info.apply(console, args);
};

// the puppeteer browser might cost you a lot of memory, kill it periodically
let maxTimeout = 60 * 60 * 6;
const port = 4982;
const http = require('http');
const sparkline = require('fs').readFileSync('./vendor/sparkline.js')
const html = `<html style="margin: 0">
<head><script>${sparkline}</script></head>
<body style="margin: 0">
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="50" stroke-width="1" stroke="#007bff" fill="#007bff" fill-opacity="0.1" class="sparkline"></svg>
</body></html>`
let browser = null;

const server = http.createServer((req, res) => {
  const url = req.url;
  let body = ''
  req.on('data', (chunk) => body += chunk.toString())
  req.on('end', async () => {
    try {
      const numbers = JSON.parse(body)
      const start = new Date();
      const page = await browser.newPage();
      await page.setContent(html);
      await page.evaluate((numbers) => sparkline.sparkline(document.querySelector('.sparkline'), numbers), numbers);
      await page.setViewport({ width: 200, height: 50, deviceScaleFactor: 2 });
      let ret = await page.screenshot({ omitBackground: true })
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(ret);
      console.info('GET', url, '-- size:', ret.length, '-- duration (ms):', (new Date() - start));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
      console.info('FAIL', url);
    }
  })
});

puppeteer.launch().then(_browser => {
  browser = _browser
  server.listen(port, (err) => {
    if (err) return console.error(err);
    console.info(`server is listening on ${port}`);

    setInterval(async () => {
      if (browser) {
        console.info('browser closing');
        await browser.close();
        console.info('browser closed');
        browser = await puppeteer.launch()
      }
    }, maxTimeout * 1000);
  });
});
