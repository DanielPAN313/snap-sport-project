(function () {
  var state = {
    mode: 'user',
    userView: 'home',
    venueFilter: 'all',
    sportFilter: 'all',
    data: {
      venues: [],
      games: [],
      me: null,
      metrics: null,
      orders: [],
      myOrders: [],
      credit: [],
      users: [],
      rating: null,
      ratingRows: [],
      teams: [],
      clips: [],
      uploads: [],
    },
    reviewDetail: null,
    playerProfile: null,
    gameDetail: null,
    joinConfirm: null,
    venueBooking: null,
    toast: '',
  };

  var app = document.getElementById('app');

  function session() {
    return window.AnotherMeLocalAuth && window.AnotherMeLocalAuth.getSession
      ? window.AnotherMeLocalAuth.getSession()
      : null;
  }

  function authHeaders() {
    var user = session() || {};
    return {
      'Content-Type': 'application/json',
      'X-User-Id': user.id || 1,
      'X-Username': user.username || user.name || 'demo_player',
    };
  }

  async function api(path, options) {
    var response = await fetch(path, Object.assign({
      headers: authHeaders(),
    }, options || {}));
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || '请求失败');
    }
    return data;
  }

  function money(value) {
    return '¥' + Number(value || 0).toFixed(0);
  }

  function fmtDate(value) {
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  function dayParts(value) {
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return { day: '--', month: '--' };
    return {
      day: String(date.getDate()).padStart(2, '0'),
      month: String(date.getMonth() + 1).padStart(2, '0') + '月',
    };
  }

  function h(value) {
    return String(value == null ? '' : value).replace(/[&<>"]/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char];
    });
  }

  function sportLabel(value) {
    return value === 'football' ? '足球' : value === 'basketball' ? '篮球' : value;
  }

  function statusLabel(status) {
    return {
      approved: '已合作',
      pending: '待审核',
      rejected: '未通过',
      paid: '已支付',
      checked_in: '已核销',
      open: '报名中',
      active: '活跃',
      queued: '排队中',
      submitted: '已提交',
      cancelled: '已取消',
    }[status] || status;
  }

  var ratingDimensions = [
    ['technique', '基础技术', '传停带射基本功'],
    ['physical', '身体素质', '速度、体能、对抗能力'],
    ['tactics', '战术意识', '跑位、配合、大局观'],
    ['defense', '防守能力', '抢断、卡位、补位'],
    ['attitude', '场上态度', '团队配合、遵守规则'],
  ];

  var ratingPresets = [
    ['beginner', '入门', 1],
    ['casual', '业余', 2],
    ['advanced', '进阶', 3],
    ['expert', '高手', 4],
    ['master', '大神', 5],
  ];

  function score(value, fallback) {
    var next = Number(value == null ? fallback : value);
    if (Number.isNaN(next)) next = fallback || 3;
    return Math.max(1, Math.min(5, next));
  }

  function oneDecimal(value, fallback) {
    return score(value, fallback).toFixed(1);
  }

  function ratingLabel(scoreValue) {
    var value = Number(scoreValue || 0);
    if (value >= 4.6) return '大神';
    if (value >= 4.0) return '高手';
    if (value >= 3.0) return '进阶';
    if (value >= 2.0) return '业余';
    return '入门';
  }

  function ratingSummary() {
    return state.data.rating || {
      composite_score: 3,
      level_label: '进阶',
      self_score: 3,
      peer_score: null,
      effective_peer_games: 0,
      peer_rating_count: 0,
    };
  }

  function guideSeen() {
    return window.localStorage.getItem('nyq_rating_guide_seen') === '1';
  }

  function initials(name) {
    return String(name || '球员').slice(0, 1).toUpperCase();
  }

  function parseTrend(value) {
    try {
      var parsed = typeof value === 'string' ? JSON.parse(value || '[]') : value;
      return Array.isArray(parsed) ? parsed.slice(-10) : [];
    } catch {
      return [];
    }
  }

  function starSlider(name, value, prefix) {
    var inputName = prefix ? prefix + '-' + name : name;
    var current = Math.round(score(value, 3));
    return [
      '<label class="rating-dimension">',
      '  <span><strong>' + h((ratingDimensions.find(function (item) { return item[0] === name; }) || [name, name])[1]) + '</strong><em>' + h((ratingDimensions.find(function (item) { return item[0] === name; }) || [name, name, ''])[2]) + '</em></span>',
      '  <div class="star-slider">',
      '    <input type="range" min="1" max="5" step="1" name="' + h(inputName) + '" value="' + h(current) + '" data-rating-range data-rating-dimension="' + h(name) + '" />',
      '    <div class="stars" aria-hidden="true">' + [1, 2, 3, 4, 5].map(function (item) { return '<span class="' + (item <= current ? 'is-on' : '') + '">★</span>'; }).join('') + '</div>',
      '    <strong data-rating-value="' + h(inputName) + '">' + h(current) + '</strong>',
      '  </div>',
      '</label>',
    ].join('');
  }

  function ratingBadge(summary, userId) {
    var label = summary && summary.level_label ? summary.level_label : ratingLabel(summary && summary.composite_score);
    var value = oneDecimal(summary && summary.composite_score, 3);
    var attrs = userId ? ' data-player-profile="' + h(userId) + '"' : '';
    return '<button class="rating-badge" type="button"' + attrs + '><span>' + h(label) + '</span><strong>' + value + '分</strong></button>';
  }

  function showToast(message) {
    state.toast = message;
    render();
    setTimeout(function () {
      if (state.toast === message) {
        state.toast = '';
        render();
      }
    }, 2600);
  }

  async function loadBootstrap() {
    var data = await api('/api/sports-app/bootstrap');
    state.data.venues = data.venues || [];
    state.data.games = data.games || [];
    state.data.me = data.summary || data.me || null;
    state.data.rating = data.rating || null;
    state.data.metrics = data.metrics || null;
    state.data.myOrders = data.orders || [];
    state.data.credit = data.credit || [];
    state.data.teams = data.teams || [];
    state.data.clips = data.clips || [];
    state.data.uploads = data.uploads || [];
  }

  async function loadOrders() {
    state.data.orders = await api('/api/sports-app/orders');
  }

  async function loadUsers() {
    state.data.users = await api('/api/sports-app/admin/users');
  }

  async function loadRatings() {
    state.data.ratingRows = await api('/api/sports-app/admin/ratings');
  }

  async function refreshModeData() {
    await loadBootstrap();
    if (state.mode === 'venue') await loadOrders();
    if (state.mode === 'admin') {
      await loadUsers();
      await loadRatings();
    }
  }

  function topbar() {
    var user = session();
    return [
      '<header class="topbar">',
      '  <div class="brand">',
      '    <div class="brand-mark">NYQ</div>',
      '    <div><h1>宁约球</h1><p>南京高校/园区约局 + 场馆预订</p></div>',
      '  </div>',
      '  <div class="muted">' + h(user ? user.username || user.name : '未登录') + '</div>',
      '</header>',
    ].join('');
  }

  function tabButton(mode, label) {
    return '<button type="button" data-mode="' + mode + '" class="' + (state.mode === mode ? 'is-active' : '') + '">' + label + '</button>';
  }

  function metric(label, value) {
    return '<div class="metric"><span>' + h(label) + '</span><strong>' + h(value) + '</strong></div>';
  }

  function hero() {
    var metrics = state.data.metrics || {};
    var me = state.data.me || {};
    var rating = ratingSummary();
    var approved = state.data.venues.filter(function (venue) { return venue.status === 'approved'; });
    var hotVenue = approved[0] || {};
    var nextGames = (state.data.games || []).slice(0, 2);
    var featuredVenues = approved.slice(0, 3);
    return [
      '<section class="miniapp-home">',
      '  <div class="home-search-row">',
      '    <button class="location-pill" type="button" data-area-filter="all">南京</button>',
      '    <button class="search-box" type="button" data-jump-view="venues">请输入场馆名称、地址</button>',
      '    <button class="mini-icon-btn" type="button" data-jump-view="venues">地图</button>',
      '    <button class="mini-icon-btn" type="button" data-jump-view="messages">消息</button>',
      '  </div>',
      '  <div class="service-strip">',
      serviceTile('community', '社区', '找球友', 'messages'),
      serviceTile('team', '球队', '固定队', 'teams'),
      serviceTile('football', '足球场', '立即订', 'venues'),
      serviceTile('basketball', '篮球场', '快速订', 'games'),
      serviceTile('publish', '发布', '发局报名', 'create'),
      '  </div>',
      '  <button class="home-banner" type="button" data-open-venue-book="' + h(hotVenue.id || '') + '">',
      '    <div class="home-banner-copy">',
      '      <span class="tag orange">今日推荐</span>',
      '      <h2>周末 ' + money(hotVenue.price_per_hour || 180) + ' 起订场</h2>',
      '      <p>' + h(hotVenue.name || '江宁合作球馆') + ' · ' + h(hotVenue.area || '江宁大学城') + '</p>',
      '      <strong>' + h((hotVenue.open_slots || ['周末黄金时段'])[0]) + '</strong>',
      '    </div>',
      '    <div class="home-banner-action"><span>立即订场</span><b>→</b></div>',
      '  </button>',
      '  <section class="section">',
      '    <div class="panel-title"><h3>今日球局(' + h((state.data.games || []).length) + ')</h3><button class="text-link" type="button" data-jump-view="games">更多</button></div>',
      '    <div class="home-game-list">' + nextGames.map(homeGameCard).join('') + '</div>',
      '  </section>',
      '  <div class="home-mini-grid">',
      '    <article class="mini-promo"><span class="tag blue">好馆尝鲜</span><strong>精选合作场馆</strong><p>先看离你近的，再看价格和时段。</p></article>',
      '    <article class="mini-promo"><span class="tag">球友笔记</span><strong>记录你的出勤</strong><p>签到、报名、守约都能追踪。</p></article>',
      '    <article class="mini-promo"><span class="tag orange">球队管理</span><strong>固定队伍入口</strong><p>队长可建队，成员可加入。</p></article>',
      '  </div>',
      '  <section class="section">',
      '    <div class="panel-title"><h3>推荐场馆</h3><button class="text-link" type="button" data-jump-view="venues">更多</button></div>',
      '    <div class="home-venue-list">' + featuredVenues.map(homeVenueCard).join('') + '</div>',
      '  </section>',
      '</section>',
    ].join('');
  }

  function serviceTile(icon, label, note, view) {
    return '<button class="service-tile" type="button" data-jump-view="' + h(view) + '"><span class="service-icon service-icon-' + h(icon) + '" aria-hidden="true"></span><strong>' + h(label) + '</strong><small>' + h(note) + '</small></button>';
  }

  function homeGameCard(game) {
    var players = game.players || [];
    return [
      '<button class="home-game-card" type="button" data-game-detail="' + h(game.id) + '">',
      '  <div class="home-game-time"><strong>' + h(dayParts(game.start_time).day) + '</strong><span>' + h(dayParts(game.start_time).month) + '</span></div>',
      '  <div class="home-game-main">',
      '    <h4>' + h(game.title || '附近球局') + '</h4>',
      '    <p>' + h(game.venue_name || '合作场馆') + ' / ' + h(fmtDate(game.start_time)) + '</p>',
      '    <div class="home-game-meta"><span>已报名 ' + h(game.joined_count || 0) + '/' + h(game.capacity || 0) + ' 人</span><span>实力 ' + oneDecimal(game.average_rating, 3) + ' 分</span></div>',
      '    <div class="avatar-row">' + (players.length ? players.slice(0, 4).map(function (player) { return '<span class="avatar-mini">' + h(initials(player.username)) + '</span>'; }).join('') : '<span class="muted">报名后显示球友</span>') + '</div>',
      '  </div>',
      '  <div class="home-game-side">',
      '    <strong>' + money(game.fee_per_person) + '</strong>',
      '    <span>' + (game.is_joined ? '已报名' : '报名') + '</span>',
      '  </div>',
      '</button>',
    ].join('');
  }

  function homeVenueCard(venue) {
    return [
      '<button class="home-venue-card" type="button" data-open-venue-book="' + h(venue.id) + '">',
      '  <img src="' + h(venue.cover_url || 'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=1200&q=80') + '" alt="' + h(venue.name) + '" />',
      '  <div class="home-venue-body">',
      '    <div class="item-head"><h4>' + h(venue.name) + '</h4><span class="tag ' + (venue.status === 'approved' ? '' : 'gray') + '">' + statusLabel(venue.status) + '</span></div>',
      '    <div class="venue-score-row"><strong>' + (4.3 + (Number(venue.id || 1) % 6) / 10).toFixed(1) + '分</strong><span>' + h((venue.open_slots || ['可订时段'])[0]) + '</span></div>',
      '    <p>' + h(venue.area) + ' · ' + h(venue.address) + '</p>',
      '    <div class="split-row"><span class="tag blue">限时折扣</span><strong class="price">' + money(venue.price_per_hour) + '/小时</strong></div>',
      '  </div>',
      '</button>',
    ].join('');
  }

  function userTabs() {
    var tabs = [
      ['home', '首页'],
      ['venues', '找球场'],
      ['games', '看球局'],
      ['create', '发局'],
      ['teams', '球队'],
      ['messages', '消息'],
      ['me', '个人中心'],
    ];
    return '<div class="section view-tabs">' + tabs.map(function (item) {
      return '<button type="button" data-user-view="' + item[0] + '" class="' + (state.userView === item[0] ? 'is-active' : '') + '">' + item[1] + '</button>';
    }).join('') + '</div>';
  }

  function venueCard(venue) {
    var sports = (venue.sports || []).map(sportLabel);
    var sold = Math.max(18, Number(venue.id || 1) * 37);
    var rating = (4.3 + (Number(venue.id || 1) % 6) / 10).toFixed(1);
    return [
      '<article class="item-card venue-book-card">',
      '  <div class="venue-cover-wrap"><img src="' + h(venue.cover_url || 'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=1200&q=80') + '" alt="' + h(venue.name) + '" /><span class="venue-distance">约 ' + (1.2 + (Number(venue.id || 1) % 5) * 0.7).toFixed(1) + 'km</span></div>',
      '  <div class="item-body">',
      '    <div class="item-head"><h4>' + h(venue.name) + '</h4><span class="tag ' + (venue.status === 'approved' ? '' : 'gray') + '">' + statusLabel(venue.status) + '</span></div>',
      '    <div class="venue-score-row"><strong>' + rating + '分</strong><span>近30天预订 ' + sold + ' 次</span></div>',
      '    <div class="item-meta">',
      '      <span>' + h(venue.area) + ' / ' + (venue.indoor ? '室内优先' : '室外场地') + '</span>',
      '      <span>' + h(venue.address) + '</span>',
      '    </div>',
      '    <div class="venue-tags">' + sports.map(function (item) { return '<span>' + h(item) + '</span>'; }).join('') + '<span>' + h((venue.open_slots || ['可订时段'])[0]) + '</span></div>',
      '    <div class="split-row"><strong class="price">' + money(venue.price_per_hour) + '/小时起</strong><button class="primary-btn small-btn" type="button" data-open-venue-book="' + h(venue.id) + '"' + (venue.status === 'approved' ? '' : ' disabled') + '>订场</button></div>',
      '  </div>',
      '</article>',
    ].join('');
  }

  function mapPanel(venues) {
    var approved = venues.filter(function (venue) { return venue.status === 'approved'; }).slice(0, 5);
    var pins = approved.map(function (venue, index) {
      var positions = [[24, 28], [68, 33], [48, 55], [78, 68], [33, 73]];
      var pos = positions[index] || [50, 50];
      return [
        '<div class="pin" style="left:' + pos[0] + '%;top:' + pos[1] + '%">',
        '  <div class="pin-dot"></div>',
        '  <div class="pin-label">' + h(venue.area) + '</div>',
        '</div>',
      ].join('');
    }).join('');
    return [
      '<aside class="panel map-panel">',
      '  <div class="panel-title"><h3>江宁场馆地图</h3><span>合作场馆分布</span></div>',
      '  <div class="map-canvas"><div class="map-route"></div>' + pins + '</div>',
      '</aside>',
    ].join('');
  }

  function venuesView() {
    var venues = state.data.venues.filter(function (venue) {
      var okArea = state.venueFilter === 'all' || venue.area.indexOf(state.venueFilter) >= 0;
      var okSport = state.sportFilter === 'all' || (venue.sports || []).indexOf(state.sportFilter) >= 0;
      return okArea && okSport;
    });
    return [
      '<section class="section venue-shop-layout">',
      '  <div>',
      '    <div class="panel-title"><h3>附近可订场馆</h3><span>按样板区、运动类型筛选</span></div>',
      filterButtons(),
      '    <div class="sort-strip"><button class="is-active" type="button">综合排序</button><button type="button">离我最近</button><button type="button">价格优先</button><button type="button">周末可订</button></div>',
      '    <div class="cards-grid">' + venues.map(venueCard).join('') + '</div>',
      '  </div>',
      mapPanel(state.data.venues),
      '</section>',
      state.venueBooking ? venueBookingPanel(state.venueBooking) : '',
    ].join('');
  }

  function venueBookingPanel(venue) {
    var slots = venue.open_slot_ranges || [];
    var date = venue.booking_date || todayValue();
    return [
      '<div class="modal-backdrop" data-close-venue-booking>',
      '  <section class="venue-booking-sheet" role="dialog" aria-modal="true" onclick="event.stopPropagation()">',
      '    <div class="panel-title"><h3>选择订场时段</h3><button class="secondary-btn" type="button" data-close-venue-booking>关闭</button></div>',
      '    <div class="join-summary">',
      '      <strong>' + h(venue.name) + '</strong>',
      '      <span>' + h(venue.area) + ' / ' + money(venue.price_per_hour) + '/小时起</span>',
      '    </div>',
      '    <div class="panel-soft-block"><strong>预订说明</strong><p>先选日期，再选一个可用时段。系统会根据场馆开放时段和已有订单做占用校验，提交后生成核销码。</p></div>',
      '    <form class="booking-form" data-venue-booking-form>',
      '      <label class="field"><span>预订日期</span><input name="booking_date" type="date" value="' + h(date) + '" min="' + h(todayValue()) + '" /></label>',
      '      <div class="panel-title mini"><h3>可订时段</h3><span>根据场馆开放时段和订单占用自动过滤</span></div>',
      '      <div class="slot-grid">' + (slots.length ? slots.map(function (slot) {
        var disabled = slot.occupied || !slot.start || !slot.end;
        return '<button type="button" class="slot-card ' + (disabled ? 'is-disabled' : '') + '" data-slot-pick="' + h(slot.start + '-' + slot.end) + '" data-slot-label="' + h(slot.label) + '" data-slot-start="' + h(slot.start) + '" data-slot-end="' + h(slot.end) + '"' + (disabled ? ' disabled' : '') + '><strong>' + h(slot.label) + '</strong><span>' + (disabled ? '已占用' : '可预订') + '</span></button>';
      }).join('') : '<div class="empty">暂无开放时段</div>') + '</div>',
      '      <label class="field"><span>已选时段</span><input name="booking_range" readonly placeholder="请选择上方时段" /></label>',
      '      <div class="detail-grid">',
      metric('场馆价格', money(venue.price_per_hour) + '/小时'),
      metric('预订日期', date),
      metric('预估费用', '待计算'),
      metric('状态', '待确认'),
      '      </div>',
      '      <button class="primary-btn" type="submit" disabled data-submit-venue-book>确认并支付</button>',
      '      <input type="hidden" name="booking_start_time" />',
      '      <input type="hidden" name="booking_end_time" />',
      '      <input type="hidden" name="venue_id" value="' + h(venue.id) + '" />',
      '    </form>',
      '  </section>',
      '</div>',
    ].join('');
  }

  function todayValue() {
    var now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  }

  function filterButtons() {
    var areas = ['all', '南师附中江宁分校', '江宁大学城', '江宁开发区', '百家湖'];
    var sports = [['all', '全部'], ['football', '足球'], ['basketball', '篮球']];
    return [
      '<div class="filter-row" style="margin-bottom:12px">',
      areas.map(function (area) {
        var label = area === 'all' ? '全部区域' : area;
        return '<button class="pill-button ' + (state.venueFilter === area ? 'is-active' : '') + '" type="button" data-area-filter="' + h(area) + '">' + h(label) + '</button>';
      }).join(''),
      sports.map(function (item) {
        return '<button class="pill-button ' + (state.sportFilter === item[0] ? 'is-active' : '') + '" type="button" data-sport-filter="' + item[0] + '">' + item[1] + '</button>';
      }).join(''),
      '</div>',
    ].join('');
  }

  function gameCard(game) {
    var date = dayParts(game.start_time);
    var percent = game.capacity ? Math.min(100, Math.round(game.joined_count / game.capacity * 100)) : 0;
    var averageRating = game.average_rating == null ? 3 : Number(game.average_rating);
    var myRating = Number(ratingSummary().composite_score || 3);
    var isMatch = Math.abs(averageRating - myRating) <= 0.6;
    var players = game.players || [];
    return [
      '<article class="game-card">',
      '  <div class="date-chip"><strong>' + h(date.day) + '</strong><span>' + h(date.month) + '</span></div>',
      '  <div>',
      '    <div class="item-head"><h4>' + h(game.title) + '</h4><div class="tag-row">' + (isMatch ? '<span class="tag orange">实力匹配</span>' : '') + '<span class="tag blue">' + sportLabel(game.sport) + '</span></div></div>',
      '    <p>' + h(game.venue_name) + ' / ' + h(game.area) + ' / ' + fmtDate(game.start_time) + '</p>',
      '    <p>' + h(game.notes) + '</p>',
      '    <div class="item-meta"><span>已报名 ' + h(game.joined_count) + '/' + h(game.capacity) + ' 人</span><span>当前球局平均实力 ' + oneDecimal(averageRating, 3) + ' 分</span><div class="progress"><span style="width:' + percent + '%"></span></div></div>',
      '    <div class="player-chips">' + (players.length ? players.slice(0, 8).map(function (player) {
        return '<button type="button" class="player-chip" data-player-profile="' + h(player.user_id) + '"><span class="avatar-mini">' + h(initials(player.username)) + '</span><span>' + h(player.username) + '</span><em>' + h(player.level_label || '进阶') + ' ' + oneDecimal(player.composite_score, 3) + '分</em></button>';
      }).join('') : '<span class="muted">报名后会展示球员实力</span>') + '</div>',
      '  </div>',
      '  <div style="min-width:128px;text-align:right">',
      '    <strong class="price">' + money(game.fee_per_person) + '</strong>',
      '    <button class="secondary-btn" type="button" data-game-detail="' + h(game.id) + '">详情</button>',
      '    <button class="' + (game.is_joined ? 'secondary-btn' : 'primary-btn') + '" type="button" data-open-join="' + h(game.id) + '"' + (game.is_joined ? ' disabled' : '') + '>' + (game.is_joined ? '已报名' : '报名支付') + '</button>',
      '    <button class="secondary-btn review-btn" type="button" data-review-game="' + h(game.id) + '">赛后互评</button>',
      '  </div>',
      '</article>',
    ].join('');
  }

  function gamesView() {
    var myRating = Number(ratingSummary().composite_score || 3);
    var games = [].concat(state.data.games || []).filter(function (game) {
      return state.sportFilter === 'all' || game.sport === state.sportFilter;
    }).sort(function (a, b) {
      var aDiff = Math.abs(Number(a.average_rating == null ? 3 : a.average_rating) - myRating);
      var bDiff = Math.abs(Number(b.average_rating == null ? 3 : b.average_rating) - myRating);
      if (aDiff <= 0.6 && bDiff > 0.6) return -1;
      if (bDiff <= 0.6 && aDiff > 0.6) return 1;
      return new Date(a.start_time) - new Date(b.start_time);
    });
    return [
      '<section class="section">',
      '  <div class="panel-title"><h3>附近球局</h3><span>实力匹配优先，先付后打</span></div>',
      '  <div class="games-list">' + (games.length ? games.map(gameCard).join('') : '<div class="empty">暂无球局</div>') + '</div>',
      '</section>',
      state.reviewDetail ? reviewPanel(state.reviewDetail) : '',
      state.playerProfile ? playerProfileModal(state.playerProfile) : '',
      state.gameDetail ? gameDetailPanel(state.gameDetail) : '',
      state.joinConfirm ? joinConfirmPanel(state.joinConfirm) : '',
    ].join('');
  }

  function gameDetailPanel(detail) {
    var game = detail.game || {};
    var players = detail.players || [];
    var avg = players.length
      ? players.reduce(function (sum, player) { return sum + Number(player.composite_score || 3); }, 0) / players.length
      : 3;
    return [
      '<div class="modal-backdrop" data-close-game-detail>',
      '  <section class="game-detail-sheet" role="dialog" aria-modal="true" onclick="event.stopPropagation()">',
      '    <div class="panel-title"><h3>' + h(game.title) + '</h3><button class="secondary-btn" type="button" data-close-game-detail>关闭</button></div>',
      '    <div class="game-detail-hero">',
      '      <div><span class="tag blue">' + sportLabel(game.sport) + '</span><h4>' + h(game.venue_name) + '</h4><p>' + h(game.area) + ' / ' + h(game.address) + '</p></div>',
      '      <div class="order-code"><span>平均实力</span><strong>' + oneDecimal(avg, 3) + '</strong></div>',
      '    </div>',
      '    <div class="detail-grid">',
      metric('开始时间', fmtDate(game.start_time)),
      metric('结束时间', fmtDate(game.end_time)),
      metric('费用/人', money(game.fee_per_person)),
      metric('到场人数', players.filter(function (p) { return Number(p.checked_in) === 1; }).length + '/' + players.length),
      '    </div>',
      '    <div class="panel-soft-block"><strong>报名与公平机制</strong><p>报名后生成核销码；到场核销会增加信用分。赛后 24 小时内可对同场到场球员互评，互评满 3 条后计入综合实力。</p></div>',
      '    <div class="panel-title mini"><h3>已报名球员</h3><span>等级与综合分公开展示</span></div>',
      '    <div class="detail-player-list">' + (players.length ? players.map(function (player) {
        return '<button type="button" class="detail-player" data-player-profile="' + h(player.user_id) + '"><span class="avatar-mini">' + h(initials(player.username)) + '</span><strong>' + h(player.username) + '</strong><em>' + h(player.level_label || '进阶') + ' ' + oneDecimal(player.composite_score, 3) + '分</em><span class="tag ' + (Number(player.checked_in) === 1 ? '' : 'gray') + '">' + (Number(player.checked_in) === 1 ? '已到场' : '未核销') + '</span></button>';
      }).join('') : '<div class="empty">暂无报名球员</div>') + '</div>',
      detail.review_open ? '<button class="primary-btn" type="button" data-review-game="' + h(game.id) + '">进入赛后互评</button>' : '<button class="secondary-btn" type="button" disabled>互评将在到场核销且比赛结束后开放</button>',
      '  </section>',
      '</div>',
    ].join('');
  }

  function joinConfirmPanel(game) {
    return [
      '<div class="modal-backdrop" data-close-join-confirm>',
      '  <section class="join-confirm-sheet" role="dialog" aria-modal="true" onclick="event.stopPropagation()">',
      '    <div class="panel-title"><h3>确认报名</h3><button class="secondary-btn" type="button" data-close-join-confirm>关闭</button></div>',
      '    <div class="join-summary">',
      '      <strong>' + h(game.title) + '</strong>',
      '      <span>' + h(game.venue_name) + ' / ' + fmtDate(game.start_time) + '</span>',
      '    </div>',
      '    <div class="detail-grid">',
      metric('报名费用', money(game.fee_per_person)),
      metric('当前人数', h(game.joined_count || 0) + '/' + h(game.capacity || 0)),
      metric('平均实力', oneDecimal(game.average_rating, 3) + '分'),
      metric('信用要求', '正常'),
      '    </div>',
      '    <label class="check-row"><input type="checkbox" checked disabled /> 我确认按时到场，若爽约将影响信用分</label>',
      '    <button class="primary-btn" type="button" data-join-game="' + h(game.id) + '">确认并支付</button>',
      '  </section>',
      '</div>',
    ].join('');
  }

  function createView() {
    var approved = state.data.venues.filter(function (venue) { return venue.status === 'approved'; });
    return [
      '<section class="section form-panel">',
      '  <h3>创建足球/篮球局</h3>',
      '  <form class="form-grid" data-create-game>',
      field('球局标题', '<input name="title" required maxlength="120" value="江宁大学城周末约球" />'),
      field('运动类型', '<select name="sport"><option value="football">足球</option><option value="basketball">篮球</option></select>'),
      field('场馆', '<select name="venue_id">' + approved.map(function (venue) { return '<option value="' + h(venue.id) + '">' + h(venue.name) + '</option>'; }).join('') + '</select>'),
      field('开始时间', '<input name="start_time" type="datetime-local" required />'),
      field('结束时间', '<input name="end_time" type="datetime-local" required />'),
      field('人数上限', '<input name="capacity" type="number" min="2" max="50" value="10" />'),
      field('AA 费用/人', '<input name="fee_per_person" type="number" min="0" value="30" />'),
      field('备注', '<textarea name="notes" maxlength="500">强度适中，报名后请准时到场。</textarea>'),
      '    <button class="primary-btn" type="submit">发布球局</button>',
      '  </form>',
      '</section>',
    ].join('');
  }

  function field(label, control) {
    return '<label class="field"><span>' + h(label) + '</span>' + control + '</label>';
  }

  function ratingGuide() {
    if (guideSeen()) return '';
    return [
      '<div class="guide-card">',
      '  <div><strong>实力评级新手引导</strong><p>综合分由自评 30% + 有效互评 70% 计算；互评需同场到场球员提交，单场同一球员满 3 条才生效，并会去掉 1 个最高分和 1 个最低分。</p></div>',
      '  <button class="secondary-btn" type="button" data-close-rating-guide>我知道了</button>',
      '</div>',
    ].join('');
  }

  function selfRatingPanel() {
    var rating = ratingSummary();
    return [
      '<div class="panel rating-panel">',
      '  <div class="panel-title"><h3>我的实力评级</h3><span>7 天内仅可修改 1 次</span></div>',
      ratingGuide(),
      '  <div class="rating-scoreboard">',
      '    <div><span>综合等级</span>' + ratingBadge(rating) + '</div>',
      '    <div><span>自评分</span><strong>' + oneDecimal(rating.self_score, 3) + '</strong></div>',
      '    <div><span>互评分</span><strong>' + (rating.peer_score == null ? '待积累' : oneDecimal(rating.peer_score, 3)) + '</strong></div>',
      '    <div><span>有效互评场次</span><strong>' + h(rating.effective_peer_games || 0) + '</strong></div>',
      '  </div>',
      '  <form class="rating-form" data-self-rating>',
      '    <div class="preset-row" role="group" aria-label="快捷评级">' + ratingPresets.map(function (item) {
        return '<button class="pill-button" type="button" data-rating-preset="' + item[0] + '" data-preset-score="' + item[2] + '">' + item[1] + '</button>';
      }).join('') + '</div>',
      '    <div class="rating-grid">' + ratingDimensions.map(function (item) {
        return starSlider(item[0], rating[item[0] + '_self'] || 3);
      }).join('') + '</div>',
      '    <button class="primary-btn" type="submit">提交自评</button>',
      '  </form>',
      dimensionCompare(rating),
      trendBars(rating),
      '</div>',
    ].join('');
  }

  function dimensionCompare(rating) {
    return [
      '<div class="dimension-compare">',
      '  <div class="panel-title mini"><h3>分项对比</h3><span>本人可见</span></div>',
      ratingDimensions.map(function (item) {
        var selfValue = oneDecimal(rating[item[0] + '_self'], 3);
        var peerValue = rating[item[0] + '_peer'] == null ? null : oneDecimal(rating[item[0] + '_peer'], 3);
        return '<div class="compare-row"><span>' + h(item[1]) + '</span><strong>自评 ' + selfValue + '</strong><em>互评 ' + (peerValue || '暂无') + '</em></div>';
      }).join(''),
      '</div>',
    ].join('');
  }

  function trendBars(rating) {
    var trend = parseTrend(rating.trend_json);
    if (!trend.length) return '<div class="empty small-empty">近 10 场评分趋势会在有效互评积累后显示。</div>';
    return [
      '<div class="trend-box">',
      '  <div class="panel-title mini"><h3>近 10 场趋势</h3><span>互评有效场次</span></div>',
      '  <div class="trend-bars">' + trend.map(function (item, index) {
        var value = score(item.score, 3);
        return '<div class="trend-bar"><span style="height:' + (value / 5 * 100) + '%"></span><em>' + h(value.toFixed(1)) + '</em><small>' + h(index + 1) + '</small></div>';
      }).join('') + '</div>',
      '</div>',
    ].join('');
  }

  function reviewPanel(detail) {
    var players = (detail.players || []).filter(function (player) {
      return Number(player.user_id) !== Number((session() || {}).id || 1) && Number(player.checked_in) === 1 && (detail.reviewed_target_ids || []).indexOf(Number(player.user_id)) < 0;
    });
    return [
      '<div class="modal-backdrop" data-close-review>',
      '  <section class="review-sheet" role="dialog" aria-modal="true" onclick="event.stopPropagation()">',
      '    <div class="panel-title"><h3>赛后互评</h3><button class="secondary-btn" type="button" data-close-review>关闭</button></div>',
      '    <p class="muted">' + h(detail.game.title) + ' / ' + fmtDate(detail.game.end_time) + ' 结束后 24 小时内可提交。单个球员本场满 3 条互评后计入综合分。</p>',
      detail.review_open ? '<form data-peer-review><div class="review-list">' + (players.length ? players.map(reviewTargetCard).join('') : '<div class="empty">暂无可评价的同场到场球员，或你已完成本场互评。</div>') + '</div><label class="check-row"><input type="checkbox" name="anonymous" checked /> 匿名提交</label><button class="primary-btn" type="submit"' + (players.length ? '' : ' disabled') + '>提交本场互评</button></form>' : '<div class="empty">互评入口未开放：需本人报名并完成到场核销，且在球局结束后 24 小时内提交。</div>',
      '  </section>',
      '</div>',
    ].join('');
  }

  function reviewTargetCard(player) {
    return [
      '<article class="review-target" data-review-target="' + h(player.user_id) + '">',
      '  <div class="review-target-head">',
      '    <div class="player-line"><span class="avatar-mini">' + h(initials(player.username)) + '</span><strong>' + h(player.username) + '</strong></div>',
      ratingBadge(player, player.user_id),
      '  </div>',
      '  <div class="rating-grid compact">' + ratingDimensions.map(function (item) {
        return starSlider(item[0], 3, 'target-' + player.user_id);
      }).join('') + '</div>',
      '</article>',
    ].join('');
  }

  function playerProfileModal(profile) {
    var rating = profile.rating || {};
    var isSelf = Number(profile.user_id) === Number((session() || {}).id || 1);
    return [
      '<div class="modal-backdrop" data-close-player-profile>',
      '  <section class="player-profile-modal" role="dialog" aria-modal="true" onclick="event.stopPropagation()">',
      '    <div class="panel-title"><h3>球员主页</h3><button class="secondary-btn" type="button" data-close-player-profile>关闭</button></div>',
      '    <div class="profile-head">',
      '      <span class="avatar-large">' + h(initials(profile.username)) + '</span>',
      '      <div><h4>' + h(profile.username) + '</h4>' + ratingBadge(rating) + '</div>',
      '    </div>',
      '    <div class="rating-scoreboard">',
      '      <div><span>累计参赛</span><strong>' + h(profile.played || 0) + '</strong></div>',
      '      <div><span>互评总数</span><strong>' + h(rating.peer_rating_count || 0) + '</strong></div>',
      '      <div><span>有效场次</span><strong>' + h(rating.effective_peer_games || 0) + '</strong></div>',
      '      <div><span>综合分</span><strong>' + oneDecimal(rating.composite_score, 3) + '</strong></div>',
      '    </div>',
      isSelf ? dimensionCompare(rating) + trendBars(rating) : '<p class="muted">对外展示综合等级、综合分、参赛场次与互评总数；分项明细仅本人可见。</p>',
      '  </section>',
      '</div>',
    ].join('');
  }

  function meView() {
    var me = state.data.me || {};
    var orders = state.data.myOrders || [];
    return [
      '<section class="section layout-2 profile-layout">',
      '  <div>',
      selfRatingPanel(),
      '  </div>',
      '  <div class="panel">',
      '    <div class="panel-title"><h3>我的订单与球局</h3><span>报名支付记录</span></div>',
      myOrderList(orders),
      '  </div>',
      '  <div class="panel">',
      '    <div class="panel-title"><h3>信用记录</h3><span>爽约约束</span></div>',
      '    <div class="metric-grid">',
      metric('信用分', me.credit_score || 100),
      metric('参与场次', me.played || 0),
      metric('核销次数', me.checked_in || 0),
      metric('爽约次数', me.no_shows || 0),
      '    </div>',
      '  </div>',
      '  <div class="panel">',
      '    <div class="panel-title"><h3>我的工作台</h3><span>高光、档案、场馆、管理入口</span></div>',
      '    <div class="story-list compact">',
      '      <button type="button" data-user-view="ai">高光集锦</button>',
      '      <button type="button" data-user-view="data">运动档案</button>',
      '      <button type="button" data-mode="venue">场馆管理</button>',
      '      <button type="button" data-mode="admin">运营管理</button>',
      '    </div>',
      '  </div>',
      '</section>',
      state.reviewDetail ? reviewPanel(state.reviewDetail) : '',
      state.playerProfile ? playerProfileModal(state.playerProfile) : '',
    ].join('');
  }

  function messagesView() {
    var messages = notificationList();
    return [
      '<section class="section">',
      '  <div class="panel-title"><h3>消息中心</h3><span>报名、核销、互评提醒</span></div>',
      messages.length ? '<div class="message-list">' + messages.map(function (item) {
        return '<article class="message-card"><div><strong>' + h(item.title) + '</strong><p>' + h(item.body) + '</p></div><span>' + h(item.time) + '</span></article>';
      }).join('') + '</div>' : '<div class="empty">暂无消息</div>',
      '</section>',
    ].join('');
  }

  function teamsView() {
    var teams = state.data.teams || [];
    return [
      '<section class="section layout-2">',
      '  <div>',
      '    <div class="panel-title"><h3>球队简版</h3><span>队长、成员、固定训练入口</span></div>',
      '    <div class="cards-grid">' + (teams.length ? teams.map(teamCard).join('') : '<div class="empty">暂无球队，先创建一个样板队。</div>') + '</div>',
      '  </div>',
      '  <div class="form-panel">',
      '    <h3>创建球队</h3>',
      '    <form class="form-grid" data-create-team>',
      field('球队名称', '<input name="name" required maxlength="80" value="江宁周末足球队" />'),
      field('运动类型', '<select name="sport"><option value="football">足球</option><option value="basketball">篮球</option></select>'),
      field('活动区域', '<input name="area" value="江宁大学城" />'),
      field('成员上限', '<input name="member_limit" type="number" min="5" max="80" value="20" />'),
      field('球队说明', '<textarea name="description" maxlength="500">固定周末训练，优先招长期稳定到场的球友。</textarea>'),
      '      <button class="primary-btn" type="submit">创建球队</button>',
      '    </form>',
      '  </div>',
      '</section>',
    ].join('');
  }

  function teamCard(team) {
    var percent = team.member_limit ? Math.min(100, Math.round(Number(team.member_count || 0) / Number(team.member_limit || 1) * 100)) : 0;
    var isCaptain = Number(team.captain_user_id) === Number((session() || {}).id || 1);
    return [
      '<article class="team-card">',
      '  <div class="team-mark">' + h(initials(team.name)) + '</div>',
      '  <div class="item-head"><h4>' + h(team.name) + '</h4><span class="tag blue">' + sportLabel(team.sport) + '</span></div>',
      '  <p>' + h(team.description || '固定约球训练队') + '</p>',
      '  <div class="item-meta"><span>' + h(team.area) + '</span><span>队长 ' + h(team.captain_username) + '</span></div>',
      '  <div class="item-meta"><span>成员 ' + h(team.member_count || 0) + '/' + h(team.member_limit || 0) + '</span><div class="progress"><span style="width:' + percent + '%"></span></div></div>',
      '  <div class="split-row"><span class="tag ' + (team.is_member ? '' : 'orange') + '">' + (team.is_member ? (isCaptain ? '我是队长' : '已加入') : '可加入') + '</span><button class="secondary-btn" type="button" data-join-team="' + h(team.id) + '"' + (team.is_member ? ' disabled' : '') + '>加入球队</button></div>',
      '</article>',
    ].join('');
  }

  function aiClipsView() {
    var clips = state.data.clips || [];
    var games = state.data.games || [];
    return [
      '<section class="section layout-2">',
      '  <div class="panel ai-panel">',
      '    <div class="panel-title"><h3>高光集锦</h3><span>精彩片段快速提交</span></div>',
      '    <div class="feature-hero ai-hero">',
      '      <div><span class="tag orange">精彩瞬间</span><h4>上传一段进球 / 训练视频，生成高光任务</h4><p>提交后会进入处理队列，后续可与合作场馆摄像头同步，生成进球片段、出界片段和比赛集锦。</p></div>',
      '    </div>',
      '    <form class="form-grid" data-create-clip>',
      field('关联球局', '<select name="game_id"><option value="">不关联球局</option>' + games.map(function (game) { return '<option value="' + h(game.id) + '">' + h(game.title) + '</option>'; }).join('') + '</select>'),
      field('视频链接/文件名', '<input name="video_url" value="weekend-goal-clip.mp4" />'),
      field('识别类型', '<select name="clip_type"><option value="goal_detection">进球识别</option><option value="highlight_reel">自动高光集锦</option><option value="heatmap">跑动热图占位</option></select>'),
      '      <button class="primary-btn" type="submit">提交任务</button>',
      '    </form>',
      '  </div>',
      '  <div class="panel">',
      '    <div class="panel-title"><h3>我的集锦任务</h3><span>处理队列</span></div>',
      clipList(clips),
      '  </div>',
      '</section>',
    ].join('');
  }

  function clipList(clips) {
    if (!clips.length) return '<div class="empty">还没有集锦任务，提交一段比赛视频即可生成队列记录。</div>';
    return '<div class="compact-list">' + clips.map(function (clip) {
      return '<article class="compact-order"><div><strong>' + h(clip.game_title || '比赛高光') + '</strong><span>' + h(clip.video_url || '比赛视频') + ' / ' + h(clip.demo_result || '等待处理') + '</span></div><span class="tag orange">' + h(clip.status) + '</span></article>';
    }).join('') + '</div>';
  }

  function dataUploadView() {
    var uploads = state.data.uploads || [];
    return [
      '<section class="section layout-2">',
      '  <div class="panel data-panel">',
      '    <div class="panel-title"><h3>运动档案</h3><span>训练与比赛记录</span></div>',
      '    <div class="feature-hero data-hero">',
      '      <div><span class="tag blue">授权与质量评分</span><h4>记录第一视角 / 场馆视频数据贡献意向</h4><p>先记录授权、来源、质量评分和奖励状态，后续接入真实文件上传、隐私处理和个人运动报告。</p></div>',
      '    </div>',
      '    <form class="form-grid" data-create-upload>',
      field('数据类型', '<select name="data_type"><option value="egocentric_video">第一视角视频</option><option value="venue_camera">场馆固定机位</option><option value="wearable_trace">可穿戴轨迹</option></select>'),
      field('采集来源', '<input name="source" value="手机/运动相机" />'),
      field('授权范围', '<select name="consent_scope"><option value="training_anonymized">脱敏后用于训练分析</option><option value="product_demo">仅用于产品体验</option><option value="personal_report">仅生成个人报告</option></select>'),
      field('数据说明', '<textarea name="note" maxlength="500">5 人制足球，包含奔跑、急停、变向和对抗片段。</textarea>'),
      '      <button class="primary-btn" type="submit">提交数据意向</button>',
      '    </form>',
      '  </div>',
      '  <div class="panel">',
      '    <div class="panel-title"><h3>我的记录</h3><span>质量评分</span></div>',
      uploadList(uploads),
      '  </div>',
      '</section>',
    ].join('');
  }

  function uploadList(uploads) {
    if (!uploads.length) return '<div class="empty">暂无运动档案记录。先提交一条授权意向，后续可生成个人运动报告。</div>';
    return '<div class="compact-list">' + uploads.map(function (upload) {
      return '<article class="compact-order"><div><strong>' + h(upload.data_type) + '</strong><span>' + h(upload.source) + ' / 授权：' + h(upload.consent_scope) + '</span></div><div class="order-code"><span>质量分</span><strong>' + h(upload.quality_score || 0) + '</strong></div><span class="tag">' + h(upload.reward_status) + '</span></article>';
    }).join('') + '</div>';
  }

  function demoView() {
    var me = state.data.me || {};
    var orderDone = (state.data.myOrders || []).length > 0;
    var teamDone = (state.data.teams || []).some(function (team) { return team.is_member; });
    var clipDone = (state.data.clips || []).length > 0;
    var uploadDone = (state.data.uploads || []).length > 0;
    var rating = ratingSummary();
    var steps = [
      ['登录账号', true, '复用现有 MySQL 登录系统'],
      ['订场/报名生成订单', orderDone, '从找球场订场，或在看球局里报名支付'],
      ['发布或加入球队', teamDone, '球队简版证明 PRD 里的球队管理入口'],
      ['完成实力自评', Number(rating.self_score || 0) > 0, '个人中心提交 5 维能力'],
      ['提交高光任务', clipDone, '提交比赛视频，生成高光任务'],
      ['提交运动档案', uploadDone, '记录授权范围和数据来源'],
    ];
    return [
      '<section class="section demo-layout">',
      '  <div class="panel">',
      '    <div class="panel-title"><h3>完整流程</h3><span>先看主线，再看扩展</span></div>',
      '    <div class="demo-steps">' + steps.map(function (step, index) {
        return '<article class="demo-step ' + (step[1] ? 'is-done' : '') + '"><strong>' + h(index + 1) + '</strong><div><h4>' + h(step[0]) + '</h4><p>' + h(step[2]) + '</p></div><span>' + (step[1] ? '已完成' : '待完成') + '</span></article>';
      }).join('') + '</div>',
      '  </div>',
      '  <div class="panel">',
      '    <div class="panel-title"><h3>推荐使用顺序</h3><span>给别人看时按这个走</span></div>',
      '    <div class="story-list">',
      '      <button type="button" data-jump-view="venues">1. 找球场并选择时段</button>',
      '      <button type="button" data-jump-view="games">2. 报名一场附近球局</button>',
      '      <button type="button" data-jump-view="teams">3. 创建/加入球队</button>',
      '      <button type="button" data-jump-view="me">4. 展示信用与实力评级</button>',
      '      <button type="button" data-jump-view="ai">5. 提交高光任务</button>',
      '      <button type="button" data-jump-view="data">6. 提交运动档案</button>',
      '    </div>',
      '    <div class="panel-soft-block"><strong>当前账号</strong><p>' + h((session() || {}).username || (session() || {}).name || 'demo_player') + ' / 信用分 ' + h(me.credit_score || 100) + '。这条路径覆盖主闭环，并保留后续能力入口。</p></div>',
      '  </div>',
      '</section>',
    ].join('');
  }

  function notificationList() {
    var orders = state.data.myOrders || [];
    var rating = ratingSummary();
    var messages = [];
    if (orders.length) {
      var latest = orders[0];
      messages.push({
        title: '最新报名记录',
        body: (latest.title || '球局报名') + ' / ' + (latest.checkin_code ? '核销码 ' + latest.checkin_code : '等待支付记录'),
        time: fmtDate(latest.create_time || latest.start_time),
      });
    }
    if (Number(rating.effective_peer_games || 0) > 0) {
      messages.push({
        title: '实力评级已更新',
        body: '当前综合等级 ' + (rating.level_label || '进阶') + '，综合分 ' + oneDecimal(rating.composite_score, 3) + ' 分。',
        time: fmtDate(rating.update_time),
      });
    }
    return messages;
  }

  function myOrderList(orders) {
    if (!orders.length) return '<div class="empty">还没有订单。先去找球场预订，或报名一场附近球局。</div>';
    return [
      '<div class="compact-list">',
      orders.map(function (order) {
        return [
          '<article class="compact-order">',
          '  <div>',
          '    <strong>' + h(order.title || '场地预订') + '</strong>',
          '    <span>' + h(order.venue_name) + ' / ' + fmtDate(order.start_time || order.booking_start_time || order.create_time) + (order.booking_end_time ? ' - ' + fmtDate(order.booking_end_time) : '') + '</span>',
          '  </div>',
          '  <div class="order-code">',
          '    <span>核销码</span>',
          '    <strong>' + h(order.checkin_code) + '</strong>',
          '  </div>',
          order.game_id ? '<button class="secondary-btn" type="button" data-review-game="' + h(order.game_id) + '">去互评</button>' : '',
          '  <span class="tag ' + (order.status === 'checked_in' ? '' : 'orange') + '">' + statusLabel(order.status) + '</span>',
          '</article>',
        ].join('');
      }).join(''),
      '</div>',
    ].join('');
  }

  function userMode() {
    var body = {
      home: function () { return ''; },
      venues: venuesView,
      games: gamesView,
      create: createView,
      teams: teamsView,
      ai: aiClipsView,
      data: dataUploadView,
      demo: demoView,
      messages: messagesView,
      me: meView,
    }[state.userView]();
    var isHome = state.userView === 'home';
    return (isHome ? hero() : userTabs() + body) + mobileTabbar();
  }

  function mobileTabbar() {
    var tabs = [
      ['home', '首页'],
      ['venues', '订场'],
      ['games', '球局'],
      ['teams', '球队'],
      ['messages', '消息'],
      ['me', '我的'],
    ];
    return '<nav class="mobile-tabbar">' + tabs.map(function (item) {
      return '<button type="button" data-user-view="' + item[0] + '" class="' + (state.userView === item[0] ? 'is-active' : '') + '"><strong>' + h(item[1]) + '</strong></button>';
    }).join('') + '</nav>';
  }

  function venueMode() {
    var venues = state.data.venues;
    var orders = state.data.orders || [];
    return [
      '<section class="section layout-2">',
      '  <div>',
      '    <div class="panel-title"><h3>场地管理</h3><span>添加 / 编辑场地</span></div>',
      '    <div class="cards-grid">' + venues.map(venueCard).join('') + '</div>',
      '  </div>',
      '  <div class="form-panel">',
      '    <h3>新增合作场馆</h3>',
      '    <form class="form-grid" data-create-venue>',
      field('场馆名称', '<input name="name" required value="江宁新合作球馆" />'),
      field('区域', '<input name="area" required value="江宁大学城" />'),
      field('地址', '<input name="address" required value="南京市江宁区" />'),
      field('每小时价格', '<input name="price_per_hour" type="number" value="200" />'),
      field('联系人', '<input name="contact" value="场馆负责人" />'),
      field('场地类型', '<select name="sports"><option value="football,basketball">足球 + 篮球</option><option value="football">足球</option><option value="basketball">篮球</option></select>'),
      '      <button class="primary-btn" type="submit">提交审核</button>',
      '    </form>',
      '  </div>',
      '</section>',
      '<section class="section panel">',
      '  <div class="panel-title"><h3>订单管理 / 核销</h3><span>扫码核销入口</span></div>',
      orderTable(orders),
      '</section>',
    ].join('');
  }

  function orderTable(orders) {
    if (!orders.length) return '<div class="empty">暂无订单，先报名一场球局或预订一个场地。</div>';
    return [
      '<div class="table-wrap"><table>',
      '<thead><tr><th>订单</th><th>用户</th><th>球局</th><th>场馆</th><th>金额</th><th>核销码</th><th>状态</th><th>操作</th></tr></thead>',
      '<tbody>',
      orders.map(function (order) {
        return [
          '<tr>',
          '<td>#' + h(order.id) + '</td>',
          '<td>' + h(order.username) + '</td>',
          '<td>' + h(order.title || '场地预订') + '</td>',
          '<td>' + h(order.venue_name) + '</td>',
          '<td>' + money(order.amount) + '</td>',
          '<td>' + h(order.checkin_code) + '</td>',
          '<td><span class="tag ' + (order.status === 'checked_in' ? '' : 'orange') + '">' + statusLabel(order.status) + '</span></td>',
          '<td><button class="secondary-btn" type="button" data-checkin-order="' + h(order.id) + '"' + (order.status === 'checked_in' ? ' disabled' : '') + '>核销</button></td>',
          '</tr>',
        ].join('');
      }).join(''),
      '</tbody></table></div>',
    ].join('');
  }

  function adminMode() {
    var metrics = state.data.metrics || {};
    return [
      '<section class="section">',
      '  <div class="panel-title"><h3>数据看板</h3><span>上线 10 天 KPI 复盘</span></div>',
      '  <div class="metric-grid">',
      metric('今日订单', metrics.today_orders || 0),
      metric('今日收入', money(metrics.today_income || 0)),
      metric('周活跃用户', metrics.wau || 0),
      metric('发局数', metrics.total_games || 0),
      metric('合作场馆', metrics.approved_venues || 0),
      metric('订单金额', money(metrics.gmv || 0)),
      '  </div>',
      '</section>',
      '<section class="section panel">',
      '  <div class="panel-title"><h3>场馆审核</h3><span>保证样板区质量</span></div>',
      adminVenueTable(),
      '</section>',
      '<section class="section panel">',
      '  <div class="panel-title"><h3>用户管理</h3><span>封禁 / 解封恶意爽约用户</span></div>',
      userTable(),
      '</section>',
      '<section class="section panel">',
      '  <div class="panel-title"><h3>评分核查</h3><span>人工申诉核查 / 重置分数</span></div>',
      ratingAdminTable(),
      '</section>',
    ].join('');
  }

  function adminVenueTable() {
    return [
      '<div class="table-wrap"><table>',
      '<thead><tr><th>场馆</th><th>区域</th><th>价格</th><th>联系人</th><th>状态</th><th>操作</th></tr></thead><tbody>',
      state.data.venues.map(function (venue) {
        return [
          '<tr>',
          '<td>' + h(venue.name) + '</td>',
          '<td>' + h(venue.area) + '</td>',
          '<td>' + money(venue.price_per_hour) + '/小时</td>',
          '<td>' + h(venue.contact) + '</td>',
          '<td><span class="tag ' + (venue.status === 'approved' ? '' : 'gray') + '">' + statusLabel(venue.status) + '</span></td>',
          '<td><button class="secondary-btn" type="button" data-approve-venue="' + h(venue.id) + '"' + (venue.status === 'approved' ? ' disabled' : '') + '>通过</button></td>',
          '</tr>',
        ].join('');
      }).join(''),
      '</tbody></table></div>',
    ].join('');
  }

  function userTable() {
    var users = state.data.users || [];
    if (!users.length) return '<div class="empty">暂无用户数据，注册或登录后会写入 MySQL。</div>';
    return [
      '<div class="table-wrap"><table>',
      '<thead><tr><th>ID</th><th>用户名</th><th>信用</th><th>参与</th><th>爽约</th><th>状态</th><th>操作</th></tr></thead><tbody>',
      users.map(function (user) {
        var disabled = Number(user.status) === 0;
        return [
          '<tr>',
          '<td>' + h(user.id) + '</td>',
          '<td>' + h(user.username) + '</td>',
          '<td>' + h(user.credit_score || 100) + '</td>',
          '<td>' + h(user.joined_games || 0) + '</td>',
          '<td>' + h(user.no_shows || 0) + '</td>',
          '<td><span class="tag ' + (disabled ? 'orange' : '') + '">' + (disabled ? '已封禁' : '正常') + '</span></td>',
          '<td><button class="' + (disabled ? 'secondary-btn' : 'danger-btn') + '" type="button" data-user-status="' + h(user.id) + '" data-next-status="' + (disabled ? 1 : 0) + '">' + (disabled ? '解封' : '封禁') + '</button></td>',
          '</tr>',
        ].join('');
      }).join(''),
      '</tbody></table></div>',
    ].join('');
  }

  function ratingAdminTable() {
    var rows = state.data.ratingRows || [];
    if (!rows.length) return '<div class="empty">暂无评分数据，用户完成自评后会出现在这里。</div>';
    return [
      '<div class="table-wrap"><table>',
      '<thead><tr><th>用户</th><th>综合</th><th>自评</th><th>互评</th><th>有效场次</th><th>互评数</th><th>更新时间</th><th>操作</th></tr></thead><tbody>',
      rows.map(function (row) {
        return [
          '<tr>',
          '<td>' + h(row.username) + '</td>',
          '<td><span class="tag">' + h(row.level_label || ratingLabel(row.composite_score)) + ' ' + oneDecimal(row.composite_score, 3) + '</span></td>',
          '<td>' + oneDecimal(row.self_score, 3) + '</td>',
          '<td>' + (row.peer_score == null ? '暂无' : oneDecimal(row.peer_score, 3)) + '</td>',
          '<td>' + h(row.effective_peer_games || 0) + '</td>',
          '<td>' + h(row.peer_rating_count || 0) + '</td>',
          '<td>' + fmtDate(row.update_time) + '</td>',
          '<td><button class="danger-btn" type="button" data-reset-rating="' + h(row.user_id) + '">重置</button></td>',
          '</tr>',
        ].join('');
      }).join(''),
      '</tbody></table></div>',
    ].join('');
  }

  function render() {
    var content = state.mode === 'venue' ? venueMode() : state.mode === 'admin' ? adminMode() : userMode();
    app.innerHTML = topbar() + '<main class="page">' + content + '</main>' + (state.toast ? '<div class="toast">' + h(state.toast) + '</div>' : '');
    bindEvents();
  }

  function bindEvents() {
    app.querySelectorAll('[data-mode]').forEach(function (button) {
      button.addEventListener('click', async function () {
        state.mode = button.getAttribute('data-mode');
        render();
        try {
          await refreshModeData();
          render();
        } catch (error) {
          showToast(error.message);
        }
      });
    });

    app.querySelectorAll('[data-user-view], [data-jump-view]').forEach(function (button) {
      button.addEventListener('click', function () {
        var projectFilter = button.getAttribute('data-project-filter');
        if (projectFilter) state.sportFilter = projectFilter;
        state.userView = button.getAttribute('data-user-view') || button.getAttribute('data-jump-view');
        state.mode = 'user';
        render();
      });
    });

    app.querySelectorAll('[data-area-filter]').forEach(function (button) {
      button.addEventListener('click', function () {
        state.venueFilter = button.getAttribute('data-area-filter');
        render();
      });
    });

    app.querySelectorAll('[data-sport-filter]').forEach(function (button) {
      button.addEventListener('click', function () {
        state.sportFilter = button.getAttribute('data-sport-filter');
        render();
      });
    });

    app.querySelectorAll('[data-join-game]').forEach(function (button) {
      button.addEventListener('click', async function () {
        var gameId = button.getAttribute('data-join-game');
        button.disabled = true;
        try {
          var result = await api('/api/sports-app/games/' + gameId + '/join', { method: 'POST', body: '{}' });
          state.joinConfirm = null;
          await loadBootstrap();
          showToast('报名成功，微信支付占位已记账，核销码 ' + result.checkin_code);
        } catch (error) {
          showToast(error.message);
        }
      });
    });

    app.querySelectorAll('[data-open-join]').forEach(function (button) {
      button.addEventListener('click', function () {
        var gameId = Number(button.getAttribute('data-open-join'));
        state.joinConfirm = (state.data.games || []).find(function (game) { return Number(game.id) === gameId; }) || null;
        render();
      });
    });

    app.querySelectorAll('[data-close-join-confirm]').forEach(function (node) {
      node.addEventListener('click', function () {
        state.joinConfirm = null;
        render();
      });
    });

    app.querySelectorAll('[data-game-detail]').forEach(function (button) {
      button.addEventListener('click', async function () {
        try {
          state.gameDetail = await api('/api/sports-app/games/' + button.getAttribute('data-game-detail'));
          render();
        } catch (error) {
          showToast(error.message);
        }
      });
    });

    app.querySelectorAll('[data-close-game-detail]').forEach(function (node) {
      node.addEventListener('click', function () {
        state.gameDetail = null;
        render();
      });
    });

    app.querySelectorAll('[data-book-venue]').forEach(function (button) {
      button.addEventListener('click', async function () {
        state.userView = 'venues';
        state.venueBooking = state.data.venues.find(function (venue) { return String(venue.id) === String(button.getAttribute('data-book-venue')); }) || null;
        render();
      });
    });

    app.querySelectorAll('[data-open-venue-book]').forEach(function (button) {
      button.addEventListener('click', function () {
        state.venueBooking = state.data.venues.find(function (venue) { return String(venue.id) === String(button.getAttribute('data-open-venue-book')); }) || null;
        render();
      });
    });

    app.querySelectorAll('[data-close-venue-booking]').forEach(function (node) {
      node.addEventListener('click', function () {
        state.venueBooking = null;
        render();
      });
    });

    var bookingForm = app.querySelector('[data-venue-booking-form]');
    if (bookingForm) {
      var bookingDateInput = bookingForm.querySelector('input[name="booking_date"]');
      var bookingRangeInput = bookingForm.querySelector('input[name="booking_range"]');
      var bookingStartInput = bookingForm.querySelector('input[name="booking_start_time"]');
      var bookingEndInput = bookingForm.querySelector('input[name="booking_end_time"]');
      var submitButton = bookingForm.querySelector('[data-submit-venue-book]');

      function syncSubmitState() {
        var hasRange = bookingStartInput.value && bookingEndInput.value;
        submitButton.disabled = !hasRange;
      }

      bookingDateInput.addEventListener('change', function () {
        if (!state.venueBooking) return;
        state.venueBooking.booking_date = bookingDateInput.value;
        render();
      });

      bookingForm.querySelectorAll('[data-slot-pick]').forEach(function (slotButton) {
        slotButton.addEventListener('click', function () {
          var label = slotButton.getAttribute('data-slot-label') || slotButton.getAttribute('data-slot-pick');
          bookingRangeInput.value = label;
          bookingStartInput.value = slotButton.getAttribute('data-slot-start');
          bookingEndInput.value = slotButton.getAttribute('data-slot-end');
          syncSubmitState();
          bookingForm.querySelectorAll('[data-slot-pick]').forEach(function (item) {
            item.classList.remove('is-active');
          });
          slotButton.classList.add('is-active');
        });
      });

      syncSubmitState();

      bookingForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        if (!bookingStartInput.value || !bookingEndInput.value) {
          showToast('请选择一个可用时段');
          return;
        }
        if (!window.confirm('确认提交场地预订？')) return;
        try {
          var result = await api('/api/sports-app/venues/' + state.venueBooking.id + '/book', {
            method: 'POST',
            body: JSON.stringify({
              booking_date: bookingDateInput.value,
              booking_start_time: bookingStartInput.value,
              booking_end_time: bookingEndInput.value,
            }),
          });
          state.venueBooking = null;
          await loadBootstrap();
          showToast('场地预订成功，' + (result.booking_range || '') + '，核销码 ' + result.checkin_code);
        } catch (error) {
          showToast(error.message);
        }
      });
    }

    var createGameForm = app.querySelector('[data-create-game]');
    if (createGameForm) {
      createGameForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        var form = event.currentTarget;
        var body = Object.fromEntries(new FormData(form).entries());
        try {
          await api('/api/sports-app/games', { method: 'POST', body: JSON.stringify(body) });
          await loadBootstrap();
          state.userView = 'games';
          showToast('球局已发布，已写入数据库');
        } catch (error) {
          showToast(error.message);
        }
      });
    }

    var createTeamForm = app.querySelector('[data-create-team]');
    if (createTeamForm) {
      createTeamForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        var body = Object.fromEntries(new FormData(event.currentTarget).entries());
        try {
          await api('/api/sports-app/teams', { method: 'POST', body: JSON.stringify(body) });
          await loadBootstrap();
          showToast('球队已创建，队长身份已绑定');
        } catch (error) {
          showToast(error.message);
        }
      });
    }

    app.querySelectorAll('[data-join-team]').forEach(function (button) {
      button.addEventListener('click', async function () {
        try {
          await api('/api/sports-app/teams/' + button.getAttribute('data-join-team') + '/join', { method: 'POST', body: '{}' });
          await loadBootstrap();
          showToast('已加入球队，后续可扩展训练通知和出勤统计');
        } catch (error) {
          showToast(error.message);
        }
      });
    });

    var createClipForm = app.querySelector('[data-create-clip]');
    if (createClipForm) {
      createClipForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        var body = Object.fromEntries(new FormData(event.currentTarget).entries());
        try {
          var result = await api('/api/sports-app/ai-clips', { method: 'POST', body: JSON.stringify(body) });
          await loadBootstrap();
          showToast('高光任务已提交：' + result.demo_result);
        } catch (error) {
          showToast(error.message);
        }
      });
    }

    var createUploadForm = app.querySelector('[data-create-upload]');
    if (createUploadForm) {
      createUploadForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        var body = Object.fromEntries(new FormData(event.currentTarget).entries());
        try {
          var result = await api('/api/sports-app/data-uploads', { method: 'POST', body: JSON.stringify(body) });
          await loadBootstrap();
          showToast('数据授权意向已提交，质量评分 ' + result.quality_score);
        } catch (error) {
          showToast(error.message);
        }
      });
    }

    var createVenueForm = app.querySelector('[data-create-venue]');
    if (createVenueForm) {
      createVenueForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        var body = Object.fromEntries(new FormData(event.currentTarget).entries());
        body.indoor = true;
        body.open_slots = ['周末黄金时段', '工作日晚间'];
        try {
          await api('/api/sports-app/venues', { method: 'POST', body: JSON.stringify(body) });
          await refreshModeData();
          showToast('场馆已提交，等待运营审核');
        } catch (error) {
          showToast(error.message);
        }
      });
    }

    app.querySelectorAll('[data-checkin-order]').forEach(function (button) {
      button.addEventListener('click', async function () {
        try {
          await api('/api/sports-app/orders/' + button.getAttribute('data-checkin-order') + '/checkin', { method: 'POST', body: '{}' });
          await loadOrders();
          await loadBootstrap();
          showToast('核销成功，信用分已更新');
        } catch (error) {
          showToast(error.message);
        }
      });
    });

    app.querySelectorAll('[data-approve-venue]').forEach(function (button) {
      button.addEventListener('click', async function () {
        try {
          await api('/api/sports-app/venues/' + button.getAttribute('data-approve-venue'), {
            method: 'PATCH',
            body: JSON.stringify({ status: 'approved' }),
          });
          await refreshModeData();
          showToast('场馆已审核通过');
        } catch (error) {
          showToast(error.message);
        }
      });
    });

    app.querySelectorAll('[data-user-status]').forEach(function (button) {
      button.addEventListener('click', async function () {
        try {
          await api('/api/sports-app/admin/users/' + button.getAttribute('data-user-status') + '/status', {
            method: 'PATCH',
            body: JSON.stringify({ status: Number(button.getAttribute('data-next-status')) }),
          });
          await loadUsers();
          showToast('用户状态已更新');
        } catch (error) {
          showToast(error.message);
        }
      });
    });

    app.querySelectorAll('[data-copy-address]').forEach(function (button) {
      button.addEventListener('click', async function () {
        var address = button.getAttribute('data-copy-address');
        try {
          await navigator.clipboard.writeText(address);
          showToast('地址已复制：' + address);
        } catch {
          showToast(address);
        }
      });
    });

    app.querySelectorAll('[data-rating-range]').forEach(function (input) {
      input.addEventListener('input', function () {
        syncRangeVisual(input);
      });
    });

    app.querySelectorAll('[data-rating-preset]').forEach(function (button) {
      button.addEventListener('click', function () {
        var form = button.closest('form');
        var value = button.getAttribute('data-preset-score') || 3;
        if (!form) return;
        form.querySelectorAll('[data-rating-range]').forEach(function (input) {
          input.value = value;
          syncRangeVisual(input);
        });
      });
    });

    var selfRatingForm = app.querySelector('[data-self-rating]');
    if (selfRatingForm) {
      selfRatingForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        if (!window.confirm('确认提交本次自评？提交后 7 天内仅可修改 1 次。')) return;
        var body = ratingBodyFromForm(event.currentTarget);
        try {
          var result = await api('/api/sports-app/rating/self', { method: 'POST', body: JSON.stringify(body) });
          state.data.rating = result.summary;
          await loadBootstrap();
          showToast('实力评级已更新');
        } catch (error) {
          showToast(error.message);
        }
      });
    }

    app.querySelectorAll('[data-review-game]').forEach(function (button) {
      button.addEventListener('click', async function () {
        try {
          state.reviewDetail = await api('/api/sports-app/games/' + button.getAttribute('data-review-game'));
          state.gameDetail = null;
          render();
        } catch (error) {
          showToast(error.message);
        }
      });
    });

    app.querySelectorAll('[data-close-review]').forEach(function (node) {
      node.addEventListener('click', function () {
        state.reviewDetail = null;
        render();
      });
    });

    var peerReviewForm = app.querySelector('[data-peer-review]');
    if (peerReviewForm) {
      peerReviewForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        if (!window.confirm('确认提交本场互评？每场对同一球员只能提交 1 次。')) return;
        var anonymous = peerReviewForm.querySelector('input[name="anonymous"]')?.checked !== false;
        var reviews = Array.from(peerReviewForm.querySelectorAll('[data-review-target]')).map(function (card) {
          var review = { target_user_id: Number(card.getAttribute('data-review-target')), anonymous: anonymous };
          card.querySelectorAll('[data-rating-range]').forEach(function (input) {
            review[input.getAttribute('data-rating-dimension')] = Number(input.value || 3);
          });
          return review;
        });
        try {
          var result = await api('/api/sports-app/games/' + state.reviewDetail.game.id + '/reviews', {
            method: 'POST',
            body: JSON.stringify({ reviews: reviews }),
          });
          state.reviewDetail = null;
          await loadBootstrap();
          showToast('已提交 ' + result.saved + ' 条互评');
        } catch (error) {
          showToast(error.message);
        }
      });
    }

    app.querySelectorAll('[data-player-profile]').forEach(function (button) {
      button.addEventListener('click', async function () {
        try {
          state.playerProfile = await api('/api/sports-app/players/' + button.getAttribute('data-player-profile'));
          render();
        } catch (error) {
          showToast(error.message);
        }
      });
    });

    app.querySelectorAll('[data-close-player-profile]').forEach(function (node) {
      node.addEventListener('click', function () {
        state.playerProfile = null;
        render();
      });
    });

    app.querySelectorAll('[data-close-rating-guide]').forEach(function (button) {
      button.addEventListener('click', function () {
        window.localStorage.setItem('nyq_rating_guide_seen', '1');
        render();
      });
    });

    app.querySelectorAll('[data-reset-rating]').forEach(function (button) {
      button.addEventListener('click', async function () {
        if (!window.confirm('确认重置该用户评分？该操作用于申诉核查后的人工处理。')) return;
        try {
          await api('/api/sports-app/admin/ratings/' + button.getAttribute('data-reset-rating') + '/reset', { method: 'POST', body: '{}' });
          await loadRatings();
          showToast('评分已重置');
        } catch (error) {
          showToast(error.message);
        }
      });
    });
  }

  function syncRangeVisual(input) {
    var slider = input.closest('.star-slider');
    var value = Math.round(score(input.value, 3));
    if (!slider) return;
    slider.querySelectorAll('.stars span').forEach(function (star, index) {
      star.classList.toggle('is-on', index < value);
    });
    var output = slider.querySelector('[data-rating-value]');
    if (output) output.textContent = value;
  }

  function ratingBodyFromForm(form) {
    var body = {};
    ratingDimensions.forEach(function (item) {
      var input = form.querySelector('[name="' + item[0] + '"]');
      body[item[0]] = Number(input ? input.value : 3);
    });
    return body;
  }

  async function boot() {
    try {
      await loadBootstrap();
      render();
    } catch (error) {
      app.innerHTML = '<div class="boot-screen"><div class="boot-mark">NYQ</div><p>' + h(error.message) + '</p></div>';
    }
  }

  window.addEventListener('another-me-auth-change', boot);
  boot();
})();
