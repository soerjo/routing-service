import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard.js';

const buildContext = (user?: { role: string }): ExecutionContext =>
  ({
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as unknown as ExecutionContext;

const buildGuard = (roles: string[] | undefined) => {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(roles),
  } as unknown as Reflector;
  return new RolesGuard(reflector);
};

describe('RolesGuard', () => {
  it('allows the request when no roles are required', () => {
    expect(buildGuard(undefined).canActivate(buildContext())).toBe(true);
  });

  it('allows a user whose role matches a required role', () => {
    expect(
      buildGuard(['DRIVER']).canActivate(buildContext({ role: 'DRIVER' })),
    ).toBe(true);
  });

  it('denies a user whose role does not match', () => {
    expect(
      buildGuard(['DRIVER']).canActivate(buildContext({ role: 'USER' })),
    ).toBe(false);
  });

  it('denies when there is no authenticated user', () => {
    expect(buildGuard(['DRIVER']).canActivate(buildContext(undefined))).toBe(
      false,
    );
  });
});
