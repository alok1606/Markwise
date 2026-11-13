import {describe,it,expect} from 'vitest';
import {canManageUsers,roleSchema,roleNavigation,profileSchema} from '@/lib/access';
describe('Phase 1 permissions',()=>{
it('creator cannot manage users',()=>expect(canManageUsers('creator')).toBe(false));
it('manager cannot manage users',()=>expect(canManageUsers('manager')).toBe(false));
it('reviewer cannot manage users',()=>expect(canManageUsers('reviewer')).toBe(false));
it('admin can manage users',()=>expect(canManageUsers('admin')).toBe(true));
it('accepts exactly the four specified roles',()=>{expect(roleSchema.options).toEqual(['creator','manager','reviewer','admin']);expect(roleSchema.safeParse('owner').success).toBe(false);});
it('only admin has user management navigation',()=>{expect(roleNavigation.admin).toContain('Users');for(const role of ['creator','manager','reviewer'] as const)expect(roleNavigation[role]).not.toContain('Users');});
it('only admin has accuracy evaluation navigation',()=>{expect(roleNavigation.admin).toContain('Accuracy');for(const role of ['creator','manager','reviewer'] as const)expect(roleNavigation[role]).not.toContain('Accuracy');});
it('only admin has the fact impact navigation',()=>{expect(roleNavigation.admin).toContain('Fact Impact');for(const role of ['creator','manager','reviewer'] as const)expect(roleNavigation[role]).not.toContain('Fact Impact');});
it('validates profile names without role fields',()=>{expect(profileSchema.safeParse({full_name:''}).success).toBe(false);expect(profileSchema.parse({full_name:'Alok',role:'admin'})).toEqual({full_name:'Alok'});});
});
