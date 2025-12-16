
// Global State
window.appState = {
    budgetItems: [],
    currentBudgetIndex: 0
};

document.addEventListener('DOMContentLoaded', async () => {
    // Expose UI for debugging
    window.UI = UI;
    UI.init();

    // Check for API URL
    const savedUrl = CONFIG.getScriptUrl();
    if (savedUrl) {
        const input = document.getElementById('sharedApiUrl');
        if (input) input.value = savedUrl;

        try {
            await loadInitialData();
        } catch (e) {
            console.error("Failed to load initial data", e);
            await loadInitialData(true);
        }
    } else {
        await loadInitialData(true);
    }

    // Initialize Event Listeners safely after DOM is loaded
    setupEventListeners();
});

function setupEventListeners() {
    // Shared Mode & Connect Logic
    const connectBtn = document.getElementById('connectSharedBtn');
    if (connectBtn) {
        // Create Copy Link Button dynamically if not exists
        if (!document.getElementById('copyLinkBtn')) {
            const linkBtn = document.createElement('button');
            linkBtn.id = 'copyLinkBtn';
            linkBtn.className = 'btn secondary';
            linkBtn.innerHTML = '<i class="fa-solid fa-link"></i> 공유 링크 복사';
            linkBtn.style.marginLeft = '10px';
            linkBtn.onclick = () => UI.copySharedLink();
            connectBtn.parentNode.appendChild(linkBtn);
        }

        connectBtn.addEventListener('click', () => {
            const urlInput = document.getElementById('sharedApiUrl');
            const url = urlInput.value.trim();
            if (url) {
                CONFIG.setScriptUrl(url);
                alert('URL이 저장되었습니다. 페이지를 새로고침합니다.');
                location.reload();
            } else {
                alert('URL을 입력해주세요.');
            }
        });
    }

    // Chart Navigation
    const prevBtn = document.getElementById('prevChartBtn');
    if (prevBtn) prevBtn.addEventListener('click', () => {
        if (window.appState.budgetItems.length === 0) return;
        window.appState.currentBudgetIndex = (window.appState.currentBudgetIndex - 1 + window.appState.budgetItems.length) % window.appState.budgetItems.length;
        UI.renderBudgetChart(window.appState.budgetItems);
    });

    const nextBtn = document.getElementById('nextChartBtn');
    if (nextBtn) nextBtn.addEventListener('click', () => {
        if (window.appState.budgetItems.length === 0) return;
        window.appState.currentBudgetIndex = (window.appState.currentBudgetIndex + 1) % window.appState.budgetItems.length;
        UI.renderBudgetChart(window.appState.budgetItems);
    });

    // Items Table Buttons
    const addRowBtn = document.getElementById('addRowBtn');
    if (addRowBtn) addRowBtn.addEventListener('click', () => UI.addItemRow());

    const delModeBtn = document.getElementById('deleteModeBtn');
    if (delModeBtn) delModeBtn.addEventListener('click', () => UI.toggleDeleteMode());

    // Generate PDF
    const pdfBtn = document.getElementById('generatePdfBtn');
    if (pdfBtn) pdfBtn.addEventListener('click', () => {
        const formData = UI.getExpenditureFormData();
        if (!formData) return;
        generateAndPrintPDF(formData);
    });

    // Submit
    const submitBtn = document.getElementById('submitRequestBtn');
    if (submitBtn) submitBtn.addEventListener('click', handleSubmit);

    // Budget Upload & Save
    const dlTemplateBtn = document.getElementById('downloadTemplateBtn');
    if (dlTemplateBtn) dlTemplateBtn.addEventListener('click', () => ExcelHandler.downloadTemplate());

    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('budgetFileInput');

    if (dropZone && fileInput) {
        dropZone.addEventListener('click', () => fileInput.click());
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.style.backgroundColor = '#f0f4ff';
        });
        dropZone.addEventListener('dragleave', () => dropZone.style.backgroundColor = '');
        dropZone.addEventListener('drop', handleFileSelect);
        fileInput.addEventListener('change', handleFileSelect);
    }

    const saveBudgetBtn = document.getElementById('saveBudgetBtn');
    if (saveBudgetBtn) saveBudgetBtn.addEventListener('click', handleSaveBudget);

    // History Edit Mode Listeners
    const backBtn = document.getElementById('backToListBtn');
    if (backBtn) backBtn.addEventListener('click', () => {
        document.getElementById('historyDetailView').classList.add('hidden');
        document.getElementById('historyListView').classList.remove('hidden');
    });

    const editAddRow = document.getElementById('editAddRowBtn');
    if (editAddRow) editAddRow.addEventListener('click', () => UI.addEditItemRow());

    const delHistBtn = document.getElementById('deleteHistoryBtn');
    if (delHistBtn) delHistBtn.addEventListener('click', async () => {
        if (!confirm('정말 삭제하시겠습니까? 예산에서 차감된 금액이 복구됩니다.')) return;

        UI.showLoading(true);
        try {
            await API.deleteHistory(window._currentEditId);
            alert('삭제되었습니다.');
            document.getElementById('backToListBtn').click();
            UI.renderHistory();

            // Refresh budget too
            await loadInitialData();
        } catch (e) {
            alert('삭제 실패: ' + e.message);
        } finally {
            UI.showLoading(false);
        }
    });

    const updateHistBtn = document.getElementById('updateHistoryBtn');
    if (updateHistBtn) updateHistBtn.addEventListener('click', async () => {
        const data = UI.getEditFormData();
        if (!data) return;

        if (!confirm('수정사항을 저장하시겠습니까? 예산 사용액이 재계산됩니다.')) return;

        UI.showLoading(true);
        try {
            await API.updateHistory(window._currentEditId, data);
            alert('수정되었습니다.');
            // Reload history logic?
            document.getElementById('backToListBtn').click();
            UI.renderHistory();

            await loadInitialData();
        } catch (e) {
            alert('수정 실패: ' + e.message);
        } finally {
            UI.showLoading(false);
        }
    });
}

