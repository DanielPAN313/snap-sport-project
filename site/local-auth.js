(function () {
  var AUTH_KEY = 'another-me-local-auth';
  var LEGACY_AUTH_KEY = 'tabb_auth';

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function normalizeUsername(value) {
    return String(value || '').trim().toLowerCase();
  }

  function sessionFromApiUser(user) {
    return {
      id: user.id,
      name: user.name || user.username,
      email: user.email || user.username,
      username: user.username,
      role: user.role || 'merchant',
      token: user.token,
      signedInAt: new Date().toISOString(),
    };
  }

  async function postAuth(path, body) {
    var response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Authentication failed');
    }
    return data;
  }

  function syncLegacyAuth(session) {
    var legacy = {
      mode: session.role === 'agent' ? 'agent' : 'merchant',
      token: session.token,
      agentName: session.name,
      email: session.email,
    };
    writeJson(LEGACY_AUTH_KEY, legacy);
    localStorage.setItem('another-me_tour_seen', 'true');
    localStorage.setItem('merchant_dashboard_tour_seen', 'true');
  }

  function saveSession(session) {
    writeJson(AUTH_KEY, session);
    syncLegacyAuth(session);
  }

  function getSession() {
    return readJson(AUTH_KEY, null);
  }

  function clearSession() {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(LEGACY_AUTH_KEY);
  }

  function finishLogin() {
    document.body.classList.remove('local-auth-lock');
    renderUserbar();
    window.dispatchEvent(new Event('another-me-auth-change'));
    if (document.getElementById('root') && location.pathname !== '/dashboard') {
      location.replace('/dashboard');
    }
  }

  function makeField(label, inputHtml) {
    return '<label class="local-auth-field"><span>' + label + '</span>' + inputHtml + '</label>';
  }

  function renderOverlay(mode, message) {
    var isSignup = mode === 'signup';
    var overlay = document.createElement('div');
    overlay.className = 'local-auth-overlay';
    overlay.innerHTML = [
      '<section class="local-auth-card" role="dialog" aria-modal="true" aria-labelledby="localAuthTitle">',
      '  <div class="local-auth-grid">',
      '    <div class="local-auth-brief">',
      '      <div>',
      '        <div class="local-auth-kicker">南京样板区 MVP</div>',
      '        <h1 id="localAuthTitle" class="local-auth-title">登录宁约球</h1>',
      '        <p class="local-auth-copy">演示版继续复用现有 MySQL 登录系统；上线微信小程序时，将这里替换为微信一键登录，业务数据表和后端接口可以继续沿用。</p>',
      '      </div>',
      '      <div class="local-auth-signal-row" aria-label="Login features">',
      '        <div class="local-auth-chip">免注册思路<span>微信身份直进</span></div>',
      '        <div class="local-auth-chip">数据库已接<span>MySQL + bcrypt</span></div>',
      '        <div class="local-auth-chip">信用闭环<span>支付 / 核销 / 爽约</span></div>',
      '      </div>',
      '    </div>',
      '    <div class="local-auth-panel">',
      '      <div class="local-auth-tabs">',
      '        <button class="local-auth-switch ' + (!isSignup ? 'is-active' : '') + '" type="button" data-auth-mode="login">Login</button>',
      '        <button class="local-auth-switch ' + (isSignup ? 'is-active' : '') + '" type="button" data-auth-mode="signup">Register</button>',
      '      </div>',
      '      <form class="local-auth-form" data-local-auth-form>',
      makeField('用户名', '<input name="username" autocomplete="username" required maxlength="50" placeholder="例如 nj_player_001" />'),
      makeField('密码', '<input name="password" type="password" autocomplete="current-password" required minlength="6" placeholder="至少 6 位" />'),
      '        <button class="local-auth-submit" type="submit">' + (isSignup ? '创建演示账号' : '进入宁约球') + '</button>',
      '        <p class="local-auth-error" data-auth-error>' + (message || '') + '</p>',
      '        <p class="local-auth-note">账号写入 MySQL，密码仅保存 bcrypt 哈希。微信登录在生产环境替换。</p>',
      '      </form>',
      '    </div>',
      '  </div>',
      '</section>',
    ].join('');

    document.body.appendChild(overlay);
    document.body.classList.add('local-auth-lock');

    overlay.querySelectorAll('[data-auth-mode]').forEach(function (button) {
      button.addEventListener('click', function () {
        overlay.remove();
        renderOverlay(button.getAttribute('data-auth-mode'));
      });
    });

    overlay.querySelector('[data-local-auth-form]').addEventListener('submit', async function (event) {
      event.preventDefault();
      var form = event.currentTarget;
      var username = normalizeUsername(form.username.value);
      var password = String(form.password.value || '');
      var errorNode = overlay.querySelector('[data-auth-error]');
      var submitButton = form.querySelector('.local-auth-submit');
      errorNode.textContent = '';
      submitButton.disabled = true;

      try {
        var data = await postAuth(isSignup ? '/api/auth/register' : '/api/auth/login', {
          username: username,
          password: password,
        });
        saveSession(sessionFromApiUser(data.user));
        overlay.remove();
        finishLogin();
      } catch (error) {
        errorNode.textContent = error.message || 'Authentication failed';
      } finally {
        if (document.body.contains(submitButton)) {
          submitButton.disabled = false;
        }
      }
    });

    var firstInput = overlay.querySelector('input');
    if (firstInput) firstInput.focus();
  }

  function renderUserbar() {
    var oldBar = document.querySelector('[data-local-auth-userbar]');
    if (oldBar) oldBar.remove();
    var session = getSession();
    if (!session) return;
    syncLegacyAuth(session);
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"]/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char];
    });
  }

  function boot() {
    var session = getSession();
    if (session) {
      syncLegacyAuth(session);
      renderUserbar();
      return;
    }
    renderOverlay('login');
  }

  window.AnotherMeLocalAuth = {
    getSession: getSession,
    logout: function () {
      clearSession();
      location.reload();
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
