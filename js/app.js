
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

function generateAndPrintPDF(data) {
    // Determine Font (Gothic style)
    const fontStyle = "font-family: 'Malgun Gothic', 'Dotum', 'AppleGothic', 'sans-serif';";

    // Create the HTML structure for the PDF
    const printable = document.createElement('div');
    printable.id = 'pdf-invoice';
    printable.style.cssText = `
        padding: 40px; 
        ${fontStyle} 
        width: 210mm; 
        min-height: 297mm; 
        background: white; 
        color: #000;
        position: absolute; 
        left: -9999px; 
        top: 0;
    `;

    // Header
    let html = `
        <h1 style="text-align:center; font-size:24px; font-weight:bold; margin-bottom:30px; border-bottom:3px solid #000; padding-bottom:15px;">지출 품의서</h1>
        
        <div style="margin-bottom:20px; font-size:14px;">
            <p style="margin:5px 0;"><strong>문서 제목:</strong> ${data.docName}</p>
            <p style="margin:5px 0;"><strong>작성일:</strong> ${new Date(data.date).toLocaleDateString()}</p>
        </div>

        <h2 style="font-size:16px; font-weight:bold; margin-bottom:10px; border-left:4px solid #333; padding-left:10px;">구입 목록 및 항목별 지출 예산 산출내역</h2>
        
        <table style="width:100%; border-collapse:collapse; font-size:11px; text-align:center;">
            <thead>
                <tr style="background:#f2f2f2; border-top:2px solid #000; border-bottom:1px solid #000;">
                    <th style="border:1px solid #ccc; padding:8px; width:40px;">순번</th>
                    <th style="border:1px solid #ccc; padding:8px;">세부항목</th>
                    <th style="border:1px solid #ccc; padding:8px;">원가통계비목</th>
                    <th style="border:1px solid #ccc; padding:8px;">산출내역</th>
                    <th style="border:1px solid #ccc; padding:8px;">물품명</th>
                    <th style="border:1px solid #ccc; padding:8px;">규격</th>
                    <th style="border:1px solid #ccc; padding:8px; width:40px;">수량</th>
                    <th style="border:1px solid #ccc; padding:8px;">단가</th>
                    <th style="border:1px solid #ccc; padding:8px;">배송비</th>
                    <th style="border:1px solid #ccc; padding:8px;">합계</th>
                    <th style="border:1px solid #ccc; padding:8px;">구입처</th>
                </tr>
            </thead>
            <tbody>
    `;

    data.items.forEach((item, idx) => {
        // Lookup full budget info
        // window.appState.budgetItems has [세부항목, 원가통계비목, 산출내역, ...]
        const budgetInfo = window.appState.budgetItems.find(b => b['산출내역'] === item.budgetName) || {};

        const detailItem = budgetInfo['세부항목'] || '-';
        const costItem = budgetInfo['원가통계비목'] || '-';

        html += `
            <tr>
                <td style="border:1px solid #ccc; padding:6px;">${idx + 1}</td>
                <td style="border:1px solid #ccc; padding:6px;">${detailItem}</td>
                <td style="border:1px solid #ccc; padding:6px;">${costItem}</td>
                <td style="border:1px solid #ccc; padding:6px;">${item.budgetName}</td>
                <td style="border:1px solid #ccc; padding:6px;">${item.name}</td>
                <td style="border:1px solid #ccc; padding:6px;">${item.spec}</td>
                <td style="border:1px solid #ccc; padding:6px;">${item.qty}</td>
                <td style="border:1px solid #ccc; padding:6px; text-align:right;">${item.price.toLocaleString()}</td>
                <td style="border:1px solid #ccc; padding:6px; text-align:right;">${item.shipping.toLocaleString()}</td>
                <td style="border:1px solid #ccc; padding:6px; text-align:right;">${item.total.toLocaleString()}</td>
                <td style="border:1px solid #ccc; padding:6px;">${item.vendor}</td>
            </tr>
        `;
    });

    html += `
            </tbody>
            <tfoot>
                <tr style="background:#f9f9f9; border-top:2px solid #000;">
                    <td colspan="9" style="border:1px solid #ccc; padding:10px; text-align:center; font-weight:bold; font-size:14px;">총 액</td>
                    <td colspan="2" style="border:1px solid #ccc; padding:10px; text-align:right; font-weight:bold; font-size:14px;">${data.totalAmount.toLocaleString()} 원</td>
                </tr>
            </tfoot>
        </table>
    `;

    printable.innerHTML = html;

    // Append to body to ensure rendering context
    document.body.appendChild(printable);

    var opt = {
        margin: 10,
        filename: `${data.docName}_품의서.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' } // Landscape might be better for many columns
    };

    html2pdf().from(printable).set(opt).save().then(() => {
        // Cleanup
        document.body.removeChild(printable);
    });
}
