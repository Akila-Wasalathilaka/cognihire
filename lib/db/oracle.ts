import { v4 as uuidv4 } from 'uuid';

// Oracle database configuration and utilities
interface OracleConfig {
  user?: string;
  password?: string;
  connectString?: string;
}

interface QueryResult {
  rows: any[];
  rowsAffected?: number;
}

class OracleDatabase {
  private config: OracleConfig;
  private isConnected: boolean = false;

  constructor() {
    this.config = {
      user: process.env.ORACLE_USER,
      password: process.env.ORACLE_PASSWORD,
      connectString: process.env.ORACLE_CONNECT_STRING
    };
  }

  async connect(): Promise<boolean> {
    try {
      // In a real implementation, you would use oracle database driver here
      // For now, we'll simulate connection based on environment variables
      if (this.config.user && this.config.password && this.config.connectString) {
        console.log('Oracle connection configured');
        this.isConnected = true;
        return true;
      } else {
        console.log('Oracle not configured, using fallback');
        this.isConnected = false;
        return false;
      }
    } catch (error) {
      console.error('Oracle connection error:', error);
      this.isConnected = false;
      return false;
    }
  }

  async executeQuery(query: string, params: any[] = []): Promise<QueryResult> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      if (this.isConnected) {
        // In a real implementation, execute Oracle query here
        console.log('Oracle query:', query, params);
        
        // Mock response for testing
        return {
          rows: [],
          rowsAffected: 0
        };
      } else {
        // Fallback to backend API
        return this.fallbackToAPI(query, params);
      }
    } catch (error) {
      console.error('Oracle query error:', error);
      return this.fallbackToAPI(query, params);
    }
  }

  private async fallbackToAPI(query: string, params: any[]): Promise<QueryResult> {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      
      // For SELECT queries, try to determine the endpoint
      if (query.toLowerCase().includes('select')) {
        if (query.toLowerCase().includes('users')) {
          // Fetch users data
          const response = await fetch(`${apiUrl}/admin/candidates`);
          if (response.ok) {
            const data = await response.json();
            return { rows: data };
          }
        } else if (query.toLowerCase().includes('job_roles')) {
          // Fetch job roles data
          const response = await fetch(`${apiUrl}/job-roles`);
          if (response.ok) {
            const data = await response.json();
            return { rows: data };
          }
        }
      }
      
      return { rows: [] };
    } catch (error) {
      console.error('API fallback error:', error);
      return { rows: [] };
    }
  }

  generateId(): string {
    return uuidv4();
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
  }
}

// Create singleton instance
const oracleDB = new OracleDatabase();

// Export functions for backwards compatibility
export const executeQuery = (query: string, params?: any[]) => 
  oracleDB.executeQuery(query, params || []);

export const generateId = () => oracleDB.generateId();

// Export the database instance
export default oracleDB;