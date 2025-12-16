
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
        ```
        UI.showLoading(false);
    }
}

function generateAndPrintPDF(data) {
    // Open a new window for printing
    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!printWindow) {
        alert('팝업 차단을 해제해주세요.');
        return;
    }

    // Determine Font (Gothic style)
    const fontStyle = "font-family: 'Malgun Gothic', 'Dotum', 'AppleGothic', 'sans-serif';";

    let htmlContent = `
            < !DOCTYPE html >
                <html>
                    <head>
                        <title>${data.docName}</title>
                        <style>
                            @media print {
                                @page {size: A4 landscape; margin: 10mm; }
                            body {-webkit - print - color - adjust: exact; }
                }
                            body {
                                ${fontStyle}
                            margin: 0;
                            padding: 20px;
                            color: #000;
                            background: #fff;
                }
                            .container {
                                width: 100%;
                            max-width: 297mm;
                            margin: 0 auto;
                }
                            h1 {
                                text - align: center;
                            font-size: 24pt;
                            font-weight: bold;
                            margin-bottom: 30px;
                            border-bottom: 3px solid #000;
                            padding-bottom: 15px;
                }
                            .meta {
                                margin - bottom: 20px;
                            font-size: 11pt;
                            display: flex;
                            justify-content: space-between;
                }
                            h2 {
                                font - size: 14pt;
                            font-weight: bold;
                            margin-bottom: 10px;
                            border-left: 5px solid #333;
                            padding-left: 10px;
                }
                            table {
                                width: 100%;
                            border-collapse: collapse;
                            font-size: 10pt;
                            text-align: center;
                }
                            th {
                                background - color: #f2f2f2 !important;
                            border-top: 2px solid #000;
                            border-bottom: 1px solid #000;
                            border-left: 1px solid #ccc;
                            border-right: 1px solid #ccc;
                            padding: 10px 5px;
                            font-weight: bold;
                }
                            td {
                                border: 1px solid #ccc;
                            padding: 8px 5px;
                }
                            .num-cell {text - align: right; padding-right: 10px; }
                            tfoot td {
                                background - color: #f9f9f9 !important;
                            border-top: 2px solid #000;
                            font-weight: bold;
                            font-size: 12pt;
                }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <h1>지출 품의서</h1>

                            <div class="meta">
                                <span><strong>문서 제목:</strong> ${data.docName}</span>
                                <span><strong>작성일:</strong> ${new Date(data.date).toLocaleDateString()}</span>
                            </div>

                            <h2>구입 목록 및 항목별 지출 예산 산출내역</h2>

                            <table>
                                <thead>
                                    <tr>
                                        <th style="width:5%;">순번</th>
                                        <th style="width:12%;">세부항목</th>
                                        <th style="width:12%;">원가통계비목</th>
                                        <th style="width:15%;">산출내역</th>
                                        <th style="width:15%;">물품명</th>
                                        <th style="width:10%;">규격</th>
                                        <th style="width:5%;">수량</th>
                                        <th style="width:8%;">단가</th>
                                        <th style="width:8%;">배송비</th>
                                        <th style="width:10%;">합계</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    `;

    data.items.forEach((item, idx) => {
        const budgetInfo = window.appState.budgetItems.find(b => b['산출내역'] === item.budgetName) || { };
                                    const detailItem = budgetInfo['세부항목'] || '-';
                                    const costItem = budgetInfo['원가통계비목'] || '-';

                                    htmlContent += `
                                    <tr>
                                        <td>${idx + 1}</td>
                                        <td>${detailItem}</td>
                                        <td>${costItem}</td>
                                        <td>${item.budgetName}</td>
                                        <td>${item.name}</td>
                                        <td>${item.spec}</td>
                                        <td>${item.qty}</td>
                                        <td class="num-cell">${item.price.toLocaleString()}</td>
                                        <td class="num-cell">${item.shipping.toLocaleString()}</td>
                                        <td class="num-cell">${item.total.toLocaleString()}</td>
                                    </tr>
                                    `;
    });

                                    htmlContent += `
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td colspan="9" style="text-align: center;">총 합계</td>
                                        <td class="num-cell">${data.totalAmount.toLocaleString()} 원</td>
                                    </tr>
                                </tfoot>
                            </table>

                            <div style="margin-top: 50px; text-align: right;">
                                <p>(인)</p>
                            </div>
                        </div>

                        <script>
                            window.onload = function() {window.print(); }
                        </script>
                    </body>
                </html>
        `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    // setTimeout to ensure rendering on some browsers
    setTimeout(() => {
        printWindow.print();
        // Option: printWindow.close(); // Don't auto-close so they can re-print if needed
    }, 500);
}
