
let chartInstance = null;

const UI = {
    init() {
        this.checkSharedMode();
        this.setupTabs();
        this.addInitialRows(); // Will populate rows with new structure

        // Initial load happens in app.js
    },

    checkSharedMode() {
        const urlParams = new URLSearchParams(window.location.search);
        const mode = urlParams.get('mode');

        if (mode === 'shared') {
            document.body.classList.add('shared-mode');
            // Hide Tab 1 and Tab 4 buttons and content
            document.querySelector('[data-tab="tab1"]').classList.add('hidden');
            document.querySelector('[data-tab="tab4"]').classList.add('hidden');

            // Switch to Tab 2 by default
            this.switchTab('tab2');
        }
    },

    setupTabs() {
        const navBtns = document.querySelectorAll('.nav-btn');
        navBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.getAttribute('data-tab');
                this.switchTab(targetId);
            });
        });
    },

    switchTab(tabId) {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            // In shared mode, don't show active state for hidden buttons (safety)
            if (btn.classList.contains('hidden')) return;
            btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === tabId);
        });

        if (tabId === 'tab3') {
            document.getElementById('historyListView').classList.remove('hidden');
            document.getElementById('historyDetailView').classList.add('hidden');
            this.renderHistory();
        }
    },

    showLoading(show) {
        const modal = document.getElementById('loadingModal');
        if (show) modal.classList.remove('hidden');
        else modal.classList.add('hidden');
    },

    renderBudgetPreview(data) {
        const tbody = document.querySelector('#budgetTable tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        data.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item['세부항목'] || ''}</td>
                <td>${item['원가통계비목'] || ''}</td>
                <td>${item['산출내역'] || '-'}</td>
                <td>${Number(item['예산액'] || 0).toLocaleString()}원</td>
            `;
            tbody.appendChild(tr);
        });
    },

    // Used to populate the dropdowns in rows
    getBudgetOptionsHTML() {
        // AppState should be accessed globally or passed. 
        // We'll access the global appState from app.js via window or just rely on the stored array in app.js if we exported it?
        // Better: app.js updates UI with data. But rows are dynamic.
        // We will store budget items in UI for reference.
        const items = window.appState ? window.appState.budgetItems : [];
        if (items.length === 0) return '<option value="">예산 없음</option>';

        return items.map(item => `<option value="${item['산출내역']}">${item['산출내역']}</option>`).join('');
    },

    // Updates existing rows with new budget data
    updateBudgetDropdown(data) {
        // Re-generate options HTML
        const optionsHTML = '<option value="">선택</option>' + this.getBudgetOptionsHTML();

        // Update all existing selects
        const selects = document.querySelectorAll('.budget-select');
        selects.forEach(select => {
            const currentVal = select.value;
            select.innerHTML = optionsHTML;
            // Restore selection if valid
            if (currentVal && Array.from(select.options).some(o => o.value === currentVal)) {
                select.value = currentVal;
            } else {
                select.value = "";
            }
        });
    },

    renderBudgetChart(items) {
        // With multi-item budget selection, the chart could either show:
        // 1. Total overview of ALL budgets (too messy)
        // 2. Just a specific one selected?
        // The user prompt said: "Upload budget items... show donut graph of current balance... arrow buttons to flip through".
        // This requirement remains VALID. We just need to visualize the budgets available.
        // So we keep the same logic: Iterate through available budgets.

        // Global index
        const currentIndex = window.appState ? window.appState.currentBudgetIndex : 0;
        const currentItem = items[currentIndex];
        const label = document.getElementById('currentBudgetName');
        const ctx = document.getElementById('budgetChart');

        if (!currentItem) {
            label.textContent = "예산 항목이 없습니다.";
            if (chartInstance) chartInstance.destroy();
            return;
        }

        label.textContent = `${currentItem['산출내역']} (${currentIndex + 1}/${items.length})`;

        const total = Number(currentItem['예산액']) || 0;
        const used = Number(currentItem['used']) || 0;
        const remain = total - used;

        const chartData = {
            labels: ['사용액', '잔액'],
            datasets: [{
                data: [used, remain],
                backgroundColor: ['#FFB7B2', '#B5EAD7'],
                hoverBackgroundColor: ['#FF9E99', '#A3E2CC'],
                borderWidth: 0
            }]
        };

        if (chartInstance) {
            chartInstance.destroy();
        }

        chartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    },

    addInitialRows() {
        const tbody = document.getElementById('itemsTableBody');
        tbody.innerHTML = ''; // clear first
        for (let i = 0; i < 5; i++) {
            this.addItemRow();
        }
    },

    addItemRow() {
        const tbody = document.getElementById('itemsTableBody');
        const tr = document.createElement('tr');

        // Budget Options
        const budgetOptions = '<option value="">선택</option>' + this.getBudgetOptionsHTML();

        tr.innerHTML = `
            <td class="check-col hidden" style="text-align:center;"><input type="checkbox" class="row-check"></td>
            <td>
                <select class="table-input budget-select" required>
                    ${budgetOptions}
                </select>
            </td>
            <td><input type="text" class="table-input item-name" name="name" required></td>
            <td><input type="text" class="table-input" name="spec"></td>
            <td><input type="text" class="table-input number-input qty-input" name="qty" placeholder="0"></td>
            <td><input type="text" class="table-input number-input price-input" name="price" placeholder="0"></td>
            <td style="text-align:right;"><span class="row-total">0</span></td>
            <td><input type="text" class="table-input" name="vendor"></td>
            <td class="shipping-cell">
                <div class="shipping-wrapper">
                    <label><input type="checkbox" class="shipping-check"> 별도</label>
                    <input type="text" class="table-input number-input shipping-input hidden" placeholder="금액">
                </div>
            </td>
        `;
        tbody.appendChild(tr);

        // Add event listeners for new inputs
        const numberInputs = tr.querySelectorAll('.number-input');
        numberInputs.forEach(input => {
            input.addEventListener('input', (e) => {
                this.formatNumberInput(e.target);
                this.calculateRowTotal(tr);
                this.calculateGrandTotal();
            });
        });

        const shippingCheck = tr.querySelector('.shipping-check');
        const shippingInput = tr.querySelector('.shipping-input');
        shippingCheck.addEventListener('change', () => {
            if (shippingCheck.checked) {
                shippingInput.classList.remove('hidden');
                shippingInput.focus();
            } else {
                shippingInput.classList.add('hidden');
                shippingInput.value = '';
                this.calculateRowTotal(tr); // re-calc to remove shipping
                this.calculateGrandTotal();
            }
        });
    },

    formatNumberInput(input) {
        let value = input.value.replace(/,/g, '');
        if (isNaN(value) || value === '') {
            // allow empty but not invalid chars if possible, removing non-digits
            value = value.replace(/[^0-9]/g, '');
        }
        if (value) {
            input.value = Number(value).toLocaleString();
        } else {
            input.value = '';
        }
    },

    parseLocaleNumber(stringNumber) {
        if (!stringNumber) return 0;
        return Number(stringNumber.replace(/,/g, ''));
    },

    toggleDeleteMode() {
        const btn = document.getElementById('deleteModeBtn');
        const isDeleteMode = btn.classList.contains('active');
        const checkCols = document.querySelectorAll('.check-col');

        if (!isDeleteMode) {
            btn.classList.add('active');
            btn.innerHTML = '<i class="fa-solid fa-check"></i> 삭제 확인';
            checkCols.forEach(col => col.classList.remove('hidden'));
        } else {
            // Perform delete
            const checkboxes = document.querySelectorAll('.row-check:checked');
            checkboxes.forEach(chk => {
                chk.closest('tr').remove();
            });

            btn.classList.remove('active');
            btn.innerHTML = '<i class="fa-solid fa-trash"></i> 삭제 모드';
            checkCols.forEach(col => col.classList.add('hidden'));

            this.calculateGrandTotal();
        }
    },

    calculateRowTotal(row) {
        const qty = this.parseLocaleNumber(row.querySelector('.qty-input').value);
        const price = this.parseLocaleNumber(row.querySelector('.price-input').value);
        let total = qty * price;

        row.querySelector('.row-total').textContent = total.toLocaleString();
        row.dataset.itemTotal = total; // Item total without shipping
    },

    calculateGrandTotal() {
        const rows = document.querySelectorAll('#itemsTableBody tr');
        let grandTotal = 0;
        rows.forEach(row => {
            let itemTotal = Number(row.dataset.itemTotal || 0);
            let shipping = 0;
            const shipCheck = row.querySelector('.shipping-check');
            if (shipCheck && shipCheck.checked) {
                shipping = this.parseLocaleNumber(row.querySelector('.shipping-input').value);
            }
            grandTotal += (itemTotal + shipping);
        });

        document.getElementById('totalAmount').textContent = grandTotal.toLocaleString();
        return grandTotal;
    },

    getExpenditureFormData() {
        const docName = document.getElementById('docName').value;
        if (!docName) {
            alert('문서명을 입력해주세요.');
            return null;
        }

        const items = [];
        let valid = true;
        const rows = document.querySelectorAll('#itemsTableBody tr');

        for (let row of rows) {
            const name = row.querySelector('input[name="name"]').value;
            if (!name) continue; // Skip empty rows

            const budgetName = row.querySelector('.budget-select').value;
            if (!budgetName) {
                alert('모든 물품의 예산 항목을 선택해주세요.');
                return null;
            }

            const qty = this.parseLocaleNumber(row.querySelector('.qty-input').value);
            const price = this.parseLocaleNumber(row.querySelector('.price-input').value);
            const itemTotal = qty * price;

            let shipping = 0;
            if (row.querySelector('.shipping-check').checked) {
                shipping = this.parseLocaleNumber(row.querySelector('.shipping-input').value);
            }

            items.push({
                budgetName: budgetName,
                name: name,
                spec: row.querySelector('input[name="spec"]').value,
                qty: qty,
                price: price,
                itemTotal: itemTotal, // pure price
                shipping: shipping,
                total: itemTotal + shipping, // row total
                vendor: row.querySelector('input[name="vendor"]').value
            });
        }

        if (items.length === 0) {
            alert('최소 1개 이상의 물품을 입력해주세요.');
            return null;
        }

        return {
            docName,
            items,
            totalAmount: this.calculateGrandTotal(),
            date: new Date().toISOString()
        };
    },


    // Copy Shared Link Logic
    copySharedLink() {
        const url = new URL(window.location.href);
        url.searchParams.set('mode', 'shared');
        navigator.clipboard.writeText(url.toString()).then(() => {
            alert('공유 링크가 복사되었습니다! 이 링크를 공유하면 예산 관리 탭이 보이지 않습니다.');
        });
    }
};

window.viewHistoryItem = (idx) => {
    const item = window._tempHistory ? window._tempHistory[idx] : null;
    if (item) {
        // Pretty print items
        let msg = `[${item.docName}]\n`;
        item.items.forEach(i => {
            msg += `- ${i.name} / ${i.qty}개 / ${i.total.toLocaleString()}원 (배송비: ${i.shipping})\n`;
        });
        msg += `\n총 합계: ${Number(item.totalAmount).toLocaleString()}원`;
        alert(msg);
    }
}
