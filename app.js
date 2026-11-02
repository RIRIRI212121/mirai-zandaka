// 未来残高・家計簿アプリ用メインスクリプト
document.addEventListener('DOMContentLoaded', () => {
    // 日付の初期値を今日に設定
    const today = new Date().toISOString().split('T')[0];
    const dateEl = document.getElementById('date');
    if(dateEl) dateEl.value = today;

    // クレカ引き落とし日の選択肢を生成（1日〜31日）
    const cardPayDayEl = document.getElementById('cardPayDay');
    if(cardPayDayEl) {
        for(let i = 1; i <= 31; i++) {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = `${i}日`;
            if(i === 27) opt.selected = true; // デフォルト27日
            cardPayDayEl.appendChild(opt);
        }
    }

    // 保存ボタンのイベントなど
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

    updateExpenseDisplay();
});

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