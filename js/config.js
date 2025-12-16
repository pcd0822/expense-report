
// Config module
const CONFIG = {
    // This URL will be updated by the user in the Shared Mode or Settings
    // For now we can use a key in localStorage
    SCRIPT_URL_KEY: 'budget_app_script_url',

    getScriptUrl: () => localStorage.getItem('budget_app_script_url'),
    setScriptUrl: (url) => localStorage.setItem('budget_app_script_url', url),

    // Template Headers
    BUDGET_HEADERS: ['세부항목', '원가통계비목', '산출내역', '예산액'],
};
