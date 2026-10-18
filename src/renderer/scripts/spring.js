/**
 * 弹簧动画引擎（Apple 参数模型）
 * ------------------------------------------------------------------
 * 为什么不用 CSS transition：
 *   CSS 过渡无法在中途被「抓住」并从当前速度继续，Apple 反复强调
 *   交互驱动动画必须可打断。弹簧天然可打断：改 target 即可，
 *   速度和位置保持连续，不会出现「撞墙」般的速度突变。
 *
 * WWDC 参数 → 物理系数（质量固定为 1）：
 *   stiffness = (2π / response)²
 *   damping   = 4π · dampingRatio / response
 *
 * 用法：
 *   const s = createSpring({ value: 268, damping: 0.8, response: 0.34,
 *                            onUpdate: v => el.style.width = v + 'px' });
 *   s.to(404);            // 也可以中途 s.to(300) 改目标
 *   s.stop();
 */

const SUBSTEP = 1 / 240; // 固定子步长，保证不同帧率下行为一致

export function createSpring({
  value = 0,
  damping = 1,
  response = 0.4,
  velocity = 0,
  onUpdate,
  onRest,
  restDelta = 0.2,
  restVelocity = 0.2,
} = {}) {
  let x = value;
  let v = velocity;
  let target = value;
  let running = false;
  let lastTime = 0;
  let rafId = null;

  const omega = () => (2 * Math.PI) / Math.max(0.05, response);
  const stiffness = () => omega() * omega();
  const dampingCoef = () => (4 * Math.PI * damping) / Math.max(0.05, response);

  function step(dt) {
    // 半隐式欧拉：先更新速度再更新位置，稳定性足够且开销极低
    const k = stiffness();
    const c = dampingCoef();
    const a = -k * (x - target) - c * v;
    v += a * dt;
    x += v * dt;
  }

  function tick(now) {
    if (!running) return;
    if (!lastTime) lastTime = now;
    let dt = (now - lastTime) / 1000;
    lastTime = now;
    // 掉帧保护：单帧最多推进 64ms，避免切后台回来时爆炸
    dt = Math.min(dt, 0.064);

    let remaining = dt;
    while (remaining > 0) {
      const h = Math.min(SUBSTEP, remaining);
      step(h);
      remaining -= h;
    }

    onUpdate?.(x, v);

    if (Math.abs(v) < restVelocity && Math.abs(x - target) < restDelta) {
      x = target;
      v = 0;
      onUpdate?.(x, v);
      stop();
      onRest?.();
      return;
    }
    rafId = requestAnimationFrame(tick);
  }

  function start() {
    if (running) return;
    running = true;
    lastTime = 0;
    rafId = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  return {
    /** 改目标（可中途改，速度和位置连续） */
    to(next, { velocity: v0 } = {}) {
      target = next;
      if (typeof v0 === 'number') v = v0;
      start();
      return this;
    },
    /** 立刻跳到某个值，不播动画 */
    jump(next) {
      stop();
      x = next;
      target = next;
      v = 0;
      onUpdate?.(x, v);
      return this;
    },
    get value() {
      return x;
    },
    get velocity() {
      return v;
    },
    get target() {
      return target;
    },
    stop,
    isRunning: () => running,
  };
}

/** 多路并联弹簧：同时驱动一组数值，任一到达即停 */
export function createSpringGroup(keys, opts) {
  const springs = {};
  for (const k of keys) {
    springs[k] = createSpring({ ...opts, value: opts.value?.[k] ?? 0 });
  }
  return {
    springs,
    to(values) {
      for (const [k, v] of Object.entries(values)) springs[k]?.to(v);
    },
    stop() {
      Object.values(springs).forEach((s) => s.stop());
    },
  };
}
