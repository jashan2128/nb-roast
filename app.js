// ─── STATE ───────────────────────────────────────────────────────────────────
let notebookContent = null;
let roastIntensity = 'mild';
let githubFocus = 'overall';

// ─── DOM REFS ─────────────────────────────────────────────────────────────────
const apiKeyInput = document.getElementById('apiKey');
const toggleKeyBtn = document.getElementById('toggleKey');
const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const fileInfo = document.getElementById('fileInfo');
const roastNotebookBtn = document.getElementById('roastNotebook');
const roastGitHubBtn = document.getElementById('roastGitHub');
const githubUserInput = document.getElementById('githubUser');
const resultEl = document.getElementById('result');
const resultTitle = document.getElementById('resultTitle');
const resultBody = document.getElementById('resultBody');
const scoreWrap = document.getElementById('scoreWrap');
const loadingEl = document.getElementById('loading');
const loadingMsg = document.getElementById('loadingMsg');
const copyResultBtn = document.getElementById('copyResult');
const roastAgainBtn = document.getElementById('roastAgain');

// ─── API KEY TOGGLE ───────────────────────────────────────────────────────────
toggleKeyBtn.addEventListener('click', () => {
  const t = apiKeyInput.type === 'password' ? 'text' : 'password';
  apiKeyInput.type = t;
  toggleKeyBtn.textContent = t === 'password' ? '👁' : '🙈';
});

// ─── TABS ──────────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    hideResult();
  });
});

// ─── INTENSITY / FOCUS BUTTONS ────────────────────────────────────────────────
document.querySelectorAll('.intensity').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.intensity').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    roastIntensity = btn.dataset.level;
  });
});

document.querySelectorAll('.focus').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.focus').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    githubFocus = btn.dataset.focus;
  });
});

// ─── FILE UPLOAD ──────────────────────────────────────────────────────────────
fileInput.addEventListener('change', () => handleFile(fileInput.files[0]));

dropZone.addEventListener('click', (e) => {
  if (!e.target.classList.contains('file-btn') && !e.target.closest('label')) {
    fileInput.click();
  }
});

dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const f = e.dataTransfer.files[0];
  if (f && f.name.endsWith('.ipynb')) handleFile(f);
  else alert('Please drop a .ipynb file!');
});

function handleFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const nb = JSON.parse(e.target.result);
      notebookContent = nb;
      fileInfo.textContent = `✓ ${file.name} — ${nb.cells ? nb.cells.length : '?'} cells loaded`;
      fileInfo.classList.remove('hidden');
    } catch {
      alert('Could not parse this .ipynb file. Make sure it\'s a valid Jupyter Notebook.');
    }
  };
  reader.readAsText(file);
}

// ─── NOTEBOOK ROAST ───────────────────────────────────────────────────────────
roastNotebookBtn.addEventListener('click', async () => {
  const key = apiKeyInput.value.trim();
  if (!key) return showError('Please enter your Gemini API key first!');
  if (!notebookContent) return showError('Please upload a .ipynb file first!');

  const cells = notebookContent.cells || [];
  const codeCells = cells.filter(c => c.cell_type === 'code').slice(0, 30);
  const mdCells = cells.filter(c => c.cell_type === 'markdown').slice(0, 10);

  const codeSnippet = codeCells.map((c, i) =>
    `--- Cell ${i+1} ---\n${(c.source || []).join('')}`
  ).join('\n\n');

  const mdSnippet = mdCells.map(c => (c.source || []).join('')).join('\n\n');

  const intensityGuide = {
    mild: 'Be constructive and encouraging but honest. Point out issues gently.',
    spicy: 'Be direct and no-nonsense. Call out bad practices clearly without sugarcoating.',
    savage: 'Be brutally honest like a frustrated senior engineer reviewing an intern\'s first notebook. Be funny but fair. Use sarcasm where appropriate.'
  };

  const prompt = `You are a senior Data Science engineer doing a code review of a Jupyter Notebook. ${intensityGuide[roastIntensity]}

Notebook stats:
- Total cells: ${cells.length}
- Code cells: ${codeCells.length}
- Markdown cells: ${mdCells.length}

Markdown content:
${mdSnippet || '(none — no documentation at all!)'}

Code cells:
${codeSnippet}

Provide your review in this exact format:

SCORE: [X/10]

🔥 OVERALL VERDICT
[2-3 sentence overall assessment]

❌ ISSUES FOUND
[List each issue with cell reference if applicable. Be specific.]

⚠️ WARNINGS
[Minor things to improve]

✅ WHAT'S GOOD
[Genuine positives, if any]

🛠️ HOW TO FIX IT
[Specific, actionable improvements with code examples where helpful]

📊 RATINGS
- Code quality: X/10
- Documentation: X/10
- Structure: X/10
- DS best practices: X/10`;

  await callGemini(key, prompt, 'Notebook Roast Results 🔥');
});

