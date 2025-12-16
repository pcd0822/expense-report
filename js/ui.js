
let chartInstance = null;

const UI = {
    init() {
        this.setupTabs();
        this.addInitialRows();
        this.renderHistory();
    },

    setupTabs() {
        const navBtns = document.querySelectorAll('.nav-btn');
        // const contents = document.querySelectorAll('.tab-content'); // Not needed if we use CSS class

        navBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.getAttribute('data-tab');
                this.switchTab(targetId);
            });
        });
    },

    switchTab(tabId) {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === tabId);
        });

        if (tabId === 'tab3') {
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

    updateBudgetDropdown(data) {
        const select = document.getElementById('budgetSelect');
        select.innerHTML = '<option value="">선택해주세요</option>';
        data.forEach(item => {
            const option = document.createElement('option');
            option.value = item['산출내역'];
            option.textContent = item['산출내역'];
            select.appendChild(option);
        });
    },

    renderBudgetChart(items, currentIndex) {
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
        for (let i = 0; i < 5; i++) {
            this.addItemRow();
        }
    },

    addItemRow() {
        const tbody = document.getElementById('itemsTableBody');
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="check-col hidden"><input type="checkbox" class="row-check"></td>
            <td><input type="text" class="table-input item-name" name="name" required></td>
            <td><input type="text" class="table-input" name="spec"></td>
            <td><input type="number" class="table-input qty-input" name="qty" min="1" value="0"></td>
            <td><input type="number" class="table-input price-input" name="price" min="0" value="0"></td>
            <td><span class="row-total">0</span></td>
            <td><input type="text" class="table-input" name="vendor"></td>
        `;
        tbody.appendChild(tr);
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

            this.calculateGrandTotal(); // Re-calc 
        }
    },

    calculateRowTotal(row) {
        const qty = Number(row.querySelector('.qty-input').value) || 0;
        const price = Number(row.querySelector('.price-input').value) || 0;
        const total = qty * price;
        row.querySelector('.row-total').textContent = total.toLocaleString();
        row.dataset.total = total;
    },

    calculateGrandTotal() {
        const rows = document.querySelectorAll('#itemsTableBody tr');
        let sum = 0;
        rows.forEach(row => {
            sum += Number(row.dataset.total || 0);
        });

        const shipping = document.getElementById('shippingToggle').checked ?
            (Number(document.getElementById('shippingCost').value) || 0) : 0;

        const total = sum + shipping;
        document.getElementById('totalAmount').textContent = total.toLocaleString();

        return total;
    },

    getExpenditureFormData() {
        const docName = document.getElementById('docName').value;
        const budgetName = document.getElementById('budgetSelect').value;

        if (!docName || !budgetName) {
            alert('문서명과 예산 항목을 선택해주세요.');
            return null;
        }

        const items = [];
        document.querySelectorAll('#itemsTableBody tr').forEach(row => {
            const name = row.querySelector('input[name="name"]').value;
            if (!name) return; // Skip empty rows

            items.push({
                name: name,
                spec: row.querySelector('input[name="spec"]').value,
                qty: Number(row.querySelector('input[name="qty"]').value),
                price: Number(row.querySelector('input[name="price"]').value),
                total: Number(row.dataset.total || 0),
                vendor: row.querySelector('input[name="vendor"]').value
            });
        });

        if (items.length === 0) {
            alert('최소 1개 이상의 물품을 입력해주세요.');
            return null;
        }

        const shipping = document.getElementById('shippingToggle').checked ?
            (Number(document.getElementById('shippingCost').value) || 0) : 0;

        return {
            docName,
            budgetName,
            items,
            shipping,
            totalAmount: this.calculateGrandTotal(), // ensure up to date
            date: new Date().toISOString()
        };
    },

    renderHistory() {
        const historyList = document.getElementById('historyList');
        // Fetch from local for now, sync with API logic is in app.js init
        const history = JSON.parse(localStorage.getItem('local_history') || '[]');

        historyList.innerHTML = '';
        if (history.length === 0) {
            historyList.innerHTML = '<p style="text-align:center; color:#999;">아직 작성된 지출 품의서가 없습니다.</p>';
            return;
        }

        const table = document.createElement('table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th>문서명</th>
                    <th>예산항목</th>
                    <th>총액</th>
                    <th>작성일</th>
                    <th>작업</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;

        history.forEach((h, idx) => {
            const tr = document.createElement('tr');
            const date = new Date(h.date).toLocaleDateString();
            tr.innerHTML = `
                <td>${h.docName}</td>
                <td>${h.budgetName}</td>
                <td>${h.totalAmount.toLocaleString()}원</td>
                <td>${date}</td>
                <td>
                    <button class="btn small primary" onclick="viewHistoryItem(${idx})">조회</button>
                    <!-- Edit logic omitted for brevity in MVP -->
                </td>
            `;
            table.querySelector('tbody').appendChild(tr);
        });
        historyList.appendChild(table);
    }
};

// Expose query function for inline onclick
window.viewHistoryItem = (idx) => {
    const history = JSON.parse(localStorage.getItem('local_history') || '[]');
    const item = history[idx];
    if (item) {
        alert(JSON.stringify(item, null, 2)); // Simple view for now
    }
}
