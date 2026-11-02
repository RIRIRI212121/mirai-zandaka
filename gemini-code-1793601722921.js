(function () {
  'use strict';

  var key = 'mirai-iphone-anchor-v1';
  var settingsKey = 'mirai-shift-settings-v1';

  var settings = { wage: 1200, transport: 0, saturday: 0, sunday: 0, night: 25 };
  try {
    var storedSettings = JSON.parse(localStorage.getItem(settingsKey));
    if (storedSettings) settings = Object.assign(settings, storedSettings);
  } catch (e) { }

  var data = { expenses: [], shifts: {}, subs: [], balance: 0, cardPayDay: 27 };
  try {
    var saved = JSON.parse(localStorage.getItem(key));
    if (saved && typeof saved === 'object') data = Object.assign(data, saved);
    if (!Array.isArray(data.expenses)) data.expenses = [];
    data.expenses = data.expenses.map(function (e) {
      return {
        amount: Number(e.amount) || 0,
        category: String(e.category || 'その他'),
        memo: String(e.memo || ''),
        date: String(e.date || today())
      };
    });
    if (!Array.isArray(data.subs)) data.subs = [];
    if (!data.shifts || typeof data.shifts !== 'object') data.shifts = {};
    if (!data.cardPayDay) data.cardPayDay = 27;
  } catch (e) { }

  function save() {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (e) {
      alert('保存できなかった。ブラウザの保存制限が考えられる。');
      return false;
    }
  }

  // タブ状態保持
  try {
    var navSaved = sessionStorage.getItem('mirai-active-tab');
    if (navSaved && el(navSaved)) el(navSaved).checked = true;
    document.querySelectorAll('input[name=nav]').forEach(function (r) {
      r.addEventListener('change', function () {
        if (this.checked) sessionStorage.setItem('mirai-active-tab', this.id);
      });
    });
  } catch (e) { }

  function yen(n) { return '¥' + Math.round(n).toLocaleString('ja-JP'); }
  function el(id) { return document.getElementById(id); }
  function esc(s) { return String(s || '').replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // --- クレカ引き落とし日セレクト生成 ---
  var payDaySelect = el('cardPayDay');
  for (var day = 1; day <= 31; day++) {
    var opt = document.createElement('option');
    opt.value = day;
    opt.textContent = '毎月 ' + day + ' 日';
    if (day === (data.cardPayDay || 27)) opt.selected = true;
    payDaySelect.appendChild(opt);
  }

  payDaySelect.addEventListener('change', function () {
    data.cardPayDay = Number(this.value);
    save();
    renderExpenses();
  });

  // 初期値セット
  el('date').value = today();
  el('balance').value = data.balance || '';
  el('balance').addEventListener('change', function () {
    data.balance = Math.max(0, Number(this.value) || 0);
    save();
    renderExpenses();
  });

  var colors = ['#6154d8', '#16a58a', '#ef8e4a', '#e45d7a', '#4b9be5', '#e1b44a', '#8e7caa', '#64748b'];

  // --- 円グラフの月選択表示用 ---
  var expenseView = new Date(); // 現在表示中の月

  el('expensePrevMonth').onclick = function () {
    expenseView = new Date(expenseView.getFullYear(), expenseView.getMonth() - 1, 1);
    renderExpenses();
  };
  el('expenseNextMonth').onclick = function () {
    expenseView = new Date(expenseView.getFullYear(), expenseView.getMonth() + 1, 1);
    renderExpenses();
  };

  function renderExpenses() {
    var ey = expenseView.getFullYear();
    var em = expenseView.getMonth() + 1;
    var currentMonthPrefix = ey + '-' + String(em).padStart(2, '0');

    el('expenseMonthLabel').textContent = ey + '年' + em + '月';

    // 有効データクリーニング
    data.expenses = data.expenses.filter(function (e) { return Number(e.amount) > 0; }).map(function (e) {
      e.amount = Number(e.amount) || 0;
      return e;
    });

    // 選択された月だけの支出フィルタ
    var monthlyExpenses = data.expenses.filter(function (e) {
      return e.date.slice(0, 7) === currentMonthPrefix;
    });

    // 当月合計金額
    var total = monthlyExpenses.reduce(function (a, e) { return a + (Number(e.amount) || 0); }, 0);
    el('expenseTotal').textContent = yen(total);

    // 円グラフ構築
    var grouped = {};
    monthlyExpenses.forEach(function (e) {
      var cat = String(e.category || 'その他');
      grouped[cat] = (grouped[cat] || 0) + (Number(e.amount) || 0);
    });

    var entries = Object.keys(grouped).map(function (k) { return [k, grouped[k]]; });
    var angle = 0;
    var stops = [];
    entries.forEach(function (p, i) {
      var slice = total > 0 ? 360 * (p[1] / total) : 0;
      var end = angle + slice;
      if (slice > 0) stops.push(colors[i % colors.length] + ' ' + angle + 'deg ' + end + 'deg');
      angle = end;
    });

    el('pie').style.background = stops.length ? 'conic-gradient(' + stops.join(',') + ')' : '#e6e9f2';

    // 凡例表示
    el('legend').innerHTML = entries.map(function (p, i) {
      return '<div class="line"><span><i class="swatch" style="background:' + colors[i % colors.length] + '"></i>' + esc(p[0]) + '</span><b>' + yen(p[1]) + '</b></div>';
    }).join('');

    // 当月の明細リスト表示
    el('expenseList').innerHTML = monthlyExpenses.slice().reverse().map(function (e) {
      return '<div class="line"><span>' + esc(e.date) + ' ' + esc(e.category) + '<br><span class="small">' + esc(e.memo) + '</span></span><b>' + yen(e.amount) + '</b></div>';
    }).join('');

    // --- 【重要】みらい残高の計算ロジック（引き落とし日判定） ---
    var now = new Date();
    var todayStr = today();
    var payDay = data.cardPayDay || 27;

    // 当月の引き落とし日を計算
    var currentPayDate = new Date(now.getFullYear(), now.getMonth(), payDay);
    var currentPayDateStr = currentPayDate.getFullYear() + '-' +
      String(currentPayDate.getMonth() + 1).padStart(2, '0') + '-' +
      String(currentPayDate.getDate()).padStart(2, '0');

    // 未引き落とし（未来の支出）を集計
    var pendingExpensesTotal = data.expenses.reduce(function (sum, e) {
      var expDate = e.date;

      // 今日の日付が「当月の引き落とし日」より前の場合
      if (todayStr < currentPayDateStr) {
        // 当月の引き落とし日より前の支出（まだ引き落とされていない支出）はすべて差し引く対象
        return sum + e.amount;
      } else {
        // 今日の日付が引き落とし日を過ぎた場合：
        // 当月の引き落とし日より「後」の支出（＝次回の引き落とし対象）のみを差し引く
        if (expDate > currentPayDateStr) {
          return sum + e.amount;
        }
        return sum; // 引き落とし日以前の過去データは口座から引落済みと判断してスルー
      }
    }, 0);

    var currentBalance = Number(data.balance) || 0;
    var futureBal = currentBalance - pendingExpensesTotal;

    el('futureBalance').textContent = yen(futureBal);
    el('balanceDetail').textContent = yen(currentBalance) + ' − 未引き落とし支出 ' + yen(pendingExpensesTotal);

    if (typeof renderCalendar === 'function') renderCalendar();
  }

  // 支出保存
  el('saveExpense').addEventListener('click', function (e) {
    e.preventDefault();
    var amount = Number(el('amount').value);
    var dateValue = el('date').value;
    if (!(amount > 0) || !dateValue) {
      el('expenseStatus').textContent = '金額と日付を入力してほしい';
      return;
    }
    data.expenses.push({
      amount: amount,
      category: el('category').value,
      memo: el('memo').value.trim(),
      date: dateValue
    });
    var ok = save();

    // 登録した支出の月に画面表示を自動切り替え
    var savedDate = new Date(dateValue + 'T00:00:00');
    expenseView = new Date(savedDate.getFullYear(), savedDate.getMonth(), 1);

    renderExpenses();
    el('expenseStatus').textContent = (ok ? '保存・反映完了：' : '画面反映のみ（保存失敗）：') + yen(amount) + '（' + el('category').value + '）';
    el('amount').value = '';
    el('memo').value = '';
  });

  // --- シフト管理 ---
  function bonusFor(s) {
    var day = new Date(s + 'T12:00:00').getDay();
    return day === 6 ? Number(settings.saturday) || 0 : day === 0 ? Number(settings.sunday) || 0 : 0;
  }

  function renderSettings() {
    el('settingWage').value = settings.wage;
    el('settingTransport').value = settings.transport;
    el('settingSaturday').value = settings.saturday;
    el('settingSunday').value = settings.sunday;
    el('settingNight').value = settings.night;
  }

  el('saveShiftSettings').addEventListener('click', function () {
    var w = Number(el('settingWage').value),
      t = Number(el('settingTransport').value),
      sat = Number(el('settingSaturday').value),
      sun = Number(el('settingSunday').value),
      n = Number(el('settingNight').value);
    if (!(w > 0) || [t, sat, sun, n].some(function (x) { return !Number.isFinite(x) || x < 0; })) {
      el('settingsStatus').textContent = '入力値を確認してほしい';
      return;
    }
    settings = { wage: w, transport: t, saturday: sat, sunday: sun, night: n };
    try {
      localStorage.setItem(settingsKey, JSON.stringify(settings));
      el('settingsStatus').textContent = '設定を保存した';
    } catch (e) {
      el('settingsStatus').textContent = '保存できなかった';
    }
    if (!data.shifts[selected]) selectDate(selected);
  });

  var view = new Date(), selected = today();

  function fmt(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function selectDate(s) {
    selected = s;
    el('selectedLabel').textContent = s + ' のシフト';
    var v = data.shifts[s] || {};
    el('start').value = v.start || '09:00';
    el('end').value = v.end || '17:00';
    el('break').value = v.breakMin == null ? 60 : v.breakMin;
    el('shiftStatus').textContent = '';
    renderCalendar();
  }

  function pay(v) {
    var a = v.start.split(':').map(Number), b = v.end.split(':').map(Number), s = a[0] * 60 + a[1], end = b[0] * 60 + b[1];
    if (end <= s) end += 1440;
    var duration = end - s;
    var rest = Math.min(duration, Math.max(0, Number(v.breakMin) || 0));
    var worked = duration - rest;
    var night = 0;
    for (var t = s; t < end; t++) {
      var hour = (t % 1440) / 60;
      if (hour >= 22 || hour < 5) night++;
    }
    night = Math.min(night, worked);
    var rate = Number(settings.wage) || 1200;
    return Math.round(worked / 60 * rate + night / 60 * rate * (Number(settings.night) || 0) / 100 + (Number(settings.transport) || 0) + bonusFor(v.date || selected));
  }

  function renderCalendar() {
    var y = view.getFullYear(), m = view.getMonth();
    el('monthLabel').textContent = y + '年' + (m + 1) + '月';
    var first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
    var html = '';
    ['日', '月', '火', '水', '木', '金', '土'].forEach(function (w) {
      html += '<span class="small" style="text-align:center">' + w + '</span>';
    });
    for (var i = 0; i < first; i++) html += '<span></span>';
    for (var d = 1; d <= days; d++) {
      var date = fmt(new Date(y, m, d));
      var spent = data.expenses.filter(function (e) { return e.date === date; }).reduce(function (a, e) { return a + (Number(e.amount) || 0); }, 0);
      html += '<button type="button" class="day' + (date === selected ? ' selected' : '') + (data.shifts[date] ? ' worked' : '') + '" data-date="' + date + '">' + d + (spent > 0 ? '<span class="expense-mark">−' + Math.round(spent).toLocaleString('ja-JP') + '円</span>' : '') + '</button>';
    }
    el('calendar').innerHTML = html;
    el('calendar').querySelectorAll('[data-date]').forEach(function (b) {
      b.addEventListener('click', function () { selectDate(this.getAttribute('data-date')); });
    });

    var total = 0;
    Object.keys(data.shifts).forEach(function (k) {
      if (k.slice(0, 7) === y + '-' + String(m + 1).padStart(2, '0')) {
        total += pay(Object.assign({ date: k }, data.shifts[k]));
      }
    });
    el('monthlyPay').textContent = yen(total);
  }

  el('prev').onclick = function () { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); renderCalendar(); };
  el('next').onclick = function () { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); renderCalendar(); };

  el('saveShift').addEventListener('click', function (e) {
    e.preventDefault();
    var v = { date: selected, start: el('start').value, end: el('end').value, breakMin: Number(el('break').value) };
    var duration = (Number(v.end.slice(0, 2)) * 60 + Number(v.end.slice(3))) - (Number(v.start.slice(0, 2)) * 60 + Number(v.start.slice(3)));
    if (duration <= 0) duration += 1440;
    if (v.breakMin > duration) {
      alert('休憩時間が勤務時間を超えている');
      return;
    }
    data.shifts[selected] = v;
    save();
    renderCalendar();
    el('shiftStatus').textContent = 'シフトを保存した｜給与見込み ' + yen(pay(v));
  });

  el('removeShift').onclick = function () {
    delete data.shifts[selected];
    save();
    selectDate(selected);
  };

  // --- サブスク管理 ---
  function renderSubs() {
    var total = 0;
    el('subList').innerHTML = data.subs.map(function (s, i) {
      total += s.cycle === 'yearly' ? s.amount / 12 : s.amount;
      return '<div class="line subitem" style="--accent:' + colors[i % colors.length] + '"><span><b>' + esc(s.name) + '</b><br><span class="small">' + (s.cycle === 'yearly' ? '毎年' + s.month + '月' : '毎月') + s.day + '日</span></span><span><b>' + yen(s.amount) + '</b><br><button type="button" class="delete" data-index="' + i + '">削除</button></span></div>';
    }).join('');
    el('subTotal').textContent = yen(total);
    el('subList').querySelectorAll('[data-index]').forEach(function (b) {
      b.onclick = function () {
        data.subs.splice(Number(this.getAttribute('data-index')), 1);
        save();
        renderSubs();
      };
    });
  }

  el('saveSub').addEventListener('click', function (e) {
    e.preventDefault();
    var s = {
      name: el('subName').value.trim(),
      amount: Number(el('subAmount').value),
      cycle: el('subCycle').value,
      day: Number(el('subDay').value),
      month: Number(el('subMonth').value)
    };
    if (!s.name || !(s.amount > 0)) return;
    data.subs.push(s);
    save();
    renderSubs();
    el('subStatus').textContent = '保存した：' + s.name;
    el('subName').value = '';
    el('subAmount').value = '';
  });

  // 初期化実行
  renderSettings();
  renderExpenses();
  selectDate(selected);
  renderSubs();

})();