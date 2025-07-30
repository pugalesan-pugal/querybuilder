"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OllamaService = void 0;
class OllamaService {
    constructor() {
        this.lastRequestTime = 0;
        this.BASE_DELAY = 100;
        this.MAX_RETRIES = 3;
        this.MAX_BACKOFF_DELAY = 5000;
        this.API_TIMEOUT = 60000;
        this.DEFAULT_MODEL = 'mistral';
        this.DEFAULT_PORT = 11434;
        this.DEFAULT_ERROR_MESSAGE = "I apologize, but I'm currently experiencing technical difficulties. Please try again in a moment.";
        this.isInitialized = false;
        this.initializationPromise = null;
        this.initializationAttempts = 0;
        this.MAX_INIT_ATTEMPTS = 3;
        this.OLLAMA_API_URL = `http://127.0.0.1:${this.DEFAULT_PORT}`;
        console.log('Initializing Ollama service with URL:', this.OLLAMA_API_URL);
    }
    async initialize() {
        // If already initialized, return immediately
        if (this.isInitialized) {
            return;
        }
        // Check if we've exceeded max attempts
        if (this.initializationAttempts >= this.MAX_INIT_ATTEMPTS) {
            console.error('Exceeded maximum initialization attempts');
            throw new Error('Failed to initialize after maximum attempts');
        }
        // If initialization is in progress, wait for it
        if (this.initializationPromise) {
            return this.initializationPromise;
        }
        // Increment attempt counter
        this.initializationAttempts++;
        console.log(`Initialization attempt ${this.initializationAttempts}/${this.MAX_INIT_ATTEMPTS}`);
        // Start initialization
        this.initializationPromise = (async () => {
            try {
                console.log('Testing Ollama connection...');
                // First check if service is running
                const tagsResponse = await fetch(`${this.OLLAMA_API_URL}/api/tags`);
                if (!tagsResponse.ok) {
                    throw new Error(`HTTP error! status: ${tagsResponse.status}`);
                }
                // Check if model exists
                const tagsData = await tagsResponse.json();
                console.log('Available models:', tagsData);
                const modelExists = tagsData.models?.some((m) => m.name === this.DEFAULT_MODEL);
                if (!modelExists) {
                    console.log('Model not found, pulling...');
                    const pullResponse = await fetch(`${this.OLLAMA_API_URL}/api/pull`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            name: this.DEFAULT_MODEL
                        })
                    });
                    if (!pullResponse.ok) {
                        throw new Error(`Failed to pull model: ${pullResponse.status}`);
                    }
                    console.log('Model pulled successfully');
                }
                // Test model with a simple query
                const testResponse = await this.generateSimpleResponse('Hello');
                if (!testResponse) {
                    throw new Error('Model test failed');
                }
                console.log('Ollama service initialized successfully');
                this.isInitialized = true;
                this.initializationPromise = null;
                this.initializationAttempts = 0;
            }
            catch (error) {
                console.error('Failed to initialize Ollama service:', error);
                this.initializationPromise = null;
                throw error;
            }
        })();
        return this.initializationPromise;
    }
    async generateSimpleResponse(prompt) {
        try {
            const response = await fetch(`${this.OLLAMA_API_URL}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.DEFAULT_MODEL,
                    prompt,
                    stream: false
                })
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            return data.response;
        }
        catch (error) {
            console.error('Error generating simple response:', error);
            return null;
        }
    }
    async analyzeIntent(query) {
        try {
            await this.initialize();
            const prompt = `As a banking query analyzer, analyze the following query and categorize it based on user intent. Only respond with a JSON object following these rules:

1. type: one of [account, transaction, loan, kyc, general]
2. subType: specific operation or intent (e.g., balance, history, joint_holder, status)
3. accountType (optional): type of account if mentioned (e.g., savings, current)
4. timeframe (optional): any time period mentioned
5. entity (optional): specific entity being queried about (e.g., joint holder name)

Query: "${query}"

Only respond with the JSON object, no other text.`;
            const response = await this.generateSimpleResponse(prompt);
            if (!response) {
                throw new Error('Failed to analyze intent');
            }
            try {
                const parsedResponse = JSON.parse(response.trim());
                return {
                    type: parsedResponse.type || 'general',
                    subType: parsedResponse.subType,
                    accountType: parsedResponse.accountType,
                    timeframe: parsedResponse.timeframe,
                    entity: parsedResponse.entity
                };
            }
            catch (parseError) {
                console.error('Error parsing intent analysis response:', parseError);
                return {
                    type: 'general'
                };
            }
        }
        catch (error) {
            console.error('Error analyzing intent:', error);
            return {
                type: 'general'
            };
        }
    }
    async generateBankingResponse(context, query) {
        try {
            // Ensure service is initialized
            try {
                await this.initialize();
            }
            catch (error) {
                console.error('Failed to initialize service:', error);
                return "I apologize, but I'm having trouble connecting to the AI service. Please try again in a moment.";
            }
            // Parse context data if it's JSON, otherwise use it as is
            let contextData;
            try {
                // Check if the context is a JSON string
                if (context.trim().startsWith('{') || context.trim().startsWith('[')) {
                    contextData = JSON.parse(context);
                    console.log('Parsed context data:', {
                        hasNlpResponse: !!contextData.nlpResponse,
                        hasData: !!contextData.nlpResponse?.data,
                        metadata: contextData.nlpResponse?.metadata
                    });
                }
                else {
                    // If not JSON, use the context as is
                    contextData = { query, context };
                }
            }
            catch (e) {
                console.error('Error parsing context:', e);
                contextData = { query, context };
            }
            // Construct a focused prompt based on the data
            let prompt;
            if (contextData.nlpResponse?.data) {
                // If we have specific data, create a focused prompt
                const type = contextData.nlpResponse.metadata?.subType || 'information';
                const data = contextData.nlpResponse.data;
                console.log('Constructing prompt with data:', {
                    type,
                    dataPreview: JSON.stringify(data).substring(0, 100) + '...'
                });
                if (contextData.nlpResponse.metadata?.type === 'transaction') {
                    prompt = `You are a helpful banking assistant. The user asked about their transactions.

Here are the transaction details for ${data.timeframe}:
${data.transactions.map((t) => `- ${new Date(t.date).toLocaleDateString('en-IN')}: ₹${t.amount.toLocaleString('en-IN')} at ${t.merchant}`).join('\n')}

Total transactions: ${data.count}
Total amount: ₹${data.total.toLocaleString('en-IN')}

Categories:
${Object.entries(data.categories)
                        .map(([cat, amount]) => `- ${cat}: ₹${amount.toLocaleString('en-IN')}`)
                        .join('\n')}

Please provide a concise summary of these transactions focusing on:
1. The time period covered
2. Total spending and number of transactions
3. Top spending categories
4. Any notable large transactions

Keep the response professional and factual. Do not add unnecessary explanations or mention privacy/security concerns.`;
                }
                else {
                    prompt = `You are a helpful banking assistant. The user asked: "${query}"

The user's ${type} information is: ${JSON.stringify(data, null, 2)}

Please provide a natural, professional response based on this information. Do not mention privacy or security concerns - just provide the information directly.`;
                }
            }
            else {
                console.log('No specific data available, using general prompt');
                prompt = `You are a professional banking assistant. You are strictly limited to answering questions related to banking, finance, account information, and banking services.

Your Rules:

If the question is not related to banking, politely say:
"I'm here to assist only with banking-related queries. Please ask something related to your bank account, transactions, loans, or financial services."

Do not engage in small talk, casual conversation, or answer questions about topics like weather, general knowledge, or current events.

Keep answers concise, accurate, and professional.

If a customer asks for information you do not have access to, respond with:
"For specific details, please check your account or contact your nearest bank branch."

The user asked: "${query}"

Please provide a focused banking-related response. If the query is not related to banking, politely explain that you can only assist with banking matters.`;
            }
            console.log('Sending prompt to Ollama:', {
                promptLength: prompt.length,
                promptPreview: prompt.substring(0, 200) + '...'
            });
            const response = await this.generateSimpleResponse(prompt);
            if (!response) {
                throw new Error('Failed to generate response');
            }
            return response;
        }
        catch (error) {
            console.error('Error generating banking response:', error);
            return this.DEFAULT_ERROR_MESSAGE;
        }
    }
    async generateChatTitle(messages) {
        try {
            // Get the first user message as it usually contains the main topic
            const firstUserMessage = messages.find(m => m.isUser);
            if (!firstUserMessage) {
                return 'New Chat';
            }
            // Extract key topics from the message
            const topics = {
                transactions: ['transaction', 'spent', 'payment', 'expense', 'recent'],
                kyc: ['kyc', 'know your customer', 'verification', 'documents'],
                personal: ['name', 'address', 'contact', 'email', 'phone'],
                account: ['account', 'balance', 'bank'],
                loans: ['loan', 'credit', 'borrowing'],
                workingCapital: ['working capital', 'wc', 'limit', 'facility']
            };
            const lowerMessage = firstUserMessage.content.toLowerCase();
            // Find the matching topic
            for (const [topic, keywords] of Object.entries(topics)) {
                if (keywords.some(keyword => lowerMessage.includes(keyword))) {
                    // Create a title based on the topic
                    switch (topic) {
                        case 'transactions':
                            if (lowerMessage.includes('recent')) {
                                return 'Recent Transactions Query';
                            }
                            if (lowerMessage.includes('last month')) {
                                return 'Last Month\'s Transactions';
                            }
                            if (lowerMessage.includes('this month')) {
                                return 'Current Month Transactions';
                            }
                            return 'Transaction History Query';
                        case 'kyc':
                            return 'KYC Status Information';
                        case 'personal':
                            if (lowerMessage.includes('name')) {
                                return 'Name Information Query';
                            }
                            if (lowerMessage.includes('address')) {
                                return 'Address Information Query';
                            }
                            return 'Personal Information Query';
                        case 'account':
                            return 'Account Information Query';
                        case 'loans':
                            return 'Loan Information Query';
                        case 'workingCapital':
                            return 'Working Capital Information';
                    }
                }
            }
            // If no specific topic found, use a substring of the message
            const title = firstUserMessage.content
                .split(/[.!?]/)[0] // Get first sentence
                .trim()
                .substring(0, 30); // Limit length
            return title + (title.length >= 30 ? '...' : '');
        }
        catch (error) {
            console.error('Error generating chat title:', error);
            return 'New Chat';
        }
    }
}
exports.OllamaService = OllamaService;
