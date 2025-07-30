import { collection, getDocs, setDoc, doc, getDoc } from 'firebase/firestore';
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

      snapshot.docs.forEach(docSnap => {
        const template = docSnap.data() as QueryTemplate;
        const score = this.calculateMatchScore(userQuery, template.pattern);
        
        if (score > highestScore) {
          highestScore = score;
          bestMatch = template;
        }
      });

    if (bestMatch && highestScore > 0.7) { // 70% match threshold
  await this.updateTemplateUsage(bestMatch!);
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
    const normalizedQuery = query.toLowerCase().trim();
    const normalizedPattern = pattern.toLowerCase().trim();

    const queryWords = normalizedQuery.split(/\s+/);
    const patternWords = normalizedPattern.split(/\s+/);

    const matchingWords = queryWords.filter(word => 
      patternWords.some(pattern => pattern.includes(word) || word.includes(pattern))
    );

    return matchingWords.length / Math.max(queryWords.length, patternWords.length);
  }

  private async updateTemplateUsage(templateId: string): Promise<void> {
    try {
      const templateRef = doc(this.db, 'queryTemplates', templateId);
      const templateSnap = await getDoc(templateRef);

      if (templateSnap.exists()) {
        const data = templateSnap.data() as QueryTemplate;
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
