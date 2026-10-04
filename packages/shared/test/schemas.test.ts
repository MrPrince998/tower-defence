import { loginSchema, registerSchema, schemas } from '../src';

describe('socket payload schemas', () => {
  it('accepts valid payloads', () => {
    expect(schemas['tower:place'].parse({ type: 'arrow', x: 3, y: 4 })).toEqual({
      type: 'arrow',
      x: 3,
      y: 4,
    });
    expect(schemas['room:join'].parse({ code: ' abcd ' })).toEqual({ code: 'ABCD' });
  });

  it('rejects unknown fields, bad enums and out-of-range integers', () => {
    expect(schemas['tower:place'].safeParse({ type: 'arrow', x: 1, y: 1, gold: 999 }).success).toBe(false);
    expect(schemas['tower:place'].safeParse({ type: 'plasma', x: 1, y: 1 }).success).toBe(false);
    expect(schemas['tower:place'].safeParse({ type: 'arrow', x: -1, y: 1 }).success).toBe(false);
    expect(schemas['tower:place'].safeParse({ type: 'arrow', x: 1.5, y: 1 }).success).toBe(false);
    expect(schemas['tower:place'].safeParse({ type: 'arrow', x: 999, y: 1 }).success).toBe(false);
    expect(schemas['tower:upgrade'].safeParse({ towerId: '1' }).success).toBe(false);
    expect(schemas['wave:skip'].safeParse({ now: true }).success).toBe(false);
    expect(schemas['room:join'].safeParse({ code: 'TOOLONG' }).success).toBe(false);
  });

  it('validates auth bodies', () => {
    expect(registerSchema.safeParse({ username: 'ab', email: 'a@b.co', password: '12345678' }).success).toBe(
      false,
    );
    expect(
      registerSchema.safeParse({ username: 'bob_1', email: 'A@B.co', password: '12345678' }).success,
    ).toBe(true);
    expect(
      registerSchema.safeParse({ username: 'bob 1', email: 'a@b.co', password: '12345678' }).success,
    ).toBe(false);
    expect(loginSchema.safeParse({ login: 'bob', password: 'x', admin: true }).success).toBe(false);
  });
});

describe('phase 12 payloads', () => {
  it('upgrade takes an optional branch; perk choice must be a known perk', () => {
    expect(schemas['tower:upgrade'].safeParse({ towerId: 1, branch: 'a' }).success).toBe(true);
    expect(schemas['tower:upgrade'].safeParse({ towerId: 1 }).success).toBe(true);
    expect(schemas['tower:upgrade'].safeParse({ towerId: 1, branch: 'c' }).success).toBe(false);
    expect(schemas['perk:choose'].safeParse({ perk: 'interest' }).success).toBe(true);
    expect(schemas['perk:choose'].safeParse({ perk: 'godmode' }).success).toBe(false);
    expect(schemas['send:enemy'].safeParse({ type: 'shielded' }).success).toBe(true);
    expect(schemas['send:enemy'].safeParse({ type: 'boss' }).success).toBe(false);
  });
});
