import { NLPQueryService } from './src/app/utils/nlpQueryService';

async function testQuery() {
    const nlp = new NLPQueryService('your-company-id');
    try {
        const result = await nlp.processQuery('show my transactions for the last 2 weeks');
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Error:', error);
    }
}

testQuery();
