"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NLPQueryService = void 0;
const initFirebase_1 = require("./initFirebase");
const firestore_1 = require("firebase/firestore");
const formatUtils_1 = require("./formatUtils");
const ollamaService_1 = require("./ollamaService");
class NLPQueryService {
    constructor(companyId) {
        // Define identification document patterns
        this.ID_PATTERNS = {
            passport: ['passport', 'passport number', 'passport id'],
            pan: ['pan', 'pan number', 'pan card'],
            aadhaar: ['aadhaar', 'aadhar', 'aadhaar number', 'uid'],
            kyc: ['kyc', 'kyc status', 'verification status']
        };
        // Define data paths for different types of information
        this.DATA_PATHS = {
            company: {
                name: ['Personal_Details', 'Company_Name'],
                legal_name: ['Personal_Details', 'Legal_Name'],
                brand_name: ['Personal_Details', 'Brand_Name'],
                type: ['Personal_Details', 'Company_Type']
            },
            identification: {
                passport: ['Personal_KYC_ID', 'Passport_Number'],
                pan: ['Personal_KYC_ID', 'PAN_Number'],
                aadhaar: ['Registration_Tax_IDs', 'Aadhaar_Number'],
                kyc: ['KYC_Compliance', 'KYC_Status']
            },
            personal: {
                name: ['Individual_Details', 'Full_Name'],
                email: ['Individual_Details', 'Email_Address'],
                phone: ['Individual_Details', 'Contact_Number'],
                address: ['Authorized_Signatory', 'Residential_Address']
            },
            banking: {
                accounts: ['Bank_Accounts'],
                loans: ['Loans'],
                transactions: ['transactions']
            },
            account: {
                joint_holders: ['Bank_Accounts', 'Joint_Holder_Names'],
                balance: ['Bank_Accounts', 'Current_Balance'],
                type: ['Bank_Accounts', 'Account_Type'],
                status: ['Bank_Accounts', 'Account_Status'],
                branch: ['Bank_Accounts', 'Branch_Name']
            }
        };
        this.companyId = companyId;
        console.log('Initializing NLPQueryService with companyId:', companyId);
    }
    async fetchCompanyData() {
        console.log('Fetching company data from path:', `companies/${this.companyId}`);
        try {
            if (!initFirebase_1.db) {
                throw new Error('Firebase database not initialized');
            }
            const companyRef = (0, firestore_1.doc)(initFirebase_1.db, 'companies', this.companyId);
            const companyDoc = await (0, firestore_1.getDoc)(companyRef);
            if (!companyDoc.exists()) {
                console.error('Company document not found:', this.companyId);
                throw new Error('Company data not found');
            }
            this.companyData = companyDoc.data();
            // Add debug logging
            console.log('Successfully fetched company data:', {
                id: this.companyId,
                dataKeys: Object.keys(this.companyData),
                hasTransactions: !!this.companyData.transactions,
                hasBankAccounts: !!this.companyData.Bank_Accounts,
                hasKYC: !!this.companyData.KYC_Compliance,
                dataPreview: JSON.stringify(this.companyData).substring(0, 200)
            });
        }
        catch (error) {
            console.error('Error fetching company data:', error);
            throw error;
        }
    }
    async processTransactionQuery(timeframe = 'all', category) {
        console.log('Processing transaction query:', {
            timeframe,
            category,
            hasTransactions: !!this.companyData?.transactions,
            transactionCount: this.companyData?.transactions?.length || 0
        });
        const transactions = (this.companyData.transactions || []);
        if (transactions.length === 0) {
            return {
                hasData: false,
                context: 'No transactions found.',
                data: null
            };
        }
        // Get current date for relative time calculations
        const now = new Date();
        let startDate = null;
        let endDate = now;
        let timeframeDescription = '';
        // Determine time range
        switch (timeframe.toLowerCase()) {
            case '1 year':
                startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
                timeframeDescription = 'the last year';
                break;
            case '3 months':
            case 'three months':
            case 'last 3 months':
            case 'last three months':
                startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
                timeframeDescription = 'the last three months';
                break;
            case 'last month':
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                endDate = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of previous month
                timeframeDescription = 'last month';
                break;
            case 'this month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                timeframeDescription = 'this month';
                break;
            case 'last week':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                timeframeDescription = 'the last 7 days';
                break;
            case 'today':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                timeframeDescription = 'today';
                break;
            default:
                // Default to last 30 days if no specific timeframe
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                timeframeDescription = 'the last 30 days';
        }
        // Filter transactions by date and category
        let filteredTransactions = transactions.filter((t) => {
            const transactionDate = new Date(t.date);
            // Ensure the transaction date is not in the future
            if (transactionDate > now) {
                return false;
            }
            const dateMatches = startDate ? (transactionDate >= startDate && transactionDate <= endDate) : true;
            const categoryMatches = category ?
                t.category.toLowerCase().includes(category.toLowerCase()) : true;
            return dateMatches && categoryMatches;
        });
        // Sort transactions by date (most recent first)
        filteredTransactions = filteredTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        // Calculate total amount
        const total = filteredTransactions.reduce((sum, t) => sum + t.amount, 0);
        // Group transactions by category
        const categories = filteredTransactions.reduce((acc, t) => {
            const cat = t.category;
            if (!acc[cat])
                acc[cat] = 0;
            acc[cat] += t.amount;
            return acc;
        }, {});
        const result = {
            transactions: filteredTransactions,
            total,
            categories,
            timeframe: timeframeDescription,
            startDate: startDate?.toISOString() || '',
            endDate: endDate.toISOString(),
            count: filteredTransactions.length
        };
        const metadata = {
            type: 'transaction',
            subType: category || 'all',
            timeframe: timeframeDescription
        };
        return {
            hasData: filteredTransactions.length > 0,
            context: 'transaction details',
            data: result,
            metadata
        };
    }
    maskAccountNumber(accountNumber) {
        if (!accountNumber)
            return 'XXXXX';
        const length = accountNumber.length;
        const visibleDigits = 4;
        return 'X'.repeat(length - visibleDigits) + accountNumber.slice(-visibleDigits);
    }
    async identifyQueryType(query) {
        const lowerQuery = query.toLowerCase().trim();
        console.log('\n========== Query Type Identification ==========');
        console.log('Original query:', query);
        console.log('Processed query:', lowerQuery);
        // First try using Ollama/Mistral for intent classification
        try {
            console.log('\n----- Attempting Mistral Analysis -----');
            const ollamaService = new ollamaService_1.OllamaService();
            const intentAnalysis = await ollamaService.analyzeIntent(lowerQuery);
            if (intentAnalysis && intentAnalysis.type) {
                console.log('\nMistral Analysis Results:');
                console.log('- Main Type:', intentAnalysis.type);
                console.log('- Sub Type:', intentAnalysis.subType || 'not specified');
                console.log('- Timeframe:', intentAnalysis.timeframe || 'not specified');
                console.log('- Account Type:', intentAnalysis.accountType || 'not specified');
                console.log('- Entity:', intentAnalysis.entity || 'not specified');
                console.log('\nFull Analysis:', JSON.stringify(intentAnalysis, null, 2));
                const result = {
                    type: intentAnalysis.type,
                    subType: intentAnalysis.subType,
                    timeframe: intentAnalysis.timeframe,
                    category: intentAnalysis.accountType // Using accountType as category since it's relevant for banking queries
                };
                console.log('\nReturning result:', JSON.stringify(result, null, 2));
                return result;
            }
        }
        catch (error) {
            console.log('\n----- Mistral Analysis Failed -----');
            console.log('Error:', error);
            console.log('Falling back to keyword matching');
        }
        console.log('\n----- Starting Keyword Matching -----');
        // Fallback to keyword-based analysis
        // Define comprehensive keyword patterns for different query types
        const patterns = {
            transaction: ['transaction', 'spent', 'payment', 'transfer', 'expense', 'recent', 'spending', 'paid', 'received'],
            account: ['account', 'balance', 'joint', 'jo', 'joint holder', 'nominee', 'branch', 'ifsc', 'bank details', 'account type', 'statement', 'primary holder', 'account holder'],
            kyc: ['kyc', 'know your customer', 'document', 'verification', 'identity', 'pan', 'aadhaar', 'passport'],
            credit: ['credit card', 'credit limit', 'card details', 'credit balance', 'credit score', 'credit report'],
            loan: ['loan', 'emi', 'interest rate', 'tenure', 'outstanding', 'principal', 'disbursement', 'prepayment'],
            trade_finance: ['trade', 'letter of credit', 'lc', 'bank guarantee', 'bg', 'export', 'import', 'invoice financing'],
            working_capital: ['working capital', 'wc facility', 'limit', 'utilization', 'drawing power', 'collateral'],
            personal: ['personal details', 'contact', 'address', 'name', 'email', 'phone', 'designation', 'profile'],
            company: ['company details', 'business', 'incorporation', 'registration', 'gst', 'pan', 'industry'],
            digital_access: ['login', 'access', 'security', '2fa', 'two factor', 'ip whitelist', 'users'],
            support: ['ticket', 'issue', 'complaint', 'help', 'support', 'service request']
        };
        // Check for banking keywords with detailed subtypes
        console.log('\nChecking against keyword patterns:');
        for (const [type, keywords] of Object.entries(patterns)) {
            console.log(`\nChecking ${type} keywords:`, keywords);
            const matchedKeywords = keywords.filter(keyword => lowerQuery.includes(keyword));
            if (matchedKeywords.length > 0) {
                console.log(`✓ Found matches for type '${type}':`, matchedKeywords);
                switch (type) {
                    case 'account':
                        // Check for joint holder queries with more flexible matching
                        if (lowerQuery.match(/\b(jo|joint|joint.*holder|joint.*account)\b/))
                            return { type: 'account', subType: 'joint_holders' };
                        // Check for primary holder queries
                        if (lowerQuery.match(/\b(primary|primary.*holder|who.*holder)\b/))
                            return { type: 'account', subType: 'primary_holder' };
                        if (lowerQuery.includes('balance'))
                            return { type: 'account', subType: 'balance' };
                        if (lowerQuery.includes('nominee'))
                            return { type: 'account', subType: 'nominee' };
                        if (lowerQuery.includes('branch') || lowerQuery.includes('ifsc'))
                            return { type: 'account', subType: 'branch' };
                        if (lowerQuery.includes('type'))
                            return { type: 'account', subType: 'type' };
                        if (lowerQuery.includes('statement'))
                            return { type: 'account', subType: 'statement' };
                        break;
                    case 'kyc':
                        if (lowerQuery.includes('pan'))
                            return { type: 'kyc', subType: 'pan' };
                        if (lowerQuery.includes('aadhaar'))
                            return { type: 'kyc', subType: 'aadhaar' };
                        if (lowerQuery.includes('passport'))
                            return { type: 'kyc', subType: 'passport' };
                        if (lowerQuery.includes('status'))
                            return { type: 'kyc', subType: 'status' };
                        return { type: 'kyc', subType: 'details' };
                    case 'loan':
                        if (lowerQuery.includes('emi'))
                            return { type: 'loan', subType: 'emi_details' };
                        if (lowerQuery.includes('outstanding'))
                            return { type: 'loan', subType: 'outstanding' };
                        if (lowerQuery.includes('interest'))
                            return { type: 'loan', subType: 'interest' };
                        return { type: 'loan', subType: 'summary' };
                    case 'working_capital':
                        if (lowerQuery.includes('limit'))
                            return { type: 'working_capital', subType: 'limit' };
                        if (lowerQuery.includes('utilization'))
                            return { type: 'working_capital', subType: 'utilization' };
                        if (lowerQuery.includes('collateral'))
                            return { type: 'working_capital', subType: 'collateral' };
                        return { type: 'working_capital', subType: 'summary' };
                    case 'trade_finance':
                        if (lowerQuery.includes('letter of credit') || lowerQuery.includes('lc'))
                            return { type: 'trade_finance', subType: 'lc' };
                        if (lowerQuery.includes('bank guarantee') || lowerQuery.includes('bg'))
                            return { type: 'trade_finance', subType: 'bg' };
                        if (lowerQuery.includes('invoice'))
                            return { type: 'trade_finance', subType: 'invoice_financing' };
                        return { type: 'trade_finance', subType: 'summary' };
                    case 'personal':
                        if (lowerQuery.includes('contact'))
                            return { type: 'personal', subType: 'contact' };
                        if (lowerQuery.includes('address'))
                            return { type: 'personal', subType: 'address' };
                        if (lowerQuery.includes('email'))
                            return { type: 'personal', subType: 'email' };
                        if (lowerQuery.includes('phone'))
                            return { type: 'personal', subType: 'phone' };
                        return { type: 'personal', subType: 'summary' };
                    case 'company':
                        if (lowerQuery.includes('registration'))
                            return { type: 'company', subType: 'registration' };
                        if (lowerQuery.includes('gst'))
                            return { type: 'company', subType: 'gst' };
                        if (lowerQuery.includes('pan'))
                            return { type: 'company', subType: 'pan' };
                        return { type: 'company', subType: 'summary' };
                    case 'support':
                        if (lowerQuery.includes('open') || lowerQuery.includes('active'))
                            return { type: 'support', subType: 'open_tickets' };
                        if (lowerQuery.includes('resolved'))
                            return { type: 'support', subType: 'resolved_tickets' };
                        return { type: 'support', subType: 'all_tickets' };
                }
                return { type };
            }
        }
        console.log('No specific banking keywords found, checking transactions...');
        // Default to checking for transaction timeframes
        if (true) {
            const result = { type: 'transaction' };
            // Check for timeframe
            console.log('Checking timeframe patterns in:', lowerQuery);
            // First check for numeric timeframes (e.g., "last 2 weeks", "past 30 days")
            const numericTimeMatch = lowerQuery.match(/(?:last|past)\s+(\d+)\s+(day|days|week|weeks|month|months|year|years)/i);
            if (numericTimeMatch) {
                const [, amount, unit] = numericTimeMatch;
                const timeAmount = parseInt(amount, 10);
                console.log('Found numeric timeframe:', timeAmount, unit);
                if (unit.toLowerCase().startsWith('week')) {
                    result.timeframe = `${timeAmount} weeks`;
                }
                else if (unit.toLowerCase().startsWith('month')) {
                    result.timeframe = `${timeAmount} months`;
                }
                else if (unit.toLowerCase().startsWith('day')) {
                    result.timeframe = `${timeAmount} days`;
                }
                else if (unit.toLowerCase().startsWith('year')) {
                    result.timeframe = `${timeAmount} years`;
                }
                console.log('Timeframe identified:', result.timeframe);
            }
            // If no numeric match, check for standard timeframes
            else if (lowerQuery.includes('1 year') || lowerQuery.includes('one year') || lowerQuery.match(/last\s+year/)) {
                result.timeframe = '1 year';
                console.log('Timeframe identified: 1 year');
            }
            else if (lowerQuery.includes('3 month') || lowerQuery.includes('three month')) {
                result.timeframe = '3 months';
                console.log('Timeframe identified: 3 months');
            }
            else if (lowerQuery.includes('last month')) {
                result.timeframe = 'last month';
                console.log('Timeframe identified: last month');
            }
            else if (lowerQuery.includes('this month')) {
                result.timeframe = 'this month';
                console.log('Timeframe identified: this month');
            }
            else if (lowerQuery.includes('last week')) {
                result.timeframe = 'last week';
                console.log('Timeframe identified: last week');
            }
            else if (lowerQuery.includes('today')) {
                result.timeframe = 'today';
                console.log('Timeframe identified: today');
            }
            else if (lowerQuery.includes('recent')) {
                result.timeframe = 'last week';
                console.log('Timeframe identified: recent (defaulting to last week)');
            }
            else {
                console.log('No specific timeframe found, will use default');
            }
            // Check for categories
            console.log('Checking transaction categories...');
            const categories = ['food', 'travel', 'shopping', 'utilities', 'entertainment', 'groceries'];
            const foundCategory = categories.find(cat => lowerQuery.includes(cat));
            if (foundCategory) {
                result.category = foundCategory;
                console.log('Category identified:', foundCategory);
            }
            console.log('Final query type result:', result);
            return result;
        }
        // Check for KYC queries
        if (lowerQuery.includes('kyc') || lowerQuery.includes('know your customer') ||
            lowerQuery.includes('verification') || lowerQuery.includes('documents')) {
            return { type: 'individual', subType: 'kyc' };
        }
        // Check for name queries
        if (lowerQuery.includes('name') || lowerQuery.includes('who am i')) {
            return { type: 'individual', subType: 'name' };
        }
        // Check for address queries
        if (lowerQuery.includes('address') || lowerQuery.includes('where') ||
            lowerQuery.includes('location') || lowerQuery.includes('residence')) {
            return { type: 'individual', subType: 'address' };
        }
        // Default to general query
        return { type: 'general' };
    }
    extractDataByPath(paths) {
        try {
            let current = this.companyData;
            for (const path of paths) {
                if (!current || !current[path]) {
                    console.log('Path not found:', path, 'in current data:', current);
                    return null;
                }
                current = current[path];
            }
            return current;
        }
        catch (error) {
            console.error('Error extracting data by path:', error);
            return null;
        }
    }
    formatResponse(data, type, subType) {
        if (!data)
            return "I couldn't find the requested information.";
        switch (type) {
            case 'working_capital':
                const wcf = data.Working_Capital_Facility;
                if (!wcf)
                    return "Working capital facility information is not available.";
                let wcResponse = 'Working Capital Facility Details:\n';
                wcResponse += `- Sanctioned Limit: ₹${wcf.Sanctioned_Limit.toLocaleString('en-IN')}\n`;
                wcResponse += `- Utilized Limit: ₹${wcf.Utilized_Limit.toLocaleString('en-IN')}\n`;
                wcResponse += `- Available Limit: ₹${wcf.Available_Limit.toLocaleString('en-IN')}\n`;
                wcResponse += `- Drawing Power: ₹${wcf.Drawing_Power.toLocaleString('en-IN')}\n`;
                wcResponse += `- Facility Status: ${wcf.WC_Facility_Status}\n`;
                wcResponse += `- Interest Rate: ${wcf.Interest_Rate}%\n`;
                wcResponse += `- Last Review: ${wcf.Last_Review_Date}\n`;
                wcResponse += `- Next Review Due: ${wcf.Next_Review_Due}\n`;
                if (subType === 'collateral') {
                    wcResponse += '\nCollateral Details:\n';
                    wcResponse += `- Type: ${wcf.Collateral_Type}\n`;
                    wcResponse += `- Value: ₹${wcf.Collateral_Value.toLocaleString('en-IN')}\n`;
                    wcResponse += `- Security Margin: ${wcf.Security_Margin}%\n`;
                }
                return wcResponse;
            case 'loan':
                const loans = data.Loans || [];
                if (loans.length === 0)
                    return "No loan information available.";
                let loanResponse = '';
                loans.forEach((loan, index) => {
                    loanResponse += `Loan ${index + 1} Details:\n`;
                    loanResponse += `- Loan ID: ${loan.Loan_ID}\n`;
                    loanResponse += `- Type: ${loan.Loan_Type}\n`;
                    loanResponse += `- Status: ${loan.Loan_Status}\n`;
                    loanResponse += `- Sanctioned Amount: ₹${loan.Sanctioned_Amount.toLocaleString('en-IN')}\n`;
                    loanResponse += `- Outstanding Amount: ₹${loan.Total_Outstanding_Amount.toLocaleString('en-IN')}\n`;
                    loanResponse += `- Interest Rate: ${loan.Interest_Rate}%\n`;
                    if (subType === 'emi_details' && loan.EMI_Amount) {
                        loanResponse += `- EMI Amount: ₹${loan.EMI_Amount.toLocaleString('en-IN')}\n`;
                        loanResponse += `- Next Due Date: ${loan.Next_Due_Date}\n`;
                        loanResponse += `- Last EMI Paid: ${loan.Last_EMI_Paid_Date}\n`;
                    }
                    if (index < loans.length - 1)
                        loanResponse += '\n';
                });
                return loanResponse;
            case 'kyc':
                const kyc = data.KYC_Compliance;
                const personalKyc = data.Personal_KYC_ID;
                let kycResponse = 'KYC Information:\n';
                kycResponse += `- KYC Status: ${kyc.KYC_Status}\n`;
                kycResponse += `- Completion Date: ${kyc.Date_of_KYC_Completion}\n`;
                kycResponse += `- FATCA Status: ${kyc.FATCA_Status}\n`;
                kycResponse += `- CRS Declaration: ${kyc.CRS_Declaration}\n`;
                kycResponse += `- Risk Category: ${kyc.Risk_Category}\n`;
                if (personalKyc && personalKyc.KYC_Documents_Submitted) {
                    kycResponse += '\nSubmitted Documents:\n';
                    personalKyc.KYC_Documents_Submitted.forEach((doc) => {
                        kycResponse += `- ${doc}\n`;
                    });
                }
                return kycResponse;
            case 'trade_finance':
                const tf = data.Trade_Finance;
                let tfResponse = 'Trade Finance Details:\n';
                switch (subType) {
                    case 'lc':
                        const lcs = tf.Letters_of_Credit || [];
                        lcs.forEach((lc, index) => {
                            tfResponse += `\nLC ${index + 1}:\n`;
                            tfResponse += `- LC Number: ${lc.LC_Number}\n`;
                            tfResponse += `- Type: ${lc.LC_Type}\n`;
                            tfResponse += `- Status: ${lc.Status}\n`;
                            tfResponse += `- Limit: ₹${lc.Limit.toLocaleString('en-IN')}\n`;
                            tfResponse += `- Utilized: ₹${lc.Utilized_Amount.toLocaleString('en-IN')}\n`;
                            tfResponse += `- Available: ₹${lc.Available_Amount.toLocaleString('en-IN')}\n`;
                            tfResponse += `- Expiry: ${lc.Expiry_Date}\n`;
                        });
                        break;
                    case 'bg':
                        const bgs = tf.Bank_Guarantees || [];
                        bgs.forEach((bg, index) => {
                            tfResponse += `\nBG ${index + 1}:\n`;
                            tfResponse += `- BG Number: ${bg.BG_Number}\n`;
                            tfResponse += `- Type: ${bg.Type}\n`;
                            tfResponse += `- Status: ${bg.Status}\n`;
                            tfResponse += `- Limit: ₹${bg.Limit.toLocaleString('en-IN')}\n`;
                            tfResponse += `- Utilized: ₹${bg.Utilized_Amount.toLocaleString('en-IN')}\n`;
                            tfResponse += `- Available: ₹${bg.Available_Amount.toLocaleString('en-IN')}\n`;
                            tfResponse += `- Expiry: ${bg.Expiry_Date}\n`;
                        });
                        break;
                }
                return tfResponse;
            case 'account':
                const accounts = data.Bank_Accounts || [];
                if (accounts.length === 0)
                    return "No bank account information available.";
                let accountResponse = '';
                accounts.forEach((acc, index) => {
                    accountResponse += `Account ${index + 1}:\n`;
                    accountResponse += `- Account Number: ${this.maskAccountNumber(acc.Account_Number)}\n`;
                    accountResponse += `- Bank: ${acc.Bank_Name}\n`;
                    accountResponse += `- Type: ${acc.Account_Type}\n`;
                    if (subType === 'balance' || subType === 'summary') {
                        if (acc.Current_Balance !== undefined)
                            accountResponse += `- Current Balance: ₹${acc.Current_Balance.toLocaleString('en-IN')}\n`;
                        if (acc.Available_Balance !== undefined)
                            accountResponse += `- Available Balance: ₹${acc.Available_Balance.toLocaleString('en-IN')}\n`;
                    }
                    if (subType === 'branch' || subType === 'summary') {
                        accountResponse += `- Branch: ${acc.Branch_Name}\n`;
                        accountResponse += `- IFSC Code: ${acc.IFSC_Code}\n`;
                    }
                    if (acc.Joint_Holder_Names && acc.Joint_Holder_Names.length > 0) {
                        accountResponse += `- Joint Holders: ${acc.Joint_Holder_Names.join(', ')}\n`;
                    }
                    if (acc.Nominee_Info && subType === 'nominee') {
                        accountResponse += `- Nominee: ${acc.Nominee_Info.Name}\n`;
                        accountResponse += `- Relationship: ${acc.Nominee_Info.Relationship}\n`;
                    }
                    if (index < accounts.length - 1)
                        accountResponse += '\n';
                });
                return accountResponse;
            case 'company':
                const pd = data.Personal_Details;
                const reg = data.Registration_Tax_IDs;
                if (!pd && !reg)
                    return "Company information is not available.";
                let companyResponse = 'Company Information:\n';
                if (pd) {
                    companyResponse += `- Name: ${pd.Company_Name}\n`;
                    companyResponse += `- Legal Name: ${pd.Legal_Name}\n`;
                    companyResponse += `- Brand Name: ${pd.Brand_Name}\n`;
                    companyResponse += `- Type: ${pd.Company_Type}\n`;
                    companyResponse += `- Industry: ${pd.Industry_Sector}\n`;
                    companyResponse += `- Sub-sector: ${pd.Sub_sector}\n`;
                    companyResponse += `- Incorporation Date: ${pd.Date_of_Incorporation}\n`;
                    companyResponse += `- Operating Countries: ${pd.Country_of_Operation.join(', ')}\n`;
                }
                if (reg && subType === 'registration') {
                    companyResponse += '\nRegistration Details:\n';
                    companyResponse += `- Registration Number: ${reg.Registration_Number}\n`;
                    companyResponse += `- GST Number: ${reg.GST_Number}\n`;
                    companyResponse += `- PAN: ${reg.PAN_Number}\n`;
                    companyResponse += `- LEI: ${reg.Legal_Entity_Identifier}\n`;
                    companyResponse += `- TIN: ${reg.Tax_Identification_Number}\n`;
                }
                return companyResponse;
            case 'personal':
                const id = data.Individual_Details;
                const as = data.Authorized_Signatory;
                if (!id && !as)
                    return "Individual information is not available.";
                let response = 'Individual Details:\n';
                if (id) {
                    response += `- Name: ${id.Full_Name}\n`;
                    response += `- User ID: ${id.User_ID}\n`;
                    response += `- Email: ${id.Email_Address}\n`;
                    response += `- Phone: ${id.Phone_Number}\n`;
                    response += `- Preferred Language: ${id.Preferred_Language}\n`;
                }
                if (as) {
                    response += '\nAuthorization Details:\n';
                    response += `- Designation: ${as.Designation}\n`;
                    response += `- Authority Level: ${as.Signing_Authority_Limit}\n`;
                    response += `- Type of Signatory: ${as.Type_of_Signatory}\n`;
                    response += `- Authorized Since: ${as.Authorized_Since}\n`;
                    response += `- KYC Status: ${as.KYC_Status}\n`;
                    if (subType === 'address') {
                        response += `\nResidential Address:\n${as.Residential_Address}\n`;
                    }
                }
                return response;
            case 'support':
                const tickets = data.Support_Tickets || [];
                if (tickets.length === 0)
                    return "No support tickets found.";
                let ticketResponse = 'Support Tickets:\n\n';
                tickets.forEach((ticket, index) => {
                    if (subType === 'open_tickets' && ticket.Status !== 'Open')
                        return;
                    if (subType === 'resolved_tickets' && ticket.Status !== 'Resolved')
                        return;
                    ticketResponse += `Ticket ${index + 1}:\n`;
                    ticketResponse += `- ID: ${ticket.Ticket_ID}\n`;
                    ticketResponse += `- Issue: ${ticket.Issue}\n`;
                    ticketResponse += `- Status: ${ticket.Status}\n`;
                    ticketResponse += `- Priority: ${ticket.Priority}\n`;
                    ticketResponse += `- Raised On: ${ticket.Raised_On}\n`;
                    if (ticket.Resolved_On) {
                        ticketResponse += `- Resolved On: ${ticket.Resolved_On}\n`;
                        ticketResponse += `- Response Time: ${ticket.Response_Time_Minutes} minutes\n`;
                    }
                    if (index < tickets.length - 1)
                        ticketResponse += '\n';
                });
                return ticketResponse;
            default:
                return JSON.stringify(data, null, 2);
        }
    }
    formatIdentificationResponse(data, type) {
        if (!data) {
            return `I couldn't find the ${type} information in the records.`;
        }
        switch (type) {
            case 'passport':
                return `Your passport number is: ****${data.slice(-4)}`;
            case 'pan':
                return `Your PAN number is: ****${data.slice(-4)}`;
            case 'aadhaar':
                return `Your Aadhaar number is: ****${data.slice(-4)}`;
            case 'kyc':
                return `Your KYC status is: ${data}`;
            default:
                return `The requested information is: ${data}`;
        }
    }
    getTransactionsByTimeframe(transactions, timeframe, category) {
        console.log('Getting transactions for timeframe:', timeframe);
        const now = new Date();
        const startDate = new Date(now); // Create a new date to avoid modifying 'now'
        // Check for numeric timeframes first (e.g., "2 weeks", "30 days")
        const numericMatch = timeframe.toLowerCase().match(/(\d+)\s*(day|days|week|weeks|month|months|year|years)/i);
        if (numericMatch) {
            const amount = parseInt(numericMatch[1], 10);
            const unit = numericMatch[2].toLowerCase();
            console.log('Processing numeric timeframe:', amount, unit, 'from', startDate.toISOString());
            if (unit.startsWith('week')) {
                startDate.setDate(startDate.getDate() - (amount * 7));
            }
            else if (unit.startsWith('month')) {
                startDate.setMonth(startDate.getMonth() - amount);
            }
            else if (unit.startsWith('day')) {
                startDate.setDate(startDate.getDate() - amount);
            }
            else if (unit.startsWith('year')) {
                startDate.setFullYear(startDate.getFullYear() - amount);
            }
            console.log('Adjusted start date to:', startDate.toISOString());
        }
        else {
            // Handle standard timeframes
            switch (timeframe) {
                case 'last month':
                    startDate.setMonth(now.getMonth() - 1, 1);
                    now.setMonth(now.getMonth(), 0); // Last day of previous month
                    break;
                case 'this month':
                    startDate.setDate(1);
                    break;
                case 'last week':
                    startDate.setDate(now.getDate() - 7);
                    break;
                case 'this week':
                    startDate.setDate(now.getDate() - now.getDay());
                    break;
                case 'today':
                    startDate.setHours(0, 0, 0, 0);
                    break;
                case 'yesterday':
                    startDate.setDate(now.getDate() - 1);
                    startDate.setHours(0, 0, 0, 0);
                    now.setDate(now.getDate() - 1);
                    now.setHours(23, 59, 59, 999);
                    break;
                default:
                    console.log('Unknown timeframe, returning all transactions');
                    return transactions;
            }
        }
        let filtered = transactions.filter(t => {
            const txDate = new Date(t.date);
            return txDate >= startDate && txDate <= now;
        });
        // Apply category filter if specified
        if (category) {
            filtered = filtered.filter(t => t.category.toLowerCase().includes(category.toLowerCase()) ||
                t.remarks?.toLowerCase().includes(category.toLowerCase()));
        }
        return filtered;
    }
    async formatTransactionResponse(transactions, timeframe, category, query) {
        if (!transactions || transactions.length === 0) {
            return `No ${category ? category + ' ' : ''}transactions found for ${timeframe}.`;
        }
        // Calculate total amount and categorize transactions
        const total = transactions.reduce((sum, t) => sum + t.amount, 0);
        const categories = {};
        transactions.forEach(t => {
            categories[t.category] = (categories[t.category] || 0) + t.amount;
        });
        // Format the response
        let response = `For ${timeframe}, I found ${transactions.length} ${category ? category + ' ' : ''}transactions totaling ${(0, formatUtils_1.formatCurrency)(total)}.\n\n`;
        if (category) {
            response += `Details of ${category} transactions:\n`;
            transactions
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .forEach(t => {
                response += `- ${(0, formatUtils_1.formatDate)(t.date)}: ${(0, formatUtils_1.formatCurrency)(t.amount)} at ${t.merchant}\n`;
                if (t.remarks) {
                    response += `  ${t.remarks}\n`;
                }
            });
        }
        else {
            response += 'Breakdown by category:\n';
            Object.entries(categories)
                .sort(([, a], [, b]) => b - a)
                .forEach(([category, amount]) => {
                const categoryTransactions = transactions.filter(t => t.category === category);
                const latestTransaction = categoryTransactions.reduce((latest, current) => new Date(current.date) > new Date(latest.date) ? current : latest);
                response += `${category}: ${(0, formatUtils_1.formatCurrency)(amount)}\n`;
                response += `  Latest: ${(0, formatUtils_1.formatDate)(latestTransaction.date)} - ${latestTransaction.merchant}\n`;
            });
        }
        return response;
    }
    async processAccountQuery(subType) {
        console.log('Processing account query:', {
            subType,
            hasAccounts: !!this.companyData?.Bank_Accounts,
            accountCount: this.companyData?.Bank_Accounts?.length || 0
        });
        const accounts = this.companyData.Bank_Accounts || [];
        if (accounts.length === 0) {
            return {
                hasData: false,
                context: 'No bank accounts found.',
                data: null
            };
        }
        let response = '';
        let data = null;
        switch (subType) {
            case 'primary_holder':
                data = accounts.map((acc) => ({
                    account: this.maskAccountNumber(acc.Account_Number),
                    bank: acc.Bank_Name,
                    type: acc.Account_Type,
                    primary_holder: acc.Primary_Holder_Name || '',
                    operation_mode: acc.Operation_Mode || 'Not Specified'
                }));
                if (data.length === 0) {
                    response = 'No bank accounts found.';
                }
                else {
                    response = 'Primary Account Holder Details:\n\n' +
                        data.map((acc) => {
                            let accountInfo = `${acc.bank} ${acc.type} Account ${acc.account}:\n`;
                            accountInfo += `Primary Holder: ${acc.primary_holder || 'Not specified'}\n`;
                            accountInfo += `Operation Mode: ${acc.operation_mode}`;
                            return accountInfo;
                        }).join('\n\n');
                }
                return {
                    hasData: true,
                    context: response,
                    data: data
                };
            case 'joint_holders':
                data = accounts.map((acc) => ({
                    account: this.maskAccountNumber(acc.Account_Number),
                    bank: acc.Bank_Name,
                    type: acc.Account_Type,
                    joint_holders: acc.Joint_Holder_Names || [],
                    primary_holder: acc.Primary_Holder_Name || '',
                    operation_mode: acc.Operation_Mode || 'Not Specified'
                }));
                console.log('Joint holder data:', {
                    accountCount: data.length,
                    hasJointHolders: data.some((acc) => Array.isArray(acc.joint_holders) && acc.joint_holders.length > 0)
                });
                if (data.length === 0) {
                    response = 'No bank accounts found.';
                }
                else {
                    response = 'Your Bank Account Details:\n\n' +
                        data.map((acc) => {
                            let accountInfo = `${acc.bank} ${acc.type} Account ${acc.account}:\n`;
                            if (acc.primary_holder) {
                                accountInfo += `Primary Holder: ${acc.primary_holder}\n`;
                            }
                            if (acc.joint_holders && acc.joint_holders.length > 0) {
                                accountInfo += `Joint Holders: ${acc.joint_holders.join(', ')}\n`;
                                accountInfo += `Operation Mode: ${acc.operation_mode}\n`;
                            }
                            else {
                                accountInfo += 'This is not a joint account';
                            }
                            return accountInfo;
                        }).join('\n\n');
                }
                return {
                    hasData: true,
                    context: response,
                    data: data
                };
            case 'balance':
                data = accounts.map((acc) => ({
                    account: acc.Account_Number,
                    bank: acc.Bank_Name,
                    balance: acc.Current_Balance,
                    available: acc.Available_Balance,
                    type: acc.Account_Type,
                    currency: acc.Currency
                }));
                response = data.map((acc) => `${acc.bank} ${acc.type} Account ${acc.account}:\n` +
                    `- Current balance: ${(0, formatUtils_1.formatCurrency)(acc.balance)}\n` +
                    `- Available balance: ${(0, formatUtils_1.formatCurrency)(acc.available)}\n` +
                    `- Currency: ${acc.currency}`).join('\n\n');
                break;
            case 'type':
                data = accounts.map((acc) => ({
                    account: acc.Account_Number,
                    bank: acc.Bank_Name,
                    type: acc.Account_Type,
                    features: acc.Associated_Products || []
                }));
                response = data.map((acc) => `${acc.bank} Account ${acc.account} is a ${acc.type} account\n` +
                    (acc.features.length > 0 ? `Features: ${acc.features.join(', ')}` : '')).join('\n\n');
                break;
            case 'status':
                data = accounts.map((acc) => ({
                    account: acc.Account_Number,
                    bank: acc.Bank_Name,
                    status: acc.Account_Status,
                    lastTransaction: acc.Last_Transaction_Date
                }));
                response = data.map((acc) => `${acc.bank} Account ${acc.account}:\n` +
                    `- Status: ${acc.status}\n` +
                    `- Last transaction: ${(0, formatUtils_1.formatDate)(acc.lastTransaction)}`).join('\n\n');
                break;
            case 'branch':
                data = accounts.map((acc) => ({
                    account: acc.Account_Number,
                    bank: acc.Bank_Name,
                    branch: acc.Branch_Name,
                    ifsc: acc.IFSC_Code
                }));
                response = data.map((acc) => `${acc.bank} Account ${acc.account}:\n` +
                    `- Branch: ${acc.branch}\n` +
                    `- IFSC Code: ${acc.ifsc}`).join('\n\n');
                break;
            default:
                return {
                    hasData: false,
                    context: "I couldn't find specific account information. Please try asking in a different way.",
                    data: null
                };
        }
        return {
            hasData: true,
            context: response,
            data: data
        };
    }
    async processCompanyQuery(subType) {
        console.log('Processing company query:', {
            subType,
            availableFields: Object.keys(this.companyData || {}),
            companyName: this.companyData?.Company_Name || this.companyData?.name
        });
        let companyInfo;
        switch (subType) {
            case 'name':
                // Try different possible fields for company name
                companyInfo = this.companyData.Company_Name ||
                    this.companyData.name ||
                    this.companyData.Legal_Name ||
                    this.companyData.Brand_Name;
                if (companyInfo) {
                    console.log('Found company name:', companyInfo);
                    return {
                        hasData: true,
                        context: `Your company name is: ${companyInfo}`,
                        data: { name: companyInfo }
                    };
                }
                break;
            case 'legal_name':
                companyInfo = this.companyData.Legal_Name || this.companyData.Company_Name;
                if (companyInfo) {
                    return {
                        hasData: true,
                        context: `Your company's legal name is: ${companyInfo}`,
                        data: { legal_name: companyInfo }
                    };
                }
                break;
            case 'brand_name':
                companyInfo = this.companyData.Brand_Name || this.companyData.name;
                if (companyInfo) {
                    return {
                        hasData: true,
                        context: `Your company's brand name is: ${companyInfo}`,
                        data: { brand_name: companyInfo }
                    };
                }
                break;
            case 'type':
                companyInfo = this.companyData.Company_Type;
                if (companyInfo) {
                    return {
                        hasData: true,
                        context: `Your company type is: ${companyInfo}`,
                        data: { type: companyInfo }
                    };
                }
                break;
        }
        // If we couldn't find the specific information
        console.log('Company information not found:', {
            subType,
            availableFields: Object.keys(this.companyData || {}),
            dataPreview: JSON.stringify(this.companyData).substring(0, 100) + '...'
        });
        return {
            hasData: false,
            context: `I couldn't find the requested company information. Please check if the information is available in your company profile.`,
            data: null
        };
    }
    validateCompanyData() {
        if (!this.companyData) {
            console.error('No company data available');
            return false;
        }
        // Log available fields
        console.log('Available company data fields:', {
            fields: Object.keys(this.companyData),
            hasIndividualDetails: !!this.companyData.Individual_Details,
            individualDetailsKeys: this.companyData.Individual_Details ? Object.keys(this.companyData.Individual_Details) : [],
            hasPersonalDetails: !!this.companyData.Personal_Details,
            dataPreview: JSON.stringify(this.companyData).substring(0, 200)
        });
        return true;
    }
    calculateTransactionTotals(transactions) {
        return transactions.reduce((acc, transaction) => {
            const category = transaction.category || 'uncategorized';
            acc[category] = (acc[category] || 0) + transaction.amount;
            return acc;
        }, {});
    }
    async processQuery(query) {
        try {
            console.log('Processing query:', query);
            // Fetch company data if not already fetched
            if (!this.companyData) {
                await this.fetchCompanyData();
            }
            // Validate company data
            if (!this.validateCompanyData()) {
                console.error('Invalid or missing company data');
                return { hasData: false, context: 'Company data is not available', data: null };
            }
            // Identify query type and extract relevant information
            const queryInfo = await this.identifyQueryType(query.toLowerCase());
            const { type = 'unknown', subType = '', timeframe = '', category = '' } = queryInfo;
            console.log('Query analysis:', { type, subType, timeframe, category });
            let result;
            // Process based on query type
            switch (type) {
                case 'individual':
                    if (subType === 'kyc') {
                        console.log('Processing KYC query, available data:', {
                            kycCompliance: this.companyData.KYC_Compliance,
                            personalKYC: this.companyData.Personal_KYC_ID,
                            kycStatus: this.companyData.KYC_Compliance?.KYC_Status,
                            kycDocs: this.companyData.Personal_KYC_ID?.KYC_Documents_Submitted
                        });
                        const kycStatus = this.companyData.KYC_Compliance?.KYC_Status;
                        const kycDocs = this.companyData.Personal_KYC_ID?.KYC_Documents_Submitted || [];
                        const fatcaStatus = this.companyData.KYC_Compliance?.FATCA_Status;
                        const crsDeclaration = this.companyData.KYC_Compliance?.CRS_Declaration;
                        result = {
                            hasData: !!kycStatus,
                            context: 'KYC status information',
                            data: {
                                status: kycStatus,
                                documents: kycDocs,
                                fatca: fatcaStatus,
                                crs: crsDeclaration
                            },
                            metadata: {
                                type: 'personal',
                                subType: 'kyc',
                                fieldName: 'KYC_Status'
                            }
                        };
                        console.log('KYC query result:', result);
                        break;
                    }
                    switch (subType) {
                        case 'name':
                            const fullName = this.companyData.Individual_Details?.Full_Name;
                            result = {
                                hasData: !!fullName,
                                context: 'individual name',
                                data: fullName,
                                metadata: { type: 'personal', subType: 'name' }
                            };
                            break;
                        case 'contact':
                            const contactInfo = {
                                email: this.companyData.Individual_Details?.Email_Address,
                                phone: this.companyData.Individual_Details?.Contact_Number,
                                address: this.companyData.Authorized_Signatory?.Residential_Address
                            };
                            result = {
                                hasData: !!(contactInfo.email || contactInfo.phone || contactInfo.address),
                                context: 'contact information',
                                data: contactInfo,
                                metadata: { type: 'personal', subType: 'contact' }
                            };
                            break;
                        default:
                            const individualDetails = {
                                ...this.companyData.Individual_Details,
                                address: this.companyData.Authorized_Signatory?.Residential_Address
                            };
                            result = {
                                hasData: !!individualDetails,
                                context: 'individual details',
                                data: individualDetails,
                                metadata: { type: 'personal', subType: 'details' }
                            };
                    }
                    break;
                case 'address':
                    const address = this.extractDataByPath(['Authorized_Signatory', 'Residential_Address']);
                    console.log('Found address:', address);
                    result = {
                        hasData: !!address,
                        context: 'residential address',
                        data: address,
                        metadata: { type: 'personal', subType: 'address', fieldName: 'Residential_Address' }
                    };
                    break;
                case 'company':
                    result = await this.processCompanyQuery(subType);
                    break;
                case 'account':
                    result = await this.processAccountQuery(subType);
                    break;
                case 'transaction':
                    result = await this.processTransactionQuery(timeframe, category);
                    break;
                default:
                    console.log('Unhandled query type:', type);
                    result = { hasData: false, context: 'Unknown query type', data: null };
            }
            console.log('Query result:', result);
            return result;
        }
        catch (error) {
            console.error('Error processing query:', error);
            return { hasData: false, context: 'Error processing query', data: null };
        }
    }
    setCompanyData(data) {
        console.log('Setting company data:', {
            fullData: data,
            hasIndividualDetails: !!data.Individual_Details,
            individualDetails: data.Individual_Details,
            hasPersonalDetails: !!data.Personal_Details,
            personalDetails: data.Personal_Details,
            dataKeys: Object.keys(data)
        });
        this.companyData = data;
    }
    formatAccountResponse(accounts) {
        return accounts.map((acc) => {
            return `Account ${acc.Account_Number}:
- Bank: ${acc.Bank_Name}
- Type: ${acc.Account_Type}
- Balance: ${acc.Current_Balance}
- Status: ${acc.Account_Status}`;
        }).join('\n\n');
    }
}
exports.NLPQueryService = NLPQueryService;