// ─── GITHUB ROAST ─────────────────────────────────────────────────────────────
roastGitHubBtn.addEventListener('click', async () => {
  const key = apiKeyInput.value.trim();
  const username = githubUserInput.value.trim();
  if (!key) return showError('Please enter your Gemini API key first!');
  if (!username) return showError('Please enter a GitHub username!');

  showLoading('Fetching GitHub profile...');

  let profileData = '';
  try {
    const [userRes, reposRes] = await Promise.all([
      fetch(`https://api.github.com/users/${username}`),
      fetch(`https://api.github.com/users/${username}/repos?sort=updated&per_page=20`)
    ]);

    if (!userRes.ok) {
      hideLoading();
      return showError(`GitHub user "${username}" not found!`);
    }

    const user = await userRes.json();
    const repos = reposRes.ok ? await reposRes.json() : [];

    const repoList = repos.map(r =>
      `- ${r.name} (⭐${r.stargazers_count}, ${r.language || 'no lang'}, ${r.description ? r.description.slice(0,60) : 'no description'})`
    ).join('\n');

    profileData = `
Username: ${user.login}
Name: ${user.name || 'Not set'}
Bio: ${user.bio || 'No bio'}
Public repos: ${user.public_repos}
Followers: ${user.followers}
Following: ${user.following}
Account created: ${user.created_at?.split('T')[0]}
Profile README: ${user.blog ? 'Has website: ' + user.blog : 'No website'}

Top Repos:
${repoList || 'No public repos'}
    `.trim();
  } catch (err) {
    hideLoading();
    return showError('Failed to fetch GitHub data. Check the username and try again.');
  }

  const focusGuide = {
    overall: 'Review everything: profile completeness, repo quality, activity, and professional presence.',
    ds: 'Focus specifically on Data Science / ML projects: notebooks, datasets, model quality, README quality for DS projects.',
    readme: 'Focus specifically on README quality across repos — documentation, instructions, badges, and presentation.'
  };

  const prompt = `You are a senior developer and hiring manager reviewing a GitHub profile. ${focusGuide[githubFocus]} Be honest, specific, and actionable. Use a ${roastIntensity === 'savage' ? 'brutally honest and slightly humorous' : roastIntensity === 'spicy' ? 'direct and no-nonsense' : 'constructive and encouraging'} tone.

GitHub Profile Data:
${profileData}

Provide your review in this exact format:

SCORE: [X/10]

🔥 OVERALL VERDICT
[2-3 sentence overall assessment of this GitHub profile]

❌ RED FLAGS
[Specific problems — missing things, weak repos, bad naming, etc.]

⚠️ NEEDS IMPROVEMENT
[Things that exist but could be better]

✅ DOING WELL
[Genuine strengths of this profile]

🛠️ ACTION PLAN
[Ranked list of specific improvements to make this profile impressive, most impactful first]

📊 RATINGS
- Profile completeness: X/10
- Repository quality: X/10
- Documentation: X/10
- ${githubFocus === 'ds' ? 'Data Science presence' : 'Professional presence'}: X/10`;

  await callGemini(key, prompt, `GitHub Roast: @${username} 🐙`);
});