// Handler Functions
async function handleFileSelect(e) {
    e.preventDefault();
    const dropZone = document.getElementById('dropZone');
    if (dropZone) dropZone.style.backgroundColor = '';

    let file;
    if (e.dataTransfer) {
        file = e.dataTransfer.files[0];
    } else {
        file = e.target.files[0];
    }

    if (!file) return;

    try {
        const data = await ExcelHandler.readBudgetFile(file);
        window.appState.budgetItems = data.map(item => ({ ...item, used: 0 }));
        UI.renderBudgetPreview(window.appState.budgetItems);
        document.getElementById('budgetPreview').classList.remove('hidden');
    } catch (err) {
        alert(err.message);
    }
}

async function handleSaveBudget() {
    UI.showLoading(true);
    try {
        await API.saveBudget(window.appState.budgetItems);
        await loadInitialData();
        alert('예산이 성공적으로 저장되었습니다!');
        UI.switchTab('tab2');
    } catch (error) {
        alert('저장 실패: ' + error.message);
    } finally {
        UI.showLoading(false);
    }
}

async function handleSubmit() {
    const formData = UI.getExpenditureFormData();
    if (!formData) return;

    if (!confirm('이대로 제출하시겠습니까? 예산에서 차감됩니다.')) return;

    UI.showLoading(true);
    try {
        await API.submitExpenditure(formData);

        formData.items.forEach(item => {
            const budgetIndex = window.appState.budgetItems.findIndex(b => b['산출내역'] === item.budgetName);
            if (budgetIndex >= 0) {
                window.appState.budgetItems[budgetIndex].used = (window.appState.budgetItems[budgetIndex].used || 0) + item.total;
            }
        });

        UI.renderBudgetChart(window.appState.budgetItems);
        alert('제출 완료되었습니다.');
        window.location.reload();
    } catch (e) {
        alert('제출 실패: ' + e.message);
        UI.showLoading(false);
    }
}

async function loadInitialData(forceLocal = false) {
    UI.showLoading(true);
    try {
        let budgetData;
        if (forceLocal || !CONFIG.getScriptUrl()) {
            budgetData = JSON.parse(localStorage.getItem('local_budget_data') || '[]');
        } else {
            budgetData = await API.getBudgetData();
        }

        window.appState.budgetItems = budgetData;

        if (forceLocal && budgetData.length > 0) {
            const history = JSON.parse(localStorage.getItem('local_history') || '[]');
            budgetData.forEach(b => b.used = 0);
            history.forEach(h => {
                if (h.items) {
                    h.items.forEach(item => {
                        const b = budgetData.find(bi => bi['산출내역'] === item.budgetName);
                        if (b) b.used = (b.used || 0) + item.total;
                    });
                }
            });
        }

        UI.renderBudgetPreview(budgetData);
        UI.updateBudgetDropdown(budgetData);
        UI.renderBudgetChart(window.appState.budgetItems);
    } catch (e) {
        console.error(e);
    } finally {
        UI.showLoading(false);
    }
}

async function generateAndPrintPDF(data) {
    if (!CONFIG.getScriptUrl()) {
        alert("PDF 생성기능은 Google Sheets 연동이 필수입니다. (서버에서 생성됨)");
        return;
    }

    UI.showLoading(true);
    try {
        const res = await API.generatePDF(data);
        if (!res.success) throw new Error(res.error || 'Unknown Error');

        // Download Base64
        const link = document.createElement('a');
        link.href = `data:application/pdf;base64,${res.base64}`;
        link.download = res.filename || 'download.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (e) {
        console.error(e);
        alert("PDF 생성 실패: " + e.message);
    } finally {
        UI.showLoading(false);
    }
}
