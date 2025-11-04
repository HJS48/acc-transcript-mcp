// src/auth.ts
import { Request, Response, NextFunction } from 'express';

// Simple API key authentication with user mapping
export interface User {
  email: string;
  allowedClients: string[];
  accessLevel: 'read' | 'write' | 'admin';
}

// In production, store this in a database
// For MVP, we'll use environment variables
const API_KEYS: Record<string, User> = {
  'acc-demo-key-001': {
    email: 'demo@accfinance.com',
    allowedClients: ['*'], // Access to all clients
    accessLevel: 'admin'
  },
  'acc-john-key-002': {
    email: 'john@accfinance.com',
    allowedClients: ['Client X', 'Client Y'],
    accessLevel: 'read'
  },
  'acc-sarah-key-003': {
    email: 'sarah@accfinance.com',
    allowedClients: ['Client Z'],
    accessLevel: 'read'
  }
};

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export function validateApiKey(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  // Check for Bearer token
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('[AUTH] No bearer token provided');
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Bearer token required' 
    });
  }
  
  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  
  // Validate token
  const user = API_KEYS[token];
  
  if (!user) {
    console.log(`[AUTH] Invalid token: ${token.substring(0, 10)}...`);
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Invalid API key' 
    });
  }
  
  // Attach user to request
  req.user = user;
  
  // Log successful auth for audit trail
  console.log(`[AUTH] ✓ ${user.email} authenticated | Access Level: ${user.accessLevel} | Clients: ${user.allowedClients.join(', ')}`);
  
  next();
}

// Helper function to check if user can access a specific client
export function canAccessClient(user: User, clientName: string): boolean {
  return user.allowedClients.includes('*') || user.allowedClients.includes(clientName);
}