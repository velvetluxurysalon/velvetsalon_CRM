import type { StaffRoleType, StaffRoleStatus } from '../models/staffRole.model.js';

// name/phone are marked optional even though a valid request always needs
// them — this interface only describes the shape of an unchecked JSON body
// (`req.body as CreateStaffRoleDto`), not a guarantee. createStaffRole
// validates their presence itself; the type just needs to admit that
// possibility so that check isn't "impossible" per TypeScript.
export interface CreateStaffRoleDto {
  name?: string;
  phone?: string;
  email?: string;
  role?: StaffRoleType;
  speciality?: string;
  status?: StaffRoleStatus;
  joinDate?: string;
  exitDate?: string;
  notes?: string;
}

export type UpdateStaffRoleDto = Partial<CreateStaffRoleDto>;

export interface StaffRoleQueryDto {
  q?: string;
  role?: StaffRoleType | 'all';
  status?: StaffRoleStatus | 'all';
}