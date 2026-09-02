const terminal = document.getElementById('terminal');
const history = document.getElementById('history');
const input = document.getElementById('input');
const screen = document.querySelector('.screen');
const prompt = document.querySelector('.prompt');
const promptPath = document.getElementById('prompt-path');
const promptDirectory = document.getElementById('prompt-directory');
const promptSign = document.getElementById('prompt-sign');
const sequenceSeenKey = 'xinit-terminal-sequence-seen';

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

function hasSeenSequence() {
  try {
    return window.localStorage.getItem(sequenceSeenKey) === 'true';
  } catch {
    return false;
  }
}

function rememberSequence() {
  try {
    window.localStorage.setItem(sequenceSeenKey, 'true');
  } catch {
    // Storage may be disabled; the terminal still works without persistence.
  }
}

const decoyFiles = [
  ['/srv/meridian/archive/personnel/roster_17.dat', ['RECORD COUNT: 43', 'CLEARANCE: INTERNAL', 'CONTENT: [ENCRYPTED]']],
  ['/opt/bm/vault/field_reports/caspian.log', ['REPORT 71-C', 'STATUS: ARCHIVED', 'COORDINATES: [REDACTED]']],
  ['/var/lib/meridian/routes/blacksite.enc', ['CIPHER: BM-4096', 'KEY SLOT: EMPTY', 'READ FAILED']],
  ['/srv/meridian/intel/contracts/ledger.tmp', ['TRANSFER INDEX: 00931', 'BENEFICIARY: [REMOVED]', 'CHECKSUM MISMATCH']],
  ['/opt/bm/archive/audio/transcript_04.txt', ['CHANNEL: UNKNOWN', 'LANGUAGE: [UNRESOLVED]', 'SIGNAL LOST AT 03:17:22']]
];

async function printLine(text, className = 'output', speed = 7) {
  const line = document.createElement('p');
  line.className = className;
  history.appendChild(line);

  for (const character of text) {
    line.textContent += character;
    terminal.scrollTop = terminal.scrollHeight;
    await wait(speed + Math.random() * 6);
  }
}

function commitCommandLine() {
  const committed = prompt.cloneNode(true);
  committed.classList.add('command');
  committed.classList.remove('is-busy');
  committed.querySelector('.cursor').remove();
  committed.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
  history.appendChild(committed);
  terminal.scrollTop = terminal.scrollHeight;
}

function setPrompt(path, directory, sign) {
  promptPath.textContent = path;
  promptDirectory.textContent = directory;
  promptSign.textContent = sign;
}

async function type(text, speed = 72) {
  input.textContent = '';
  for (const character of text) {
    input.textContent += character;
    await wait(speed + Math.random() * 62);
  }
}

async function command(text, output = [], pause = 900, nextPrompt = null) {
  await type(text);
  commitCommandLine();
  input.textContent = '';
  prompt.classList.add('is-busy');
  for (const item of output) {
    await wait(110 + Math.random() * 110);
    await printLine(item.text || item, item.className || 'output');
  }
  if (output.length > 0) {
    await wait(320);
  }
  if (nextPrompt) {
    setPrompt(nextPrompt.path, nextPrompt.directory, nextPrompt.sign);
  }
  prompt.classList.remove('is-busy');
  await wait(pause);
}

function shuffledFiles() {
  return [...decoyFiles].sort(() => Math.random() - .5).slice(0, 3);
}

