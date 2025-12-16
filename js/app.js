
// Global State
const appState = {
    budgetItems: [], // [{ subCategory, costCategory, detailItem, amount, used }]
    currentBudgetIndex: 0
};

document.addEventListener('DOMContentLoaded', async () => {
    UI.init();

    // Check for API URL
    const savedUrl = CONFIG.getScriptUrl();
    if (savedUrl) {
        document.getElementById('sharedApiUrl').value = savedUrl;
        // Try to fetch data
        try {
            await loadInitialData();
        } catch (e) {
            console.error("Failed to load initial data", e);
            // Fallback to local
            await loadInitialData(true);
        }
    } else {
        // Load local mock data
        await loadInitialData(true);
    }
});

async function loadInitialData(forceLocal = false) {
    UI.showLoading(true);
    try {
        let budgetData;
        if (forceLocal || !CONFIG.getScriptUrl()) {
            budgetData = JSON.parse(localStorage.getItem('local_budget_data') || '[]');
        } else {
            budgetData = await API.getBudgetData();
        }

        appState.budgetItems = budgetData;

        // Restore used amounts from local history if not using API-side calc
        if (forceLocal && budgetData.length > 0) {
            const history = JSON.parse(localStorage.getItem('local_history') || '[]');
            // Re-calculate used
            budgetData.forEach(b => b.used = 0);
            history.forEach(h => {
                const b = budgetData.find(bi => bi['산출내역'] === h.budgetName);
                if (b) b.used = (b.used || 0) + h.totalAmount;
            });
        }

        UI.renderBudgetPreview(budgetData);
        UI.updateBudgetDropdown(budgetData);
        UI.renderBudgetChart(appState.budgetItems, appState.currentBudgetIndex);
    } catch (e) {
        console.error(e);
    } finally {
        UI.showLoading(false);
    }
}

// Event Listeners
document.getElementById('downloadTemplateBtn').addEventListener('click', () => {
    ExcelHandler.downloadTemplate();
});

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('budgetFileInput');

dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.backgroundColor = '#f0f4ff';
});
dropZone.addEventListener('dragleave', () => dropZone.style.backgroundColor = '');
dropZone.addEventListener('drop', handleFileSelect);
fileInput.addEventListener('change', handleFileSelect);

async function handleFileSelect(e) {
    e.preventDefault();
    dropZone.style.backgroundColor = '';

    let file;
    if (e.dataTransfer) {
        file = e.dataTransfer.files[0];
    } else {
        file = e.target.files[0];
    }

    if (!file) return;

    try {
        const data = await ExcelHandler.readBudgetFile(file);
        appState.budgetItems = data.map(item => ({ ...item, used: 0 })); // Initialize used amount
        UI.renderBudgetPreview(appState.budgetItems);
        document.getElementById('budgetPreview').classList.remove('hidden');
    } catch (err) {
        alert(err.message);
    }
}

document.getElementById('saveBudgetBtn').addEventListener('click', async () => {
    UI.showLoading(true);
    try {
        await API.saveBudget(appState.budgetItems);
        // Force refresh data
        await loadInitialData();

        alert('예산이 성공적으로 저장되었습니다!');
        UI.switchTab('tab2');
    } catch (error) {
        alert('저장 실패: ' + error.message);
    } finally {
        UI.showLoading(false);
    }
});

// Chart Navigation
document.getElementById('prevChartBtn').addEventListener('click', () => {
    if (appState.budgetItems.length === 0) return;
    appState.currentBudgetIndex = (appState.currentBudgetIndex - 1 + appState.budgetItems.length) % appState.budgetItems.length;
    UI.renderBudgetChart(appState.budgetItems, appState.currentBudgetIndex);
});

document.getElementById('nextChartBtn').addEventListener('click', () => {
    if (appState.budgetItems.length === 0) return;
    appState.currentBudgetIndex = (appState.currentBudgetIndex + 1) % appState.budgetItems.length;
    UI.renderBudgetChart(appState.budgetItems, appState.currentBudgetIndex);
});

// Items Table
document.getElementById('addRowBtn').addEventListener('click', () => UI.addItemRow());
document.getElementById('deleteModeBtn').addEventListener('click', () => UI.toggleDeleteMode());

// Dynamic Calculation
document.getElementById('itemsTable').addEventListener('input', (e) => {
    if (e.target.matches('.qty-input') || e.target.matches('.price-input')) {
        UI.calculateRowTotal(e.target.closest('tr'));
        UI.calculateGrandTotal();
    }
});

// Shipping
document.getElementById('shippingToggle').addEventListener('change', (e) => {
    const shippingArea = document.getElementById('shippingInputArea');
    if (e.target.checked) {
        shippingArea.classList.remove('hidden');
        document.getElementById('shippingCost').focus();
    } else {
        shippingArea.classList.add('hidden');
        document.getElementById('shippingCost').value = 0;
    }
    UI.calculateGrandTotal();
});

document.getElementById('shippingCost').addEventListener('input', UI.calculateGrandTotal);

// Generate Excel
document.getElementById('generateExcelBtn').addEventListener('click', () => {
    const formData = UI.getExpenditureFormData();
    if (!formData) return;

    // Find budget info
    const budgetItem = appState.budgetItems.find(b => b['산출내역'] === formData.budgetName);

    ExcelHandler.generateRequestFile(formData, budgetItem);
});

// Submit
document.getElementById('submitRequestBtn').addEventListener('click', async () => {
    const formData = UI.getExpenditureFormData();
    if (!formData) return;

    if (!confirm('이대로 제출하시겠습니까? 예산에서 차감됩니다.')) return;

    UI.showLoading(true);
    try {
        await API.submitExpenditure(formData);

        // Update Local State for immediate feedback
        const budgetIndex = appState.budgetItems.findIndex(b => b['산출내역'] === formData.budgetName);
        if (budgetIndex >= 0) {
            appState.budgetItems[budgetIndex].used = (appState.budgetItems[budgetIndex].used || 0) + formData.totalAmount;
            UI.renderBudgetChart(appState.budgetItems, appState.currentBudgetIndex);
        }

        alert('제출 완료되었습니다.');
        location.reload();
    } catch (e) {
        alert('제출 실패: ' + e.message);
    } finally {
        UI.showLoading(false);
    }
});

// Settings
document.getElementById('connectSharedBtn').addEventListener('click', () => {
    const url = document.getElementById('sharedApiUrl').value.trim();
    if (url) {
        CONFIG.setScriptUrl(url);
        alert('URL이 저장되었습니다. 페이지를 새로고침합니다.');
        location.reload();
    }
});
