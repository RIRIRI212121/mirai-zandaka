document.addEventListener('DOMContentLoaded', () => {
    const today = new Date().toISOString().split('T')[0];
    const dateEl = document.getElementById('date');
    if(dateEl) dateEl.value = today;

    const cardPayDayEl = document.getElementById('cardPayDay');
    if(cardPayDayEl) {
        for(let i = 1; i <= 31; i++) {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = `${i}日`;
            if(i === 27) opt.selected = true;
            cardPayDayEl.appendChild(opt);
        }
    }

    const saveExpenseBtn = document.getElementById('saveExpense');
    if(saveExpenseBtn) {
        saveExpenseBtn.addEventListener('click', () => {
            const amount = document.getElementById('amount').value;
            const category = document.getElementById('category').value;
            const memo = document.getElementById('memo').value;
            const date = document.getElementById('date').value;

            if(!amount || !date) {
                alert('金額と日付を入力してください！');
                return;
            }

            let expenses = JSON.parse(localStorage.getItem('mirai_expenses') || '[]');
            expenses.push({ id: Date.now(), amount: Number(amount), category, memo, date });
            localStorage.setItem('mirai_expenses', JSON.stringify(expenses));

            alert('家計簿に保存しました！');
            document.getElementById('amount').value = '';
            document.getElementById('memo').value = '';
            updateExpenseDisplay();
        });
    }

    const saveShiftSettingsBtn = document.getElementById('saveShiftSettings');
    if(saveShiftSettingsBtn) {
        saveShiftSettingsBtn.addEventListener('click', () => {
            const wage = document.getElementById('settingWage').value;
            const transport = document.getElementById('settingTransport').value;
            const saturday = document.getElementById('settingSaturday').value;
            const sunday = document.getElementById('settingSunday').value;
            const night = document.getElementById('settingNight').value;

            const shiftSettings = { wage, transport, saturday, sunday, night };
            localStorage.setItem('mirai_shift_settings', JSON.stringify(shiftSettings));

            alert('給与設定を保存しました！');
            const shiftSettingsDetails = document.getElementById('shiftSettings');
            if(shiftSettingsDetails) {
                shiftSettingsDetails.removeAttribute('open');
            }
        });
    }

    initCalendar();
    updateExpenseDisplay();
});

let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();
let selectedDateStr = null;

function initCalendar() {
    renderCalendar();
    
    const prevBtn = document.getElementById('prev');
    const nextBtn = document.getElementById('next');
    if(prevBtn) {
        prevBtn.addEventListener('click', () => {
            currentMonth--;
            if(currentMonth < 0) {
                currentMonth = 11;
                currentYear--;
            }
            renderCalendar();
        });
    }
    if(nextBtn) {
        nextBtn.addEventListener('click', () => {
            currentMonth++;
            if(currentMonth > 11) {
                currentMonth = 0;
                currentYear++;
            }
            renderCalendar();
        });
    }

    const saveShiftBtn = document.getElementById('saveShift');
    if(saveShiftBtn) {
        saveShiftBtn.addEventListener('click', () => {
            if(!selectedDateStr) {
                alert('カレンダーから日付を選択してください！');
                return;
            }
            const start = document.getElementById('start').value;
            const end = document.getElementById('end').value;
            const breakTime = document.getElementById('break').value;

            let shifts = JSON.parse(localStorage.getItem('mirai_shifts') || '{}');
            shifts[selectedDateStr] = { start, end, breakTime };
            localStorage.setItem('mirai_shifts', JSON.stringify(shifts));

            alert(`${selectedDateStr} のシフトを保存しました！`);
            renderCalendar();
            calcMonthlyPay();
        });
    }

    const removeShiftBtn = document.getElementById('removeShift');
    if(removeShiftBtn) {
        removeShiftBtn.addEventListener('click', () => {
            if(!selectedDateStr) {
                alert('カレンダーから日付を選択してください！');
                return;
            }
            let shifts = JSON.parse(localStorage.getItem('mirai_shifts') || '{}');
            delete shifts[selectedDateStr];
            localStorage.setItem('mirai_shifts', JSON.stringify(shifts));

            alert(`${selectedDateStr} のシフトを削除しました！`);
            renderCalendar();
            calcMonthlyPay();
        });
    }
}

