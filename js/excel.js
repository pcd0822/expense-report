
const ExcelHandler = {
    downloadTemplate() {
        if (typeof XLSX === 'undefined') {
            alert('Excel 라이브러리가 로드되지 않았습니다. 인터넷 연결을 확인하거나 페이지를 새로고침해주세요.');
            return;
        }
        const headers = [['세부항목', '원가통계비목', '산출내역', '예산액']];
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(headers);

        // Add sample data for guidance
        XLSX.utils.sheet_add_aoa(ws, [['운영비', '사무용품비', '부서 4월 사무용품', 1000000]], { origin: -1 });

        XLSX.utils.book_append_sheet(wb, ws, "예산서식");
        XLSX.writeFile(wb, "예산표준서식.xlsx");
    },

    readBudgetFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet);

                // Validate headers
                if (jsonData.length === 0) {
                    reject(new Error("데이터가 없습니다."));
                    return;
                }

                resolve(jsonData);
            };
            reader.readAsArrayBuffer(file);
        });
    },

    generateRequestFile(data, budgetInfo) {
        const wb = XLSX.utils.book_new();

        // Format the data for the sheet
        const wsData = [
            [`지출 품의서 (${data.docName})`],
            [], // spacer
            ['예산 과목', '', '', '', ''],
            ['세부항목', budgetInfo ? budgetInfo['세부항목'] : '', '원가통계비목', budgetInfo ? budgetInfo['원가통계비목'] : ''],
            ['산출내역', budgetInfo ? budgetInfo['산출내역'] : '', '총 예산액', budgetInfo ? budgetInfo['예산액'] : ''],
            [], // spacer
            ['[지출 내역]'],
            ['순번', '물품명', '규격', '수량', '단가', '총액', '구입처']
        ];

        // Items
        data.items.forEach((item, index) => {
            wsData.push([
                index + 1,
                item.name,
                item.spec,
                item.qty,
                item.price,
                item.total,
                item.vendor
            ]);
        });

        // Shipping and Grand Total
        if (data.shipping > 0) {
            wsData.push(['', '배송비', '', '1', data.shipping, data.shipping, '']);
        }

        wsData.push([]);
        wsData.push(['', '', '', '', '총 합계', data.totalAmount, '']);

        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // Merges for Title
        if (!ws['!merges']) ws['!merges'] = [];
        ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }); // Title span

        XLSX.utils.book_append_sheet(wb, ws, "지출품의서");
        XLSX.writeFile(wb, `${data.docName}_품의서.xlsx`);
    }
};
