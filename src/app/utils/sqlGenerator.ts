interface SQLQueryParts {
  select: string[];
  from: string;
  where: string[];
  orderBy?: string;
  limit?: number;
  groupBy?: string;
}

export class SQLGenerator {
  generateSQL(intent: any): { sql: string; firebase: string } {
    const queryParts: SQLQueryParts = {
      select: ['*'],
      from: '',
      where: []
    };

    // Determine the base table/collection
    switch (intent.primaryIntent) {
      case 'employee_search':
        queryParts.from = 'employees';
        if (intent.entities.employeeName) {
          queryParts.where.push(`Name LIKE '%${intent.entities.employeeName}%'`);
        }
        break;
      case 'department_info':
        queryParts.from = 'employees';
        if (intent.entities.department) {
          queryParts.where.push(`Department = '${intent.entities.department}'`);
        }
        break;
      case 'attendance':
        queryParts.from = 'absentees';
        if (intent.entities.dateRange) {
          queryParts.where.push(
            `date >= '${intent.entities.dateRange.start}'`,
            `date <= '${intent.entities.dateRange.end}'`
          );
        }
        break;
      case 'work_hours':
        queryParts.from = 'workhours';
        break;
    }

    // Add status filter
    if (intent.entities.status === 'active') {
      queryParts.where.push("Status = 'Active'");
    }

    // Add sorting
    if (intent.filters.sortBy) {
      queryParts.orderBy = intent.filters.sortBy;
    }

    // Add limit
    if (intent.filters.limit) {
      queryParts.limit = intent.filters.limit;
    }

    // Generate SQL
    const sql = this.buildSQLQuery(queryParts);
    
    // Generate equivalent Firebase query
    const firebase = this.buildFirebaseQuery(queryParts);

    return { sql, firebase };
  }

  private buildSQLQuery(parts: SQLQueryParts): string {
    let query = `SELECT ${parts.select.join(', ')} FROM ${parts.from}`;
    
    if (parts.where.length > 0) {
      query += ` WHERE ${parts.where.join(' AND ')}`;
    }
    
    if (parts.groupBy) {
      query += ` GROUP BY ${parts.groupBy}`;
    }
    
    if (parts.orderBy) {
      query += ` ORDER BY ${parts.orderBy}`;
    }
    
    if (parts.limit) {
      query += ` LIMIT ${parts.limit}`;
    }

    return query;
  }

  private buildFirebaseQuery(parts: SQLQueryParts): string {
    let query = `const q = query(collection(db, '${parts.from}')`

    // Add where clauses
    parts.where.forEach(whereClause => {
      const [field, operator, value] = this.parseWhereClause(whereClause);
      query += `,\n  where('${field}', '${operator}', ${value})`;
    });

    // Add order by
    if (parts.orderBy) {
      query += `,\n  orderBy('${parts.orderBy}')`;
    }

    // Add limit
    if (parts.limit) {
      query += `,\n  limit(${parts.limit})`;
    }

    query += '\n);';
    return query;
  }

  private parseWhereClause(clause: string): [string, string, string] {
    const likeMatch = clause.match(/(\w+)\s+LIKE\s+'%(.+)%'/);
    if (likeMatch) {
      return [likeMatch[1], '>=', `'${likeMatch[2]}'`];
    }

    const equalMatch = clause.match(/(\w+)\s+=\s+'(.+)'/);
    if (equalMatch) {
      return [equalMatch[1], '==', `'${equalMatch[2]}'`];
    }

    const compareMatch = clause.match(/(\w+)\s+([<>=]+)\s+'(.+)'/);
    if (compareMatch) {
      return [compareMatch[1], compareMatch[2], `'${compareMatch[3]}'`];
    }

    return ['', '==', ''];
  }
} 