function renderCalendar() {
    const monthLabel = document.getElementById('monthLabel');
    const calendarEl = document.getElementById('calendar');
    if(!monthLabel || !calendarEl) return;

    monthLabel.textContent = `${currentYear}年 ${currentMonth + 1}月`;
    calendarEl.innerHTML = '';

    const weeks = ['日', '月', '火', '水', '木', '金', '土'];
    weeks.forEach(w => {
        const div = document.createElement('div');
        div.className = 'calendar-header';
        div.textContent = w;
        calendarEl.appendChild(div);
    });

    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
    let shifts = JSON.parse(localStorage.getItem('mirai_shifts') || '{}');

    for(let i = 0; i < firstDayIndex; i++) {
        const div = document.createElement('div');
        calendarEl.appendChild(div);
    }

    for(let d = 1; d <= lastDay; d++) {
        const div = document.createElement('div');
        div.className = 'calendar-cell';
        const mm = String(currentMonth + 1).padStart(2, '0');
        const dd = String(d).padStart(2, '0');
        const dateStr = `${currentYear}-${mm}-${dd}`;

        div.textContent = d;
        if(shifts[dateStr]) {
            div.classList.add('has-shift');
        }

        div.addEventListener('click', () => {
            selectedDateStr = dateStr;
            const selectedLabel = document.getElementById('selectedLabel');
            if(selectedLabel) selectedLabel.textContent = `${dateStr} のシフト入力`;
            
            if(shifts[dateStr]) {
                document.getElementById('start').value = shifts[dateStr].start || '09:00';
                document.getElementById('end').value = shifts[dateStr].end || '17:00';
                document.getElementById('break').value = shifts[dateStr].breakTime || '60';
            }
        });

        calendarEl.appendChild(div);
    }
    calcMonthlyPay();
}

function calcMonthlyPay() {
    let shifts = JSON.parse(localStorage.getItem('mirai_shifts') || '{}');
    let settings = JSON.parse(localStorage.getItem('mirai_shift_settings') || '{"wage":1200,"transport":0,"saturday":0,"sunday":0,"night":25}');
    let wage = Number(settings.wage);
    let transport = Number(settings.transport);
    let satBonus = Number(settings.saturday);
    let sunBonus = Number(settings.sunday);

    let totalPay = 0;

    Object.keys(shifts).forEach(dateStr => {
        const [y, m, d] = dateStr.split('-').map(Number);
        if(y === currentYear && (m - 1) === currentMonth) {
            const shift = shifts[dateStr];
            const startH = timeToHours(shift.start);
            const endH = timeToHours(shift.end);
            let hours = endH - startH - (Number(shift.breakTime) / 60);
            if(hours < 0) hours = 0;

            let dayPay = hours * wage;
            dayPay += transport;

            const dateObj = new Date(y, m - 1, d);
            const dayOfWeek = dateObj.getDay();
            if(dayOfWeek === 6) dayPay += satBonus;
            if(dayOfWeek === 0) dayPay += sunBonus;

            totalPay += dayPay;
        }
    });

    const monthlyPayEl = document.getElementById('monthlyPay');
    if(monthlyPayEl) monthlyPayEl.textContent = `¥${Math.round(totalPay).toLocaleString()}`;
}

function timeToHours(timeStr) {
    if(!timeStr) return 0;
    const parts = timeStr.split(':');
    return Number(parts[0]) + Number(parts[1]) / 60;
}

function updateExpenseDisplay() {
    let expenses = JSON.parse(localStorage.getItem('mirai_expenses') || '[]');
    let total = expenses.reduce((sum, item) => sum + item.amount, 0);
    
    const totalEl = document.getElementById('expenseTotal');
    if(totalEl) totalEl.textContent = `¥${total.toLocaleString()}`;

    const listEl = document.getElementById('expenseList');
    if(listEl) {
        if(expenses.length === 0) {
            listEl.innerHTML = '<div class="small" style="margin-top:10px;">データはまだありません。</div>';
            return;
        }
        listEl.innerHTML = expenses.map(item => `
            <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #eee; font-size:14px;">
                <span>${item.date} [${item.category}] ${item.memo || ''}</span>
                <strong>¥${item.amount.toLocaleString()}</strong>
            </div>
        `).join('');
    }
}
