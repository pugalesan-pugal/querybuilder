interface MaskingRules {
  [key: string]: {
    type: 'full' | 'partial' | 'custom';
    pattern?: RegExp;
    replacement?: string;
    customMask?: (value: string) => string;
  };
}

export class DataMasking {
  private static readonly DEFAULT_RULES: MaskingRules = {
    email: {
      type: 'partial',
      pattern: /^(.{2})(.+)(@.+)$/,
      replacement: '$1***$3'
    },
    phone: {
      type: 'partial',
      pattern: /^(\+?\d{2})(\d+)(\d{4})$/,
      replacement: '$1****$3'
    },
    salary: {
      type: 'custom',
      customMask: (value: string) => {
        const num = parseFloat(value);
        if (isNaN(num)) return '***';
        return `${Math.round(num / 1000)}K`;
      }
    },
    ssn: {
      type: 'partial',
      pattern: /^(\d{3})(\d{2})(\d{4})$/,
      replacement: 'XXX-XX-$3'
    },
    accessCode: {
      type: 'full',
      replacement: '********'
    }
  };

  private rules: MaskingRules;

  constructor(customRules: MaskingRules = {}) {
    this.rules = { ...DataMasking.DEFAULT_RULES, ...customRules };
  }

  maskData(data: any, fieldsToMask: string[]): any {
    if (!data) return data;

    if (Array.isArray(data)) {
      return data.map(item => this.maskData(item, fieldsToMask));
    }

    if (typeof data === 'object') {
      const maskedData = { ...data };
      for (const field of fieldsToMask) {
        if (field in maskedData) {
          maskedData[field] = this.maskField(field, maskedData[field]);
        }
      }
      return maskedData;
    }

    return data;
  }

  private maskField(fieldName: string, value: any): string {
    if (value === null || value === undefined) return value;
    
    const rule = this.rules[fieldName];
    if (!rule) return value;

    const stringValue = String(value);

    switch (rule.type) {
      case 'full':
        return rule.replacement || '****';
      
      case 'partial':
        if (rule.pattern && rule.replacement) {
          return stringValue.replace(rule.pattern, rule.replacement);
        }
        return stringValue;
      
      case 'custom':
        if (rule.customMask) {
          return rule.customMask(stringValue);
        }
        return stringValue;
      
      default:
        return stringValue;
    }
  }

  addMaskingRule(fieldName: string, rule: MaskingRules[string]): void {
    this.rules[fieldName] = rule;
  }

  removeMaskingRule(fieldName: string): void {
    delete this.rules[fieldName];
  }
} 