// ─── GEMINI API CALL ──────────────────────────────────────────────────────────
async function callGemini(apiKey, prompt, title) {
  showLoading('Firing up the roaster...');

  const messages = [
    'Heating up the roaster...',
    'Analyzing your code crimes...',
    'Consulting the senior engineers...',
    'Almost ready to roast...'
  ];
  let mi = 0;
  const interval = setInterval(() => {
    mi = (mi + 1) % messages.length;
    loadingMsg.textContent = messages[mi];
  }, 1800);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.85, maxOutputTokens: 2048 }
        })
      }
    );

    clearInterval(interval);

    if (!res.ok) {
      const err = await res.json();
      hideLoading();
      const msg = err?.error?.message || 'API error';
      if (msg.includes('API_KEY') || msg.includes('key')) {
        return showError('Invalid API key. Get a free key at aistudio.google.com');
      }
      return showError('Gemini API error: ' + msg);
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      hideLoading();
      return showError('No response from Gemini. Try again!');
    }

    hideLoading();
    showResult(title, text);

  } catch (err) {
    clearInterval(interval);
    hideLoading();
    showError('Network error. Check your internet connection and try again.');
  }
}

// ─── UI HELPERS ───────────────────────────────────────────────────────────────
function showLoading(msg) {
  loadingMsg.textContent = msg || 'Loading...';
  loadingEl.classList.remove('hidden');
  resultEl.classList.add('hidden');
  roastNotebookBtn.disabled = true;
  roastGitHubBtn.disabled = true;
}

function hideLoading() {
  loadingEl.classList.add('hidden');
  roastNotebookBtn.disabled = false;
  roastGitHubBtn.disabled = false;
}

function showResult(title, text) {
  resultTitle.textContent = title;

  // Extract score
  const scoreMatch = text.match(/SCORE:\s*(\d+)\/10/i);
  scoreWrap.innerHTML = '';
  if (scoreMatch) {
    const score = parseInt(scoreMatch[1]);
    const cls = score >= 7 ? 'green' : score >= 4 ? 'amber' : 'red';
    const emoji = score >= 7 ? '🟢' : score >= 4 ? '🟡' : '🔴';
    scoreWrap.innerHTML = `<span class="score-pill ${cls}">${emoji} Score: ${score}/10</span>`;
  }

  // Format text to HTML
  const formatted = text
    .replace(/SCORE:.*\n?/g, '')
    .replace(/^(#{1,3} .+)$/gm, (m, h) => `<h3>${h.replace(/^#+\s*/, '')}</h3>`)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^(🔥|❌|⚠️|✅|🛠️|📊).+$/gm, m => `<strong>${m}</strong>`)
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`);

  resultBody.innerHTML = formatted;
  resultEl.classList.remove('hidden');
  resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function hideResult() {
  resultEl.classList.add('hidden');
}

function showError(msg) {
  resultTitle.textContent = '⚠️ Oops';
  scoreWrap.innerHTML = '';
  resultBody.innerHTML = `<span style="color: var(--red);">${msg}</span>`;
  resultEl.classList.remove('hidden');
  resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─── COPY RESULT ─────────────────────────────────────────────────────────────
copyResultBtn.addEventListener('click', () => {
  const text = resultBody.innerText;
  navigator.clipboard.writeText(text).then(() => {
    copyResultBtn.textContent = '✅';
    setTimeout(() => { copyResultBtn.textContent = '📋'; }, 2000);
  });
});

// ─── ROAST AGAIN ─────────────────────────────────────────────────────────────
roastAgainBtn.addEventListener('click', () => {
  hideResult();
  window.scrollTo({ top: document.getElementById('roast').offsetTop, behavior: 'smooth' });
});
