import { collection, getDocs, setDoc, doc } from 'firebase/firestore';
import { initFirebase } from './initFirebase';

interface QueryTemplate {
  id: string;
  name: string;
  description: string;
  pattern: string;
  sqlEquivalent: string;
  firebaseQuery: string;
  parameters: string[];
  category: 'attendance' | 'employee' | 'department' | 'performance' | 'general';
  created: Date;
  lastUsed: Date;
  useCount: number;
}

export class QueryTemplateManager {
  private db;

  constructor() {
    const { db } = initFirebase();
    this.db = db;
  }

  async saveTemplate(template: Omit<QueryTemplate, 'id' | 'created' | 'lastUsed' | 'useCount'>): Promise<string> {
    try {
      const templatesRef = collection(this.db, 'queryTemplates');
      const templateId = `${template.category}_${Date.now()}`;
      
      await setDoc(doc(this.db, 'queryTemplates', templateId), {
        ...template,
        id: templateId,
        created: new Date(),
        lastUsed: new Date(),
        useCount: 0
      });

      return templateId;
    } catch (error) {
      if (error instanceof Error) {
        console.error('Error saving template:', error.message);
      }
      throw new Error('Failed to save query template');
    }
  }

  async findMatchingTemplate(userQuery: string): Promise<QueryTemplate | null> {
    try {
      const templatesRef = collection(this.db, 'queryTemplates');
      const snapshot = await getDocs(templatesRef);
      
      let bestMatch: QueryTemplate | null = null;
      let highestScore = 0;

      snapshot.docs.forEach(doc => {
        const template = doc.data() as QueryTemplate;
        const score = this.calculateMatchScore(userQuery, template.pattern);
        
        if (score > highestScore) {
          highestScore = score;
          bestMatch = template;
        }
      });

      if (bestMatch && highestScore > 0.7) { // 70% match threshold
        await this.updateTemplateUsage(bestMatch.id);
        return bestMatch;
      }

      return null;
    } catch (error) {
      if (error instanceof Error) {
        console.error('Error finding template:', error.message);
      }
      return null;
    }
  }

  private calculateMatchScore(query: string, pattern: string): number {
    // Normalize strings
    const normalizedQuery = query.toLowerCase().trim();
    const normalizedPattern = pattern.toLowerCase().trim();

    // Split into words
    const queryWords = normalizedQuery.split(/\s+/);
    const patternWords = normalizedPattern.split(/\s+/);

    // Count matching words
    const matchingWords = queryWords.filter(word => 
      patternWords.some(pattern => pattern.includes(word) || word.includes(pattern))
    );

    return matchingWords.length / Math.max(queryWords.length, patternWords.length);
  }

  private async updateTemplateUsage(templateId: string): Promise<void> {
    try {
      const templateRef = doc(this.db, 'queryTemplates', templateId);
      const template = (await getDocs(collection(this.db, 'queryTemplates'))).docs
        .find(doc => doc.id === templateId);

      if (template) {
        const data = template.data() as QueryTemplate;
        await setDoc(templateRef, {
          ...data,
          lastUsed: new Date(),
          useCount: (data.useCount || 0) + 1
        });
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error('Error updating template usage:', error.message);
      }
    }
  }
} 