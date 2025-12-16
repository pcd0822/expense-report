
// API Module to interact with Google Apps Script
const API = {

    async testConnection() {
        const url = CONFIG.getScriptUrl();
        if (!url) throw new Error("API URL이 설정되지 않았습니다.");

        try {
            const response = await fetch(`${url}?action=test`);
            return await response.json();
        } catch (e) {
            console.error("Connection failed", e);
            throw e;
        }
    },

    async saveBudget(budgetItems) {
        // In a real scenario with GAS, we send a POST request
        const url = CONFIG.getScriptUrl();
        if (!url) {
            // Mock mode
            console.log("Mock Saving Budget:", budgetItems);
            localStorage.setItem('local_budget_data', JSON.stringify(budgetItems));
            return { success: true };
        }

        // Use content type text/plain for GAS simple triggers to work with CORS sometimes, 
        // but here we standard FormData approach which usually redirects. 
        // For no-cors simple requests, we can't read response. 
        // We will assume standard fetch for now, user might face CORS if not setup right.
        const formData = new FormData();
        formData.append('action', 'saveBudget');
        formData.append('data', JSON.stringify(budgetItems));

        const response = await fetch(url, {
            method: 'POST',
            body: formData
        });
        return await response.json();
    },

    async getBudgetData() {
        const url = CONFIG.getScriptUrl();
        if (!url) {
            const data = localStorage.getItem('local_budget_data');
            return data ? JSON.parse(data) : [];
        }

        const response = await fetch(`${url}?action=getBudget`);
        return await response.json();
    },

    async submitExpenditure(expenditureData) {
        const url = CONFIG.getScriptUrl();
        if (!url) {
            // Mock
            let history = JSON.parse(localStorage.getItem('local_history') || '[]');
            history.push(expenditureData);
            localStorage.setItem('local_history', JSON.stringify(history));

            return { success: true };
        }

        const formData = new FormData();
        formData.append('action', 'submitExpenditure');
        formData.append('data', JSON.stringify(expenditureData));

        const response = await fetch(url, {
            method: 'POST',
            body: formData
        });
        return await response.json();
    }
};