async function bruteForce() {
  await type('auth-audit --simulation --port 42 root@brokenmeridian.com');
  commitCommandLine();
  input.textContent = '';
  prompt.classList.add('is-busy');

  const progress = document.createElement('p');
  progress.className = 'output brute-progress';
  history.appendChild(progress);

  const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  const passwordLength = 12;
  let frame = 0;

  for (let found = 0; found <= passwordLength; found += 1) {
    const mask = `${'*'.repeat(found)}${'·'.repeat(passwordLength - found)}`;
    const framesBeforeNextCharacter = found === passwordLength ? 2 : 7;

    for (let step = 0; step < framesBeforeNextCharacter; step += 1) {
      progress.textContent = `${spinner[frame++ % spinner.length]} searching keyspace  [${mask}]`;
      terminal.scrollTop = terminal.scrollHeight;
      await wait(95);
    }
  }

  await wait(320);
  await printLine('PASSWORD FOUND — saved to ./passwd', 'alert', 9);
  await wait(650);
  prompt.classList.remove('is-busy');
  await wait(1000);
}

async function runSequence() {
  await wait(5000);

  const targetIp = `203.0.113.${Math.floor(Math.random() * 254) + 1}`;
  const queryTime = Math.floor(Math.random() * 47) + 18;

  await command('dig brokenmeridian.com A', [
    { text: '; <<>> DiG 9.18.24 <<>> brokenmeridian.com A', className: 'dim' },
    { text: ';; QUESTION SECTION:', className: 'dim' },
    ';brokenmeridian.com.       IN      A',
    { text: ';; ANSWER SECTION:', className: 'dim' },
    `brokenmeridian.com.  300   IN      A       ${targetIp}`,
    { text: `;; Query time: ${queryTime} msec`, className: 'dim' }
  ]);

  await command(`nmap -sV -p 42,80,443 ${targetIp}`, [
    { text: 'Starting Nmap 7.95', className: 'dim' },
    `Nmap scan report for brokenmeridian.com (${targetIp})`,
    'Host is up (0.041s latency).',
    { text: 'PORT    STATE     SERVICE  VERSION', className: 'dim' },
    '42/tcp  open      ssh      OpenSSH 9.6p1',
    '80/tcp  closed    http',
    '443/tcp filtered  https',
    { text: 'Nmap done: 1 IP address (1 host up) scanned', className: 'dim' }
  ]);

  await bruteForce();

  await command('ssh -p 42 root@brokenmeridian.com -password `cat ./passwd`', [
    { text: 'establishing encrypted session .....', className: 'dim' },
    'authentication accepted',
    'Linux bm-node-07 6.6.18-amd64 x86_64',
    'privilege context: root'
  ], 900, { path: 'root@bm-node-07', directory: '/', sign: '#' });

  await command('mount vault://broken-meridian /mnt/bm', [
    'mounting remote archive ... OK',
    'classification index ...... RESTRICTED'
  ], 900, { path: 'root@bm-node-07', directory: '/mnt/bm', sign: '#' });

  for (const [path, lines] of shuffledFiles()) {
    await command(`cat ${path}`, lines.map((text) => ({
      text,
      className: text.includes('FAILED') || text.includes('MISMATCH') ? 'dim' : 'output'
    })), 750);
  }

  await command('find /mnt/bm -class top_secret -name trust_no1', [
    '/mnt/bm/documents/top_secret/operations/trust_no1'
  ], 1100);

  await command('cat /mnt/bm/documents/top_secret/operations/trust_no1', [
    { text: '╔══════════════════════════════════════════════╗', className: 'secret' },
    { text: '  BROKEN MERIDIAN // TOP SECRET', className: 'secret' },
    { text: '  OPERATION: NOVUS ORDO', className: 'secret alert' },
    { text: '  COMMENCEMENT: 05.11.2026', className: 'secret alert' },
    { text: '  OBJECTIVE: [REDACTED]', className: 'secret redacted' },
    { text: '  LOCATION:  [REDACTED]', className: 'secret redacted' },
    { text: '╚══════════════════════════════════════════════╝', className: 'secret' }
  ], 650);

  await wait(4500);
  screen.classList.add('glitching');
  await wait(180);
  history.replaceChildren();
  input.textContent = '';
  setPrompt('xinit', '~', '$');
  terminal.scrollTop = 0;
  screen.classList.remove('glitching');
  rememberSequence();
}

if (!hasSeenSequence()) {
  runSequence();
}
