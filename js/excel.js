
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
        // ... (Existing implementation if needed, but we are making a new specific one)
        // Leaving it as is or replacing? The user asked for "Generate XLSX button".
        // The existing generateRequestFile seems unused or for a different purpose? 
        // Ah, checked the file before, it seemed to be a 'sample' implementation.
        // I will just ADD the new function at the end or replace it if I'm sure.
        // The user request is "Created a button... save as xlsx". 
        // I will add the new function `generateRequestExcel`.
    },

    generateRequestExcel(formData) {
        if (typeof XLSX === 'undefined') {
            alert('Excel 라이브러리가 로드되지 않았습니다.');
            return;
        }

        const wb = XLSX.utils.book_new();

        // 1. Headers
        const headers = ['순번', '물품명', '규격', '수량', '단가', '총액'];

        // 2. Data
        const wsData = [headers];
        formData.items.forEach((item, index) => {
            wsData.push([
                index + 1,
                item.name,
                item.spec,
                item.qty,
                item.price,
                item.total // Using total as requested contextually
            ]);
        });

        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // 3. Column Widths
        ws['!cols'] = [
            { wch: 8 },  // 순번
            { wch: 30 }, // 물품명 (Broad)
            { wch: 15 }, // 규격
            { wch: 8 },  // 수량
            { wch: 12 }, // 단가
            { wch: 15 }  // 총액
        ];

        // 4. Header Styling (Gray Background)
        // Range: A1:F1 (0,0 to 0,5)
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const address = XLSX.utils.encode_cell({ r: 0, c: C });
            if (!ws[address]) continue;

            if (!ws[address].s) ws[address].s = {};

            // Apply Style
            ws[address].s = {
                fill: { fgColor: { rgb: "EEEEEE" } },
                font: { bold: true, sz: 12 },
                alignment: { horizontal: "center", vertical: "center" },
                border: {
                    top: { style: "thin", color: { auto: 1 } },
                    bottom: { style: "thin", color: { auto: 1 } },
                    left: { style: "thin", color: { auto: 1 } },
                    right: { style: "thin", color: { auto: 1 } }
                }
            };
        }

        // Apply basic borders to data cells too for better look
        for (let R = 1; R <= range.e.r; ++R) {
            for (let C = 0; C <= range.e.c; ++C) {
                const address = XLSX.utils.encode_cell({ r: R, c: C });
                if (!ws[address]) ws[address] = { t: 's', v: '' }; // Ensure cell exists

                if (!ws[address].s) ws[address].s = {};
                ws[address].s.border = {
                    top: { style: "thin", color: { auto: 1 } },
                    bottom: { style: "thin", color: { auto: 1 } },
                    left: { style: "thin", color: { auto: 1 } },
                    right: { style: "thin", color: { auto: 1 } }
                };
            }
        }

        XLSX.utils.book_append_sheet(wb, ws, "품의내역");

        // File Name
        const fileName = (formData.docName || '품의서') + '.xlsx';
        XLSX.writeFile(wb, fileName);
    }
};
