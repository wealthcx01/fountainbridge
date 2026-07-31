import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Which address the brain bridge listens on (FB-061).
 *
 * This is the whole reason the composer could not search the venture brain: `host.docker.internal`
 * resolves to Docker's DEFAULT bridge (`docker0`), not to the gateway of the container's own compose
 * network — verified on ARCA's box by reading the container's /etc/hosts and testing both addresses.
 * The trap is that once every container sits on a compose network, docker0 goes NO-CARRIER and
 * `os.networkInterfaces()` stops listing it, so the one correct address becomes invisible to the
 * obvious API. The bridge bound 127.0.0.1 on every boot, warning loudly into a log nobody read.
 *
 * The function is re-implemented here from `brain-bridge.mjs` because that module refuses to load
 * without a token and starts a server on import. Keep the two in step; the shapes below are real
 * `os.networkInterfaces()` output from the box.
 */
const dockerBridgeAddress = (interfaces, ipFallback = () => null) => {
  const found = { legacy: null, compose: null };
  for (const [name, addrs] of Object.entries(interfaces)) {
    const v4 = (addrs || []).find((a) => a.family === 'IPv4' && !a.internal);
    if (!v4) continue;
    if (/^docker/.test(name)) found.legacy ??= v4.address;
    else if (/^br-/.test(name)) found.compose ??= v4.address;
  }
  if (!found.legacy) found.legacy = ipFallback('docker0');
  return found.legacy ?? found.compose;
};

const v4 = (address, internal = false) => [{ family: 'IPv4', address, internal }];

describe('the address the composer reaches the brain on', () => {
  it('finds a DOWN docker0 that os.networkInterfaces() hides — the case broken on ARCA', () => {
    // Verbatim from the box: every container is on the compose network, so docker0 went NO-CARRIER
    // and node stopped listing it — while `host.docker.internal` went on resolving to its address.
    const real = {
      lo: v4('127.0.0.1', true),
      eth0: v4('167.233.160.141'),
      'br-61fadd2636f7': v4('172.18.0.1'),
      vethb773d89: [],
      veth2d64d89: [],
    };
    expect(dockerBridgeAddress(real, () => '172.17.0.1')).toBe('172.17.0.1');
  });

  it('prefers docker0 over a compose network, because that is what host-gateway resolves to', () => {
    // Tested on the box: the container's /etc/hosts maps host.docker.internal → 172.17.0.1, and
    // only that address answers. Binding the compose gateway looks right and reaches nothing.
    expect(dockerBridgeAddress({
      docker0: v4('172.17.0.1'),
      'br-abc123': v4('172.18.0.1'),
    })).toBe('172.17.0.1');
  });

  it('falls back to a compose network only when there is no docker0 at all', () => {
    expect(dockerBridgeAddress({ 'br-abc123': v4('172.18.0.1') })).toBe('172.18.0.1');
  });

  it('still works on a plain docker0 setup with no compose network', () => {
    expect(dockerBridgeAddress({ lo: v4('127.0.0.1', true), docker0: v4('172.17.0.1') })).toBe('172.17.0.1');
  });

  it('does not call out to `ip` when node already found docker0', () => {
    const spy = vi.fn();
    dockerBridgeAddress({ docker0: v4('172.17.0.1') }, spy);
    expect(spy).not.toHaveBeenCalled();
  });

  it('returns nothing when Docker is not up, so the caller can wait rather than bind wrongly', () => {
    expect(dockerBridgeAddress({ lo: v4('127.0.0.1', true), eth0: v4('10.0.0.5') })).toBeNull();
  });

  it('never picks the public interface or loopback', () => {
    const addr = dockerBridgeAddress({
      lo: v4('127.0.0.1', true),
      eth0: v4('167.233.160.141'),
      'br-x': v4('172.18.0.1'),
    });
    expect(addr).not.toBe('167.233.160.141');
    expect(addr).not.toBe('127.0.0.1');
  });

  it('ignores a bridge that has no IPv4 address yet', () => {
    // Mid-boot: the interface exists but dockerd has not addressed it.
    expect(dockerBridgeAddress({ 'br-notready': [], docker0: v4('172.17.0.1') })).toBe('172.17.0.1');
  });
});
