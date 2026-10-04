import jwt from 'jsonwebtoken';

export interface TokenPayload {
  sub: string;
  name: string;
}

export function signToken(payload: TokenPayload, secret: string): string {
  return jwt.sign({ name: payload.name }, secret, { subject: payload.sub, expiresIn: '7d' });
}

export function verifyToken(token: string, secret: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, secret);
    if (typeof decoded === 'string' || !decoded.sub || typeof decoded.name !== 'string') return null;
    return { sub: decoded.sub, name: decoded.name };
  } catch {
    return null;
  }
}
