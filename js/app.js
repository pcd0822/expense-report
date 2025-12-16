
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
        UI.renderBudgetChart(window.appState.budgetItems);
    } catch (e) {
        console.error(e);
    } finally {
        UI.showLoading(false);
    }
}

function generateAndPrintPDF(data) {
    // Create the HTML structure for the PDF
    const printable = document.createElement('div');
    printable.id = 'pdf-invoice';
    printable.style.padding = '30px';
    printable.style.fontFamily = "'Noto Sans KR', sans-serif";

    // Header
    let html = `
         <h1 style="text-align:center; border-bottom:2px solid #333; padding-bottom:10px;">지출 품의서</h1>
         <div style="display:flex; justify-content:space-between; margin-top:20px;">
             <p><strong>문서명:</strong> ${data.docName}</p>
             <p><strong>작성일:</strong> ${new Date(data.date).toLocaleDateString()}</p>
         </div>
         <table style="width:100%; border-collapse:collapse; margin-top:20px; font-size:12px;">
             <thead>
                 <tr style="background:#f0f0f0;">
                     <th style="border:1px solid #ccc; padding:8px;">순번</th>
                     <th style="border:1px solid #ccc; padding:8px;">예산항목</th>
                     <th style="border:1px solid #ccc; padding:8px;">물품명</th>
                     <th style="border:1px solid #ccc; padding:8px;">규격</th>
                     <th style="border:1px solid #ccc; padding:8px;">수량</th>
                     <th style="border:1px solid #ccc; padding:8px;">단가</th>
                     <th style="border:1px solid #ccc; padding:8px;">배송비</th>
                     <th style="border:1px solid #ccc; padding:8px;">합계</th>
                     <th style="border:1px solid #ccc; padding:8px;">구입처</th>
                 </tr>
             </thead>
             <tbody>
     `;

    data.items.forEach((item, idx) => {
        html += `
             <tr>
                 <td style="border:1px solid #ccc; padding:8px; text-align:center;">${idx + 1}</td>
                 <td style="border:1px solid #ccc; padding:8px;">${item.budgetName}</td>
                 <td style="border:1px solid #ccc; padding:8px;">${item.name}</td>
                 <td style="border:1px solid #ccc; padding:8px;">${item.spec}</td>
                 <td style="border:1px solid #ccc; padding:8px; text-align:center;">${item.qty}</td>
                 <td style="border:1px solid #ccc; padding:8px; text-align:right;">${item.price.toLocaleString()}</td>
                 <td style="border:1px solid #ccc; padding:8px; text-align:right;">${item.shipping.toLocaleString()}</td>
                 <td style="border:1px solid #ccc; padding:8px; text-align:right;">${item.total.toLocaleString()}</td>
                 <td style="border:1px solid #ccc; padding:8px;">${item.vendor}</td>
             </tr>
         `;
    });

    html += `
             </tbody>
             <tfoot>
                 <tr>
                     <td colspan="7" style="border:1px solid #ccc; padding:8px; text-align:right; font-weight:bold;">총 합계</td>
                     <td colspan="2" style="border:1px solid #ccc; padding:8px; text-align:right; font-weight:bold; font-size:14px; background:#f9f9f9;">${data.totalAmount.toLocaleString()}원</td>
                 </tr>
             </tfoot>
         </table>
     `;

    printable.innerHTML = html;

    var opt = {
        margin: 10,
        filename: `${data.docName}_품의서.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().from(printable).set(opt).save();
}
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

        window.appState.budgetItems = budgetData;

        // Restore used amounts from local history if not using API-side calc
        if (forceLocal && budgetData.length > 0) {
            const history = JSON.parse(localStorage.getItem('local_history') || '[]');
            // Re-calculate used
            budgetData.forEach(b => b.used = 0);
            history.forEach(h => {
                // Iterate items in history
                if (h.items) {
                    h.items.forEach(item => {
                        const b = budgetData.find(bi => bi['산출내역'] === item.budgetName);
                        if (b) b.used = (b.used || 0) + item.total;
                    });
                }
            });
        }

        UI.renderBudgetPreview(budgetData);
        // UI.updateBudgetDropdown(budgetData); // Handled dynamically in rows now
        UI.renderBudgetChart(window.appState.budgetItems);
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
        window.appState.budgetItems = data.map(item => ({ ...item, used: 0 }));
        UI.renderBudgetPreview(window.appState.budgetItems);
        document.getElementById('budgetPreview').classList.remove('hidden');
    } catch (err) {
        alert(err.message);
    }
}

document.getElementById('saveBudgetBtn').addEventListener('click', async () => {
    UI.showLoading(true);
    try {
        await API.saveBudget(window.appState.budgetItems);
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
    if (window.appState.budgetItems.length === 0) return;
    window.appState.currentBudgetIndex = (window.appState.currentBudgetIndex - 1 + window.appState.budgetItems.length) % window.appState.budgetItems.length;
    UI.renderBudgetChart(window.appState.budgetItems);
});

document.getElementById('nextChartBtn').addEventListener('click', () => {
    if (window.appState.budgetItems.length === 0) return;
    window.appState.currentBudgetIndex = (window.appState.currentBudgetIndex + 1) % window.appState.budgetItems.length;
    UI.renderBudgetChart(window.appState.budgetItems);
});

// Items Table Buttons
document.getElementById('addRowBtn').addEventListener('click', () => UI.addItemRow());
document.getElementById('deleteModeBtn').addEventListener('click', () => UI.toggleDeleteMode());


// Generate PDF
document.getElementById('generatePdfBtn').addEventListener('click', () => {
    const formData = UI.getExpenditureFormData();
    if (!formData) return;

    // We render the PDF via the browser's view using html2pdf
    // Just printing the current view "as is" is bad. We need a "Document Template".
    // We will generate a temporary hidden div with the official format, print that.

    generateAndPrintPDF(formData);
});

function generateAndPrintPDF(data) {
    // Create the HTML structure for the PDF
    const printable = document.createElement('div');
    printable.id = 'pdf-invoice';
    printable.style.padding = '30px';
    printable.style.fontFamily = "'Noto Sans KR', sans-serif";

    // Header
    let html = `
        <h1 style="text-align:center; border-bottom:2px solid #333; padding-bottom:10px;">지출 품의서</h1>
        <div style="display:flex; justify-content:space-between; margin-top:20px;">
            <p><strong>문서명:</strong> ${data.docName}</p>
            <p><strong>작성일:</strong> ${new Date(data.date).toLocaleDateString()}</p>
        </div>
        <table style="width:100%; border-collapse:collapse; margin-top:20px; font-size:12px;">
            <thead>
                <tr style="background:#f0f0f0;">
                    <th style="border:1px solid #ccc; padding:8px;">순번</th>
                    <th style="border:1px solid #ccc; padding:8px;">예산항목</th>
                    <th style="border:1px solid #ccc; padding:8px;">물품명</th>
                    <th style="border:1px solid #ccc; padding:8px;">규격</th>
                    <th style="border:1px solid #ccc; padding:8px;">수량</th>
                    <th style="border:1px solid #ccc; padding:8px;">단가</th>
                    <th style="border:1px solid #ccc; padding:8px;">배송비</th>
                    <th style="border:1px solid #ccc; padding:8px;">합계</th>
                    <th style="border:1px solid #ccc; padding:8px;">구입처</th>
                </tr>
            </thead>
            <tbody>
    `;

    data.items.forEach((item, idx) => {
        html += `
            <tr>
                <td style="border:1px solid #ccc; padding:8px; text-align:center;">${idx + 1}</td>
                <td style="border:1px solid #ccc; padding:8px;">${item.budgetName}</td>
                <td style="border:1px solid #ccc; padding:8px;">${item.name}</td>
                <td style="border:1px solid #ccc; padding:8px;">${item.spec}</td>
                <td style="border:1px solid #ccc; padding:8px; text-align:center;">${item.qty}</td>
                <td style="border:1px solid #ccc; padding:8px; text-align:right;">${item.price.toLocaleString()}</td>
                <td style="border:1px solid #ccc; padding:8px; text-align:right;">${item.shipping.toLocaleString()}</td>
                <td style="border:1px solid #ccc; padding:8px; text-align:right;">${item.total.toLocaleString()}</td>
                <td style="border:1px solid #ccc; padding:8px;">${item.vendor}</td>
            </tr>
        `;
    });

    html += `
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="7" style="border:1px solid #ccc; padding:8px; text-align:right; font-weight:bold;">총 합계</td>
                    <td colspan="2" style="border:1px solid #ccc; padding:8px; text-align:right; font-weight:bold; font-size:14px; background:#f9f9f9;">${data.totalAmount.toLocaleString()}원</td>
                </tr>
            </tfoot>
        </table>
    `;

    printable.innerHTML = html;

    // We can't append to body visible, but html2pdf handles elements.
    // Recommended options
    var opt = {
        margin: 10,
        filename: `${data.docName}_품의서.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().from(printable).set(opt).save();
}


// Submit
document.getElementById('submitRequestBtn').addEventListener('click', async () => {
    const formData = UI.getExpenditureFormData();
    if (!formData) return;

    if (!confirm('이대로 제출하시겠습니까? 예산에서 차감됩니다.')) return;

    UI.showLoading(true);
    try {
        await API.submitExpenditure(formData);

        // Update Local State for immediate feedback
        formData.items.forEach(item => {
            const budgetIndex = window.appState.budgetItems.findIndex(b => b['산출내역'] === item.budgetName);
            if (budgetIndex >= 0) {
                window.appState.budgetItems[budgetIndex].used = (window.appState.budgetItems[budgetIndex].used || 0) + item.total;
            }
        });

        UI.renderBudgetChart(window.appState.budgetItems);
        alert('제출 완료되었습니다.');

        // Just reload history directly without full reload, OR confirm user wants to reload
        // User complained "History doesn't appear". Reloading usually fixes it if data is saved.
        // We will switch to History tab to show it works
        window.location.reload();
    } catch (e) {
        alert('제출 실패: ' + e.message);
        UI.showLoading(false);
    }
});

// Copy Link Logic
const connectBtn = document.getElementById('connectSharedBtn');
const linkBtn = document.createElement('button');
linkBtn.className = 'btn secondary';
linkBtn.innerHTML = '<i class="fa-solid fa-link"></i> 공유 링크 복사';
linkBtn.style.marginLeft = '10px';
linkBtn.onclick = () => UI.copySharedLink();

// Append next to connect button
if (connectBtn) {
    connectBtn.parentNode.appendChild(linkBtn);

    connectBtn.addEventListener('click', () => {
        const url = document.getElementById('sharedApiUrl').value.trim();
        if (url) {
            CONFIG.setScriptUrl(url);
            alert('URL이 저장되었습니다. 페이지를 새로고침합니다.');
            location.reload();
        }
    });
}
