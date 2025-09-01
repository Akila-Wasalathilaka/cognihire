import { v4 as uuidv4 } from 'uuid';

// Mock database functions for compatibility
export const executeQuery = async (query: string, params?: any[]) => {
  console.log('Mock executeQuery called:', query, params);
  return { rows: [] };
};

export const generateId = () => uuidv4();

export default {
  executeQuery,
  generateId
};