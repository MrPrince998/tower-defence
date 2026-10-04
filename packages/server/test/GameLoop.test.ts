import { GameLoop, type LoopClock } from '../src/loop/GameLoop';
import { RateLimiter } from '../src/sockets/rateLimiter';

function fakeClock() {
  let t = 0;
  const clock: LoopClock = { now: () => t, setInterval: () => 1, clearInterval: () => {} };
  return { clock, advance: (ms: number) => (t += ms) };
}

describe('GameLoop', () => {
  it('10 s of runtime = 200 ticks ±2 with jittery intervals', () => {
    const { clock, advance } = fakeClock();
    let ticks = 0;
    const loop = new GameLoop(() => ticks++, clock);
    loop.start();
    let elapsed = 0;
    let i = 0;
    while (elapsed < 10_000) {
      const step = 7 + ((i++ * 37) % 11); // 7..17 ms jitter
      advance(step);
      elapsed += step;
      loop.pump();
    }
    expect(Math.abs(ticks - 200)).toBeLessThanOrEqual(2);
  });

  it('caps the accumulator to avoid the spiral of death', () => {
    const { clock, advance } = fakeClock();
    let ticks = 0;
    const loop = new GameLoop(() => ticks++, clock);
    loop.start();
    advance(5000); // a 5 s stall
    loop.pump();
    expect(ticks).toBe(5); // 0.25 s worth
  });

  it('runs in real time', async () => {
    let ticks = 0;
    const loop = new GameLoop(() => ticks++);
    loop.start();
    loop.start(); // idempotent
    await new Promise((r) => setTimeout(r, 1000));
    loop.stop();
    loop.stop();
    expect(loop.running).toBe(false);
    expect(ticks).toBeGreaterThanOrEqual(17);
    expect(ticks).toBeLessThanOrEqual(22);
  });

  it('stops mid-pump when a step stops the loop', () => {
    const { clock, advance } = fakeClock();
    let ticks = 0;
    const loop: GameLoop = new GameLoop(() => {
      ticks++;
      loop.stop();
    }, clock);
    loop.start();
    advance(200);
    loop.pump();
    expect(ticks).toBe(1);
  });
});

describe('RateLimiter', () => {
  it('allows 10 commands per second', () => {
    let t = 0;
    const rl = new RateLimiter(10, 10, () => t);
    const burst = Array.from({ length: 12 }, () => rl.allow());
    expect(burst.filter(Boolean)).toHaveLength(10);
    t += 500;
    expect(Array.from({ length: 6 }, () => rl.allow()).filter(Boolean)).toHaveLength(5);
  });
});
