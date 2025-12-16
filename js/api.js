
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
        const url = CONFIG.getScriptUrl();
        if (!url) {
            // Mock mode
            localStorage.setItem('local_budget_data', JSON.stringify(budgetItems));
            return { success: true };
        }

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
    },

    async getHistory() {
        const url = CONFIG.getScriptUrl();
        if (!url) {
            // Mock
            return JSON.parse(localStorage.getItem('local_history') || '[]');
        }

        const response = await fetch(`${url}?action=getHistory`);
        return await response.json();
    }
};
