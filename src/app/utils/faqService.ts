import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './initFirebase';

interface FAQItem {
  question: string;
  answer: string;
  keywords?: string[];
  category?: string;
  lastUpdated?: string;
}

interface SearchResult {
  item: FAQItem;
  score: number;
}

export class FAQService {
  private faqList: FAQItem[] = [];
  private cache: Map<string, string> = new Map();
  private lastFetchTime: number = 0;
  private readonly CACHE_TTL = 1000 * 60 * 60; // 1 hour
  private readonly FETCH_INTERVAL = 1000 * 60 * 5; // 5 minutes
  private readonly SIMILARITY_THRESHOLD = 0.6;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    await this.loadFAQs();
    // Set up periodic refresh
    setInterval(() => this.loadFAQs(), this.FETCH_INTERVAL);
  }

  private async loadFAQs() {
    try {
      const now = Date.now();
      // Only fetch if enough time has passed since last fetch
      if (now - this.lastFetchTime < this.FETCH_INTERVAL) {
        return;
      }

      console.log('Loading FAQs from Firebase...');
      const faqSnapshot = await getDocs(collection(db, 'faq'));
      this.faqList = faqSnapshot.docs.map(doc => ({
        ...doc.data() as FAQItem,
        id: doc.id
      }));
      this.lastFetchTime = now;
      console.log(`Loaded ${this.faqList.length} FAQs`);
    } catch (error) {
      console.error('Error loading FAQs:', error);
    }
  }

  private calculateSimilarity(str1: string, str2: string): number {
    // Convert strings to lowercase and split into words
    const words1 = str1.toLowerCase().split(/\W+/);
    const words2 = str2.toLowerCase().split(/\W+/);

    // Create sets of unique words
    const set1 = new Set(words1);
    const set2 = new Set(words2);

    // Calculate intersection
    const intersection = new Set([...set1].filter(x => set2.has(x)));

    // Calculate Jaccard similarity
    const union = new Set([...set1, ...set2]);
    return intersection.size / union.size;
  }

  private searchFAQ(query: string): SearchResult[] {
    // First check cache
    const cachedAnswer = this.cache.get(query);
    if (cachedAnswer) {
      return [{
        item: { question: query, answer: cachedAnswer },
        score: 1
      }];
    }

    // Search through FAQ list
    const results: SearchResult[] = this.faqList.map(item => ({
      item,
      score: Math.max(
        this.calculateSimilarity(query, item.question),
        item.keywords?.some(kw => query.toLowerCase().includes(kw.toLowerCase())) ? 0.8 : 0
      )
    }));

    // Filter and sort results
    return results
      .filter(r => r.score >= this.SIMILARITY_THRESHOLD)
      .sort((a, b) => b.score - a.score);
  }

  private formatAnswer(results: SearchResult[]): string {
    if (results.length === 0) {
      return "I apologize, but I couldn't find a specific answer to your question. Could you please rephrase or ask something more specific?";
    }

    if (results.length === 1) {
      return results[0].item.answer;
    }

    // Combine multiple relevant answers
    return results
      .map((r, i) => `${i + 1}. ${r.item.answer}`)
      .join('\n\n');
  }

  async getAnswer(query: string): Promise<string> {
    try {
      // Ensure FAQs are loaded
      if (this.faqList.length === 0) {
        await this.loadFAQs();
      }

      // Search for matches
      const matches = this.searchFAQ(query);
      const answer = this.formatAnswer(matches);

      // Cache the answer if it's good
      if (matches.length > 0) {
        this.cache.set(query, answer);
      }

      return answer;
    } catch (error) {
      console.error('Error getting answer:', error);
      return "I'm sorry, but I encountered an error while processing your question. Please try again.";
    }
  }

  // Method to preload specific categories or types of FAQs
  async preloadCategory(category: string) {
    try {
      const categoryQuery = query(collection(db, 'faq'), where('category', '==', category));
      const snapshot = await getDocs(categoryQuery);
      const categoryFAQs = snapshot.docs.map(doc => ({
        ...doc.data() as FAQItem,
        id: doc.id
      }));
      
      // Merge with existing FAQs, replacing any duplicates
      this.faqList = [
        ...this.faqList.filter(faq => faq.category !== category),
        ...categoryFAQs
      ];
    } catch (error) {
      console.error(`Error preloading category ${category}:`, error);
    }
  }
} 